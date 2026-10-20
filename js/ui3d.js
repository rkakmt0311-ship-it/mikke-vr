// VR・スマホVR用の3D UI（キャンバスに描いて板に貼る）
import * as THREE from 'three';
import { FONT, noRay, INK, PAPER, SEAL, BRASS } from './util.js';

export class Panel {
  constructor(w, h, pxPerM = 600) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = Math.round(w * pxPerM); this.canvas.height = Math.round(h * pxPerM);
    this.ctx = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas); this.tex.colorSpace = THREE.SRGBColorSpace;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
    this.mesh.renderOrder = 900;
  }
  draw(fn) { const c = this.ctx, { width: w, height: h } = this.canvas; c.clearRect(0, 0, w, h); fn(c, w, h); this.tex.needsUpdate = true; return this; }
}

export function roundRect(c, x, y, w, h, r) { c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, r) : c.rect(x, y, w, h); }

// 古い紙（純白・純黒は使わない。角は鋭く、ふちは少し焼けている）
export function paper(c, w, h, alpha = 0.96) {
  c.save(); c.globalAlpha = alpha;
  c.fillStyle = PAPER; c.beginPath(); c.moveTo(3, 4); c.lineTo(w - 4, 2); c.lineTo(w - 2, h - 5); c.lineTo(4, h - 3); c.closePath(); c.fill();
  const g = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
  g.addColorStop(0, 'rgba(184,169,138,0)'); g.addColorStop(1, 'rgba(120,96,60,.45)'); c.fillStyle = g; c.fill();
  c.globalAlpha = alpha * 0.08; for (let i = 0; i < w * h / 90; i++) { c.fillStyle = Math.random() < 0.5 ? '#3a2a18' : '#fff8e0'; c.fillRect(Math.random() * w, Math.random() * h, 1.2, 1.2); }
  c.restore();
}
const KANJI = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
export const kanjiNum = n => n < 10 ? KANJI[n] : String(n);
const inkText = (c, text, x, y, size, color = INK, weight = 600, spacing = 0.12) => {
  c.font = `${weight} ${size}px ${FONT}`; c.fillStyle = color; c.shadowColor = 'rgba(35,27,20,.35)'; c.shadowBlur = size * 0.04;
  if ('letterSpacing' in c) c.letterSpacing = `${spacing}em`; c.fillText(text, x, y); c.shadowBlur = 0; if ('letterSpacing' in c) c.letterSpacing = '0px';
};

// お題リスト（PCのHTMLとVRで同じ言葉）
export function drawList(c, w, h, state) {
  paper(c, w, h);
  const s = w / 600; c.textBaseline = 'top';
  inkText(c, state.title || '', 30 * s, 22 * s, 22 * s, SEAL, 700, 0.18);
  inkText(c, 'この部屋の どこかに かくれているよ。', 30 * s, 56 * s, 17 * s, INK, 500);
  const left = state.items.filter(i => !i.found).length;
  inkText(c, state.cleared ? 'すべて 見つけだしたね。' : `あと ${kanjiNum(left)}つ`, w - 150 * s, 24 * s, 18 * s, BRASS, 700);
  let y = 96 * s;
  for (const it of state.items) {
    inkText(c, it.name, 46 * s, y, 24 * s, it.found ? 'rgba(35,27,20,.35)' : INK, 600);
    if (it.found) { c.strokeStyle = SEAL; c.lineWidth = 2.4 * s; c.beginPath(); c.moveTo(40 * s, y + 14 * s); c.bezierCurveTo(120 * s, y + 10 * s, 240 * s, y + 18 * s, 60 * s + c.measureText(it.name).width, y + 12 * s); c.stroke(); }
    y += 38 * s;
  }
  inkText(c, state.secretFound ? `ひみつ：${state.secretName}` : '……それから、リストにない ひみつが ひとつ。', 46 * s, y + 8 * s, 17 * s, state.secretFound ? SEAL : 'rgba(35,27,20,.6)', 500);
  inkText(c, `${fmtTime(state.time)}`, w - 110 * s, h - 40 * s, 15 * s, 'rgba(35,27,20,.5)', 500);
}
export function fmtTime(sec) { sec = Math.floor(sec || 0); return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; }

