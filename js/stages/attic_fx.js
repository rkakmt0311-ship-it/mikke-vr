// 屋根裏の「3Dだからこそ」の仕掛け（docs/3d-fun-design.md）
// 著作権の切れた映画・絵画へのオマージュ：月世界旅行・ノスフェラトゥ・カリガリ博士・列車の到着・星月夜・睡蓮・グランドジャット・神奈川沖浪裏
// 絵は自動生成の「それ風」の絵。assets/manifest.json に本物の絵（パブリックドメインの画像）を登録すると差し替わる。
import * as THREE from 'three';
import { V, canvasTex, mesh, noRay, clamp01, lerp, smooth } from '../util.js';
import { tex } from '../assets.js';

const TAU = Math.PI * 2;

// ---------- 絵（自動生成の代わりの絵） ----------
const paint = {
  starry: (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#1b2a6b'); g.addColorStop(1, '#2e4f8f'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.lineCap = 'round';
    for (let i = 0; i < 900; i++) { const x = Math.random() * w, y = Math.random() * h * 0.75, a = Math.atan2(y - h * 0.3, x - w * 0.45) + Math.PI / 2;
      c.strokeStyle = Math.random() < 0.3 ? 'rgba(240,230,150,.7)' : 'rgba(120,160,230,.6)'; c.lineWidth = 2 + Math.random() * 3;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * 12, y + Math.sin(a) * 12); c.stroke(); }
    [[0.18, 0.2, 22], [0.4, 0.12, 14], [0.62, 0.22, 16], [0.82, 0.14, 26], [0.3, 0.4, 12], [0.72, 0.42, 13]].forEach(([x, y, r]) => {
      const gr = c.createRadialGradient(x * w, y * h, 0, x * w, y * h, r * 2.2); gr.addColorStop(0, '#fff8c0'); gr.addColorStop(0.4, '#f2d34a'); gr.addColorStop(1, 'rgba(242,211,74,0)');
      c.fillStyle = gr; c.beginPath(); c.arc(x * w, y * h, r * 2.2, 0, TAU); c.fill(); });
    c.strokeStyle = 'rgba(230,235,255,.6)'; c.lineWidth = 5; for (let k = 0; k < 3; k++) { c.beginPath(); for (let t = 0; t < 1; t += 0.01) { const a = t * TAU * 1.5 + k, r = 30 + t * 60; c.lineTo(w * 0.47 + Math.cos(a) * r, h * 0.3 + Math.sin(a) * r * 0.5); } c.stroke(); }
    c.fillStyle = '#1a1a14'; c.beginPath(); c.moveTo(w * 0.12, h); c.quadraticCurveTo(w * 0.05, h * 0.5, w * 0.16, h * 0.08); c.quadraticCurveTo(w * 0.22, h * 0.5, w * 0.24, h); c.fill();   // 糸杉
    c.fillStyle = '#2a3a3a'; c.fillRect(0, h * 0.8, w, h * 0.2); c.fillStyle = '#f2d34a'; for (let i = 0; i < 18; i++) c.fillRect(w * 0.3 + Math.random() * w * 0.6, h * 0.82 + Math.random() * h * 0.12, 4, 4); },
  lilies: (c, w, h) => { c.fillStyle = '#3a6b6a'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 1600; i++) { c.fillStyle = `hsla(${170 + Math.random() * 60},${30 + Math.random() * 30}%,${35 + Math.random() * 30}%,.5)`; c.fillRect(Math.random() * w, Math.random() * h, 10 + Math.random() * 18, 3); }
    for (let i = 0; i < 26; i++) { const x = Math.random() * w, y = h * 0.3 + Math.random() * h * 0.7; c.fillStyle = `hsl(${90 + Math.random() * 30},45%,${35 + Math.random() * 15}%)`;
      c.beginPath(); c.ellipse(x, y, 22 + Math.random() * 14, 8 + Math.random() * 5, 0, 0.3, TAU - 0.3); c.fill();
      if (Math.random() < 0.5) { c.fillStyle = `hsl(${330 + Math.random() * 30},60%,75%)`; c.beginPath(); c.arc(x + 4, y - 3, 5, 0, TAU); c.fill(); } } },
  jatte: (c, w, h) => { c.fillStyle = '#d9d2a0'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 14000; i++) { const x = Math.random() * w, y = Math.random() * h, water = y < h * 0.35 && x > w * 0.6;
      c.fillStyle = water ? `hsl(${195 + Math.random() * 25},45%,${50 + Math.random() * 20}%)` : y < h * 0.25 ? `hsl(${90 + Math.random() * 40},35%,${40 + Math.random() * 20}%)` : `hsl(${75 + Math.random() * 40},50%,${35 + Math.random() * 25}%)`;
      c.fillRect(x, y, 2, 2); }
    for (let i = 0; i < 9; i++) { const x = w * (0.1 + i * 0.09), y = h * (0.45 + (i % 3) * 0.13), s = 0.7 + (i % 3) * 0.25; c.fillStyle = i % 2 ? '#2a2620' : '#4a3a5a';
      c.beginPath(); c.ellipse(x, y + 40 * s, 10 * s, 35 * s, 0, 0, TAU); c.fill(); c.beginPath(); c.arc(x, y, 7 * s, 0, TAU); c.fill();
      if (i % 3 === 0) { c.fillStyle = '#c1121f'; c.beginPath(); c.arc(x + 6 * s, y - 14 * s, 16 * s, Math.PI, 0); c.fill(); } } },   // 赤い日傘
  wave: (c, w, h) => { c.fillStyle = '#efe4c8'; c.fillRect(0, 0, w, h); c.fillStyle = '#1e3a5f';
    c.beginPath(); c.moveTo(0, h); c.bezierCurveTo(w * 0.1, h * 0.4, w * 0.45, h * 0.05, w * 0.62, h * 0.32); c.bezierCurveTo(w * 0.5, h * 0.3, w * 0.48, h * 0.55, w * 0.62, h * 0.7); c.lineTo(w, h * 0.8); c.lineTo(w, h); c.fill();
    c.fillStyle = '#fff'; for (let i = 0; i < 40; i++) { const t = i / 40; c.beginPath(); c.arc(w * (0.35 + t * 0.28), h * (0.1 + Math.sin(t * 3) * 0.12), 6, 0, TAU); c.fill(); }
    c.fillStyle = '#8aa1b8'; c.beginPath(); c.moveTo(w * 0.72, h * 0.75); c.lineTo(w * 0.8, h * 0.6); c.lineTo(w * 0.88, h * 0.75); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.moveTo(w * 0.77, h * 0.65); c.lineTo(w * 0.8, h * 0.6); c.lineTo(w * 0.83, h * 0.65); c.fill(); },
  moon: (c, w, h) => { c.fillStyle = '#05050a'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; for (let i = 0; i < 60; i++) c.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    const gr = c.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * 0.38); gr.addColorStop(0, '#f2efe6'); gr.addColorStop(1, '#9a968c'); c.fillStyle = gr; c.beginPath(); c.arc(w / 2, h / 2, w * 0.36, 0, TAU); c.fill();
    c.strokeStyle = '#4a4740'; c.lineWidth = 4; c.beginPath(); c.arc(w * 0.4, h * 0.44, 14, 0.2, Math.PI - 0.2); c.stroke();                         // 左目（閉じかけ）
    c.beginPath(); c.arc(w / 2, h * 0.62, 34, 0.3, Math.PI - 0.3); c.stroke(); c.beginPath(); c.moveTo(w * 0.5, h * 0.45); c.lineTo(w * 0.47, h * 0.56); c.stroke();
    c.fillStyle = '#d8d4c8'; c.beginPath(); c.moveTo(w * 0.6, h * 0.42); c.lineTo(w * 0.85, h * 0.3); c.lineTo(w * 0.86, h * 0.36); c.closePath(); c.fill();      // 右目に刺さったロケット
    c.fillStyle = '#4a4740'; c.beginPath(); c.arc(w * 0.6, h * 0.43, 12, 0, TAU); c.fill(); },
  caligari: (c, w, h) => { c.fillStyle = '#d8cfb4'; c.fillRect(0, 0, w, h); c.fillStyle = '#1b1814';
    for (let i = 0; i < 16; i++) { c.beginPath(); const x = Math.random() * w, y = Math.random() * h; c.moveTo(x, y); c.lineTo(x + 40 + Math.random() * 60, y + (Math.random() - 0.5) * 30); c.lineTo(x + 10, y + 50 + Math.random() * 60); c.fill(); }
    c.strokeStyle = '#6b4a2a'; c.lineWidth = 6; for (let i = 0; i < 10; i++) { c.beginPath(); c.moveTo(Math.random() * w, 0); c.lineTo(Math.random() * w, h); c.stroke(); } },
  claw: (c, w, h) => { c.clearRect(0, 0, w, h); c.fillStyle = '#000';
    c.beginPath(); c.moveTo(w * 0.42, h); c.lineTo(w * 0.47, h * 0.45); c.lineTo(w * 0.55, h * 0.45); c.lineTo(w * 0.58, h); c.fill();             // 腕
    c.beginPath(); c.ellipse(w * 0.51, h * 0.42, w * 0.08, h * 0.06, 0, 0, TAU); c.fill();                                                      // 手のひら
    [-0.07, -0.035, 0, 0.035, 0.07].forEach((dx, i) => { const len = i === 0 ? 0.18 : 0.32 - Math.abs(dx) * 1.5; c.lineWidth = w * 0.012; c.strokeStyle = '#000'; c.lineCap = 'round';
      c.beginPath(); c.moveTo(w * (0.51 + dx * 0.6), h * 0.4); c.quadraticCurveTo(w * (0.51 + dx * 1.6), h * (0.4 - len * 0.6), w * (0.51 + dx * 2.2 + (i === 0 ? -0.08 : 0)), h * (0.4 - len)); c.stroke(); }); },
};

