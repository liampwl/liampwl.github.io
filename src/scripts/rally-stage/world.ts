// Scenery for a generated stage: terrain, road, trees, set dressing, sky and
// weather. Everything is drawn into tiny canvases and filtered nearest, so it
// reads like a PS2 rally game at 640x480.
import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DodecahedronGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Fog,
  Group,
  HemisphereLight,
  DirectionalLight,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  NearestFilter,
  NormalBlending,
  Object3D,
  PlaneGeometry,
  Points,
  RepeatWrapping,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  BoxGeometry,
  type Texture,
} from 'three';
import { rng, STEP, type Track } from './track';

type TreeKind = 'pine' | 'hardwood' | 'autumn' | 'blossom' | 'palm' | 'bamboo' | 'willow';
type GroundKind = 'grass' | 'needles' | 'paddy' | 'lawn' | 'leaves';

interface Theme {
  sky: [string, string];
  fog: string;
  hemi: [string, string];
  ground: GroundKind;
  tint: string;
  relief: number;
  trees: [TreeKind, number][];
  density: number;
  ridge: { color: string; height: number; landmark?: 'obelisk' | 'pagoda' };
  water?: 'paddies' | 'canal';
  verge: string;
  centerLine: 'yellow' | 'white' | null;
}

export const THEMES: Record<string, Theme> = {
  pines: {
    sky: ['#97abb8', '#d6dcd9'], fog: '#c6cfcd', hemi: ['#dfe6e6', '#5b5440'],
    ground: 'needles', tint: '#86915c', relief: 4,
    trees: [['pine', 0.75], ['hardwood', 0.25]], density: 1.05,
    ridge: { color: '#8a9ca2', height: 20 }, verge: '#8e6a4b', centerLine: null,
  },
  paddies: {
    sky: ['#8c9ca4', '#c2cacb'], fog: '#b3bebf', hemi: ['#d2dadb', '#4d5a3c'],
    ground: 'paddy', tint: '#86a95c', relief: 0,
    trees: [['palm', 0.35], ['bamboo', 0.45], ['hardwood', 0.2]], density: 0.32,
    ridge: { color: '#97a6a9', height: 12 }, water: 'paddies', verge: '#7b8d55', centerLine: 'white',
  },
  hardwoods: {
    sky: ['#5c93c6', '#cfe1ec'], fog: '#cfdde6', hemi: ['#e6f0f5', '#4f6236'],
    ground: 'grass', tint: '#729b48', relief: 3,
    trees: [['hardwood', 0.7], ['pine', 0.3]], density: 1.1,
    ridge: { color: '#8fa8b8', height: 15 }, verge: '#8a8a6a', centerLine: 'yellow',
  },
  blossoms: {
    sky: ['#689fcf', '#dae7ef'], fog: '#d8e4ea', hemi: ['#eef3f6', '#56693d'],
    ground: 'lawn', tint: '#7aa44f', relief: 1.5,
    trees: [['blossom', 0.55], ['hardwood', 0.45]], density: 0.8,
    ridge: { color: '#a1b3bf', height: 8, landmark: 'obelisk' }, verge: '#9a9784', centerLine: 'yellow',
  },
  autumn: {
    sky: ['#76a2c9', '#e1e5df'], fog: '#d0d9de', hemi: ['#eef0ea', '#6a5634'],
    ground: 'leaves', tint: '#93814a', relief: 12,
    trees: [['autumn', 0.72], ['pine', 0.28]], density: 1.25,
    ridge: { color: '#6c8cad', height: 48 }, verge: '#7d6a4c', centerLine: null,
  },
  canals: {
    sky: ['#a0adb2', '#d1d6d4'], fog: '#c1c8c7', hemi: ['#dde3e3', '#4d5c42'],
    ground: 'grass', tint: '#6f915a', relief: 0.5,
    trees: [['willow', 0.6], ['hardwood', 0.4]], density: 0.7,
    ridge: { color: '#a7b1b4', height: 9, landmark: 'pagoda' }, water: 'canal', verge: '#8c8f7c', centerLine: 'white',
  },
};

export const WEATHER: Record<string, { light: number; near: number; far: number; rain?: number }> = {
  Bright: { light: 1.15, near: 90, far: 330 },
  Dry: { light: 1.0, near: 80, far: 300 },
  Cloudy: { light: 0.62, near: 60, far: 240 },
  Drizzle: { light: 0.55, near: 45, far: 205, rain: 260 },
  Rain: { light: 0.45, near: 32, far: 170, rain: 720 },
  Storm: { light: 0.35, near: 28, far: 150, rain: 900 },
};

/* ---------- tiny canvas textures ---------- */

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!] as const;
}

function tex(c: HTMLCanvasElement, repeat = true): Texture {
  const t = new CanvasTexture(c);
  t.magFilter = NearestFilter;
  t.minFilter = NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = RepeatWrapping;
  return t;
}

