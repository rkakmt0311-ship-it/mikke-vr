// おもちゃ部屋の物カタログ（すべて違う物。基本図形の組み合わせ／あとでGLBに差し替え可）
// 1つの物 = { key, name(お題の文字), build() → Group, secret? }
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { roundedBox, starShape } from '../util.js';
import { atlasTex, cell, mapUV, draw } from './atlas.js';

// ---------- 材質（kind ごとに質感を統一。まとめ描画でも同じ見た目になる） ----------
export const KINDS = {
  gloss: { r: 0.16 }, plastic: { r: 0.34 }, satin: { r: 0.55 }, matte: { r: 0.8 }, fabric: { r: 0.95 },
  wood: { r: 0.6 }, metal: { r: 0.26, m: 1 }, glass: { r: 0.05, t: 0.4 }, atlas: { r: 0.4, map: true }, atlasMatte: { r: 0.85, map: true },
};
const matCache = new Map();
// 超高画質では、ツヤのあるプラスチックに「上塗りの光沢（クリアコート）」、布に「やわらかい毛羽の光（シーン）」を足す
let ULTRA = false;
export function setUltra(on) { if (ULTRA !== on) { ULTRA = on; matCache.clear(); } }
export const isUltra = () => ULTRA;
export function makeKindMaterial(kind, params) {
  const k = KINDS[kind] || KINDS.plastic;
  const base = { roughness: k.r, metalness: k.m || 0, map: k.map ? atlasTex : null, transparent: !!k.t, opacity: k.t || 1, depthWrite: !k.t, ...params };
  if (!ULTRA) return new THREE.MeshStandardMaterial(base);
  const extra = { gloss: { clearcoat: 1, clearcoatRoughness: 0.05 }, plastic: { clearcoat: 0.5, clearcoatRoughness: 0.2 }, atlas: { clearcoat: 0.4, clearcoatRoughness: 0.25 },
    fabric: { sheen: 1, sheenRoughness: 0.6, sheenColor: new THREE.Color('#ffffff') }, satin: { sheen: 0.4, sheenRoughness: 0.5 },
    glass: { transmission: 0, ior: 1.5, clearcoat: 1, clearcoatRoughness: 0 }, metal: { clearcoat: 0.3, clearcoatRoughness: 0.15 } }[kind] || {};
  return new THREE.MeshPhysicalMaterial({ ...base, ...extra });
}
export function mat(color, kind = 'plastic') {
  const key = color + kind; if (matCache.has(key)) return matCache.get(key);
  const m = makeKindMaterial(kind, { color });
  m.userData.kind = kind; matCache.set(key, m); return m;
}

// ---------- 形 ----------
const PI = Math.PI;
const S = (r, w = 16, h = 12) => new THREE.SphereGeometry(r, w, h);
const HS = (r, w = 16) => new THREE.SphereGeometry(r, w, 8, 0, PI * 2, 0, PI / 2);   // 半球
const B = (x, y, z) => new THREE.BoxGeometry(x, y, z);
const RB = (x, y, z, r = Math.min(x, y, z) * 0.18) => roundedBox(x, y, z, r, 2);
const C = (rt, rb, h, s = 16) => new THREE.CylinderGeometry(rt, rb, h, s);
const K = (r, h, s = 16) => new THREE.ConeGeometry(r, h, s);
const T = (R, r, arc = PI * 2, rs = 8, ts = 24) => new THREE.TorusGeometry(R, r, rs, ts, arc);
const CAP = (r, l) => new THREE.CapsuleGeometry(r, l, 4, 10);
const LATHE = (pts, s = 18) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), s);
const EXT = (shape, d, bevel = 0.004) => { const g = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 10 }); g.center(); return g; };
const heartShape = (s) => { const h = new THREE.Shape(); h.moveTo(0, -0.05 * s); h.bezierCurveTo(-0.09 * s, 0.01 * s, -0.06 * s, 0.08 * s, 0, 0.04 * s); h.bezierCurveTo(0.06 * s, 0.08 * s, 0.09 * s, 0.01 * s, 0, -0.05 * s); return h; };
const tri = (w, h) => { const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(w, 0); s.lineTo(0, h); s.closePath(); return s; };
const ATL = (geo, key, fn) => mapUV(geo, cell(key, fn));

class Obj extends THREE.Group {
  p(geo, color, kind = 'plastic', pos = [0, 0, 0], rot = null, scl = null) {
    const m = new THREE.Mesh(geo, mat(color, kind)); m.position.set(...pos);
    if (rot) m.rotation.set(...rot); if (scl) m.scale.set(...scl);
    m.castShadow = m.receiveShadow = true; this.add(m); return m;
  }
  eyes(y, z, dx = 0.017, r = 0.008, col = '#111') { this.p(S(r, 8, 6), col, 'gloss', [-dx, y, z]); this.p(S(r, 8, 6), col, 'gloss', [dx, y, z]); }
  wheels(xs, zs, r, col = '#222', w = 0.02) { const g = () => C(r, r, w, 14).rotateX(PI / 2); xs.forEach(x => zs.forEach(z => this.p(g(), col, 'matte', [x, r, z]))); }
}

const DEFS = [];
const def = (key, name, build, extra = {}) => DEFS.push({ key, name, build, ...extra });

const COL = {
  red: ['あかい', '#d62828'], blue: ['あおい', '#1f5fd1'], yellow: ['きいろい', '#ffcf1f'], green: ['みどりの', '#2d9e4f'],
  pink: ['ピンクの', '#ff6fa8'], purple: ['むらさきの', '#7b2cbf'], orange: ['オレンジの', '#ff8c1a'], white: ['しろい', '#f4f1ea'],
  black: ['くろい', '#1b1b1b'], brown: ['ちゃいろい', '#8b5a2b'], sky: ['みずいろの', '#7cc6f2'], gold: ['きんの', '#e0b13a'], silver: ['ぎんの', '#c9ccd1'],
};

// =====================================================================
// 乗り物
// =====================================================================
function car(o, body, { len = 0.22, h = 0.055, w = 0.11, cab = 0.5, cabCol = body, r = 0.024 } = {}) {
  o.p(RB(len, h, w, 0.015), body, 'gloss', [0, r + h / 2 - 0.005, 0]);
  o.p(RB(len * cab, h * 0.9, w * 0.9, 0.015), cabCol, 'gloss', [-len * 0.05, r + h * 1.3, 0]);
  o.p(B(len * cab * 0.85, h * 0.6, w * 0.92), '#bfe6ff', 'glass', [-len * 0.05, r + h * 1.32, 0]);
  o.wheels([-len * 0.32, len * 0.32], [-w / 2, w / 2], r);
}
['red', 'blue', 'green', 'pink'].forEach(c => def(`car_${c}`, `${COL[c][0]} くるま`, () => { const o = new Obj(); car(o, COL[c][1]); return o; }));
def('taxi', 'タクシー', () => { const o = new Obj(); car(o, '#ffcf1f'); o.p(B(0.05, 0.02, 0.03), '#222', 'plastic', [-0.01, 0.13, 0]); return o; });
def('police', 'パトカー', () => { const o = new Obj(); car(o, '#f4f1ea', { cabCol: '#1b1b1b' }); o.p(B(0.03, 0.02, 0.05), '#e00', 'gloss', [-0.01, 0.13, 0]); return o; });
def('firetruck', 'しょうぼうしゃ', () => { const o = new Obj(); car(o, '#d62828', { len: 0.3, cab: 0.3 });
  o.p(B(0.22, 0.012, 0.04), '#c9ccd1', 'metal', [0.03, 0.12, 0], [0, 0, 0.12]); for (let i = 0; i < 6; i++) o.p(B(0.006, 0.01, 0.05), '#c9ccd1', 'metal', [-0.06 + i * 0.035, 0.125 + i * 0.004, 0]); return o; });
def('ambulance', 'きゅうきゅうしゃ', () => { const o = new Obj(); o.p(RB(0.24, 0.1, 0.11), '#f4f1ea', 'gloss', [0, 0.075, 0]); o.p(B(0.241, 0.015, 0.111), '#d62828', 'plastic', [0, 0.08, 0]);
  o.p(B(0.05, 0.04, 0.112), '#bfe6ff', 'glass', [0.08, 0.1, 0]); o.wheels([-0.07, 0.07], [-0.055, 0.055], 0.024); return o; });
[['yellow', '#ffcf1f'], ['green', '#3aa655']].forEach(([c, hex]) => def(`bus_${c}`, `${COL[c][0]} バス`, () => { const o = new Obj();
  o.p(RB(0.3, 0.11, 0.11), hex, 'gloss', [0, 0.08, 0]); o.p(B(0.26, 0.035, 0.112), '#bfe6ff', 'glass', [0, 0.1, 0]); o.wheels([-0.09, 0.09], [-0.055, 0.055], 0.024); return o; }));
def('truck', 'トラック', () => { const o = new Obj(); o.p(RB(0.08, 0.08, 0.11), '#1f5fd1', 'gloss', [0.1, 0.065, 0]); o.p(B(0.18, 0.1, 0.12), '#f4f1ea', 'satin', [-0.04, 0.075, 0]); o.wheels([-0.09, 0.1], [-0.055, 0.055], 0.024); return o; });
def('dumptruck', 'ダンプカー', () => { const o = new Obj(); o.p(RB(0.07, 0.08, 0.11), '#ff8c1a', 'gloss', [0.1, 0.065, 0]); const bed = o.p(B(0.17, 0.05, 0.12), '#ffb703', 'plastic', [-0.04, 0.09, 0], [0, 0, 0.3]); o.wheels([-0.08, 0.1], [-0.055, 0.055], 0.026); return o; });
def('digger', 'ショベルカー', () => { const o = new Obj(); o.p(B(0.16, 0.03, 0.1), '#333', 'matte', [0, 0.02, 0]); o.p(RB(0.1, 0.07, 0.09), '#ffcf1f', 'gloss', [-0.02, 0.07, 0]);
  o.p(B(0.14, 0.018, 0.02), '#ffcf1f', 'gloss', [0.08, 0.11, 0], [0, 0, 0.5]); o.p(B(0.04, 0.03, 0.05), '#555', 'metal', [0.15, 0.12, 0]); return o; });
def('bulldozer', 'ブルドーザー', () => { const o = new Obj(); o.p(B(0.15, 0.035, 0.11), '#333', 'matte', [0, 0.02, 0]); o.p(RB(0.1, 0.07, 0.09), '#ff8c1a', 'gloss', [-0.01, 0.07, 0]); o.p(B(0.015, 0.06, 0.14), '#999', 'metal', [0.1, 0.04, 0]); return o; });
def('train', 'みどりの でんしゃ', () => { const o = new Obj(); o.p(RB(0.28, 0.09, 0.09), '#3aa655', 'gloss', [0, 0.065, 0]); o.p(B(0.24, 0.03, 0.092), '#ffe9b0', 'plastic', [0, 0.08, 0]); o.wheels([-0.09, -0.04, 0.04, 0.09], [-0.045, 0.045], 0.018, '#444'); return o; });
def('shinkansen', 'しんかんせん', () => { const o = new Obj(); o.p(CAP(0.045, 0.24), '#f7f7f7', 'gloss', [0, 0.06, 0], [0, 0, PI / 2], [1, 1, 1.1]); o.p(B(0.26, 0.012, 0.1), '#1f5fd1', 'plastic', [0, 0.045, 0]); o.wheels([-0.09, 0.09], [-0.04, 0.04], 0.015, '#444'); return o; });
def('steam', 'きかんしゃ', () => { const o = new Obj(); o.p(C(0.04, 0.04, 0.16, 18).rotateZ(PI / 2), '#1b1b1b', 'gloss', [0.02, 0.07, 0]); o.p(B(0.07, 0.1, 0.09), '#1b1b1b', 'gloss', [-0.08, 0.08, 0]);
  o.p(C(0.015, 0.02, 0.05), '#1b1b1b', 'gloss', [0.07, 0.13, 0]); o.wheels([-0.06, 0.0, 0.06], [-0.045, 0.045], 0.024, '#c1121f'); return o; });
def('plane', 'ひこうき', () => { const o = new Obj(); o.p(CAP(0.03, 0.18), '#f4f1ea', 'gloss', [0, 0.04, 0], [0, 0, PI / 2]); o.p(RB(0.06, 0.008, 0.26), '#d62828', 'gloss', [0.01, 0.04, 0]);
  o.p(RB(0.04, 0.05, 0.008), '#d62828', 'gloss', [-0.1, 0.07, 0]); o.p(RB(0.03, 0.006, 0.09), '#d62828', 'gloss', [-0.1, 0.045, 0]); return o; });
def('heli', 'ヘリコプター', () => { const o = new Obj(); o.p(S(0.05), '#ffcf1f', 'gloss', [0, 0.06, 0], null, [1.3, 1, 1]); o.p(C(0.008, 0.015, 0.13).rotateZ(PI / 2), '#ffcf1f', 'gloss', [-0.11, 0.07, 0]);
  o.p(B(0.24, 0.004, 0.015), '#333', 'matte', [0, 0.12, 0]); o.p(B(0.015, 0.004, 0.24), '#333', 'matte', [0, 0.12, 0]); o.p(B(0.14, 0.008, 0.008), '#333', 'metal', [0, 0.008, 0.035]); o.p(B(0.14, 0.008, 0.008), '#333', 'metal', [0, 0.008, -0.035]); return o; });