export function addAtticFx(cx) {
  const { root, game, P, spots, pools, rng, WIN, D, W, warm } = cx;
  const fx = { wind: 0, pianoNotes: 0 };
  const anims = []; const animate = (dur, fn, done) => anims.push({ t: 0, dur, fn, done });
  const once = new Set();      // 1ページに1回だけの演出
  let page = null, targets = [];

  // ---------- 額縁 ----------
  const frame = (key, painter, w, h, pos, ry) => {
    const g = new THREE.Group(); g.position.copy(pos); g.rotation.y = ry; root.add(g);
    const t = tex(`painting_${key}`, canvasTex(512, Math.round(512 * h / w), painter));
    mesh(new THREE.BoxGeometry(w + 0.12, h + 0.12, 0.05), P('#7a5a2a', 0.35, 0.6), V(0, 0, 0), g);
    mesh(new THREE.PlaneGeometry(w, h), P('#fff', 0.85, 0, { map: t }), V(0, 0, 0.027), g);
    return g;
  };
  const starry = frame('starry', paint.starry, 0.9, 0.72, V(-1.25, 2.75, D - 0.03), Math.PI);
  frame('lilies', paint.lilies, 1.0, 0.5, V(1.25, 2.65, D - 0.03), Math.PI);
  const jatte = frame('jatte', paint.jatte, 0.95, 0.62, V(-1.45, 2.75, -D + 0.03), 0);
  jatte.userData.dynamic = true;   // 見ていない間に少し傾く

  // ---------- 『月世界旅行』の幻燈機（のぞき穴の中に小さな月世界） ----------
  const lantern = new THREE.Group(); lantern.position.set(2.66, 1.23, 0.35); lantern.rotation.y = -Math.PI / 2; lantern.userData.dynamic = true; root.add(lantern);
  const tin = P('#6b5a3a', 0.45, 0.7);
  const LW = 0.36, LH = 0.3, LD = 0.34;
  mesh(new THREE.BoxGeometry(LW, 0.02, LD), tin, V(0, 0.01, 0), lantern); mesh(new THREE.BoxGeometry(LW, 0.02, LD), tin, V(0, LH, 0), lantern);
  mesh(new THREE.BoxGeometry(0.02, LH, LD), tin, V(-LW / 2, LH / 2, 0), lantern); mesh(new THREE.BoxGeometry(0.02, LH, LD), tin, V(LW / 2, LH / 2, 0), lantern);
  mesh(new THREE.PlaneGeometry(LW, LH), P('#fff', 1, 0, { map: canvasTex(256, 220, paint.moon) }), V(0, LH / 2, -LD / 2 + 0.01), lantern);
  const front = new THREE.Shape(); front.moveTo(-LW / 2, 0); front.lineTo(LW / 2, 0); front.lineTo(LW / 2, LH); front.lineTo(-LW / 2, LH); front.closePath();
  const hole = new THREE.Path(); hole.absarc(0, LH * 0.55, 0.045, 0, TAU, true); front.holes.push(hole);
  mesh(new THREE.ExtrudeGeometry(front, { depth: 0.015, bevelEnabled: false }), tin, V(0, 0, LD / 2 - 0.015), lantern);
  mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.1, 24, 1, true), P('#b8902a', 0.25, 1, { side: THREE.DoubleSide }), V(0, LH * 0.55, LD / 2 + 0.05), lantern).rotation.x = Math.PI / 2;
  mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.12, 10), tin, V(0.08, LH + 0.06, 0), lantern);   // 煙突
  const lanternLight = new THREE.PointLight('#fff2c8', 0.35, 0.5, 2); lanternLight.position.set(0, LH * 0.6, 0.05); lantern.add(lanternLight);
  for (let i = 0; i < 6; i++) mesh(new THREE.SphereGeometry(0.004, 6, 4), new THREE.MeshBasicMaterial({ color: '#fff' }), V((Math.random() - 0.5) * 0.28, 0.05 + Math.random() * 0.2, -0.1 + Math.random() * 0.15), lantern, { cast: false });
  spots.lanternInside = () => ({ p: V(0.05, 0.03, -0.05), parent: lantern, rot: [0, 0.6, 0], scale: 0.55 });
  cx.box(2.45, 1.2, 0.15, 2.85, 1.55, 0.55);

  // ---------- 『カリガリ博士』の棺（見つめると軋みながら開く・二重底） ----------
  const coffin = new THREE.Group(); coffin.position.set(-2.45, 0, 0.3); coffin.rotation.y = Math.PI / 2; coffin.userData.dynamic = true; root.add(coffin);
  const cali = P('#fff', 0.8, 0, { map: canvasTex(256, 512, paint.caligari) });
  const cs = new THREE.Shape(); cs.moveTo(-0.22, 0); cs.lineTo(0.22, 0); cs.lineTo(0.33, 1.2); cs.lineTo(0.18, 1.85); cs.lineTo(-0.18, 1.85); cs.lineTo(-0.33, 1.2); cs.closePath();
  const back = new THREE.ExtrudeGeometry(cs, { depth: 0.04, bevelEnabled: false }); mesh(back, cali, V(0, 0, -0.2), coffin);
  const sideM = P('#3a2a1c', 0.7);
  const pts = cs.getPoints(); for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length], len = Math.hypot(b.x - a.x, b.y - a.y);
    const m = mesh(new THREE.BoxGeometry(len, 0.03, 0.36), sideM, V((a.x + b.x) / 2, (a.y + b.y) / 2, -0.02), coffin); m.rotation.z = Math.atan2(b.y - a.y, b.x - a.x); }
  mesh(new THREE.BoxGeometry(0.5, 0.02, 0.32), sideM, V(0, 0.35, -0.02), coffin);   // 二重底
  const doorPivot = new THREE.Group(); doorPivot.position.set(-0.33, 0, 0.17); coffin.add(doorPivot);
  const door = new THREE.ExtrudeGeometry(cs, { depth: 0.035, bevelEnabled: false }); door.translate(0.33, 0, 0);
  mesh(door, cali, V(0, 0, 0), doorPivot);
  let coffinOpen = false;
  coffin.userData.interact = { kind: 'gimmick', dwell: 1.5, fn: () => { if (coffinOpen) return; coffinOpen = true; game.sfx.groan(coffin.getWorldPosition(V()));
    animate(2.6, t => { doorPivot.rotation.y = -1.9 * smooth(t); coffin.scale.set(1 + Math.sin(t * 20) * 0.01 * (1 - t), 1, 1); }); } };
  spots.coffinInside = () => ({ p: V(0.02, 0.37, -0.02), parent: coffin, rot: [0, 0, 0], scale: 0.8 });
  for (let i = 0; i < 4; i++) pool(pools, 'coffin', r => ({ p: V(r.range(-0.15, 0.15), 0.02, r.range(-0.12, 0.08)), parent: coffin }));
  cx.box(-2.7, 0, -0.05, -2.25, 1.9, 0.65);

  // ---------- 『列車の到着』：おもちゃの線路と、ほこりでできた巨大な機関車の幻 ----------
  const track = new THREE.Group(); track.position.set(0.15, 0.005, 1.7); root.add(track);
  mesh(new THREE.TorusGeometry(0.42, 0.012, 6, 64), P('#555', 0.4, 0.8), V(0, 0.006, 0), track).rotation.x = Math.PI / 2;
  mesh(new THREE.TorusGeometry(0.36, 0.012, 6, 64), P('#555', 0.4, 0.8), V(0, 0.006, 0), track).rotation.x = Math.PI / 2;
  const train = new THREE.Group(); train.userData.dynamic = true; track.add(train);
  const carM = [P('#1b1b1b', 0.3, 0.4), P('#8a1c1c', 0.4), P('#2f4f3f', 0.4)];
  const cars = carM.map((m, i) => { const g = new THREE.Group(); train.add(g); mesh(new THREE.BoxGeometry(0.14, 0.07, 0.07), m, V(0, 0.05, 0), g);
    if (!i) { mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.11, 14), m, V(0.02, 0.09, 0), g).rotation.z = Math.PI / 2; mesh(new THREE.CylinderGeometry(0.012, 0.015, 0.05, 8), m, V(0.06, 0.13, 0), g); }
    return g; });
  let trainA = 0, trainRun = 0;
  const placeCars = () => cars.forEach((g, i) => { const a = trainA - i * 0.42; g.position.set(Math.cos(a) * 0.39, 0, Math.sin(a) * 0.39); g.rotation.y = -a - Math.PI / 2; });
  placeCars();
  // 幻の機関車（点の集まり）
  const ghostN = 1400, gp = new Float32Array(ghostN * 3);
  for (let i = 0; i < ghostN; i++) { let x, y, z; const k = Math.random();
    if (k < 0.55) { x = Math.random() * 2.2; const a = Math.random() * TAU; y = 0.55 + Math.cos(a) * 0.32; z = Math.sin(a) * 0.32; }        // ボイラー
    else if (k < 0.75) { x = 2.0 + Math.random() * 0.7; y = 0.3 + Math.random() * 0.9; z = (Math.random() - 0.5) * 0.7; }               // 運転室
    else if (k < 0.9) { const w2 = Math.floor(Math.random() * 3), a = Math.random() * TAU; x = 0.3 + w2 * 0.8 + Math.cos(a) * 0.25; y = 0.25 + Math.sin(a) * 0.25; z = (Math.random() < 0.5 ? -1 : 1) * 0.35; }   // 車輪
    else { x = 0.25 + Math.random() * 0.15; y = 0.9 + Math.random() * 0.45; z = (Math.random() - 0.5) * 0.15; }                        // 煙突
    gp.set([x - 1.3, y, z], i * 3); }
  const ghostG = new THREE.BufferGeometry(); ghostG.setAttribute('position', new THREE.BufferAttribute(gp, 3));
  const ghostM = new THREE.PointsMaterial({ color: '#ffe0b0', size: 0.03, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const ghost = noRay(new THREE.Points(ghostG, ghostM)); ghost.visible = false; root.add(ghost);
  let ghostT = -1;
  const runTrain = () => { if (trainRun > 0) return; trainRun = 6; game.sfx.chug(24, track.getWorldPosition(V()));
    setTimeout(() => { ghostT = 0; ghost.visible = true; game.sfx.whistle(); game.sfx.chug(14); fx.wind = 1; }, 1500); };
  train.userData.interact = { kind: 'play', dwell: 1.0, fn: runTrain };
  track.userData.interact = { kind: 'play', dwell: 1.0, fn: runTrain };

  // ---------- 『星月夜』の渦（蓄音機を鳴らすと、絵から光の渦が溢れ出し、まだ見つけていないお題の近くを照らす） ----------
  const swirlN = 360, sp = new Float32Array(swirlN * 3), swirlSeed = Array.from({ length: swirlN }, () => [Math.random(), Math.random() * TAU, 0.05 + Math.random() * 0.3]);
  const swirlG = new THREE.BufferGeometry(); swirlG.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const swirlM = new THREE.PointsMaterial({ color: '#ffe27a', size: 0.035, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const swirl = noRay(new THREE.Points(swirlG, swirlM)); swirl.visible = false; root.add(swirl);
  const swirlLight = new THREE.PointLight('#ffe9a0', 0, 1.6, 2); root.add(swirlLight);
  let swirlT = -1, swirlTo = V();
  const MELODY = [7, 9, 7, 5, 4, 5, 7, -1, 4, 5, 4, 2, 0, 2, 4, -1, 7, 9, 10, 9, 7, 5, 4];
  fx.playGramophone = (gramPos) => { if (swirlT >= 0) return; let w = 0; MELODY.forEach((n, i) => { if (n >= 0) game.sfx.musicBoxNote(n, gramPos, w, 1.2); w += 0.32; });
    const left = targets.filter(t => !t.obj.userData.found && t.obj.visible); swirlTo = left.length ? left[Math.floor(Math.random() * left.length)].obj.getWorldPosition(V()) : V(0, 2, 0);
    swirlT = 0; swirl.visible = true; game.sfx.shimmer(); };

  // ---------- 『神奈川沖浪裏』のめくり本（見つめると頁がめくれ、波しぶきが飛び出す） ----------
  const fbook = new THREE.Group(); fbook.position.set(-2.85, 0.65, 1.6); fbook.rotation.y = Math.PI / 2; fbook.userData.dynamic = true; root.add(fbook);
  mesh(new THREE.BoxGeometry(0.3, 0.02, 0.22), P('#efe4c8', 0.9), V(0, 0.01, 0), fbook);
  const waveTex = canvasTex(256, 192, paint.wave);
  const leaves = []; for (let i = 0; i < 8; i++) { const piv = new THREE.Group(); piv.position.set(0, 0.022 + i * 0.001, 0); fbook.add(piv);
    const lf = mesh(new THREE.PlaneGeometry(0.15, 0.22), P('#fff', 0.9, 0, { map: waveTex, side: THREE.DoubleSide }), V(0.075, 0, 0), piv, { cast: false }); lf.rotation.x = -Math.PI / 2; leaves.push(piv); }
  const sprayN = 260, sprayP = new Float32Array(sprayN * 3), sprayV = Array.from({ length: sprayN }, () => V((Math.random() - 0.5) * 1.2, 1 + Math.random() * 1.6, (Math.random() - 0.3) * 1.2));
  const sprayG = new THREE.BufferGeometry(); sprayG.setAttribute('position', new THREE.BufferAttribute(sprayP, 3));
  const sprayM = new THREE.PointsMaterial({ color: '#dff4ff', size: 0.025, transparent: true, opacity: 0, depthWrite: false });
  const spray = noRay(new THREE.Points(sprayG, sprayM)); spray.visible = false; root.add(spray);
  let flipT = -1;
  fbook.userData.interact = { kind: 'gimmick', dwell: 1.5, fn: () => { if (flipT >= 0) return; flipT = 0; game.sfx.pages(fbook.getWorldPosition(V())); setTimeout(() => game.sfx.wave(fbook.getWorldPosition(V())), 900); } };

  // ---------- 『ノスフェラトゥ』の爪の影 ----------
  const clawM = new THREE.MeshBasicMaterial({ map: canvasTex(256, 512, paint.claw), transparent: true, opacity: 0, depthWrite: false, color: '#000' });
  const claw = noRay(new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.8), clawM)); claw.position.set(1.45, 0.6, -D + 0.04); root.add(claw); claw.visible = false;
  let clawT = -1, clawSeenFade = 1;

  // ---------- 見ていない間の小さな変化・背後の物音（ルール：音が先・引き際・行動がきっかけ） ----------
  let idle = 0, lastYaw = 0, behindT = -1, behindPos = V();
  const dimLamp = () => { const w = warm[Math.floor(Math.random() * warm.length)]; if (!w) return; const was = w.L.intensity; w.L.intensity = was * 0.15; setTimeout(() => { w.L.intensity = was; }, 1000); };

  const tmp = V(), dir = V(), to = V();
  const seen = (obj, cam, deg = 50) => { cam.getWorldDirection(dir); cam.getWorldPosition(tmp); obj.getWorldPosition(to).sub(tmp).normalize(); return dir.dot(to) > Math.cos(THREE.MathUtils.degToRad(deg)); };
  const behind = cam => { cam.getWorldDirection(dir); cam.getWorldPosition(tmp); return tmp.clone().addScaledVector(V(dir.x, 0, dir.z).normalize(), -1.6).setY(tmp.y); };

  fx.onPage = (n, pg, tg) => { page = pg; targets = tg; once.clear(); coffinOpen = false; doorPivot.rotation.y = 0; jatte.rotation.z = 0; fx.pianoNotes = 0; };
  fx.onPianoNote = () => { fx.pianoNotes++; };

  fx.update = (dt, t, cam) => {
    for (let i = anims.length - 1; i >= 0; i--) { const a = anims[i]; a.t += dt; a.fn(Math.min(1, a.t / a.dur)); if (a.t >= a.dur) { anims.splice(i, 1); a.done?.(); } }
    const head = cam.getWorldPosition(V());
    // 幻燈機：近づくと映写機の音
    if (head.distanceTo(lantern.getWorldPosition(tmp)) < 0.9 && !once.has('proj') ) { once.add('proj'); game.sfx.projector(lantern.getWorldPosition(V())); }
    lanternLight.intensity = 0.3 + Math.sin(t * 17) * 0.05 + Math.random() * 0.05;
    // 列車
    if (trainRun > 0) { trainRun -= dt; trainA += dt * 2.2; placeCars(); }
    if (ghostT >= 0) { ghostT += dt; const k = ghostT / 3.2; ghost.position.set(lerp(3.6, -3.6, k), 0.7, 0.2); ghostM.opacity = Math.sin(Math.min(1, k) * Math.PI) * 0.75;
      if (k >= 1) { ghostT = -1; ghost.visible = false; } }
    fx.wind = Math.max(0, fx.wind - dt * 0.18);
    // 星月夜の渦
    if (swirlT >= 0) { swirlT += dt; const p = swirlG.attributes.position, from = starry.getWorldPosition(tmp).clone();
      const travel = clamp01(swirlT / 3), hold = swirlT > 3 && swirlT < 7.5;
      for (let i = 0; i < swirlN; i++) { const [s, a0, r] = swirlSeed[i], k = clamp01(travel * 1.15 - s * 0.15);
        const c = V().lerpVectors(from, swirlTo, smooth(k)); c.y += Math.sin(k * Math.PI) * 0.8; const a = a0 + t * (2 + s * 2), rr = r * (hold ? 1 : 0.6 + k);
        p.setXYZ(i, c.x + Math.cos(a) * rr, c.y + Math.sin(a * 1.3) * rr * 0.6, c.z + Math.sin(a) * rr); }
      p.needsUpdate = true; swirlM.opacity = swirlT < 0.5 ? swirlT * 2 : swirlT > 7 ? Math.max(0, 1 - (swirlT - 7)) : 1;
      swirlLight.position.copy(swirlTo); swirlLight.intensity = hold ? 2.5 : 0;
      if (swirlT > 8) { swirlT = -1; swirl.visible = false; swirlLight.intensity = 0; } }
    // めくり本と波しぶき
    if (flipT >= 0) { flipT += dt; leaves.forEach((pv, i) => { pv.rotation.z = Math.PI * clamp01((flipT - i * 0.1) / 0.25) * (Math.floor(flipT * 3 + i) % 2 ? 1 : 0.98); });
      if (flipT > 0.9 && !spray.visible) { spray.visible = true; const o = fbook.getWorldPosition(V()); for (let i = 0; i < sprayN; i++) sprayP.set([o.x, o.y + 0.05, o.z], i * 3); }
      if (spray.visible) { const p = sprayG.attributes.position, st = flipT - 0.9;
        for (let i = 0; i < sprayN; i++) { const o = fbook.getWorldPosition(tmp), v = sprayV[i]; p.setXYZ(i, o.x + v.x * st, o.y + v.y * st - 2.4 * st * st, o.z + v.z * st); }
        p.needsUpdate = true; sprayM.opacity = Math.max(0, 0.9 - st * 0.6); }
      if (flipT > 3) { flipT = -1; spray.visible = false; leaves.forEach(pv => pv.rotation.z = 0); } }
    // ノスフェラトゥ：真夜中に、高く飛んだ時（毎秒10%）か、ピアノを3回以上弾いた後の振り返りで、1ページ1回
    if (page?.act === 2 && !once.has('claw') && clawT < 0) {
      const trigger = (head.y > 4 && Math.random() < dt * 0.1) || (fx.pianoNotes >= 3 && !seen(claw, cam, 70) && Math.random() < dt * 0.5);
      if (trigger) { once.add('claw'); clawT = 0; claw.visible = true; clawSeenFade = 1; game.sfx.steps(behind(cam), 4); setTimeout(() => game.sfx.creak(behind(cam)), 1600); }
    }
    if (clawT >= 0) { clawT += dt; claw.position.y = 0.6 + clawT * 0.55; claw.scale.y = 1 + clawT * 0.15;
      if (seen(claw, cam, 35)) clawSeenFade = Math.max(0, clawSeenFade - dt * 1.6);   // 見られたら、消えかける
      clawM.opacity = Math.min(1, clawT * 0.6) * 0.6 * clawSeenFade;
      if (clawT > 5.5 || clawSeenFade <= 0) { clawT = -1; claw.visible = false; dimLamp(); } }
    // 背後の物音 → 振り向くとランプが1秒暗くなる／スーラの絵が少し傾いている
    cam.getWorldDirection(dir); const yaw = Math.atan2(dir.x, dir.z);
    idle = Math.abs(yaw - lastYaw) < 0.02 ? idle + dt : 0; lastYaw = yaw;
    if (idle > 25 && behindT < 0 && !once.has('behind')) { once.add('behind'); behindT = 0; behindPos = behind(cam); game.sfx.creak(behindPos); }
    if (behindT >= 0) { behindT += dt; cam.getWorldPosition(tmp); const toB = behindPos.clone().sub(tmp).normalize();
      if (dir.dot(toB) > 0.6) { dimLamp(); behindT = -1; } else if (behindT > 8) behindT = -1; }
    if (!seen(jatte, cam, 60) && page && !once.has('tilt') && Math.random() < dt * 0.02) { once.add('tilt'); jatte.rotation.z = 0.06; game.sfx.click(jatte.getWorldPosition(V())); }
  };
  return fx;
}
function pool(pools, name, fn) { (pools[name] ||= []).push(fn); }