function shade(hex: string, k: number) {
  const c = new Color(hex);
  c.r = Math.min(1, c.r * k);
  c.g = Math.min(1, c.g * k);
  c.b = Math.min(1, c.b * k);
  return `#${c.getHexString()}`;
}

function speckle(g: CanvasRenderingContext2D, w: number, h: number, base: string, r: () => number, spread: number, n: number) {
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < n; i++) {
    g.fillStyle = shade(base, 1 + (r() - 0.5) * spread);
    g.fillRect(Math.floor(r() * w), Math.floor(r() * h), 1, 1);
  }
}

function roadTexture(surface: string, wet: boolean, line: Theme['centerLine'], r: () => number) {
  const [c, g] = canvas(64, 64);
  if (surface === 'tarmac') {
    speckle(g, 64, 64, wet ? '#3d4245' : '#56595b', r, 0.35, 1400);
    if (wet) {
      for (let i = 0; i < 120; i++) {
        g.fillStyle = 'rgba(190,205,212,0.18)';
        g.fillRect(Math.floor(r() * 64), Math.floor(r() * 64), 1, 2);
      }
    }
    g.fillStyle = wet ? '#c9cfcf' : '#e2e2da';
    g.fillRect(2, 0, 1, 64);
    g.fillRect(61, 0, 1, 64);
    if (line === 'yellow') {
      g.fillStyle = '#d6b23c';
      g.fillRect(30, 0, 1, 64);
      g.fillRect(33, 0, 1, 64);
    } else if (line === 'white') {
      g.fillStyle = '#dcdcd4';
      g.fillRect(31, 0, 2, 30);
    }
  } else {
    const base = surface === 'clay' ? '#a65e3f' : '#8f7f66';
    speckle(g, 64, 64, base, r, 0.5, 2200);
    // Two smoother wheel tracks
    for (const x0 of [14, 42]) {
      g.fillStyle = shade(base, 0.86);
      g.fillRect(x0, 0, 8, 64);
      for (let i = 0; i < 90; i++) {
        g.fillStyle = shade(base, 0.78 + r() * 0.12);
        g.fillRect(x0 + Math.floor(r() * 8), Math.floor(r() * 64), 1, 1);
      }
    }
    // Loose stones on the crown and edges
    for (let i = 0; i < 160; i++) {
      g.fillStyle = shade(base, 1.15 + r() * 0.3);
      const x = r() < 0.5 ? Math.floor(r() * 12) + (r() < 0.5 ? 0 : 52) : 26 + Math.floor(r() * 12);
      g.fillRect(x, Math.floor(r() * 64), 1, 1);
    }
  }
  return tex(c);
}

function groundTexture(kind: GroundKind, r: () => number) {
  const [c, g] = canvas(32, 32);
  const base = { grass: '#8aa060', needles: '#8b8458', paddy: '#8fae5c', lawn: '#8bab5c', leaves: '#a2804a' }[kind];
  speckle(g, 32, 32, base, r, 0.45, 520);
  if (kind === 'needles' || kind === 'leaves') {
    const pal = kind === 'leaves' ? ['#c4652f', '#d9a03a', '#8f3d23', '#6f7a3f'] : ['#6b5a37', '#5e6a3a', '#9c8a5a'];
    for (let i = 0; i < 90; i++) {
      g.fillStyle = pal[Math.floor(r() * pal.length)];
      g.fillRect(Math.floor(r() * 32), Math.floor(r() * 32), 1 + Math.floor(r() * 2), 1);
    }
  }
  if (kind === 'paddy') {
    for (let y = 1; y < 32; y += 4) {
      g.fillStyle = '#6d9446';
      g.fillRect(0, y, 32, 1);
    }
  }
  if (kind === 'lawn') {
    g.fillStyle = 'rgba(255,255,255,0.06)';
    g.fillRect(0, 0, 16, 32);
  }
  return tex(c);
}

function vergeTexture(color: string, r: () => number) {
  const [c, g] = canvas(16, 32);
  speckle(g, 16, 32, color, r, 0.5, 300);
  return tex(c);
}

/* ---------- tree sprites ---------- */

function blob(g: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, pal: string[], r: () => number, n: number) {
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r());
    const x = cx + Math.cos(a) * rx * d, y = cy + Math.sin(a) * ry * d;
    const s = 2 + Math.floor(r() * 3);
    g.fillStyle = pal[Math.min(pal.length - 1, Math.floor((y - (cy - ry)) / (2 * ry) * pal.length + (r() - 0.5) * 1.5))] ?? pal[0];
    g.fillRect(Math.round(x - s / 2), Math.round(y - s / 2), s, s);
  }
}

function trunk(g: CanvasRenderingContext2D, x: number, y0: number, y1: number, w: number, color: string) {
  g.fillStyle = color;
  g.fillRect(Math.round(x - w / 2), y0, w, y1 - y0);
  g.fillStyle = shade(color, 0.7);
  g.fillRect(Math.round(x + w / 2) - 1, y0, 1, y1 - y0);
}

