// 文字・模様のテクスチャを1枚にまとめたもの（アトラス）。まとめて描画しても1枚で済む
import * as THREE from 'three';
import { FONT } from '../util.js';

const SIZE = 2048, N = 16, PX = SIZE / N;
const canvas = document.createElement('canvas'); canvas.width = canvas.height = SIZE;
const ctx = canvas.getContext('2d');
export const atlasTex = new THREE.CanvasTexture(canvas);
atlasTex.colorSpace = THREE.SRGBColorSpace; atlasTex.anisotropy = 4;
const cells = new Map(); let next = 0;

export function cell(key, draw) {
  if (cells.has(key)) return cells.get(key);
  const i = next++, x = (i % N) * PX, y = Math.floor(i / N) * PX;
  ctx.save(); ctx.translate(x, y); ctx.beginPath(); ctx.rect(0, 0, PX, PX); ctx.clip();
  draw(ctx, PX); ctx.restore();
  atlasTex.needsUpdate = true;
  const c = { u0: (x + 3) / SIZE, u1: (x + PX - 3) / SIZE, v0: 1 - (y + PX - 3) / SIZE, v1: 1 - (y + 3) / SIZE };
  cells.set(key, c); return c;
}
// ジオメトリのUVを、アトラスの1マスに収める
export function mapUV(geo, c) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, c.u0 + uv.getX(i) * (c.u1 - c.u0), c.v0 + uv.getY(i) * (c.v1 - c.v0));
  return geo;
}

// ---- よく使う絵柄 ----
const rr = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); };
export const draw = {
  letter: (ch, bg, fg) => (g, s) => {
    g.fillStyle = bg; g.fillRect(0, 0, s, s);
    g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = s * 0.06; g.strokeRect(s * 0.08, s * 0.08, s * 0.84, s * 0.84);
    g.fillStyle = fg; g.font = `900 ${s * 0.62}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, s / 2, s * 0.54);
  },
  card: (rank, suit) => (g, s) => {
    const red = suit === '♥' || suit === '♦';
    g.fillStyle = '#fbf8f0'; g.fillRect(0, 0, s, s);
    g.strokeStyle = '#c9b48a'; g.lineWidth = 3; rr(g, 4, 4, s - 8, s - 8, 10); g.stroke();
    g.fillStyle = red ? '#c8102e' : '#151515'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `bold ${s * 0.22}px ${FONT}`; g.fillText(rank, s * 0.2, s * 0.17); g.save(); g.translate(s * 0.8, s * 0.83); g.rotate(Math.PI); g.fillText(rank, 0, 0); g.restore();
    g.font = `${s * 0.5}px ${FONT}`; g.fillText(suit, s / 2, s * 0.55);
  },
  stripes: (cols, vertical = false) => (g, s) => {
    const n = cols.length * 2; for (let i = 0; i < n; i++) { g.fillStyle = cols[i % cols.length];
      if (vertical) g.fillRect(i * s / n, 0, s / n + 1, s); else g.fillRect(0, i * s / n, s, s / n + 1); }
  },
  dots: (bg, dot, r = 0.06) => (g, s) => {
    g.fillStyle = bg; g.fillRect(0, 0, s, s); g.fillStyle = dot;
    for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) { g.beginPath(); g.arc((x + (y % 2) * 0.5) * s / 6 + s / 12, y * s / 6 + s / 12, s * r, 0, 7); g.fill(); }
  },
  checker: (a, b, n = 4) => (g, s) => { for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { g.fillStyle = (x + y) % 2 ? a : b; g.fillRect(x * s / n, y * s / n, s / n + 1, s / n + 1); } },
  clock: (rim) => (g, s) => {
    g.fillStyle = rim; g.fillRect(0, 0, s, s); g.fillStyle = '#fffaf0'; g.beginPath(); g.arc(s / 2, s / 2, s * 0.44, 0, 7); g.fill();
    g.fillStyle = '#222'; g.font = `bold ${s * 0.12}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let i = 1; i <= 12; i++) { const a = i / 12 * Math.PI * 2 - Math.PI / 2; g.fillText(String(i), s / 2 + Math.cos(a) * s * 0.34, s / 2 + Math.sin(a) * s * 0.34); }
    g.strokeStyle = '#222'; g.lineWidth = s * 0.03; g.beginPath(); g.moveTo(s / 2, s / 2); g.lineTo(s / 2, s * 0.24); g.moveTo(s / 2, s / 2); g.lineTo(s * 0.68, s * 0.56); g.stroke();
  },
  domino: (a, b) => (g, s) => {
    g.fillStyle = '#111'; g.fillRect(0, 0, s, s); g.fillStyle = '#f4f1ea'; g.fillRect(s * 0.48, s * 0.05, s * 0.04, s * 0.9);
    const P = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };
    [[a, s * 0.25], [b, s * 0.75]].forEach(([n, cx]) => (P[n] || []).forEach(([x, y]) => { g.beginPath(); g.arc(cx + x * s * 0.12, s / 2 + y * s * 0.28, s * 0.05, 0, 7); g.fill(); }));
  },
  book: (bg, title, fg = '#ffe9b0') => (g, s) => {
    g.fillStyle = bg; g.fillRect(0, 0, s, s); g.strokeStyle = fg; g.lineWidth = 4; g.strokeRect(10, 10, s - 20, s - 20);
    g.fillStyle = fg; g.font = `bold ${s * 0.16}px ${FONT}`; g.textAlign = 'center'; g.fillText(title, s / 2, s * 0.58);
  },
  face: (skin, cheek = '#ff9aa2') => (g, s) => {
    g.fillStyle = skin; g.fillRect(0, 0, s, s); g.fillStyle = '#222';
    [0.4, 0.6].forEach(x => { g.beginPath(); g.arc(x * s, s * 0.45, s * 0.035, 0, 7); g.fill(); });
    g.fillStyle = cheek; [0.33, 0.67].forEach(x => { g.beginPath(); g.arc(x * s, s * 0.55, s * 0.04, 0, 7); g.fill(); });
    g.strokeStyle = '#a33'; g.lineWidth = 3; g.beginPath(); g.arc(s / 2, s * 0.56, s * 0.05, 0.2, Math.PI - 0.2); g.stroke();
  },
  swirl: (bg, col) => (g, s) => {
    g.fillStyle = bg; g.fillRect(0, 0, s, s); g.strokeStyle = col; g.lineWidth = s * 0.08;
    for (let k = 0; k < 3; k++) { g.beginPath(); for (let x = 0; x <= s; x += 4) g.lineTo(x, s * (0.2 + k * 0.3) + Math.sin(x / s * Math.PI * 4 + k) * s * 0.08); g.stroke(); }
  },
  wrap: (bg, stripe) => (g, s) => { g.fillStyle = bg; g.fillRect(0, 0, s, s); g.strokeStyle = stripe; g.lineWidth = s * 0.06;
    for (let i = -s; i < s * 2; i += s / 5) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + s, s); g.stroke(); } },
};
