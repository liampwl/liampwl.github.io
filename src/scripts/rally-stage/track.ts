// Stage generation. The road is planned the way a co-driver reads it — a
// list of graded corners and straights — and the geometry is built from that
// plan, so the pace notes describe the road exactly.

export const STEP = 1; // metres between centerline samples

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Pace-note grade → corner radius in metres. 1 is a hairpin, 6 is nearly flat.
const RADIUS = [0, 11, 19, 29, 44, 66, 105];
const ANGLE: [number, number][] = [[0, 0], [150, 178], [80, 125], [50, 105], [35, 90], [22, 65], [12, 38]];
const GRADE_WEIGHTS = [0, 0.06, 0.14, 0.22, 0.24, 0.2, 0.14];

type Seg =
  | { kind: 'straight'; len: number }
  | { kind: 'arc'; dir: 1 | -1; grade: number; angle: number; mods: string[] };

export interface Note {
  s: number; // where the feature starts
  end: number;
  kind: 'corner' | 'crest' | 'jump';
  dir: 1 | -1 | 0; // 1 left, -1 right
  grade: number;
  mods: string[];
  link: string; // how it joins the next note: 'into', 'and', '100'…
  call: string; // spoken text for this note alone
}

export interface Hazard { x: number; z: number; r: number }

export interface Track {
  n: number;
  length: number;
  width: number;
  x: Float32Array;
  y: Float32Array;
  z: Float32Array;
  tx: Float32Array; // unit tangent
  tz: Float32Array;
  curv: Float32Array; // signed curvature, + is left
  notes: Note[];
  rocks: Hazard[];
  chevrons: { s: number; dir: 1 | -1 }[];
  crowds: { s: number; side: 1 | -1 }[];
  startS: number;
  finishS: number;
  splits: number[];
  minY: number;
  maxY: number;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

export interface TrackOptions {
  seed: number;
  length: number;
  hills: number; // metres of rolling elevation
  width: number;
  crests: number; // 0–1 chance a long straight carries a crest
}

function pickGrade(r: () => number) {
  let x = r();
  for (let g = 1; g <= 6; g++) {
    x -= GRADE_WEIGHTS[g];
    if (x <= 0) return g;
  }
  return 4;
}

function plan(r: () => number, target: number): Seg[] {
  const segs: Seg[] = [{ kind: 'straight', len: 90 }];
  let heading = 0;
  let total = 90;
  const LIMIT = 1.75;
  while (total < target) {
    const short = r() < 0.25;
    const len = short ? 6 + r() * 14 : 25 + r() * 100;
    segs.push({ kind: 'straight', len });
    total += len;

    const grade = pickGrade(r);
    const [lo, hi] = ANGLE[grade];
    let angle = ((lo + r() * (hi - lo)) * Math.PI) / 180;
    let dir: 1 | -1 = r() < 0.5 ? 1 : -1;
    if (Math.abs(heading) > 0.6 && r() < 0.85) dir = heading > 0 ? -1 : 1;
    if (Math.abs(heading + dir * angle) > LIMIT) dir = dir === 1 ? -1 : 1;
    if (Math.abs(heading + dir * angle) > LIMIT) angle = Math.max(0.2, LIMIT - Math.abs(heading));
    const mods: string[] = [];
    if (grade >= 3 && angle > (100 * Math.PI) / 180) mods.push('long');
    if (grade <= 3 && r() < 0.3) mods.push("don't cut");
    segs.push({ kind: 'arc', dir, grade, angle, mods });
    heading += dir * angle;
    total += RADIUS[grade] * angle;

    // Compound corners: the same direction at a new grade
    if (grade >= 2 && grade <= 5 && r() < 0.2) {
      const next = Math.max(1, Math.min(6, grade + (r() < 0.5 ? -1 : 1)));
      let a2 = ((20 + r() * 35) * Math.PI) / 180;
      if (Math.abs(heading + dir * a2) > LIMIT) a2 = Math.max(0.1, LIMIT - Math.abs(heading));
      const prev = segs[segs.length - 1] as Extract<Seg, { kind: 'arc' }>;
      prev.mods.push(next < grade ? 'tightens' : 'opens');
      segs.push({ kind: 'arc', dir, grade: next, angle: a2, mods: ['__compound'] });
      heading += dir * a2;
      total += RADIUS[next] * a2;
    }
  }
  segs.push({ kind: 'straight', len: 150 });
  return segs;
}

function crossesItself(x: Float32Array, z: Float32Array, n: number, clearance: number) {
  const cell = clearance;
  const grid = new Map<string, number[]>();
  for (let i = 0; i < n; i += 2) {
    const k = `${Math.floor(x[i] / cell)},${Math.floor(z[i] / cell)}`;
    (grid.get(k) ?? grid.set(k, []).get(k)!).push(i);
  }
  const c2 = clearance * clearance;
  for (let i = 0; i < n; i += 2) {
    const cx = Math.floor(x[i] / cell), cz = Math.floor(z[i] / cell);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        for (const j of grid.get(`${cx + dx},${cz + dz}`) ?? []) {
          if (Math.abs(i - j) < clearance * 2.2) continue;
          const ex = x[i] - x[j], ez = z[i] - z[j];
          if (ex * ex + ez * ez < c2) return true;
        }
      }
    }
  }
  return false;
}

