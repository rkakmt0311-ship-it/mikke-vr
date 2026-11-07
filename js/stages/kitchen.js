// ステージ②：古びた台所（docs/kitchen-design.md の設計）
// 屋根裏の1ページ目と同じ、西日と影の不気味さ。広い部屋の隅まで物があふれ、食卓には誰も来ない夕ごはん。
// 奥に流し台と窓、右奥に冷蔵庫、左奥にかまど、中央に大きな作業台、左壁に食器棚、右壁にパントリー。
import * as THREE from 'three';
import { V, makeRng, canvasTex, mesh, setShadow, scatter, moundPoint, roundedBox, noRay } from '../util.js';
import { TOYS, TOY_MAP, buildToy, isUltra } from '../catalog/toys.js';
import { makeWare } from '../catalog/kitchenware.js';
import { bakeStatic, mergeStatic } from '../bake.js';
import { pbr, setPbrLite } from '../pbr.js';

const W = 4.2, D = 3.8, H = 3.6;   // x: -4.2〜4.2, z: -3.8〜3.8
const TOY_SCALE = 1.1, TARGET_SCALE = 0.8;
const TOP = 0.9;                   // 作業台・流し台の天板の高さ
const VEG = V(-2.7, 0.2, 2.5);     // 野菜箱のりんごの山の中心

const PAGES = [
  { title: '第一の幕　だれも こない 夕ごはん',
    targets: [['bread', 'toaster'], ['spoon', 'drainer'], ['tomato', 'vegBox'], ['frog', 'herbs'], ['cheese', 'fridge'], ['matchbox', 'drawer']],
    secret: ['egg_gold', 'eggCarton', 'lens'] },
  { title: '第二の幕　おきゃくさまが くる',
    targets: [['teacup', 'sinkDishes'], ['teapot', 'fridgeTopPot'], ['cookie', 'toasterFlat'], ['key_silver', 'drawer'], ['butterfly', 'webCorner'], ['mouse', 'ovenTray']],
    secret: ['button_gold', 'guestPlate', 'lens'] },
  { title: '第三の幕　まよなかの かくれんぼ',
    targets: [['anoko', 'behindBarrel'], ['bear_brown', 'cabinetShelf'], ['rabbit_white', 'underTable'], ['cat_orange', 'fridgeTop'], ['fox', 'vegBoxFox'], ['mouse', 'toasterMouse']],
    secret: ['button_star', 'sillStar', 'lens'], clearSub: '（……おはよう。あなたの ごはんが できているよ）' },
];