def('boat', 'ふね', () => { const o = new Obj(); const hull = new THREE.Shape(); hull.moveTo(-0.12, 0.04); hull.lineTo(0.14, 0.04); hull.lineTo(0.1, 0); hull.lineTo(-0.1, 0); hull.closePath();
  o.p(EXT(hull, 0.09), '#d62828', 'gloss', [0, 0.02, 0]); o.p(B(0.1, 0.05, 0.06), '#f4f1ea', 'satin', [-0.02, 0.07, 0]); o.p(C(0.012, 0.012, 0.05), '#1b1b1b', 'gloss', [0.0, 0.11, 0]); return o; });
def('yacht', 'ヨット', () => { const o = new Obj(); const hull = new THREE.Shape(); hull.moveTo(-0.1, 0.03); hull.lineTo(0.12, 0.03); hull.lineTo(0.08, 0); hull.lineTo(-0.08, 0); hull.closePath();
  o.p(EXT(hull, 0.06), '#1f5fd1', 'gloss', [0, 0.015, 0]); o.p(C(0.004, 0.004, 0.2), '#8b5a2b', 'wood', [0, 0.13, 0]); o.p(EXT(tri(0.1, 0.16), 0.003, 0), '#fff8e8', 'fabric', [0.05, 0.12, 0]); return o; });
def('submarine', 'せんすいかん', () => { const o = new Obj(); o.p(CAP(0.04, 0.14), '#ffcf1f', 'gloss', [0, 0.045, 0], [0, 0, PI / 2]); o.p(RB(0.05, 0.04, 0.03), '#ffcf1f', 'gloss', [0, 0.095, 0]);
  o.p(C(0.004, 0.004, 0.05), '#555', 'metal', [0.01, 0.13, 0]); [-0.04, 0, 0.04].forEach(x => o.p(C(0.012, 0.012, 0.01, 12).rotateX(PI / 2), '#7cc6f2', 'glass', [x, 0.05, 0.04])); return o; });
def('rocket', 'ロケット', () => { const o = new Obj(); o.p(C(0.035, 0.035, 0.14), '#f2f2f2', 'gloss', [0, 0.1, 0]); o.p(K(0.035, 0.07), '#d62828', 'gloss', [0, 0.205, 0]);
  o.p(C(0.016, 0.016, 0.01, 14).rotateX(PI / 2), '#4cc9f0', 'glass', [0, 0.13, 0.035]);
  for (let i = 0; i < 3; i++) { const a = i * 2.094; o.p(B(0.006, 0.05, 0.04), '#d62828', 'gloss', [Math.sin(a) * 0.04, 0.045, Math.cos(a) * 0.04], [0, a, 0]); } return o; });
def('ufo', 'ユーフォー', () => { const o = new Obj(); o.p(S(0.09, 24, 10), '#c9ccd1', 'metal', [0, 0.03, 0], null, [1, 0.25, 1]); o.p(HS(0.04), '#9be7ff', 'glass', [0, 0.045, 0]);
  for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2; o.p(S(0.008, 8, 6), '#ffe27a', 'gloss', [Math.cos(a) * 0.075, 0.025, Math.sin(a) * 0.075]); } return o; });
def('tractor', 'トラクター', () => { const o = new Obj(); o.p(RB(0.14, 0.06, 0.08), '#2d9e4f', 'gloss', [0.02, 0.06, 0]); o.p(B(0.05, 0.06, 0.07), '#2d9e4f', 'gloss', [-0.03, 0.11, 0]);
  [[-0.05, 0.045], [0.07, 0.025]].forEach(([x, r]) => [-0.05, 0.05].forEach(z => o.p(C(r, r, 0.025, 16).rotateX(PI / 2), '#222', 'matte', [x, r, z]))); return o; });
def('racer', 'レーシングカー', () => { const o = new Obj(); o.p(RB(0.24, 0.035, 0.1), '#d62828', 'gloss', [0, 0.035, 0]); o.p(S(0.025), '#222', 'gloss', [-0.02, 0.06, 0]);
  o.p(B(0.02, 0.03, 0.11), '#1b1b1b', 'plastic', [-0.11, 0.07, 0]); o.wheels([-0.08, 0.08], [-0.06, 0.06], 0.022); return o; });
def('bicycle', 'じてんしゃ', () => { const o = new Obj(); [-0.07, 0.07].forEach(x => o.p(T(0.045, 0.006), '#222', 'matte', [x, 0.05, 0]));
  o.p(B(0.14, 0.008, 0.008), '#1f5fd1', 'gloss', [0, 0.07, 0], [0, 0, 0.2]); o.p(B(0.008, 0.07, 0.008), '#1f5fd1', 'gloss', [0.05, 0.08, 0]); o.p(B(0.03, 0.008, 0.015), '#222', 'matte', [-0.02, 0.1, 0]); return o; });

// =====================================================================
// どうぶつ（ぬいぐるみ・フィギュア）
// =====================================================================
function animal(o, c) {
  const s = c.s ?? 1, k = c.k ?? 'fabric', H = c.head ?? c.body;
  o.p(S(0.06 * s), c.body, k, [0, 0.058 * s, 0], null, [1, 1.05, 0.9]);
  o.p(S(0.047 * s), H, k, [0, 0.145 * s, 0.006 * s]);
  const ear = c.ear ?? 'round', E = c.earCol ?? H;
  if (ear === 'round') [-1, 1].forEach(d => o.p(S(0.016 * s, 10, 8), E, k, [d * 0.032 * s, 0.182 * s, 0]));
  if (ear === 'long') [-1, 1].forEach(d => o.p(CAP(0.012 * s, 0.06 * s), E, k, [d * 0.018 * s, 0.215 * s, 0], [0, 0, d * -0.15]));
  if (ear === 'point') [-1, 1].forEach(d => o.p(K(0.016 * s, 0.035 * s, 6), E, k, [d * 0.028 * s, 0.185 * s, 0]));
  if (ear === 'floppy') [-1, 1].forEach(d => o.p(S(0.018 * s, 10, 8), E, k, [d * 0.048 * s, 0.135 * s, 0], null, [0.6, 1.4, 0.8]));
  if (ear === 'big') [-1, 1].forEach(d => o.p(S(0.028 * s, 12, 8), E, k, [d * 0.042 * s, 0.18 * s, -0.005], null, [1, 1, 0.35]));
  o.eyes(0.155 * s, 0.045 * s, 0.017 * s, 0.007 * s);
  if (c.snout) o.p(S(0.017 * s, 10, 8), c.snout, k, [0, 0.135 * s, 0.045 * s]);
  if (c.extra) c.extra(o, s);
}
def('bear_brown', 'ちゃいろい くま', () => { const o = new Obj(); animal(o, { body: '#9c6b3a', snout: '#e8cfa8', extra: (o, s) => o.p(T(0.03, 0.006), '#d62828', 'fabric', [0, 0.1, 0.02], [PI / 2, 0, 0]) }); return o; });
def('bear_white', 'しろくま', () => { const o = new Obj(); animal(o, { body: '#f3f0e8', snout: '#fff', s: 1.1 }); return o; });
def('panda', 'パンダ', () => { const o = new Obj(); animal(o, { body: '#1b1b1b', head: '#f6f6f2', earCol: '#1b1b1b', snout: '#fff',
  extra: (o, s) => [-1, 1].forEach(d => o.p(S(0.013 * s, 10, 8), '#1b1b1b', 'fabric', [d * 0.018 * s, 0.153 * s, 0.038 * s], null, [1, 1.3, 0.6])) }); return o; });
def('rabbit_white', 'しろい うさぎ', () => { const o = new Obj(); animal(o, { body: '#faf7f2', ear: 'long', snout: '#ffd6e0' }); return o; });
def('rabbit_pink', 'ピンクの うさぎ', () => { const o = new Obj(); animal(o, { body: '#ffb3c8', ear: 'long', s: 0.85 }); return o; });
def('cat_orange', 'オレンジの ねこ', () => { const o = new Obj(); animal(o, { body: '#ff9a3c', ear: 'point', extra: (o, s) => o.p(CAP(0.008, 0.08), '#ff9a3c', 'fabric', [-0.06, 0.06, -0.03], [0, 0, 1]) }); return o; });
def('dog', 'いぬ', () => { const o = new Obj(); animal(o, { body: '#e6c79c', ear: 'floppy', earCol: '#8b5a2b', snout: '#fff1dd' }); return o; });
def('pig', 'ぶた', () => { const o = new Obj(); animal(o, { body: '#ffb6c1', ear: 'point', k: 'satin', extra: (o, s) => o.p(C(0.016, 0.016, 0.012).rotateX(PI / 2), '#ff8fab', 'satin', [0, 0.137, 0.05]) }); return o; });
def('mouse', 'ねずみ', () => { const o = new Obj(); animal(o, { body: '#a7a7ad', ear: 'big', earCol: '#ffc0cb', s: 0.8 }); return o; });
def('sheep', 'ひつじ', () => { const o = new Obj(); animal(o, { body: '#fbfbf5', head: '#2b2b2b', ear: 'floppy', earCol: '#2b2b2b',
  extra: (o, s) => { for (let i = 0; i < 7; i++) { const a = i / 7 * PI * 2; o.p(S(0.03, 10, 8), '#fbfbf5', 'fabric', [Math.cos(a) * 0.045, 0.07 + (i % 2) * 0.02, Math.sin(a) * 0.04]); } } }); return o; });
def('fox', 'きつね', () => { const o = new Obj(); animal(o, { body: '#e8742a', ear: 'point', snout: '#fff', extra: (o) => o.p(CAP(0.02, 0.06), '#e8742a', 'fabric', [-0.06, 0.05, -0.02], [0, 0, 1.1]) }); return o; });
def('lion', 'ライオン', () => { const o = new Obj(); animal(o, { body: '#f2c14e', snout: '#fff3d0', extra: (o) => o.p(T(0.045, 0.018, PI * 2, 8, 18), '#a0522d', 'fabric', [0, 0.145, 0], [0, 0, 0]) }); return o; });
def('monkey_toy', 'おさるの にんぎょう', () => { const o = new Obj(); animal(o, { body: '#6b3f1d', ear: 'big', earCol: '#e8c49a', snout: '#e8c49a' }); return o; });
def('elephant', 'ぞう', () => { const o = new Obj(); animal(o, { body: '#9aa3b0', ear: 'big', s: 1.1, extra: (o) => o.p(CAP(0.012, 0.06), '#9aa3b0', 'fabric', [0, 0.11, 0.06], [0.5, 0, 0]) }); return o; });
def('giraffe', 'きりん', () => { const o = new Obj(); o.p(S(0.05), '#f2c14e', 'satin', [0, 0.07, 0], null, [1.4, 1, 0.8]); o.p(C(0.014, 0.018, 0.14), '#f2c14e', 'satin', [0.04, 0.17, 0], [0, 0, -0.3]);
  o.p(S(0.025), '#f2c14e', 'satin', [0.075, 0.245, 0], null, [1.4, 1, 1]); [-0.04, 0.04].forEach(x => [-0.02, 0.02].forEach(z => o.p(C(0.008, 0.008, 0.06), '#c98a2b', 'satin', [x, 0.03, z]))); return o; });
def('crocodile', 'わに', () => { const o = new Obj(); o.p(CAP(0.03, 0.2), '#3a8d4f', 'satin', [0, 0.03, 0], [0, 0, PI / 2], [1, 1, 0.8]); o.p(B(0.08, 0.02, 0.04), '#3a8d4f', 'satin', [0.15, 0.03, 0]);
  o.eyes(0.06, 0, 0.012, 0.008); o.children.at(-1).position.x = 0.1; o.children.at(-2).position.x = 0.1; return o; });
def('chick', 'ひよこ', () => { const o = new Obj(); o.p(S(0.045), '#ffe066', 'fabric', [0, 0.045, 0]); o.p(S(0.03), '#ffe066', 'fabric', [0, 0.1, 0.01]); o.p(K(0.01, 0.02, 8), '#ff8c1a', 'satin', [0, 0.098, 0.045], [PI / 2, 0, 0]); o.eyes(0.11, 0.035, 0.012, 0.005); return o; });
def('duck', 'きいろい アヒル', () => { const o = new Obj(); o.p(S(0.08), '#ffd21f', 'gloss', [0, 0.06, 0], null, [1.25, 0.8, 1]); o.p(S(0.052), '#ffd21f', 'gloss', [0.065, 0.14, 0]);
  o.p(K(0.022, 0.05, 12), '#ff7b00', 'gloss', [0.12, 0.135, 0], [0, 0, -PI / 2]); o.p(S(0.009, 8, 6), '#111', 'gloss', [0.1, 0.16, 0.03]); o.p(S(0.009, 8, 6), '#111', 'gloss', [0.1, 0.16, -0.03]); return o; });