function callFor(n: Pick<Note, 'kind' | 'dir' | 'grade' | 'mods'>) {
  if (n.kind === 'crest') return 'over crest';
  if (n.kind === 'jump') return 'jump';
  const side = n.dir === 1 ? 'left' : 'right';
  const head = n.grade === 1 ? `hairpin ${side}` : `${side} ${n.grade}`;
  return [head, ...n.mods].join(' ');
}

export function buildTrack(opts: TrackOptions): Track {
  for (let attempt = 0; attempt < 40; attempt++) {
    const t = tryBuild({ ...opts, seed: opts.seed + attempt * 7919 });
    if (t) return t;
  }
  throw new Error('Could not lay out a stage');
}

function tryBuild(opts: TrackOptions): Track | null {
  const r = rng(opts.seed);
  const segs = plan(r, opts.length);

  // Curvature per sample, then a light smoothing so corners ease in
  const raw: number[] = [];
  const features: { s: number; end: number; seg: Seg }[] = [];
  let s = 0;
  for (const seg of segs) {
    const len = seg.kind === 'straight' ? seg.len : RADIUS[seg.grade] * seg.angle;
    const k = seg.kind === 'straight' ? 0 : seg.dir / RADIUS[seg.grade];
    const steps = Math.max(1, Math.round(len / STEP));
    features.push({ s, end: s + steps * STEP, seg });
    for (let i = 0; i < steps; i++) raw.push(k);
    s += steps * STEP;
  }
  const n = raw.length;
  const curv = new Float32Array(n);
  const W = 5;
  for (let i = 0; i < n; i++) {
    let sum = 0, cnt = 0;
    for (let j = i - W; j <= i + W; j++) {
      if (j < 0 || j >= n) continue;
      sum += raw[j];
      cnt++;
    }
    curv[i] = sum / cnt;
  }

  const x = new Float32Array(n), z = new Float32Array(n), y = new Float32Array(n);
  const tx = new Float32Array(n), tz = new Float32Array(n);
  let h = 0, px = 0, pz = 0;
  for (let i = 0; i < n; i++) {
    x[i] = px;
    z[i] = pz;
    tx[i] = Math.sin(h);
    tz[i] = Math.cos(h);
    px += tx[i] * STEP;
    pz += tz[i] * STEP;
    h += curv[i] * STEP;
  }
  if (crossesItself(x, z, n, 44)) return null;

  // Elevation: rolling hills, plus crests dropped onto long straights
  const p1 = r() * 6.28, p2 = r() * 6.28, p3 = r() * 6.28;
  const bumps: { c: number; h: number; w: number }[] = [];
  const notes: Note[] = [];
  for (const f of features) {
    if (f.seg.kind !== 'straight' || f.end - f.s < 85 || f.s < 120 || f.end > n - 160) continue;
    if (r() > opts.crests) continue;
    const c = f.s + (f.end - f.s) * (0.4 + r() * 0.2);
    // Jumps launch from roughly 70–95 km/h; plain crests only well above 110
    const big = r() < 0.55;
    const bh = big ? 2.0 + r() * 0.8 : 1.0 + r() * 0.6;
    const bw = big ? 14.5 + r() * 2.5 : 18 + r() * 6;
    bumps.push({ c, h: bh, w: bw });
    const kind = (2 * bh) / (bw * bw) > 0.012 ? 'jump' : 'crest';
    notes.push({ s: c - bw, end: c + bw, kind, dir: 0, grade: 0, mods: [], link: '', call: '' });
  }
  let minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    const si = i * STEP;
    const ease = Math.min(1, si / 140);
    let yy = opts.hills * ease * (0.6 * Math.sin(si / 170 + p1) + 0.3 * Math.sin(si / 73 + p2) + 0.1 * Math.sin(si / 37 + p3));
    for (const b of bumps) yy += b.h * Math.exp(-(((si - b.c) / b.w) ** 2));
    y[i] = yy;
    minY = Math.min(minY, yy);
    maxY = Math.max(maxY, yy);
  }

  // Corner notes; a compound corner's second half rides on the first note
  for (const f of features) {
    if (f.seg.kind !== 'arc') continue;
    if (f.seg.mods.includes('__compound')) {
      const prev = notes.filter((nn) => nn.kind === 'corner').at(-1);
      if (prev) prev.end = f.end;
      continue;
    }
    notes.push({ s: f.s, end: f.end, kind: 'corner', dir: f.seg.dir, grade: f.seg.grade, mods: f.seg.mods, link: '', call: '' });
  }
  notes.sort((a, b) => a.s - b.s);
  for (let i = 0; i < notes.length; i++) {
    const nn = notes[i];
    nn.call = callFor(nn);
    const next = notes[i + 1];
    if (!next) continue;
    const gap = next.s - nn.end;
    nn.link = gap < 22 ? 'into' : gap < 55 ? 'and' : String(Math.round(gap / 50) * 50);
  }

  // Set dressing tied to the notes
  const rocks: Hazard[] = [];
  const chevrons: { s: number; dir: 1 | -1 }[] = [];
  const crowds: { s: number; side: 1 | -1 }[] = [];
  for (const nn of notes) {
    if (nn.kind !== 'corner') continue;
    const mid = Math.min(n - 1, Math.round((nn.s + nn.end) / 2 / STEP));
    const inside = nn.dir; // + is left
    if (nn.mods.includes("don't cut")) {
      for (const f of [-0.15, 0, 0.18]) {
        const i = Math.min(n - 1, Math.max(0, Math.round(mid + f * (nn.end - nn.s))));
        // left of travel is −right; right vector is (−tz, tx)
        const off = -(opts.width / 2 + 0.7 + r() * 0.6) * inside;
        rocks.push({ x: x[i] + -tz[i] * off, z: z[i] + tx[i] * off, r: 0.55 + r() * 0.3 });
      }
    }
    if (nn.grade <= 3) chevrons.push({ s: mid * STEP, dir: nn.dir as 1 | -1 });
    if (nn.grade <= 4 && r() < 0.45) crowds.push({ s: mid * STEP, side: (-nn.dir) as 1 | -1 });
  }

  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < n; i++) {
    minX = Math.min(minX, x[i]); maxX = Math.max(maxX, x[i]);
    minZ = Math.min(minZ, z[i]); maxZ = Math.max(maxZ, z[i]);
  }

  const length = (n - 1) * STEP;
  const finishS = length - 90;
  return {
    n, length, width: opts.width, x, y, z, tx, tz, curv, notes, rocks, chevrons, crowds,
    startS: 40, finishS, splits: [finishS * 0.36, finishS * 0.69], minY, maxY,
    bounds: { minX, maxX, minZ, maxZ },
  };
}

// Ideal-ish lap from a simple speed profile: corner speed from grip, then
// forward/backward passes for acceleration and braking. Rival times scale it.
export function parTimes(t: Track, grip: number, top: number): { v: Float32Array; cum: Float32Array } {
  const v = new Float32Array(t.n);
  for (let i = 0; i < t.n; i++) {
    const k = Math.abs(t.curv[i]);
    v[i] = Math.min(top, k > 1e-4 ? Math.sqrt((grip * 9.81 * 1.05) / k) : top);
  }
  v[0] = 0.1;
  for (let i = 1; i < t.n; i++) v[i] = Math.min(v[i], Math.sqrt(v[i - 1] ** 2 + 2 * 6.5 * (1 - v[i - 1] / top) * STEP));
  for (let i = t.n - 2; i >= 0; i--) v[i] = Math.min(v[i], Math.sqrt(v[i + 1] ** 2 + 2 * 9 * grip * STEP));
  // Cumulative time from the start line
  const cum = new Float32Array(t.n);
  const start = Math.round(t.startS / STEP);
  for (let i = start + 1; i < t.n; i++) cum[i] = cum[i - 1] + STEP / Math.max(1, (v[i] + v[i - 1]) / 2);
  return { v, cum };
}