export function createKitchen(game) {
  const q = game.quality.clutter;
  const rng = makeRng(77);
  const root = new THREE.Group();
  const LITE = !!game.quality.lite; setPbrLite(LITE);
  const matCache = new Map();
  const P = (color, r = 0.5, m = 0, o = {}) => {
    const key = [color, r, m, ...Object.entries(o).map(([k, v]) => k + ':' + (v?.uuid ?? v))].join('|');
    if (matCache.has(key)) return matCache.get(key);
    const mat = isUltra() && !o.transparent
      ? new THREE.MeshPhysicalMaterial({ color, roughness: r, metalness: m, clearcoat: r < 0.3 ? 0.8 : 0, clearcoatRoughness: 0.08, ...o })
      : new THREE.MeshStandardMaterial({ color, roughness: r, metalness: m, ...o });
    matCache.set(key, mat); return mat;
  };
  const anims = []; const animate = (dur, fn, done) => anims.push({ t: 0, dur, fn, done });
  const colliders = [], box = (a, b, c, d, e, f) => colliders.push(new THREE.Box3(V(a, b, c), V(d, e, f)));
  const spots = {};
  const cube = (w, h, d, mat, x, y, z, parent = root, opt) => mesh(new THREE.BoxGeometry(w, h, d), mat, V(x, y, z), parent, opt);
  const cyl = (rt, rb, h, mat, x, y, z, parent = root, seg = 14) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat, V(x, y, z), parent);
  const potGeo = (r, h) => new THREE.LatheGeometry([[0, 0], [r * 0.92, 0], [r, h * 0.12], [r, h], [r * 0.95, h]].map(([x, y]) => new THREE.Vector2(x, y)), 20);

  // 材質：くすんで、汚れている
  const paintM = pbr('planks', { color: '#7f8a72', tile: 1.3, normal: 1.2 }), paintDarkM = pbr('planks', { color: '#5b6653', tile: 1.1, normal: 1.2 });
  const woodTop = pbr('table', { color: '#a58a6e', tile: 0.9 }), darkWood = pbr('darkwood', { color: '#7a5e4a', tile: 0.9, rough: 1 });
  const rustM = pbr('rust', { color: '#b09a84', tile: 0.8 });
  const brassM = P('#7a5f2c', 0.45, 1), oldChromeM = P('#8c8778', 0.42, 1), blackM = P('#1d1b1a', 0.5), copperM = P('#7a5636', 0.42, 1, { side: THREE.DoubleSide }), clayM = P('#6e4032', 0.9);

  // =================================================================
  // 部屋：しみの浮いた壁、ひびの入った汚れたタイル、すすけた天井と梁
  // =================================================================
  const floor = mesh(new THREE.PlaneGeometry(W * 2, D * 2), pbr('floor', { color: '#b09c86', tile: 2.4, normal: 1.3 }), V(0, 0, 0), root, { cast: false }); floor.rotation.x = -Math.PI / 2;
  const wallM = pbr('plaster', { color: '#b8a88e', tile: 2.2, normal: 1.5, side: THREE.DoubleSide });
  const WIN = { x0: -1.1, x1: 1.1, y0: 1.35, y1: 2.6 };
  const back = new THREE.Shape(); back.moveTo(-W, 0); back.lineTo(W, 0); back.lineTo(W, H); back.lineTo(-W, H); back.closePath();
  const hole = new THREE.Path(); hole.moveTo(WIN.x0, WIN.y0); hole.lineTo(WIN.x0, WIN.y1); hole.lineTo(WIN.x1, WIN.y1); hole.lineTo(WIN.x1, WIN.y0); hole.closePath(); back.holes.push(hole);
  mesh(new THREE.ShapeGeometry(back), wallM, V(0, 0, -D), root, { cast: true });
  [[-W, Math.PI / 2], [W, -Math.PI / 2]].forEach(([x, ry]) => { mesh(new THREE.PlaneGeometry(D * 2, H), wallM, V(x, H / 2, 0), root, { cast: false }).rotation.y = ry; });
  mesh(new THREE.PlaneGeometry(W * 2, H), wallM, V(0, H / 2, D), root, { cast: false }).rotation.y = Math.PI;
  mesh(new THREE.PlaneGeometry(W * 2, D * 2), pbr('roof', { color: '#6a5442', tile: 1.8 }), V(0, H, 0), root, { cast: false }).rotation.x = Math.PI / 2;
  for (let z = -D + 0.4; z < D; z += 0.95) cube(W * 2, 0.2, 0.16, darkWood, 0, H - 0.1, z);
  // 腰のタイル：黄ばみ、ひび、欠け、流れたしみ
  const tileTex = (repX) => canvasTex(512, 512, (c, w, h) => { const r = makeRng(9), n = 8, s = w / n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { c.fillStyle = r() < 0.05 ? '#3a2f26' : `hsl(${r.range(34, 48)},${r.range(14, 30)}%,${r.range(46, 62)}%)`; c.fillRect(x * s, y * s, s, s); }
    c.strokeStyle = '#2c241c'; c.lineWidth = 4; for (let i = 0; i <= n; i++) { c.beginPath(); c.moveTo(i * s, 0); c.lineTo(i * s, h); c.moveTo(0, i * s); c.lineTo(w, i * s); c.stroke(); }
    c.lineWidth = 1.5; for (let i = 0; i < 14; i++) { let x = r() * w, y = r() * h; c.beginPath(); c.moveTo(x, y); for (let k = 0; k < 5; k++) { x += r.range(-26, 26); y += r.range(8, 34); c.lineTo(x, y); } c.stroke(); }
    for (let i = 0; i < 9; i++) { const x = r() * w, g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(40,25,10,0)'); g.addColorStop(1, 'rgba(40,25,10,.5)'); c.fillStyle = g; c.fillRect(x, 0, r.range(10, 44), h); } }, [repX, 1]);
  const TILE_H = 1.25;
  const tiledWall = (len, x, z, ry) => { const m = mesh(new THREE.PlaneGeometry(len, TILE_H), P('#fff', 0.55, 0, { map: tileTex(Math.round(len / TILE_H)) }), V(x, TILE_H / 2, z), root, { cast: false }); m.rotation.y = ry; };
  tiledWall(W * 2, 0, -D + 0.006, 0); tiledWall(D * 2, -W + 0.006, 0, Math.PI / 2); tiledWall(D * 2, W - 0.006, 0, -Math.PI / 2); tiledWall(W * 2, 0, D - 0.006, Math.PI);
  // 窓：外は西日。すすけたガラスと、ぼろぼろのカーテン
  const skyM = new THREE.MeshBasicMaterial({ color: '#ffb46b', toneMapped: false });
  mesh(new THREE.PlaneGeometry(WIN.x1 - WIN.x0, WIN.y1 - WIN.y0), skyM, V(0, (WIN.y0 + WIN.y1) / 2, -D - 0.04), root, { cast: false });
  const grime = canvasTex(256, 256, (c, w, h) => { c.clearRect(0, 0, w, h); const r = makeRng(4); for (let i = 0; i < 500; i++) { c.fillStyle = `rgba(35,25,15,${r.range(0.02, 0.1)})`; c.beginPath(); c.arc(r() * w, r() * h, r.range(4, 26), 0, 7); c.fill(); } });
  noRay(mesh(new THREE.PlaneGeometry(WIN.x1 - WIN.x0, WIN.y1 - WIN.y0), new THREE.MeshBasicMaterial({ map: grime, transparent: true, depthWrite: false }), V(0, (WIN.y0 + WIN.y1) / 2, -D - 0.02), root, { cast: false }));
  const WH = WIN.y1 - WIN.y0, WC = (WIN.y0 + WIN.y1) / 2;
  [[0, WIN.y0, 2.4, 0.06], [0, WIN.y1, 2.4, 0.06], [0, WC, 2.2, 0.03]].forEach(([x, y, w, h]) => cube(w, h, 0.06, darkWood, x, y, -D + 0.015));
  [WIN.x0, -0.37, 0.37, WIN.x1].forEach(x => cube(Math.abs(x) > 1 ? 0.06 : 0.03, WH, 0.06, darkWood, x, WC, -D + 0.015));
  const SILL_Y = WIN.y0 + 0.02;
  cube(2.5, 0.05, 0.28, darkWood, 0, SILL_Y - 0.025, -D + 0.14);
  const rag = canvasTex(128, 256, (c, w, h) => { c.fillStyle = '#6a5a48'; c.fillRect(0, 0, w, h); const r = makeRng(6); for (let i = 0; i < 60; i++) { c.fillStyle = `rgba(30,20,10,${r.range(0.05, 0.25)})`; c.fillRect(r() * w, 0, r.range(1, 7), h); } c.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 26; i++) { c.beginPath(); const x = r() * w; c.moveTo(x, h); c.lineTo(x + r.range(-12, 12), h - r.range(10, 80)); c.lineTo(x + r.range(6, 18), h); c.fill(); } });
  [-1, 1].forEach(s => { const m = mesh(new THREE.PlaneGeometry(0.5, WH * 0.9), P('#fff', 1, 0, { map: rag, side: THREE.DoubleSide, alphaTest: 0.4, transparent: false }), V(s * 1.2, WIN.y1 - WH * 0.45, -D + 0.06), root, { cast: false }); m.rotation.y = s * -0.1; noRay(m); });
  // 蜘蛛の巣（部屋の隅）
  const web = canvasTex(256, 256, (c, w, h) => { c.clearRect(0, 0, w, h); c.strokeStyle = 'rgba(225,220,205,.5)'; c.lineWidth = 1;
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI / 2; c.beginPath(); c.moveTo(w, 0); c.lineTo(w - Math.cos(a) * w, Math.sin(a) * h); c.stroke(); }
    for (let r = 18; r < w; r += 20) { c.beginPath(); c.arc(w, 0, r, Math.PI / 2, Math.PI); c.stroke(); } });
  const webM = new THREE.MeshBasicMaterial({ map: web, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  [[W - 0.5, H - 0.72, -D + 0.02, 0, 1.2], [-W + 0.5, H - 0.72, -D + 0.02, Math.PI, 1.2], [-W + 0.02, H - 0.65, D - 0.55, Math.PI / 2, 1.1], [W - 0.02, 2.15, 1.2, -Math.PI / 2, 0.9], [-1.1, 2.35, 0.2, 0.8, 0.8]].forEach(([x, y, z, ry, s]) => { const m = noRay(mesh(new THREE.PlaneGeometry(s, s), webM, V(x, y, z), root, { cast: false })); m.rotation.y = ry; if (ry === Math.PI) m.scale.x = -1; });

  // =================================================================
  // 光：屋根裏の1ページ目と同じ西日。部屋の奥は暗いまま。頭上の裸電球が、ときどき震える
  // =================================================================
  const sun = new THREE.DirectionalLight('#ffb070', 3.2); sun.position.set(-1.2, 5.7, -11); sun.target.position.set(0.6, 0, 0.2);
  setShadow(sun, 5.6, game.quality.shadow, 30); root.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight('#ffe2c0', '#2a1d14', 0.5); root.add(hemi);
  const bulbs = [];
  [[-1.5, -0.7], [2.0, 1.9], [-2.9, 1.2]].forEach(([x, z], i) => {
    cyl(0.004, 0.004, 0.7, P('#222'), x, H - 0.35, z, root, 5);
    mesh(new THREE.ConeGeometry(0.16, 0.13, 16, 1, true), P('#3a3226', 0.6, 0.5, { side: THREE.DoubleSide }), V(x, H - 0.74, z), root, { cast: false });
    const L = new THREE.PointLight('#ffa850', 1, 0, 2); L.position.set(x, H - 0.82, z); root.add(L);
    const g = noRay(mesh(new THREE.SphereGeometry(0.03, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffd9a0' }), L.position, root, { cast: false }));
    bulbs.push({ L, g, power: [1.3, 1.5, 0.9][i], ph: i * 7.3 });
  });
  // 窓から差す光の筋と、舞うほこり
  const shaftA = V(0, WC, -D + 0.1), shaftB = V(0.9, 0, -0.1), shaftDir = shaftB.clone().sub(shaftA), shaftLen = shaftDir.length();
  const shaftFade = canvasTex(4, 128, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#fff'); g.addColorStop(0.75, '#333'); g.addColorStop(1, '#000'); c.fillStyle = g; c.fillRect(0, 0, w, h); });   // 床に届く前に消える
  const shaftM = new THREE.MeshBasicMaterial({ color: '#ffd9a0', alphaMap: shaftFade, transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const shaft = noRay(new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.5, shaftLen, 24, 1, true), shaftM));
  shaft.position.copy(shaftA).addScaledVector(shaftDir, 0.5); shaft.quaternion.setFromUnitVectors(V(0, -1, 0), shaftDir.clone().normalize()); shaft.scale.z = 0.6; root.add(shaft);
  const dustN = Math.round(320 * q), dustPos = new Float32Array(dustN * 3);
  for (let i = 0; i < dustN; i++) { dustPos[i * 3] = rng.range(-W, W); dustPos[i * 3 + 1] = rng.range(0.2, H - 0.3); dustPos[i * 3 + 2] = rng.range(-D, D); }
  const dustG = new THREE.BufferGeometry(); dustG.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  root.add(noRay(new THREE.Points(dustG, new THREE.PointsMaterial({ color: '#ffe6b0', size: 0.012, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }))));

  // =================================================================
  // 奥：流し台（蛇口、水切りのカップ、窓辺の枯れかけたハーブ）
  // =================================================================
  const CX0 = -2.4, CX1 = 2.85, CZ0 = -D, CZ1 = -3.15, CH = 0.72, CW = CX1 - CX0, CC = (CX0 + CX1) / 2, CD = CZ1 - CZ0, CZC = (CZ0 + CZ1) / 2;
  cube(CW, CH, CD, paintM, CC, CH / 2, CZC);
  const S = { x0: -0.45, x1: 0.45, z0: -3.62, z1: -3.28 };
  const band = (x0, x1, z0, z1) => { const h = TOP - CH; cube(x1 - x0, h - 0.03, z1 - z0, paintM, (x0 + x1) / 2, CH + (h - 0.03) / 2, (z0 + z1) / 2); cube(x1 - x0, 0.03, z1 - z0, woodTop, (x0 + x1) / 2, TOP - 0.015, (z0 + z1) / 2); };
  band(CX0, S.x0, CZ0, CZ1); band(S.x1, CX1, CZ0, CZ1); band(S.x0, S.x1, CZ0, S.z0); band(S.x0, S.x1, S.z1, CZ1);
  cube(S.x1 - S.x0, 0.01, S.z1 - S.z0, rustM, 0, CH + 0.006, (S.z0 + S.z1) / 2);
  for (let x = CX0 + 0.35; x < CX1 - 0.2; x += 0.7) { cube(0.62, 0.54, 0.02, paintDarkM, x, 0.33, CZ1 + 0.012).rotation.z = rng.range(-0.012, 0.012); }   // 取っ手なし：開かない板だと見て分かる
  box(CX0, 0, CZ0, CX1, TOP, CZ1);
  // 蛇口（押すと、にごった水が出る／止まる）
  cyl(0.02, 0.024, 0.24, oldChromeM, 0, TOP + 0.12, -3.7);
  cube(0.03, 0.03, 0.2, oldChromeM, 0, TOP + 0.24, -3.61);
  const water = noRay(mesh(new THREE.CylinderGeometry(0.008, 0.012, TOP + 0.23 - CH, 8), new THREE.MeshStandardMaterial({ color: '#a89a6a', roughness: 0.08, transparent: true, opacity: 0.7 }), V(0, (TOP + 0.23 + CH) / 2, -3.52), root, { cast: false }));
  water.visible = false;
  const tap = mesh(new THREE.SphereGeometry(0.032, 12, 10), brassM, V(0.09, TOP + 0.05, -3.7), root);
  cyl(0.01, 0.01, 0.1, oldChromeM, 0.045, TOP + 0.05, -3.7).rotation.z = Math.PI / 2;
  tap.userData.interact = { kind: 'gimmick', dwell: 1, fn: () => { water.visible = !water.visible; game.sfx.latch(tap.getWorldPosition(V())); } };
  // 水切りのカップ：フォークの束（お題のスプーンが混ざる）
  const DR = V(1.25, TOP, -3.45);
  mesh(new THREE.CylinderGeometry(0.07, 0.055, 0.15, 16, 1, true), P('#6e6a5e', 0.5, 1, { side: THREE.DoubleSide }), V(DR.x, DR.y + 0.075, DR.z), root);
  cyl(0.055, 0.055, 0.006, P('#6e6a5e', 0.5, 1), DR.x, DR.y + 0.003, DR.z);
  spots.drainer = () => ({ p: V(DR.x + 0.028, DR.y + 0.09, DR.z + 0.018), rot: [0, 0.7, Math.PI / 2 - 0.12], scale: 1.05 });
  // 窓辺：素焼きの鉢と、枯れかけのハーブ（お題のかえるが間に）
  const SILL_Z = -D + 0.15, POTS = [-0.78, -0.2, 0.42, 0.9];
  POTS.forEach(x => cyl(0.075, 0.055, 0.12, clayM, x, SILL_Y + 0.06, SILL_Z));
  const leafG = new THREE.SphereGeometry(0.035, 7, 5); leafG.scale(1, 0.4, 0.62);
  root.add(noRay(scatter(rng, leafG, P('#fff', 0.85), 90 * q, () => { const x = rng.pick(POTS) + rng.range(-0.12, 0.12); return V(x, SILL_Y + rng.range(0.12, 0.3), SILL_Z + rng.range(-0.08, 0.09)); }, ['#4f5e33', '#5f6a35', '#6b5f2e', '#7a6a38', '#3f4f2c'])));
  spots.herbs = () => ({ p: V(0.14, SILL_Y, SILL_Z + 0.01), rot: [0, -0.35, 0], scale: 1.05 });

  // =================================================================
  // 右奥：古い冷蔵庫（扉を開けると、中が青白く光る）
  // =================================================================
  const FW = 0.9, FH = 1.95, FD = 0.8;
  const fridge = new THREE.Group(); fridge.position.set(3.42, 0, -3.35); root.add(fridge);
  const fridgeShell = pbr('rust', { color: '#d8d2b8', tile: 1.1 }), fridgeDoorM = P('#9a9a84', 0.6, 0.1);
  cube(FW, FH, 0.04, fridgeShell, 0, FH / 2, -FD / 2 + 0.02, fridge);
  [-1, 1].forEach(s => cube(0.04, FH, FD, fridgeShell, s * (FW / 2 - 0.02), FH / 2, 0, fridge));
  cube(FW, 0.06, FD, fridgeShell, 0, FH - 0.03, 0, fridge); cube(FW, 0.1, FD, fridgeShell, 0, 0.05, 0, fridge);
  cube(FW - 0.08, FH - 0.16, 0.005, P('#c4c2ae', 0.7), 0, FH / 2, -FD / 2 + 0.043, fridge);
  const SHELVES = [0.5, 0.95, 1.4];
  SHELVES.forEach(y => cube(FW - 0.08, 0.012, FD - 0.1, P('#8f9a94', 0.25), 0, y, -0.02, fridge));
  const fridgeIn = new THREE.Group(); fridgeIn.visible = false; fridge.add(fridgeIn);   // 中身は開けている間だけ見える
  const fridgeLamp = new THREE.PointLight('#bfe0ff', 0, 3, 2); fridgeLamp.position.set(0, 1.55, 0.1); fridge.add(fridgeLamp);
  // 扉は少しだけ開いていて、すきまから青白い光がもれる（開けられる物の見た目）
  const FRIDGE_AJAR = -0.045;
  const fridgeGlow = noRay(cube(0.012, FH - 0.24, 0.012, new THREE.MeshBasicMaterial({ color: '#bfe0ff', toneMapped: false }), FW / 2 - 0.016, FH / 2, FD / 2 + 0.004, fridge));
  const fDoor = new THREE.Group(); fDoor.userData.dynamic = true; fDoor.position.set(-FW / 2, 0, FD / 2); fridge.add(fDoor);
  const fDoorM = mesh(roundedBox(FW, FH, 0.09, 0.03, 3), fridgeDoorM, V(FW / 2, FH / 2, 0.045), fDoor);
  const fHandle = cube(0.03, 0.34, 0.035, oldChromeM, FW - 0.08, 1.15, 0.11, fDoor);
  let fridgeOpen = false, fridgeBusy = false;
  const setFridge = (open) => { fridgeOpen = open; fridgeIn.visible = open; fridgeLamp.intensity = open ? 1.6 : 0; fridgeGlow.visible = !open; fDoor.rotation.y = open ? -1.95 : FRIDGE_AJAR; };
  const toggleFridge = () => { if (fridgeBusy) return; fridgeBusy = true; const from = fDoor.rotation.y, to = fridgeOpen ? FRIDGE_AJAR : -1.95, opening = !fridgeOpen;
    game.sfx.boxCreak(fridge.getWorldPosition(V()), opening); if (opening) { fridgeIn.visible = true; fridgeLamp.intensity = 1.6; fridgeGlow.visible = false; }
    animate(0.9, t => { const e = t * t * (3 - 2 * t); fDoor.rotation.y = from + (to - from) * e; }, () => { fridgeBusy = false; setFridge(opening); }); };
  [fDoorM, fHandle].forEach(m => m.userData.interact = { kind: 'gimmick', dwell: 1, fn: toggleFridge });
  spots.fridge = () => ({ p: V(0.12, SHELVES[1] + 0.008, 0.02), parent: fridgeIn, rot: [0, 0.5, 0], scale: 1.1 });
  box(2.97, 0, -3.77, 3.87, FH, -2.95);

  // =================================================================
  // 左奥：鋳物のかまど、すすけた煙突フード、やかん
  // =================================================================
  const OX = -3.25, OZ = -3.3;
  cube(1.5, TOP, 0.95, rustM, OX, TOP / 2, OZ);
  cube(1.56, 0.04, 1.0, blackM, OX, TOP + 0.02, OZ);
  // 左の扉は板で打ちつけてある（開かないと一目で分かる）
  cube(0.62, 0.48, 0.02, blackM, OX - 0.38, 0.42, OZ + 0.485);
  [[0.52, 0.28], [0.34, -0.2]].forEach(([y, rz]) => { cube(0.7, 0.07, 0.025, darkWood, OX - 0.38, y, OZ + 0.505).rotation.z = rz; });
  // 右の扉は開く。少し口を開けていて、中の暗がりから目がのぞく（お題は入っていない。開けること自体の驚き）
  const ovenPanelM = new THREE.MeshBasicMaterial({ color: '#050403' }); noRay(cube(0.56, 0.42, 0.006, ovenPanelM, OX + 0.38, 0.42, OZ + 0.479));
  const ovenGlow = new THREE.PointLight('#ff4a20', 0, 6, 1.5); ovenGlow.position.set(OX + 0.38, 0.5, OZ + 0.8); root.add(ovenGlow);
  const ovenIn = new THREE.Group(); ovenIn.userData.dynamic = true; ovenIn.visible = false; root.add(ovenIn);   // 開いた扉の上の物
  const ovenEyes = new THREE.Group(); ovenEyes.userData.dynamic = true; ovenEyes.visible = false; ovenEyes.position.set(OX + 0.38, 0.42, OZ + 0.484); root.add(ovenEyes);
  const eyeBalls = [-1, 1].map(s => { const e = noRay(mesh(new THREE.SphereGeometry(0.03, 12, 10), new THREE.MeshBasicMaterial({ color: '#e8dfc4' }), V(s * 0.07, 0, 0), ovenEyes, { cast: false })); noRay(mesh(new THREE.SphereGeometry(0.014, 8, 6), new THREE.MeshBasicMaterial({ color: '#0a0806' }), V(0, 0, 0.022), e, { cast: false })); return e; });
  const OVEN_AJAR = 0.1;
  const ovenDoor = new THREE.Group(); ovenDoor.userData.dynamic = true; ovenDoor.position.set(OX + 0.38, 0.18, OZ + 0.485); root.add(ovenDoor);
  const ovenParts = [cube(0.62, 0.48, 0.02, blackM, 0, 0.24, 0, ovenDoor), cube(0.34, 0.2, 0.012, P('#120c08', 0.1), 0, 0.24, 0.015, ovenDoor), cube(0.5, 0.025, 0.03, oldChromeM, 0, 0.47, 0.02, ovenDoor)];
  let ovenOpen = false, ovenBusy = false;
  let act = 0;
  const setOven = (open) => { ovenOpen = open; ovenEyes.visible = open && act === 0; ovenIn.visible = open; ovenDoor.rotation.x = open ? 1.45 : OVEN_AJAR; };
  const toggleOven = () => { if (ovenBusy) return; ovenBusy = true; const opening = !ovenOpen, from = ovenDoor.rotation.x, to = opening ? 1.45 : OVEN_AJAR;
    game.sfx.boxCreak(ovenDoor.getWorldPosition(V()), opening); if (opening) { ovenEyes.visible = act === 0; ovenIn.visible = true; }
    animate(0.6, t => { ovenDoor.rotation.x = from + (to - from) * t; }, () => { ovenBusy = false; setOven(opening); }); };
  ovenParts.forEach(m => m.userData.interact = { kind: 'gimmick', dwell: 1, fn: toggleOven });
  [[-0.42, -0.2], [0.42, -0.2], [-0.42, 0.22], [0.42, 0.22]].forEach(([dx, dz]) => cyl(0.13, 0.13, 0.012, P('#0d0c0b', 0.6), OX + dx, TOP + 0.046, OZ + dz, root, 18));
  mesh(potGeo(0.1, 0.13), P('#6a2a22', 0.45, 0, { side: THREE.DoubleSide }), V(OX - 0.42, TOP + 0.05, OZ + 0.22), root);
  cyl(0.02, 0.1, 0.03, P('#6a2a22', 0.45), OX - 0.42, TOP + 0.195, OZ + 0.22);
  mesh(new THREE.CylinderGeometry(0.28, 0.85, 0.5, 4, 1, true), P('#3c3a34', 0.7, 0.7, { side: THREE.DoubleSide }), V(OX, 2.3, OZ - 0.08), root).rotation.y = Math.PI / 4;
  cube(0.42, H - 2.55, 0.42, rustM, OX, (H + 2.55) / 2, OZ - 0.08);
  box(OX - 0.78, 0, -D, OX + 0.78, TOP, OZ + 0.5);

  // =================================================================
  // 中央：大きな作業台（引き出し、トースター、卵のパック）
  // =================================================================
  const IX = 0, IZ = -0.7, IW = 2.8, ID = 1.2;
  cube(IW, TOP - 0.06, ID, paintM, IX, (TOP - 0.06) / 2, IZ);
  cube(IW + 0.12, 0.06, ID + 0.12, woodTop, IX, TOP - 0.03, IZ);
  box(IX - IW / 2 - 0.06, 0, IZ - ID / 2 - 0.06, IX + IW / 2 + 0.06, TOP, IZ + ID / 2 + 0.06);
  // 左右の引き出しは板で打ちつけてある。真ん中の本物だけが、取っ手つきで少し出ている
  [-0.98, 0.98].forEach(x => { cube(0.66, 0.2, 0.02, paintDarkM, x, 0.62, IZ + ID / 2 + 0.01); cube(0.74, 0.05, 0.02, darkWood, x, 0.62, IZ + ID / 2 + 0.028).rotation.z = x < 0 ? 0.22 : -0.18; });
  // 引き出し（手前に開く）：中身は開けている間だけ
  const DZ = IZ + ID / 2, DOUT = 0.42, DAJAR = 0.03;
  const drawer = new THREE.Group(); drawer.userData.dynamic = true; drawer.position.set(0, 0.62, DZ); root.add(drawer);
  const dFront = cube(0.66, 0.2, 0.025, P('#4c5645', 0.85), 0, 0, 0.012, drawer);
  const dKnob = mesh(new THREE.SphereGeometry(0.022, 12, 10), brassM, V(0, 0, 0.042), drawer);
  const tray = P('#6e5a42', 0.9);
  cube(0.6, 0.01, 0.42, tray, 0, -0.08, -0.21, drawer);
  [-1, 1].forEach(s => cube(0.01, 0.12, 0.42, tray, s * 0.3, -0.03, -0.21, drawer));
  cube(0.6, 0.12, 0.01, tray, 0, -0.03, -0.42, drawer);
  const drawerIn = new THREE.Group(); drawerIn.visible = false; drawer.add(drawerIn);
  let drawerOpen = false, drawerBusy = false;
  const setDrawer = (open) => { drawerOpen = open; drawerIn.visible = open; drawer.position.z = DZ + (open ? DOUT : DAJAR); };
  const toggleDrawer = () => { if (drawerBusy) return; drawerBusy = true; const opening = !drawerOpen, from = drawer.position.z, to = DZ + (opening ? DOUT : DAJAR);
    game.sfx.boxCreak(drawer.getWorldPosition(V()), opening); if (opening) drawerIn.visible = true;
    animate(0.5, t => { drawer.position.z = from + (to - from) * t; }, () => { drawerBusy = false; setDrawer(opening); }); };
  [dFront, dKnob].forEach(m => m.userData.interact = { kind: 'gimmick', dwell: 1, fn: toggleDrawer });
  spots.drawer = () => ({ p: V(0.12, -0.075, -0.2), parent: drawerIn, rot: [0, 0.35, 0], scale: 1.1 });
  // トースター（レバーを押すとパンが飛び出す）
  const TOAST = V(0.75, TOP, -0.95);
  const toaster = new THREE.Group(); toaster.userData.dynamic = true; toaster.position.copy(TOAST); root.add(toaster);
  const toastParts = [cube(0.22, 0.15, 0.03, oldChromeM, 0, 0.09, 0.05, toaster), cube(0.22, 0.15, 0.03, oldChromeM, 0, 0.09, -0.05, toaster), cube(0.04, 0.15, 0.07, oldChromeM, -0.09, 0.09, 0, toaster), cube(0.04, 0.15, 0.07, oldChromeM, 0.09, 0.09, 0, toaster), cube(0.22, 0.015, 0.13, blackM, 0, 0.012, 0, toaster)];
  const lever = cube(0.02, 0.02, 0.05, blackM, 0.122, 0.14, 0, toaster);
  const toastHolder = new THREE.Group(); toastHolder.userData.dynamic = true; toaster.add(toastHolder);
  const POP0 = 0.09, POP1 = 0.18; toastHolder.position.y = POP0;
  let popped = false, popBusy = false;
  const setToast = (up) => { popped = up; toastHolder.position.y = up ? POP1 : POP0; lever.position.y = up ? 0.14 : 0.06; };
  const togglePop = () => { if (popBusy) return; popBusy = true; const up = !popped, from = toastHolder.position.y, to = up ? POP1 : POP0, lf = lever.position.y, lt = up ? 0.14 : 0.06;
    (up ? game.sfx.spring : game.sfx.latch)(toaster.getWorldPosition(V()));
    animate(up ? 0.28 : 0.2, t => { const e = up ? 1 - (1 - t) * (1 - t) : t; toastHolder.position.y = from + (to - from) * e; lever.position.y = lf + (lt - lf) * t; }, () => { popBusy = false; setToast(up); }); };
  [...toastParts, lever].forEach(m => m.userData.interact = { kind: 'gimmick', dwell: 1, fn: togglePop });
  spots.toaster = () => ({ p: V(0, 0, 0), parent: toastHolder, rot: [0, 0, 0], scale: 1.08 });
  // 卵のパック（古い卵の列に、ルーペでだけ見える金の卵）
  const EGG = V(-0.8, TOP, -1.0);
  cube(0.34, 0.025, 0.13, P('#7a6e5a', 1), EGG.x, EGG.y + 0.012, EGG.z);
  const eggSlots = []; for (let i = 0; i < 6; i++) for (const dz of [-0.033, 0.033]) if (!(i === 3 && dz > 0)) eggSlots.push(V(EGG.x - 0.135 + i * 0.054, EGG.y + 0.052, EGG.z + dz));
  root.add(noRay(scatter(rng, new THREE.SphereGeometry(0.023, 10, 8), P('#fff', 0.7), eggSlots.length, i => eggSlots[i], ['#c8bda4', '#b8a88a', '#d0c4aa', '#a89a7e'], { rot: () => V(), scale: () => V(1, 1.25, 1), vary: false })));
  spots.eggCarton = () => ({ p: V(EGG.x - 0.135 + 3 * 0.054, EGG.y + 0.02, EGG.z + 0.033), rot: [0, 0, 0], scale: 0.62 });

  // =================================================================
  // 壁：食器棚、パントリー、壁の棚（どこも物であふれる）
  // =================================================================
  const shelves = [];   // おとりを置く棚 { x0, x1, y, z0, z1 }
  const addShelf = (x0, x1, y, z0, z1) => { cube(x1 - x0, 0.035, z1 - z0, darkWood, (x0 + x1) / 2, y - 0.018, (z0 + z1) / 2).rotation.z = rng.range(-0.008, 0.008); shelves.push({ x0, x1, y, z0, z1 }); };
  const cabinet = (x, s, z0, z1, ys, depth) => {
    const zc = (z0 + z1) / 2, zl = z1 - z0, top = ys[ys.length - 1] + 0.42;
    [z0, z1].forEach(z => cube(depth, top, 0.05, darkWood, x, top / 2, z));
    cube(depth + 0.04, 0.06, zl + 0.1, darkWood, x, top, zc);
    cube(0.02, top, zl, darkWood, x - s * (depth / 2 - 0.01), top / 2, zc);
    ys.forEach(y => addShelf(x - depth / 2, x + depth / 2, y, z0 + 0.03, z1 - 0.03));
    shelves.push({ x0: x - depth / 2, x1: x + depth / 2, y: top + 0.03, z0, z1 });
    box(Math.min(x - depth / 2, x + depth / 2), 0, z0, Math.max(x - depth / 2, x + depth / 2), top, z1);
  };
  cabinet(-W + 0.24, 1, -2.1, 1.2, [0.1, 0.52, 0.94, 1.36, 1.78, 2.2], 0.46);
  cabinet(W - 0.24, -1, -1.7, 2.3, [0.1, 0.5, 0.9, 1.3, 1.7, 2.1, 2.5], 0.46);
  [[1.6, 2.05], [2.05, 2.5]].forEach(([y]) => { addShelf(-2.35, -1.3, y, -D + 0.02, -D + 0.32); addShelf(1.35, 2.85, y, -D + 0.02, -D + 0.32); });
  [1.45, 1.9, 2.4].forEach(y => { addShelf(-W + 0.02, W - 0.5, y, D - 0.34, D - 0.02); });
  [1.45, 2.0].forEach(y => { addShelf(-W + 0.02, -W + 0.34, y, 1.4, D - 0.4); addShelf(W - 0.34, W - 0.02, y, -2.85, -1.9); });

  // =================================================================
  // 手前：誰も来ない食卓（皿は並んだまま）。椅子のひとつに人形が座っている
  // =================================================================
  const TB = { x: 1.9, z: 1.5, y: 0.78 };
  cube(1.9, 0.05, 1.15, woodTop, TB.x, TB.y - 0.025, TB.z);
  cube(1.96, 0.012, 1.21, P('#766856', 1), TB.x, TB.y + 0.003, TB.z);   // 汚れたテーブルクロス
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => cube(0.08, TB.y - 0.05, 0.08, darkWood, TB.x + a * 0.86, (TB.y - 0.05) / 2, TB.z + b * 0.5));
  box(TB.x - 0.98, 0, TB.z - 0.6, TB.x + 0.98, TB.y, TB.z + 0.6);
  const chair = (x, z, ry, tip = 0) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.set(tip, ry, 0); root.add(g);
    cube(0.42, 0.03, 0.42, darkWood, 0, 0.47, 0, g); cube(0.42, 0.55, 0.03, darkWood, 0, 0.75, -0.2, g);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => cube(0.035, 0.47, 0.035, darkWood, a * 0.19, 0.235, b * 0.19, g)); return g; };
  chair(TB.x - 0.45, TB.z - 0.82, 0);
  const guestChair = chair(TB.x + 0.5, TB.z + 0.84, Math.PI + 0.25); guestChair.userData.dynamic = true;   // 最後に、こちらへ引かれる椅子
  chair(TB.x + 1.28, TB.z - 0.1, -Math.PI / 2 + 0.1);
  chair(TB.x - 1.28, TB.z + 0.1, Math.PI / 2 - 0.1);
  chair(TB.x + 0.5, TB.z - 0.82, 0.05);
  chair(TB.x - 0.5, TB.z + 0.84, Math.PI - 0.1);
  // お客の席（向きは食卓の方）
  const SEATS = { bear_brown: [TB.x + 1.28, TB.z - 0.1, -Math.PI / 2], rabbit_white: [TB.x - 1.28, TB.z + 0.1, Math.PI / 2], cat_orange: [TB.x + 0.5, TB.z - 0.82, 0], fox: [TB.x - 0.5, TB.z + 0.84, Math.PI] };
  // 食卓の支度：人形の前に空の皿。見つけた物が、見ていない間にここへ並ぶ
  const PLATE_Y = TB.y + 0.02, plateM = P('#b6ab94', 0.45);
  const PLACES = { bread: [1.45, 1.13, 0.5], tomato: [1.2, 1.1, 0], cheese: [1.7, 1.1, 0.8], frog: [1.45, 1.36, 0.2], spoon: [1.86, 1.24, 1.1, 'bare'], matchbox: [2.16, 1.54, 0.4, 'bare'], egg_gold: [2.4, 1.84, 0] };
  Object.values(PLACES).forEach(([x, z, , bare]) => { if (!bare) cyl(0.085, 0.06, 0.016, plateM, x, TB.y + 0.012, z, root, 18); });
  const CANDLE = V(2.0, TB.y + 0.01, 1.5);
  cyl(0.05, 0.065, 0.02, brassM, CANDLE.x, CANDLE.y + 0.01, CANDLE.z, root, 12); cyl(0.018, 0.018, 0.16, P('#d8ccb0', 0.7), CANDLE.x, CANDLE.y + 0.1, CANDLE.z, root, 10);
  const candleFlame = noRay(mesh(new THREE.SphereGeometry(0.018, 8, 8), new THREE.MeshBasicMaterial({ color: '#ffcc66', toneMapped: false }), V(CANDLE.x, CANDLE.y + 0.205, CANDLE.z), root, { cast: false })); candleFlame.scale.set(0.8, 1.7, 0.8); candleFlame.visible = false;
  const candleLight = new THREE.PointLight('#ffb25a', 0, 5, 1.6); candleLight.position.copy(candleFlame.position); root.add(candleLight);
  const tableMark = new THREE.Object3D(); tableMark.position.set(TB.x, TB.y, TB.z); root.add(tableMark);
  { const c = chair(-0.55, 2.75, 0.7); c.position.y = 0.21; c.rotation.x = -Math.PI / 2 + 0.05; }   // 倒れた椅子
  // 人形：ひびの入った顔。見ていない間に、こちらへ首を向ける
  const doll = new THREE.Group(); doll.userData.dynamic = true; doll.position.set(TB.x - 0.45, 0.485, TB.z - 0.82); doll.scale.setScalar(1.4); root.add(doll);
  const DOLL_BUILD = () => doll.clone(true);
  mesh(new THREE.CylinderGeometry(0.06, 0.13, 0.26, 12), P('#4c2c34', 0.95), V(0, 0.13, 0), doll);
  const dollFaceTex = canvasTex(256, 128, (c, w, h) => { c.fillStyle = '#d8ccb6'; c.fillRect(0, 0, w, h); c.fillStyle = '#16100c'; [[105, 58], [151, 58]].forEach(([x, y]) => { c.beginPath(); c.arc(x, y, 11, 0, 7); c.fill(); }); c.fillStyle = '#6a2020'; c.beginPath(); c.arc(128, 86, 6, 0, 7); c.fill(); c.strokeStyle = '#2a1e16'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(150, 8); c.lineTo(140, 34); c.lineTo(153, 46); c.lineTo(146, 70); c.stroke(); });
  dollFaceTex.center?.set(0.5, 0.5);
  const dollHead = new THREE.Group(); dollHead.name = 'head'; dollHead.position.set(0, 0.34, 0); doll.add(dollHead);
  const dollFace = mesh(new THREE.SphereGeometry(0.085, 18, 14), P('#fff', 0.35, 0, { map: dollFaceTex }), V(0, 0, 0), dollHead); dollFace.rotation.y = -Math.PI / 2;
  mesh(new THREE.SphereGeometry(0.092, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), P('#2a1a12', 1), V(0, 0.012, -0.012), dollHead);
  mesh(new THREE.CapsuleGeometry(0.018, 0.13, 3, 6), P('#d8ccb6', 0.5), V(-0.11, 0.17, 0.05), doll).rotation.set(0.9, 0, -0.2);
  // 右腕はふだん下げていて、見ていない間に、まだ見つかっていない物を指す
  const dollArm = new THREE.Group(); dollArm.position.set(0.1, 0.24, 0.01); doll.add(dollArm);
  mesh(new THREE.CapsuleGeometry(0.018, 0.17, 3, 6), P('#d8ccb6', 0.5), V(0, 0, 0.1), dollArm).rotation.x = Math.PI / 2;
  const ARM_REST = 1.15; dollArm.rotation.x = ARM_REST;
  let dollYaw = 0.6, dollPitch = 0;
  const seen = (obj, cam, deg = 55) => { const d = cam.getWorldDirection(V()), to = obj.getWorldPosition(V()).sub(cam.getWorldPosition(V())).normalize(); return d.dot(to) > Math.cos(THREE.MathUtils.degToRad(deg)); };

  // 野菜箱：古いりんごの山にトマトが1つ
  const crate = (x, z, w, d, rot = 0) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; root.add(g); [-1, 1].forEach(s => { cube(w, 0.32, 0.02, darkWood, 0, 0.2, s * d / 2, g); cube(0.02, 0.32, d, darkWood, s * w / 2, 0.2, 0, g); }); cube(w, 0.02, d, darkWood, 0, 0.05, 0, g); };
  crate(VEG.x, VEG.z, 0.84, 0.64); box(VEG.x - 0.42, 0, VEG.z - 0.32, VEG.x + 0.42, 0.36, VEG.z + 0.32);
  root.add(noRay(scatter(rng, new THREE.SphereGeometry(0.05, 12, 9), P('#fff', 0.5), 66 * q, () => { const p = moundPoint(rng, VEG, 0.36, 0.22); p.x = Math.max(VEG.x - 0.35, Math.min(VEG.x + 0.35, p.x)); p.z = Math.max(VEG.z - 0.25, Math.min(VEG.z + 0.25, p.z)); return p; }, ['#8c1a18', '#a02420', '#7a1e1c', '#962a22', '#6e1a18', '#8a3a1e'], { rot: () => V(rng() * 0.6, rng() * 6, rng() * 0.6), scale: () => rng.range(0.85, 1.15), vary: false })));
  spots.vegBox = () => ({ p: V(VEG.x + 0.1, VEG.y + 0.2, VEG.z + 0.08), rot: [0.2, 0.8, -0.15], scale: 1.0 });
  // ほかの木箱と樽、袋
  [[-3.5, 2.9, 0.7, 0.5, 0.3], [3.2, 3.0, 0.8, 0.55, -0.2], [-3.6, -1.4, 0.6, 0.45, 1.2], [-1.5, 3.1, 0.7, 0.5, 0.5]].forEach(([x, z, w, d, ry]) => crate(x, z, w, d, ry));
  [[3.5, -1.0], [-1.7, -2.5], [2.3, -2.5]].forEach(([x, z]) => { const b = cyl(0.26, 0.22, 0.75, darkWood, x, 0.375, z, root, 14); [0.15, 0.6].forEach(y => cyl(0.272, 0.272, 0.03, rustM, x, y, z, root, 14)); b.rotation.y = rng() * 6; box(x - 0.26, 0, z - 0.26, x + 0.26, 0.75, z + 0.26); });
  [[-2.1, 3.3], [0.5, 3.35], [3.75, 2.75]].forEach(([x, z]) => { mesh(roundedBox(0.44, 0.58, 0.32, 0.12, 2), P('#6e5e46', 1), V(x, 0.29, z), root).rotation.set(0.05, rng() * 3, rng.range(-0.1, 0.1)); });

  // =================================================================
  // 天井：銅の鍋のラック、干した物、吊るされた道具
  // =================================================================
  const RK = 2.75, rail = P('#2a2118', 0.6, 0.7);
  const hang = (x, z, drop, build) => { cyl(0.003, 0.003, drop, rail, x, RK - drop / 2, z, root, 4); const g = build(); g.position.set(x, RK - drop, z); root.add(g); return g; };
  [[0, IZ, 2.7], [TB.x, TB.z, 1.7], [-2.9, 1.0, 1.7]].forEach(([x, z, len]) => {
    cube(len, 0.03, 0.03, rail, x, RK, z);
    [-len / 2 + 0.05, len / 2 - 0.05].forEach(dx => cyl(0.006, 0.006, H - RK, rail, x + dx, (H + RK) / 2, z, root, 5));
    const n = Math.round(len / 0.21 * Math.max(0.6, q));
    for (let i = 0; i < n; i++) { const ax = x - len / 2 + (i + 0.5) * len / n + rng.range(-0.03, 0.03), type = rng();
      if (type < 0.3) { const r = rng.range(0.08, 0.15), h = rng.range(0.08, 0.15); cyl(0.003, 0.003, 0.14, rail, ax, RK - 0.07, z, root, 4); mesh(potGeo(r, h), copperM, V(ax, RK - 0.14 - h, z), root); }
      else if (type < 0.65) { const drop = rng.range(0.22, 0.42); hang(ax, z, drop, () => { const g = new THREE.Group(); const n2 = 4 + Math.floor(rng() * 5), col = rng.pick([['#cfc6ae', 'matte'], ['#5a2a22', 'gloss'], ['#6b5f2e', 'matte'], ['#4a3a24', 'matte']]); for (let k = 0; k < n2; k++) mesh(new THREE.SphereGeometry(0.028, 7, 5), P(col[0], 0.8), V(rng.range(-0.025, 0.025), -k * 0.045, rng.range(-0.025, 0.025)), g).scale.set(1, 1.2, 1); return g; }); }
      else { const drop = rng.range(0.04, 0.1); hang(ax, z, drop, () => { const w = makeWare(rng, ['tool']); w.rotation.set(rng.range(-0.1, 0.1), rng() * 6, -Math.PI / 2 + rng.range(-0.12, 0.12)); return w; }); }
    }
  });

  // 動かない物を、材質ごとにまとめて描く（Questでも軽く）
  mergeStatic(root);

  // =================================================================
  // ごちゃごちゃ：作業台・棚・床を、すきまなく物で埋める
  // =================================================================
  const STEP = 1 / Math.sqrt(Math.max(q, 0.2));
  let pageKeep = [];   // 幕ごとに、お題の場所を空けておく
  const free = (x, z, keep) => !keep.some(([kx, kz, kr]) => Math.hypot(x - kx, z - kz) < kr) && !pageKeep.some(([kx, kz, kr]) => Math.hypot(x - kx, z - kz) < kr);
  const SURF = [
    { x0: -1.42, x1: 1.42, z0: -1.28, z1: -0.12, y: TOP, step: 0.165, layers: 0.5, cats: ['dish', 'food', 'tool', 'jar', 'pot'], keep: [[TOAST.x, TOAST.z, 0.25], [EGG.x, EGG.z, 0.27]] },
    { x0: 0.5, x1: 2.8, z0: -3.75, z1: -3.2, y: TOP, step: 0.165, layers: 0.45, cats: ['dish', 'jar', 'tool', 'pot'], keep: [[DR.x, DR.z, 0.19]] },
    { x0: -2.35, x1: -0.5, z0: -3.75, z1: -3.2, y: TOP, step: 0.165, layers: 0.45, cats: ['jar', 'food', 'tool', 'dish'] },
    { x0: -0.42, x1: 0.42, z0: -3.6, z1: -3.3, y: CH + 0.012, step: 0.13, layers: 0.7, cats: ['dish'] },                                                       // 流しの洗いもの
    { x0: OX - 0.72, x1: OX + 0.72, z0: OZ - 0.42, z1: OZ + 0.45, y: TOP + 0.05, step: 0.235, layers: 0.2, cats: ['pot'], keep: [[OX - 0.42, OZ + 0.22, 0.2]] },
    // 食卓は部屋で唯一、片づいている（支度の変化が見えるように）。汚れた皿は奥の端にだけ
    { x0: TB.x + 0.62, x1: TB.x + 0.92, z0: TB.z - 0.54, z1: TB.z + 0.1, y: TB.y + 0.01, step: 0.165, layers: 0.4, cats: ['dish', 'dish', 'tool'] },
    { x0: 3.02, x1: 3.82, z0: -3.72, z1: -2.98, y: FH, step: 0.165, layers: 0.5, cats: ['jar', 'pot'] },                                                         // 冷蔵庫の上
    { x0: -1.05, x1: 1.05, z0: -D + 0.03, z1: -D + 0.27, y: SILL_Y, step: 0.165, layers: 0.2, cats: ['jar', 'food'], keep: [[0.14, SILL_Z, 0.12], ...POTS.map(x => [x, SILL_Z, 0.14])] },
    ...shelves.map(s => ({ ...s, step: 0.145, layers: 0.3, cats: ['jar', 'dish', 'jar', 'pot', 'tool', 'food'] })),
    // 床：壁ぎわと家具のまわり
    { x0: -W + 0.5, x1: -1.1, z0: -2.95, z1: -2.1, y: 0, step: 0.235, layers: 0.45, cats: ['pot', 'food', 'jar', 'dish', 'tool'], keep: [[OX + 0.38, -2.75, 0.45]] },
    { x0: 1.0, x1: W - 0.5, z0: -2.95, z1: -1.9, y: 0, step: 0.235, layers: 0.45, cats: ['pot', 'food', 'jar', 'dish', 'tool'], keep: [[2.3, -2.5, 0.3]] },
    { x0: -W + 0.1, x1: W - 0.1, z0: D - 0.75, z1: D - 0.08, y: 0, step: 0.235, layers: 0.5, cats: ['pot', 'food', 'jar', 'tool'] },
    { x0: -W + 0.6, x1: -1.5, z0: 1.35, z1: 3.0, y: 0, step: 0.3, layers: 0.3, cats: ['food', 'pot', 'jar'], keep: [[VEG.x, VEG.z, 0.55]] },
    { x0: TB.x - 0.85, x1: TB.x + 0.85, z0: TB.z - 0.45, z1: TB.z + 0.45, y: 0, step: 0.28, layers: 0.4, cats: ['jar', 'pot', 'food'] },                         // 食卓の下
    { x0: W - 0.75, x1: W - 0.5, z0: -1.65, z1: 2.25, y: 0, step: 0.235, layers: 0.3, cats: ['pot', 'food'] },
    { x0: -W + 0.5, x1: -W + 0.75, z0: -2.05, z1: 1.15, y: 0, step: 0.235, layers: 0.3, cats: ['pot', 'food'] },
  ];
  const fillSurface = (s, r, addTo) => { const st = s.step * STEP, keep = s.keep || [];
    for (let x = s.x0 + st / 2; x < s.x1; x += st) for (let z = s.z0 + st / 2; z < s.z1; z += st) {
      const px = x + r.range(-st * 0.3, st * 0.3), pz = z + r.range(-st * 0.3, st * 0.3);
      if (!free(px, pz, keep) || r() < 0.08) continue;
      let y = s.y;
      for (let l = 0; l < 2; l++) { if (l && r() > s.layers) break;
        const o = makeWare(r, s.cats); o.position.set(px + (l ? r.range(-0.03, 0.03) : 0), y, pz + (l ? r.range(-0.03, 0.03) : 0));
        o.rotation.set(l ? r.range(-0.22, 0.22) : r.range(-0.04, 0.04), r() * 6.28, l ? r.range(-0.22, 0.22) : r.range(-0.04, 0.04)); o.scale.multiplyScalar(r.range(0.88, 1.18));
        root.add(o); addTo(o); y += (o.userData.h || 0.05) * 0.9;
      }
    } };
  // おもちゃも置く場所（屋根裏と同じ「眠らないおもちゃ」が、ここにも紛れている）
  const toySpot = (r) => { const s = r.pick(SURF.filter(x => x.y > 0 && x.y !== TB.y + 0.01)); for (let i = 0; i < 12; i++) { const x = r.range(s.x0, s.x1), z = r.range(s.z0, s.z1); if (free(x, z, s.keep || [])) return { p: V(x, s.y, z) }; } return { p: V(s.x0, s.y, s.z0) }; };

  // =================================================================
  // ページ
  // =================================================================
  let pageObjs = [], baked = [];
  // 三幕で一つの話（docs/kitchen-design.md）。説明の文字は出さない。
  // 第一の幕：見つけた物が皿に並び、こちらの椅子が引かれる。
  // 第二の幕：見つけるたびに、見ていない間にお客が座る。そろうとやかんが鳴り、皆がこちらの席を見る。
  // 第三の幕：お客と人形を見つけて席へ戻す。そろうと朝になり、誰もいなくなって、自分の席に朝ごはんが残る。
  spots.sinkDishes = () => ({ p: V(-0.12, CH + 0.03, -3.45), rot: [0, 0.6, 0], scale: 1.0 });
  spots.fridgeTop = () => ({ p: V(3.42, FH, -3.32), rot: [0, -0.5, 0], h: 0.3 });
  spots.fridgeTopPot = () => ({ p: V(3.42, FH, -3.32), rot: [0, -0.5, 0], scale: 1.0 });
  spots.toasterFlat =() => ({ p: V(0, 0.015, 0), parent: toastHolder, rot: [Math.PI / 2, 0, 0], scale: 1.0 });
  spots.toasterMouse = () => ({ p: V(0, 0.02, 0), parent: toastHolder, rot: [0, 1.57, 0], h: 0.14 });
  spots.webCorner = () => ({ p: V(W - 0.32, H - 0.5, -D + 0.08), rot: [Math.PI / 2 - 0.2, 0, 0.3], scale: 1.15 });
  spots.ovenTray = () => ({ p: V(OX + 0.38, 0.215, OZ + 0.8), parent: ovenIn, rot: [0, 0.4, 0], h: 0.15 });
  spots.guestPlate = () => ({ p: V(2.4, PLATE_Y, 1.84), rot: [0, 0, 0], scale: 0.9 });
  spots.behindBarrel = () => ({ p: V(-1.76, 0, -2.83) });
  spots.cabinetShelf = () => ({ p: V(-W + 0.26, 0.52, -0.55), rot: [0, Math.PI / 2, 0], h: 0.3 });
  spots.underTable = () => ({ p: V(TB.x - 0.35, 0, TB.z + 0.05), rot: [0, 2.6, 0], h: 0.3 });
  spots.vegBoxFox = () => ({ p: V(VEG.x - 0.12, VEG.y + 0.05, VEG.z - 0.02), rot: [0, 0.3, 0], h: 0.34 });
  spots.sillStar = () => ({ p: V(-0.5, SILL_Y + 0.005, SILL_Z), rot: [0, 0, 0], scale: 1.0 });
  const PAGE_KEEP = [[], [[3.42, -3.32, 0.2], [OX + 0.38, -2.5, 0.2]], [[3.42, -3.32, 0.2], [TB.x - 0.35, TB.z + 0.05, 0.24], [-W + 0.26, -0.55, 0.2], [-1.76, -2.83, 0.28]]];
  const TABLE2 = { teapot: [TB.x - 0.25, TB.z + 0.22, 0.4, 'bare'], teacup: [TB.x + 0.22, TB.z + 0.3, 0.2, 'bare'], cookie: [TB.x - 0.02, TB.z + 0.42, 0, 'bare'], mouse: [TB.x + 0.3, TB.z - 0.12, 2.2, 'bare'] };
  const GUESTS = ['bear_brown', 'rabbit_white', 'cat_orange', 'fox'];
  const FRONT = { };   // おもちゃの前の向きのずれ
  const facingTo = (key, from, to) => Math.atan2(to.x - from.x, to.z - from.z) + (FRONT[key] || 0);
  const YOUR_SEAT = V(TB.x + 0.62, 0.9, TB.z + 1.28);
  let left = [], served = [], pending = [], seated = [], secretObj = null, dinner = false, guestsIn = 0, peek = null;
  let idle = 0, knocked = false, pointAt = null, lightK = 1, lookAtSeat = false;
  const POINT_AFTER = 25, KNOCK_AFTER = 40;   // 詰まったら指さす。気づかれなければ一度だけ物音を立てる
  const strip = (o) => { o.traverse(c => { c.userData = {}; c.visible = true; c.raycast = () => {}; }); return o; };
  const sized = (o, h) => { o.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(o); o.scale.multiplyScalar(h / Math.max(0.001, b.max.y - b.min.y)); return o; };
  const guestOf = (key) => { const g = sized(strip(buildToy(key)), 0.44); const [x, z, ry] = SEATS[key]; g.position.set(x, 0.495, z); g.rotation.y = ry + (FRONT[key] || 0); return g; };
  const seatGuest = (key, quiet) => { const g = guestOf(key); pending.push({ c: g, quiet }); seated.push({ o: g, key }); };
  const tableCopy = (obj, [x, z, ry, bare], quiet, grow = 1.25) => { const c = strip(obj.clone(true)); c.position.set(x, bare ? TB.y + 0.012 : PLATE_Y, z); c.rotation.set(0, ry, 0); c.scale.multiplyScalar(grow); pending.push({ c, quiet }); };
  function onFound(it, secret, quiet = false) {
    left = left.filter(o => o !== it.obj); idle = 0; knocked = false; if (pointAt === it.obj) pointAt = null;
    if (secret) { secretObj = null; pointAt = null; tableCopy(it.obj, PLACES.egg_gold, quiet); return; }
    if (act === 0) tableCopy(it.obj, PLACES[it.id] || [TB.x, TB.z, 0], quiet);
    else if (act === 1) {
      if (TABLE2[it.id]) tableCopy(it.obj, TABLE2[it.id], quiet, 1);
      if (it.id !== 'mouse' && guestsIn < GUESTS.length) seatGuest(GUESTS[guestsIn++], quiet);
    } else {
      if (it.id === 'anoko') pending.push({ show: doll, quiet });
      else if (it.id === 'mouse') { const m = strip(buildToy('mouse')); m.scale.multiplyScalar(1.2); const [x, z, ry] = TABLE2.mouse; m.position.set(x, TB.y + 0.012, z); m.rotation.y = ry; pending.push({ c: m, quiet }); }
      else seatGuest(it.id, quiet);
    }
  }
  const pullChair = () => { guestChair.position.set(TB.x + 0.62, 0, TB.z + 1.28); guestChair.rotation.y = Math.PI + 0.55; };
  const lightCandle = (on) => { candleFlame.visible = on; candleLight.intensity = on ? 2.6 : 0; };
  function finale() {
    dinner = true; idle = 0; knocked = false; const p = tableMark.getWorldPosition(V());
    if (act === 0) { lightK = 0.3; sun.intensity = 1.3; lightCandle(true); pullChair(); pointAt = secretObj; game.sfx.latch(p); setTimeout(() => game.sfx.boxCreak(p, true), 260); }
    else if (act === 1) { lookAtSeat = true; pointAt = secretObj; steamK = 1; game.sfx.whistle(V(OX - 0.42, TOP + 0.2, OZ + 0.22)); }
    else morning();
  }
  // 朝：お客も人形も消え、自分の席にだけ朝ごはん。かえるは窓辺で外を見ている
  function morning() {
    pointAt = null; served.forEach(c => c.parent?.remove(c)); served = []; seated = []; doll.visible = false; peek = null; lightCandle(false);
    skyM.color.set('#fff0cf'); sun.color.set('#ffe6bd'); sun.intensity = 3.4; hemi.color.set('#fff2dc'); hemi.groundColor.set('#6a5442'); hemi.intensity = 0.95; lightK = 0;
    shaftM.color.set('#fff0cf'); shaftM.opacity = 0.1; game.scene.environmentIntensity = 0.75; ovenGlow.intensity = 0;
    const add = (key, x, y, z, ry, sc) => { const o = strip(buildToy(key)); o.scale.multiplyScalar(sc); o.position.set(x, y, z); o.rotation.y = ry; root.add(o); served.push(o); return o; };
    const [gx, gz] = PLACES.egg_gold;
    add('bread', gx - 0.02, PLATE_Y, gz, 0.4, 1.0); add('cheese', gx - 0.02, PLATE_Y + 0.11, gz, 1.0, 0.8); add('egg_gold', gx + 0.15, TB.y + 0.012, gz + 0.1, 0, 0.6); add('spoon', gx - 0.2, TB.y + 0.012, gz + 0.06, 0.2, 1);
    add('frog', 0.14, SILL_Y, SILL_Z, Math.PI, 1);
    steam.position.set(gx, PLATE_Y + 0.18, gz); steamK = 0.7;
    pullChair();
  }
  // 湯気（第二の幕のやかん、朝ごはん）
  const steamN = 26, steamP = new Float32Array(steamN * 3); for (let i = 0; i < steamN; i++) { steamP[i * 3 + 1] = Math.random() * 0.5; }
  const steamG = new THREE.BufferGeometry(); steamG.setAttribute('position', new THREE.BufferAttribute(steamP, 3));
  const steam = noRay(new THREE.Points(steamG, new THREE.PointsMaterial({ color: '#fff6e8', size: 0.05, transparent: true, opacity: 0.32, depthWrite: false }))); steam.visible = false; root.add(steam);
  let steamK = 0;
  function setAct(n) {
    act = n;
    skyM.color.set(['#ffb46b', '#3a3f7a', '#27346a'][n]);
    sun.color.set(['#ffb070', '#8f9cff', '#a8bcff'][n]); sun.intensity = [3.2, 0.7, 1.5][n];
    hemi.color.set(['#ffe2c0', '#8388dd', '#7a90d0'][n]); hemi.groundColor.set(['#2a1d14', '#54406e', '#505c90'][n]); hemi.intensity = [0.5, 0.75, 0.62][n];
    lightK = [1, 0.25, 0.1][n]; lookAtSeat = false; steamK = n === 1 ? 0.5 : 0;
    shaftM.color.set(['#ffd9a0', '#8f9cff', '#9ab4ff'][n]); shaftM.opacity = [0.06, 0.03, 0.06][n];
    if (game.scene) game.scene.environmentIntensity = [0.5, 0.32, 0.3][n];
    ovenPanelM.color.set(n === 1 ? '#a8300c' : '#050403'); ovenGlow.intensity = n === 1 ? 4.5 : 0;
    steam.position.set(OX - 0.42, TOP + 0.24, OZ + 0.22);
    lightCandle(n === 1);
    if (n >= 1) pullChair(); else { guestChair.position.set(TB.x + 0.5, 0, TB.z + 0.84); guestChair.rotation.y = Math.PI + 0.25; }
    doll.visible = n < 2;
  }
  function setPage(n) {
    pageObjs.forEach(o => o.parent?.remove(o)); pageObjs = [];
    baked.forEach(m => { m.parent?.remove(m); m.geometry.dispose(); }); baked = [];
    served.forEach(c => c.parent?.remove(c)); served = []; pending = []; seated = []; dinner = false; idle = 0; knocked = false; pointAt = null; guestsIn = 0; peek = null;
    setAct(n); pageKeep = PAGE_KEEP[n];
    setFridge(false); setDrawer(false); setToast(false); setOven(false); water.visible = false;
    fridgeBusy = drawerBusy = popBusy = ovenBusy = false; anims.length = 0;
    dollPitch = 0; dollHead.rotation.x = 0; dollArm.rotation.set(ARM_REST, 0, 0);
    const page = PAGES[n], r = makeRng(400 + n * 31);
    const place = (key, s, isTarget = false) => {
      const o = key === 'anoko' ? strip(DOLL_BUILD()) : buildToy(key); if (key === 'anoko') { o.userData.itemId = key; peek = { head: o.getObjectByName('head'), yaw: 0 }; o.traverse(c => { delete c.raycast; }); }
      o.position.copy(s.p);
      if (s.rot) o.rotation.set(...s.rot); else o.rotation.set(r.range(-0.1, 0.1), r() * 6.28, r.range(-0.1, 0.1));
      if (key !== 'anoko') { if (s.h) sized(o, s.h); else o.scale.multiplyScalar((s.scale ?? TOY_SCALE) * (isTarget ? TARGET_SCALE : 1) * (isTarget ? 1 : r.range(0.92, 1.1))); }
      (s.parent || root).add(o);
      if (isTarget && key !== 'anoko') mergeStatic(o, { raycast: true });
      return o;
    };
    const targets = page.targets.map(([key, where]) => { const o = place(key, spots[where](), true); pageObjs.push(o); return { id: key, name: key === 'anoko' ? 'あの子' : TOY_MAP[key].name, obj: o }; });
    const sObj = place(page.secret[0], spots[page.secret[1]](), true); if (page.secret[2] === 'lens') sObj.userData.lensOnly = true; pageObjs.push(sObj);
    const secret = { id: page.secret[0], name: TOY_MAP[page.secret[0]].name, obj: sObj };
    // おとり：親ごとに1つのメッシュへまとめる
    const groups = new Map(); const add = (par, o) => { if (!groups.has(par)) groups.set(par, []); groups.get(par).push(o); };
    const used = new Set([...page.targets.map(t => t[0]), page.secret[0]]);
    TOYS.filter(d => !d.secret && !used.has(d.key) && r() < 0.6 * Math.max(q, 0.5)).forEach(d => add(root, place(d.key, toySpot(r))));
    SURF.forEach(s => fillSurface(s, r, o => add(root, o)));
    // 床に崩れた山
    [[-2.5, -1.3, 0.55, 0.28, 42], [2.6, -0.2, 0.5, 0.26, 36], [-0.5, 2.0, 0.42, 0.18, 22], [-1.6, 0.9, 0.38, 0.18, 18]].forEach(([x, z, R, H2, n2]) => { const c = V(x, 0, z); for (let i = 0; i < n2 * q; i++) { const o = makeWare(r); o.position.copy(moundPoint(r, c, R, H2)); o.rotation.set(r.range(-0.8, 0.8), r() * 6.28, r.range(-0.8, 0.8)); root.add(o); add(root, o); } });
    // フォークの束：1本ずつ傾きと大きさを変える
    for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283 + 0.4; add(root, place('fork', { p: V(DR.x + Math.cos(a) * 0.035, DR.y + 0.09, DR.z + Math.sin(a) * 0.035), rot: [r.range(-0.1, 0.1), r() * 6.28, Math.PI / 2 + r.range(-0.16, 0.16)], scale: r.range(0.92, 1.12) })); }
    // 冷蔵庫の中：棚いっぱい（お題のチーズの場所は空ける）
    SHELVES.forEach((y, si) => { for (let x = -0.33; x < 0.36; x += 0.15) for (let z = -0.26; z < 0.22; z += 0.16) { const px = x + r.range(-0.03, 0.03), pz = z + r.range(-0.03, 0.03); if (si === 1 && Math.hypot(px - 0.12, pz - 0.02) < 0.14) continue; const o = makeWare(r, ['jar', 'food', 'dish']); o.position.set(px, y + 0.008, pz); o.rotation.y = r() * 6.28; fridgeIn.add(o); add(fridgeIn, o); } });
    // 引き出しの中：道具でいっぱい（お題のマッチばこの場所は空ける）
    for (let x = -0.24; x < 0.25; x += 0.1) for (let z = -0.36; z < -0.06; z += 0.1) { if (Math.hypot(x - 0.12, z + 0.2) < 0.08) continue; const o = makeWare(r, ['tool']); o.position.set(x + r.range(-0.015, 0.015), -0.075, z); o.rotation.y = r() * 6.28; o.scale.multiplyScalar(0.55); drawerIn.add(o); add(drawerIn, o); }
    for (const [par, list] of groups) { const ms = bakeStatic(list, par); baked.push(...ms); list.forEach(o => o.parent?.remove(o)); }
    if (LITE) baked.forEach(m => { m.castShadow = false; });
    // 第一の幕で支度した夕ごはんは、第二の幕の食卓に残っている
    if (n === 1) { Object.entries(PLACES).forEach(([k, pl]) => { if (k === 'egg_gold') return; const o = strip(buildToy(k)); o.scale.multiplyScalar(TARGET_SCALE * 1.25); o.position.set(pl[0], pl[3] ? TB.y + 0.012 : PLATE_Y, pl[1]); o.rotation.y = pl[2]; root.add(o); served.push(o); }); }
    dollYaw = 0.6; left = targets.map(t => t.obj); secretObj = sObj;
    return { clearSub: page.clearSub, targets, secret, hasLens: page.secret[2] === 'lens', title: page.title };
  }

  return {
    id: 'kitchen', root, bounds: new THREE.Box3(V(-W, 0, -D), V(W, H, D)), colliders, spawn: { pos: V(0, 0, 3.0), yaw: 0 }, bgm: 'kitchen', pageCount: PAGES.length,
    ambience: { roomTone: 0.022, lowpass: 280, events: ['creak', 'drip'] },
    setPage, onFound,
    enter(scene, renderer) {
      scene.background = new THREE.Color('#120d09'); scene.fog = null;
      scene.environment = game.envTex; scene.environmentIntensity = 0.5;
      renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    },
    update(dt, t, cam) {
      for (let i = anims.length - 1; i >= 0; i--) { const a = anims[i]; a.t += dt; a.fn(Math.min(1, a.t / a.dur)); if (a.t >= a.dur) { anims.splice(i, 1); a.done?.(); } }
      pageObjs.forEach(o => { if (o.userData.lensOnly && !o.userData.found) o.visible = !!game.lens; });
      // 裸電球：ふだんは弱く、ときどき震えて暗くなる
      bulbs.forEach(b => { const n = Math.sin(t * 1.3 + b.ph) + Math.sin(t * 7.1 + b.ph * 2) * 0.4, k = n > 1.15 ? 0.25 + Math.random() * 0.3 : 1; b.L.intensity = b.power * k * lightK; b.g.visible = k > 0.5; });
      if (candleFlame.visible) candleLight.intensity = 2.3 + Math.sin(t * 11) * 0.2 + Math.sin(t * 23) * 0.15;
      if (act === 1) ovenGlow.intensity = 4.3 + Math.sin(t * 5) * 0.4 + Math.sin(t * 13) * 0.3;
      steam.visible = steamK > 0; if (steam.visible) { const sp = steamG.attributes.position; for (let i = 0; i < steamN; i++) { let y = sp.getY(i) + dt * 0.28 * (0.6 + (i % 5) * 0.2); if (y > 0.55) y = 0; sp.setY(i, y); sp.setX(i, Math.sin(t * 1.3 + i) * (0.02 + y * 0.12)); sp.setZ(i, Math.cos(t * 1.1 + i * 1.7) * (0.02 + y * 0.1)); } sp.needsUpdate = true; }
      if (ovenEyes.visible) { const blink = Math.sin(t * 1.9) > 0.985 || Math.sin(t * 0.73 + 1) > 0.995 ? 0.08 : 1; eyeBalls.forEach(e => { e.scale.y = blink; e.lookAt(cam.getWorldPosition(V())); }); }
      // ほこり
      const pp = dustG.attributes.position; for (let i = 0; i < dustN; i++) { pp.setY(i, pp.getY(i) + Math.sin(t * 0.4 + i) * 0.0005); pp.setX(i, pp.getX(i) + Math.cos(t * 0.3 + i * 1.3) * 0.0004); } pp.needsUpdate = true;
      // 食卓：見ていない間に並ぶ。カチャッという音で、振り返るきっかけを作る
      const tableHidden = !seen(tableMark, cam, 60);
      if (tableHidden) {
        if (pending.length) { const loud = pending.some(e => !e.quiet); pending.forEach(e => { if (e.c) { root.add(e.c); served.push(e.c); } if (e.show) e.show.visible = true; }); pending = []; if (loud) game.sfx.latch(tableMark.getWorldPosition(V())); }
        if (!dinner && !left.length && pageObjs.length) finale();
      }
      // 人形（第三の幕では先に見つかったお客）が、詰まっていると未発見の物を指す。気づかれなければ一度だけ物音
      if (pageObjs.length && (left.length || pointAt)) {
        idle += dt;
        if (!pointAt && idle > POINT_AFTER && left.length) pointAt = left[Math.floor(Math.random() * left.length)];
        if (pointAt && !knocked && idle > KNOCK_AFTER) { knocked = true; game.sfx.tap(tableMark.getWorldPosition(V())); }
      }
      // お客：見ていない間に向きを変える。ふだんはこちら、詰まると未発見の物、やかんが鳴ったらこちらの席
      if (tableHidden && seated.length) {
        const to = lookAtSeat ? YOUR_SEAT : pointAt && act === 2 ? pointAt.getWorldPosition(V()) : cam.getWorldPosition(V());
        seated.forEach(({ o, key }) => { const want = facingTo(key, o.position, to); let d = want - o.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); o.rotation.y += THREE.MathUtils.clamp(d, -dt * 1.6, dt * 1.6); });
      }
      // 第三の幕：隠れている人形は場所を変えず、見ていない間に物陰からのぞき直す
      if (peek && !seen(peek.head, cam, 50)) { const l = peek.head.parent.worldToLocal(cam.getWorldPosition(V())).sub(peek.head.position); const w = THREE.MathUtils.clamp(Math.atan2(l.x, l.z), -2.6, 2.6); peek.yaw += THREE.MathUtils.clamp(w - peek.yaw, -dt * 1.2, dt * 1.2); peek.head.rotation.y = peek.yaw; }
      if (doll.visible && !seen(doll, cam, 60)) {
        const tgt = pointAt ? pointAt.getWorldPosition(V()) : cam.getWorldPosition(V());
        const l = doll.worldToLocal(tgt.clone()).sub(dollHead.position);
        const wantYaw = THREE.MathUtils.clamp(Math.atan2(l.x, l.z), -2.9, 2.9), wantPitch = THREE.MathUtils.clamp(Math.atan2(-l.y, Math.hypot(l.x, l.z)), -0.6, 0.6);
        dollYaw += THREE.MathUtils.clamp(wantYaw - dollYaw, -dt * 1.2, dt * 1.2); dollPitch += THREE.MathUtils.clamp(wantPitch - dollPitch, -dt * 1.2, dt * 1.2);
        dollHead.rotation.set(dollPitch, dollYaw, 0, 'YXZ');
        if (pointAt) dollArm.lookAt(tgt); else dollArm.rotation.set(ARM_REST, 0, 0);
      }
    },
  };
}
