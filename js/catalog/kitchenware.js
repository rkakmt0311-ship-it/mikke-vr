// 台所の「ごちゃごちゃ」用の小物。お題にはしない、おとり専用。
// 同じ物を置かないよう、作るたびに大きさ・色・形を変える。古びて、くすんだ色ばかり。
// 屋根裏のおとり一覧（toys.js の TOYS）とは別にしてあるので、屋根裏の配置は変わらない。
import * as THREE from 'three';
import { mat } from './toys.js';

const PI = Math.PI;
const CHINA = ['#cfc6b0', '#b8ad98', '#8a9a9c', '#a8785c', '#6f7d6a', '#c7b68f', '#8c5a4a', '#5f6f78', '#9c8f7a'];
const ENAMEL = ['#7a3a2e', '#3f5560', '#6a6a4a', '#b5a98a', '#4c4a3e', '#8a5a2e'];
const METAL = ['#8a7a66', '#6e6256', '#9a8c74', '#7a5636', '#5a5048'];
const WOOD = ['#6b4a2e', '#7f5c3a', '#54391f', '#8c6c46'];
const CLOTH = ['#8c7f66', '#7a4a3e', '#5f6b5a', '#a39074', '#6b5a7a'];
const LABEL = ['#c9b98a', '#a8483a', '#3f5a6a', '#6a7a3a', '#d4a537', '#7b2c4f'];

const C = (rt, rb, h, s = 7) => new THREE.CylinderGeometry(rt, rb, h, s);
const S = (r, w = 7, h = 5) => new THREE.SphereGeometry(r, w, h);
const B = (x, y, z) => new THREE.BoxGeometry(x, y, z);
const T = (R, r, arc = PI * 2) => new THREE.TorusGeometry(R, r, 4, 8, arc);

class W extends THREE.Group {
  p(geo, color, kind = 'satin', pos = [0, 0, 0], rot = null, scl = null) {
    const m = new THREE.Mesh(geo, mat(color, kind)); m.position.set(...pos);
    if (rot) m.rotation.set(...rot); if (scl) m.scale.set(...scl);
    m.castShadow = m.receiveShadow = true; this.add(m); return m;
  }
}
const make = (h, fn) => r => { const o = new W(); const s = fn(o, r); o.userData.h = (s ?? h); return o; };

