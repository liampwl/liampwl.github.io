// In-stage HUD, drawn into a 640x480 canvas laid over the 3D view.
import type { Note } from './track';

const FONT = "Archivo, 'Helvetica Neue', Arial, sans-serif";
const LIGHT = '#f2f4ee';
const INK = '#1d2122';
const PANEL = 'rgba(29,33,34,0.55)';

export interface HudState {
  code: string;
  name: string;
  time: number | null; // seconds since the start, null before GO
  speed: number; // km/h
  rpm: number;
  gear: number;
  progress: number; // 0..1 between start and finish
  splits: number[]; // 0..1
  note: Note | null;
  next: Note | null;
  noteAlpha: number;
  message: { text: string; sub?: string; color?: string; big?: boolean } | null;
  hint: string | null;
  sound: boolean;
}

const SEG: Record<string, string> = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g' };

export function lcd(g: CanvasRenderingContext2D, text: string, x: number, y: number, h: number, on: string, off: string, align: 'left' | 'right' = 'left') {
  const t = Math.max(1, Math.round(h * 0.14)), w = Math.round(h * 0.52), gap = Math.max(1, Math.round(h * 0.16));
  let width = 0;
  for (const ch of text) width += (ch === ':' || ch === '.' ? t : w) + gap;
  width -= gap;
  let cx = align === 'right' ? x - width : x;
  for (const ch of text) {
    if (ch === ':' || ch === '.') {
      g.fillStyle = on;
      if (ch === ':') g.fillRect(cx, y + Math.round(h * 0.28), t, t);
      g.fillRect(cx, y + (ch === ':' ? Math.round(h * 0.64) : h - t), t, t);
      cx += t + gap;
      continue;
    }
    const lit = SEG[ch] ?? '';
    const half = Math.round(h / 2);
    const segs: Record<string, [number, number, number, number]> = {
      a: [cx + t, y, w - 2 * t, t], b: [cx + w - t, y + t, t, half - t * 1.5], c: [cx + w - t, y + half + t / 2, t, half - t * 1.5],
      d: [cx + t, y + h - t, w - 2 * t, t], e: [cx, y + half + t / 2, t, half - t * 1.5], f: [cx, y + t, t, half - t * 1.5], g: [cx + t, y + half - t / 2, w - 2 * t, t],
    };
    for (const k in segs) {
      g.fillStyle = lit.includes(k) ? on : off;
      const [sx, sy, sw, sh] = segs[k];
      g.fillRect(Math.round(sx), Math.round(sy), Math.round(sw), Math.round(sh));
    }
    cx += w + gap;
  }
  return width;
}