def('penguin', 'ペンギン', () => { const o = new Obj(); o.p(CAP(0.04, 0.06), '#1b1b1b', 'satin', [0, 0.075, 0]); o.p(S(0.032), '#f4f1ea', 'satin', [0, 0.07, 0.015], null, [1, 1.4, 0.8]);
  o.p(K(0.01, 0.025, 8), '#ff8c1a', 'satin', [0, 0.12, 0.04], [PI / 2, 0, 0]); o.eyes(0.13, 0.035, 0.012, 0.005); return o; });
def('owl', 'ふくろう', () => { const o = new Obj(); o.p(S(0.06), '#8b5a2b', 'fabric', [0, 0.07, 0], null, [1, 1.2, 0.9]); [-0.022, 0.022].forEach(x => { o.p(S(0.02, 12, 8), '#fff8e8', 'satin', [x, 0.1, 0.045]); o.p(S(0.01, 8, 6), '#111', 'gloss', [x, 0.1, 0.062]); });
  [-0.03, 0.03].forEach(x => o.p(K(0.012, 0.03, 6), '#8b5a2b', 'fabric', [x, 0.15, 0])); return o; });
def('bird_blue', 'あおい ことり', () => { const o = new Obj(); o.p(S(0.04), '#3a86ff', 'satin', [0, 0.045, 0], null, [1.3, 1, 1]); o.p(S(0.028), '#3a86ff', 'satin', [0.045, 0.08, 0]);
  o.p(K(0.008, 0.02, 6), '#ffb703', 'satin', [0.075, 0.08, 0], [0, 0, -PI / 2]); o.p(B(0.04, 0.005, 0.03), '#3a86ff', 'satin', [-0.055, 0.06, 0], [0, 0, 0.4]); return o; });
def('chicken', 'にわとり', () => { const o = new Obj(); o.p(S(0.05), '#fbfbf5', 'satin', [0, 0.06, 0], null, [1.2, 1, 0.9]); o.p(S(0.03), '#fbfbf5', 'satin', [0.04, 0.12, 0]);
  o.p(B(0.03, 0.02, 0.008), '#e00', 'satin', [0.04, 0.155, 0]); o.p(K(0.008, 0.02, 6), '#ffb703', 'satin', [0.075, 0.12, 0], [0, 0, -PI / 2]); return o; });
def('frog', 'かえる', () => { const o = new Obj(); o.p(S(0.06), '#5cb85c', 'gloss', [0, 0.04, 0], null, [1.1, 0.7, 1]); [-0.025, 0.025].forEach(x => { o.p(S(0.017, 10, 8), '#5cb85c', 'gloss', [x, 0.085, 0.03]); o.p(S(0.008, 8, 6), '#111', 'gloss', [x, 0.09, 0.045]); }); return o; });
def('turtle', 'かめ', () => { const o = new Obj(); o.p(HS(0.06), '#3a7d44', 'satin', [0, 0.015, 0]); o.p(S(0.022), '#9bc53d', 'satin', [0, 0.025, 0.07]);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([x, z]) => o.p(S(0.015, 8, 6), '#9bc53d', 'satin', [x * 0.045, 0.012, z * 0.04])); return o; });
def('snake', 'へび', () => { const o = new Obj(); o.p(T(0.05, 0.014, PI * 1.8), '#7cb518', 'gloss', [0, 0.015, 0], [PI / 2, 0, 0]); o.p(T(0.032, 0.013, PI * 1.6), '#7cb518', 'gloss', [0, 0.04, 0], [PI / 2, 0, 1]);
  o.p(S(0.018), '#7cb518', 'gloss', [0.03, 0.065, 0.01]); return o; });
def('snail', 'かたつむり', () => { const o = new Obj(); o.p(CAP(0.015, 0.08), '#f2d4a0', 'gloss', [0, 0.015, 0], [0, 0, PI / 2]); o.p(T(0.03, 0.017), '#c98a2b', 'gloss', [-0.01, 0.05, 0]); o.p(S(0.02), '#a0522d', 'gloss', [-0.01, 0.05, 0]);
  [-0.006, 0.006].forEach(z => o.p(C(0.002, 0.002, 0.03), '#f2d4a0', 'gloss', [0.055, 0.04, z])); return o; });
def('ladybug', 'てんとうむし', () => { const o = new Obj(); o.p(HS(0.045), '#e00', 'gloss', [0, 0.005, 0]); o.p(S(0.018), '#111', 'gloss', [0.045, 0.012, 0]);
  [[0, 0.012], [-0.02, -0.025], [0.015, -0.03], [-0.02, 0.025], [0.015, 0.03]].forEach(([x, z]) => o.p(S(0.008, 8, 6), '#111', 'gloss', [x, 0.04, z], null, [1, 0.4, 1])); return o; });
def('butterfly', 'ちょうちょ', () => { const o = new Obj(); o.p(CAP(0.006, 0.05), '#222', 'satin', [0, 0.02, 0], [PI / 2, 0, 0]);
  [-1, 1].forEach(d => { o.p(S(0.035, 12, 8), '#ff8fab', 'satin', [d * 0.035, 0.02, -0.01], null, [1, 0.12, 1.2]); o.p(S(0.025, 12, 8), '#ffd166', 'satin', [d * 0.03, 0.02, 0.03], null, [1, 0.12, 1]); }); return o; });
def('fish_orange', 'オレンジの さかな', () => { const o = new Obj(); o.p(S(0.055), '#ff7f11', 'gloss', [0, 0.05, 0], null, [1.7, 1, 0.55]); o.p(K(0.04, 0.06, 4), '#ff7f11', 'gloss', [-0.11, 0.05, 0], [0, 0, PI / 2]);
  o.p(B(0.01, 0.09, 0.062), '#fff', 'gloss', [0.01, 0.05, 0]); return o; });
def('whale', 'くじら', () => { const o = new Obj(); o.p(S(0.07), '#3a6ea5', 'gloss', [0, 0.055, 0], null, [1.6, 0.9, 0.9]); o.p(S(0.06), '#dbe9f6', 'gloss', [0.01, 0.04, 0], null, [1.5, 0.6, 0.85]);
  o.p(B(0.05, 0.008, 0.08), '#3a6ea5', 'gloss', [-0.13, 0.07, 0], [0, 0, 0.4]); return o; });
def('octopus', 'たこ', () => { const o = new Obj(); o.p(S(0.05), '#e85d75', 'gloss', [0, 0.08, 0], null, [1, 1.2, 1]); for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2; o.p(CAP(0.01, 0.05), '#e85d75', 'gloss', [Math.cos(a) * 0.04, 0.02, Math.sin(a) * 0.04], [Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6]); }
  o.eyes(0.09, 0.045, 0.018, 0.008); return o; });
def('crab', 'かに', () => { const o = new Obj(); o.p(S(0.05), '#e63946', 'gloss', [0, 0.03, 0], null, [1.3, 0.6, 1]);
  [-1, 1].forEach(d => { o.p(S(0.02, 10, 8), '#e63946', 'gloss', [d * 0.08, 0.05, 0.03], null, [1, 0.7, 0.6]); for (let i = 0; i < 3; i++) o.p(C(0.004, 0.004, 0.05), '#e63946', 'gloss', [d * 0.065, 0.02, -0.02 + i * 0.02], [0, 0, d * 1.1]); });
  o.eyes(0.06, 0.03, 0.015, 0.007); return o; });

// =====================================================================
// たべもの（おもちゃ・ほんもの風）
// =====================================================================
def('apple_red', 'あかい りんご', () => { const o = new Obj(); o.p(S(0.075, 20, 14), '#c1121f', 'gloss', [0, 0.07, 0], null, [1, 0.92, 1]); o.p(C(0.006, 0.008, 0.05, 6), '#5a3a1a', 'wood', [0, 0.15, 0]);
  o.p(S(0.03, 10, 6), '#3a8d2f', 'satin', [0.025, 0.15, 0], [0, 0, 0.5], [1, 0.25, 0.5]); return o; });
def('apple_green', 'あおりんご', () => { const o = new Obj(); o.p(S(0.07, 20, 14), '#8fcf3c', 'gloss', [0, 0.065, 0], null, [1, 0.9, 1]); o.p(C(0.006, 0.008, 0.04, 6), '#5a3a1a', 'wood', [0, 0.14, 0]); return o; });
def('banana', 'バナナ', () => { const o = new Obj(); o.p(T(0.1, 0.02, PI * 0.6, 8, 16), '#ffe135', 'satin', [0, 0.11, 0], [0, 0, PI * 1.2]); return o; });
def('strawberry', 'いちご', () => { const o = new Obj(); o.p(LATHE([[0, 0], [0.025, 0.01], [0.04, 0.04], [0.035, 0.065], [0, 0.07]]), '#e5383b', 'gloss', [0, 0, 0], [PI, 0, 0]); o.children.at(-1).position.y = 0.07;
  o.p(K(0.035, 0.012, 6), '#2d9e4f', 'satin', [0, 0.075, 0]); return o; });
def('grapes', 'ぶどう', () => { const o = new Obj(); [[0, 0.1], [-0.02, 0.085], [0.02, 0.085], [-0.03, 0.065], [0, 0.065], [0.03, 0.065], [-0.015, 0.045], [0.015, 0.045], [0, 0.025]].forEach(([x, y], i) => o.p(S(0.018, 12, 8), '#6a2c91', 'gloss', [x, y, (i % 2) * 0.01]));
  o.p(C(0.003, 0.003, 0.03), '#5a3a1a', 'wood', [0, 0.13, 0]); return o; });
def('cherry', 'さくらんぼ', () => { const o = new Obj(); [-0.025, 0.025].forEach(x => o.p(S(0.022, 14, 10), '#b5121b', 'gloss', [x, 0.022, 0])); o.p(T(0.04, 0.003, PI * 0.8, 6, 12), '#3a7d1a', 'satin', [0, 0.04, 0], [0, 0, 0.3 * PI]); return o; });
def('lemon', 'レモン', () => { const o = new Obj(); o.p(S(0.045, 16, 12), '#ffe347', 'satin', [0, 0.04, 0], null, [1.4, 1, 1]); [-1, 1].forEach(d => o.p(S(0.012, 8, 6), '#ffe347', 'satin', [d * 0.066, 0.04, 0])); return o; });
def('orange', 'みかん', () => { const o = new Obj(); o.p(S(0.05, 18, 12), '#ff9f1c', 'satin', [0, 0.045, 0], null, [1, 0.85, 1]); o.p(S(0.012, 8, 6), '#3a8d2f', 'satin', [0, 0.09, 0], null, [1, 0.4, 1]); return o; });
def('peach', 'もも', () => { const o = new Obj(); o.p(S(0.055, 18, 12), '#ffb4a2', 'fabric', [0, 0.052, 0]); o.p(S(0.02, 8, 6), '#7cb518', 'satin', [0.015, 0.105, 0], null, [1, 0.25, 0.6]); return o; });
def('watermelon', 'すいか', () => { const o = new Obj(); const sh = new THREE.Shape(); sh.absarc(0, 0, 0.08, 0, PI); sh.closePath();
  o.p(EXT(sh, 0.03, 0.003), '#ef476f', 'satin', [0, 0.045, 0]); o.p(EXT((() => { const s = new THREE.Shape(); s.absarc(0, 0, 0.085, 0, PI); s.absarc(0, 0, 0.078, PI, 0, true); return s; })(), 0.032, 0), '#2d6a4f', 'satin', [0, 0.045, 0]); return o; });
def('carrot', 'にんじん', () => { const o = new Obj(); o.p(K(0.022, 0.13, 12), '#ff7f11', 'satin', [0, 0.022, 0], [0, 0, PI / 2]); [0, 0.5, -0.5].forEach(a => o.p(K(0.006, 0.05, 4), '#3a8d2f', 'satin', [-0.085, 0.03, 0], [a, 0, PI / 2])); return o; });
def('tomato', 'トマト', () => { const o = new Obj(); o.p(S(0.05, 18, 12), '#e63946', 'gloss', [0, 0.042, 0], null, [1, 0.8, 1]); o.p(K(0.025, 0.01, 6), '#2d9e4f', 'satin', [0, 0.085, 0]); return o; });
def('eggplant', 'なす', () => { const o = new Obj(); o.p(CAP(0.028, 0.07), '#4b2a6a', 'gloss', [0, 0.03, 0], [0, 0, PI / 2]); o.p(K(0.02, 0.025, 6), '#2d6a4f', 'satin', [0.065, 0.03, 0], [0, 0, -PI / 2]); return o; });
def('donut_pink', 'ピンクの ドーナツ', () => { const o = new Obj(); o.p(T(0.04, 0.022, PI * 2, 12, 24), '#d9a066', 'satin', [0, 0.022, 0], [PI / 2, 0, 0]); o.p(T(0.04, 0.02, PI * 2, 12, 24), '#ff8fab', 'gloss', [0, 0.03, 0], [PI / 2, 0, 0], [1, 1, 0.6]); return o; });
def('donut_choco', 'チョコの ドーナツ', () => { const o = new Obj(); o.p(T(0.04, 0.022, PI * 2, 12, 24), '#d9a066', 'satin', [0, 0.022, 0], [PI / 2, 0, 0]); o.p(T(0.04, 0.02, PI * 2, 12, 24), '#4a2c18', 'gloss', [0, 0.03, 0], [PI / 2, 0, 0], [1, 1, 0.6]); return o; });
def('cake', 'ショートケーキ', () => { const o = new Obj(); const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(0.1, -0.03); sh.lineTo(0.1, 0.03); sh.closePath();
  o.p(EXT(sh, 0.06, 0.004), '#fff8ee', 'satin', [0, 0.03, 0], [PI / 2, 0, 0]); o.p(S(0.016, 12, 8), '#e5383b', 'gloss', [0.02, 0.07, 0]); return o; });
