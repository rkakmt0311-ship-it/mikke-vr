// ステージ①：屋根裏部屋（docs/attic-design.md の設計。Gemini 4 Argon High と相談して決定）
// 中央にグランドピアノ、本の螺旋塔、トランクと三面鏡、ドールハウス、木馬、くまの椅子、梁から吊るされた物
import * as THREE from 'three';
import { V, makeRng, canvasTex, woodTex, mesh, setShadow, scatter, moundPoint, roundedBox, starShape, noRay, clamp01, lerp, smooth } from '../util.js';
import { TOYS, TOY_MAP, buildToy, isUltra } from '../catalog/toys.js';
import { bakeStatic, mergeStatic } from '../bake.js';
import { tex, swapModel, hasModel } from '../assets.js';
import { addAtticFx } from './attic_fx.js';

const W = 3, D = 2.8, KNEE = 2.0, RIDGE = 6.0;              // x: -3〜3, z: -2.8〜2.8
const roofY = x => RIDGE - Math.min(1, Math.abs(x) / W) * (RIDGE - KNEE);
const TOY_SCALE = 1.25;
const MUTED = ['#7a6a55', '#8c7b63', '#5f6b5a', '#6b5a4a', '#9a8a72', '#4f5a52', '#806a5a', '#a39074'];   // くすみ色70%
const AMBER = ['#c9a227', '#b5651d', '#d4a537', '#e0b13a'];                                              // 琥珀20%
const POISON = ['#c1121f', '#1f5fd1', '#7b2cbf', '#06d6a0'];                                            // 毒10%
const mix = (r) => { const t = r(); return t < 0.7 ? r.pick(MUTED) : t < 0.9 ? r.pick(AMBER) : r.pick(POISON); };
const BOOKC = ['#5a1a1a', '#1e3d2f', '#2b2f4a', '#6b4f2a', '#3a2a1a', '#7a6a4a', '#4a1f3a', '#8a7a5a', '#264653', '#9c6644'];

// お題（3幕：夕暮れ／マジックアワー／真夜中）
// 3つめの 'lens' ＝ ルーペでしか見えない
const PAGES = [
  { act: 0, targets: [['fountain_pen', 'pianoKeys'], ['paintbrush', 'horseMane'], ['ring_ruby', 'hornDeep'], ['ship_bottle', 'windowSill'], ['pocket_watch', 'armillary'], ['scissors', 'lanternInside']], secret: ['crown', 'spiralTop', 'lens'] },
  { act: 1, targets: [['sofa_mini', 'dollTop'], ['key_gold', 'monkeyChest'], ['butterfly_specimen', 'trunkLid'], ['flute', 'pianoInside'], ['snail', 'bearEar'], ['monocle', 'roundPile', 'lens']], secret: ['clown', 'coffinInside'] },
  { act: 2, targets: [['glow_star', 'ridgeFlags'], ['skull', 'cageBottom'], ['violin_mini', 'dollGround'], ['dice_red', 'cushion'], ['compass', 'horseRocker', 'lens'], ['feather', 'musicRack']], secret: ['owl', 'behindBear'] },
];
const TARGET_SCALE = 0.7;   // お題は小さめ（見つけづらく）

