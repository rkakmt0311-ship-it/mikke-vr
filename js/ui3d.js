// VR・スマホVR用の3D UI（キャンバスに描いて板に貼る）
import * as THREE from 'three';
import { FONT, noRay } from './util.js';

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

// 絵本風の紙パネルの背景
export function paper(c, w, h, alpha = 0.92) {
  roundRect(c, 4, 4, w - 8, h - 8, Math.min(w, h) * 0.06);
  c.fillStyle = `rgba(250,243,226,${alpha})`; c.fill();
  c.lineWidth = Math.max(3, w * 0.006); c.strokeStyle = 'rgba(120,80,40,.7)'; c.stroke();
}

// お題リストを描く（PCのHTMLとVRで同じ情報）
export function drawList(c, w, h, state) {
  paper(c, w, h);
  const s = w / 600;
  c.fillStyle = '#5a3a1a'; c.font = `bold ${30 * s}px ${FONT}`; c.textBaseline = 'top';
  c.fillText(state.title || 'みつけてね', 26 * s, 20 * s);
  c.font = `${20 * s}px ${FONT}`; c.fillStyle = '#8a6a4a';
  c.fillText(`${fmtTime(state.time)}　ヒント のこり ${state.hintsLeft}`, 26 * s, 60 * s);
  let y = 98 * s;
  c.font = `bold ${27 * s}px ${FONT}`;
  for (const it of state.items) {
    c.fillStyle = it.found ? '#b0a090' : '#3a2410';
    c.fillText((it.found ? '✔ ' : '・ ') + it.name, 30 * s, y);
    if (it.found) { c.strokeStyle = '#c0392b'; c.lineWidth = 3 * s; c.beginPath(); c.moveTo(60 * s, y + 15 * s); c.lineTo(60 * s + c.measureText(it.name).width, y + 15 * s); c.stroke(); }
    y += 40 * s;
  }
  c.fillStyle = state.secretFound ? '#c08a00' : '#8a6a4a';
  c.fillText(state.secretFound ? `★ ${state.secretName}` : '★ ？？？（ひみつ）', 30 * s, y + 6 * s);
  if (state.cleared) { c.fillStyle = '#c0392b'; c.font = `bold ${30 * s}px ${FONT}`; c.fillText('ページ クリア！', 330 * s, 20 * s); }
}
export function fmtTime(sec) { sec = Math.floor(sec || 0); return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; }

// 浮かぶ文字（ミッケ！など）
export function textSprite(text, { size = 0.35, color = '#fff', stroke = '#d35400', font = 120 } = {}) {
  const cv = document.createElement('canvas'), c = cv.getContext('2d');
  c.font = `900 ${font}px ${FONT}`; const w = Math.ceil(c.measureText(text).width) + 60;
  cv.width = w; cv.height = font * 1.5;
  c.font = `900 ${font}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.lineWidth = font * 0.14; c.strokeStyle = stroke; c.lineJoin = 'round'; c.strokeText(text, w / 2, cv.height / 2);
  c.fillStyle = color; c.fillText(text, w / 2, cv.height / 2);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, toneMapped: false }));
  sp.scale.set(size * w / cv.height, size, 1); sp.renderOrder = 950;
  return noRay(sp);
}

// 3Dボタン（レーザー・見つめる操作で押せる）
export function button3d(label, w, h, onPress, { color = '#fff6e0', textColor = '#4a2c10', font = 0.5 } = {}) {
  const p = new Panel(w, h, 500);
  const render = (hover) => p.draw((c, W, H) => {
    roundRect(c, 3, 3, W - 6, H - 6, H * 0.3); c.fillStyle = hover ? '#ffd27a' : color; c.fill();
    c.lineWidth = 4; c.strokeStyle = 'rgba(90,58,26,.8)'; c.stroke();
    c.fillStyle = textColor; c.font = `bold ${H * font}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(label, W / 2, H / 2 + 2);
  });
  render(false);
  p.mesh.userData.interact = { kind: 'ui', fn: onPress, dwell: 1.0 };
  p.mesh.userData.setHover = render;
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