// 浮かぶ文字（ミッケ！など）：明朝の金箔
export function textSprite(text, { size = 0.35, color = '#f0dca0', stroke = '#3a2410', font = 120, sub = '' } = {}) {
  const cv = document.createElement('canvas'), c = cv.getContext('2d');
  c.font = `800 ${font}px ${FONT}`; const w = Math.ceil(Math.max(c.measureText(text).width * 1.25, sub ? font * 0.45 * sub.length : 0)) + 80;
  cv.width = w; cv.height = Math.round(font * (sub ? 2.1 : 1.5));
  c.textAlign = 'center'; c.textBaseline = 'middle'; if ('letterSpacing' in c) c.letterSpacing = '0.2em';
  c.font = `800 ${font}px ${FONT}`; c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = font * 0.18;
  c.lineWidth = font * 0.08; c.strokeStyle = stroke; c.lineJoin = 'round'; c.strokeText(text, w / 2, font * 0.75);
  const g = c.createLinearGradient(0, font * 0.3, 0, font * 1.2); g.addColorStop(0, '#fff3c8'); g.addColorStop(0.5, color); g.addColorStop(1, '#a57c2a');
  c.fillStyle = g; c.fillText(text, w / 2, font * 0.75);
  if (sub) { c.shadowBlur = 0; c.font = `500 ${font * 0.32}px ${FONT}`; c.fillStyle = '#e8dcc0'; c.fillText(sub, w / 2, font * 1.65); }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, toneMapped: false }));
  sp.scale.set(size * w / cv.height, size, 1); sp.renderOrder = 950;
  return noRay(sp);
}

// 3Dボタン：紙の札。見つめると万年筆の下線がすっと引かれる
export function button3d(label, w, h, onPress, { font = 0.42 } = {}) {
  const p = new Panel(w, h, 500);
  let hoverT = 0, hovering = false, raf = null;
  const render = () => p.draw((c, W, H) => {
    paper(c, W, H, 0.97);
    c.textAlign = 'center'; c.textBaseline = 'middle'; inkText(c, label, W / 2, H / 2, H * font, INK, 700, 0.15);
    if (hoverT > 0) { c.strokeStyle = SEAL; c.lineWidth = H * 0.05; c.lineCap = 'round'; const tw = c.measureText(label).width * 1.15, x0 = W / 2 - tw / 2;
      c.beginPath(); c.moveTo(x0, H * 0.78); c.quadraticCurveTo(x0 + tw * 0.5 * hoverT, H * 0.74, x0 + tw * hoverT, H * 0.8); c.stroke(); }
  });
  const anim = () => { hoverT = Math.max(0, Math.min(1, hoverT + (hovering ? 1 : -1) * 0.06)); render(); if ((hovering && hoverT < 1) || (!hovering && hoverT > 0)) raf = requestAnimationFrame(anim); else raf = null; };
  render();
  p.mesh.rotation.z = (Math.random() - 0.5) * 0.04;   // ほんの少し傾ける
  p.mesh.userData.interact = { kind: 'ui', fn: onPress, dwell: 1.0 };
  p.mesh.userData.setHover = (on) => { hovering = on; if (!raf) raf = requestAnimationFrame(anim); };
  return p.mesh;
}

// スマホVR用の照準（見つめるとゲージがたまる）
export function makeReticle() {
  const g = new THREE.Group();
  const mat = (c, o = 1) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthTest: false, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
  const dot = new THREE.Mesh(new THREE.RingGeometry(0.0, 0.006, 16), mat('#ffffff', 0.95));
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.014, 0.019, 32), mat('#ffffff', 0.55));
  const prog = new THREE.Mesh(new THREE.RingGeometry(0.014, 0.022, 32, 1, Math.PI / 2, 0.0001), mat('#ffcf5a', 1));
  [dot, ring, prog].forEach(m => { m.renderOrder = 999; g.add(m); });
  g.userData.setProgress = (t) => {
    prog.geometry.dispose();
    prog.geometry = new THREE.RingGeometry(0.014, 0.022, 32, 1, Math.PI / 2, -Math.max(0.0001, t) * Math.PI * 2);
  };
  return noRay(g);
}

// 視野の端を暗くする（スマホVRで飛ぶときの酔い対策）
export function makeVignette() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const c = cv.getContext('2d');
  const gr = c.createRadialGradient(128, 128, 50, 128, 128, 128); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,1)');
  c.fillStyle = gr; c.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(cv);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthTest: false, depthWrite: false }));
  m.position.z = -0.9; m.renderOrder = 998;
  return noRay(m);
}