def('icecream', 'ソフトクリーム', () => { const o = new Obj(); o.p(K(0.03, 0.09, 14), '#d9a066', 'satin', [0, 0.045, 0], [PI, 0, 0]); o.p(S(0.03), '#fff8ee', 'satin', [0, 0.1, 0]); o.p(K(0.025, 0.05, 16), '#fff8ee', 'satin', [0, 0.14, 0]); return o; });
def('lollipop', 'ペロペロキャンディ', () => { const o = new Obj(); o.p(C(0.004, 0.004, 0.12, 6), '#fff', 'satin', [0, 0.06, 0]); o.p(ATL(C(0.045, 0.045, 0.015, 24), 'swirl_pink', draw.swirl('#ff8fab', '#fff')), '#fff', 'atlas', [0, 0.15, 0], [PI / 2, 0, 0]); return o; });
def('candy', 'つつみの あめ', () => { const o = new Obj(); o.p(ATL(S(0.025, 14, 10), 'wrap_yel', draw.wrap('#ffd166', '#ef476f')), '#fff', 'atlas', [0, 0.025, 0], null, [1.3, 1, 1]);
  [-1, 1].forEach(d => o.p(K(0.02, 0.03, 8), '#ffd166', 'gloss', [d * 0.045, 0.025, 0], [0, 0, d * PI / 2])); return o; });
def('cookie', 'クッキー', () => { const o = new Obj(); o.p(C(0.04, 0.04, 0.012, 20), '#d4a373', 'matte', [0, 0.006, 0]); [[0.01, 0.01], [-0.015, 0.005], [0.005, -0.018], [-0.01, -0.02], [0.022, -0.005]].forEach(([x, z]) => o.p(S(0.006, 6, 4), '#4a2c18', 'matte', [x, 0.013, z])); return o; });
def('onigiri', 'おにぎり', () => { const o = new Obj(); const sh = new THREE.Shape(); sh.moveTo(-0.045, -0.035); sh.quadraticCurveTo(0, 0.08, 0.045, -0.035); sh.closePath();
  o.p(EXT(sh, 0.03, 0.008), '#fbfbf5', 'matte', [0, 0.045, 0]); o.p(B(0.04, 0.035, 0.048), '#1b2a1b', 'satin', [0, 0.025, 0]); return o; });
def('bread', 'しょくパン', () => { const o = new Obj(); o.p(RB(0.09, 0.08, 0.025, 0.01), '#e9c46a', 'matte', [0, 0.04, 0]); o.p(RB(0.075, 0.065, 0.027, 0.008), '#fff3d6', 'matte', [0, 0.037, 0]); return o; });
def('cheese', 'チーズ', () => { const o = new Obj(); o.p(EXT(tri(0.1, 0.06), 0.04, 0.003), '#ffd166', 'satin', [0, 0.02, 0], [PI / 2, 0, 0]);
  [[0.01, 0.01], [0.03, -0.005]].forEach(([x, z]) => o.p(S(0.008, 8, 6), '#e0a800', 'satin', [x, 0.041, z])); return o; });
def('pudding', 'プリン', () => { const o = new Obj(); o.p(LATHE([[0, 0], [0.04, 0], [0.033, 0.045], [0, 0.045]]), '#f6d365', 'gloss', [0, 0, 0]); o.p(C(0.033, 0.033, 0.01, 18), '#6b3a1a', 'gloss', [0, 0.05, 0]); return o; });
[['pink', '#ff9fc4'], ['green', '#9fe3a5'], ['yellow', '#ffe08a']].forEach(([c, hex]) => def(`macaron_${c}`, `${COL[c][0]} マカロン`, () => { const o = new Obj();
  [0.008, 0.032].forEach(y => o.p(C(0.025, 0.025, 0.014, 18), hex, 'matte', [0, y, 0])); o.p(C(0.022, 0.022, 0.01, 18), '#fff8ee', 'satin', [0, 0.02, 0]); return o; }));
def('popsicle', 'アイスキャンディー', () => { const o = new Obj(); o.p(RB(0.04, 0.09, 0.02), '#4cc9f0', 'gloss', [0, 0.085, 0]); o.p(B(0.01, 0.05, 0.004), '#e9c46a', 'wood', [0, 0.025, 0]); return o; });
def('mushroom', 'きのこ', () => { const o = new Obj(); o.p(C(0.025, 0.03, 0.07, 14), '#f3e6c8', 'matte', [0, 0.035, 0]); o.p(HS(0.065, 20), '#d62828', 'gloss', [0, 0.065, 0]);
  for (let i = 0; i < 7; i++) { const a = i * 2.4, r = i ? 0.04 : 0; o.p(S(0.011, 8, 6), '#fff', 'satin', [Math.cos(a) * r, 0.063 + Math.sqrt(0.065 ** 2 - r * r), Math.sin(a) * r]); } return o; });

// =====================================================================
// ゲームの こま・あそび道具
// =====================================================================
const PIPS = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };
function dice(o, body, pip, s = 0.12) {
  const h = s / 2; o.p(RB(s, s, s, s * 0.15), body, 'gloss', [0, h, 0]);
  const faces = [[1, [0, 1, 0], [1, 0, 0], [0, 0, 1]], [6, [0, -1, 0], [1, 0, 0], [0, 0, 1]], [2, [0, 0, 1], [1, 0, 0], [0, 1, 0]], [5, [0, 0, -1], [1, 0, 0], [0, 1, 0]], [3, [1, 0, 0], [0, 0, 1], [0, 1, 0]], [4, [-1, 0, 0], [0, 0, 1], [0, 1, 0]]];
  for (const [n, nr, u, v] of faces) for (const [a, b] of PIPS[n]) o.p(S(s * 0.09, 8, 6), n === 1 && body !== '#d62828' ? '#d62828' : pip, 'gloss',
    [nr[0] * h + u[0] * a * s * 0.25 + v[0] * b * s * 0.25, h + nr[1] * h + u[1] * a * s * 0.25 + v[1] * b * s * 0.25, nr[2] * h + u[2] * a * s * 0.25 + v[2] * b * s * 0.25], null, [1, 1, 1]);
}
[['white', '#f6f3ea', '#151515'], ['red', '#d62828', '#fff'], ['blue', '#1f5fd1', '#fff'], ['green', '#2d9e4f', '#fff'], ['black', '#1b1b1b', '#fff']].forEach(([c, b, p], i) =>
  def(`dice_${c}`, `${COL[c][0]} さいころ`, () => { const o = new Obj(); dice(o, b, p, 0.1 + i * 0.012); return o; }));
const chessBase = (o, col, h) => { o.p(LATHE([[0, 0], [0.045, 0], [0.045, 0.012], [0.032, 0.022], [0.022, h], [0, h]]), col, 'gloss'); };
[['white', '#f4ecd8'], ['black', '#222']].forEach(([c, col]) => {
  def(`chess_king_${c}`, `${COL[c][0]} キング`, () => { const o = new Obj(); chessBase(o, col, 0.16); o.p(S(0.03), col, 'gloss', [0, 0.17, 0]); o.p(B(0.01, 0.045, 0.01), col, 'gloss', [0, 0.215, 0]); o.p(B(0.03, 0.01, 0.01), col, 'gloss', [0, 0.22, 0]); return o; });
  def(`chess_rook_${c}`, `${COL[c][0]} ルーク`, () => { const o = new Obj(); chessBase(o, col, 0.11); o.p(C(0.032, 0.03, 0.035, 16), col, 'gloss', [0, 0.125, 0]);
    for (let i = 0; i < 4; i++) { const a = i / 4 * PI * 2; o.p(B(0.016, 0.016, 0.016), col, 'gloss', [Math.cos(a) * 0.024, 0.15, Math.sin(a) * 0.024]); } return o; });
  def(`chess_pawn_${c}`, `${COL[c][0]} ポーン`, () => { const o = new Obj(); chessBase(o, col, 0.08); o.p(S(0.026), col, 'gloss', [0, 0.1, 0]); return o; });
});
def('chess_queen_white', 'しろい クイーン', () => { const o = new Obj(); chessBase(o, '#f4ecd8', 0.15); o.p(T(0.025, 0.008), '#f4ecd8', 'gloss', [0, 0.16, 0], [PI / 2, 0, 0]); o.p(S(0.014), '#f4ecd8', 'gloss', [0, 0.18, 0]); return o; });
def('chess_bishop_black', 'くろい ビショップ', () => { const o = new Obj(); chessBase(o, '#222', 0.12); o.p(S(0.025), '#222', 'gloss', [0, 0.14, 0], null, [1, 1.5, 1]); o.p(S(0.008), '#222', 'gloss', [0, 0.183, 0]); return o; });
def('chess_knight_white', 'しろい ナイト', () => { const o = new Obj(); chessBase(o, '#f4ecd8', 0.07); o.p(RB(0.035, 0.08, 0.06), '#f4ecd8', 'gloss', [0, 0.11, 0], [0.3, 0, 0]); o.p(RB(0.03, 0.03, 0.05), '#f4ecd8', 'gloss', [0, 0.14, 0.03]); return o; });
[['A', '♥'], ['K', '♠'], ['7', '♦'], ['3', '♣'], ['Q', '♥'], ['A', '♠'], ['10', '♦'], ['J', '♣']].forEach(([r, s]) => {
  const sn = { '♥': 'ハート', '♠': 'スペード', '♦': 'ダイヤ', '♣': 'クラブ' }[s];
  def(`card_${sn}${r}`, `${sn}の ${r}`, () => { const o = new Obj(); o.p(ATL(B(0.065, 0.003, 0.09), `card${s}${r}`, draw.card(r, s)), '#fff', 'atlasMatte', [0, 0.0015, 0]); return o; });
});
def('joker', 'ジョーカー', () => { const o = new Obj(); o.p(ATL(B(0.065, 0.003, 0.09), 'joker', draw.card('★', '🃏')), '#fff', 'atlasMatte', [0, 0.0015, 0]); return o; });
[[3, 5], [6, 2], [1, 4]].forEach(([a, b]) => def(`domino_${a}${b}`, `${a}と${b}の ドミノ`, () => { const o = new Obj(); o.p(ATL(RB(0.1, 0.05, 0.016, 0.004), `dom${a}${b}`, draw.domino(a, b)), '#fff', 'atlas', [0, 0.025, 0]); return o; }));
[['red', '#d62828'], ['blue', '#1f5fd1']].forEach(([c, hex]) => def(`top_${c}`, `${COL[c][0]} こま`, () => { const o = new Obj();
  o.p(LATHE([[0, 0], [0.01, 0.005], [0.05, 0.035], [0.05, 0.045], [0.015, 0.055], [0, 0.055]]), hex, 'gloss'); o.p(C(0.005, 0.005, 0.04, 8), '#8b5a2b', 'wood', [0, 0.07, 0]); return o; }));
def('top_stripe', 'しましまの こま', () => { const o = new Obj(); o.p(ATL(LATHE([[0, 0], [0.01, 0.005], [0.05, 0.035], [0.05, 0.045], [0.015, 0.055], [0, 0.055]]), 'stripes_top', draw.stripes(['#ffd166', '#ef476f', '#06d6a0'], true)), '#fff', 'atlas'); o.p(C(0.005, 0.005, 0.04, 8), '#8b5a2b', 'wood', [0, 0.07, 0]); return o; });
[['red', '#e63946'], ['green', '#2d9e4f']].forEach(([c, hex]) => def(`yoyo_${c}`, `${COL[c][0]} ヨーヨー`, () => { const o = new Obj(); [-0.012, 0.012].forEach(z => o.p(C(0.035, 0.035, 0.016, 22).rotateX(PI / 2), hex, 'gloss', [0, 0.035, z]));
  o.p(C(0.004, 0.004, 0.1, 4), '#fff8e8', 'fabric', [0, 0.085, 0]); return o; }));
def('kendama', 'けんだま', () => { const o = new Obj(); o.p(C(0.012, 0.012, 0.12, 10), '#c98a2b', 'wood', [0, 0.06, 0]); o.p(C(0.025, 0.02, 0.03, 14).rotateZ(PI / 2), '#c98a2b', 'wood', [0, 0.11, 0]); o.p(S(0.03), '#d62828', 'gloss', [0, 0.16, 0]); return o; });
[['blue', '#4cc9f0'], ['green', '#80ed99'], ['red', '#ff4d6d']].forEach(([c, hex]) => def(`bigmarble_${c}`, `${COL[c][0]} おおきな ビーだま`, () => { const o = new Obj();
  o.p(S(0.04, 20, 14), hex, 'glass', [0, 0.04, 0]); o.p(S(0.022, 12, 8), hex, 'gloss', [0, 0.04, 0], [0.5, 0.5, 0], [1.5, 0.3, 0.6]); return o; }));