function treeSprite(kind: TreeKind, r: () => number) {
  const [c, g] = canvas(32, 64);
  switch (kind) {
    case 'pine': {
      trunk(g, 16, 40, 64, 3, '#5a4330');
      const pal = ['#2f4a2c', '#29412a', '#223823', '#1c2f1e'];
      for (let layer = 0; layer < 6; layer++) {
        const y = 4 + layer * 7, half = 3 + layer * 2.2;
        for (let yy = 0; yy < 9; yy++) {
          const w = Math.round((half * (yy + 2)) / 10) * 2;
          g.fillStyle = pal[Math.min(3, Math.floor((yy / 9) * 4))];
          g.fillRect(16 - w / 2 + Math.round((r() - 0.5) * 2), y + yy, w, 1);
        }
      }
      break;
    }
    case 'hardwood':
    case 'autumn':
    case 'blossom': {
      trunk(g, 16, 34, 64, 3, '#5b4634');
      const pal =
        kind === 'autumn'
          ? [['#e29a3a', '#c9622b', '#9b3a22'], ['#e9c24a', '#c98e2c', '#8f5b25'], ['#cf4b2a', '#a8331f', '#6f2418']][Math.floor(r() * 3)]
          : kind === 'blossom'
            ? ['#f6dbe4', '#eab6c8', '#c98aa1']
            : ['#6f9a45', '#4f7a34', '#355728'];
      blob(g, 16, 22, 13, 17, pal, r, 260);
      blob(g, 9, 30, 6, 7, pal, r, 50);
      blob(g, 23, 28, 6, 7, pal, r, 50);
      break;
    }
    case 'palm': {
      g.strokeStyle = '#6e5a41';
      g.lineWidth = 2;
      g.beginPath();
      const lean = (r() - 0.5) * 8;
      g.moveTo(16, 64);
      g.quadraticCurveTo(16 + lean, 34, 16 + lean * 0.6, 14);
      g.stroke();
      g.fillStyle = '#3f6b33';
      for (let i = 0; i < 9; i++) {
        const a = -Math.PI / 2 + (i / 8 - 0.5) * Math.PI * 1.7;
        for (let t = 0; t < 14; t++) {
          const x = 16 + lean * 0.6 + Math.cos(a) * t, y = 14 + Math.sin(a) * t * 0.6 + (t * t) / 22;
          g.fillRect(Math.round(x), Math.round(y), 2, 1);
        }
      }
      break;
    }
    case 'bamboo': {
      for (let i = 0; i < 9; i++) {
        const x = 5 + r() * 22, top = 2 + r() * 14;
        g.fillStyle = r() < 0.5 ? '#7a9a45' : '#5f823a';
        g.fillRect(Math.round(x), Math.round(top), 1, 64 - Math.round(top));
        for (let k = 0; k < 6; k++) {
          g.fillStyle = '#4f7a34';
          g.fillRect(Math.round(x) + (r() < 0.5 ? -3 : 1), Math.round(top + r() * 30), 3, 1);
        }
      }
      break;
    }
    case 'willow': {
      trunk(g, 16, 30, 64, 3, '#58493a');
      blob(g, 16, 16, 12, 10, ['#9db55b', '#7f9a46', '#62803a'], r, 160);
      g.fillStyle = '#86a24d';
      for (let i = 0; i < 40; i++) {
        const x = 5 + Math.floor(r() * 22), y0 = 14 + Math.floor(r() * 8);
        g.fillRect(x, y0, 1, 10 + Math.floor(r() * 26));
      }
      break;
    }
  }
  const t = tex(c, false);
  return t;
}

function crossedQuad() {
  // Two crossed 1x2 quads standing on y=0, normals pointing up so every
  // tree is lit the same regardless of which way it faces
  const a = new PlaneGeometry(1, 2);
  a.translate(0, 1, 0);
  const b = a.clone();
  b.rotateY(Math.PI / 2);
  const pos = new Float32Array([...a.attributes.position.array, ...b.attributes.position.array]);
  const uv = new Float32Array([...a.attributes.uv.array, ...b.attributes.uv.array]);
  const idxA = Array.from(a.index!.array);
  const idx = [...idxA, ...idxA.map((i) => i + 4)];
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('uv', new BufferAttribute(uv, 2));
  const normals = new Float32Array(pos.length);
  for (let i = 1; i < normals.length; i += 3) normals[i] = 1;
  g.setAttribute('normal', new BufferAttribute(normals, 3));
  g.setIndex(idx);
  return g;
}

/* ---------- value noise ---------- */

function noise2(seed: number) {
  const perm = new Uint8Array(512);
  const r = rng(seed);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const val = (x: number, y: number) => perm[(x & 255) + perm[y & 255]] / 255;
  return (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = val(xi, yi), b = val(xi + 1, yi), c = val(xi, yi + 1), d = val(xi + 1, yi + 1);
    return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v; // 0..1
  };
}

/* ---------- nearest-centerline lookups ---------- */

