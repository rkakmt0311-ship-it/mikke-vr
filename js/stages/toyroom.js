// ステージ①：おもちゃ部屋（床はせまく、天井は高い。壁一面の棚・ボード・天井のネットに物がぎっしり）
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { V, makeRng, canvasTex, woodTex, mesh, setShadow, scatter, moundPoint, roundedBox, starShape, noRay, clamp01, lerp, smooth, disposeTree } from '../util.js';
import { TOYS, TOY_MAP, buildToy, isUltra } from '../catalog/toys.js';
import { bakeStatic } from '../bake.js';
import { tex } from '../assets.js';

const W = 5.6, D = 5.0, H = 6.4;
const LEVELS = [0.3, 0.9, 1.5, 2.1, 2.7, 3.3, 3.9, 4.5, 5.1, 5.7];
const TOP = 5.98;
const TOY_SCALE = 1.6;   // おもちゃの大きさ（棚の小部屋に対して）
// お題：[物, 隠し場所]  場所 = low/mid/high(棚の高さ), peg(壁のボード), net(天井のネット), top(棚のてっぺん), toybox, window, mobile, jack, behindTeddy
const PAGES = [
  { seed: 101, targets: [['car_blue', 'low'], ['duck', 'mid'], ['apple_red', 'peg'], ['dice_red', 'toybox'], ['star_gold', 'high'], ['key_gold', 'top']], secret: ['ghost', 'mobile'] },
  { seed: 202, targets: [['pencil_yellow', 'mid'], ['rocket', 'high'], ['block_あ', 'low'], ['clock_red', 'window'], ['matry_red', 'net'], ['button_pink', 'peg']], secret: ['egg_gold', 'jack'] },
  { seed: 303, targets: [['glasses', 'peg'], ['crown', 'high'], ['card_スペードA', 'mid'], ['heart_pink', 'low'], ['ball_stripe', 'net'], ['penguin', 'toybox']], secret: ['cat_black', 'behindTeddy'] },
];
const PLASTIC = ['#e63946', '#f4a261', '#ffd166', '#06d6a0', '#118ab2', '#7b2cbf', '#ff8fab', '#f1faee', '#2a9d8f', '#ef476f'];
const PASTEL = ['#ffadad', '#ffd6a5', '#fdffb6', '#caffbf', '#9bf6ff', '#a0c4ff', '#bdb2ff', '#ffc6ff'];
const BOOKC = ['#7a1f2b', '#1e3d59', '#2d6a4f', '#6b4f2a', '#b5651d', '#4a1f3a', '#c9a227', '#3d5a80', '#9c6644', '#264653', '#e76f51', '#588157'];