def('pinwheel_red', 'あかい かざぐるま', () => { const o = new Obj(); o.p(C(0.004, 0.004, 0.2, 6), '#8b5a2b', 'wood', [0, 0.1, 0]); for (let i = 0; i < 4; i++) o.p(EXT(tri(0.05, 0.05), 0.002, 0), i % 2 ? '#d62828' : '#ffd166', 'satin', [0, 0.2, 0.004], [0, 0, i * PI / 2]); return o; });
def('pinwheel_blue', 'あおい かざぐるま', () => { const o = new Obj(); o.p(C(0.004, 0.004, 0.2, 6), '#8b5a2b', 'wood', [0, 0.1, 0]); for (let i = 0; i < 4; i++) o.p(EXT(tri(0.05, 0.05), 0.002, 0), i % 2 ? '#1f5fd1' : '#7cc6f2', 'satin', [0, 0.2, 0.004], [0, 0, i * PI / 2 + 0.3]); return o; });
def('ringtower', 'わの タワー', () => { const o = new Obj(); o.p(C(0.008, 0.008, 0.16, 8), '#e9c46a', 'wood', [0, 0.08, 0]); ['#e63946', '#ff8c1a', '#ffd166', '#2d9e4f', '#1f5fd1'].forEach((c, i) => o.p(T(0.045 - i * 0.006, 0.014, PI * 2, 10, 20), c, 'gloss', [0, 0.014 + i * 0.026, 0], [PI / 2, 0, 0])); return o; });

// =====================================================================
// もじの つみき（アトラスに文字）
// =====================================================================
const LB = [['あ', '#ef476f'], ['い', '#ffd166'], ['う', '#06d6a0'], ['え', '#118ab2'], ['お', '#7b2cbf'], ['か', '#ff8c1a'], ['き', '#2d9e4f'], ['く', '#d62828'],
  ['け', '#4cc9f0'], ['こ', '#ff6fa8'], ['A', '#1f5fd1'], ['B', '#e63946'], ['C', '#ffb703'], ['1', '#2a9d8f'], ['2', '#8338ec'], ['3', '#fb5607']];
LB.forEach(([ch, bg], i) => def(`block_${ch}`, `「${ch}」の つみき`, () => { const o = new Obj(); const s = 0.09 + (i % 3) * 0.01;
  o.p(ATL(RB(s, s, s, 0.008), `lb${ch}`, draw.letter(ch, bg, '#fff')), '#fff', 'atlas', [0, s / 2, 0]); return o; }));

// =====================================================================
// ぶんぼうぐ
// =====================================================================
[['yellow', '#ffcc00'], ['red', '#d62828'], ['blue', '#1f5fd1'], ['green', '#2d9e4f']].forEach(([c, hex], i) => def(`pencil_${c}`, `${COL[c][0]} えんぴつ`, () => { const o = new Obj(); const L = 0.17 + i * 0.012;
  o.p(C(0.012, 0.012, L, 6).rotateZ(PI / 2), hex, 'satin', [0, 0.012, 0]); o.p(K(0.012, 0.035, 6).rotateZ(-PI / 2), '#e8c79a', 'wood', [L / 2 + 0.017, 0.012, 0]);
  o.p(C(0.012, 0.012, 0.02, 12).rotateZ(PI / 2), '#ff8fab', 'matte', [-L / 2 - 0.01, 0.012, 0]); return o; }));
def('eraser_white', 'しろい けしゴム', () => { const o = new Obj(); o.p(RB(0.06, 0.02, 0.03, 0.004), '#f4f1ea', 'matte', [0, 0.01, 0]); o.p(B(0.035, 0.022, 0.032), '#1f5fd1', 'satin', [0.012, 0.011, 0]); return o; });
def('eraser_pink', 'ピンクの けしゴム', () => { const o = new Obj(); o.p(RB(0.05, 0.025, 0.035, 0.006), '#ff9fc4', 'matte', [0, 0.0125, 0]); return o; });
def('ruler', 'ものさし', () => { const o = new Obj(); o.p(B(0.2, 0.004, 0.03), '#ffe08a', 'glass', [0, 0.002, 0]); for (let i = 0; i < 10; i++) o.p(B(0.002, 0.0045, i % 5 ? 0.008 : 0.014), '#333', 'matte', [-0.09 + i * 0.02, 0.002, -0.01]); return o; });
def('scissors', 'はさみ', () => { const o = new Obj(); [-1, 1].forEach(d => { o.p(T(0.018, 0.005), '#e63946', 'gloss', [-0.04, 0.005, d * 0.022], [PI / 2, 0, 0]); o.p(B(0.09, 0.004, 0.01), '#c9ccd1', 'metal', [0.03, 0.006, d * 0.004], [0, d * 0.15, 0]); }); return o; });
def('clip', 'クリップ', () => { const o = new Obj(); o.p(T(0.012, 0.0025, PI, 6, 10), '#c9ccd1', 'metal', [0.015, 0.003, 0], [PI / 2, 0, -PI / 2]); o.p(B(0.04, 0.005, 0.005), '#c9ccd1', 'metal', [0, 0.003, 0.012]); o.p(B(0.035, 0.005, 0.005), '#c9ccd1', 'metal', [0.002, 0.003, -0.012]); return o; });
[['red', '#d62828'], ['blue', '#1f5fd1']].forEach(([c, hex]) => def(`paint_${c}`, `${COL[c][0]} えのぐ`, () => { const o = new Obj(); o.p(CAP(0.014, 0.06), '#e9ecef', 'metal', [0, 0.014, 0], [0, 0, PI / 2]); o.p(C(0.015, 0.015, 0.03, 12).rotateZ(PI / 2), hex, 'satin', [0.005, 0.014, 0]);
  o.p(C(0.008, 0.008, 0.015, 10).rotateZ(PI / 2), '#222', 'satin', [0.05, 0.014, 0]); return o; }));
def('brush', 'ふで', () => { const o = new Obj(); o.p(C(0.006, 0.006, 0.16, 8).rotateZ(PI / 2), '#8b5a2b', 'wood', [0, 0.006, 0]); o.p(K(0.008, 0.03, 8).rotateZ(-PI / 2), '#1b1b1b', 'fabric', [0.095, 0.006, 0]); return o; });
def('glue', 'のり', () => { const o = new Obj(); o.p(C(0.018, 0.018, 0.07, 14), '#ffd166', 'satin', [0, 0.035, 0]); o.p(C(0.019, 0.019, 0.025, 14), '#1f5fd1', 'gloss', [0, 0.08, 0]); return o; });
def('tape', 'セロハンテープ', () => { const o = new Obj(); o.p(T(0.03, 0.012, PI * 2, 10, 24), '#f7e7b4', 'glass', [0, 0.012, 0], [PI / 2, 0, 0]); return o; });
def('notebook', 'ノート', () => { const o = new Obj(); o.p(ATL(B(0.09, 0.012, 0.12), 'note', draw.book('#7cc6f2', 'ノート', '#fff')), '#fff', 'atlasMatte', [0, 0.006, 0]); return o; });
def('crayonbox', 'クレヨンの はこ', () => { const o = new Obj(); o.p(B(0.1, 0.02, 0.06), '#ffd166', 'satin', [0, 0.01, 0]); ['#e63946', '#ff8c1a', '#2d9e4f', '#1f5fd1', '#7b2cbf', '#8b5a2b'].forEach((c, i) => o.p(C(0.006, 0.006, 0.07, 6).rotateZ(PI / 2), c, 'matte', [0, 0.026, -0.025 + i * 0.01])); return o; });

// =====================================================================
// ボタン・さいほう
// =====================================================================
const button = (o, col, holes = 4, r = 0.045) => { o.p(C(r, r, 0.014, 24), col, 'gloss', [0, 0.007, 0]); const ps = holes === 4 ? [[-1, -1], [1, -1], [-1, 1], [1, 1]] : [[-1, 0], [1, 0]];
  ps.forEach(([a, b]) => o.p(C(r * 0.14, r * 0.14, 0.016, 8), '#3a2410', 'matte', [a * r * 0.28, 0.008, b * r * 0.28])); };
def('button_pink', 'ピンクの ボタン', () => { const o = new Obj(); button(o, '#ff5d8f'); return o; });
def('button_blue', 'あおい ボタン', () => { const o = new Obj(); button(o, '#3a86ff', 2, 0.04); return o; });
def('button_wood', 'きの ボタン', () => { const o = new Obj(); button(o, '#c98a2b', 4, 0.05); return o; });
def('button_gold', 'きんの ボタン', () => { const o = new Obj(); o.p(S(0.03, 16, 10), '#e0b13a', 'metal', [0, 0.012, 0], null, [1, 0.4, 1]); o.p(T(0.006, 0.002), '#e0b13a', 'metal', [0, 0.0, 0]); return o; });
def('button_flower', 'はなの ボタン', () => { const o = new Obj(); for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2; o.p(C(0.018, 0.018, 0.012, 14), '#ffafcc', 'gloss', [Math.cos(a) * 0.025, 0.006, Math.sin(a) * 0.025]); } o.p(C(0.018, 0.018, 0.014, 14), '#ffd166', 'gloss', [0, 0.007, 0]); return o; });
def('button_star', 'ほしの ボタン', () => { const o = new Obj(); o.p(EXT(starShape(0.045, 0.02), 0.012, 0.003), '#ffd166', 'gloss', [0, 0.008, 0], [PI / 2, 0, 0]); return o; });
[['red', '#d62828'], ['yellow', '#ffcf1f'], ['green', '#2d9e4f']].forEach(([c, hex]) => def(`spool_${c}`, `${COL[c][0]} いとまき`, () => { const o = new Obj();
  [0.004, 0.066].forEach(y => o.p(C(0.03, 0.03, 0.008, 18), '#e9c46a', 'wood', [0, y, 0])); o.p(C(0.022, 0.022, 0.056, 18), hex, 'fabric', [0, 0.035, 0]); return o; }));
def('pincushion', 'はりやま', () => { const o = new Obj(); o.p(S(0.045, 18, 12), '#e63946', 'fabric', [0, 0.035, 0], null, [1, 0.75, 1]); o.p(K(0.02, 0.012, 6), '#2d9e4f', 'satin', [0, 0.07, 0]);
  for (let i = 0; i < 6; i++) { const a = i; o.p(C(0.0015, 0.0015, 0.05, 4), '#c9ccd1', 'metal', [Math.cos(a) * 0.02, 0.08, Math.sin(a) * 0.02], [Math.sin(a) * 0.5, 0, Math.cos(a) * 0.5]); o.p(S(0.006, 6, 4), ['#ffd166', '#1f5fd1', '#06d6a0'][i % 3], 'gloss', [Math.cos(a) * 0.032, 0.105, Math.sin(a) * 0.032]); } return o; });
def('thimble', 'ゆびぬき', () => { const o = new Obj(); o.p(LATHE([[0, 0.03], [0.012, 0.03], [0.016, 0.02], [0.017, 0]]), '#c9ccd1', 'metal', [0, 0, 0], [PI, 0, 0]); o.children[0].position.y = 0.03; return o; });

// =====================================================================
// せいかつの どうぐ
// =====================================================================
const keyGeo = (s = 1) => { const bow = T(0.035 * s, 0.01 * s, PI * 2, 8, 18); const sh = B(0.14 * s, 0.014 * s, 0.014 * s); sh.translate(0.1 * s, 0, 0);
  const t1 = B(0.022 * s, 0.035 * s, 0.012 * s); t1.translate(0.15 * s, -0.022 * s, 0); const t2 = t1.clone(); t2.translate(-0.035 * s, 0, 0); return mergeGeometries([bow, sh, t1, t2]).rotateX(PI / 2); };
def('key_gold', 'きんの かぎ', () => { const o = new Obj(); o.p(keyGeo(1.2), '#d4a537', 'metal', [-0.05, 0.012, 0]); return o; });
def('key_silver', 'ぎんの かぎ', () => { const o = new Obj(); o.p(keyGeo(0.9), '#c9ccd1', 'metal', [-0.04, 0.01, 0]); return o; });
def('key_red', 'あかい てもちの かぎ', () => { const o = new Obj(); o.p(B(0.1, 0.01, 0.012), '#c9ccd1', 'metal', [0.05, 0.01, 0]); o.p(RB(0.05, 0.016, 0.04, 0.006), '#d62828', 'gloss', [-0.02, 0.01, 0]); return o; });
def('spoon', 'スプーン', () => { const o = new Obj(); o.p(S(0.022, 14, 8), '#c9ccd1', 'metal', [0.06, 0.008, 0], null, [1.4, 0.3, 1]); o.p(B(0.11, 0.005, 0.01), '#c9ccd1', 'metal', [-0.02, 0.008, 0]); return o; });
def('fork', 'フォーク', () => { const o = new Obj(); o.p(B(0.11, 0.005, 0.01), '#c9ccd1', 'metal', [-0.02, 0.006, 0]); o.p(B(0.02, 0.005, 0.028), '#c9ccd1', 'metal', [0.045, 0.006, 0]);
  [-0.01, 0, 0.01].forEach(z => o.p(B(0.03, 0.004, 0.004), '#c9ccd1', 'metal', [0.07, 0.006, z])); return o; });