export function createAttic(game) {
  const q = game.quality.clutter;
  const rng = makeRng(2026);
  const root = new THREE.Group();
  // 同じ見た目の材質は使い回す（まとめ描画が効くように）
  const matCache = new Map();
  const P = (color, r = 0.4, m = 0, o = {}) => {
    const key = [color, r, m, ...Object.entries(o).map(([k, v]) => k + ':' + (v?.uuid ?? (v?.isColor ? v.getHexString() : v)))].join('|');
    if (matCache.has(key)) return matCache.get(key);
    const mat = isUltra() && !o.transparent
      ? new THREE.MeshPhysicalMaterial({ color, roughness: r, metalness: m, clearcoat: r < 0.3 ? 0.8 : 0, clearcoatRoughness: 0.08, ...o })
      : new THREE.MeshStandardMaterial({ color, roughness: r, metalness: m, ...o });
    matCache.set(key, mat); return mat;
  };
  const LITE = !!game.quality.lite;   // Quest向け：小物は影を落とさない
  const anims = []; const animate = (dur, fn, done) => anims.push({ t: 0, dur, fn, done });
  const colliders = [], box = (a, b, c, d, e, f) => colliders.push(new THREE.Box3(V(a, b, c), V(d, e, f)));
  const spots = {};                // 名前つきの隠し場所 → () => { p, parent?, rot? }
  const pools = {};                // おとりを置く場所の候補
  const pool = (name, fn) => (pools[name] ||= []).push(fn);
  const glossy = P('#fff', 0.12), plastic = P('#fff', 0.35), matte = P('#fff', 0.85), metalM = P('#fff', 0.3, 1);
  const inst = (geo, mat, list, { cast = true } = {}) => {
    if (!list.length) return null;
    const m = new THREE.InstancedMesh(geo, mat, list.length), d = new THREE.Object3D(), c = new THREE.Color();
    list.forEach((it, i) => { d.position.copy(it.p); d.rotation.set(it.rx || 0, it.ry || 0, it.rz || 0); d.scale.copy(it.s || V(1, 1, 1)); d.updateMatrix(); m.setMatrixAt(i, d.matrix);
      if (it.c) m.setColorAt(i, c.set(it.c)); });
    m.castShadow = cast; m.receiveShadow = true; m.computeBoundingSphere(); root.add(m); return m;
  };

  // =================================================================
  // 部屋：床・低い壁・斜めの屋根・妻壁（丸窓）・梁
  // =================================================================
  const boards = tex('attic_floor', woodTex(rng, 26, 30, [2, 3]));
  const floor = mesh(new THREE.PlaneGeometry(W * 2, D * 2), P('#fff', 0.7, 0, { map: boards }), V(0, 0, 0), root, { cast: false }); floor.rotation.x = -Math.PI / 2;
  const wallTex = tex('attic_wall', woodTex(rng, 28, 36, [3, 1]));
  const wallM = P('#fff', 0.85, 0, { map: wallTex, side: THREE.DoubleSide });
  [-1, 1].forEach(s => { const m = mesh(new THREE.PlaneGeometry(D * 2, KNEE), wallM, V(s * W, KNEE / 2, 0), root, { cast: false }); m.rotation.y = -s * Math.PI / 2; });
  const roofTex = tex('attic_roof', woodTex(rng, 24, 26, [5, 2]));
  const roofM = P('#fff', 0.9, 0, { map: roofTex, side: THREE.DoubleSide });
  const slope = Math.hypot(W, RIDGE - KNEE), ang = Math.atan2(RIDGE - KNEE, W);
  [-1, 1].forEach(s => { const m = mesh(new THREE.PlaneGeometry(slope, D * 2), roofM, V(s * W / 2, (KNEE + RIDGE) / 2, 0), root, { cast: true }); m.rotation.set(-Math.PI / 2, 0, 0); m.rotateOnWorldAxis(V(0, 0, 1), -s * ang); });
  // 妻壁（奥に丸窓の穴）
  const gable = (z, holeR, holeY) => {
    const sh = new THREE.Shape(); sh.moveTo(-W, 0); sh.lineTo(W, 0); sh.lineTo(W, KNEE); sh.lineTo(0, RIDGE); sh.lineTo(-W, KNEE); sh.closePath();
    if (holeR) { const h = new THREE.Path(); h.absarc(0, holeY, holeR, 0, Math.PI * 2, true); sh.holes.push(h); }
    const g = new THREE.ShapeGeometry(sh, 32); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.3, uv.getY(i) * 0.3);
    const t = wallTex.clone(); t.repeat.set(1, 1); t.needsUpdate = true;
    const m = mesh(g, P('#fff', 0.85, 0, { map: t, side: THREE.DoubleSide }), V(0, 0, z), root, { cast: true }); return m;
  };
  const WIN = { y: 3.5, r: 0.6 };
  gable(-D, WIN.r, WIN.y); gable(D, 0.32, 4.3);
  // 丸窓の外の空（3幕で色が変わる）
  const skyM = new THREE.MeshBasicMaterial({ color: '#ffb46b', toneMapped: false });
  mesh(new THREE.CircleGeometry(WIN.r, 40), skyM, V(0, WIN.y, -D - 0.05), root, { cast: false });
  const frontSky = mesh(new THREE.CircleGeometry(0.32, 30), skyM, V(0, 4.3, D + 0.05), root, { cast: false }); frontSky.rotation.y = Math.PI;
  // 窓枠と十字の桟
  const frameM = P('#3a2a1c', 0.6);
  mesh(new THREE.TorusGeometry(WIN.r, 0.05, 10, 48), frameM, V(0, WIN.y, -D + 0.02), root);
  mesh(new THREE.BoxGeometry(WIN.r * 2, 0.04, 0.04), frameM, V(0, WIN.y, -D + 0.02), root);
  mesh(new THREE.BoxGeometry(0.04, WIN.r * 2, 0.04), frameM, V(0, WIN.y, -D + 0.02), root);
  const SILL = { y: WIN.y - WIN.r - 0.02 };
  mesh(new THREE.BoxGeometry(1.5, 0.05, 0.3), frameM, V(0, SILL.y, -D + 0.15), root);
  // 梁（垂木・棟木・つなぎ梁）
  const beamM = P('#4a3524', 0.75, 0, { map: woodTex(rng, 22, 22, [1, 4]) });
  const beams = [];
  for (let z = -D + 0.3; z <= D - 0.2; z += 0.8) {
    [-1, 1].forEach(s => beams.push({ p: V(s * W / 2, (KNEE + RIDGE) / 2 - 0.08, z), rz: s * ang, s: V(slope, 0.14, 0.1) }));
    const ty = 4.3, half = (RIDGE - ty) / (RIDGE - KNEE) * W; beams.push({ p: V(0, ty, z), s: V(half * 2, 0.12, 0.1) });
  }
  beams.push({ p: V(0, RIDGE - 0.1, 0), s: V(0.14, 0.16, D * 2) });
  inst(new THREE.BoxGeometry(1, 1, 1), beamM, beams);

  // =================================================================
  // 光（3幕）
  // =================================================================
  const sun = new THREE.DirectionalLight('#ffb070', 3); sun.position.set(0.6, 6.5, -9); sun.target.position.set(0.2, 0, 0.6);
  setShadow(sun, 4.2, game.quality.shadow, 25); root.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight('#ffe2c0', '#2a1d14', 0.45); root.add(hemi);
  const warm = [];   // ランプ・ろうそく（2幕で灯る）
  const addLamp = (pos, color = '#ffa850', power = 5) => { const L = new THREE.PointLight(color, 0, 0, 2); L.position.copy(pos); root.add(L); warm.push({ L, power });
    const bulb = noRay(mesh(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffd9a0' }), pos, root, { cast: false })); warm.at(-1).bulb = bulb; return L; };
  [[-1.1, 3.55, 0.9], [1.0, 3.55, -0.9], [0.3, 3.55, 1.9]].forEach(([x, y, z]) => {
    mesh(new THREE.CylinderGeometry(0.004, 0.004, 4.3 - y, 4), P('#222'), V(x, (4.3 + y) / 2, z), root, { cast: false });
    mesh(new THREE.ConeGeometry(0.13, 0.12, 16, 1, true), P('#6b4a2a', 0.5, 0.6, { side: THREE.DoubleSide }), V(x, y + 0.06, z), root, { cast: false });
    addLamp(V(x, y, z));
  });
  const moon = new THREE.DirectionalLight('#7f9bd8', 0); moon.position.set(-0.5, 6, -9); moon.target.position.set(0, 0, 0.5); root.add(moon, moon.target);
  const glowMats = [];  // 3幕で光るもの（蓄光）
  // 窓から差す光の筋と、舞うほこり
  const shaftM = new THREE.MeshBasicMaterial({ color: '#ffd9a0', transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const shaftLen = 4.8, shaft = noRay(new THREE.Mesh(new THREE.CylinderGeometry(WIN.r * 0.95, 1.1, shaftLen, 32, 1, true), shaftM));
  const from = V(0, WIN.y, -D), to = V(0.2, 0.1, 0.6), mid = from.clone().lerp(to, 0.5);
  shaft.position.copy(mid); shaft.quaternion.setFromUnitVectors(V(0, 1, 0), from.clone().sub(to).normalize()); shaft.scale.y = from.distanceTo(to) / shaftLen; root.add(shaft);
  const dustN = 400, dustPos = new Float32Array(dustN * 3);
  for (let i = 0; i < dustN; i++) { const t = rng(), p = from.clone().lerp(to, t).add(V(rng.range(-0.6, 0.6), rng.range(-0.5, 0.5), rng.range(-0.4, 0.4))); dustPos.set([p.x, p.y, p.z], i * 3); }
  const dustG = new THREE.BufferGeometry(); dustG.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dustM = new THREE.PointsMaterial({ color: '#ffe6b0', size: 0.012, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending });
  root.add(noRay(new THREE.Points(dustG, dustM)));

  // =================================================================
  // 1. 中央ピアノ要塞（0, -0.4）
  // =================================================================
  const piano = new THREE.Group(); piano.position.set(-0.75, 0, 0.5); root.add(piano);   // 鍵盤の左端が原点、本体は -z（奥）へ
  const pianoBlack = P('#0b0b0d', 0.08), pianoWood = P('#c08a50', 0.6), brass = P('#c9a458', 0.25, 1);
  const outline = (inset = 0) => { const s = new THREE.Shape(), i = inset;
    s.moveTo(i, i); s.lineTo(1.5 - i, i); s.lineTo(1.5 - i, 0.45); s.bezierCurveTo(1.5 - i, 1.1, 1.0, 1.15, 0.6, 1.5 - i * 0.5); s.bezierCurveTo(0.42, 1.68, 0.3, 1.85 - i, 0.12, 1.85 - i); s.lineTo(i, 1.85 - i); s.closePath(); return s; };
  const bodyShape = outline(0); bodyShape.holes.push(new THREE.Path(outline(0.05).getPoints(40).reverse()));
  const rim = new THREE.ExtrudeGeometry(bodyShape, { depth: 0.32, bevelEnabled: false, curveSegments: 24 }); rim.rotateX(-Math.PI / 2);
  const rimMat = pianoBlack.clone(); rimMat.side = THREE.DoubleSide;
  mesh(rim, rimMat, V(0, 0.62, 0), piano);
  const sb = new THREE.ShapeGeometry(outline(0.05), 24); sb.rotateX(-Math.PI / 2);
  mesh(sb, pianoWood, V(0, 0.7, 0), piano);                                           // 響板
  const plate = new THREE.ShapeGeometry(outline(0.12), 24); plate.rotateX(-Math.PI / 2);
  mesh(plate, P('#b8902a', 0.3, 1), V(0, 0.74, 0), piano);                              // 金色のフレーム
  const strings = []; for (let i = 0; i < 48; i++) { const x = 0.12 + i * 0.027, len = Math.max(0.3, 1.65 - Math.pow(i / 48, 1.4) * 1.2);
    strings.push({ p: V(x, 0.77, -0.15 - len / 2), rx: Math.PI / 2, s: V(1, len, 1) }); }
  const strG = new THREE.CylinderGeometry(0.0015, 0.0015, 1, 4);
  piano.add(noRay(inst(strG, P('#d8d8d8', 0.25, 1), strings.map(s => ({ ...s, p: s.p.clone() })))));
  // ふた（直線側に蝶番、曲線側が持ち上がる）
  const lidPivot = new THREE.Group(); lidPivot.position.set(0, 0.95, 0); piano.add(lidPivot);
  const lidShape = outline(0); const lid = new THREE.ExtrudeGeometry(lidShape, { depth: 0.025, bevelEnabled: false, curveSegments: 24 }); lid.rotateX(-Math.PI / 2);
  const lidMat = pianoBlack.clone(); lidMat.side = THREE.DoubleSide;
  const lidM = mesh(lid, lidMat, V(0, 0, 0), lidPivot); lidPivot.rotation.z = 0.62;   // 半開き
  mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.95, 8), pianoBlack, V(1.25, 1.25, -0.9), piano).rotation.z = -0.35;   // つっかえ棒
  // 鍵盤：白52・黒36（押せる）
  const whites = [], blacks = [], whiteMidi = [], blackMidi = [];
  for (let m = 21, w = 0; m <= 108; m++) { const pc = m % 12, black = [1, 3, 6, 8, 10].includes(pc);
    if (!black) { whites.push({ p: V(0.04 + w * 0.0272, 0.72, 0.12), s: V(0.026, 0.022, 0.15) }); whiteMidi.push(m); w++; }
    else { blacks.push({ p: V(0.04 + (w - 0.5) * 0.0272, 0.745, 0.085), s: V(0.014, 0.02, 0.09) }); blackMidi.push(m); } }
  const wk = inst(new THREE.BoxGeometry(1, 1, 1), P('#f6f1e4', 0.25), whites.map(k => ({ ...k }))); piano.add(wk);
  const bk = inst(new THREE.BoxGeometry(1, 1, 1), P('#111', 0.2), blacks.map(k => ({ ...k }))); piano.add(bk);
  const pressKey = (im, list, i) => { const d = new THREE.Object3D(); d.position.copy(list[i].p); d.position.y -= 0.008; d.scale.copy(list[i].s); d.updateMatrix(); im.setMatrixAt(i, d.matrix); im.instanceMatrix.needsUpdate = true;
    setTimeout(() => { d.position.y += 0.008; d.updateMatrix(); im.setMatrixAt(i, d.matrix); im.instanceMatrix.needsUpdate = true; }, 180); };
  let monkeyT = -1, fx = null;
  const onKey = (im, list, midis) => hit => { const i = hit?.instanceId ?? Math.floor(Math.random() * list.length); game.sfx.piano(midis[i], piano.localToWorld(list[i].p.clone())); pressKey(im, list, i); fx?.onPianoNote();
    if (monkeyT < 0) monkeyT = 0; };   // ピアノを鳴らすとサルが動く（からくり）
  wk.userData.interact = { kind: 'play', dwell: 0.6, fn: onKey(wk, whites, whiteMidi) };
  bk.userData.interact = { kind: 'play', dwell: 0.6, fn: onKey(bk, blacks, blackMidi) };
  // 鍵盤の周り・譜面台・脚・ペダル
  mesh(new THREE.BoxGeometry(1.5, 0.08, 0.22), pianoBlack, V(0.75, 0.66, 0.1), piano);                  // 鍵盤の台
  [0.01, 1.49].forEach(x => mesh(new THREE.BoxGeometry(0.03, 0.12, 0.22), pianoBlack, V(x, 0.74, 0.1), piano));
  mesh(new THREE.BoxGeometry(1.44, 0.07, 0.02), pianoBlack, V(0.75, 0.79, 0.02), piano);
  const rack = mesh(new THREE.BoxGeometry(0.7, 0.25, 0.015), pianoBlack, V(0.75, 1.07, -0.1), piano); rack.rotation.x = -0.25;
  const sheets = mesh(new THREE.BoxGeometry(0.42, 0.28, 0.004), P('#f3eee0', 0.9), V(0.75, 1.08, -0.085), piano); sheets.rotation.x = -0.25;
  [[0.12, 0.15], [1.38, 0.15], [0.3, -1.6]].forEach(([x, z]) => { mesh(new THREE.CylinderGeometry(0.06, 0.04, 0.62, 12), pianoBlack, V(x, 0.31, z), piano); mesh(new THREE.SphereGeometry(0.03, 8, 6), brass, V(x, 0.02, z), piano); });
  mesh(new THREE.BoxGeometry(0.14, 0.5, 0.04), pianoBlack, V(0.75, 0.35, -0.05), piano);
  [-0.04, 0, 0.04].forEach(dx => mesh(new THREE.BoxGeometry(0.025, 0.012, 0.09), brass, V(0.75 + dx, 0.06, 0.02), piano));
  // メトロノーム・燭台
  const metro = new THREE.Group(); metro.userData.dynamic = true; metro.position.set(1.3, 0.97, -0.25); piano.add(metro);
  mesh(new THREE.CylinderGeometry(0.02, 0.06, 0.2, 4), P('#5a3a1a', 0.4), V(0, 0.1, 0), metro).rotation.y = Math.PI / 4;
  const metroArm = new THREE.Group(); metroArm.position.y = 0.02; metro.add(metroArm); mesh(new THREE.BoxGeometry(0.004, 0.16, 0.004), brass, V(0, 0.08, 0.035), metroArm);
  addLamp(V(-0.6 + 0.2, 1.15, 0.5 - 0.3), '#ff9a3c', 1.6);
  mesh(new THREE.CylinderGeometry(0.015, 0.018, 0.14, 10), P('#efe6d0', 0.9), V(0.2, 1.04, -0.3), piano);
  // 隠し場所
  spots.pianoKeys = () => ({ p: V(0.04 + 30.5 * 0.0272, 0.755, 0.085), parent: piano, rot: [0, Math.PI / 2, 0], scale: 0.8 });      // 黒鍵の並びの中
  spots.pianoInside = () => ({ p: V(0.75, 0.76, -0.9), parent: piano, rot: [0, 1.25, 0] });                                       // 金色フレーム沿い
  spots.musicRack = () => ({ p: V(0.75, 1.12, -0.075), parent: piano, rot: [Math.PI / 2 - 0.25, 0, 0.3] });                       // 楽譜の上
  for (let i = 0; i < 18; i++) pool('pianoTop', r => ({ p: V(r.range(0.1, 1.4), 0.975, r.range(-0.15, -0.4)), parent: piano }));
  for (let i = 0; i < 10; i++) pool('underPiano', r => ({ p: V(r.range(0.2, 1.3), 0, r.range(-0.4, -1.4)), parent: piano }));
  box(-0.8, 0, -1.4, 0.8, 1.0, 0.75);

  // ピアノの椅子
  const bench = new THREE.Group(); bench.position.set(0, 0, 1.05); root.add(bench);
  mesh(roundedBox(0.75, 0.08, 0.35, 0.02, 2), P('#3a1f1a', 0.9), V(0, 0.5, 0), bench);
  [[-0.32, -0.14], [0.32, -0.14], [-0.32, 0.14], [0.32, 0.14]].forEach(([x, z]) => mesh(new THREE.CylinderGeometry(0.025, 0.02, 0.46, 8), pianoBlack, V(x, 0.23, z), bench));
  for (let i = 0; i < 4; i++) pool('bench', r => ({ p: V(r.range(-0.3, 0.3), 0.54, r.range(-0.12, 0.12)), parent: bench }));
  box(-0.4, 0, 0.85, 0.4, 0.55, 1.25);

  // =================================================================
  // 2. 左手前：古書の螺旋塔（-1.6, 1.0）
  // =================================================================
  const spiral = V(-1.6, 0, 1.0), books = [];
  let y = 0, a = 0; const spiralLedges = [];
  while (y < 2.55) { const w = rng.range(0.22, 0.34), t = rng.range(0.035, 0.07), d = rng.range(0.16, 0.24); a += rng.range(0.25, 0.5);
    const r = 0.12 + rng.range(-0.02, 0.03), p = spiral.clone().add(V(Math.cos(a) * r, y + t / 2, Math.sin(a) * r));
    books.push({ p, ry: -a + rng.range(-0.25, 0.25), rz: rng.range(-0.04, 0.04), s: V(w, t, d), c: new THREE.Color(rng.pick(BOOKC)).offsetHSL(rng.range(-0.03, 0.03), rng.range(-0.1, 0.05), rng.range(-0.06, 0.06)).getStyle() });
    if (rng() < 0.18) spiralLedges.push(p.clone().add(V(Math.cos(a) * 0.12, t / 2 + 0.005, Math.sin(a) * 0.12)));
    y += t; }
  const spiralTopY = y;
  // 小口（紙の断面）の層を見せる帯
  inst(new THREE.BoxGeometry(1, 1, 1), P('#fff', 0.8), books);
  inst(new THREE.BoxGeometry(1, 1, 1), P('#e9dfc4', 0.95), books.map(b => ({ ...b, s: V(b.s.x * 0.96, b.s.y * 0.8, b.s.z * 1.02), c: null })));
  mesh(new THREE.SphereGeometry(0.16, 32, 20), P('#6b7a5a', 0.5, 0, { map: canvasTex(256, 128, (c, w, h) => { c.fillStyle = '#4f6a7a'; c.fillRect(0, 0, w, h); c.fillStyle = '#b9a66a';
    for (let i = 0; i < 14; i++) { c.beginPath(); c.ellipse(Math.random() * w, Math.random() * h, 10 + Math.random() * 25, 6 + Math.random() * 14, Math.random() * 3, 0, 7); c.fill(); } }) }), V(-1.15, 0.62, 1.45), root);
  mesh(new THREE.CylinderGeometry(0.03, 0.12, 0.45, 12), P('#3a2a1c', 0.5), V(-1.15, 0.22, 1.45), root);
  mesh(new THREE.TorusGeometry(0.18, 0.01, 8, 40), brass, V(-1.15, 0.62, 1.45), root).rotation.y = 0.4;
  spots.spiralMid = () => { const p = spiralLedges[Math.floor(spiralLedges.length / 2)] || spiral.clone().setY(1.2); return { p: p.clone().add(V(0, -0.02, 0)), rot: [0, rng() * 6, 0] }; };
  spots.spiralTop = () => ({ p: spiral.clone().setY(spiralTopY + 0.005), rot: [0, 0.4, 0] });
  spiralLedges.forEach(p => pool('spiral', () => ({ p: p.clone() })));
  for (let i = 0; i < 6; i++) pool('spiral', r => ({ p: spiral.clone().add(V(r.range(-0.3, 0.3), 0, r.range(-0.3, 0.3))) }));
  box(-1.85, 0, 0.75, -1.35, spiralTopY, 1.25);

  // =================================================================
  // 3. 右手前：木馬とおもちゃの山（1.7, 1.1）
  // =================================================================
  const horse = new THREE.Group(); horse.position.set(1.65, 0, 1.0); horse.rotation.y = -0.9; root.add(horse);
  const rocker = new THREE.Group(); rocker.userData.dynamic = true; horse.add(rocker);
  const crack = canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#ece4d2'; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(80,60,40,.35)'; c.lineWidth = 1;
    for (let i = 0; i < 90; i++) { c.beginPath(); let x = Math.random() * w, yy = Math.random() * h; c.moveTo(x, yy); for (let k = 0; k < 4; k++) { x += (Math.random() - 0.5) * 20; yy += (Math.random() - 0.5) * 20; c.lineTo(x, yy); } c.stroke(); } });
  const horseM = P('#fff', 0.55, 0, { map: crack });
  [-0.13, 0.13].forEach(z => mesh(new THREE.TorusGeometry(0.9, 0.025, 8, 48, 1.3), P('#6b4a2a', 0.5), V(0, 0.92, z), rocker).rotation.z = Math.PI * 1.5 - 0.65);
  mesh(new THREE.CapsuleGeometry(0.15, 0.42, 6, 16), horseM, V(0, 0.62, 0), rocker).rotation.z = Math.PI / 2;
  mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.32, 14), horseM, V(0.3, 0.82, 0), rocker).rotation.z = -0.6;
  mesh(new THREE.CapsuleGeometry(0.07, 0.16, 6, 12), horseM, V(0.42, 0.98, 0), rocker).rotation.z = -1.1;
  [[-0.2, 0.08], [-0.2, -0.08], [0.2, 0.08], [0.2, -0.08]].forEach(([x, z]) => mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.36, 10), horseM, V(x, 0.36, z), rocker).rotation.z = x > 0 ? -0.25 : 0.25);
  mesh(roundedBox(0.26, 0.04, 0.3, 0.015, 2), P('#8a1c1c', 0.55), V(-0.02, 0.78, 0), rocker);   // 赤い鞍
  // たてがみ：毛束（溝に絵筆が隠れる）
  const mane = []; for (let i = 0; i < 26; i++) { const t = i / 26; mane.push({ p: V(0.2 + t * 0.26, 0.92 + t * 0.12, rng.range(-0.025, 0.025)), rz: -0.9 + rng.range(-0.3, 0.3), s: V(0.012, rng.range(0.1, 0.16), 0.03), c: new THREE.Color('#5a3e2a').offsetHSL(0, 0, rng.range(-0.08, 0.08)).getStyle() }); }
  rocker.add(inst(new THREE.BoxGeometry(1, 1, 1), P('#fff', 0.95), mane));
  spots.horseMane = () => ({ p: V(0.3, 0.97, 0.0), parent: rocker, rot: [0, 0, -0.9] });
  spots.horseRocker = () => ({ p: V(-0.35, 0.005, 0.0), parent: horse, rot: [0, 1.6, 0] });
  pool('horse', () => ({ p: V(-0.02, 0.8, 0), parent: rocker }));
  box(1.2, 0, 0.6, 2.1, 1.1, 1.4);
  // シンバルを持ったサル（胸ポケットに鍵。ピアノを鳴らすと腕が開く）
  const monkey = new THREE.Group(); monkey.position.set(2.2, 0, 1.8); monkey.rotation.y = -1.9; monkey.userData.dynamic = true; root.add(monkey);
  const mFur = P('#6b3f1d', 0.9), mFace = P('#e8c49a', 0.7);
  mesh(new THREE.SphereGeometry(0.12, 18, 14), P('#9d1b1b', 0.6), V(0, 0.16, 0), monkey).scale.set(1, 1.2, 0.85);
  mesh(new THREE.SphereGeometry(0.1, 18, 14), mFur, V(0, 0.37, 0), monkey);
  mesh(new THREE.SphereGeometry(0.07, 14, 10), mFace, V(0, 0.36, 0.05), monkey);
  [-0.1, 0.1].forEach(x => mesh(new THREE.SphereGeometry(0.035, 10, 8), mFace, V(x, 0.4, 0), monkey));
  [-0.028, 0.028].forEach(x => mesh(new THREE.SphereGeometry(0.016, 10, 8), P('#fff', 0.05), V(x, 0.39, 0.105), monkey));
  mesh(new THREE.BoxGeometry(0.05, 0.035, 0.02), P('#6b0f0f', 0.7), V(0.04, 0.2, 0.1), monkey);   // 胸ポケット
  const arms = [-1, 1].map(k => { const g = new THREE.Group(); g.position.set(k * 0.11, 0.24, 0.02); monkey.add(g);
    mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.16, 8), mFur, V(k * 0.04, 0, 0.06), g).rotation.x = Math.PI / 2.4;
    mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.008, 24), P('#d4af37', 0.15, 1), V(k * 0.04, 0.02, 0.15), g).rotation.z = Math.PI / 2;
    g.rotation.y = k * 0.25; g.userData.dynamic = true; return g; });   // ふだんは腕が閉じて胸ポケットが隠れる
  monkey.userData.interact = { kind: 'play', dwell: 0.8, fn: () => { if (monkeyT < 0) monkeyT = 0; } };
  spots.monkeyChest = () => ({ p: V(0.04, 0.215, 0.095), parent: monkey, rot: [Math.PI / 2, 0, 0], scale: 0.45 });
  // おもちゃの山（木馬の足もと）
  const toyPile = { c: V(1.9, 0, 1.6), R: 0.6, H: 0.35 };
  for (let i = 0; i < 26; i++) pool('toyPile', r => ({ p: moundPoint(r, toyPile.c, toyPile.R, toyPile.H, true, 0.85), tilt: true }));

  // =================================================================
  // 4. 左奥：トランクと三面鏡（-2.0, -1.6）
  // =================================================================
  const trunk = new THREE.Group(); trunk.position.set(-1.95, 0, -1.55); trunk.rotation.y = 0.5; root.add(trunk);
  const leather = P('#5a3a22', 0.7), tBrass = P('#b8902a', 0.3, 1);
  mesh(new THREE.BoxGeometry(1.0, 0.06, 0.55), leather, V(0, 0.03, 0), trunk);
  [[0, 0.27, 0.26, 1.0, 0.5, 0.04], [0, 0.27, -0.26, 1.0, 0.5, 0.04], [0.48, 0.27, 0, 0.04, 0.5, 0.55], [-0.48, 0.27, 0, 0.04, 0.5, 0.55]].forEach(([x, yy, z, w, h, d]) => mesh(new THREE.BoxGeometry(w, h, d), leather, V(x, yy, z), trunk));
  [-0.3, 0.3].forEach(x => mesh(new THREE.BoxGeometry(0.05, 0.52, 0.57), tBrass, V(x, 0.27, 0), trunk));
  const tLidPivot = new THREE.Group(); tLidPivot.position.set(0, 0.52, -0.27); trunk.add(tLidPivot);
  const tLid = new THREE.Group(); tLid.position.z = 0.275; tLidPivot.add(tLid);
  mesh(new THREE.CylinderGeometry(0.28, 0.28, 1.0, 20, 1, false, 0, Math.PI), leather, V(0, 0, 0), tLid).rotation.set(0, 0, Math.PI / 2);
  tLidPivot.rotation.x = -1.95;   // 開いている
  spots.trunkLid = () => ({ p: V(0, -0.05, 0.02), parent: tLid, rot: [Math.PI / 2, 0, Math.PI], scale: 0.9 });   // 蓋の裏
  // あふれる中身（丸い装飾品の海：同じ物なし）
  const tc = V(0, 0.45, 0);
  const roundG = [new THREE.CylinderGeometry(0.03, 0.03, 0.008, 16), new THREE.TorusGeometry(0.025, 0.006, 8, 18), new THREE.SphereGeometry(0.02, 12, 8), new THREE.CylinderGeometry(0.022, 0.022, 0.012, 6)];
  roundG.forEach((g, k) => trunk.add(scatter(rng, g, P('#fff', 0.25, 1), 90 * q, () => moundPoint(rng, tc, 0.45, 0.32), ['#d4a537', '#c9ccd1', '#b87333', '#e0b13a', '#9a8a6a'])));
  trunk.add(scatter(rng, new THREE.SphereGeometry(0.03, 10, 8), P('#fff', 0.95), 60 * q, () => moundPoint(rng, tc, 0.45, 0.25), ['#f3eee0', '#e8d8c0', '#d8c8b0']));   // レースのかたまり
  spots.roundPile = () => ({ p: moundPoint(rng, tc, 0.4, 0.3, true, 0.5), parent: trunk, tilt: true });
  for (let i = 0; i < 22; i++) pool('trunk', r => ({ p: moundPoint(r, tc, 0.42, 0.32, true, 0.8), parent: trunk, tilt: true }));
  for (let i = 0; i < 10; i++) pool('trunk', r => ({ p: V(r.range(-0.4, 0.4), 0, r.range(0.35, 0.65)), parent: trunk, tilt: true }));   // こぼれた物
  spots.behindTrunk = () => ({ p: V(0.15, 0, -0.42), parent: trunk, rot: [0, Math.PI, 0] });
  box(-2.55, 0, -2.0, -1.4, 0.75, -1.05);
  // 三面鏡（映り込みは環境マップで表現）
  const mirror = new THREE.Group(); mirror.position.set(-2.55, 0, -0.75); mirror.rotation.y = 1.2; root.add(mirror);
  const mirrorM = P('#dfe8ee', 0.02, 1), mFrame = P('#5a3a1a', 0.5);
  [-1, 0, 1].forEach(k => { const g = new THREE.Group(); g.position.x = k * 0.33; g.rotation.y = -k * 0.5; mirror.add(g);
    mesh(new THREE.BoxGeometry(0.34, 1.0, 0.04), mFrame, V(0, 1.0, 0), g); mesh(new THREE.PlaneGeometry(0.28, 0.92), mirrorM, V(0, 1.0, 0.021), g); });
  mesh(new THREE.BoxGeometry(1.1, 0.5, 0.4), mFrame, V(0, 0.25, 0.1), mirror);
  for (let i = 0; i < 8; i++) pool('mirrorTop', r => ({ p: V(r.range(-0.45, 0.45), 0.5, r.range(0.0, 0.25)), parent: mirror }));

  // =================================================================
  // 5. 右奥：ドールハウス（2.0, -1.5）
  // =================================================================
  const doll = new THREE.Group(); doll.position.set(2.05, 0, -1.6); doll.rotation.y = -0.75; root.add(doll);
  const creamM = P('#e9e0c8', 0.7), greenM = P('#2f4f3f', 0.6);
  const papers = ['#e8cfc8', '#d8d0b8', '#c8d8c8', '#e0c8d8', '#d0c8b0', '#e8e0c0'].map((c, i) => canvasTex(128, 128, (g, w, h) => { g.fillStyle = c; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(150,60,70,.35)';
    for (let yy = 8; yy < h; yy += 20) for (let xx = (yy / 20 % 2) * 10 + 6; xx < w; xx += 20) { g.beginPath(); g.arc(xx, yy, 2.5, 0, 7); g.fill(); } }));
  const DW = 1.0, DH = 0.42, DD = 0.5;
  mesh(new THREE.BoxGeometry(DW + 0.06, 0.05, DD + 0.04), greenM, V(0, 0.025, 0), doll);
  for (let f = 0; f < 3; f++) {
    const yy = 0.05 + f * DH;
    mesh(new THREE.BoxGeometry(DW, 0.025, DD), P('#8a5a3a', 0.6, 0, { map: boards }), V(0, yy + 0.0125, 0), doll);
    [-1, 1].forEach((side, k) => { mesh(new THREE.PlaneGeometry(DW / 2, DH), P('#fff', 0.9, 0, { map: papers[f * 2 + k] }), V(side * DW / 4, yy + DH / 2, -DD / 2 + 0.01), doll); });
  }
  [-1, 1].forEach(s => mesh(new THREE.BoxGeometry(0.03, DH * 3 + 0.05, DD), creamM, V(s * DW / 2, 0.05 + DH * 1.5, 0), doll));
  mesh(new THREE.BoxGeometry(0.025, DH * 3, DD), creamM, V(0, 0.05 + DH * 1.5, 0), doll);
  mesh(new THREE.BoxGeometry(DW, DH * 3, 0.025), creamM, V(0, 0.05 + DH * 1.5, -DD / 2), doll);
  const roof = new THREE.Shape(); roof.moveTo(-DW / 2 - 0.05, 0); roof.lineTo(DW / 2 + 0.05, 0); roof.lineTo(0, 0.38); roof.closePath();
  const rg = new THREE.ExtrudeGeometry(roof, { depth: DD + 0.06, bevelEnabled: false }); rg.translate(0, 0, -(DD + 0.06) / 2);
  mesh(rg, P('#4a3a30', 0.85), V(0, 0.05 + DH * 3, 0), doll);
  mesh(new THREE.BoxGeometry(0.08, 0.16, 0.08), P('#8a3a2a', 0.8), V(0.3, 0.05 + DH * 3 + 0.3, 0), doll);
  // 小さな家具と、ビスクドール（目がこちらを追う）
  const mini = (x, f, build) => { const g = new THREE.Group(); g.position.set(x, 0.065 + f * DH, rng.range(-0.1, 0.05)); doll.add(g); build(g); return g; };
  mini(-0.3, 0, g => { mesh(new THREE.BoxGeometry(0.14, 0.008, 0.09), P('#6b4a2a', 0.5), V(0, 0.07, 0), g); [-1, 1].forEach(x => [-1, 1].forEach(z => mesh(new THREE.BoxGeometry(0.008, 0.07, 0.008), P('#6b4a2a', 0.5), V(x * 0.06, 0.035, z * 0.035), g))); });
  mini(0.3, 0, g => { mesh(new THREE.BoxGeometry(0.12, 0.1, 0.05), P('#8a3a2a', 0.8), V(0, 0.05, -0.18), g); });   // 暖炉
  const fireL = new THREE.PointLight('#ff7a2a', 0, 0.8, 2); fireL.position.set(0.3, 0.12, -0.12); doll.add(fireL); warm.push({ L: fireL, power: 0.6 });
  mini(-0.25, 1, g => { mesh(new THREE.BoxGeometry(0.16, 0.04, 0.09), P('#e8e0d0', 0.9), V(0, 0.03, 0), g); });   // ベッド
  const bisque = mini(0.25, 1, g => { g.userData.dynamic = true; mesh(new THREE.ConeGeometry(0.05, 0.12, 14), P('#6b8fb5', 0.8), V(0, 0.06, 0), g); mesh(new THREE.SphereGeometry(0.033, 16, 12), P('#f6dcc8', 0.3), V(0, 0.15, 0), g); });
  const dollEyes = []; [-0.011, 0.011].forEach(x => { const e = mesh(new THREE.SphereGeometry(0.007, 10, 8), P('#fdfdfd', 0.1), V(x, 0.153, 0.028), bisque);
    dollEyes.push(mesh(new THREE.SphereGeometry(0.0035, 8, 6), P('#1b2a4a', 0.05), V(0, 0, 0.005), e)); });
  const roomSpot = (f, side) => () => ({ p: V(side * DW / 4 + rng.range(-0.1, 0.1), 0.065 + f * DH, rng.range(-0.12, 0.12)), parent: doll });
  spots.dollTop = () => ({ p: V(-0.22, 0.065 + 2 * DH, 0.0), parent: doll, rot: [0, 0.3, 0] });
  spots.dollGround = () => ({ p: V(-0.3, 0.065, 0.0), parent: doll, rot: [0, 0.6, 0], scale: 0.9 });
  for (let f = 0; f < 3; f++) [-1, 1].forEach(s => { for (let i = 0; i < 3; i++) pool('dollhouse', roomSpot(f, s)); });
  box(1.55, 0, -2.15, 2.6, 1.7, -1.05);

  // =================================================================
  // 6. 奥中央：くまと椅子と蓄音機（0.2, -2.1）
  // =================================================================
  const chair = new THREE.Group(); chair.position.set(0.95, 0, -2.0); chair.rotation.y = -0.35; root.add(chair);
  const velvet = P('#5a1424', 0.95, 0, isUltra() ? { sheen: 1, sheenRoughness: 0.5, sheenColor: new THREE.Color('#c86a7a') } : {});
  mesh(roundedBox(0.8, 0.18, 0.7, 0.06, 3), velvet, V(0, 0.42, 0), chair);
  const cushion = mesh(roundedBox(0.62, 0.1, 0.55, 0.05, 3), velvet, V(0, 0.55, 0.04), chair);
  mesh(roundedBox(0.8, 0.7, 0.16, 0.06, 3), velvet, V(0, 0.85, -0.3), chair);
  [-1, 1].forEach(s => mesh(roundedBox(0.14, 0.3, 0.68, 0.05, 3), velvet, V(s * 0.37, 0.6, 0), chair));
  [[-0.33, -0.28], [0.33, -0.28], [-0.33, 0.28], [0.33, 0.28]].forEach(([x, z]) => mesh(new THREE.CylinderGeometry(0.03, 0.02, 0.34, 8), P('#2a1a10', 0.4), V(x, 0.17, z), chair));
  spots.cushion = () => ({ p: V(0.22, 0.6, 0.2), parent: chair, rot: [0.3, 0.5, 0.2], scale: 0.8 });
  for (let i = 0; i < 6; i++) pool('chair', r => ({ p: V(r.pick([-0.37, 0.37]), 0.76, r.range(-0.25, 0.25)), parent: chair }));
  box(0.5, 0, -2.45, 1.4, 1.2, -1.55);
  // くま（GLBがあれば本物のモデル、無ければ簡易形）。見ていない間に向きが変わる
  const bear = new THREE.Group(); bear.userData.dynamic = true; bear.position.set(0, 0.6, -0.02); chair.add(bear);
  const bearHead = new THREE.Group();
  (() => { const fur = P('#c8a274', 1, 0, isUltra() ? { sheen: 1, sheenRoughness: 0.7 } : {});
    mesh(new THREE.SphereGeometry(0.2, 24, 18), fur, V(0, 0.2, 0), bear).scale.set(1, 1.1, 0.9);
    bearHead.position.set(0, 0.48, 0.02); bear.add(bearHead); mesh(new THREE.SphereGeometry(0.15, 24, 18), fur, V(0, 0, 0), bearHead);
    [-0.11, 0.11].forEach(x => mesh(new THREE.SphereGeometry(0.05, 12, 10), fur, V(x, 0.12, 0), bearHead));
    mesh(new THREE.SphereGeometry(0.018, 10, 8), P('#1a1a1a', 0.2), V(0, -0.02, 0.16), bearHead);
    [-0.05, 0.05].forEach(x => mesh(new THREE.SphereGeometry(0.016, 10, 8), P('#111', 0.05), V(x, 0.04, 0.135), bearHead)); })();
  swapModel('teddy', bear).then(ok => { if (ok) bear.position.y = 0.58; });
  spots.bearEar = () => ({ p: V(-0.13, hasModel('teddy') ? 0.55 : 0.6, -0.04), parent: bear, rot: [0, Math.PI, 0], scale: 0.8 });
  spots.behindBear = () => ({ p: V(0.05, 1.22, -0.36), parent: chair, rot: [0, 0, 0] });
  let bearYaw = 0, lookAways = 0, wasWatched = true;
  // 蓄音機（ラッパの奥に指輪）
  const gram = new THREE.Group(); gram.position.set(-0.55, 0, -2.25); gram.rotation.y = 0.5; gram.userData.dynamic = true; root.add(gram);
  gram.userData.interact = { kind: 'play', dwell: 1.0, fn: () => fx.playGramophone(gram.getWorldPosition(V()).setY(1)) };
  mesh(new THREE.BoxGeometry(0.5, 0.6, 0.45), P('#3a2414', 0.4), V(0, 0.3, 0), gram);   // サイドテーブル
  mesh(new THREE.BoxGeometry(0.34, 0.14, 0.34), P('#6b3a1a', 0.3, 0, { map: woodTex(rng, 18, 28, [1, 1]) }), V(0, 0.67, 0), gram);
  mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.01, 32), P('#111', 0.2), V(0, 0.745, 0), gram);
  mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.25, 8), brass, V(0.13, 0.87, -0.1), gram);
  const hornPts = []; for (let i = 0; i <= 20; i++) { const t = i / 20; hornPts.push(new THREE.Vector2(0.02 + Math.pow(t, 2.6) * 0.3, t * 0.55)); }
  const horn = mesh(new THREE.LatheGeometry(hornPts, 32), P('#c9a458', 0.22, 1, { side: THREE.DoubleSide }), V(0.13, 0.98, -0.1), gram); horn.rotation.set(-1.0, 0, 0.2);
  spots.hornDeep = () => ({ p: V(0.13, 1.08, -0.02), parent: gram, rot: [0.3, 0, 0], scale: 0.9 });
  for (let i = 0; i < 5; i++) pool('gramTable', r => ({ p: V(r.range(-0.2, 0.2), 0.6, r.range(0.1, 0.2)), parent: gram }));
  box(-0.85, 0, -2.55, -0.25, 1.3, -1.95);

  // =================================================================
  // 7. 中空・左：鳥かご（-1.1, -0.2）
  // =================================================================
  const cage = new THREE.Group(); cage.userData.dynamic = true; cage.position.set(-1.1, 2.85, -0.2); root.add(cage);
  const iron = P('#2b2b2e', 0.5, 0.8);
  mesh(new THREE.CylinderGeometry(0.004, 0.004, 4.3 - 2.85 - 0.7, 4), iron, V(0, 0.7 + (4.3 - 2.85 - 0.7) / 2, 0), cage, { cast: false });   // 鎖
  mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.05, 32), iron, V(0, 0, 0), cage);
  mesh(new THREE.SphereGeometry(0.3, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), iron, V(0, 0.55, 0), cage).material = P('#2b2b2e', 0.5, 0.8, { wireframe: true });
  const bars = []; for (let i = 0; i < 28; i++) { const a2 = i / 28 * Math.PI * 2; bars.push({ p: V(Math.cos(a2) * 0.3, 0.28, Math.sin(a2) * 0.3), s: V(1, 0.55, 1) }); }
  cage.add(inst(new THREE.CylinderGeometry(0.004, 0.004, 1, 5), iron, bars));
  mesh(new THREE.CircleGeometry(0.28, 24), P('#f3eee0', 0.95), V(0, 0.03, 0), cage).rotation.x = -Math.PI / 2;   // 白いレース
  cage.add(scatter(rng, new THREE.SphereGeometry(0.018, 8, 6), P('#fff', 0.8), 40 * q, () => V(rng.range(-0.2, 0.2), 0.04, rng.range(-0.2, 0.2)), ['#efe8d8', '#d8d0c0', '#c8c0b0']));   // 白い小石
  spots.cageBottom = () => ({ p: V(0.05, 0.035, 0.02), parent: cage, rot: [0, 0.8, 0] });
  for (let i = 0; i < 5; i++) pool('cage', r => ({ p: V(r.range(-0.18, 0.18), 0.035, r.range(-0.18, 0.18)), parent: cage }));

  // =================================================================
  // 8. 中空・右：天球儀（1.2, 0.3）
  // =================================================================
  const arm = new THREE.Group(); arm.userData.dynamic = true; arm.position.set(1.2, 3.6, 0.3); root.add(arm);
  mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.62, 4), iron, V(0, 0.38, 0), arm, { cast: false });
  const rings = [];
  [[0.36, 0, 0], [0.33, Math.PI / 2, 0], [0.3, 0.4, 0.9], [0.27, 1.2, -0.4], [0.24, -0.6, 0.3]].forEach(([r, rx, rz]) => { const m = mesh(new THREE.TorusGeometry(r, 0.008, 8, 64), brass, V(0, 0, 0), arm); m.rotation.set(rx, 0, rz); rings.push(m); });
  mesh(new THREE.SphereGeometry(0.035, 16, 12), P('#b8902a', 0.3, 1), V(0, 0.08, 0), arm);
  spots.armillary = () => ({ p: V(0, -0.03, 0), parent: arm, rot: [1.2, 0, 0] });
  // 気球の模型とドライフラワー
  const balloon = new THREE.Group(); balloon.position.set(2.0, 2.6, 0.9); balloon.userData.dynamic = true; root.add(balloon);
  mesh(new THREE.CylinderGeometry(0.003, 0.003, 4.3 - 2.6 - 0.4, 4), iron, V(0, 0.4 + (4.3 - 2.6 - 0.4) / 2, 0), balloon, { cast: false });
  mesh(new THREE.SphereGeometry(0.2, 24, 16), P('#fff', 0.6, 0, { map: canvasTex(128, 64, (c, w, h) => { ['#8a1c1c', '#e9dfc4'].forEach((col, i) => { for (let x = i * 16; x < w; x += 32) { c.fillStyle = col; c.fillRect(x, 0, 16, h); } }); }) }), V(0, 0.2, 0), balloon).scale.y = 1.2;
  mesh(new THREE.BoxGeometry(0.08, 0.06, 0.08), P('#8b5a2b', 0.8), V(0, -0.12, 0), balloon);

  // =================================================================
  // 9. 棟木の吊り飾り（万国旗・鍵の束・ガラスの浮き玉）
  // =================================================================
  const flags = [];
  for (let t = 0; t <= 1; t += 0.035) { const z = lerp(-1.6, 1.6, t), p = V(0, RIDGE - 0.3 - Math.sin(t * Math.PI) * 0.6, z); flags.push({ p: p.clone().add(V(0, -0.08, 0)), ry: Math.PI / 2, s: V(0.12, 0.16, 0.003), c: mix(rng) }); }
  inst(new THREE.ConeGeometry(0.5, 1, 3).rotateZ(Math.PI), P('#fff', 0.9, 0, { side: THREE.DoubleSide }), flags, { cast: false });
  spots.ridgeFlags = () => ({ p: V(0.03, RIDGE - 0.3 - 0.58 - 0.2, 0.25), rot: [0, Math.PI / 2, 0] });
  const floats = []; for (let i = 0; i < 6; i++) floats.push({ p: V(rng.range(-0.5, 0.5), RIDGE - 0.9 - rng() * 0.6, rng.range(-2, 2)), s: V(1, 1, 1).multiplyScalar(rng.range(0.7, 1.3)), c: rng.pick(['#4d908e', '#577590', '#90be6d', '#43aa8b']) });
  inst(new THREE.SphereGeometry(0.07, 20, 14), P('#fff', 0.05, 0, { transparent: true, opacity: 0.55 }), floats, { cast: false });
  floats.forEach(f => mesh(new THREE.CylinderGeometry(0.002, 0.002, RIDGE - 0.1 - f.p.y, 3), iron, V(f.p.x, (RIDGE - 0.1 + f.p.y) / 2, f.p.z), root, { cast: false }));
  // 梁から吊るす（おとり用）
  const hangPts = [];
  for (let z = -D + 0.3; z <= D - 0.2; z += 0.8) for (let k = 0; k < 3; k++) hangPts.push(V(rng.range(-1.1, 1.1), 4.24, z + rng.range(-0.05, 0.05)));
  hangPts.forEach(h => pool('beam', r => ({ p: h.clone().setY(h.y - r.range(0.4, 1.3)), hang: h.y })));

  // =================================================================
  // 10. 丸窓の額縁：色違いの薬瓶・ステンドグラス片・蜘蛛の巣
  // =================================================================
  const bottles = [];
  for (let i = 0; i < 9; i++) { const x = -0.65 + i * 0.16, h = rng.range(0.12, 0.24), r = rng.range(0.035, 0.055);
    bottles.push({ p: V(x, SILL.y + 0.025 + h / 2, -D + 0.17), s: V(r, h, r), c: rng.pick(['#2d6a9f', '#7a3b2e', '#2f6b3f', '#5a3a7a', '#a87a2a', '#3a7a8a']) }); }
  inst(new THREE.CylinderGeometry(1, 0.9, 1, 16), P('#fff', 0.05, 0, { transparent: true, opacity: 0.6 }), bottles, { cast: false });
  spots.windowSill = () => ({ p: V(-0.65, SILL.y + 0.03, -D + 0.17), rot: [0, 0.2, 0], scale: 0.9 });   // 左端の青い瓶のとなり
  for (let i = 0; i < 4; i++) pool('sill', r => ({ p: V(r.range(-0.6, 0.6), SILL.y + 0.03, -D + r.range(0.08, 0.26)) }));
  const web = canvasTex(256, 256, (c, w, h) => { c.clearRect(0, 0, w, h); c.strokeStyle = 'rgba(240,240,240,.55)'; c.lineWidth = 1;
    for (let i = 0; i < 12; i++) { const a2 = i / 12 * Math.PI / 2; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a2) * w, Math.sin(a2) * h); c.stroke(); }
    for (let r = 20; r < w; r += 22) { c.beginPath(); c.arc(0, 0, r, 0, Math.PI / 2); c.stroke(); } });
  const webM = new THREE.MeshBasicMaterial({ map: web, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  noRay(mesh(new THREE.PlaneGeometry(0.7, 0.7), webM, V(-W + 0.36, KNEE + 0.1, -D + 0.02), root, { cast: false }));

  // =================================================================
  // 低い壁ぎわの本棚（本が多いのは良い）
  // =================================================================
  const lowBooks = [];
  [-1, 1].forEach(s => { [0.05, 0.62, 1.2].forEach(yy => { mesh(new THREE.BoxGeometry(0.3, 0.03, D * 2 - 0.4), beamM, V(s * (W - 0.15), yy, 0), root);
    let z = -D + 0.25; while (z < D - 0.25) { if (rng() < 0.12) { const zz = z + 0.1; pool('lowShelf', () => ({ p: V(s * (W - 0.15), yy + 0.015, zz), rot: [0, -s * Math.PI / 2, 0] })); z += 0.22; continue; }
      const th = rng.range(0.02, 0.055), bh = rng.range(0.16, 0.4), lean = rng() < 0.1 ? rng.range(-0.3, 0.3) : 0;
      lowBooks.push({ p: V(s * (W - 0.15), yy + 0.015 + bh / 2, z + th / 2), rx: lean, s: V(rng.range(0.16, 0.24), bh, th), c: new THREE.Color(rng.pick(BOOKC)).offsetHSL(0, rng.range(-0.1, 0.05), rng.range(-0.06, 0.06)).getStyle() });
      z += th + 0.003; } }); box(s > 0 ? W - 0.32 : -W, 0, -D, s > 0 ? W : -W + 0.32, 1.5, D); });
  inst(new THREE.BoxGeometry(1, 1, 1), P('#fff', 0.8), lowBooks);

  // =================================================================
  // 床の小さな山（足もとは少なめ）＋ ゲーム用の小物
  // =================================================================
  const small = [];
  [[toyPile.c, toyPile.R, toyPile.H, 180], [V(-0.95, 0, -1.1), 0.35, 0.15, 50], [V(0.0, 0, -0.9), 0.4, 0.12, 50]].forEach(([c, R, H, n]) => { for (let i = 0; i < n * q; i++) small.push(moundPoint(rng, c, R, H)); });
  let si = 0; root.add(scatter(rng, roundedBox(0.06, 0.06, 0.06, 0.008, 2), plastic, small.length / 2, () => small[si++], MUTED.concat(AMBER, POISON)));
  root.add(scatter(rng, new THREE.SphereGeometry(0.02, 10, 8), glossy, small.length - si, () => small[si++] || V(), MUTED.concat(AMBER, POISON)));
  for (let i = 0; i < 8; i++) pool('floor', r => { let x, z; do { x = r.range(-2.4, 2.4); z = r.range(-2.2, 2.2); } while (colliders.some(b => x > b.min.x - 0.1 && x < b.max.x + 0.1 && z > b.min.z - 0.1 && z < b.max.z + 0.1)); return { p: V(x, 0, z) }; });

  // びっくり箱（ギミック）
  const jack = new THREE.Group(); jack.userData.dynamic = true; jack.position.set(1.15, 0, 1.75); jack.rotation.y = -0.3; root.add(jack);
  const jTex = canvasTex(128, 128, c => { for (let yy = 0; yy < 4; yy++) for (let x = 0; x < 4; x++) { c.fillStyle = (x + yy) % 2 ? '#8a1c1c' : '#c9a227'; c.fillRect(x * 32, yy * 32, 32, 32); } });
  const jBody = mesh(new THREE.BoxGeometry(0.28, 0.28, 0.28), P('#fff', 0.45, 0, { map: jTex }), V(0, 0.14, 0), jack);
  const jLid = new THREE.Group(); jLid.position.set(0, 0.28, -0.14); jack.add(jLid); mesh(new THREE.BoxGeometry(0.29, 0.02, 0.29), P('#2f4f3f', 0.5), V(0, 0.01, 0.14), jLid);
  const clownHead = new THREE.Group(); clownHead.visible = false; jack.add(clownHead);
  mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.28, 12, 6, true), P('#bbb', 0.3, 0.9, { side: THREE.DoubleSide }), V(0, 0.14, 0), clownHead);
  mesh(new THREE.SphereGeometry(0.075, 18, 14), P('#fbe3d0', 0.4), V(0, 0.34, 0), clownHead);
  mesh(new THREE.SphereGeometry(0.018, 8, 6), P('#c1121f', 0.3), V(0, 0.33, 0.075), clownHead);
  let jackOpen = false, jackBusy = false;
  const toggleJack = () => { if (jackBusy) return; jackBusy = true;
    if (!jackOpen) { [0, 2, 4, 2, 0, 2].forEach((n, i) => game.sfx.musicBoxNote(n, jack.getWorldPosition(V()), i * 0.28, 0.8));
      setTimeout(() => { game.sfx.spring(jack.getWorldPosition(V())); clownHead.visible = true;
        animate(0.9, t => { jLid.rotation.x = -2.2 * Math.min(1, t * 4); clownHead.position.y = 0.17 * (1 - Math.exp(-6 * t) * Math.cos(14 * t)); }, () => { jackOpen = true; jackBusy = false; }); }, 1700); }
    else { animate(0.6, t => { clownHead.position.y = 0.17 * (1 - t); jLid.rotation.x = -2.2 * (1 - t); }, () => { clownHead.visible = false; jackOpen = false; jackBusy = false; }); } };
  jack.userData.interact = { kind: 'gimmick', dwell: 1.2, fn: toggleJack }; jLid.userData.dynamic = true; clownHead.userData.dynamic = true;
  // 木琴（おもちゃの山のそば）
  const xylo = new THREE.Group(); xylo.position.set(0.85, 0, 1.0); xylo.rotation.y = 0.4; root.add(xylo);
  ['#8a1c1c', '#b5651d', '#c9a227', '#5f6b5a', '#2f4f3f', '#3d5a80', '#4a1f3a', '#6b4a2a'].forEach((col, i) => {
    const b = mesh(roundedBox(0.06, 0.02, 0.26 - i * 0.018, 0.006, 2), P(col, 0.35, 0.3), V(-0.28 + i * 0.08, 0.06, 0), xylo);
    b.userData.interact = { kind: 'play', dwell: 0.6, fn: () => { game.sfx.xylophone(i, b.getWorldPosition(V())); b.position.y = 0.052; setTimeout(() => b.position.y = 0.06, 120); } }; });
  [-0.1, 0.1].forEach(z => mesh(new THREE.BoxGeometry(0.7, 0.04, 0.03), P('#5a3a1a', 0.6), V(0, 0.03, z), xylo));

  // =================================================================
  // ページ（お題の配置・おとりのまとめ描画・照明の幕）
  // =================================================================
  let pageObjs = [], baked = [];
  // カモフラージュ：お題のまわりに、同じ色の似た小物を散らす
  const camoGeo = [roundedBox(0.03, 0.02, 0.03, 0.004, 1), new THREE.SphereGeometry(0.014, 8, 6), new THREE.CylinderGeometry(0.012, 0.012, 0.03, 8), new THREE.TorusGeometry(0.012, 0.004, 6, 12)];
  function camouflage(o) {
    let best = null, most = 0;
    o.traverse(m => { if (m.isMesh && m.material?.color) { const n = m.geometry.attributes.position.count; if (n > most) { most = n; best = m.material.color; } } });
    if (!best) return;
    const hex = '#' + best.getHexString(), cr = makeRng(o.id * 13 + 5);
    camoGeo.forEach((g, k) => {
      const m2 = scatter(cr, g, P('#fff', k % 2 ? 0.3 : 0.6, 0), 4, () => o.position.clone().add(V(cr.range(-0.16, 0.16), cr.range(0, 0.05), cr.range(-0.16, 0.16))), [hex]);
      m2.raycast = () => {}; if (LITE) m2.castShadow = false; (o.parent || root).add(m2); pageObjs.push(m2);
    });
  }
  function setAct(act) {
    const sky = ['#ffb46b', '#d88aa0', '#2a3a6a'][act];
    skyM.color.set(sky);
    sun.intensity = [3.2, 1.0, 0][act]; sun.color.set(['#ffb070', '#ff9a8a', '#000'][act]);
    moon.intensity = [0, 0.15, 1.3][act];
    hemi.intensity = [0.45, 0.35, 0.18][act]; hemi.color.set(['#ffe2c0', '#e8c0c8', '#5a6a9a'][act]);
    warm.forEach(w => { w.L.intensity = w.power * [0.1, 1, 0.55][act]; if (w.bulb) w.bulb.visible = act > 0; });
    shaftM.color.set(['#ffd9a0', '#ffb8c0', '#9ab4ff'][act]); shaftM.opacity = [0.08, 0.04, 0.06][act];
    dustM.color.set(['#ffe6b0', '#ffd0d0', '#c8d8ff'][act]);
    game.scene.environmentIntensity = [0.4, 0.3, 0.12][act];
    glowMats.forEach(m => m.emissiveIntensity = act === 2 ? 1.6 : 0.2);
  }
  function setPage(n) {
    pageObjs.forEach(o => o.parent?.remove(o)); pageObjs = [];
    baked.forEach(m => { m.parent?.remove(m); m.geometry.dispose(); }); baked = [];
    if (jackOpen) { jackOpen = false; clownHead.visible = false; jLid.rotation.x = 0; }
    const page = PAGES[n], r = makeRng(900 + n * 77);
    setAct(page.act);
    const place = (key, s, parentOverride, isTarget = false) => {
      const o = buildToy(key); o.position.copy(s.p);
      if (s.rot) o.rotation.set(...s.rot); else if (s.tilt) o.rotation.set(r.range(-0.7, 0.7), r() * 6.28, r.range(-0.7, 0.7)); else o.rotation.set(0, r() * 6.28, 0);
      o.scale.multiplyScalar((s.scale ?? TOY_SCALE) * (isTarget ? TARGET_SCALE : 1) * r.range(0.92, 1.1));
      (parentOverride || s.parent || root).add(o);
      if (s.hang) {   // 梁から吊るす紐
        const top = new THREE.Box3().setFromObject(o).max.y, wp = o.getWorldPosition(V());
        const str = mesh(new THREE.CylinderGeometry(0.0015, 0.0015, Math.max(0.05, s.hang - top), 3), P('#d8d0c0', 0.9), V(wp.x, (s.hang + top) / 2, wp.z), root, { cast: false });
        o.userData.string = str;
      }
      if (hasModel(key)) swapModel(key, o);
      return o;
    };
    const targets = page.targets.map(([key, where, lens]) => { const o = place(key, spots[where](), null, true); camouflage(o); if (!hasModel(key)) mergeStatic(o, { raycast: true }); if (lens) o.userData.lensOnly = true; pageObjs.push(o); if (o.userData.string) pageObjs.push(o.userData.string); return { id: key, name: TOY_MAP[key].name, obj: o }; });
    const sObj = place(page.secret[0], spots[page.secret[1]](), null, true); if (!hasModel(page.secret[0])) mergeStatic(sObj, { raycast: true }); if (page.secret[2] === 'lens') sObj.userData.lensOnly = true; pageObjs.push(sObj);
    if (page.secret[0] === 'owl') { sObj.visible = false; lookAways = 0; }   // 3回振り返ると出てくる
    const secret = { id: page.secret[0], name: TOY_MAP[page.secret[0]].name, obj: sObj };
    // おとり：お題以外の全部を、各クラスターへ（同じ物は置かない）
    const used = new Set([...page.targets.map(t => t[0]), page.secret[0]]);
    const weights = { pianoTop: 10, underPiano: 6, bench: 3, spiral: 14, toyPile: 22, horse: 1, trunk: 26, mirrorTop: 6, dollhouse: 16, chair: 5, gramTable: 4, cage: 4, beam: 30, sill: 4, lowShelf: 40, floor: 6 };
    const bag = []; for (const [k, w] of Object.entries(weights)) if (pools[k]) for (let i = 0; i < w; i++) bag.push(k);
    const rootDecoys = [], strings = [], byParent = new Map();
    TOYS.filter(d => !used.has(d.key) && !d.secret).forEach(d => {
      const k = r.pick(bag), list = pools[k], s = r.pick(list)(r);
      const o = place(d.key, s); if (o.userData.string) strings.push(o.userData.string);
      if (hasModel(d.key)) { pageObjs.push(o); return; }        // 本物のモデルはまとめずに置く
      // 動く物（鳥かご・木馬など）の上にある物だけ、その物と一緒にまとめる。ほかは部屋全体で1つにまとめる
      let par = root; for (let q2 = o.parent; q2 && q2 !== root; q2 = q2.parent) if (q2.userData.dynamic) { par = q2; break; }
      if (!byParent.has(par)) byParent.set(par, []); byParent.get(par).push(o);
    });
    for (const [par, list] of byParent) { const ms = bakeStatic(list, par); baked.push(...ms); list.forEach(o => o.parent?.remove(o)); }
    if (strings.length) { const ms = bakeStatic(strings, root); baked.push(...ms); strings.forEach(o => root.remove(o)); }
    if (LITE) baked.forEach(m => { m.castShadow = false; });
    fx.onPage(n, page, targets.concat([secret]));
    const hasLens = page.secret[2] === 'lens' || page.targets.some(t => t[2] === 'lens');
    return { targets, secret, hasLens, title: ['第一の幕　西日の さす ころ', '第二の幕　ランプが ともる ころ', '第三の幕　月かげの ざわめく ころ'][page.act] };
  }

  // =================================================================
  // 3Dならではの仕掛け（映画・絵画のオマージュ）
  // =================================================================
  fx = addAtticFx({ root, game, P, spots, pools, rng, WIN, D, W, warm, box });

  // =================================================================
  // 軽量化：動かない物をまとめる・小物の判定と影を省く
  // =================================================================
  root.traverse(o => {
    if (o.isInstancedMesh && !o.userData.interact) { o.raycast = () => {}; if (LITE && o.count > 30) o.castShadow = false; }
  });
  // 動くグループの中も、いっしょに動く部分はまとめる
  [rocker, cage].forEach(g => mergeStatic(g));
  [monkey, jack].forEach(g => mergeStatic(g, { raycast: true }));
  const mergeInfo = mergeStatic(root);
  if (LITE) root.traverse(o => { if (o.userData.mergedStatic && o.geometry.attributes.position.count < 3000) o.castShadow = false; });

  // =================================================================
  // 毎フレーム
  // =================================================================
  const bounds = new THREE.Box3(V(-W, 0, -D), V(W, RIDGE, D));
  const constrain = (p, r) => { const top = roofY(p.x) - r - 0.05; if (p.y > top) p.y = top; };
  const tmp = V(), camDir = V(), toObj = V();
  const seen = (obj, cam, deg = 55) => { cam.getWorldDirection(camDir); cam.getWorldPosition(tmp); obj.getWorldPosition(toObj).sub(tmp).normalize(); return camDir.dot(toObj) > Math.cos(THREE.MathUtils.degToRad(deg)); };
  let rockT = 0;
  return {
    id: 'toyroom', root, bounds, colliders, constrain, mergeInfo, spawn: { pos: V(0, 0, 2.2), yaw: 0 }, bgm: 'toyroom', pageCount: 3,
    ambience: { roomTone: 0.022, lowpass: 280, events: ['creak', 'chime'] },
    setPage,
    enter(scene, renderer) {
      scene.background = new THREE.Color('#120d09'); scene.fog = null;
      scene.environment = game.envTex; scene.environmentIntensity = 0.4;
      renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    },
    update(dt, t, cam) {
      for (let i = anims.length - 1; i >= 0; i--) { const a2 = anims[i]; a2.t += dt; a2.fn(Math.min(1, a2.t / a2.dur)); if (a2.t >= a2.dur) { anims.splice(i, 1); a2.done?.(); } }
      // ほこり
      const pp = dustG.attributes.position; for (let i = 0; i < dustN; i++) { pp.setY(i, pp.getY(i) + Math.sin(t * 0.4 + i) * 0.0005); pp.setX(i, pp.getX(i) + Math.cos(t * 0.3 + i * 1.3) * 0.0004); } pp.needsUpdate = true;
      // メトロノーム・天球儀・吊り物
      metroArm.rotation.z = Math.sin(t * 3.2) * 0.4;
      fx.update(dt, t, cam);
      pageObjs.forEach(o => { if (o.userData.lensOnly && !o.userData.found) o.visible = !!game.lens; });
      const sway = 0.03 + fx.wind * 0.25;
      cage.rotation.z = Math.sin(t * 2.1) * sway; balloon.rotation.z = Math.sin(t * 1.7 + 1) * sway; arm.rotation.z = Math.sin(t * 1.3) * sway * 0.6;
      rings.forEach((m, i) => m.rotation.y += dt * 0.05 * (i % 2 ? 1 : -1));
      cage.rotation.y = Math.sin(t * 0.3) * 0.08 + fx.wind * Math.sin(t * 3) * 0.3;
      // だるまさんがころんだ：くま・木馬・人形の目
      const bearSeen = seen(bear, cam, 60);
      if (!bearSeen) { const local = chair.worldToLocal(cam.getWorldPosition(V())); const want = THREE.MathUtils.clamp(Math.atan2(local.x, local.z), -0.8, 0.8);
        bearYaw += THREE.MathUtils.clamp(want - bearYaw, -dt * 0.3, dt * 0.3); (bearHead.parent ? bearHead : bear).rotation.y = hasModel('teddy') ? 0 : bearYaw; if (hasModel('teddy')) bear.rotation.y = bearYaw; }
      if (wasWatched && !bearSeen) { lookAways++; if (lookAways >= 3) pageObjs.forEach(o => { if (o.userData.itemId === 'owl') o.visible = true; }); }
      wasWatched = bearSeen;
      if (!seen(horse, cam, 60)) { rockT += dt; rocker.rotation.z = Math.sin(rockT * 1.6) * 0.06; }
      dollEyes.forEach(p => { const l = p.parent.worldToLocal(cam.getWorldPosition(V())).normalize(); p.position.copy(l.multiplyScalar(0.005)); });
      // サル（ピアノを鳴らすと腕が開き、胸ポケットが見える）
      if (monkeyT >= 0) { const prev = monkeyT; monkeyT += dt;
        const open = Math.max(0, Math.sin(monkeyT * 8)); arms.forEach((g, k) => g.rotation.y = (k ? 1 : -1) * (0.25 - 0.9 * open));
        if (Math.floor(prev * 8 / Math.PI / 2 + 0.25) !== Math.floor(monkeyT * 8 / Math.PI / 2 + 0.25)) game.sfx.cymbal(monkey.getWorldPosition(V()));
        if (monkeyT > 4) { monkeyT = -1; arms.forEach((g, k) => g.rotation.y = (k ? 1 : -1) * 0.25); } }
    },
  };
}
