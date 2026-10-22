// 外部の素材（Geminiで作った画像、Higgsfieldで3D化したモデルなど）を差し込む仕組み
// assets/manifest.json の例：
// {
//   "textures": { "toy_floor": "textures/toy_floor.jpg" },
//   "models":   { "piano": { "file": "models/piano.glb", "height": 1.0 }, "dice_red": { "file": "models/dice.glb", "height": 0.12 } }
// }
// 書いていない物は、今まで通り自動生成の絵・形を使う。
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let manifest = { textures: {}, models: {} };
const imgLoader = new THREE.ImageLoader();
const gltfLoader = new GLTFLoader();
const modelCache = new Map();

export async function loadManifest() {
  try {
    const r = await fetch('assets/manifest.json', { cache: 'no-cache' });
    if (r.ok) manifest = await r.json();
  } catch (e) { /* 素材なしで続行 */ }
  manifest.textures ||= {}; manifest.models ||= {};
}

// ---------- 画像 ----------
// fallback：自動生成のテクスチャ。画像があれば中身だけ入れ替える（繰り返し回数などはそのまま）
// compose(img) を渡すと、画像の上に文字などを重ねたキャンバスを作れる（絵本の表紙のタイトルなど）
export function tex(key, fallback, compose = null) {
  const file = manifest.textures[key];
  if (!file) return fallback;
  imgLoader.load(`assets/${file}`, img => { fallback.image = compose ? compose(img) : img; fallback.needsUpdate = true; }, undefined,
    () => console.warn(`素材が読み込めませんでした: assets/${file}`));
  return fallback;
}
export const hasTex = key => !!manifest.textures[key];

// ---------- 3Dモデル ----------
export const hasModel = key => !!manifest.models[key];
function loadGltf(file) {
  if (!modelCache.has(file)) modelCache.set(file, new Promise((res, rej) => gltfLoader.load(`assets/${file}`, g => res(g.scene), undefined, rej)));
  return modelCache.get(file);
}
// group の中身（自動生成の形）を、GLBモデルに入れ替える。
// 底が y=0、中心が原点、高さが height になるように大きさをそろえる。
// keep(mesh) が true の子（ピアノの鍵盤の当たり判定など）は、見えなくして残す。
export async function swapModel(key, group, { keep = () => false } = {}) {
  const def = manifest.models[key]; if (!def) return false;
  const spec = typeof def === 'string' ? { file: def } : def;
  // 読み込みを待つ間に、お題（くまの耳のかたつむりなど）が乗せられることがある。消すのは元からあった形だけ
  const orig = [...group.children];
  try {
    const src = (await loadGltf(spec.file)).clone(true);
    const box = new THREE.Box3().setFromObject(src), size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
    const s = spec.height ? spec.height / size.y : spec.width ? spec.width / Math.max(size.x, size.z) : 1;
    const holder = new THREE.Group();
    src.position.set(-center.x, -box.min.y, -center.z); holder.add(src); holder.scale.setScalar(s);
    if (spec.rotY) holder.rotation.y = THREE.MathUtils.degToRad(spec.rotY);
    src.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; o.userData.fromModel = true; } });
    // 元の形を隠す（当たり判定として使う物は透明にして残す）
    orig.forEach(c => {
      if (keep(c)) c.traverse(o => { if (o.material) { o.material = o.material.clone(); o.material.colorWrite = false; o.material.depthWrite = false; } o.castShadow = false; });
      else group.remove(c);
    });
    // クリック判定：モデル側にも元のグループの情報（itemId / interact）をつなぐ
    const ud = group.userData;
    src.traverse(o => { if (o.isMesh && ud.interact && !o.userData.interact) o.userData.interact = ud.interact; });
    group.add(holder);
    return true;
  } catch (e) { console.warn(`モデルが読み込めませんでした: assets/${spec.file}`, e); return false; }
}