def('teacup', 'ティーカップ', () => { const o = new Obj(); o.p(LATHE([[0, 0], [0.025, 0], [0.04, 0.05], [0.036, 0.05], [0.022, 0.004], [0, 0.004]]), '#f4f1ea', 'gloss'); o.p(T(0.015, 0.004, PI * 1.2), '#f4f1ea', 'gloss', [0.04, 0.03, 0], [0, 0, -0.9]);
  o.p(C(0.05, 0.05, 0.006, 22), '#9fd3e6', 'gloss', [0, 0.003, 0]); return o; });
def('teapot', 'ティーポット', () => { const o = new Obj(); o.p(S(0.055, 18, 12), '#7cc6f2', 'gloss', [0, 0.05, 0], null, [1, 0.85, 1]); o.p(C(0.02, 0.025, 0.015, 14), '#7cc6f2', 'gloss', [0, 0.1, 0]); o.p(S(0.008), '#fff', 'gloss', [0, 0.112, 0]);
  o.p(C(0.007, 0.012, 0.06, 8), '#7cc6f2', 'gloss', [0.065, 0.065, 0], [0, 0, -0.9]); o.p(T(0.022, 0.006, PI * 1.2), '#7cc6f2', 'gloss', [-0.055, 0.06, 0], [0, 0, 1.6]); return o; });
def('cup_glass', 'ガラスの コップ', () => { const o = new Obj(); o.p(C(0.03, 0.025, 0.08, 18), '#dff6ff', 'glass', [0, 0.04, 0]); return o; });
def('toothbrush', 'はブラシ', () => { const o = new Obj(); o.p(B(0.15, 0.01, 0.014), '#06d6a0', 'gloss', [0, 0.007, 0]); o.p(B(0.03, 0.016, 0.014), '#fff', 'fabric', [0.06, 0.018, 0]); return o; });
def('comb', 'くし', () => { const o = new Obj(); o.p(B(0.11, 0.012, 0.012), '#ff8fab', 'gloss', [0, 0.04, 0]); for (let i = 0; i < 12; i++) o.p(B(0.004, 0.03, 0.008), '#ff8fab', 'gloss', [-0.05 + i * 0.009, 0.02, 0]); return o; });
def('glasses', 'めがね', () => { const o = new Obj(); [-0.05, 0.05].forEach(x => { o.p(T(0.04, 0.006, PI * 2, 8, 24), '#1b1b1b', 'gloss', [x, 0.045, 0]); o.p(C(0.038, 0.038, 0.002, 20).rotateX(PI / 2), '#cfe8ff', 'glass', [x, 0.045, 0]); });
  o.p(B(0.025, 0.006, 0.006), '#1b1b1b', 'gloss', [0, 0.055, 0]); [-0.09, 0.09].forEach(x => o.p(B(0.006, 0.006, 0.12), '#1b1b1b', 'gloss', [x, 0.05, -0.06])); return o; });
def('sunglasses', 'サングラス', () => { const o = new Obj(); [-0.05, 0.05].forEach(x => o.p(RB(0.075, 0.05, 0.008, 0.012), '#222', 'gloss', [x, 0.04, 0])); o.p(B(0.03, 0.008, 0.006), '#e63946', 'gloss', [0, 0.05, 0]); [-0.09, 0.09].forEach(x => o.p(B(0.006, 0.008, 0.11), '#e63946', 'gloss', [x, 0.05, -0.055])); return o; });
[['red', '#d62828'], ['blue', '#1f5fd1']].forEach(([c, hex]) => def(`clock_${c}`, `${COL[c][0]} めざましどけい`, () => { const o = new Obj();
  o.p(C(0.07, 0.07, 0.04, 26).rotateX(PI / 2), hex, 'gloss', [0, 0.08, 0]); o.p(ATL(new THREE.CircleGeometry(0.06, 28), `clock${c}`, draw.clock(hex)), '#fff', 'atlas', [0, 0.08, 0.021]);
  [-0.045, 0.045].forEach(x => o.p(HS(0.025), '#c9ccd1', 'metal', [x, 0.14, 0])); [-0.04, 0.04].forEach(x => o.p(C(0.006, 0.006, 0.03, 6), hex, 'gloss', [x, 0.015, 0])); return o; }));
def('handmirror', 'てかがみ', () => { const o = new Obj(); o.p(C(0.045, 0.045, 0.012, 24).rotateX(PI / 2), '#ff8fab', 'gloss', [0, 0.1, 0]); o.p(C(0.038, 0.038, 0.013, 24).rotateX(PI / 2), '#e8f4ff', 'metal', [0, 0.1, 0.001]); o.p(C(0.008, 0.008, 0.08, 8), '#ff8fab', 'gloss', [0, 0.04, 0]); return o; });
def('candle', 'ろうそく', () => { const o = new Obj(); o.p(C(0.016, 0.018, 0.1, 14), '#f7e7c4', 'satin', [0, 0.05, 0]); o.p(C(0.002, 0.002, 0.01, 4), '#222', 'matte', [0, 0.105, 0]); o.p(C(0.03, 0.035, 0.008, 18), '#e0b13a', 'metal', [0, 0.004, 0]); return o; });
def('bulb', 'でんきゅう', () => { const o = new Obj(); o.p(S(0.035, 18, 12), '#fffbe0', 'glass', [0, 0.06, 0]); o.p(C(0.016, 0.016, 0.03, 12), '#c9ccd1', 'metal', [0, 0.02, 0]); return o; });
def('matchbox', 'マッチばこ', () => { const o = new Obj(); o.p(ATL(B(0.06, 0.02, 0.04), 'match', draw.stripes(['#d62828', '#ffd166'])), '#fff', 'atlas', [0, 0.01, 0]); return o; });
def('soap', 'せっけん', () => { const o = new Obj(); o.p(RB(0.07, 0.025, 0.045, 0.012), '#b8f2e6', 'satin', [0, 0.0125, 0]); return o; });
def('envelope', 'てがみ', () => { const o = new Obj(); o.p(B(0.11, 0.003, 0.075), '#fbf3e0', 'matte', [0, 0.0015, 0]); o.p(C(0.01, 0.01, 0.004, 12), '#c1121f', 'gloss', [0, 0.004, 0]); return o; });
def('umbrella', 'かさ', () => { const o = new Obj(); o.p(C(0.004, 0.004, 0.2, 6), '#555', 'metal', [0, 0.1, 0]); o.p(K(0.09, 0.05, 8), '#7b2cbf', 'satin', [0, 0.22, 0]); o.p(T(0.012, 0.004, PI), '#555', 'metal', [0.012, 0.0, 0], [0, 0, PI]); return o; });

// =====================================================================
// かたち・かざり
// =====================================================================
[['gold', '#e0b13a', 'metal'], ['silver', '#c9ccd1', 'metal'], ['red', '#e63946', 'gloss'], ['blue', '#3a86ff', 'gloss']].forEach(([c, hex, k], i) => def(`star_${c}`, `${COL[c][0]} ほし`, () => { const o = new Obj();
  o.p(EXT(starShape(0.07 + i * 0.008, 0.032), 0.022, 0.006), hex, k, [0, 0.08, 0]); return o; }));
[['pink', '#ff4d8d'], ['red', '#c1121f']].forEach(([c, hex], i) => def(`heart_${c}`, `${COL[c][0]} ハート`, () => { const o = new Obj(); o.p(EXT(heartShape(1 + i * 0.25), 0.03, 0.01), hex, 'gloss', [0, 0.07, 0]); return o; }));
def('moon', 'おつきさま', () => { const o = new Obj(); const s = new THREE.Shape(); s.absarc(0, 0, 0.07, 0, PI * 2); const h = new THREE.Path(); h.absarc(0.03, 0.015, 0.06, 0, PI * 2); s.holes.push(h); o.p(EXT(s, 0.02, 0.004), '#ffe27a', 'gloss', [0, 0.07, 0]); return o; });
def('cloud', 'くも', () => { const o = new Obj(); [[0, 0.06, 0.045], [0.045, 0.045, 0.035], [-0.045, 0.045, 0.035], [0.02, 0.08, 0.035]].forEach(([x, y, r]) => o.p(S(r, 14, 10), '#f7fbff', 'satin', [x, y, 0], null, [1, 1, 0.6])); return o; });
[['blue', '#3a86ff'], ['red', '#e5383b'], ['green', '#2dc653']].forEach(([c, hex]) => def(`gem_${c}`, `${COL[c][0]} ほうせき`, () => { const o = new Obj(); o.p(new THREE.OctahedronGeometry(0.035), hex, 'glass', [0, 0.04, 0], null, [1, 1.3, 1]); o.p(new THREE.OctahedronGeometry(0.02), hex, 'gloss', [0, 0.04, 0]); return o; }));
def('ribbon', 'リボン', () => { const o = new Obj(); [-1, 1].forEach(d => o.p(K(0.03, 0.06, 4), '#ff4d6d', 'satin', [d * 0.03, 0.03, 0], [0, 0, d * PI / 2], [1, 1, 0.4])); o.p(S(0.014, 10, 8), '#ff4d6d', 'satin', [0, 0.03, 0]); return o; });
def('bell_gold', 'きんの すず', () => { const o = new Obj(); o.p(S(0.05, 18, 12), '#e0b13a', 'metal', [0, 0.05, 0]); o.p(B(0.105, 0.006, 0.012), '#2a1d05', 'matte', [0, 0.035, 0]); o.p(T(0.014, 0.004), '#e0b13a', 'metal', [0, 0.105, 0]); return o; });
def('handbell', 'ハンドベル', () => { const o = new Obj(); o.p(LATHE([[0, 0.07], [0.02, 0.065], [0.03, 0.03], [0.045, 0]]), '#e0b13a', 'metal', [0, 0, 0], null, null); o.p(C(0.008, 0.01, 0.07, 10), '#8b5a2b', 'wood', [0, 0.1, 0]); return o; });
def('snowman', 'ゆきだるま', () => { const o = new Obj(); o.p(S(0.045), '#fbfdff', 'satin', [0, 0.045, 0]); o.p(S(0.032), '#fbfdff', 'satin', [0, 0.11, 0]); o.p(C(0.02, 0.025, 0.035, 12), '#222', 'gloss', [0, 0.155, 0]);
  o.p(K(0.006, 0.025, 6), '#ff8c1a', 'satin', [0, 0.11, 0.04], [PI / 2, 0, 0]); o.eyes(0.12, 0.028, 0.012, 0.004); return o; });
def('xmastree', 'ちいさな もみのき', () => { const o = new Obj(); [0, 1, 2].forEach(i => o.p(K(0.06 - i * 0.015, 0.07, 10), '#2d6a4f', 'satin', [0, 0.06 + i * 0.045, 0])); o.p(C(0.012, 0.012, 0.03), '#8b5a2b', 'wood', [0, 0.015, 0]);
  o.p(EXT(starShape(0.02, 0.009), 0.006, 0), '#ffd700', 'metal', [0, 0.2, 0]); return o; });
def('crown', 'おうかん', () => { const o = new Obj(); o.p(C(0.065, 0.065, 0.05, 28), '#e8b923', 'metal', [0, 0.025, 0]);
  for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2; o.p(K(0.014, 0.05, 8), '#e8b923', 'metal', [Math.cos(a) * 0.058, 0.075, Math.sin(a) * 0.058]); o.p(S(0.009, 8, 6), i % 2 ? '#d00000' : '#1e6bd6', 'gloss', [Math.cos(a) * 0.066, 0.03, Math.sin(a) * 0.066]); } return o; });
def('wand', 'まほうの つえ', () => { const o = new Obj(); o.p(C(0.005, 0.005, 0.2, 8), '#ff8fab', 'gloss', [0, 0.1, 0]); o.p(EXT(starShape(0.035, 0.015), 0.01, 0.003), '#ffd700', 'metal', [0, 0.22, 0]); return o; });

// =====================================================================
// にんぎょう
// =====================================================================
function robot(o, body, eye) { o.p(RB(0.08, 0.09, 0.06), body, 'metal', [0, 0.09, 0]); o.p(RB(0.065, 0.05, 0.05), body, 'metal', [0, 0.165, 0]);
  [-0.02, 0.02].forEach(x => { o.p(B(0.025, 0.045, 0.025), body, 'metal', [x, 0.022, 0]); o.p(S(0.008, 8, 6), eye, 'gloss', [x, 0.17, 0.026]); });
  [-0.05, 0.05].forEach(x => o.p(B(0.018, 0.06, 0.018), body, 'metal', [x, 0.09, 0])); o.p(C(0.003, 0.003, 0.03), '#555', 'metal', [0, 0.2, 0]); o.p(S(0.008, 8, 6), '#e00', 'gloss', [0, 0.218, 0]); }