export class Corridor {
  private grid = new Map<number, number[]>();
  private readonly cell = 24;
  constructor(private t: Track) {
    for (let i = 0; i < t.n; i += 2) {
      const k = this.key(Math.floor(t.x[i] / this.cell), Math.floor(t.z[i] / this.cell));
      (this.grid.get(k) ?? this.grid.set(k, []).get(k)!).push(i);
    }
  }
  private key(cx: number, cz: number) {
    return (cx + 4096) * 8192 + (cz + 4096);
  }
  // Nearest sample within `rings` grid cells, or −1
  nearest(x: number, z: number, rings = 2): { i: number; d: number; side: number } {
    const cx = Math.floor(x / this.cell), cz = Math.floor(z / this.cell);
    let best = -1, bd = Infinity;
    for (let dx = -rings; dx <= rings; dx++) {
      for (let dz = -rings; dz <= rings; dz++) {
        const list = this.grid.get(this.key(cx + dx, cz + dz));
        if (!list) continue;
        for (const i of list) {
          const ex = x - this.t.x[i], ez = z - this.t.z[i];
          const d = ex * ex + ez * ez;
          if (d < bd) {
            bd = d;
            best = i;
          }
        }
      }
    }
    if (best < 0) return { i: -1, d: Infinity, side: 0 };
    // + is left of travel; right vector is (−tz, tx)
    const side = -((x - this.t.x[best]) * -this.t.tz[best] + (z - this.t.z[best]) * this.t.tx[best]);
    return { i: best, d: Math.sqrt(bd), side };
  }
}

/* ---------- the world ---------- */

export interface WorldSpec {
  scenery: string;
  surface: string;
  weather: string;
  banner: [string, string];
  bannerColor: string;
  seed: number;
}

export interface World {
  scene: Scene;
  corridor: Corridor;
  waterLevel: number | null;
  sky: Mesh;
  ridge: Mesh;
  rain: LineSegments | null;
  rainSpeed: number;
  crowd: { sprite: Sprite; base: number; phase: number }[];
  particles: Particles;
  dispose(): void;
}

function bannerCanvas(words: [string, string], color: string, finish: boolean) {
  const [c, g] = canvas(128, 16);
  if (finish) {
    for (let x = 0; x < 128; x += 4) for (let y = 0; y < 16; y += 4) {
      g.fillStyle = ((x + y) / 4) % 2 ? '#111' : '#f4f4f0';
      g.fillRect(x, y, 4, 4);
    }
    g.fillStyle = '#c8202a';
    g.fillRect(36, 2, 56, 12);
    g.fillStyle = '#fff';
    g.font = 'bold italic 10px Arial, sans-serif';
    g.textAlign = 'center';
    g.fillText('FINISH', 64, 12);
  } else {
    g.fillStyle = color;
    g.fillRect(0, 0, 128, 16);
    g.fillStyle = '#fff';
    g.font = 'italic 10px Arial, sans-serif';
    g.fillText(words[0], 30, 12);
    const w = g.measureText(words[0]).width;
    g.font = 'bold italic 11px Arial, sans-serif';
    g.fillText(words[1], 30 + w, 12);
    g.fillStyle = '#f3efa0';
    g.fillRect(30, 13, 30, 1);
  }
  return tex(c, false);
}

function chevronTexture(dir: 1 | -1) {
  const [c, g] = canvas(32, 16);
  g.fillStyle = '#c42a24';
  g.fillRect(0, 0, 32, 16);
  g.fillStyle = '#f5f2ea';
  for (let k = 0; k < 3; k++) {
    const x0 = 5 + k * 9;
    for (let y = 0; y < 12; y++) {
      const off = Math.abs(y - 5.5) * 0.7;
      const x = dir === 1 ? x0 + off : x0 + 6 - off;
      g.fillRect(Math.round(x), 2 + y, 3, 1);
    }
  }
  return tex(c, false);
}

function ridgeTexture(theme: Theme, seed: number) {
  const [c, g] = canvas(512, 64);
  const r = rng(seed);
  const fog = new Color(theme.fog);
  const layers = theme.ridge.height > 30 ? 3 : 2;
  for (let l = 0; l < layers; l++) {
    const col = new Color(theme.ridge.color).lerp(fog, 0.55 - l * 0.22);
    g.fillStyle = `#${col.getHexString()}`;
    const p1 = r() * 6.28, p2 = r() * 6.28, amp = 10 + l * 6;
    for (let x = 0; x < 512; x++) {
      const a = (x / 512) * Math.PI * 2;
      const h = 26 + l * 10 - amp * (0.6 + 0.4 * Math.sin(a * 3 + p1)) * (0.6 + 0.4 * Math.sin(a * 7 + p2)) - r() * 1.2;
      g.fillRect(x, Math.round(h), 1, 64);
    }
  }
  if (theme.ridge.landmark === 'obelisk') {
    g.fillStyle = '#e8e8e2';
    g.fillRect(300, 14, 3, 40);
    g.fillRect(301, 12, 1, 2);
  }
  if (theme.ridge.landmark === 'pagoda') {
    g.fillStyle = shade(theme.ridge.color, 0.8);
    for (let k = 0; k < 6; k++) g.fillRect(180 - (6 - k), 20 + k * 5, (6 - k) * 2 + 3, 3);
    g.fillRect(181, 16, 1, 4);
  }
  const t = tex(c);
  t.wrapT = RepeatWrapping;
  return t;
}

