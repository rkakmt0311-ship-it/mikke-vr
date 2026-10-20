// 絵本の部屋（タイトル／ステージ選択）
import * as THREE from 'three';
import { V, FONT, makeRng, canvasTex, woodTex, mesh, setShadow, scatter, noRay } from '../util.js';
import { Panel, paper, fmtTime, textSprite } from '../ui3d.js';
import { tex } from '../assets.js';

export const BOOKS = [
  { id: 'toyroom', title: 'やねうらの へや', color: '#c0392b', accent: '#ffd27a', ready: true },
  { id: 'sea', title: 'うみの なか', color: '#1f6f8b', accent: '#bdf0ff', ready: false },
  { id: 'mansion', title: 'ようかんの しょさい', color: '#3d2b56', accent: '#e8d29a', ready: false },
];

function coverTex(b) {
  return canvasTex(420, 560, (c, w, h) => {
    c.fillStyle = b.color; c.fillRect(0, 0, w, h);
    c.strokeStyle = b.accent; c.lineWidth = 10; c.strokeRect(22, 22, w - 44, h - 44);
    c.lineWidth = 3; c.strokeRect(38, 38, w - 76, h - 76);
    // かんたんな絵
    c.globalAlpha = 0.9;
    if (b.id === 'toyroom') {
      ['#ffd27a', '#7ec8e3', '#f4a6c1', '#b5e48c', '#fff'].forEach((col, i) => { c.fillStyle = col; c.beginPath(); c.arc(110 + i * 50, 330 + (i % 2) * 30, 34, 0, 7); c.fill(); });
      c.fillStyle = '#ffe9b0'; c.fillRect(150, 200, 70, 70); c.fillStyle = '#7ec8e3'; c.fillRect(230, 230, 60, 60);
    } else if (b.id === 'sea') {
      c.fillStyle = '#bdf0ff'; for (let i = 0; i < 12; i++) { c.beginPath(); c.arc(80 + (i * 37) % 260, 200 + (i * 53) % 200, 6 + i % 4 * 3, 0, 7); c.fill(); }
      c.fillStyle = '#ffb703'; c.beginPath(); c.ellipse(210, 330, 70, 34, 0, 0, 7); c.fill();
    } else {
      c.fillStyle = '#e8d29a'; c.beginPath(); c.arc(300, 170, 40, 0, 7); c.fill();
      c.fillStyle = '#1a1226'; c.fillRect(90, 260, 240, 200); c.fillStyle = '#ffcf70'; c.fillRect(150, 320, 30, 40); c.fillRect(240, 320, 30, 40);
    }
    c.globalAlpha = 1;
    c.fillStyle = b.accent; c.font = `bold 46px ${FONT}`; c.textAlign = 'center';
    c.fillText('ミッケ！', w / 2, 110); c.font = `bold 36px ${FONT}`; c.fillText(b.title, w / 2, 490);
    if (!b.ready) { c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = `bold 32px ${FONT}`; c.fillText('じゅんびちゅう', w / 2, h / 2); }
  });
}

// Geminiの表紙絵の上に、タイトルの帯を重ねる
function coverOver(img, b) {
  const cv = document.createElement('canvas'); cv.width = 420; cv.height = 560; const c = cv.getContext('2d');
  c.drawImage(img, 0, 0, 420, 560);
  c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(0, 440, 420, 80);
  c.fillStyle = b.accent; c.font = `bold 36px ${FONT}`; c.textAlign = 'center'; c.fillText(b.title, 210, 492);
  if (!b.ready) { c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(0, 0, 420, 560); c.fillStyle = '#fff'; c.font = `bold 32px ${FONT}`; c.fillText('じゅんびちゅう', 210, 280); }
  return cv;
}