def('robot_red', 'あかい ロボット', () => { const o = new Obj(); robot(o, '#c1121f', '#ffe27a'); return o; });
def('robot_blue', 'あおい ロボット', () => { const o = new Obj(); robot(o, '#1f5fd1', '#9be7ff'); return o; });
def('robot_silver', 'ぎんの ロボット', () => { const o = new Obj(); robot(o, '#b8bcc4', '#00e5ff'); return o; });
const matry = (o, col, s) => { o.p(LATHE([[0, 0], [0.04 * s, 0], [0.05 * s, 0.05 * s], [0.04 * s, 0.09 * s], [0.03 * s, 0.11 * s], [0.038 * s, 0.14 * s], [0.02 * s, 0.175 * s], [0, 0.18 * s]], 20), col, 'gloss');
  o.p(ATL(C(0.026 * s, 0.026 * s, 0.002, 18).rotateX(PI / 2), `mface${col}`, draw.face('#fbe3d0')), '#fff', 'atlas', [0, 0.14 * s, 0.033 * s]); };
[['red', '#c1121f', 1], ['blue', '#1f5fd1', 0.8], ['green', '#2d9e4f', 0.65]].forEach(([c, hex, s]) => def(`matry_${c}`, `${COL[c][0]} マトリョーシカ`, () => { const o = new Obj(); matry(o, hex, s); return o; }));
def('soldier', 'へいたいさん', () => { const o = new Obj(); o.p(C(0.025, 0.025, 0.08, 14), '#c1121f', 'gloss', [0, 0.08, 0]); o.p(C(0.025, 0.025, 0.04, 14), '#1b1b1b', 'gloss', [0, 0.02, 0]);
  o.p(S(0.022), '#fbe3d0', 'satin', [0, 0.14, 0]); o.p(C(0.02, 0.022, 0.06, 14), '#1b1b1b', 'fabric', [0, 0.18, 0]); o.eyes(0.143, 0.02, 0.008, 0.003); return o; });
def('clown', 'ピエロ', () => { const o = new Obj(); o.p(K(0.045, 0.1, 16), '#ffd166', 'satin', [0, 0.05, 0]); o.p(T(0.03, 0.01), '#ef476f', 'fabric', [0, 0.1, 0], [PI / 2, 0, 0]); o.p(S(0.028), '#fbe3d0', 'satin', [0, 0.13, 0]);
  o.p(S(0.008), '#e00', 'gloss', [0, 0.128, 0.028]); o.p(K(0.022, 0.05, 12), '#06d6a0', 'satin', [0, 0.18, 0]); o.eyes(0.14, 0.024, 0.01, 0.003); return o; });
def('kokeshi', 'こけし', () => { const o = new Obj(); o.p(C(0.025, 0.03, 0.1, 16), '#d62828', 'gloss', [0, 0.05, 0]); o.p(S(0.035), '#fbe3d0', 'gloss', [0, 0.13, 0]); o.p(S(0.036, 16, 10, 0, PI * 2, 0, 1.4), '#1b1b1b', 'gloss', [0, 0.135, -0.004]); o.eyes(0.13, 0.032, 0.012, 0.003); return o; });
def('dino', 'きょうりゅう', () => { const o = new Obj(); o.p(S(0.05), '#5cb85c', 'gloss', [0, 0.07, 0], null, [1.4, 1, 0.9]); o.p(C(0.015, 0.025, 0.07), '#5cb85c', 'gloss', [0.05, 0.12, 0], [0, 0, -0.5]); o.p(S(0.028), '#5cb85c', 'gloss', [0.08, 0.16, 0], null, [1.4, 1, 1]);
  o.p(K(0.025, 0.09, 10), '#5cb85c', 'gloss', [-0.1, 0.06, 0], [0, 0, 1.3]); [-0.03, 0.03].forEach(x => [-0.025, 0.025].forEach(z => o.p(C(0.012, 0.012, 0.04), '#5cb85c', 'gloss', [x, 0.02, z])));
  for (let i = 0; i < 4; i++) o.p(K(0.01, 0.02, 4), '#ffd166', 'gloss', [-0.04 + i * 0.025, 0.12, 0]); return o; });
def('princess', 'おひめさま', () => { const o = new Obj(); o.p(K(0.05, 0.1, 20), '#ffafcc', 'satin', [0, 0.05, 0]); o.p(S(0.025), '#fbe3d0', 'satin', [0, 0.125, 0]); o.p(S(0.027, 14, 10, 0, PI * 2, 0, 1.5), '#e9c46a', 'satin', [0, 0.13, -0.004]);
  o.p(C(0.015, 0.018, 0.015, 10), '#e0b13a', 'metal', [0, 0.155, 0]); o.eyes(0.127, 0.022, 0.009, 0.003); return o; });
def('teddy_mini', 'ちいさな くま', () => { const o = new Obj(); animal(o, { body: '#c08552', snout: '#f0d9b5', s: 0.7, extra: (o) => o.p(B(0.04, 0.008, 0.008), '#1f5fd1', 'fabric', [0, 0.07, 0.035]) }); return o; });

// =====================================================================
// その他のおもちゃ・どうぐ
// =====================================================================
def('trumpet', 'ラッパ', () => { const o = new Obj(); o.p(C(0.008, 0.008, 0.15, 10).rotateZ(PI / 2), '#e0b13a', 'metal', [0, 0.02, 0]); o.p(K(0.035, 0.06, 18).rotateZ(PI / 2), '#e0b13a', 'metal', [0.1, 0.02, 0]); return o; });
def('harmonica', 'ハーモニカ', () => { const o = new Obj(); o.p(RB(0.12, 0.02, 0.03, 0.005), '#c9ccd1', 'metal', [0, 0.01, 0]); o.p(B(0.11, 0.008, 0.031), '#c1121f', 'gloss', [0, 0.01, 0]); return o; });
def('drum_mini', 'ちいさな たいこ', () => { const o = new Obj(); o.p(C(0.045, 0.045, 0.05, 18), '#e63946', 'gloss', [0, 0.025, 0]); o.p(C(0.044, 0.044, 0.004, 18), '#fbf3e0', 'matte', [0, 0.052, 0]);
  [-1, 1].forEach(d => o.p(C(0.003, 0.003, 0.08, 6), '#c98a2b', 'wood', [d * 0.02, 0.07, 0.03], [0.5, 0, d * 0.4])); return o; });
[['red', '#ef233c'], ['blue', '#4361ee'], ['yellow', '#ffd60a']].forEach(([c, hex], i) => def(`balloon_${c}`, `${COL[c][0]} ふうせん`, () => { const o = new Obj();
  o.p(S(0.05, 18, 14), hex, 'gloss', [0, 0.16 + i * 0.01, 0], null, [1, 1.2, 1]); o.p(C(0.001, 0.001, 0.1, 3), '#eee', 'matte', [0, 0.05, 0]); o.p(K(0.008, 0.012, 8), hex, 'gloss', [0, 0.1 + i * 0.01, 0], [PI, 0, 0]); return o; }));
def('blockhouse', 'つみきの いえ', () => { const o = new Obj(); o.p(B(0.1, 0.08, 0.08), '#ffd166', 'wood', [0, 0.04, 0]); o.p(EXT(tri(0.12, 0.06), 0.08, 0), '#d62828', 'wood', [0, 0.11, 0]); o.children.at(-1).rotation.z = PI / 4;
  o.p(B(0.025, 0.04, 0.002), '#8b5a2b', 'wood', [0, 0.02, 0.041]); return o; });
def('strawhat', 'むぎわらぼうし', () => { const o = new Obj(); o.p(C(0.09, 0.09, 0.006, 26), '#e9c46a', 'matte', [0, 0.003, 0]); o.p(C(0.045, 0.05, 0.05, 20), '#e9c46a', 'matte', [0, 0.03, 0]); o.p(C(0.051, 0.051, 0.012, 20), '#d62828', 'fabric', [0, 0.012, 0]); return o; });
def('shoe_red', 'あかい くつ', () => { const o = new Obj(); o.p(RB(0.12, 0.04, 0.05, 0.015), '#c1121f', 'gloss', [0, 0.02, 0]); o.p(RB(0.06, 0.04, 0.05, 0.015), '#c1121f', 'gloss', [-0.03, 0.05, 0]); o.p(B(0.003, 0.025, 0.052), '#1b1b1b', 'satin', [0.01, 0.045, 0]); return o; });
def('flag', 'はた', () => { const o = new Obj(); o.p(C(0.003, 0.003, 0.2, 6), '#8b5a2b', 'wood', [0, 0.1, 0]); o.p(B(0.08, 0.05, 0.003), '#f4f1ea', 'fabric', [0.04, 0.17, 0]); o.p(C(0.014, 0.014, 0.004, 16).rotateX(PI / 2), '#d62828', 'satin', [0.04, 0.17, 0.002]); return o; });
def('hammer_toy', 'ピコピコハンマー', () => { const o = new Obj(); o.p(C(0.008, 0.008, 0.14, 8), '#ffd166', 'gloss', [0, 0.07, 0]); o.p(C(0.03, 0.03, 0.08, 14).rotateZ(PI / 2), '#e63946', 'gloss', [0, 0.16, 0]); return o; });
def('watering', 'じょうろ', () => { const o = new Obj(); o.p(C(0.04, 0.045, 0.08, 18), '#2d9e4f', 'gloss', [0, 0.04, 0]); o.p(C(0.006, 0.01, 0.1, 8), '#2d9e4f', 'gloss', [0.07, 0.07, 0], [0, 0, -0.9]); o.p(T(0.03, 0.006, PI), '#2d9e4f', 'gloss', [-0.02, 0.085, 0], [0, 0, 0]); return o; });
def('shovel', 'スコップ', () => { const o = new Obj(); o.p(C(0.006, 0.006, 0.12, 8).rotateZ(PI / 2), '#ff8c1a', 'gloss', [-0.03, 0.01, 0]); o.p(RB(0.06, 0.008, 0.05, 0.003), '#ff8c1a', 'gloss', [0.06, 0.01, 0]); return o; });
def('bucket', 'バケツ', () => { const o = new Obj(); o.p(LATHE([[0, 0], [0.04, 0], [0.05, 0.08], [0.046, 0.08], [0.036, 0.004], [0, 0.004]]), '#4cc9f0', 'gloss'); o.p(T(0.048, 0.003, PI), '#4cc9f0', 'gloss', [0, 0.08, 0]); return o; });
[['red', '#9d0208', 'むかしばなし'], ['green', '#2d6a4f', 'どうぶつ'], ['purple', '#5a189a', 'まほう']].forEach(([c, hex, t]) => def(`book_${c}`, `${COL[c][0]} ほん`, () => { const o = new Obj();
  o.p(ATL(B(0.1, 0.025, 0.13), `book${c}`, draw.book(hex, t)), '#fff', 'atlasMatte', [0, 0.0125, 0]); return o; }));
[['stripe', 'しましまの ボール', draw.stripes(['#e63946', '#fff', '#1d4ed8', '#ffd60a'])], ['dots', 'みずたまの ボール', draw.dots('#ff6fa8', '#fff')], ['beach', 'ビーチボール', draw.stripes(['#e63946', '#fff', '#ffd60a', '#1d4ed8', '#06d6a0', '#fff'], true)]].forEach(([k, n, f], i) =>
  def(`ball_${k}`, n, () => { const o = new Obj(); const r = 0.06 + i * 0.015; o.p(ATL(S(r, 24, 16), `ball${k}`, f), '#fff', 'atlas', [0, r, 0]); return o; }));
def('ball_tennis', 'テニスボール', () => { const o = new Obj(); o.p(S(0.033, 18, 12), '#d4e157', 'fabric', [0, 0.033, 0]); o.p(T(0.033, 0.003, PI * 2, 6, 24), '#fff', 'matte', [0, 0.033, 0], [0.6, 0, 0]); return o; });
def('checkerbox', 'いちまつもようの はこ', () => { const o = new Obj(); o.p(ATL(RB(0.09, 0.09, 0.09, 0.006), 'chk', draw.checker('#1b1b1b', '#f4f1ea')), '#fff', 'atlas', [0, 0.045, 0]); return o; });
def('giftbox', 'プレゼントの はこ', () => { const o = new Obj(); o.p(B(0.09, 0.07, 0.09), '#4cc9f0', 'satin', [0, 0.035, 0]); o.p(B(0.092, 0.072, 0.015), '#ef476f', 'satin', [0, 0.035, 0]); o.p(B(0.015, 0.072, 0.092), '#ef476f', 'satin', [0, 0.035, 0]);
  [-1, 1].forEach(d => o.p(T(0.015, 0.005), '#ef476f', 'satin', [d * 0.015, 0.08, 0], [0, 0, d * 0.6])); return o; });
def('telephone', 'おもちゃの でんわ', () => { const o = new Obj(); o.p(RB(0.1, 0.05, 0.08, 0.015), '#ef476f', 'gloss', [0, 0.025, 0]); o.p(CAP(0.012, 0.08), '#ef476f', 'gloss', [0, 0.065, 0], [0, 0, PI / 2]);
  o.p(C(0.025, 0.025, 0.005, 18), '#fff', 'gloss', [0, 0.052, 0.025], [0.5, 0, 0]); return o; });