export function formatTime(s: number) {
  const m = Math.floor(s / 60), sec = Math.floor(s % 60), cs = Math.floor((s * 100) % 100);
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

function outlined(g: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color = LIGHT, weight = 800, align: CanvasTextAlign = 'center') {
  g.font = `italic ${weight} ${size}px ${FONT}`;
  g.textAlign = align;
  g.lineJoin = 'round';
  g.lineWidth = Math.max(2, size / 7);
  g.strokeStyle = INK;
  g.strokeText(text, x, y);
  g.fillStyle = color;
  g.fillText(text, x, y);
}

const ICON: Record<number, { r: number; sweep: number }> = {
  1: { r: 7, sweep: 180 }, 2: { r: 9, sweep: 125 }, 3: { r: 11, sweep: 100 },
  4: { r: 14, sweep: 78 }, 5: { r: 19, sweep: 56 }, 6: { r: 28, sweep: 36 },
};

// Corner numbers run 1 (hairpin) to 6 (nearly flat); colour them so the
// severity reads before the number does
export function gradeColor(grade: number) {
  return grade <= 2 ? '#ff8f6b' : grade <= 4 ? '#f3d36a' : '#a8e0a0';
}

// The short form of a note, without modifiers: "right 2", "jump"
function head(n: Note) {
  if (n.kind !== 'corner') return n.kind === 'jump' ? 'jump' : 'crest';
  const side = n.dir === 1 ? 'left' : 'right';
  return n.grade === 1 ? `hairpin ${side}` : `${side} ${n.grade}`;
}

// What follows the current note, in plain words
export function followText(n: Note, next: Note) {
  if (n.link === 'into') return `${head(next)} straight after`;
  if (n.link === 'and') return `then ${head(next)}`;
  return `${head(next)} in ${n.link} m`;
}

export function noteIcon(g: CanvasRenderingContext2D, n: Note, cx: number, cy: number, scale: number) {
  g.save();
  g.translate(cx, cy);
  g.scale(scale, scale);
  const path = new Path2D();
  let endX = 0, endY = 0, endA = -Math.PI / 2;
  if (n.kind === 'corner') {
    const { r, sweep } = ICON[n.grade] ?? ICON[4];
    const dir = n.dir === 1 ? -1 : 1; // screen x: left is negative
    path.moveTo(0, 16);
    path.lineTo(0, 4);
    // Arc centred to the turning side
    const ox = dir * r, oy = 4;
    const a0 = dir === -1 ? 0 : Math.PI;
    const a1 = a0 + (dir === -1 ? -1 : 1) * (sweep * Math.PI) / 180;
    path.arc(ox, oy, r, a0, a1, dir === -1);
    endX = ox + r * Math.cos(a1);
    endY = oy + r * Math.sin(a1);
    endA = a1 + (dir === -1 ? -Math.PI / 2 : Math.PI / 2);
  } else {
    path.moveTo(-18, 12);
    path.lineTo(-8, 12);
    path.quadraticCurveTo(0, -4, 8, 12);
    path.lineTo(18, 12);
    if (n.kind === 'jump') {
      path.moveTo(-12, 2);
      path.quadraticCurveTo(0, -18, 12, 0);
      endX = 12;
      endY = 0;
      endA = Math.PI * 0.35;
    }
  }
  for (const [w, c] of [[7, INK], [3.5, LIGHT]] as const) {
    g.lineWidth = w;
    g.strokeStyle = c;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.stroke(path);
  }
  if (n.kind !== 'crest') {
    const head = new Path2D();
    head.moveTo(endX + Math.cos(endA) * 6, endY + Math.sin(endA) * 6);
    head.lineTo(endX + Math.cos(endA + 2.3) * 6, endY + Math.sin(endA + 2.3) * 6);
    head.lineTo(endX + Math.cos(endA - 2.3) * 6, endY + Math.sin(endA - 2.3) * 6);
    head.closePath();
    g.lineWidth = 3;
    g.strokeStyle = INK;
    g.stroke(head);
    g.fillStyle = LIGHT;
    g.fill(head);
  }
  if (n.kind === 'corner') {
    g.font = `italic 800 13px ${FONT}`;
    g.textAlign = 'center';
    g.lineWidth = 3;
    g.strokeStyle = INK;
    const tx = n.dir === 1 ? 12 : -12;
    g.strokeText(String(n.grade), tx, 14);
    g.fillStyle = gradeColor(n.grade);
    g.fillText(String(n.grade), tx, 14);
  }
  g.restore();
}

export function drawHud(g: CanvasRenderingContext2D, s: HudState) {
  g.clearRect(0, 0, 640, 480);

  // Stage tag
  g.fillStyle = PANEL;
  g.font = `700 11px ${FONT}`;
  const nameW = g.measureText(s.name).width;
  g.fillRect(14, 14, 74 + nameW, 34);
  g.font = `italic 800 16px ${FONT}`;
  g.textAlign = 'left';
  g.fillStyle = '#f3efa0';
  g.fillText(s.code, 22, 36);
  g.font = `700 11px ${FONT}`;
  g.fillStyle = LIGHT;
  g.fillText(s.name, 76, 35);

  // Stage clock
  g.fillStyle = PANEL;
  g.fillRect(486, 14, 140, 34);
  lcd(g, formatTime(s.time ?? 0), 618, 22, 18, s.time === null ? 'rgba(242,244,238,0.5)' : LIGHT, 'rgba(242,244,238,0.1)', 'right');

  // Progress strip
  const px = 22, py0 = 96, py1 = 372;
  g.fillStyle = PANEL;
  g.fillRect(px - 4, py0 - 4, 12, py1 - py0 + 8);
  const fill = Math.max(0, Math.min(1, s.progress));
  g.fillStyle = '#9bb1a8';
  g.fillRect(px, py1 - (py1 - py0) * fill, 4, (py1 - py0) * fill);
  g.fillStyle = LIGHT;
  for (const sp of s.splits) g.fillRect(px - 3, Math.round(py1 - (py1 - py0) * sp), 10, 1);
  g.fillStyle = '#f3efa0';
  g.fillRect(px - 3, py0, 10, 2);
  const my = py1 - (py1 - py0) * fill;
  g.beginPath();
  g.moveTo(px + 9, my);
  g.lineTo(px + 15, my - 4);
  g.lineTo(px + 15, my + 4);
  g.closePath();
  g.fill();

  // Pace notes
  if (s.note && s.noteAlpha > 0) {
    g.save();
    g.globalAlpha = s.noteAlpha;
    g.fillStyle = PANEL;
    g.fillRect(278, 14, 84, 58);
    noteIcon(g, s.note, 320, 40, 1.15);
    if (s.next && s.note.link === 'into') {
      g.fillStyle = PANEL;
      g.fillRect(366, 22, 48, 42);
      noteIcon(g, s.next, 390, 42, 0.8);
    }
    const call = s.note.call.toUpperCase();
    outlined(g, call, 320, 88, 13, LIGHT, 800);
    if (s.next && s.note.link) outlined(g, followText(s.note, s.next).toUpperCase(), 320, 103, 10, '#cfd8d4', 700);
    g.restore();
  }

  // Tacho, gear, speed
  const cx = 572, cy = 418, R = 42;
  g.fillStyle = PANEL;
  g.beginPath();
  g.arc(cx, cy, R + 6, 0, Math.PI * 2);
  g.fill();
  const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
  g.lineWidth = 1;
  for (let k = 0; k <= 8; k++) {
    const a = a0 + ((a1 - a0) * k) / 8;
    g.strokeStyle = k >= 7 ? '#e0583c' : LIGHT;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * (R - 7), cy + Math.sin(a) * (R - 7));
    g.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
    g.stroke();
  }
  const na = a0 + (a1 - a0) * Math.min(1, s.rpm / 8000);
  g.strokeStyle = '#e0583c';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(cx, cy);
  g.lineTo(cx + Math.cos(na) * (R - 4), cy + Math.sin(na) * (R - 4));
  g.stroke();
  g.fillStyle = LIGHT;
  g.beginPath();
  g.arc(cx, cy, 3, 0, Math.PI * 2);
  g.fill();
  if (s.gear === 0) {
    g.font = `italic 800 16px ${FONT}`;
    g.textAlign = 'center';
    g.fillText('R', cx, cy + 30);
  } else lcd(g, String(s.gear), cx - 4, cy + 14, 16, '#f3efa0', 'rgba(243,239,160,0.12)');
  outlined(g, String(Math.round(s.speed)).padStart(3, ' '), 512, 452, 26, LIGHT, 800, 'right');
  g.font = `700 10px ${FONT}`;
  g.textAlign = 'right';
  g.fillStyle = LIGHT;
  g.fillText('km/h', 512, 466);

  // Messages
  if (s.message) {
    const m = s.message;
    outlined(g, m.text, 320, m.big ? 238 : 200, m.big ? 64 : 26, m.color ?? LIGHT, 800);
    if (m.sub) outlined(g, m.sub, 320, m.big ? 266 : 222, 14, '#cfd8d4', 700);
  }

  if (s.hint) {
    g.font = `700 10px ${FONT}`;
    g.textAlign = 'left';
    g.fillStyle = 'rgba(242,244,238,0.85)';
    g.fillText(s.hint, 14, 470);
  }
}
