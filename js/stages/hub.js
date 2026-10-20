// 絵本の部屋（タイトル／もくじ）
// 宙に浮く本ではなく、真鍮の書見台に置いた重い革装丁の絵本。留め金を外して表紙をひらくと「もくじ」のページ。
import * as THREE from 'three';
import { V, FONT, INK, PAPER, SEAL, BRASS, makeRng, canvasTex, woodTex, mesh, setShadow, noRay, addDust, smooth } from '../util.js';
import { Panel, paper, fmtTime } from '../ui3d.js';
import { tex } from '../assets.js';

export const BOOKS = [
  { id: 'toyroom', title: 'やねうらの へや', ready: true, color: '#5a1212',
    acts: ['第一の幕　西日の さす ころ', '第二の幕　ランプが ともる ころ', '第三の幕　月かげの ざわめく ころ'] },
  { id: 'sea', title: 'うみの なか', ready: false, color: '#1d3a46' },
  { id: 'mansion', title: 'ようかんの しょさい', ready: false, color: '#2e2238' },
];

const ink = (c, text, x, y, size, color = INK, weight = 600, spacing = 0.2) => {
  c.font = `${weight} ${size}px ${FONT}`; c.fillStyle = color; if ('letterSpacing' in c) c.letterSpacing = `${spacing}em`;
  c.shadowColor = 'rgba(35,27,20,.35)'; c.shadowBlur = size * 0.05; c.fillText(text, x, y); c.shadowBlur = 0; if ('letterSpacing' in c) c.letterSpacing = '0px';
};
// 革の表紙：くすんだ深紅の革、すり切れ、金箔押しの題字
function leatherCover(b, w = 520, h = 680) {
  return canvasTex(w, h, (c) => {
    c.fillStyle = b.color; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) { c.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,220,180'},${Math.random() * 0.06})`; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    const edge = c.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.85); edge.addColorStop(0, 'rgba(0,0,0,0)'); edge.addColorStop(1, 'rgba(20,8,4,.55)'); c.fillStyle = edge; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(197,155,39,.75)'; c.lineWidth = 3; c.strokeRect(28, 28, w - 56, h - 56); c.lineWidth = 1; c.strokeRect(38, 38, w - 76, h - 76);
    c.textAlign = 'center'; const gold = c.createLinearGradient(0, 160, 0, 300); gold.addColorStop(0, '#f3dc96'); gold.addColorStop(0.5, BRASS); gold.addColorStop(1, '#7a5a1a');
    c.font = `800 74px ${FONT}`; c.fillStyle = gold; if ('letterSpacing' in c) c.letterSpacing = '0.3em';
    c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 3; c.fillText('ミッケ！', w / 2 + 12, 230);
    c.font = `600 34px ${FONT}`; c.fillText('の せかいへ', w / 2 + 8, 290); c.shadowBlur = 0;
    c.font = `500 20px ${FONT}`; c.fillStyle = 'rgba(232,210,150,.8)'; if ('letterSpacing' in c) c.letterSpacing = '0.25em'; c.fillText('― 眠らないおもちゃと、影の絵本 ―', w / 2, 350);
    c.beginPath(); c.arc(w / 2, 470, 46, 0, Math.PI * 2); c.strokeStyle = 'rgba(197,155,39,.6)'; c.lineWidth = 2; c.stroke();
    c.beginPath(); c.arc(w / 2 + 14, 462, 40, 0, Math.PI * 2); c.fillStyle = b.color; c.fill();   // 三日月
    c.font = `500 22px ${FONT}`; c.fillStyle = 'rgba(232,210,150,.75)'; c.fillText(b.title, w / 2, h - 70);
  });
}