def('camera_toy', 'おもちゃの カメラ', () => { const o = new Obj(); o.p(RB(0.1, 0.06, 0.04, 0.008), '#1b1b1b', 'satin', [0, 0.03, 0]); o.p(C(0.02, 0.02, 0.03, 18).rotateX(PI / 2), '#555', 'metal', [0, 0.03, 0.03]); o.p(C(0.015, 0.015, 0.002, 18).rotateX(PI / 2), '#7cc6f2', 'glass', [0, 0.03, 0.046]); return o; });
def('lantern', 'ランタン', () => { const o = new Obj(); o.p(C(0.03, 0.03, 0.06, 6), '#ffe8a3', 'glass', [0, 0.045, 0]); [0.01, 0.08].forEach(y => o.p(C(0.035, 0.035, 0.012, 6), '#2b2b2b', 'metal', [0, y, 0])); o.p(T(0.02, 0.003, PI), '#2b2b2b', 'metal', [0, 0.087, 0]); return o; });
def('compass', 'コンパス', () => { const o = new Obj(); o.p(C(0.04, 0.04, 0.012, 24), '#c9a458', 'metal', [0, 0.006, 0]); o.p(C(0.034, 0.034, 0.013, 24), '#f4f1ea', 'satin', [0, 0.007, 0]); o.p(K(0.005, 0.05, 4).rotateZ(PI / 2), '#d62828', 'gloss', [0, 0.014, 0]); return o; });
def('magnifier', 'むしめがね', () => { const o = new Obj(); o.p(T(0.035, 0.006), '#222', 'gloss', [0, 0.04, 0], [PI / 2, 0, 0]); o.p(C(0.034, 0.034, 0.004, 20), '#dff6ff', 'glass', [0, 0.04, 0]); o.p(C(0.007, 0.007, 0.08, 8).rotateZ(PI / 2), '#8b5a2b', 'wood', [0.075, 0.04, 0]); return o; });
def('kite', 'たこあげの たこ', () => { const o = new Obj(); const s = new THREE.Shape(); s.moveTo(0, 0.1); s.lineTo(0.06, 0); s.lineTo(0, -0.08); s.lineTo(-0.06, 0); s.closePath(); o.p(EXT(s, 0.003, 0), '#ef476f', 'fabric', [0, 0.1, 0]);
  for (let i = 0; i < 3; i++) o.p(RB(0.02, 0.012, 0.004, 0.002), ['#ffd166', '#06d6a0', '#118ab2'][i], 'fabric', [0, 0.0 - i * 0.025, 0]); return o; });
def('piggybank', 'ぶたの ちょきんばこ', () => { const o = new Obj(); o.p(S(0.06, 18, 12), '#ff8fab', 'gloss', [0, 0.06, 0], null, [1.3, 1, 1]); o.p(C(0.018, 0.018, 0.012, 14).rotateZ(PI / 2), '#ff6f91', 'gloss', [0.08, 0.06, 0]);
  [-0.03, 0.03].forEach(x => [-0.03, 0.03].forEach(z => o.p(C(0.012, 0.012, 0.03, 10), '#ff8fab', 'gloss', [x, 0.015, z]))); o.p(B(0.03, 0.004, 0.006), '#5a1a2a', 'matte', [0, 0.12, 0]); return o; });

// =====================================================================
// 屋根裏のお題（Gemini Argonと決めたもの）
// =====================================================================
def('fountain_pen', 'くろい まんねんひつ', () => { const o = new Obj(); o.p(C(0.008, 0.007, 0.13, 14).rotateZ(PI / 2), '#0d0d0f', 'gloss', [0, 0.008, 0]);
  o.p(K(0.007, 0.025, 14).rotateZ(-PI / 2), '#d4af37', 'metal', [0.077, 0.008, 0]); o.p(B(0.05, 0.003, 0.003), '#d4af37', 'metal', [-0.03, 0.016, 0]); return o; });
def('paintbrush', 'ほそい えふで', () => { const o = new Obj(); o.p(C(0.003, 0.004, 0.17, 8).rotateZ(PI / 2), '#a0522d', 'gloss', [0, 0.004, 0]);
  o.p(C(0.004, 0.004, 0.02, 8).rotateZ(PI / 2), '#c9ccd1', 'metal', [0.095, 0.004, 0]); o.p(K(0.004, 0.025, 8).rotateZ(-PI / 2), '#2b1d12', 'fabric', [0.117, 0.004, 0]); return o; });
def('ring_ruby', 'あかい ほうせきの ゆびわ', () => { const o = new Obj(); o.p(T(0.016, 0.004, PI * 2, 8, 24), '#e0b13a', 'metal', [0, 0.02, 0]);
  o.p(new THREE.OctahedronGeometry(0.009), '#c1121f', 'glass', [0, 0.04, 0]); o.p(new THREE.OctahedronGeometry(0.006), '#e5383b', 'gloss', [0, 0.04, 0]); return o; });
def('ship_bottle', 'びんの なかの ふね', () => { const o = new Obj(); o.p(CAP(0.035, 0.12), '#bfe6e0', 'glass', [0, 0.035, 0], [0, 0, PI / 2]);
  o.p(C(0.012, 0.014, 0.04, 12).rotateZ(PI / 2), '#bfe6e0', 'glass', [0.1, 0.035, 0]); o.p(C(0.011, 0.011, 0.02, 10).rotateZ(PI / 2), '#8b5a2b', 'wood', [0.125, 0.035, 0]);
  o.p(B(0.07, 0.012, 0.02), '#5a3a1a', 'wood', [0, 0.012, 0]); o.p(C(0.002, 0.002, 0.05), '#5a3a1a', 'wood', [0, 0.04, 0]); o.p(EXT(tri(0.03, 0.035), 0.002, 0), '#fff8e8', 'fabric', [0.012, 0.04, 0]); return o; });
def('pocket_watch', 'きんいろの とけい', () => { const o = new Obj(); o.p(C(0.03, 0.03, 0.012, 24), '#d4a537', 'metal', [0, 0.006, 0]);
  o.p(ATL(new THREE.CircleGeometry(0.026, 24), 'pwatch', draw.clock('#d4a537')), '#fff', 'atlas', [0, 0.0125, 0], [-PI / 2, 0, 0]); o.p(T(0.008, 0.003), '#d4a537', 'metal', [0.036, 0.006, 0], [PI / 2, 0, 0]); return o; });
def('sofa_mini', 'ちいさな あかい ソファ', () => { const o = new Obj(); o.p(RB(0.07, 0.02, 0.035, 0.006), '#9d0208', 'fabric', [0, 0.018, 0]); o.p(RB(0.07, 0.035, 0.01, 0.004), '#9d0208', 'fabric', [0, 0.035, -0.014]);
  [-1, 1].forEach(d => o.p(RB(0.01, 0.028, 0.035, 0.003), '#9d0208', 'fabric', [d * 0.035, 0.028, 0])); [-1, 1].forEach(x => [-1, 1].forEach(z => o.p(C(0.003, 0.002, 0.008, 6), '#3a2410', 'wood', [x * 0.03, 0.004, z * 0.013]))); return o; });
def('butterfly_specimen', 'あおい ちょうの ひょうほん', () => { const o = new Obj(); o.p(B(0.12, 0.1, 0.012), '#5a3a1a', 'wood', [0, 0.05, 0]); o.p(B(0.105, 0.085, 0.004), '#f3ead8', 'matte', [0, 0.05, 0.005]);
  [-1, 1].forEach(d => { o.p(S(0.02, 10, 6), '#1f6fd1', 'gloss', [d * 0.02, 0.058, 0.008], null, [1, 1.2, 0.1]); o.p(S(0.013, 10, 6), '#3a86ff', 'gloss', [d * 0.016, 0.036, 0.008], null, [1, 1, 0.1]); });
  o.p(C(0.002, 0.002, 0.04), '#111', 'matte', [0, 0.05, 0.009]); o.p(B(0.106, 0.086, 0.002), '#e8f6ff', 'glass', [0, 0.05, 0.008]); return o; });
def('flute', 'きんいろの フルート', () => { const o = new Obj(); o.p(C(0.008, 0.008, 0.36, 14).rotateZ(PI / 2), '#d4af37', 'metal', [0, 0.008, 0]);
  for (let i = 0; i < 7; i++) o.p(C(0.004, 0.004, 0.004, 8), '#b8902a', 'metal', [-0.05 + i * 0.03, 0.016, 0]); return o; });
def('monocle', 'かたほうだけの めがね', () => { const o = new Obj(); o.p(T(0.02, 0.003, PI * 2, 8, 24), '#d4af37', 'metal', [0, 0.003, 0], [PI / 2, 0, 0]);
  o.p(C(0.019, 0.019, 0.002, 20), '#dff6ff', 'glass', [0, 0.003, 0]); o.p(C(0.0012, 0.0012, 0.12, 4).rotateZ(PI / 2), '#d4af37', 'metal', [0.08, 0.002, 0.01]); return o; });
def('glow_star', 'ひかる ほし', () => { const o = new Obj(); const m = o.p(EXT(starShape(0.06, 0.026), 0.012, 0.004), '#d9ffb0', 'glass', [0, 0.06, 0]);
  m.material = new THREE.MeshStandardMaterial({ color: '#d9ffb0', emissive: '#a8ff6a', emissiveIntensity: 0.9, roughness: 0.2 }); return o; });
def('skull', 'しろい ドクロ', () => { const o = new Obj(); o.p(S(0.04, 18, 14), '#efe8d8', 'satin', [0, 0.045, 0], null, [0.9, 1, 1.05]); o.p(RB(0.045, 0.025, 0.04, 0.008), '#efe8d8', 'satin', [0, 0.015, 0.012]);
  [-1, 1].forEach(d => o.p(S(0.011, 10, 8), '#1b1410', 'matte', [d * 0.015, 0.045, 0.034])); o.p(K(0.006, 0.012, 3), '#1b1410', 'matte', [0, 0.03, 0.04], [PI, 0, 0]); return o; });
def('violin_mini', 'ちいさな バイオリン', () => { const o = new Obj(); [0.025, -0.012].forEach((z, i) => o.p(S(i ? 0.03 : 0.026, 16, 10), '#a0522d', 'gloss', [0, 0.008, z], null, [1, 0.25, 1.1]));
  o.p(B(0.012, 0.01, 0.09), '#1b1410', 'gloss', [0, 0.012, 0.075]); o.p(T(0.008, 0.004, PI * 1.5, 6, 12), '#5a3a1a', 'gloss', [0, 0.012, 0.125], [PI / 2, 0, 0]); return o; });
def('feather', 'しろい とりの はね', () => { const o = new Obj(); o.p(C(0.0012, 0.002, 0.16, 4).rotateZ(PI / 2), '#f3eee0', 'matte', [0, 0.003, 0]);
  o.p(S(0.03, 12, 6), '#fbf8f0', 'fabric', [0.015, 0.003, 0], null, [2.3, 0.08, 0.6]); return o; });

// =====================================================================
// ひみつの アイテム（リストには「？？？」）
// =====================================================================
def('ghost', 'ちいさな おばけ', () => { const o = new Obj(); const w = '#f8f8ff'; o.p(HS(0.06), w, 'satin', [0, 0.08, 0]);
  const skirt = new THREE.CylinderGeometry(0.06, 0.068, 0.08, 20, 1, true); const p = skirt.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getY(i) < 0) p.setY(i, p.getY(i) + Math.sin(Math.atan2(p.getZ(i), p.getX(i)) * 6) * 0.012);
  skirt.computeVertexNormals(); const m = o.p(skirt, w, 'satin', [0, 0.04, 0]); m.material = m.material.clone(); m.material.side = THREE.DoubleSide;
  o.eyes(0.1, 0.055, 0.02, 0.01); o.traverse(c => { if (c.isMesh) { c.material = c.material.clone(); c.material.emissive = new THREE.Color('#bfc8ff'); c.material.emissiveIntensity = 0.25; } }); return o; }, { secret: true });
def('egg_gold', 'きんの たまご', () => { const o = new Obj(); const pts = []; for (let i = 0; i <= 16; i++) { const t = i / 16, a = t * PI; pts.push([Math.sin(a) * 0.05 * (1 - 0.18 * t), 0.07 - Math.cos(a) * 0.07]); }
  o.p(LATHE(pts, 24), '#f0c040', 'metal'); return o; }, { secret: true });
def('cat_black', 'くろい ねこ', () => { const o = new Obj(); animal(o, { body: '#141414', ear: 'point', k: 'satin', extra: (o) => o.p(CAP(0.008, 0.08), '#141414', 'satin', [-0.06, 0.06, -0.03], [0, 0, 1]) });
  o.traverse(c => { if (c.isMesh && c.geometry.parameters?.radius === 0.007) { c.material = c.material.clone(); c.material.color.set('#ffd400'); c.material.emissive = new THREE.Color('#ffd400'); c.material.emissiveIntensity = 0.8; } }); return o; }, { secret: true });

// ---------- 公開 ----------
export const TOYS = DEFS;
export const TOY_MAP = Object.fromEntries(DEFS.map(d => [d.key, d]));
export function buildToy(key) { const d = TOY_MAP[key]; const g = d.build(); g.userData.itemId = key; return g; }