export function createToyRoom(game) {
  const q = game.quality.clutter;
  const rng = makeRng(77);
  const root = new THREE.Group();
  // 超高画質ではツヤのある物に上塗りの光沢を足す
  const P = (color, r = 0.3, m = 0, o = {}) => isUltra() && !o.transparent
    ? new THREE.MeshPhysicalMaterial({ color, roughness: r, metalness: m, clearcoat: r < 0.45 ? 0.6 : 0, clearcoatRoughness: 0.12, ...o })
    : new THREE.MeshStandardMaterial({ color, roughness: r, metalness: m, ...o });
  const animations = [];
  const animate = (dur, fn, done) => animations.push({ t: 0, dur, fn, done });
  const colliders = [];
  const box = (a, b, c, d, e, f) => colliders.push(new THREE.Box3(V(a, b, c), V(d, e, f)));
  const glossy = P('#fff', 0.14), plastic = P('#fff', 0.32), waxy = P('#fff', 0.6), paperM = P('#fff', 0.75);

  // ---------- 部屋 ----------
  const floor = mesh(new THREE.PlaneGeometry(W, D), P('#fff', 0.42, 0, { map: tex('toy_floor', woodTex(rng, 32, 40, [2, 2])) }), V(0, 0, 0), root, { cast: false });
  floor.rotation.x = -Math.PI / 2;
  const wallTex = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#e9dcc0'; c.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 64) { c.fillStyle = 'rgba(190,150,160,.35)'; c.fillRect(x, 0, 24, h); }
    c.fillStyle = 'rgba(160,120,90,.25)';
    for (let y = 32; y < h; y += 64) for (let x = 44; x < w; x += 64) { c.beginPath(); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2, r = i % 2 ? 4 : 9; c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } c.fill(); }
  }, [3, 4]);
  tex('toy_wall', wallTex);
  const wallM = P('#fff', 0.9, 0, { map: wallTex });
  [[V(0, H / 2, -D / 2), 0, W], [V(-W / 2, H / 2, 0), Math.PI / 2, D], [V(W / 2, H / 2, 0), -Math.PI / 2, D], [V(0, H / 2, D / 2), Math.PI, W]].forEach(([p, ry, w]) => {
    const m = mesh(new THREE.PlaneGeometry(w, H), wallM, p, root, { cast: false }); m.rotation.y = ry; });
  const ceilTex = canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#2b3a67'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffe9a8';
    for (let i = 0; i < 40; i++) { const x = Math.random() * w, y = Math.random() * h, r = 1 + Math.random() * 2.5; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); } }, [2, 2]);
  tex('toy_ceiling', ceilTex);
  const ceil = mesh(new THREE.PlaneGeometry(W, D), P('#fff', 0.9, 0, { map: ceilTex }), V(0, H, 0), root, { cast: false }); ceil.rotation.x = Math.PI / 2;

  // 高い窓（左の壁）
  const skyTex = canvasTex(256, 256, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#6a5a9a'); g.addColorStop(0.55, '#f2a46b'); g.addColorStop(1, '#ffd9a0');
    c.fillStyle = g; c.fillRect(0, 0, w, h); c.fillStyle = '#2b2233';
    let x = 0; while (x < w) { const bw = 20 + Math.random() * 30, bh = 30 + Math.random() * 60; c.fillRect(x, h - bh, bw, bh); x += bw; }
  });
  tex('toy_window', skyTex);
  const winM = new THREE.MeshBasicMaterial({ map: skyTex, toneMapped: false });
  const WIN = { z: 1.75, y: 3.7, w: 0.95, h: 1.5 };
  const win = mesh(new THREE.PlaneGeometry(WIN.w, WIN.h), winM, V(-W / 2 + 0.01, WIN.y, WIN.z), root, { cast: false }); win.rotation.y = Math.PI / 2;
  const frameM = P('#f3ead8', 0.5);
  mesh(new THREE.BoxGeometry(0.06, 0.06, WIN.w + 0.1), frameM, V(-W / 2 + 0.03, WIN.y + WIN.h / 2, WIN.z), root);
  mesh(new THREE.BoxGeometry(0.06, 0.06, WIN.w + 0.1), frameM, V(-W / 2 + 0.03, WIN.y, WIN.z), root);
  mesh(new THREE.BoxGeometry(0.06, WIN.h, 0.05), frameM, V(-W / 2 + 0.03, WIN.y, WIN.z), root);
  mesh(new THREE.BoxGeometry(0.26, 0.04, WIN.w + 0.2), frameM, V(-W / 2 + 0.13, WIN.y - WIN.h / 2 - 0.02, WIN.z), root);  // 窓台
  const SILL_Y = WIN.y - WIN.h / 2;

  // ---------- 光 ----------
  const sun = new THREE.DirectionalLight('#ffb070', 2.6); sun.position.set(-8, 7.5, WIN.z); sun.target.position.set(0.8, 1.5, -0.6);
  setShadow(sun, 5, game.quality.shadow, 25); root.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight('#fff0dc', '#4a3426', 0.8); root.add(hemi);
  const fill = new THREE.PointLight('#ffd9b0', 6, 0, 2); fill.position.set(0.5, 5.2, 0.6); root.add(fill);   // 上の棚を照らす
  // つり下げランプ（夜に灯る）
  const lampG = new THREE.Group(); lampG.position.set(1.0, H, 1.0); root.add(lampG);
  mesh(new THREE.CylinderGeometry(0.006, 0.006, 1.2, 4), P('#222'), V(0, -0.6, 0), lampG, { cast: false });
  const shadeM = P('#ffe3b0', 0.8, 0, { emissive: '#ffb35c', emissiveIntensity: 0, side: THREE.DoubleSide });
  mesh(new THREE.ConeGeometry(0.22, 0.2, 24, 1, true), shadeM, V(0, -1.25, 0), lampG, { cast: false });
  const lamp = new THREE.PointLight('#ffad55', 0, 0, 2); lamp.position.set(0, -1.32, 0); lampG.add(lamp);

  // ---------- 壁の棚 ----------
  // 棚ユニット：axis=棚の長さ方向, n=部屋側の向き
  const UNITS = [
    { id: 'back', a: V(-2.78, 0, -2.5), b: V(2.78, 0, -2.5), n: V(0, 0, 1), div: 5 },
    { id: 'left', a: V(-2.8, 0, -2.12), b: V(-2.8, 0, 0.95), n: V(1, 0, 0), div: 3 },
    { id: 'right', a: V(2.8, 0, 2.48), b: V(2.8, 0, 0.6), n: V(-1, 0, 0), div: 2 },
    { id: 'front', a: V(2.48, 0, 2.5), b: V(0.55, 0, 2.5), n: V(0, 0, -1), div: 2 },
  ];
  const DEPTH = 0.36;
  const woodM = P('#fff', 0.55, 0, { map: tex('toy_shelfwood', woodTex(rng, 30, 52, [1, 1])) });
  const plankList = [], backList = [];
  UNITS.forEach(u => {
    const dir = u.b.clone().sub(u.a), len = dir.length(); dir.normalize(); u.len = len; u.dir = dir;
    const yaw = Math.atan2(u.n.x, u.n.z); u.yaw = yaw;
    const mid = u.a.clone().add(u.b).multiplyScalar(0.5).addScaledVector(u.n, DEPTH / 2);
    LEVELS.forEach(y => plankList.push({ p: mid.clone().setY(y), yaw, s: V(len, 0.03, DEPTH) }));
    plankList.push({ p: mid.clone().setY(TOP), yaw, s: V(len, 0.04, DEPTH + 0.02) });
    for (let i = 0; i <= u.div; i++) { const p = u.a.clone().addScaledVector(dir, len * i / u.div).addScaledVector(u.n, DEPTH / 2); plankList.push({ p: p.setY(TOP / 2), yaw, s: V(0.035, TOP, DEPTH) }); }
    // 小部屋ごとに色ちがいの背板
    for (let i = 0; i < u.div; i++) for (let l = 0; l < LEVELS.length; l++) {
      const p = u.a.clone().addScaledVector(dir, len * (i + 0.5) / u.div).addScaledVector(u.n, 0.012); p.y = LEVELS[l] + 0.3;
      backList.push({ p, yaw, s: V(len / u.div, 0.6, 1), c: PASTEL[(i * 3 + l * 5 + u.id.length) % PASTEL.length] });
    }
    const bb = new THREE.Box3().setFromPoints([u.a.clone(), u.b.clone().addScaledVector(u.n, DEPTH + 0.02).setY(TOP)]); colliders.push(bb);
  });
  const inst = (geo, mat, list, { cast = true } = {}) => {
    const m = new THREE.InstancedMesh(geo, mat, list.length), d = new THREE.Object3D(), c = new THREE.Color();
    list.forEach((it, i) => { d.position.copy(it.p); d.rotation.set(it.rx || 0, it.yaw || 0, it.rz || 0); d.scale.copy(it.s || V(1, 1, 1)); d.updateMatrix(); m.setMatrixAt(i, d.matrix);
      if (it.c) m.setColorAt(i, c.set(it.c)); });
    m.castShadow = cast; m.receiveShadow = true; m.computeBoundingSphere(); root.add(m); return m;
  };
  inst(new THREE.BoxGeometry(1, 1, 1), woodM, plankList);
  inst(new THREE.PlaneGeometry(1, 1), P('#fff', 0.9, 0, { map: tex('toy_cubby', canvasTex(4, 4, c => { c.fillStyle = '#fff'; c.fillRect(0, 0, 4, 4); })) }), backList.map(b => ({ ...b, c: new THREE.Color(b.c).offsetHSL(0, -0.15, -0.05).getStyle() })), { cast: false });

  // 予約（ギミックを置く場所は空けておく）
  const RESERVE = [{ u: 'back', l: 1, t0: 0.62, t1: 0.74 }, { u: 'back', l: 3, t0: 0.42, t1: 0.52 }, { u: 'left', l: 2, t0: 0.45, t1: 0.6 }];
  const reserved = (u, l, t) => RESERVE.some(r => r.u === u.id && r.l === l && t > r.t0 && t < r.t1);

  // 棚の中身：本の列・ビンづめ・小さな山・「物を置くすきま」
  const books = [], jars = [], lids = [], small = { block: [], ball: [], crayon: [], coin: [], marble: [] };
  const slots = [];  // { p, yaw, l, u }
  UNITS.forEach(u => LEVELS.forEach((y, l) => {
    for (let ci = 0; ci < u.div; ci++) {
      const t0 = ci / u.div, t1 = (ci + 1) / u.div; let x = t0 * u.len + 0.04; const xe = t1 * u.len - 0.04;
      while (x < xe - 0.08) {
        const t = x / u.len; if (reserved(u, l, t)) { x += 0.05; continue; }
        const r = rng(), base = u.a.clone().addScaledVector(u.dir, x).setY(y + 0.015);
        const at = (dx, dz) => base.clone().addScaledVector(u.dir, dx).addScaledVector(u.n, dz);
        if (r < 0.3) {         // 本の列
          let w = 0; const n = 4 + Math.floor(rng() * 10 * q + 2);
          for (let k = 0; k < n && x + w < xe - 0.03; k++) { const th = rng.range(0.018, 0.05), bh = rng.range(0.13, Math.min(0.42, 0.55)), lean = rng() < 0.1 ? rng.range(-0.25, 0.25) : 0;
            books.push({ p: at(w + th / 2, rng.range(0.12, 0.2)).setY(y + 0.015 + bh / 2), yaw: u.yaw, rz: lean, s: V(th, bh, rng.range(0.16, 0.24)), c: new THREE.Color(rng.pick(BOOKC)).offsetHSL(rng.range(-0.03, 0.03), rng.range(-0.1, 0.1), rng.range(-0.06, 0.06)).getStyle() });
            w += th + 0.002; }
          x += w + 0.02;
        } else if (r < 0.38) { // ガラスビン（ビー玉入り）
          const jr = rng.range(0.05, 0.075), jh = rng.range(0.12, 0.2), c = at(jr + 0.01, 0.18);
          jars.push({ p: c.clone().setY(y + 0.015 + jh / 2), s: V(jr, jh, jr) }); lids.push({ p: c.clone().setY(y + 0.015 + jh + 0.01), s: V(jr * 1.05, 0.02, jr * 1.05), c: rng.pick(PLASTIC) });
          const kind = rng.pick(['marble', 'coin', 'marble', 'ball']);
          for (let k = 0; k < Math.round(28 * q); k++) { const a = rng() * 6.28, rr = Math.sqrt(rng()) * jr * 0.75; small[kind === 'ball' ? 'marble' : kind].push({ p: c.clone().add(V(Math.cos(a) * rr, 0, Math.sin(a) * rr)).setY(y + 0.03 + rng() * jh * 0.7) }); }
          x += jr * 2 + 0.04;
        } else if (r < 0.62) { // 小さな山
          const c = at(0.13, 0.18);
          for (let k = 0; k < Math.round(26 * q); k++) { const kind = rng.pick(['block', 'ball', 'crayon', 'coin', 'marble', 'block']); small[kind].push({ p: moundPoint(rng, c, 0.13, 0.14) }); }
          x += 0.27;
        } else {               // 物を置くすきま
          const w = rng.range(0.22, 0.3); slots.push({ p: at(w / 2, rng.range(0.2, 0.25)), yaw: u.yaw, l, u: u.id, t });
          const c = at(w / 2, 0.08);   // すきまの奥にも小物
          for (let k = 0; k < Math.round(10 * q); k++) { const kind = rng.pick(['block', 'ball', 'crayon', 'marble']); small[kind].push({ p: moundPoint(rng, c, 0.1, 0.1) }); }
          x += w;
        }
      }
    }
  }));
  // 棚のてっぺん
  const topSlots = [];
  UNITS.forEach(u => { for (let x = 0.15; x < u.len - 0.15; x += 0.3) topSlots.push({ p: u.a.clone().addScaledVector(u.dir, x).addScaledVector(u.n, rng.range(0.12, 0.24)).setY(TOP + 0.02), yaw: u.yaw }); });
  // 本とビン
  inst(new THREE.BoxGeometry(1, 1, 1), paperM, books);
  inst(new THREE.CylinderGeometry(1, 1, 1, 18, 1, true), P('#e8f6ff', 0.05, 0, { transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide }), jars, { cast: false });
  inst(new THREE.CylinderGeometry(1, 1, 1, 18), P('#fff', 0.3, 0.3), lids);
  const SG = {
    block: roundedBox(0.06, 0.06, 0.06, 0.008, 2), ball: new THREE.SphereGeometry(0.036, 10, 8), marble: new THREE.SphereGeometry(0.016, 8, 6),
    crayon: (() => { const a = new THREE.CylinderGeometry(0.007, 0.007, 0.07, 6); const b = new THREE.ConeGeometry(0.007, 0.016, 6); b.translate(0, 0.043, 0); return mergeGeometries([a, b]); })(),
    coin: new THREE.CylinderGeometry(0.018, 0.018, 0.006, 12),
  };
  const SM = { block: plastic, ball: glossy, marble: glossy, crayon: waxy, coin: P('#fff', 0.3, 0.6) };
  for (const k in small) if (small[k].length) { let i = 0; root.add(scatter(rng, SG[k], SM[k], small[k].length, () => small[k][i++].p, k === 'coin' ? ['#e0b13a', '#c9ccd1', '#b87333'] : PLASTIC.concat(PASTEL))); }

  // ---------- 右の壁：穴あきボード（物がぶら下がる） ----------
  const pegTex = canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#d9b98c'; c.fillRect(0, 0, w, h); c.fillStyle = '#7a5a3a'; for (let y = 8; y < h; y += 16) for (let x = 8; x < w; x += 16) { c.beginPath(); c.arc(x, y, 2.5, 0, 7); c.fill(); } }, [3, 6]);
  tex('toy_pegboard', pegTex);
  const PEG = { z0: -2.05, z1: 0.45, y0: 0.7, y1: 5.7 };
  const peg = mesh(new THREE.PlaneGeometry(PEG.z1 - PEG.z0, PEG.y1 - PEG.y0), P('#fff', 0.85, 0, { map: pegTex }), V(W / 2 - 0.02, (PEG.y0 + PEG.y1) / 2, (PEG.z0 + PEG.z1) / 2), root, { cast: false });
  peg.rotation.y = -Math.PI / 2;
  box(W / 2 - 0.06, 0, PEG.z0, W / 2, H, PEG.z1);
  const pegSlots = [];
  for (let y = PEG.y0 + 0.25; y < PEG.y1 - 0.15; y += 0.32) for (let z = PEG.z0 + 0.18; z < PEG.z1 - 0.1; z += 0.3) pegSlots.push({ p: V(W / 2 - 0.08, y + rng.range(-0.05, 0.05), z + rng.range(-0.06, 0.06)), yaw: -Math.PI / 2, peg: true });
  // フック
  root.add(scatter(rng, new THREE.CylinderGeometry(0.005, 0.005, 0.07, 6), P('#c9ccd1', 0.3, 1), pegSlots.length, (i) => pegSlots[i].p.clone().setX(W / 2 - 0.05).add(V(0, 0.06, 0)), null, { rot: () => V(0, 0, Math.PI / 2), vary: false }));
  // ボードにぶら下がった小物（ガーランド・フラッグ）
  const bunting = [];
  for (let k = 0; k < 3; k++) { const y = 2.2 + k * 1.4; for (let z = PEG.z0 + 0.05; z < PEG.z1; z += 0.12) bunting.push({ p: V(W / 2 - 0.035, y - Math.sin((z - PEG.z0) / (PEG.z1 - PEG.z0) * Math.PI) * 0.15, z), yaw: -Math.PI / 2, s: V(0.09, 0.11, 0.003), c: rng.pick(PLASTIC) }); }
  inst(new THREE.ConeGeometry(0.5, 1, 3).rotateZ(Math.PI), P('#fff', 0.9), bunting, { cast: false });

  // ---------- 天井近くのネット（ぬいぐるみが入っている） ----------
  const NET = { c: V(-2.0, 5.05, 1.75), r: 0.75 };
  const netTex = canvasTex(128, 128, (c, w, h) => { c.clearRect(0, 0, w, h); c.strokeStyle = '#f5f0e0'; c.lineWidth = 3; for (let i = 0; i <= w; i += 16) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, h); c.stroke(); c.beginPath(); c.moveTo(0, i); c.lineTo(w, i); c.stroke(); } }, [4, 4]);
  const netG = new THREE.CircleGeometry(NET.r, 24, 0, Math.PI * 2); const np = netG.attributes.position;
  const sag = (x, y) => -0.28 * (1 - Math.min(1, (x * x + y * y) / (NET.r * NET.r)));
  for (let i = 0; i < np.count; i++) np.setZ(i, sag(np.getX(i), np.getY(i))); netG.computeVertexNormals();
  const net = mesh(netG, P('#fff', 0.9, 0, { map: netTex, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide }), NET.c, root, { cast: true }); net.rotation.x = -Math.PI / 2;
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => mesh(new THREE.CylinderGeometry(0.004, 0.004, H - NET.c.y, 4), P('#ddd'), V(NET.c.x + a * NET.r * 0.7, (H + NET.c.y) / 2, NET.c.z + b * NET.r * 0.7), root, { cast: false }));
  const netPoint = (r) => { const a = r() * 6.28, d = Math.sqrt(r()) * NET.r * 0.7, x = Math.cos(a) * d, z = Math.sin(a) * d; return V(NET.c.x + x, NET.c.y + sag(x, z) + 0.01, NET.c.z + z); };
  // ネットの中のぬいぐるみ（大きめ）
  const plushCols = ['#f4c2c2', '#c3e5f2', '#f7e6a6', '#d6c3f2', '#c9e8c3', '#ffd6a5'];
  for (let i = 0; i < 7; i++) { const g = new THREE.Group(); g.position.copy(netPoint(rng)); g.rotation.set(rng.range(-0.5, 0.5), rng() * 6, rng.range(-0.4, 0.4)); root.add(g);
    const m = P(rng.pick(plushCols), 1), s = rng.range(0.9, 1.5);
    mesh(new THREE.SphereGeometry(0.12 * s, 14, 10), m, V(0, 0.1 * s, 0), g); mesh(new THREE.SphereGeometry(0.09 * s, 14, 10), m, V(0, 0.27 * s, 0), g);
    [-1, 1].forEach(k => mesh(i % 2 ? new THREE.CapsuleGeometry(0.025 * s, 0.12 * s, 4, 8) : new THREE.SphereGeometry(0.03 * s, 8, 6), m, V(k * 0.05 * s, 0.37 * s, 0), g));
    [-1, 1].forEach(k => mesh(new THREE.SphereGeometry(0.012 * s, 6, 4), P('#111', 0.1), V(k * 0.03 * s, 0.29 * s, 0.08 * s), g)); }

  // ---------- 床：ラグと少しだけのおもちゃ ----------
  const rugTex = canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#a7c4bc'; c.fillRect(0, 0, w, h);
    for (let r = 120; r > 0; r -= 16) { c.strokeStyle = r % 32 ? '#e6d5b8' : '#d98c8c'; c.lineWidth = 6; c.beginPath(); c.arc(128, 128, r, 0, 7); c.stroke(); } });
  tex('toy_rug', rugTex);
  const rug = mesh(new THREE.CircleGeometry(1.5, 48), P('#fff', 1, 0, { map: rugTex }), V(0, 0.004, 0), root, { cast: false }); rug.rotation.x = -Math.PI / 2;
  const floorFree = (x, z) => !colliders.some(b => x > b.min.x - 0.1 && x < b.max.x + 0.1 && z > b.min.z - 0.1 && z < b.max.z + 0.1);

  // ---------- 大きなくま（見ていないあいだに向きが変わる） ----------
  const fur = P('#8b5a2b', 1);
  const teddy = new THREE.Group(); teddy.position.set(-1.85, 0, -1.6); teddy.rotation.y = 0.6; root.add(teddy);
  mesh(new THREE.SphereGeometry(0.42, 24, 18), fur, V(0, 0.42, 0), teddy).scale.set(1, 1.05, 0.9);
  const tHead = new THREE.Group(); tHead.position.set(0, 0.98, 0.03); teddy.add(tHead);
  mesh(new THREE.SphereGeometry(0.3, 24, 18), fur, V(0, 0, 0), tHead);
  [-0.22, 0.22].forEach(x => { mesh(new THREE.SphereGeometry(0.1, 14, 10), fur, V(x, 0.24, -0.02), tHead); mesh(new THREE.SphereGeometry(0.06, 10, 8), P('#d9b38c', 1), V(x, 0.24, 0.04), tHead); });
  mesh(new THREE.SphereGeometry(0.11, 16, 12), P('#d9b38c', 1), V(0, -0.06, 0.25), tHead).scale.set(1, 0.8, 0.8);
  mesh(new THREE.SphereGeometry(0.035, 10, 8), P('#1a1a1a', 0.2), V(0, -0.02, 0.34), tHead);
  [-0.1, 0.1].forEach(x => mesh(new THREE.SphereGeometry(0.035, 12, 10), P('#111', 0.05), V(x, 0.07, 0.27), tHead));
  [-0.42, 0.42].forEach(x => mesh(new THREE.SphereGeometry(0.13, 14, 10), fur, V(x, 0.5, 0.12), teddy));
  [-0.22, 0.22].forEach(x => mesh(new THREE.SphereGeometry(0.16, 14, 10), fur, V(x, 0.14, 0.32), teddy));
  mesh(new THREE.TorusGeometry(0.2, 0.03, 8, 24), P('#7a1f2b', 0.6), V(0, 0.8, 0.06), teddy).rotation.x = Math.PI / 2 - 0.2;
  box(-2.35, 0, -2.1, -1.35, 1.25, -1.1);
  let teddyYaw = 0;

  // 棚の上の人形（目がこちらを追う）
  const back = UNITS[0];
  const doll = new THREE.Group(); doll.position.copy(back.a.clone().addScaledVector(back.dir, back.len * 0.47).addScaledVector(back.n, 0.18).setY(LEVELS[3] + 0.015)); root.add(doll);
  mesh(new THREE.ConeGeometry(0.12, 0.24, 20), P('#6b8fb5', 0.8), V(0, 0.12, 0), doll);
  mesh(new THREE.SphereGeometry(0.085, 20, 16), P('#f6dcc8', 0.6), V(0, 0.32, 0), doll);
  mesh(new THREE.SphereGeometry(0.091, 20, 16, 0, Math.PI * 2, 0, 1.4), P('#3a2418', 0.8), V(0, 0.333, -0.01), doll);
  const pupils = [];
  [-0.03, 0.03].forEach(x => { const e = mesh(new THREE.SphereGeometry(0.019, 12, 10), P('#fdfdfd', 0.2), V(x, 0.333, 0.068), doll);
    pupils.push(mesh(new THREE.SphereGeometry(0.0095, 10, 8), P('#1b2a4a', 0.05), V(0, 0, 0.013), e)); });

  // ---------- 天井のモビール ----------
  const mobile = new THREE.Group(); mobile.position.set(0, 5.55, -0.2); root.add(mobile);
  mesh(new THREE.CylinderGeometry(0.004, 0.004, H - 5.55, 4), P('#ddd'), V(0, (H - 5.55) / 2, 0), mobile, { cast: false });
  mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.03, 28), P('#f3ead8', 0.5), V(0, 0, 0), mobile);
  const hangs = [['#ffd166', 'star'], ['#bde0fe', 'moon'], ['#ffc8dd', 'star'], ['#caffbf', 'cloud'], ['#ffd6a5', 'star'], ['#cdb4db', 'moon']];
  hangs.forEach(([col, kind], i) => {
    const a = i / hangs.length * Math.PI * 2, len = 0.3 + (i % 2) * 0.3, x = Math.cos(a) * 0.55, z = Math.sin(a) * 0.55;
    mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.55, 4), P('#ccc'), V(x / 2, 0, z / 2), mobile, { cast: false }).rotation.set(0, -a, Math.PI / 2);
    mesh(new THREE.CylinderGeometry(0.003, 0.003, len, 4), P('#ccc'), V(x, -len / 2, z), mobile, { cast: false });
    let g;
    if (kind === 'star') { g = new THREE.ExtrudeGeometry(starShape(0.15, 0.07), { depth: 0.03, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01 }); g.center(); }
    else if (kind === 'moon') { const s = new THREE.Shape(); s.absarc(0, 0, 0.15, 0, Math.PI * 2); const h2 = new THREE.Path(); h2.absarc(0.06, 0.03, 0.13, 0, Math.PI * 2); s.holes.push(h2); g = new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: false }); g.center(); }
    else g = mergeGeometries([new THREE.SphereGeometry(0.09, 12, 8), new THREE.SphereGeometry(0.07, 12, 8).translate(0.1, -0.02, 0), new THREE.SphereGeometry(0.07, 12, 8).translate(-0.1, -0.02, 0)]);
    mesh(g, P(col, 0.3), V(x, -len - 0.14, z), mobile);
  });
  // 天井のガーランド
  const garland = [];
  [[V(-2.7, 6.1, -2.3), V(2.7, 6.1, 2.3)], [V(2.7, 6.0, -2.3), V(-2.7, 6.0, 2.3)]].forEach(([a, b]) => { for (let t = 0; t <= 1; t += 0.03) {
    const p = a.clone().lerp(b, t); p.y -= Math.sin(t * Math.PI) * 0.45; garland.push({ p, yaw: Math.atan2(b.x - a.x, b.z - a.z) + Math.PI / 2, s: V(0.12, 0.16, 0.003), c: rng.pick(PLASTIC) }); } });
  inst(new THREE.ConeGeometry(0.5, 1, 3).rotateZ(Math.PI), P('#fff', 0.9), garland, { cast: false });

  // ---------- 楽器 ----------
  // トイピアノ（窓の下）
  const piano = new THREE.Group(); piano.position.set(-2.38, 0, WIN.z); piano.rotation.y = Math.PI / 2; root.add(piano);
  const pianoM = P('#c1121f', 0.18, 0.1);
  mesh(roundedBox(0.95, 0.42, 0.5, 0.04, 3), pianoM, V(0, 0.27, -0.02), piano);
  mesh(roundedBox(0.95, 0.28, 0.06, 0.02, 2), pianoM, V(0, 0.6, -0.24), piano);
  [-0.42, 0.42].forEach(x => mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.1, 10), P('#d4af37', 0.25, 1), V(x, 0.05, 0.1), piano));
  for (let i = 0; i < 10; i++) {
    const k = mesh(new THREE.BoxGeometry(0.082, 0.03, 0.17), P('#fbf7ee', 0.25), V(-0.37 + i * 0.0855, 0.5, 0.15), piano);
    k.userData.interact = { kind: 'play', dwell: 0.6, fn: () => { game.sfx.toyPiano(i, k.getWorldPosition(V())); k.position.y = 0.485; setTimeout(() => k.position.y = 0.5, 160); } };
    if (i % 5 !== 2 && i % 5 !== 4 && i < 9) mesh(new THREE.BoxGeometry(0.045, 0.03, 0.1), P('#1a1a1a', 0.3), V(-0.33 + i * 0.0855, 0.53, 0.11), piano).raycast = () => {};
  }
  box(-2.8, 0, WIN.z - 0.5, -2.1, 0.75, WIN.z + 0.5);

  // 木琴
  const xylo = new THREE.Group(); xylo.position.set(-0.55, 0, -0.55); xylo.rotation.y = 0.25; root.add(xylo);
  [-0.12, 0.12].forEach(z => mesh(new THREE.BoxGeometry(0.85, 0.06, 0.04), P('#7a5236', 0.5), V(0, 0.05, z), xylo));
  ['#e63946', '#f77f00', '#fcbf49', '#80b918', '#2a9d8f', '#118ab2', '#5e60ce', '#c77dff'].forEach((col, i) => {
    const b = mesh(roundedBox(0.075, 0.025, 0.32 - i * 0.022, 0.008, 2), P(col, 0.3, 0.2), V(-0.35 + i * 0.1, 0.095, 0), xylo);
    b.userData.interact = { kind: 'play', dwell: 0.6, fn: () => { game.sfx.xylophone(i, b.getWorldPosition(V())); b.position.y = 0.085; setTimeout(() => b.position.y = 0.095, 120); } };
  });
  // 太鼓
  const drum = new THREE.Group(); drum.position.set(0.7, 0, -0.85); root.add(drum);
  mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.28, 28), P('#1d4ed8', 0.25, 0.2), V(0, 0.14, 0), drum);
  const skin = mesh(new THREE.CylinderGeometry(0.235, 0.235, 0.01, 28), P('#f5ecd7', 0.7), V(0, 0.285, 0), drum);
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; const z = mesh(new THREE.BoxGeometry(0.01, 0.28, 0.01), P('#ffd166', 0.3), V(Math.cos(a) * 0.243, 0.14, Math.sin(a) * 0.243), drum); z.rotation.y = -a; z.rotation.z = (i % 2 ? 0.5 : -0.5); }
  drum.children.forEach(c => c.userData.interact = { kind: 'play', dwell: 0.6, fn: () => { game.sfx.drum(drum.getWorldPosition(V())); skin.scale.set(1, 0.4, 1); setTimeout(() => skin.scale.set(1, 1, 1), 100); } });
  box(0.45, 0, -1.1, 0.95, 0.3, -0.6);

  // シンバルを持ったサル（奥の棚2段目）
  const monkey = new THREE.Group(); monkey.position.copy(back.a.clone().addScaledVector(back.dir, back.len * 0.68).addScaledVector(back.n, 0.18).setY(LEVELS[1] + 0.015)); root.add(monkey);
  const mFur = P('#6b3f1d', 0.9), mFace = P('#e8c49a', 0.7);
  mesh(new THREE.SphereGeometry(0.08, 14, 10), P('#c1121f', 0.4), V(0, 0.1, 0), monkey).scale.set(1, 1.2, 0.9);
  mesh(new THREE.SphereGeometry(0.065, 14, 10), mFur, V(0, 0.24, 0), monkey);
  mesh(new THREE.SphereGeometry(0.045, 12, 8), mFace, V(0, 0.23, 0.035), monkey);
  [-0.066, 0.066].forEach(x => mesh(new THREE.SphereGeometry(0.025, 10, 8), mFace, V(x, 0.26, 0), monkey));
  [-0.018, 0.018].forEach(x => mesh(new THREE.SphereGeometry(0.009, 8, 6), P('#111', 0.1), V(x, 0.25, 0.072), monkey));
  const arms = [-1, 1].map(k => { const a = new THREE.Group(); a.position.set(k * 0.07, 0.15, 0.02); monkey.add(a);
    mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.1, 8), mFur, V(k * 0.03, 0, 0.04), a).rotation.x = Math.PI / 2.4;
    mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.006, 20), P('#e0b13a', 0.15, 1), V(k * 0.03, 0.01, 0.09), a).rotation.z = Math.PI / 2;
    a.rotation.y = k * 0.5; return a; });
  let monkeyT = -1;
  monkey.traverse(o => { if (o.isMesh) o.userData.interact = { kind: 'play', dwell: 0.8, fn: () => { if (monkeyT < 0) monkeyT = 0; } }; });

  // オルゴール（左の棚3段目）
  const left = UNITS[1];
  const mbox = new THREE.Group(); mbox.position.copy(left.a.clone().addScaledVector(left.dir, left.len * 0.52).addScaledVector(left.n, 0.18).setY(LEVELS[2] + 0.015)); mbox.rotation.y = left.yaw; root.add(mbox);
  mesh(roundedBox(0.24, 0.12, 0.17, 0.015, 2), P('#7a1f2b', 0.25), V(0, 0.06, 0), mbox);
  mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.012, 20), P('#d4af37', 0.25, 1), V(0, 0.126, 0), mbox);
  const ballerina = new THREE.Group(); ballerina.position.y = 0.13; mbox.add(ballerina);
  mesh(new THREE.ConeGeometry(0.035, 0.045, 16), P('#ffc8dd', 0.6), V(0, 0.04, 0), ballerina);
  mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.04, 6), P('#f6dcc8'), V(0, 0.015, 0), ballerina);
  mesh(new THREE.SphereGeometry(0.013, 10, 8), P('#f6dcc8', 0.6), V(0, 0.085, 0), ballerina);
  const crank = mesh(new THREE.BoxGeometry(0.01, 0.05, 0.01), P('#d4af37', 0.3, 1), V(0.13, 0.06, 0), mbox);
  let mbT = -1;
  const MELODY = [7, 9, 7, 5, 4, 5, 7, -1, 4, 5, 4, 2, 0, 2, 4, -1, 7, 9, 10, 9, 7, 5, 4, -1, 2, 4, 2, 0, -1, 0, -1, -1];
  const playMusicBox = () => { if (mbT >= 0) return; mbT = 0; let w = 0;
    MELODY.forEach((n, i) => { if (n >= 0) game.sfx.musicBoxNote(n, mbox.getWorldPosition(V()), w, 1); w += 0.34 + i * 0.006; }); };
  mbox.traverse(o => { if (o.isMesh) o.userData.interact = { kind: 'play', dwell: 1.0, fn: playMusicBox }; });

  // ---------- ギミック：おもちゃ箱 ----------
  const tbox = new THREE.Group(); tbox.position.set(1.55, 0, 0.55); tbox.rotation.y = -0.35; root.add(tbox);
  const tbM = P('#2a6f97', 0.3), tbTrim = P('#ffd166', 0.3);
  mesh(new THREE.BoxGeometry(1.1, 0.06, 0.8), tbM, V(0, 0.03, 0), tbox);
  [[0, 0.37, 0.37, 1.1, 0.7, 0.06], [0, 0.37, -0.37, 1.1, 0.7, 0.06], [0.52, 0.37, 0, 0.06, 0.7, 0.8], [-0.52, 0.37, 0, 0.06, 0.7, 0.8]].forEach(([x, y, z, w, h, d]) => mesh(new THREE.BoxGeometry(w, h, d), tbM, V(x, y, z), tbox));
  [[0, 0.39, 1.14, 0.08], [0, -0.39, 1.14, 0.08], [0.54, 0, 0.08, 0.82], [-0.54, 0, 0.08, 0.82]].forEach(([x, z, w, d]) => mesh(new THREE.BoxGeometry(w, 0.05, d), tbTrim, V(x, 0.72, z), tbox));
  const tbLetters = canvasTex(256, 128, (c, w, h) => { c.fillStyle = '#2a6f97'; c.fillRect(0, 0, w, h); c.font = 'bold 70px sans-serif'; c.textAlign = 'center';
    ['T', 'O', 'Y', 'S'].forEach((ch, i) => { c.fillStyle = ['#ffd166', '#ef476f', '#06d6a0', '#fff'][i]; c.fillText(ch, 40 + i * 58, 92); }); });
  tex('toy_toybox', tbLetters);
  mesh(new THREE.PlaneGeometry(0.8, 0.4), P('#fff', 0.4, 0, { map: tbLetters }), V(0, 0.37, 0.402), tbox).raycast = () => {};
  const lidPivot = new THREE.Group(); lidPivot.position.set(0, 0.74, -0.4); tbox.add(lidPivot);
  mesh(roundedBox(1.16, 0.07, 0.84, 0.025, 2), tbM, V(0, 0, 0.4), lidPivot);
  mesh(new THREE.SphereGeometry(0.04, 12, 8), tbTrim, V(0, 0.02, 0.82), lidPivot);
  const lc = V(0, 0.18, 0);
  tbox.add(scatter(rng, SG.ball, glossy, 90 * q, () => moundPoint(rng, lc, 0.44, 0.42), PLASTIC));
  tbox.add(scatter(rng, SG.block, plastic, 120 * q, () => moundPoint(rng, lc, 0.44, 0.45), PLASTIC.concat(PASTEL)));
  let lidOpen = false;
  const toggleLid = () => { lidOpen = !lidOpen; game.sfx.boxCreak(tbox.getWorldPosition(V()), lidOpen);
    const from = lidPivot.rotation.x, to = lidOpen ? -1.95 : 0; animate(0.9, t => lidPivot.rotation.x = lerp(from, to, smooth(t))); };
  lidPivot.traverse(o => { if (o.isMesh) o.userData.interact = { kind: 'gimmick', dwell: 1.2, fn: toggleLid }; });
  box(0.95, 0, 0.0, 2.15, 0.78, 1.1);

  // ---------- ギミック：びっくり箱 ----------
  const jack = new THREE.Group(); jack.position.set(-1.35, 0, 0.75); jack.rotation.y = 0.5; root.add(jack);
  const jTex = canvasTex(128, 128, (c) => { for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { c.fillStyle = (x + y) % 2 ? '#ef476f' : '#ffd166'; c.fillRect(x * 32, y * 32, 32, 32); } });
  const jBody = mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), P('#fff', 0.3, 0, { map: jTex }), V(0, 0.15, 0), jack);
  const jCrank = new THREE.Group(); jCrank.position.set(0.16, 0.15, 0); jack.add(jCrank);
  mesh(new THREE.BoxGeometry(0.02, 0.1, 0.02), P('#d4af37', 0.3, 1), V(0, 0.04, 0), jCrank); mesh(new THREE.SphereGeometry(0.02, 8, 6), P('#c1121f', 0.3), V(0.02, 0.09, 0), jCrank);
  const jLidPivot = new THREE.Group(); jLidPivot.position.set(0, 0.3, -0.15); jack.add(jLidPivot);
  mesh(new THREE.BoxGeometry(0.31, 0.02, 0.31), P('#118ab2', 0.3), V(0, 0.01, 0.15), jLidPivot);
  const clown = new THREE.Group(); clown.visible = false; jack.add(clown);
  mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.3, 12, 6, true), P('#c9c9c9', 0.3, 0.9, { side: THREE.DoubleSide }), V(0, 0.15, 0), clown);
  mesh(new THREE.SphereGeometry(0.08, 18, 14), P('#fbe3d0', 0.5), V(0, 0.36, 0), clown);
  mesh(new THREE.SphereGeometry(0.02, 8, 6), P('#e63946', 0.3), V(0, 0.35, 0.08), clown);
  [-0.028, 0.028].forEach(x => mesh(new THREE.SphereGeometry(0.01, 8, 6), P('#111', 0.1), V(x, 0.38, 0.07), clown));
  mesh(new THREE.TorusGeometry(0.07, 0.02, 8, 18), P('#7b2cbf', 0.5), V(0, 0.28, 0), clown).rotation.x = Math.PI / 2;
  mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.08, 18), P('#222', 0.4), V(0, 0.47, 0), clown);
  mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.01, 18), P('#222', 0.4), V(0, 0.43, 0), clown);
  const hatTop = new THREE.Group(); hatTop.position.y = 0.51; clown.add(hatTop);
  let jackOpen = false, jackBusy = false;
  const toggleJack = () => {
    if (jackBusy) return; jackBusy = true;
    if (!jackOpen) {
      [0, 2, 4, 2, 0, 2].forEach((n, i) => game.sfx.musicBoxNote(n, jack.getWorldPosition(V()), i * 0.28, 0.8));
      animate(1.7, t => jCrank.rotation.x = t * 12, () => {
        game.sfx.spring(jack.getWorldPosition(V())); clown.visible = true;
        animate(0.9, t => { jLidPivot.rotation.x = -2.2 * Math.min(1, t * 4); clown.position.y = 0.18 * (1 - Math.exp(-6 * t) * Math.cos(14 * t)); }, () => { jackOpen = true; jackBusy = false; });
      });
    } else {
      game.sfx.boxCreak(jack.getWorldPosition(V()), false);
      animate(0.6, t => { clown.position.y = 0.18 * (1 - t); jLidPivot.rotation.x = -2.2 * (1 - t); }, () => { clown.visible = false; jackOpen = false; jackBusy = false; });
    }
  };
  [jBody, ...jCrank.children, ...jLidPivot.children].forEach(o => o.userData.interact = { kind: 'gimmick', dwell: 1.2, fn: toggleJack });
  clown.traverse(o => { if (o.isMesh) o.userData.interact = { kind: 'gimmick', dwell: 1.2, fn: toggleJack }; });
  box(-1.55, 0, 0.55, -1.15, 0.35, 0.95);

  // ---------- 隠し場所 ----------
  const band = { low: [0, 1, 2], mid: [3, 4, 5], high: [6, 7, 8, 9] };
  function makeSpots(r) {
    const pools = { shelf: r.shuffle(slots), peg: r.shuffle(pegSlots), top: r.shuffle(topSlots) };
    const take = (type) => {
      if (band[type]) { const i = pools.shelf.findIndex(s => band[type].includes(s.l)); return i >= 0 ? pools.shelf.splice(i, 1)[0] : pools.shelf.pop(); }
      if (type === 'shelf') return pools.shelf.pop();
      if (type === 'peg') return pools.peg.pop();
      if (type === 'top') return pools.top.pop();
      if (type === 'net') return { p: netPoint(r), yaw: r() * 6.28, tilt: true };
      if (type === 'toybox') return { p: moundPoint(r, lc, 0.4, 0.42, true, 0.7), parent: tbox, tilt: true };
      if (type === 'window') return { p: V(-W / 2 + r.range(0.06, 0.2), SILL_Y + 0.02, WIN.z + r.range(-0.4, 0.4)), yaw: Math.PI / 2 + r.range(-0.5, 0.5) };
      if (type === 'mobile') return { p: V(0.05, 0.016, 0.05), parent: mobile, yaw: 0 };
      if (type === 'jack') return { p: V(0, 0, 0), parent: hatTop, yaw: 0 };
      if (type === 'behindTeddy') return { p: V(-2.3, 0, -1.95), yaw: 0.6 };
      if (type === 'floor') { let x, z; do { x = r.range(-2.3, 2.3); z = r.range(-1.9, 1.9); } while (!floorFree(x, z)); return { p: V(x, 0, z), yaw: r() * 6.28 }; }
    };
    return take;
  }

  // ---------- ページ ----------
  let pageItems = [], baked = [];
  function setPage(n) {
    pageItems.forEach(o => o.parent?.remove(o)); pageItems = [];
    baked.forEach(m => { root.remove(m); m.geometry.dispose(); }); baked = [];
    if (lidOpen) { lidOpen = false; lidPivot.rotation.x = 0; }
    if (jackOpen || jackBusy) { jackOpen = false; jackBusy = false; clown.visible = false; clown.position.y = 0; jLidPivot.rotation.x = 0; }
    const page = PAGES[n], r = makeRng(page.seed), take = makeSpots(r);
    const place = (key, type, parentOverride) => {
      const o = buildToy(key), s = take(type); if (!s) return null;
      o.position.copy(s.p);
      if (s.tilt) o.rotation.set(r.range(-0.7, 0.7), r() * 6.28, r.range(-0.7, 0.7));
      else o.rotation.set(0, (s.yaw ?? 0) + r.range(-0.6, 0.6), 0);
      if (s.peg) { o.rotation.set(r.range(-0.3, 0.3), -Math.PI / 2, r.range(-0.4, 0.4)); }
      o.scale.multiplyScalar(TOY_SCALE * r.range(0.92, 1.12));   // 部屋に合わせて大きく。同じ物でも毎回少し大きさが違う
      (parentOverride || s.parent || root).add(o); return o;
    };
    const targets = page.targets.map(([key, type]) => { const obj = place(key, type); pageItems.push(obj); return { id: key, name: TOY_MAP[key].name, obj }; });
    const secret = { id: page.secret[0], name: TOY_MAP[page.secret[0]].name, obj: place(page.secret[0], page.secret[1]) }; pageItems.push(secret.obj);
    // お題以外は全部「おとり」として置き、まとめて描画する
    const used = new Set(page.targets.map(t => t[0]));
    const decoyTypes = ['shelf', 'shelf', 'shelf', 'shelf', 'shelf', 'shelf', 'shelf', 'shelf', 'peg', 'peg', 'top', 'net', 'toybox'];
    const rootDecoys = [], boxDecoys = [];
    TOYS.filter(d => !d.secret && !used.has(d.key)).forEach(d => {
      const type = r.pick(decoyTypes); const o = place(d.key, type, type === 'toybox' ? tbox : root); if (!o) return;
      (type === 'toybox' ? boxDecoys : rootDecoys).push(o);
    });
    baked.push(...bakeStatic(rootDecoys, root));
    if (boxDecoys.length) baked.push(...bakeStatic(boxDecoys, tbox).map(m => { tbox.remove(m); m.applyMatrix4(tbox.matrix); root.add(m); return m; }));
    rootDecoys.concat(boxDecoys).forEach(o => o.parent?.remove(o));
    return { targets, secret, title: `おもちゃの へや　ページ ${n + 1}` };
  }

  const bounds = new THREE.Box3(V(-W / 2, 0, -D / 2), V(W / 2, H, D / 2));
  let elapsed = 0;
  const sunDay = new THREE.Color('#ffb070'), sunNight = new THREE.Color('#5d74b8'), skyDay = new THREE.Color('#ffffff'), skyNight = new THREE.Color('#3a4880');
  const tmp = V(), camDir = V(), toCam = V();

  return {
    id: 'toyroom', root, bounds, colliders, spawn: { pos: V(0, 0, 1.6), yaw: 0 }, bgm: 'toyroom', pageCount: 3,
    toyCount: TOYS.filter(d => !d.secret).length,
    ambience: { roomTone: 0.025, lowpass: 320, events: ['creak', 'chime'] },
    setPage,
    enter(scene, renderer) {
      scene.background = new THREE.Color('#1a1410'); scene.fog = null;
      scene.environment = game.envTex; scene.environmentIntensity = 0.5;
      renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
      elapsed = 0;
    },
    update(dt, t, cam) {
      elapsed += dt;
      for (let i = animations.length - 1; i >= 0; i--) { const a = animations[i]; a.t += dt; a.fn(Math.min(1, a.t / a.dur)); if (a.t >= a.dur) { animations.splice(i, 1); a.done?.(); } }
      // 夕方→夜（約4分）
      const n = smooth(clamp01(elapsed / 240));
      sun.color.copy(sunDay).lerp(sunNight, n); sun.intensity = lerp(2.6, 0.6, n);
      hemi.intensity = lerp(0.8, 0.3, n); fill.intensity = lerp(6, 2.5, n); winM.color.copy(skyDay).lerp(skyNight, n);
      const ln = clamp01((n - 0.45) / 0.4); lamp.intensity = ln * 6; shadeM.emissiveIntensity = ln * 1.4;
      game.scene.environmentIntensity = lerp(0.5, 0.22, n);
      mobile.rotation.y += dt * 0.12;
      // くま：見ていないあいだだけ、こちらへ首を向ける
      cam.getWorldDirection(camDir); cam.getWorldPosition(tmp);
      tHead.getWorldPosition(toCam).sub(tmp).normalize();
      if (camDir.dot(toCam) < Math.cos(THREE.MathUtils.degToRad(60))) {
        const local = teddy.worldToLocal(tmp.clone()); const want = THREE.MathUtils.clamp(Math.atan2(local.x, local.z), -0.9, 0.9);
        teddyYaw += THREE.MathUtils.clamp(want - teddyYaw, -dt * 0.25, dt * 0.25); tHead.rotation.y = teddyYaw;
      }
      pupils.forEach(p => { const l = p.parent.worldToLocal(tmp.clone()).normalize(); p.position.copy(l.multiplyScalar(0.013)); });
      if (monkeyT >= 0) {
        const prev = monkeyT; monkeyT += dt;
        arms.forEach((a, k) => a.rotation.y = (k ? 1 : -1) * (0.5 - 0.45 * Math.max(0, Math.sin(monkeyT * 9))));
        if (Math.floor(prev * 9 / Math.PI / 2 + 0.25) !== Math.floor(monkeyT * 9 / Math.PI / 2 + 0.25)) game.sfx.cymbal(monkey.getWorldPosition(V()));
        if (monkeyT > 3.2) { monkeyT = -1; arms.forEach((a, k) => a.rotation.y = (k ? 1 : -1) * 0.5); }
      }
      if (mbT >= 0) { mbT += dt; const sp = Math.max(0, 1 - mbT / 13); ballerina.rotation.y += dt * 2.2 * sp; crank.rotation.x -= dt * 2 * sp; if (mbT > 13) mbT = -1; }
    },
  };
}