export function createHub(game) {
  const rng = makeRng(5);
  const root = new THREE.Group();
  const SM = (color, r = 0.7, m = 0, o = {}) => addDust(new THREE.MeshStandardMaterial({ color, roughness: r, metalness: m, ...o }));
  const W = 6, D = 5, H = 3.4;

  // ---------- 部屋 ----------
  const floor = mesh(new THREE.PlaneGeometry(W, D), SM('#fff', 0.55, 0, { map: tex('hub_floor', woodTex(rng, 24, 20, [2, 2])) }), V(0, 0, 0), root, { cast: false });
  floor.rotation.x = -Math.PI / 2;
  const wallTex = canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#2a2420'; c.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 32) { c.fillStyle = '#302822'; c.fillRect(x, 0, 12, h); }
    c.fillStyle = 'rgba(230,200,120,.07)'; for (let y = 20; y < h; y += 64) for (let x = 24; x < w; x += 64) { c.beginPath(); c.arc(x, y, 7, 0, 7); c.fill(); } }, [3, 2]);
  tex('hub_wall', wallTex);
  const wm = SM('#fff', 0.95, 0, { map: wallTex });
  [[V(0, H / 2, -D / 2), 0], [V(-W / 2, H / 2, 0), Math.PI / 2], [V(W / 2, H / 2, 0), -Math.PI / 2], [V(0, H / 2, D / 2), Math.PI]].forEach(([p, ry]) => {
    const m = mesh(new THREE.PlaneGeometry(ry % Math.PI ? D : W, H), wm, p, root, { cast: false }); m.rotation.y = ry; });
  const ceil = mesh(new THREE.PlaneGeometry(W, D), SM('#120e0c', 1), V(0, H, 0), root, { cast: false }); ceil.rotation.x = Math.PI / 2;
  // 月明かりの窓（ろうそくが灯るまでは、これだけ）
  const win = mesh(new THREE.PlaneGeometry(1.1, 1.6), new THREE.MeshBasicMaterial({ color: '#5a6a92' }), V(-W / 2 + 0.01, 1.9, -0.6), root, { cast: false }); win.rotation.y = Math.PI / 2;
  const moon = new THREE.DirectionalLight('#8fa2dd', 0.35); moon.position.set(-6, 5, 0.5); moon.target.position.set(0, 0, 0); setShadow(moon, 4, 1024);
  root.add(moon, moon.target);
  const hemi = new THREE.HemisphereLight('#4a4a68', '#20140c', 0.12); root.add(hemi);

  // 本棚
  const shelfM = SM('#3b2414', 0.6);
  mesh(new THREE.BoxGeometry(5, 3, 0.4), shelfM, V(0, 1.5, -D / 2 + 0.2), root);
  const books = [];
  for (let r = 0; r < 5; r++) { let x = -2.35; while (x < 2.3) { const t = rng.range(0.04, 0.1), h = rng.range(0.3, 0.5);
    books.push([x + t / 2, 0.1 + r * 0.58 + h / 2, t, h, rng() < 0.08 ? rng.range(-0.2, 0.2) : 0]); x += t + 0.004; } }
  const bm = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), SM('#fff', 0.8), books.length), d = new THREE.Object3D(), col = new THREE.Color();
  books.forEach(([x, y, t, h, lean], i) => { d.position.set(x, y, -D / 2 + 0.43); d.rotation.set(0, 0, lean); d.scale.set(t, h, 0.3); d.updateMatrix(); bm.setMatrixAt(i, d.matrix);
    bm.setColorAt(i, col.set(rng.pick(['#4a1a14', '#1e3329', '#262a3a', '#5b452a', '#3a1f30', '#6a5a40'])).offsetHSL(0, -0.1, rng.range(-0.05, 0.03))); });
  bm.castShadow = bm.receiveShadow = true; root.add(bm);
  // 蜘蛛の巣（右上の隅）
  const web = canvasTex(256, 256, (c, w, h) => { c.clearRect(0, 0, w, h); c.strokeStyle = 'rgba(230,230,220,.45)'; c.lineWidth = 1;
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI / 2; c.beginPath(); c.moveTo(w, 0); c.lineTo(w - Math.cos(a) * w, Math.sin(a) * h); c.stroke(); }
    for (let r = 18; r < w; r += 20) { c.beginPath(); c.arc(w, 0, r, Math.PI / 2, Math.PI); c.stroke(); } });
  noRay(mesh(new THREE.PlaneGeometry(0.8, 0.8), new THREE.MeshBasicMaterial({ map: web, transparent: true, depthWrite: false, side: THREE.DoubleSide }), V(W / 2 - 0.42, H - 0.42, -D / 2 + 0.41), root, { cast: false }));

  // 机（奥）
  const desk = new THREE.Group(); desk.position.set(0, 0, -1.2); root.add(desk);
  const deskM = SM('#4a2c18', 0.45);
  mesh(new THREE.BoxGeometry(2.2, 0.08, 0.9), deskM, V(0, 0.78, 0), desk);
  [[-1, -0.38], [1, -0.38], [-1, 0.38], [1, 0.38]].forEach(([x, z]) => mesh(new THREE.BoxGeometry(0.08, 0.78, 0.08), deskM, V(x, 0.39, z), desk));
  // 机の上：まだひらけない絵本（ほこりをかぶって積まれている）
  const later = BOOKS.filter(b => !b.ready).map((b, i) => {
    const g = new THREE.Group(); g.position.set(0.55 + i * 0.05, 0.82 + i * 0.075, -0.05 + i * 0.03); g.rotation.y = 0.3 - i * 0.25; desk.add(g);
    const m = mesh(new THREE.BoxGeometry(0.42, 0.07, 0.56), [SM('#e3d8bc', 0.9), SM('#e3d8bc', 0.9), SM('#fff', 0.85, 0, { map: leatherCover(b) }), SM(b.color, 0.9), SM('#e3d8bc', 0.9), SM(b.color, 0.9)], V(0, 0.035, 0), g);
    m.userData.interact = { kind: 'ui', dwell: 1.2, fn: () => game.openBook(b) };
    return g;
  });

  // ---------- ろうそく（火が灯ると部屋が浮かび上がる） ----------
  const flames = [];
  const candle = (pos, h, power, parent = root) => {
    const g = new THREE.Group(); g.position.copy(pos); parent.add(g);
    mesh(new THREE.CylinderGeometry(0.03, 0.035, h, 14), SM('#efe6d0', 0.9), V(0, h / 2, 0), g);
    mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.02, 18), SM('#8a6a2a', 0.3, 0.9), V(0, 0.01, 0), g);
    const f = noRay(mesh(new THREE.SphereGeometry(0.018, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffcf70' }), V(0, h + 0.03, 0), g, { cast: false }));
    f.scale.y = 2.2; f.visible = false;
    const L = new THREE.PointLight('#ff9a3c', 0, 0, 2); L.position.set(0, h + 0.07, 0); g.add(L);
    flames.push({ L, f, power, ph: Math.random() * 6, lit: 0 }); return g;
  };
  candle(V(0.42, 0, 0.12), 0.25, 1.4, desk);
  candle(V(-0.7, 0, 0.0), 0.32, 1.6, desk);

  // ---------- 真鍮の書見台と、重い革装丁の絵本 ----------
  const lect = new THREE.Group(); lect.position.set(0, 0, 0.05); root.add(lect);
  const brass = SM('#8a6a2a', 0.32, 0.9);
  mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.05, 28), brass, V(0, 0.025, 0), lect);
  mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.9, 16), brass, V(0, 0.48, 0), lect);
  const top = new THREE.Group(); top.position.set(0, 0.95, 0); top.rotation.x = 0.45; lect.add(top);   // 手前に傾いた天板
  mesh(new THREE.BoxGeometry(0.8, 0.02, 0.58), SM('#3a2414', 0.5), V(0, 0, 0), top);
  mesh(new THREE.BoxGeometry(0.8, 0.05, 0.02), brass, V(0, 0.025, 0.29), top);   // 本を受ける縁
  candle(V(0.48, 0.95, 0.15), 0.18, 1.2, lect);

  const book = new THREE.Group(); book.position.set(0, 0.012, -0.005); top.add(book);
  const BW = 0.34, BD = 0.5, BT = 0.07;   // 片側の幅・奥行き・厚み
  const pagesM = SM('#e9dfc4', 0.95);
  mesh(new THREE.BoxGeometry(BW, BT, BD), [pagesM, pagesM, SM('#e2d6b8', 0.95), pagesM, pagesM, pagesM], V(BW / 2, BT / 2, 0), book);   // 右側の紙の束
  // もくじのページ（右側の上面）
  const toc = new Panel(BW * 0.96, BD * 0.96, 1400); noRay(toc.mesh); toc.mesh.material.depthTest = true; toc.mesh.renderOrder = 0;
  toc.mesh.rotation.x = -Math.PI / 2; toc.mesh.position.set(BW / 2, BT + 0.0015, 0); book.add(toc.mesh);
  // 左側のページ（表紙の裏）：挿絵
  const coverPivot = new THREE.Group(); coverPivot.position.set(0, BT + 0.004, 0); book.add(coverPivot);
  const coverM = SM('#fff', 0.8, 0, { map: leatherCover(BOOKS[0]) });
  const cover = mesh(new THREE.BoxGeometry(BW + 0.012, 0.008, BD + 0.012), [SM(BOOKS[0].color, 0.8), SM(BOOKS[0].color, 0.8), coverM, SM('#e6dcc0', 0.95), SM(BOOKS[0].color, 0.8), SM(BOOKS[0].color, 0.8)], V(BW / 2, 0, 0), coverPivot);
  const plate = canvasTex(400, 600, (c, w, h) => { c.fillStyle = PAPER; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 5000; i++) { c.fillStyle = `rgba(60,40,20,${Math.random() * 0.06})`; c.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5); }
    c.strokeStyle = INK; c.lineWidth = 1.2;   // 銅版画風の線画：屋根裏の三角屋根と丸窓
    c.beginPath(); c.moveTo(60, 420); c.lineTo(200, 160); c.lineTo(340, 420); c.closePath(); c.stroke();
    for (let i = 0; i < 30; i++) { c.beginPath(); c.moveTo(70 + i * 9, 420); c.lineTo(200 - (i % 2) * 2, 170 + i * 1.5); c.globalAlpha = 0.25; c.stroke(); } c.globalAlpha = 1;
    c.beginPath(); c.arc(200, 300, 36, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.moveTo(164, 300); c.lineTo(236, 300); c.moveTo(200, 264); c.lineTo(200, 336); c.stroke();
    c.textAlign = 'center'; ink(c, '第一の 絵本', w / 2, 500, 26, INK, 600); ink(c, 'やねうらの へや', w / 2, 540, 20, SEAL, 600); });
  const leftPage = mesh(new THREE.PlaneGeometry(BW * 0.94, BD * 0.94), SM('#fff', 0.95, 0, { map: plate }), V(BW / 2, -0.0045, 0), coverPivot, { cast: false });
  leftPage.rotation.x = Math.PI / 2; leftPage.rotation.z = Math.PI;
  // 留め金
  const clasp = mesh(new THREE.BoxGeometry(0.03, 0.012, 0.06), brass, V(BW + 0.006, 0.002, 0), coverPivot);
  const spine = mesh(new THREE.CylinderGeometry(BT * 0.6, BT * 0.6, BD + 0.012, 16, 1, false, Math.PI, Math.PI), SM(BOOKS[0].color, 0.8), V(0, BT / 2, 0), book); spine.rotation.x = Math.PI / 2;

  let open = 0, opening = false, records = {};
  const actRects = [];
  function drawToc() {
    actRects.length = 0;
    toc.draw((c, w, h) => {
      paper(c, w, h, 1);
      c.textBaseline = 'alphabetic'; c.textAlign = 'left';
      ink(c, 'も く じ', w * 0.12, h * 0.13, w * 0.075, SEAL, 700, 0.35);
      c.strokeStyle = 'rgba(35,27,20,.5)'; c.lineWidth = 1; c.beginPath(); c.moveTo(w * 0.12, h * 0.16); c.lineTo(w * 0.88, h * 0.165); c.stroke();
      BOOKS[0].acts.forEach((a, i) => {
        const y = h * (0.3 + i * 0.19), rec = records[`toyroom-${i + 1}`];
        ink(c, a.split('　')[0], w * 0.12, y, w * 0.045, 'rgba(35,27,20,.7)', 600, 0.25);
        ink(c, a.split('　')[1], w * 0.12, y + h * 0.065, w * 0.062, INK, 700, 0.15);
        if (rec) { // 済みの朱印
          c.save(); c.translate(w * 0.8, y + h * 0.02); c.rotate(-0.15); c.strokeStyle = SEAL; c.lineWidth = 3; c.strokeRect(-w * 0.07, -w * 0.07, w * 0.14, w * 0.14);
          c.textAlign = 'center'; ink(c, '済', 0, w * 0.035, w * 0.09, SEAL, 800, 0); c.restore();
          c.textAlign = 'left'; ink(c, `${fmtTime(rec.best)}${rec.secret ? '　ひみつ ✓' : ''}`, w * 0.12, y + h * 0.11, w * 0.036, 'rgba(35,27,20,.55)', 500, 0.1);
        }
        actRects.push({ i, y0: (y - h * 0.06) / h, y1: (y + h * 0.12) / h });
      });
      ink(c, '― ページを えらんでね ―', w * 0.2, h * 0.92, w * 0.04, 'rgba(35,27,20,.55)', 500, 0.2);
    });
  }
  // もくじの行を押せるようにする（ページの上に、透明な札を置く）
  const actHits = BOOKS[0].acts.map((a, i) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(BW * 0.85, BD * 0.17), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(BW / 2, BT + 0.003, -BD / 2 + BD * (0.3 + i * 0.19 + 0.02)); m.visible = false; book.add(m);
    m.userData.interact = { kind: 'ui', dwell: 1.2, fn: () => game.startPage('toyroom', i) };
    return m;
  });
  const openBook = () => {
    if (opening || open > 0) return; opening = true; game.sfx.latch(clasp.getWorldPosition(V()));
    setTimeout(() => game.sfx.book(), 250);
  };
  cover.userData.interact = { kind: 'ui', dwell: 1.2, fn: () => game.openBook(BOOKS[0]) };
  clasp.userData.interact = cover.userData.interact;

  // ほこり（光の中を漂う）
  const N = 220, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { pos[i * 3] = rng.range(-1.2, 1.2); pos[i * 3 + 1] = rng.range(0.6, 2.2); pos[i * 3 + 2] = rng.range(-1, 1); }
  const dustG = new THREE.BufferGeometry(); dustG.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dustM = new THREE.PointsMaterial({ color: '#ffe6b0', size: 0.01, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  root.add(noRay(new THREE.Points(dustG, dustM)));

  let lit = 0, litT = 0, blowT = -1;
  const bounds = new THREE.Box3(V(-W / 2, 0, -D / 2), V(W / 2, H, D / 2));
  const colliders = [new THREE.Box3(V(-1.15, 0, -1.7), V(1.15, 0.9, -0.7)), new THREE.Box3(V(-2.5, 0, -2.5), V(2.5, 3, -2.1)), new THREE.Box3(V(-0.35, 0, -0.25), V(0.35, 1.2, 0.35))];

  return {
    id: 'hub', root, bounds, colliders, spawn: { pos: V(0, 0, 1.25), yaw: 0 }, bgm: 'hub',
    ambience: { roomTone: 0.022, lowpass: 230, events: ['creak'] },
    // もくじを書き直して、本をひらく
    showPages(b, recs) { records = recs || {}; drawToc(); openBook(); },
    get isOpen() { return open >= 1; },
    // ろうそくに火をつける（タイトルの「儀式」）
    light() { lit = 1; litT = 0; flames.forEach(f => { f.f.visible = true; }); },
    blowOut() { blowT = 0; game.sfx.blowOut(); },
    enter(scene, renderer) {
      scene.background = new THREE.Color('#0d0a08'); scene.fog = new THREE.Fog('#0d0a08', 4, 11);
      scene.environment = game.envTex; scene.environmentIntensity = 0.1;
      renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.25;
      drawToc();
    },
    update(dt, t) {
      // 火が灯ると、ゆっくり部屋が浮かび上がる
      if (lit) litT = Math.min(1, litT + dt / 1.5);
      const kBlow = blowT >= 0 ? Math.max(0, 1 - (blowT += dt) / 0.4) : 1;
      flames.forEach(f => { const k = (0.85 + Math.sin(t * 11 + f.ph) * 0.07 + Math.sin(t * 23 + f.ph * 2) * 0.04 + (Math.random() - 0.5) * 0.05) * smooth(litT) * kBlow;
        f.L.intensity = f.power * k; f.f.scale.y = 2.2 * Math.max(0.2, k); f.f.visible = k > 0.02; });
      hemi.intensity = 0.12 + 0.25 * smooth(litT) * kBlow; dustM.opacity = 0.55 * smooth(litT) * kBlow;
      // 表紙：初めはゆっくり、最後は重みでぱたんと落ちる
      if (opening) { open = Math.min(1, open + dt / 1.5); coverPivot.rotation.z = Math.PI * (open < 0.7 ? smooth(open / 0.7) * 0.85 : 0.85 + 0.15 * Math.pow((open - 0.7) / 0.3, 2));
        if (open >= 1) { opening = false; actHits.forEach(m => m.visible = true); } }
      const p = dustG.attributes.position;
      for (let i = 0; i < N; i++) { p.setY(i, p.getY(i) + Math.sin(t * 0.3 + i) * 0.0004); p.setX(i, p.getX(i) + Math.cos(t * 0.2 + i * 1.7) * 0.0004); }
      p.needsUpdate = true;
      if (Math.floor(t) !== Math.floor(t - dt)) game.sfx.tick(V(2.5, 2, -2), Math.floor(t) % 2);
    },
  };
}