function personTexture(r: () => number) {
  const [c, g] = canvas(8, 16);
  const shirt = ['#c0392b', '#2c6fbb', '#e5c33c', '#2e8b57', '#f2f2f2', '#7a4fa0', '#e67e22'][Math.floor(r() * 7)];
  g.fillStyle = ['#f1c9a5', '#c99a6e', '#8d5a3b'][Math.floor(r() * 3)];
  g.fillRect(3, 1, 2, 3);
  g.fillStyle = shirt;
  g.fillRect(2, 4, 4, 6);
  g.fillRect(1, 5, 1, 3);
  g.fillRect(6, 5, 1, 3);
  g.fillStyle = ['#2a2f3a', '#45413a', '#1f3c62'][Math.floor(r() * 3)];
  g.fillRect(2, 10, 2, 6);
  g.fillRect(4, 10, 2, 6);
  return tex(c, false);
}

/* ---------- dust and spray ---------- */

export class Particles {
  readonly points: Points;
  private pos: Float32Array;
  private vel: Float32Array;
  private life: Float32Array;
  private alpha: Float32Array;
  private size: Float32Array;
  private next = 0;
  constructor(private max = 160) {
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.size = new Float32Array(max);
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(this.pos, 3));
    geo.setAttribute('alpha', new BufferAttribute(this.alpha, 1));
    geo.setAttribute('size', new BufferAttribute(this.size, 1));
    const mat = new ShaderMaterial({
      uniforms: { color: { value: new Color('#b49a77') } },
      vertexShader: `
        attribute float alpha; attribute float size; varying float vA;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          // Fade out before the chase camera drives through the cloud
          vA = alpha * smoothstep(2.5, 7.0, -mv.z);
          gl_PointSize = min(56.0, size * (300.0 / -mv.z));
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform vec3 color; varying float vA;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          if (d > 0.5) discard;
          gl_FragColor = vec4(color, vA * (1.0 - d * 1.6));
        }`,
      transparent: true,
      depthWrite: false,
      blending: NormalBlending,
    });
    this.points = new Points(geo, mat);
    this.points.frustumCulled = false;
  }
  setColor(hex: string, additive = false) {
    const m = this.points.material as ShaderMaterial;
    m.uniforms.color.value.set(hex);
    m.blending = additive ? AdditiveBlending : NormalBlending;
  }
  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, size: number) {
    const i = this.next;
    this.next = (this.next + 1) % this.max;
    this.pos.set([x, y, z], i * 3);
    this.vel.set([vx, vy, vz], i * 3);
    this.life[i] = 1;
    this.size[i] = size;
  }
  update(dt: number) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) {
        this.alpha[i] = 0;
        continue;
      }
      this.life[i] -= dt * 0.9;
      for (let k = 0; k < 3; k++) this.pos[i * 3 + k] += this.vel[i * 3 + k] * dt;
      this.vel[i * 3 + 1] -= dt * 0.6;
      this.vel[i * 3] *= 1 - dt * 1.5;
      this.vel[i * 3 + 2] *= 1 - dt * 1.5;
      this.size[i] += dt * 1.3;
      this.alpha[i] = Math.max(0, this.life[i]) * 0.32;
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.alpha.needsUpdate = true;
    g.attributes.size.needsUpdate = true;
  }
}

/* ---------- build ---------- */

