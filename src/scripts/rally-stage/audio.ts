// Engine drone, surface noise, thumps, and the co-driver. Off by default;
// the toggle is remembered per browser.

const KEY = 'rally-sound';

export function soundPreference(): boolean {
  try {
    return localStorage.getItem(KEY) === 'on';
  } catch {
    return false;
  }
}

export class RallyAudio {
  enabled = soundPreference();
  private ctx: AudioContext | null = null;
  private engine: OscillatorNode | null = null;
  private sub: OscillatorNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;
  private roadGain: GainNode | null = null;
  private roadFilter: BiquadFilterNode | null = null;
  private skidGain: GainNode | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private voice: SpeechSynthesisVoice | null = null;

  setEnabled(on: boolean) {
    this.enabled = on;
    try {
      localStorage.setItem(KEY, on ? 'on' : 'off');
    } catch {
      /* private mode */
    }
    if (on) this.start();
    else this.silence();
  }

  private start() {
    if (this.ctx) {
      this.ctx.resume();
      this.master!.gain.value = 0.9;
      return;
    }
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(ctx.destination);

    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 700;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engine = ctx.createOscillator();
    this.engine.type = 'sawtooth';
    this.sub = ctx.createOscillator();
    this.sub.type = 'square';
    const subGain = ctx.createGain();
    subGain.gain.value = 0.35;
    this.engine.connect(this.filter);
    this.sub.connect(subGain).connect(this.filter);
    this.filter.connect(this.engineGain).connect(this.master);
    this.engine.start();
    this.sub.start();

    const len = ctx.sampleRate;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const loop = (freq: number, q: number) => {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = freq;
      f.Q.value = q;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(f).connect(gain).connect(this.master!);
      src.start();
      return { f, gain };
    };
    const road = loop(900, 0.7);
    this.roadFilter = road.f;
    this.roadGain = road.gain;
    this.skidGain = loop(2600, 6).gain;

    const pick = () => {
      const voices = speechSynthesis.getVoices();
      this.voice = voices.find((v) => /en-GB/i.test(v.lang)) ?? voices.find((v) => /^en/i.test(v.lang)) ?? null;
    };
    if ('speechSynthesis' in window) {
      pick();
      speechSynthesis.addEventListener?.('voiceschanged', pick);
    }
  }

  private silence() {
    if (this.master) this.master.gain.value = 0;
    if ('speechSynthesis' in window) speechSynthesis.cancel();
  }

  update(rpm: number, throttle: number, speed: number, loose: boolean, slip: number, airborne: boolean) {
    if (!this.enabled || !this.ctx || !this.engine) return;
    const t = this.ctx.currentTime;
    const f = 20 + rpm / 38;
    this.engine.frequency.setTargetAtTime(f, t, 0.03);
    this.sub!.frequency.setTargetAtTime(f / 2, t, 0.03);
    this.filter!.frequency.setTargetAtTime(380 + rpm / 9 + throttle * 500, t, 0.05);
    this.engineGain!.gain.setTargetAtTime(0.05 + throttle * 0.07, t, 0.05);
    const ground = airborne ? 0 : Math.min(1, speed / 30);
    this.roadGain!.gain.setTargetAtTime(ground * (loose ? 0.22 : 0.06), t, 0.08);
    this.roadFilter!.frequency.setTargetAtTime(loose ? 700 : 400, t, 0.1);
    const skid = !airborne && !loose ? Math.max(0, Math.min(1, (Math.abs(slip) - 2.5) / 5)) : 0;
    this.skidGain!.gain.setTargetAtTime(skid * 0.08, t, 0.05);
  }

  thump(strength: number) {
    if (!this.enabled || !this.ctx || !this.noise) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 220;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(Math.min(0.9, 0.25 + strength * 0.08), t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    src.connect(f).connect(g).connect(this.master!);
    src.start(t);
    src.stop(t + 0.4);
  }

  say(text: string) {
    if (!this.enabled || !('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.35;
    u.pitch = 0.95;
    u.volume = 0.9;
    if (this.voice) u.voice = this.voice;
    speechSynthesis.speak(u);
  }

  quiet() {
    if (this.engineGain && this.ctx) {
      const t = this.ctx.currentTime;
      this.engineGain.gain.setTargetAtTime(0, t, 0.05);
      this.roadGain!.gain.setTargetAtTime(0, t, 0.05);
      this.skidGain!.gain.setTargetAtTime(0, t, 0.05);
    }
    if ('speechSynthesis' in window) speechSynthesis.cancel();
  }
}
