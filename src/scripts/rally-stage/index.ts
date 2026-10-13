// A drivable special stage for rally mode's Race tab. The page's inline
// script owns the menus; this module takes over from the loading screen to
// the results table, then hands back with a rally:race-exit event.
import {
  Group,
  Mesh,
  MeshLambertMaterial,
  MeshPhongMaterial,
  PerspectiveCamera,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
  type Material,
} from 'three';
import { blobShadow, loadTiguan } from '../rally-tiguan';
import { RallyAudio } from './audio';
import { forwardSpeed, newCar, stepCar, SURFACES, WEATHER_GRIP, type CarState, type Input } from './car';
import { drawHud, formatTime, type HudState } from './hud';
import { buildTrack, parTimes, STEP, type Note, type Track } from './track';
import { buildWorld, type World } from './world';

export interface StageSpec {
  index: number;
  code: string;
  short: string;
  banner: [string, string];
  bannerColor: string;
  weather: string;
  temp: number;
  drive: { surface: string; scenery: string; seed: number; hills: number; length?: number };
}

const TIPS = [
  'Space pulls the handbrake. It is the fastest way around a hairpin and the slowest way around anything else.',
  'R puts the car back on the road. The marshals charge five seconds for it.',
  'C changes the camera. The bonnet view is for people with something to prove.',
  'Reviewer 2 is quick on every surface and never explains why.',
  'Wet tarmac has about three quarters of the grip of dry. Brake earlier than feels necessary.',
  'Lift off before a jump and land with the wheels straight.',
  'Your best time on each stage is saved in this browser.',
  'The real trophies are under Records on the main menu.',
  'A gamepad works: right trigger to go, left trigger to stop, A for the handbrake.',
  'M turns sound on, including the co-driver. Headphones are recommended in open offices.',
];

// Times are multiples of par, which is about what the car manages driven
// flat-out on the ideal line
const RIVALS: [string, string, number][] = [
  ['Reviewer 2', 'Subaru Impreza', 1.005],
  ['Reviewer 1', 'Ford Focus', 1.05],
  ['Committee Chair', 'Peugeot 206', 1.1],
  ['The IRB', 'Volvo 240 Estate', 1.18],
  ['Office Hours', 'Fiat Panda 4x4', 1.3],
];

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector(sel) as T;
const show = (name: string) => document.dispatchEvent(new CustomEvent('rally:show', { detail: name }));
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const bot = new URLSearchParams(location.search).has('bot');

let renderer: WebGLRenderer | null = null;
let running = false;

function chevron() {
  const c = document.createElement('canvas');
  c.width = c.height = 10;
  c.className = 'chev';
  const g = c.getContext('2d')!;
  g.fillStyle = '#c9cfcf';
  g.fillRect(0, 0, 10, 10);
  g.strokeStyle = '#2a2e2f';
  g.strokeRect(0.5, 0.5, 9, 9);
  g.lineWidth = 1.4;
  g.beginPath();
  g.moveTo(3.5, 2.5);
  g.lineTo(6.5, 5);
  g.lineTo(3.5, 7.5);
  g.stroke();
  return c;
}

function menu(list: HTMLElement, items: { label: string; go: () => void }[], onSelect: (i: number) => void) {
  list.innerHTML = '';
  return items.map((item, i) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.appendChild(chevron());
    const s = document.createElement('span');
    s.textContent = item.label;
    b.appendChild(s);
    b.addEventListener('click', () => {
      onSelect(i);
      item.go();
    });
    li.appendChild(b);
    list.appendChild(li);
    return { b, s };
  });
}

// Stage outline for the loading card, like the route maps in the service area
function drawStageMap(c: HTMLCanvasElement, t: Track) {
  const g = c.getContext('2d')!;
  const { minX, maxX, minZ, maxZ } = t.bounds;
  const pad = 16;
  const k = Math.min((c.width - pad * 2) / (maxX - minX || 1), (c.height - pad * 2) / (maxZ - minZ || 1));
  const ox = (c.width - (maxX - minX) * k) / 2, oz = (c.height - (maxZ - minZ) * k) / 2;
  // Screen x is mirrored: +x in the world is the driver's left
  const px = (i: number) => c.width - (ox + (t.x[i] - minX) * k);
  const pz = (i: number) => c.height - (oz + (t.z[i] - minZ) * k);
  g.clearRect(0, 0, c.width, c.height);
  for (const [w, col] of [[5, '#3e4647'], [2, '#f2f4ee']] as const) {
    g.lineWidth = w;
    g.strokeStyle = col;
    g.lineJoin = 'round';
    g.beginPath();
    for (let i = 0; i < t.n; i += 3) (i ? g.lineTo : g.moveTo).call(g, px(i), pz(i));
    g.stroke();
  }
  const mark = (s: number, col: string, r: number) => {
    const i = Math.min(t.n - 1, Math.round(s / STEP));
    g.fillStyle = col;
    g.fillRect(Math.round(px(i) - r), Math.round(pz(i) - r), r * 2, r * 2);
  };
  t.splits.forEach((sp) => mark(sp, '#e3e8c2', 2));
  mark(t.startS, '#9be08f', 4);
  mark(t.finishS, '#f3efa0', 4);
}