export function createHub(game) {
  const rng = makeRng(5);
  const root = new THREE.Group();
  const SM = (color, r = 0.7, m = 0, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: r, metalness: m, ...o });
  const W = 6, D = 5, H = 3.4;

  // 部屋
  const floor = mesh(new THREE.PlaneGeometry(W, D), SM('#fff', 0.55, 0, { map: tex('hub_floor', woodTex(rng, 24, 20, [2, 2])) }), V(0, 0, 0), root, { cast: false });
  floor.rotation.x = -Math.PI / 2;
  const wallTex = canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#2a2233'; c.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 32) { c.fillStyle = '#30283b'; c.fillRect(x, 0, 12, h); }
    c.fillStyle = 'rgba(230,200,120,.08)'; for (let y = 20; y < h; y += 64) for (let x = 24; x < w; x += 64) { c.beginPath(); c.arc(x, y, 7, 0, 7); c.fill(); } }, [3, 2]);
  tex('hub_wall', wallTex);
  const wm = SM('#fff', 0.95, 0, { map: wallTex });
  [[V(0, H / 2, -D / 2), 0], [V(-W / 2, H / 2, 0), Math.PI / 2], [V(W / 2, H / 2, 0), -Math.PI / 2], [V(0, H / 2, D / 2), Math.PI]].forEach(([p, ry]) => {
    const m = mesh(new THREE.PlaneGeometry(ry % Math.PI ? D : W, H), wm, p, root, { cast: false }); m.rotation.y = ry; });
  const ceil = mesh(new THREE.PlaneGeometry(W, D), SM('#120e16', 1), V(0, H, 0), root, { cast: false }); ceil.rotation.x = Math.PI / 2;

  // 月明かりの窓
  const win = mesh(new THREE.PlaneGeometry(1.1, 1.6), new THREE.MeshBasicMaterial({ color: '#9fb4ea' }), V(-W / 2 + 0.01, 1.9, -0.6), root, { cast: false }); win.rotation.y = Math.PI / 2;
  const moon = new THREE.DirectionalLight('#8fa2dd', 0.9); moon.position.set(-6, 5, 0.5); moon.target.position.set(0, 0, 0); setShadow(moon, 4, 1024);
  root.add(moon, moon.target);
  root.add(new THREE.HemisphereLight('#5a5a88', '#20140c', 0.5));

  // 本棚
  const shelfM = SM('#3b2414', 0.6);
  mesh(new THREE.BoxGeometry(5, 3, 0.4), shelfM, V(0, 1.5, -D / 2 + 0.2), root);
  const books = [];
  for (let r = 0; r < 5; r++) { let x = -2.35; while (x < 2.3) { const t = rng.range(0.05, 0.11), h = rng.range(0.35, 0.5);
    books.push([x + t / 2, 0.1 + r * 0.58 + h / 2, t, h]); x += t + 0.004; } }
  const bm = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), SM('#fff', 0.75), books.length), d = new THREE.Object3D(), col = new THREE.Color();
  books.forEach(([x, y, t, h], i) => { d.position.set(x, y, -D / 2 + 0.43); d.scale.set(t, h, 0.3); d.updateMatrix(); bm.setMatrixAt(i, d.matrix);
    bm.setColorAt(i, col.set(rng.pick(['#5a1a1a', '#1e3d2f', '#2b2f4a', '#6b4f2a', '#4a1f3a', '#7a6a4a']))); });
  bm.castShadow = bm.receiveShadow = true; root.add(bm);

  // 机
  const desk = new THREE.Group(); desk.position.set(0, 0, -0.3); root.add(desk);
  const deskM = SM('#4a2c18', 0.4);
  mesh(new THREE.BoxGeometry(2.4, 0.08, 1), deskM, V(0, 0.78, 0), desk);
  [[-1.1, -0.42], [1.1, -0.42], [-1.1, 0.42], [1.1, 0.42]].forEach(([x, z]) => mesh(new THREE.BoxGeometry(0.08, 0.78, 0.08), deskM, V(x, 0.39, z), desk));

  // ロウソク
  const flames = [];
  [-0.95, 0.95].forEach((x, i) => {
    mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.22, 14), SM('#efe6d0', 0.9), V(x, 0.93, -0.2), desk);
    const f = noRay(mesh(new THREE.SphereGeometry(0.022, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffcf70' }), V(x, 1.08, -0.2), desk, { cast: false }));
    f.scale.y = 2;
    const L = new THREE.PointLight('#ff9a3c', 2.6, 0, 2); L.position.set(x, 1.15, -0.2); desk.add(L);
    if (i === 0) { L.castShadow = true; L.shadow.mapSize.set(512, 512); L.shadow.bias = -0.002; }
    flames.push({ L, f, ph: i * 2 });
  });

  // 3冊の絵本
  const bookObjs = BOOKS.map((b, i) => {
    const g = new THREE.Group(); g.position.set((i - 1) * 0.62, 1.1, -0.15); desk.add(g);
    const side = SM('#f3ead2', 0.8), spine = SM(b.color, 0.5);
    const mats = [side, spine, side, side, SM('#fff', 0.5, 0, { map: tex(`hub_cover_${b.id}`, coverTex(b), img => coverOver(img, b)) }), spine];
    const m = mesh(new THREE.BoxGeometry(0.42, 0.56, 0.07), mats, V(0, 0, 0), g); m.rotation.x = -0.12;
    m.userData.interact = { kind: 'ui', dwell: 1.2, fn: () => game.openBook(b) };
    return { g, m, b, ph: i };
  });

  // タイトル
  const title = textSprite('ミッケ！の せかいへ', { size: 0.22, stroke: '#7a3b00' }); title.position.set(0, 1.95, -0.6); root.add(title);
  const sub = textSprite('えほんを えらんで ひらいてね', { size: 0.09, stroke: '#3a2410', font: 80 }); sub.position.set(0, 1.72, -0.6); root.add(sub);

  // ただよう埃（光の粒）
  const N = 160, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { pos[i * 3] = rng.range(-2.8, 2.8); pos[i * 3 + 1] = rng.range(0.2, 3); pos[i * 3 + 2] = rng.range(-2.3, 2.3); }
  const dustG = new THREE.BufferGeometry(); dustG.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  root.add(noRay(new THREE.Points(dustG, new THREE.PointsMaterial({ color: '#ffe6b0', size: 0.012, transparent: true, opacity: 0.6, depthWrite: false }))));

  // ページ選択カード
  let cards = null;
  function showPages(b, records) {
    if (cards) { root.remove(cards); cards = null; }
    cards = new THREE.Group(); cards.position.set(0, 1.62, 0.1); title.visible = sub.visible = false; root.add(cards);
    for (let p = 0; p < 3; p++) {
      const rec = records[`${b.id}-${p + 1}`];
      const panel = new Panel(0.36, 0.26, 700).draw((c, w, h) => {
        paper(c, w, h, 0.96);
        c.fillStyle = '#5a3a1a'; c.textAlign = 'center'; c.font = `bold ${h * 0.2}px ${FONT}`; c.fillText(`ページ ${p + 1}`, w / 2, h * 0.3);
        c.font = `${h * 0.12}px ${FONT}`;
        if (rec) { c.fillStyle = '#c0392b'; c.fillText(`クリア　${fmtTime(rec.best)}`, w / 2, h * 0.55); c.fillStyle = '#8a6a4a';
          c.fillText(`ヒント ${rec.hints}　${rec.secret ? '★ ひみつ はっけん' : '★ ？？？'}`, w / 2, h * 0.75); }
        else { c.fillStyle = '#8a6a4a'; c.fillText('まだ ひらいていない', w / 2, h * 0.6); }
      });
      panel.mesh.material.depthTest = true; panel.mesh.renderOrder = 0;
      panel.mesh.position.set((p - 1) * 0.4, 0, 0);
      panel.mesh.userData.interact = { kind: 'ui', dwell: 1.0, fn: () => game.startPage(b.id, p) };
      cards.add(panel.mesh);
    }
  }

  const bounds = new THREE.Box3(V(-W / 2, 0, -D / 2), V(W / 2, H, D / 2));
  const colliders = [new THREE.Box3(V(-1.25, 0, -0.85), V(1.25, 0.85, 0.25)), new THREE.Box3(V(-2.5, 0, -2.5), V(2.5, 3, -2.1))];

  return {
    id: 'hub', root, bounds, colliders, spawn: { pos: V(0, 0, 1.5), yaw: 0 }, bgm: 'hub',
    ambience: { roomTone: 0.02, lowpass: 250 },
    showPages,
    enter(scene, renderer) {
      scene.background = new THREE.Color('#0c0910'); scene.fog = new THREE.Fog('#0c0910', 4, 12);
      scene.environment = game.envTex; scene.environmentIntensity = 0.12;
      renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.3;
    },
    update(dt, t) {
      flames.forEach(f => { const k = 0.85 + Math.sin(t * 12 + f.ph) * 0.08 + (Math.random() - 0.5) * 0.08; f.L.intensity = 2.6 * k; f.f.scale.y = 2 * k; });
      bookObjs.forEach(o => { o.g.position.y = 1.1 + Math.sin(t * 1.2 + o.ph) * 0.01; });
      const p = dustG.attributes.position;
      for (let i = 0; i < N; i++) { p.setY(i, p.getY(i) + Math.sin(t * 0.3 + i) * 0.0006); p.setX(i, p.getX(i) + Math.cos(t * 0.2 + i * 1.7) * 0.0005); }
      p.needsUpdate = true;
      if (Math.floor(t) !== Math.floor(t - dt)) game.sfx.tick(V(2.5, 2, -2), Math.floor(t) % 2);
    },
  };
}