const WARES = {
  dish: [
    make(0.02, (o, r) => { const R = r.range(0.07, 0.11), c = r.pick(CHINA); o.p(C(R, R * 0.68, 0.016, 9), c, 'gloss', [0, 0.008, 0]); }),                                                  // 皿
    make(0.06, (o, r) => { const R = r.range(0.05, 0.08), c = r.pick(CHINA); o.p(C(R, R * 0.55, 0.05, 9), c, 'gloss', [0, 0.025, 0]); o.p(C(R * 0.86, R * 0.86, 0.002, 10), '#2a2118', 'matte', [0, 0.051, 0]); }),   // 鉢
    make(0.09, (o, r) => { const R = r.range(0.032, 0.042), c = r.pick(CHINA); const h = r.range(0.07, 0.09); o.p(C(R, R * 0.9, h), c, 'gloss', [0, h / 2, 0]); o.p(C(R * 0.86, R * 0.86, 0.002), '#231a12', 'matte', [0, h + 0.001, 0]); o.p(T(0.02, 0.005), c, 'gloss', [R + 0.012, h / 2, 0]); return h; }),   // マグ
    make(0.09, (o, r) => { const c = r.pick(CHINA); for (let i = 0; i < 5; i++) o.p(C(0.075, 0.055, 0.012, 12), i % 2 ? c : r.pick(CHINA), 'gloss', [r.range(-0.004, 0.004), 0.008 + i * 0.016, r.range(-0.004, 0.004)]); }),   // 皿の重なり
    make(0.1, (o, r) => { const c = r.pick(CHINA); o.p(S(0.05), c, 'gloss', [0, 0.05, 0], null, [1, 0.85, 1]); o.p(S(0.012), c, 'gloss', [0, 0.098, 0]); }),                                  // 砂糖つぼ
  ],
  pot: [
    make(0.14, (o, r) => { const R = r.range(0.07, 0.11), h = r.range(0.08, 0.13), c = r.pick(ENAMEL.concat(METAL)); o.p(C(R, R * 0.94, h, 9), c, r() < 0.5 ? 'metal' : 'gloss', [0, h / 2, 0]); [-1, 1].forEach(d => o.p(B(0.03, 0.008, 0.02), c, 'metal', [d * (R + 0.012), h * 0.8, 0])); o.p(C(R, R, 0.008, 9), c, 'gloss', [0, h + 0.004, 0]); o.p(S(0.01), '#2a2118', 'gloss', [0, h + 0.016, 0]); return h + 0.02; }),   // 蓋つきの鍋
    make(0.04, (o, r) => { const R = r.range(0.08, 0.12), c = r.pick(['#2c2a28', '#3a3430', '#4a3a2c']); o.p(C(R, R * 0.9, 0.03, 9), c, 'metal', [0, 0.015, 0]); o.p(B(0.16, 0.012, 0.022), '#3a2a1c', 'wood', [R + 0.07, 0.024, 0]); }),   // フライパン
    make(0.17, (o, r) => { const c = r.pick(ENAMEL); o.p(S(0.07, 10, 8), c, 'gloss', [0, 0.065, 0], null, [1, 0.85, 1]); o.p(C(0.012, 0.018, 0.08), c, 'gloss', [0.08, 0.08, 0], [0, 0, -0.8]); o.p(T(0.05, 0.005, PI), '#2a2118', 'metal', [0, 0.11, 0]); return 0.16; }),   // やかん
    make(0.1, (o, r) => { const R = r.range(0.08, 0.11), c = r.pick(METAL); o.p(new THREE.SphereGeometry(R, 10, 6, 0, PI * 2, PI / 2, PI / 2), c, 'metal', [0, R * 0.9, 0]); return R; }),   // ざる
  ],
  jar: [
    make(0.16, (o, r) => { const R = r.range(0.035, 0.055), h = r.range(0.1, 0.17); o.p(C(R, R, h), r.pick(LABEL.concat(['#5a4a2a', '#6a2a22', '#3a4a2a', '#8a6a2a'])), 'gloss', [0, h / 2, 0]); o.p(C(R * 0.9, R * 0.9, 0.014), r.pick(METAL), 'metal', [0, h + 0.007, 0]); return h + 0.014; }),   // 瓶詰め
    make(0.11, (o, r) => { const R = r.range(0.032, 0.045), h = r.range(0.07, 0.12); o.p(C(R, R, h), r.pick(METAL), 'metal', [0, h / 2, 0]); o.p(C(R * 1.01, R * 1.01, h * 0.6), r.pick(LABEL), 'matte', [0, h / 2, 0]); return h; }),   // 缶詰
    make(0.26, (o, r) => { const R = r.range(0.028, 0.038), h = r.range(0.13, 0.19), c = r.pick(['#2a3a2a', '#3a2a1a', '#2a2a3a', '#5a4a2a']); o.p(C(R, R, h), c, 'gloss', [0, h / 2, 0]); o.p(C(0.012, R, 0.05), c, 'gloss', [0, h + 0.025, 0]); o.p(C(0.013, 0.013, 0.02), '#6b4a2e', 'matte', [0, h + 0.06, 0]); return h + 0.07; }),   // 酒びん
    make(0.09, (o, r) => { o.p(C(0.02, 0.024, 0.07), r.pick(CHINA), 'gloss', [0, 0.035, 0]); o.p(S(0.02), r.pick(METAL), 'metal', [0, 0.07, 0]); }),                                             // 塩びん
    make(0.09, (o, r) => { const x = r.range(0.06, 0.1), z = r.range(0.05, 0.08), y = r.range(0.07, 0.12); o.p(B(x, y, z), r.pick(LABEL), 'matte', [0, y / 2, 0]); return y; }),                 // ブリキの箱
  ],
  food: [
    make(0.07, (o, r) => { const c = r.pick(['#a8783a', '#8c6a3a', '#b5894a']); o.p(S(0.04), c, 'matte', [0, 0.035, 0], null, [1, 0.85, 1]); o.p(new THREE.ConeGeometry(0.012, 0.03, 6), c, 'matte', [0, 0.078, 0]); }),   // 玉ねぎ
    make(0.06, (o, r) => { o.p(S(0.04), r.pick(['#7a6242', '#8a7050', '#6a5438']), 'matte', [0, 0.028, 0], [r(), r(), r()], [1.25, 0.8, 0.9]); }),                                              // じゃがいも
    make(0.05, (o, r) => { o.p(S(0.024), '#d2c8b0', 'matte', [0, 0.022, 0], null, [1, 0.9, 1]); o.p(new THREE.ConeGeometry(0.008, 0.02, 5), '#b8ad8e', 'matte', [0, 0.05, 0]); }),                // にんにく
    make(0.13, (o, r) => { const R = r.range(0.08, 0.12), c = r.pick(['#a8622a', '#8a5a2a', '#6a6a3a']); o.p(S(R, 10, 8), c, 'matte', [0, R * 0.75, 0], null, [1, 0.75, 1]); o.p(C(0.012, 0.018, 0.04, 5), '#4a3a1e', 'matte', [0, R * 1.5, 0]); return R * 1.6; }),   // かぼちゃ
    make(0.08, (o, r) => { const l = r.range(0.16, 0.26); o.p(new THREE.CapsuleGeometry(0.04, l, 3, 7), r.pick(['#8a5a2a', '#6a4220', '#a0703a']), 'matte', [0, 0.04, 0], [0, 0, PI / 2]); }),  // 古いパン
    make(0.05, (o, r) => { const R = r.range(0.07, 0.1); o.p(C(R, R * 0.85, 0.035, 12), r.pick(['#8a6a3a', '#6a4a2a']), 'matte', [0, 0.018, 0]); o.p(C(R * 0.86, R * 0.86, 0.004, 10), r.pick(['#4a1a22', '#2a3a1a', '#5a3a1a']), 'gloss', [0, 0.037, 0]); }),   // 焼き菓子の残り
    make(0.03, (o, r) => { o.p(new THREE.CapsuleGeometry(0.018, r.range(0.09, 0.14), 3, 6), r.pick(['#5a2a22', '#6a3a2a', '#4a2a1a']), 'gloss', [0, 0.02, 0], [0, 0, PI / 2]); }),            // ソーセージ
    make(0.03, (o, r) => { const c = '#cfc8b4'; o.p(B(0.15, 0.006, 0.006), c, 'matte', [0, 0.012, 0]); for (let i = 0; i < 6; i++) o.p(B(0.005, 0.005, 0.05 - i * 0.004), c, 'matte', [-0.05 + i * 0.018, 0.012, 0]); o.p(new THREE.ConeGeometry(0.018, 0.04, 6), c, 'matte', [0.09, 0.012, 0], [0, 0, -PI / 2]); }),   // 魚の骨
    make(0.03, (o, r) => { const l = r.range(0.08, 0.14), c = '#d2c9b2'; o.p(C(0.008, 0.008, l, 6), c, 'matte', [0, 0.012, 0], [0, 0, PI / 2]); [-1, 1].forEach(d => o.p(S(0.013, 6, 5), c, 'matte', [d * l / 2, 0.012, 0])); }),   // 骨
  ],
  tool: [
    make(0.03, (o, r) => { const c = r.pick(METAL); o.p(C(0.005, 0.005, 0.24, 5), c, 'metal', [0, 0.01, 0], [0, 0, PI / 2]); o.p(S(0.035), c, 'metal', [0.13, 0.024, 0], null, [1, 0.6, 1]); }),   // お玉
    make(0.03, (o, r) => { const c = r.pick(WOOD); o.p(C(0.006, 0.006, 0.22, 5), c, 'wood', [0, 0.012, 0], [0, 0, PI / 2]); o.p(S(0.024), c, 'wood', [0.12, 0.014, 0], null, [1.3, 0.35, 1]); }),   // 木のさじ
    make(0.04, (o, r) => { o.p(C(0.007, 0.007, 0.11, 6), r.pick(WOOD), 'wood', [-0.06, 0.03, 0], [0, 0, PI / 2]); o.p(S(0.03, 6, 5), '#8a7a66', 'metal', [0.03, 0.03, 0], null, [1.8, 1, 1]); }),   // 泡立て器
    make(0.05, (o, r) => { const c = r.pick(WOOD); o.p(C(0.024, 0.024, 0.24, 8), c, 'wood', [0, 0.024, 0], [0, 0, PI / 2]); [-1, 1].forEach(d => o.p(C(0.009, 0.009, 0.06, 6), c, 'wood', [d * 0.15, 0.024, 0], [0, 0, PI / 2])); }),   // 麺棒
    make(0.02, (o, r) => { o.p(B(r.range(0.2, 0.32), 0.016, r.range(0.14, 0.2)), r.pick(WOOD), 'wood', [0, 0.008, 0]); }),                                                                     // まな板
    make(0.02, (o, r) => { o.p(B(r.range(0.12, 0.2), 0.008, r.range(0.1, 0.18)), r.pick(CLOTH), 'fabric', [0, 0.005, 0], [r.range(-0.1, 0.1), 0, r.range(-0.1, 0.1)]); }),                      // ふきん
    make(0.04, (o, r) => { o.p(new THREE.CapsuleGeometry(0.04, 0.07, 3, 7), r.pick(CLOTH), 'fabric', [0, 0.02, 0], [0, 0, PI / 2], [1, 0.45, 1]); }),                                          // なべつかみ
    make(0.03, (o, r) => { o.p(B(0.11, 0.03, 0.07), r.pick(['#a89a5a', '#7a7a4a', '#8a6a3a']), 'matte', [0, 0.015, 0]); }),                                                                    // たわし
    make(0.03, (o, r) => { o.p(B(0.2, 0.004, 0.018), '#7a7468', 'metal', [0.04, 0.008, 0]); o.p(B(0.1, 0.018, 0.02), r.pick(WOOD), 'wood', [-0.1, 0.01, 0]); }),                                // 食事用ナイフ
    make(0.03, (o, r) => { o.p(B(0.13, 0.008, 0.07), r.pick(WOOD), 'wood', [0, 0.004, 0]); o.p(T(0.022, 0.002), '#6e6256', 'metal', [0, 0.01, 0], [PI / 2, 0, 0]); o.p(B(0.1, 0.003, 0.003), '#6e6256', 'metal', [0, 0.012, 0.02]); }),   // ねずみとり
    make(0.14, (o, r) => { o.p(C(0.018, 0.022, 0.1, 8), '#d8cdb0', 'matte', [0, 0.05, 0]); o.p(C(0.05, 0.055, 0.008, 10), r.pick(METAL), 'metal', [0, 0.004, 0]); return 0.11; }),                // 燃えさしのろうそく
    make(0.12, (o, r) => { o.p(C(0.06, 0.06, 0.03, 12), '#3a2a1c', 'wood', [0, 0.015, 0]); o.p(C(0.05, 0.05, 0.1, 10), r.pick(METAL), 'metal', [0, 0.08, 0]); return 0.13; }),                 // はかり・ミル
  ],
};
const CATS = Object.keys(WARES);
export function makeWare(r, cats = CATS) { return r.pick(WARES[r.pick(cats)])(r); }