function bestKey(code: string) {
  return `rally-best-${code}-v1`;
}

function readBest(code: string): number | null {
  try {
    const v = localStorage.getItem(bestKey(code));
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}

export async function runStage(spec: StageSpec) {
  if (running) return;
  running = true;
  const session = new Session(spec);
  try {
    await session.load();
    if (await session.waitForStart()) session.begin();
    else session.exit();
  } catch (err) {
    console.error('Stage failed to start:', err);
    session.exit();
  }
}

type Phase = 'countdown' | 'running' | 'finished' | 'results';

class Session {
  private track!: Track;
  private world!: World;
  private camera = new PerspectiveCamera(62, 640 / 480, 0.3, 900);
  private carRoot = new Group();
  private shadowRoot = new Group();
  private brakeMats: (MeshLambertMaterial | MeshPhongMaterial)[] = [];
  private car!: CarState;
  private audio = new RallyAudio();
  private hud = ($('#stage-hud') as HTMLCanvasElement).getContext('2d')!;
  private grip = 1;
  private top = 44;
  private loose = false;
  private wet = false;
  private par!: { v: Float32Array; cum: Float32Array };

  private phase: Phase = 'countdown';
  private paused = false;
  private clock = 0; // seconds since GO (or negative during countdown)
  private penalty = 0;
  private splitTimes: number[] = [];
  private finishTime = 0;
  private finishedAt = 0;
  private idx = 0;
  private s = 0;
  private offset = 0;
  private wrongFor = 0;
  private topSpeed = 0;
  private spoken = new Set<number>();
  private noteAlpha = 0;
  private message: HudState['message'] = null;
  private messageUntil = 0;
  private shake = 0;
  private camMode = 0;
  private camYaw = 0;
  private raf = 0;
  private last = 0;
  private hintUntil = 0;
  private botPace = Number(new URLSearchParams(location.search).get('bot') || 0.92);

  private keys = new Set<string>();
  private touch = { left: false, right: false, gas: false, brake: false, hand: false };
  private pad = { steer: 0, throttle: 0, brake: 0, hand: false, buttons: [] as boolean[] };
  private pauseItems: { b: HTMLButtonElement; s: HTMLSpanElement }[] = [];
  private pauseIdx = 0;
  private resultItems: { b: HTMLButtonElement; s: HTMLSpanElement }[] = [];
  private resultIdx = 1;
  private listeners: [EventTarget, string, EventListener, AddEventListenerOptions?][] = [];

  constructor(private spec: StageSpec) {}

  private on(target: EventTarget, type: string, fn: EventListener, opts?: AddEventListenerOptions) {
    target.addEventListener(type, fn, opts);
    this.listeners.push([target, type, fn, opts]);
  }

  async load() {
    const { spec } = this;
    $('#load-tip').textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
    const bar = $('#load-bar');
    const progress = (p: number) => (bar.style.width = `${Math.round(p * 100)}%`);
    const tick = () => new Promise((r) => setTimeout(r, 0));
    progress(0.05);

    const surface = SURFACES[spec.drive.surface] ?? SURFACES.tarmac;
    this.grip = surface.grip * (WEATHER_GRIP[spec.weather] ?? 1);
    this.top = surface.top;
    this.loose = surface.loose;
    this.wet = /Rain|Drizzle|Storm/.test(spec.weather);
    const width = surface.loose ? 6.4 : 7;
    this.track = buildTrack({ seed: spec.drive.seed, length: spec.drive.length ?? 1350, hills: spec.drive.hills, width, crests: 0.55 });
    this.par = parTimes(this.track, this.grip, this.top);
    drawStageMap($('#load-map') as HTMLCanvasElement, this.track);
    const facts = $('#load-facts');
    const len = document.createElement('div');
    len.textContent = `Length: ${((this.track.finishS - this.track.startS) / 1000).toFixed(2)} km`;
    facts.appendChild(len);
    const best = readBest(spec.code);
    if (best !== null) {
      const b = document.createElement('div');
      b.textContent = `Your best: ${formatTime(best)}`;
      facts.appendChild(b);
    }
    progress(0.15);
    await tick();

    const model = await loadTiguan((f) => progress(0.15 + f * 0.55));
    const car = model.clone();
    car.rotation.y = Math.PI; // the model faces −z
    car.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      const next = mats.map((mat: Material) => {
        if (!/Taillight|Reflector Red|Dark Red Glossy/i.test(mat.name)) return mat;
        const c = mat.clone() as MeshLambertMaterial | MeshPhongMaterial;
        this.brakeMats.push(c);
        return c;
      });
      m.material = Array.isArray(m.material) ? next : next[0];
    });
    this.carRoot.add(car);
    this.carRoot.rotation.order = 'YXZ';
    this.shadowRoot.add(blobShadow(4.7, 2.15));
    progress(0.75);
    await tick();

    this.world = buildWorld(this.track, {
      scenery: spec.drive.scenery,
      surface: spec.drive.surface,
      weather: spec.weather,
      banner: spec.banner,
      bannerColor: spec.bannerColor,
      seed: spec.drive.seed,
    });
    this.world.scene.add(this.carRoot, this.shadowRoot);
    this.world.particles.setColor(
      this.loose ? (spec.drive.surface === 'clay' ? '#b8744f' : '#b49a77') : '#d3dadc',
    );
    progress(0.95);
    await tick();

    if (!renderer) {
      renderer = new WebGLRenderer({ canvas: $('#stage-gl') as HTMLCanvasElement, antialias: false, powerPreference: 'high-performance' });
      renderer.setPixelRatio(1);
      renderer.setSize(640, 480, false);
      renderer.outputColorSpace = SRGBColorSpace;
    }
    this.reset();
    renderer.compile(this.world.scene, this.camera);
    progress(1);
  }

  // Hold on the loading card until the player is ready, as the original did,
  // so there is time to read the stage and the pace-note key
  waitForStart(): Promise<boolean> {
    if (bot) return Promise.resolve(true);
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    $('#load-track').hidden = true;
    const ready = $('#load-ready');
    ready.textContent = coarse ? 'Tap to start' : 'Press ↵ to start';
    ready.hidden = false;
    const screen = $('[data-screen="loading"]');
    return new Promise((resolve) => {
      let raf = 0;
      const done = (go: boolean) => {
        window.removeEventListener('keydown', onKey);
        screen.removeEventListener('click', onClick);
        cancelAnimationFrame(raf);
        resolve(go);
      };
      const onKey = (e: KeyboardEvent) => {
        if (e.repeat) return;
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          done(true);
        } else if (e.code === 'Escape') done(false);
      };
      const onClick = () => done(true);
      const held = new Set<number>();
      const poll = () => {
        const p = Array.from(navigator.getGamepads?.() ?? []).find((x) => x && x.connected);
        if (p) {
          for (const i of [0, 9]) {
            if (p.buttons[i]?.pressed && !held.has(i)) return done(true);
            if (!p.buttons[i]?.pressed) held.delete(i);
          }
          if (p.buttons[1]?.pressed) return done(false);
        }
        raf = requestAnimationFrame(poll);
      };
      // Ignore a button that was already down when the card appeared
      const p0 = Array.from(navigator.getGamepads?.() ?? []).find((x) => x && x.connected);
      [0, 9].forEach((i) => p0?.buttons[i]?.pressed && held.add(i));
      window.addEventListener('keydown', onKey);
      screen.addEventListener('click', onClick);
      raf = requestAnimationFrame(poll);
    });
  }

  private reset() {
    const t = this.track;
    const i = Math.round((t.startS - 6) / STEP);
    this.car = newCar(t.x[i], t.y[i], t.z[i], Math.atan2(t.tx[i], t.tz[i]));
    this.idx = i;
    this.camYaw = this.car.heading;
    this.phase = 'countdown';
    this.clock = -3;
    this.flash('3', undefined, 0.8, '#f3efa0', true);
    this.penalty = 0;
    this.splitTimes = [];
    this.spoken.clear();
    this.topSpeed = 0;
    this.wrongFor = 0;
    this.message = null;
    this.paused = false;
    $('#stage-pause').hidden = true;
  }

  begin() {
    show('race');
    this.hintUntil = performance.now() + 9000;
    this.on(window, 'keydown', (e) => this.onKey(e as KeyboardEvent, true));
    this.on(window, 'keyup', (e) => this.onKey(e as KeyboardEvent, false));
    this.on(document, 'visibilitychange', () => {
      if (document.hidden && this.phase !== 'results') this.setPaused(true);
    });
    this.on(window, 'blur', () => this.keys.clear());
    this.setupTouch();
    this.pauseItems = menu($('#pause-list'), [
      { label: 'Continue', go: () => this.setPaused(false) },
      { label: 'Restart stage', go: () => this.reset() },
      { label: this.soundLabel(), go: () => this.toggleSound() },
      { label: 'Retire', go: () => this.exit() },
    ], (i) => (this.pauseIdx = i));
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  private soundLabel() {
    return `Sound: ${this.audio.enabled ? 'On' : 'Off'}`;
  }

  private toggleSound() {
    this.audio.setEnabled(!this.audio.enabled);
    if (this.pauseItems[2]) this.pauseItems[2].s.textContent = this.soundLabel();
    this.flash(this.audio.enabled ? 'Sound on' : 'Sound off', undefined, 1.2);
  }

  private setPaused(p: boolean) {
    if (this.phase === 'results') return;
    this.paused = p;
    $('#stage-pause').hidden = !p;
    if (p) {
      this.audio.quiet();
      this.pauseIdx = 0;
      this.highlight(this.pauseItems, 0);
    }
  }

  private highlight(items: { b: HTMLButtonElement }[], i: number) {
    items.forEach((it, j) => it.b.classList.toggle('on', j === i));
  }

  private onKey(e: KeyboardEvent, down: boolean) {
    const code = e.code;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)) e.preventDefault();
    if (!down) {
      this.keys.delete(code);
      return;
    }
    if (e.repeat && this.keys.has(code)) return;
    this.keys.add(code);

    if (this.phase === 'results') {
      if (code === 'ArrowUp' || code === 'ArrowDown') {
        this.resultIdx = (this.resultIdx + (code === 'ArrowUp' ? -1 : 1) + this.resultItems.length) % this.resultItems.length;
        this.highlight(this.resultItems, this.resultIdx);
      } else if (code === 'Enter') this.resultItems[this.resultIdx]?.b.click();
      else if (code === 'KeyR') this.retry();
      else if (code === 'Escape') this.exit();
      return;
    }
    if (this.paused) {
      if (code === 'ArrowUp' || code === 'ArrowDown') {
        this.pauseIdx = (this.pauseIdx + (code === 'ArrowUp' ? -1 : 1) + this.pauseItems.length) % this.pauseItems.length;
        this.highlight(this.pauseItems, this.pauseIdx);
      } else if (code === 'Enter') this.pauseItems[this.pauseIdx]?.b.click();
      else if (code === 'Escape' || code === 'KeyP') this.setPaused(false);
      return;
    }
    if (code === 'Escape' || code === 'KeyP') this.setPaused(true);
    else if (code === 'KeyC') this.camMode = (this.camMode + 1) % 3;
    else if (code === 'KeyR') this.recover();
    else if (code === 'KeyM') this.toggleSound();
  }

  private setupTouch() {
    const pad = $('#touch');
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    pad.hidden = !coarse;
    this.on(window, 'touchstart', () => (pad.hidden = false), { once: true, passive: true });
    pad.querySelectorAll<HTMLElement>('[data-k]').forEach((el) => {
      const k = el.dataset.k as keyof Session['touch'] | 'pause';
      const set = (v: boolean) => (e: Event) => {
        e.preventDefault();
        if (k === 'pause') {
          if (v) this.setPaused(!this.paused);
          return;
        }
        this.touch[k] = v;
        el.classList.toggle('on', v);
        if (v) el.setPointerCapture?.((e as PointerEvent).pointerId);
      };
      this.on(el, 'pointerdown', set(true));
      this.on(el, 'pointerup', set(false));
      this.on(el, 'pointercancel', set(false));
      this.on(el, 'lostpointercapture', set(false));
    });
  }

  private readPad() {
    const pads = navigator.getGamepads?.() ?? [];
    const p = Array.from(pads).find((x) => x && x.connected);
    if (!p) return;
    const ax = p.axes[0] ?? 0;
    this.pad.steer = Math.abs(ax) > 0.15 ? -ax : 0;
    this.pad.throttle = p.buttons[7]?.value ?? 0;
    this.pad.brake = p.buttons[6]?.value ?? 0;
    this.pad.hand = !!p.buttons[0]?.pressed;
    const pressed = p.buttons.map((b) => b.pressed);
    const edge = (i: number) => pressed[i] && !this.pad.buttons[i];
    if (edge(9)) this.phase === 'results' ? this.resultItems[this.resultIdx]?.b.click() : this.setPaused(!this.paused);
    if (edge(3)) this.camMode = (this.camMode + 1) % 3;
    if (edge(8)) this.recover();
    if (this.paused && edge(0)) this.pauseItems[this.pauseIdx]?.b.click();
    if (this.paused && (edge(12) || edge(13))) {
      this.pauseIdx = (this.pauseIdx + (edge(12) ? -1 : 1) + this.pauseItems.length) % this.pauseItems.length;
      this.highlight(this.pauseItems, this.pauseIdx);
    }
    this.pad.buttons = pressed;
  }

  private input(): Input {
    const k = this.keys;
    const left = k.has('ArrowLeft') || k.has('KeyA') || this.touch.left;
    const right = k.has('ArrowRight') || k.has('KeyD') || this.touch.right;
    const gas = k.has('ArrowUp') || k.has('KeyW') || this.touch.gas;
    const brake = k.has('ArrowDown') || k.has('KeyS') || this.touch.brake;
    const inp: Input = {
      throttle: Math.max(gas ? 1 : 0, this.pad.throttle),
      brake: Math.max(brake ? 1 : 0, this.pad.brake),
      steer: Math.max(-1, Math.min(1, (left ? 1 : 0) - (right ? 1 : 0) + this.pad.steer)),
      handbrake: k.has('Space') || this.touch.hand || this.pad.hand,
    };
    if (bot) return this.autopilot();
    return inp;
  }

  // Test driver: aims at a point down the road and follows the par speed profile
  private autopilot(): Input {
    const t = this.track, c = this.car;
    const v = Math.hypot(c.vx, c.vz);
    const ahead = Math.min(t.n - 1, this.idx + Math.round(6 + v * 0.45));
    const dx = t.x[ahead] - c.x, dz = t.z[ahead] - c.z;
    let err = Math.atan2(dx, dz) - c.heading;
    err = Math.atan2(Math.sin(err), Math.cos(err));
    // Fastest speed from which every corner in view can still be made
    const a = 7.5 * this.grip;
    let target = Infinity;
    for (let i = this.idx; i <= Math.min(t.n - 1, this.idx + 110); i += 2) {
      const d = (i - this.idx) * STEP;
      target = Math.min(target, Math.sqrt((this.par.v[i] * this.botPace) ** 2 + 2 * a * d));
    }
    return { steer: Math.max(-1, Math.min(1, err * 2.4)), throttle: v < target - 0.4 ? 1 : 0, brake: v > target + 0.6 ? 1 : 0, handbrake: false };
  }

  private recover() {
    if (this.phase !== 'running') return;
    const t = this.track, i = Math.min(t.n - 1, Math.max(0, this.idx));
    this.car = newCar(t.x[i], t.y[i], t.z[i], Math.atan2(t.tx[i], t.tz[i]));
    this.camYaw = this.car.heading;
    this.penalty += 5;
    this.flash('+5 s penalty', 'Car recovered', 2, '#e0a35a');
  }

  private flash(text: string, sub?: string, seconds = 2, color?: string, big = false) {
    this.message = { text, sub, color, big };
    this.messageUntil = performance.now() + seconds * 1000;
  }

  private locate() {
    const t = this.track, c = this.car;
    let best = this.idx, bd = Infinity;
    for (let i = Math.max(0, this.idx - 25); i < Math.min(t.n, this.idx + 40); i++) {
      const dx = c.x - t.x[i], dz = c.z - t.z[i];
      const d = dx * dx + dz * dz;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    this.idx = best;
    const dx = c.x - t.x[best], dz = c.z - t.z[best];
    const along = dx * t.tx[best] + dz * t.tz[best];
    this.s = best * STEP + along;
    // + is left of travel; right vector is (−tz, tx)
    this.offset = -(dx * -t.tz[best] + dz * t.tx[best]);
  }

  private ground() {
    const t = this.track;
    const f = this.s / STEP;
    const i = Math.max(3, Math.min(t.n - 4, Math.floor(f)));
    const k = Math.max(0, Math.min(1, f - i));
    return {
      y: t.y[i] + (t.y[i + 1] - t.y[i]) * k,
      slope: (t.y[i + 2] - t.y[i - 1]) / (3 * STEP),
      curve: (t.y[i + 3] - 2 * t.y[i] + t.y[i - 3]) / (9 * STEP * STEP),
    };
  }

  private groundY() {
    return this.ground().y;
  }

  private physics(dt: number) {
    const t = this.track, c = this.car;
    let inp = this.input();
    if (this.phase === 'countdown') inp = { throttle: 0, brake: 1, steer: inp.steer, handbrake: false };
    if (this.phase === 'finished' || this.phase === 'results') inp = { throttle: 0, brake: 0.6, steer: 0, handbrake: false };
    this.locate();
    const edge = t.width / 2;
    const out = Math.abs(this.offset) - edge;
    const offroad = out > 0.3 ? Math.min(1, out / 2) : 0;
    stepCar(c, inp, dt, this.grip, this.top, offroad, this.ground());
    if (this.phase === 'countdown') {
      c.vx = c.vz = 0;
      c.rpm = 1100 + this.input().throttle * 4800;
    }

    // Scenery wall beyond the verge
    this.locate();
    const wall = edge + 7.5;
    if (Math.abs(this.offset) > wall) {
      const sign = Math.sign(this.offset);
      const i = this.idx;
      const lx = t.tz[i], lz = -t.tx[i]; // left unit vector
      const push = Math.abs(this.offset) - wall;
      c.x -= lx * sign * push;
      c.z -= lz * sign * push;
      const vn = (c.vx * lx + c.vz * lz) * sign;
      if (vn > 0) {
        c.vx -= lx * sign * vn * 1.25;
        c.vz -= lz * sign * vn * 1.25;
        c.vx *= 0.7;
        c.vz *= 0.7;
        if (vn > 3) this.impact(vn);
      }
    }
    // Rocks on the inside of "don't cut" corners
    for (const r of t.rocks) {
      const dx = c.x - r.x, dz = c.z - r.z;
      const d = Math.hypot(dx, dz), min = r.r + 0.95;
      if (d < min && d > 0.001) {
        c.x += (dx / d) * (min - d);
        c.z += (dz / d) * (min - d);
        const vn = -(c.vx * dx + c.vz * dz) / d;
        if (vn > 0) {
          c.vx += (dx / d) * vn * 1.3;
          c.vz += (dz / d) * vn * 1.3;
          c.vx *= 0.6;
          c.vz *= 0.6;
          this.impact(vn + 3);
        }
      }
    }
    if (c.landing > 5) this.impact(c.landing * 0.6);
  }

  private impact(v: number) {
    if (!reduceMotion) this.shake = Math.min(1, this.shake + v / 14);
    this.audio.thump(v);
  }

  private gameplay(dt: number) {
    const t = this.track;
    if (this.phase === 'countdown') {
      const before = Math.ceil(-this.clock);
      this.clock += dt;
      const now = Math.ceil(-this.clock);
      if (now !== before && now > 0) this.flash(String(now), undefined, 0.8, '#f3efa0', true);
      if (this.clock >= 0) {
        this.clock = 0;
        this.phase = 'running';
        this.flash('GO!', undefined, 0.9, '#f3efa0', true);
      }
      return;
    }
    if (this.phase !== 'running') return;
    this.clock += dt;
    const speed = Math.abs(forwardSpeed(this.car));
    this.topSpeed = Math.max(this.topSpeed, speed);

    // Splits against the field
    t.splits.forEach((sp, k) => {
      if (this.splitTimes[k] !== undefined || this.s < sp) return;
      const time = this.clock + this.penalty;
      this.splitTimes[k] = time;
      const parAt = this.par.cum[Math.round(sp / STEP)];
      const field = RIVALS.map(([name, , m]) => ({ name, time: parAt * m })).concat({ name: 'liam', time });
      field.sort((a, b) => a.time - b.time);
      const pos = field.findIndex((f) => f.name === 'liam') + 1;
      const lead = field[0].name === 'liam' ? field[1] : field[0];
      const diff = time - lead.time;
      this.flash(`Split ${k + 1}  ${formatTime(time)}`, `P${pos}  ${diff > 0 ? '+' : '−'}${Math.abs(diff).toFixed(2)} ${field[0].name === 'liam' ? 'ahead of' : 'to'} ${lead.name}`, 3, pos === 1 ? '#a8e0a0' : undefined);
    });

    if (this.s >= t.finishS) {
      this.phase = 'finished';
      this.finishTime = this.clock + this.penalty;
      this.finishedAt = performance.now();
      this.flash('Finish', formatTime(this.finishTime), 2.5, '#f3efa0', true);
      this.audio.say('stop, stop. Nice drive.');
      return;
    }

    // Wrong way
    const i = this.idx;
    const along = Math.sin(this.car.heading) * t.tx[i] + Math.cos(this.car.heading) * t.tz[i];
    this.wrongFor = along < -0.3 && speed > 3 ? this.wrongFor + dt : 0;
    if (this.wrongFor > 1.2) this.flash('Wrong way', 'R to recover', 0.3, '#e0583c');

    // The co-driver reads ahead by time, not distance
    const notes = t.notes;
    const k = notes.findIndex((n) => n.end > this.s - 2);
    if (k >= 0 && !this.spoken.has(k)) {
      const n = notes[k];
      const reach = Math.max(55, Math.min(175, speed * 3.4 + 35));
      if (n.s - this.s < reach) {
        this.spoken.add(k);
        let line = n.call;
        const next = notes[k + 1];
        if (next && (n.link === 'into' || n.link === 'and')) {
          line += `, ${n.link} ${next.call}`;
          this.spoken.add(k + 1);
        } else if (next && n.link) line += `, ${n.link}`;
        this.audio.say(line);
      }
    }
  }

  private currentNote(): [Note | null, Note | null, number] {
    const notes = this.track.notes;
    const k = notes.findIndex((n) => n.end > this.s - 2);
    if (k < 0) return [null, null, 0];
    const n = notes[k];
    const speed = Math.abs(forwardSpeed(this.car));
    const reach = Math.max(55, Math.min(175, speed * 3.4 + 35));
    const vis = n.s - this.s < reach ? 1 : 0;
    return [n, notes[k + 1] ?? null, vis];
  }

  private frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.max(0, Math.min(0.05, (now - this.last) / 1000));
    this.last = now;
    this.readPad();
    if (!this.paused) {
      const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
      for (let i = 0; i < steps; i++) {
        this.physics(dt / steps);
        this.gameplay(dt / steps);
      }
      if (this.phase === 'finished' && now - this.finishedAt > 2600) this.results();
    }
    this.render(dt, now);
  };

  private render(dt: number, now: number) {
    const c = this.car, t = this.track, w = this.world;
    const f = new Vector3(Math.sin(c.heading), 0, Math.cos(c.heading));
    const speed = Math.hypot(c.vx, c.vz);

    // Car body
    const i = Math.max(0, Math.min(t.n - 2, this.idx));
    const slope = (t.y[i + 1] - t.y[i]) / STEP;
    const pitch = c.airborne ? -Math.atan2(c.vy, Math.max(4, speed)) * 0.6 : -Math.atan(slope);
    this.carRoot.position.set(c.x, c.y, c.z);
    this.carRoot.rotation.set(pitch + c.pitch, c.heading, c.roll, 'YXZ');
    const gy = this.groundY();
    this.shadowRoot.position.set(c.x, gy + 0.03, c.z);
    this.shadowRoot.rotation.y = c.heading;
    const sm = (this.shadowRoot.children[0] as Mesh).material as MeshLambertMaterial;
    sm.opacity = Math.max(0, 1 - (c.y - gy) / 4);
    const braking = !this.paused && (this.input().brake > 0.1 || this.phase === 'finished');
    for (const m of this.brakeMats) m.emissive.setHex(braking ? 0x990000 : 0x000000);

    // Dust, spray, and tyre smoke from the rear wheels
    const offroad = Math.abs(this.offset) > t.width / 2 + 0.3;
    const slide = Math.abs(c.slip);
    if (!this.paused && !c.airborne && speed > 6) {
      const n = this.loose || offroad ? 2 : this.wet ? 1 : slide > 4 ? 1 : 0;
      const rx = -f.z, rz = f.x;
      for (let k = 0; k < n; k++) {
        const side = Math.random() < 0.5 ? -0.75 : 0.75;
        w.particles.emit(
          c.x - f.x * 1.6 + rx * side, c.y + 0.25, c.z - f.z * 1.6 + rz * side,
          c.vx * 0.45 + (Math.random() - 0.5) * 2, 0.6 + Math.random() * 1.2, c.vz * 0.45 + (Math.random() - 0.5) * 2,
          0.35 + Math.random() * 0.3,
        );
      }
    }
    if (!this.paused) w.particles.update(dt);

    // Camera
    const velYaw = speed > 4 ? Math.atan2(c.vx, c.vz) : c.heading;
    let want = c.heading;
    let diff = Math.atan2(Math.sin(velYaw - c.heading), Math.cos(velYaw - c.heading));
    want += diff * 0.35;
    diff = Math.atan2(Math.sin(want - this.camYaw), Math.cos(want - this.camYaw));
    this.camYaw += diff * Math.min(1, dt * 4.5);
    const cam = this.camera;
    const shake = reduceMotion ? 0 : this.shake;
    this.shake = Math.max(0, this.shake - dt * 2.2);
    const jitter = () => (Math.random() - 0.5) * shake * 0.3;
    if (this.camMode === 2) {
      cam.position.set(c.x + f.x * 1.75, c.y + 1.38, c.z + f.z * 1.75);
      cam.lookAt(c.x + f.x * 22, c.y + 1.15 + jitter(), c.z + f.z * 22);
      cam.fov = 70;
    } else {
      const [dist, h] = this.camMode === 0 ? [6.4, 2.15] : [9.5, 3.3];
      const bx = Math.sin(this.camYaw), bz = Math.cos(this.camYaw);
      cam.position.set(c.x - bx * dist + jitter(), Math.max(c.y, gy) + h + jitter(), c.z - bz * dist + jitter());
      cam.lookAt(c.x + bx * 3, c.y + 1.15, c.z + bz * 3);
      cam.fov = 60 + (reduceMotion ? 0 : Math.min(8, speed * 0.18));
    }
    cam.updateProjectionMatrix();
    w.sky.position.copy(cam.position);
    w.ridge.position.set(cam.position.x, cam.position.y + 10, cam.position.z);

    if (w.rain) {
      const pos = w.rain.geometry.attributes.position as unknown as { array: Float32Array; needsUpdate: boolean };
      const a = pos.array;
      const fall = w.rainSpeed * dt;
      const sx = -c.vx * 0.03, sz = -c.vz * 0.03;
      for (let k = 0; k < a.length; k += 6) {
        let x = a[k], y = a[k + 1] - fall, z = a[k + 2];
        if (y < -6) y += 30;
        x -= c.vx * dt;
        z -= c.vz * dt;
        if (x > 25) x -= 50;
        if (x < -25) x += 50;
        if (z > 25) z -= 50;
        if (z < -25) z += 50;
        a[k] = x; a[k + 1] = y; a[k + 2] = z;
        a[k + 3] = x + sx; a[k + 4] = y - 0.8; a[k + 5] = z + sz;
      }
      pos.needsUpdate = true;
      w.rain.position.set(c.x, c.y, c.z);
    }

    // Spectators jump when the car is close
    for (const p of w.crowd) {
      const d = Math.hypot(p.sprite.position.x - c.x, p.sprite.position.z - c.z);
      p.sprite.position.y = p.base + (d < 45 && !this.paused ? Math.max(0, Math.sin(now / 90 + p.phase)) * 0.35 : 0);
    }

    renderer!.render(w.scene, cam);

    // Sound
    if (!this.paused) {
      const inp = this.input();
      this.audio.update(c.rpm, inp.throttle, speed, this.loose || offroad, c.slip, c.airborne);
    }

    // HUD
    const [note, next, vis] = this.currentNote();
    this.noteAlpha += ((this.phase === 'running' ? vis : 0) - this.noteAlpha) * Math.min(1, dt * 10);
    if (this.message && now > this.messageUntil) this.message = null;
    const span = t.finishS - t.startS;
    drawHud(this.hud, {
      code: this.spec.code,
      name: this.spec.short,
      time: this.phase === 'countdown' ? null : this.phase === 'running' ? this.clock + this.penalty : this.finishTime,
      speed: Math.abs(forwardSpeed(c)) * 3.6,
      rpm: c.rpm,
      gear: c.gear,
      progress: (this.s - t.startS) / span,
      splits: t.splits.map((sp) => (sp - t.startS) / span),
      note, next,
      noteAlpha: this.noteAlpha,
      message: this.message,
      hint: now >= this.hintUntil ? null : $('#touch').hidden
        ? `Arrows drive · Space handbrake · C camera · R recover · Esc pause · M sound ${this.audio.enabled ? 'on' : 'off'}`
        : null,
      sound: this.audio.enabled,
    });
  }

  private results() {
    this.phase = 'results';
    this.audio.quiet();
    const time = this.finishTime;
    const parTime = this.par.cum[Math.round(this.track.finishS / STEP)];
    const rows = RIVALS.map(([name, car, m]) => ({ name, car, time: parTime * m, me: false }));
    rows.push({ name: 'liam', car: 'VW Tiguan', time, me: true });
    rows.sort((a, b) => a.time - b.time);
    const lead = rows[0].time;
    const body = $('#results-body');
    body.innerHTML = '';
    rows.forEach((r, k) => {
      const tr = document.createElement('tr');
      if (r.me) tr.className = 'me';
      for (const v of [String(k + 1), r.name, r.car, formatTime(r.time), k === 0 ? '' : `+${(r.time - lead).toFixed(2)}`]) {
        const td = document.createElement('td');
        td.textContent = v;
        tr.appendChild(td);
      }
      body.appendChild(tr);
    });
    $('#results-title').textContent = `${this.spec.code}  ${this.spec.short}`;
    const prev = readBest(this.spec.code);
    const record = prev === null || time < prev;
    if (record) {
      try {
        localStorage.setItem(bestKey(this.spec.code), String(time));
      } catch {
        /* private mode */
      }
    }
    $('#results-record').hidden = !record || prev === null;
    const pos = rows.findIndex((r) => r.me) + 1;
    $('#results-stats').textContent = [
      `Position: ${pos} of ${rows.length}`,
      `Top speed: ${Math.round(this.topSpeed * 3.6)} km/h`,
      `Penalties: ${this.penalty ? `${this.penalty} s` : 'none'}`,
      `Best: ${formatTime(Math.min(time, prev ?? time))}`,
    ].join('\n');
    this.resultItems = menu($('#results-list'), [
      { label: 'Retry stage', go: () => this.retry() },
      { label: 'Continue', go: () => this.exit() },
    ], (i) => (this.resultIdx = i));
    this.resultIdx = 1;
    this.highlight(this.resultItems, 1);
    $('#touch').hidden = true;
    show('results');
  }

  private retry() {
    this.reset();
    show('race');
    if (window.matchMedia('(pointer: coarse)').matches) $('#touch').hidden = false;
  }

  exit() {
    cancelAnimationFrame(this.raf);
    for (const [t, type, fn, opts] of this.listeners) t.removeEventListener(type, fn, opts);
    this.listeners = [];
    this.audio.quiet();
    this.world?.dispose();
    for (const m of this.brakeMats) m.dispose();
    $('#stage-pause').hidden = true;
    $('#touch').hidden = true;
    running = false;
    document.dispatchEvent(new CustomEvent('rally:race-exit', { detail: this.spec.index }));
  }
}