export function buildWorld(t: Track, spec: WorldSpec): World {
  const theme = THEMES[spec.scenery] ?? THEMES.pines;
  const wx = WEATHER[spec.weather] ?? WEATHER.Dry;
  const r = rng(spec.seed * 31 + 7);
  const noise = noise2(spec.seed);
  const corridor = new Corridor(t);
  const W = t.width;
  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T) => (disposables.push(x), x);

  const scene = new Scene();
  scene.background = new Color(theme.fog);
  scene.fog = new Fog(theme.fog, wx.near, wx.far);

  const hemi = new HemisphereLight(theme.hemi[0], theme.hemi[1], 0.75 + wx.light * 0.25);
  scene.add(hemi);
  const sun = new DirectionalLight(0xfff3e0, 0.35 + wx.light * 0.75);
  sun.position.set(80, 140, 40);
  scene.add(sun);

  // Sky dome and distant ridges both ignore fog and ride with the camera
  const skyGeo = keep(new SphereGeometry(460, 24, 12));
  const top = new Color(theme.sky[0]), hor = new Color(theme.sky[1]);
  const cols: number[] = [];
  const sp = skyGeo.attributes.position;
  for (let i = 0; i < sp.count; i++) {
    const k = Math.max(0, Math.min(1, sp.getY(i) / 460));
    const c = hor.clone().lerp(top, Math.pow(k, 0.6));
    cols.push(c.r, c.g, c.b);
  }
  skyGeo.setAttribute('color', new Float32BufferAttribute(cols, 3));
  const sky = new Mesh(skyGeo, keep(new MeshBasicMaterial({ vertexColors: true, side: BackSide, fog: false, depthWrite: false })));
  sky.renderOrder = -2;
  scene.add(sky);

  const ridgeTex = keep(ridgeTexture(theme, spec.seed));
  ridgeTex.repeat.set(2, 1);
  const ridgeGeo = keep(new CylinderGeometry(420, 420, 70, 48, 1, true));
  const ridge = new Mesh(ridgeGeo, keep(new MeshBasicMaterial({ map: ridgeTex, transparent: true, side: BackSide, fog: false, depthWrite: false })));
  ridge.renderOrder = -1;
  scene.add(ridge);

  // Terrain heightfield
  const water = theme.water ?? null;
  const waterLevel = water ? t.minY - (water === 'paddies' ? 0.55 : 1.0) : null;
  const M = 130;
  const minX = t.bounds.minX - M, maxX = t.bounds.maxX + M, minZ = t.bounds.minZ - M, maxZ = t.bounds.maxZ + M;
  const CELL = 5;
  const nx = Math.ceil((maxX - minX) / CELL), nz = Math.ceil((maxZ - minZ) / CELL);
  const terrainGeo = keep(new PlaneGeometry(nx * CELL, nz * CELL, nx, nz));
  terrainGeo.rotateX(-Math.PI / 2);
  terrainGeo.translate(minX + (nx * CELL) / 2, 0, minZ + (nz * CELL) / 2);
  const tp = terrainGeo.attributes.position;
  const tint = new Color(theme.tint);
  const tcol = new Float32Array(tp.count * 3);
  const tuv = terrainGeo.attributes.uv;
  const flat = W / 2 + 8;
  let farY = (t.minY + t.maxY) / 2;
  const heightAt = (x: number, z: number) => {
    let near = corridor.nearest(x, z, 3);
    if (near.i < 0) near = corridor.nearest(x, z, 7);
    const ry = near.i >= 0 ? t.y[near.i] : farY;
    const d = near.i >= 0 ? near.d : 200;
    if (d < flat) return { h: ry - (d < W / 2 + 0.3 ? 0.12 : 0.04), d };
    const k = Math.min(1, (d - flat) / 35);
    const ease = k * k * (3 - 2 * k);
    let h = ry + ease * (theme.relief * (noise(x / 55, z / 55) * 2 - 0.7) + theme.relief * 0.4 * (noise(x / 17 + 9, z / 17) - 0.5));
    if (water === 'paddies' && waterLevel !== null && d > W / 2 + 3) {
      const kk = Math.min(1, (d - (W / 2 + 3)) / 4);
      const dike = Math.abs(Math.sin((x * 0.8 + z * 0.6) / 7)) < 0.09 || Math.abs(Math.sin((x * -0.6 + z * 0.8) / 9)) < 0.07;
      const field = waterLevel - 0.12 + noise(x / 30, z / 30) * 0.4 + (dike ? 0.45 : 0);
      h = ry - 0.1 + (field - (ry - 0.1)) * kk;
    }
    if (water === 'canal' && waterLevel !== null && near.side > 12 && near.side < 26) {
      const m = Math.min(near.side - 12, 26 - near.side);
      h = Math.min(h, ry - Math.min(1, m / 2.5) * (ry - (waterLevel - 1.4)));
    }
    return { h, d };
  };
  for (let i = 0; i < tp.count; i++) {
    const x = tp.getX(i), z = tp.getZ(i);
    const { h, d } = heightAt(x, z);
    tp.setY(i, h);
    const v = 0.82 + noise(x / 9 + 50, z / 9) * 0.32 - (d < flat ? 0.06 : 0);
    tcol[i * 3] = tint.r * v;
    tcol[i * 3 + 1] = tint.g * v;
    tcol[i * 3 + 2] = tint.b * v;
    tuv.setXY(i, x / 4, z / 4);
  }
  terrainGeo.setAttribute('color', new BufferAttribute(tcol, 3));
  terrainGeo.computeVertexNormals();
  const groundTex = keep(groundTexture(theme.ground, r));
  const terrain = new Mesh(terrainGeo, keep(new MeshLambertMaterial({ map: groundTex, vertexColors: true })));
  scene.add(terrain);

  if (waterLevel !== null) {
    const wgeo = keep(new PlaneGeometry(nx * CELL, nz * CELL));
    wgeo.rotateX(-Math.PI / 2);
    const wmat = keep(new MeshLambertMaterial({ color: water === 'paddies' ? '#7f9aa3' : '#6a8590', transparent: true, opacity: 0.88 }));
    const wm = new Mesh(wgeo, wmat);
    wm.position.set(minX + (nx * CELL) / 2, waterLevel, minZ + (nz * CELL) / 2);
    scene.add(wm);
  }

  // Road and verges as ribbons over the centerline
  const ribbon = (inner: number, outer: number, lift: number, vScale: number) => {
    const n = t.n;
    const pos = new Float32Array(n * 2 * 3);
    const uv = new Float32Array(n * 2 * 2);
    const idx: number[] = [];
    for (let i = 0; i < n; i++) {
      const rx = -t.tz[i], rz = t.tx[i];
      const y = t.y[i] + lift;
      pos.set([t.x[i] + rx * inner, y, t.z[i] + rz * inner, t.x[i] + rx * outer, y, t.z[i] + rz * outer], i * 6);
      const v = (i * STEP) / vScale;
      uv.set([0, v, 1, v], i * 4);
      if (i < n - 1) {
        const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
        idx.push(a, c, b, b, c, d);
      }
    }
    const g = keep(new BufferGeometry());
    g.setAttribute('position', new BufferAttribute(pos, 3));
    g.setAttribute('uv', new BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  };
  const wet = spec.weather === 'Rain' || spec.weather === 'Drizzle' || spec.weather === 'Storm';
  const roadMat = keep(new MeshLambertMaterial({ map: keep(roadTexture(spec.surface, wet, theme.centerLine, r)), side: DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  scene.add(new Mesh(ribbon(-W / 2, W / 2, 0.02, 6), roadMat));
  const vergeMat = keep(new MeshLambertMaterial({ map: keep(vergeTexture(spec.surface === 'tarmac' ? theme.verge : shade(theme.verge, 0.9), r)), side: DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
  scene.add(new Mesh(ribbon(W / 2, W / 2 + 1.8, 0.0, 4), vergeMat));
  scene.add(new Mesh(ribbon(-W / 2 - 1.8, -W / 2, 0.0, 4), vergeMat));

  // Trees: a couple of sprite variants per species, instanced
  const quad = keep(crossedQuad());
  const kinds = theme.trees;
  const variants: { kind: TreeKind; mat: MeshLambertMaterial; mats: Matrix4[] }[] = [];
  for (const [kind] of kinds) {
    for (let v = 0; v < 2; v++) {
      variants.push({ kind, mat: keep(new MeshLambertMaterial({ map: keep(treeSprite(kind, r)), alphaTest: 0.5, side: DoubleSide })), mats: [] });
    }
  }
  const pickVariant = () => {
    let x = r();
    for (const [kind, w] of kinds) {
      x -= w;
      if (x <= 0) return variants.filter((v) => v.kind === kind)[Math.floor(r() * 2)];
    }
    return variants[0];
  };
  const dummy = new Object3D();
  const place = (x: number, z: number, scale: number) => {
    const near = corridor.nearest(x, z, 3);
    if (near.i >= 0 && near.d < W / 2 + 9) return;
    const { h } = heightAt(x, z);
    if (waterLevel !== null && h < waterLevel + 0.15) return;
    const v = pickVariant();
    const tall = (v.kind === 'bamboo' ? 6 : v.kind === 'palm' ? 8 : 6.5) * scale;
    dummy.position.set(x, h - 0.2, z);
    dummy.rotation.set(0, r() * Math.PI, 0);
    dummy.scale.set(tall / 2, tall / 2, tall / 2);
    dummy.updateMatrix();
    v.mats.push(dummy.matrix.clone());
  };
  // A dense band along the road, thinning out with distance
  for (let i = 0; i < t.n; i += 2) {
    for (const side of [-1, 1]) {
      if (r() > theme.density * 0.75) continue;
      const off = W / 2 + 9.5 + (r() < 0.6 ? r() * 12 : 12 + Math.pow(r(), 1.4) * 50);
      const along = (r() - 0.5) * 3;
      const rx = -t.tz[i], rz = t.tx[i];
      place(t.x[i] + rx * off * side + t.tx[i] * along, t.z[i] + rz * off * side + t.tz[i] * along, 0.75 + r() * 0.7);
    }
  }
  // A thin scatter further out so the fog has something to swallow
  for (let k = 0; k < 500 * theme.density; k++) place(minX + r() * (maxX - minX), minZ + r() * (maxZ - minZ), 0.8 + r() * 0.6);
  for (const v of variants) {
    if (!v.mats.length) continue;
    const im = new InstancedMesh(quad, v.mat, v.mats.length);
    v.mats.forEach((m, i) => im.setMatrixAt(i, m));
    im.instanceMatrix.needsUpdate = true;
    scene.add(im);
  }

  // Start and finish arches
  const postGeo = keep(new BoxGeometry(0.3, 5, 0.3));
  postGeo.translate(0, 2.5, 0);
  const postMat = keep(new MeshLambertMaterial({ color: '#d9dcd8' }));
  const arch = (s: number, finish: boolean) => {
    const i = Math.min(t.n - 1, Math.round(s / STEP));
    const g = new Group();
    g.position.set(t.x[i], t.y[i], t.z[i]);
    g.rotation.y = Math.atan2(t.tx[i], t.tz[i]);
    for (const side of [-1, 1]) {
      const p = new Mesh(postGeo, postMat);
      p.position.x = side * (W / 2 + 0.9);
      g.add(p);
    }
    const banner = new Mesh(keep(new PlaneGeometry(W + 2.2, 1.1)), keep(new MeshLambertMaterial({ map: keep(bannerCanvas(spec.banner, spec.bannerColor, finish)), side: DoubleSide })));
    banner.position.y = 4.5;
    // Face the approaching car
    banner.rotation.y = Math.PI;
    g.add(banner);
    scene.add(g);
  };
  arch(t.startS, false);
  arch(t.finishS, true);

  // Chevron boards on the outside of tight corners
  const boardGeo = keep(new PlaneGeometry(1.6, 0.8));
  const stickGeo = keep(new BoxGeometry(0.08, 1.0, 0.08));
  stickGeo.translate(0, 0.5, 0);
  const chevMats = { 1: keep(new MeshLambertMaterial({ map: keep(chevronTexture(1)), side: DoubleSide })), [-1]: keep(new MeshLambertMaterial({ map: keep(chevronTexture(-1)), side: DoubleSide })) } as Record<number, MeshLambertMaterial>;
  for (const c of t.chevrons) {
    for (const ds of [-9, 0, 9]) {
      const i = Math.max(0, Math.min(t.n - 1, Math.round((c.s + ds) / STEP)));
      const out = -c.dir; // + is left
      const off = W / 2 + 2.4;
      const rx = -t.tz[i], rz = t.tx[i];
      const x = t.x[i] - rx * off * out, z = t.z[i] - rz * off * out;
      const g = new Group();
      g.position.set(x, t.y[i], z);
      g.rotation.y = Math.atan2(t.tx[i], t.tz[i]) + Math.PI;
      const b = new Mesh(boardGeo, chevMats[c.dir]);
      b.position.y = 1.25;
      g.add(b, new Mesh(stickGeo, postMat));
      scene.add(g);
    }
  }

  // Rocks on the inside of "don't cut" corners
  const rockMat = keep(new MeshLambertMaterial({ color: '#7d7a73', flatShading: true }));
  for (const k of t.rocks) {
    const m = new Mesh(keep(new DodecahedronGeometry(k.r, 0)), rockMat);
    const near = corridor.nearest(k.x, k.z, 1);
    m.position.set(k.x, (near.i >= 0 ? t.y[near.i] : 0) + k.r * 0.35, k.z);
    m.rotation.set(r() * 3, r() * 3, r() * 3);
    m.scale.y = 0.75;
    scene.add(m);
  }

  // Spectators at a few corners, standing well back
  const crowd: World['crowd'] = [];
  const people = Array.from({ length: 6 }, () => keep(new SpriteMaterial({ map: keep(personTexture(r)) })));
  for (const c of t.crowds) {
    const count = 6 + Math.floor(r() * 9);
    for (let k = 0; k < count; k++) {
      const i = Math.max(0, Math.min(t.n - 1, Math.round((c.s + (r() - 0.5) * 22) / STEP)));
      const off = W / 2 + 10 + r() * 4;
      const rx = -t.tz[i], rz = t.tx[i];
      const x = t.x[i] - rx * off * c.side, z = t.z[i] - rz * off * c.side;
      const { h } = heightAt(x, z);
      const s = new Sprite(people[Math.floor(r() * people.length)]);
      s.scale.set(0.6, 1.75, 1);
      s.position.set(x, h + 0.86, z);
      scene.add(s);
      crowd.push({ sprite: s, base: h + 0.86, phase: r() * 6.28 });
    }
  }

  // Rain
  let rain: LineSegments | null = null;
  const drops = wx.rain ?? 0;
  if (drops) {
    const pos = new Float32Array(drops * 6);
    for (let i = 0; i < drops; i++) {
      const x = (r() - 0.5) * 50, y = r() * 24, z = (r() - 0.5) * 50;
      pos.set([x, y, z, x, y - 0.7, z], i * 6);
    }
    const g = keep(new BufferGeometry());
    g.setAttribute('position', new BufferAttribute(pos, 3));
    rain = new LineSegments(g, keep(new LineBasicMaterial({ color: '#d4dde0', transparent: true, opacity: 0.45 })));
    rain.frustumCulled = false;
    scene.add(rain);
  }

  const particles = new Particles();
  keep(particles.points.geometry);
  keep(particles.points.material as ShaderMaterial);
  scene.add(particles.points);

  return {
    scene, corridor, waterLevel, sky, ridge, rain, rainSpeed: spec.weather === 'Rain' ? 26 : 16, crowd, particles,
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}
