// 実写の質感素材（Poly Haven / CC0）：色・凹凸（法線）・粗さ・陰（AO）の4枚を1つの材質にする
// 箱やシリンダーのUVは物の大きさに関係なく 0〜1 なので、そのまま貼ると木目が伸びる。
// そこで「何メートルで1枚か（tile）」を材質に持たせ、世界座標から箱投影でUVを貼り直す（boxUV）。
import * as THREE from 'three';

const SETS = {
  floor: 'old_wood_floor', roof: 'roof_planks', planks: 'weathered_brown_planks', beam: 'beam_wall_01',
  table: 'wood_table_worn', plaster: 'worn_plaster_wall', leather: 'leather_red_02', velvet: 'velour_velvet',
  rust: 'rusty_metal_02', darkwood: 'dark_wood',
};
const NO_DIFFUSE = new Set(['leather_red_02']);   // 色の画像がない素材（色は材質の色を使う）
const loader = new THREE.TextureLoader();
const cache = new Map();
let lite = false;   // Quest・スマホ：粗さとAOの画像を省いてメモリを節約
export const setPbrLite = v => { lite = !!v; };

function load(file, srgb) {
  if (!cache.has(file)) {
    const t = loader.load(`assets/tex/${file}`, undefined, undefined, () => console.warn(`素材が読み込めませんでした: assets/tex/${file}`));
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    cache.set(file, t);
  }
  return cache.get(file);
}

export function pbrMaps(name) {
  const id = SETS[name], m = {};
  if (!NO_DIFFUSE.has(id)) m.map = load(`${id}_diff.jpg`, true);
  m.normalMap = load(`${id}_nor.jpg`);
  if (!lite) { m.roughnessMap = load(`${id}_rough.jpg`); m.aoMap = load(`${id}_ao.jpg`); }
  return m;
}

// color：色味（画像に掛け算）、rough：粗さの倍率、tile：1枚が何メートル分か、turn：木目を90°回す
const matCache = new Map();
export function pbr(name, { color = '#ffffff', rough = 1, metal = 0, tile = 1.5, normal = 1, ao = 1, turn = false, physical = false, ...o } = {}) {
  const key = JSON.stringify([name, color, rough, metal, tile, normal, ao, turn, physical, lite, Object.keys(o).sort().map(k => [k, o[k]?.uuid ?? o[k]])]);
  if (matCache.has(key)) return matCache.get(key);
  const Mat = physical ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
  const mat = new Mat({ color, roughness: rough, metalness: metal, ...pbrMaps(name), normalScale: new THREE.Vector2(normal, normal), aoMapIntensity: ao, ...o });
  mat.userData.tile = tile; mat.userData.turn = turn;
  matCache.set(key, mat);
  return mat;
}

// 箱投影UV：三角形ごとに、いちばん向いている軸の面に投影する（座標はメートル）
export function boxUV(geo, tile = 1, turn = false) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const p = g.attributes.position, n = p.count, uv = new Float32Array(n * 2);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), nn = new THREE.Vector3();
  // 物ごとに少しずらして、同じ模様が並ばないようにする
  const off = (Math.sin(p.getX(0) * 12.9898 + p.getZ(0) * 78.233) * 43758.5453) % 1;
  for (let i = 0; i < n; i += 3) {
    a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
    nn.subVectors(c, b).cross(a.clone().sub(b));
    const ax = Math.abs(nn.x), ay = Math.abs(nn.y), az = Math.abs(nn.z);
    for (let k = 0; k < 3; k++) {
      const v = k === 0 ? a : k === 1 ? b : c;
      let u, w;
      if (ay >= ax && ay >= az) { u = v.x; w = v.z; } else if (ax >= az) { u = v.z; w = v.y; } else { u = v.x; w = v.y; }
      if (turn) [u, w] = [w, u];
      uv[(i + k) * 2] = u / tile + off; uv[(i + k) * 2 + 1] = w / tile + off * 0.7;
    }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}
// メッシュの見た目の大きさ（scale込み）で貼り直す（まとめ描画しない物用）
export function fitUV(m) {
  const mt = m.material; if (!mt?.userData?.tile) return m;
  const g = m.geometry.clone(); g.scale(m.scale.x, m.scale.y, m.scale.z);
  const out = boxUV(g, mt.userData.tile, mt.userData.turn); out.scale(1 / m.scale.x, 1 / m.scale.y, 1 / m.scale.z);
  m.geometry = out; return m;
}
