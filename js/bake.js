// お題以外の物を「質感ごとに1つのメッシュ」へまとめる（描画回数を大幅に減らし、Questでも軽くする）
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { KINDS, makeKindMaterial, isUltra } from './catalog/toys.js';
import { atlasTex } from './catalog/atlas.js';
import { addDust } from './util.js';
import { boxUV } from './pbr.js';

const batchMats = {};
function batchMat(kind) {
  const key = kind + (isUltra() ? ':u' : '');
  return batchMats[key] ||= addDust(makeKindMaterial(kind, { vertexColors: true, color: '#ffffff' }));
}

// 部屋の中の「動かない物」（家具・壁・梁など）を、材質ごとに1つのメッシュへまとめる。
// 動く物（userData.dynamic のグループの中）、押せる物（userData.interact）、エフェクト（noRay）、
// InstancedMesh はそのまま残す。まとめた物はクリック判定に使わない（Questで毎フレームのレーザー判定を軽くするため）。
const baseRaycast = THREE.Mesh.prototype.raycast;
// 色以外（質感・テクスチャ・透明度など）が同じ材質は1つにまとめ、色は頂点ごとに持たせる
function signature(mt) {
  return [mt.type, mt.roughness, mt.metalness, mt.map?.uuid, mt.normalMap?.uuid, mt.transparent, mt.opacity, mt.side, mt.wireframe,
    mt.emissive?.getHexString(), mt.emissiveIntensity, mt.clearcoat, mt.sheen, mt.depthWrite, mt.alphaTest, mt.roughnessMap?.uuid, mt.aoMap?.uuid, mt.userData.tile].join('|');
}
export function mergeStatic(root, { raycast = false } = {}) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), m = new THREE.Matrix4();
  const groups = new Map(), done = [];
  root.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || Array.isArray(o.material) || o.userData.interact || o.raycast !== baseRaycast || o.userData.fromModel) return;
    if (!o.material.isMeshStandardMaterial || o.material.vertexColors) return;
    for (let p = o.parent; p && p !== root; p = p.parent) if (p.userData.dynamic || p.userData.interact || p.userData.itemId) return;
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    g.morphAttributes = {};
    g.applyMatrix4(m.multiplyMatrices(inv, o.matrixWorld));
    // 実写の質感：世界座標（メートル）から貼り直して、木目が伸びないようにする
    if (o.material.userData.tile && !o.geometry.userData.uvFixed) boxUV(g, o.material.userData.tile, o.material.userData.turn);
    const c = o.material.color, n = g.attributes.position.count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const key = signature(o.material) + (o.castShadow ? '|c' : '') + (o.receiveShadow ? '|r' : '');
    if (!groups.has(key)) { const mat = addDust(o.material.clone()); mat.color.set('#ffffff'); mat.vertexColors = true; groups.set(key, { mat, cast: o.castShadow, recv: o.receiveShadow, list: [] }); }
    groups.get(key).list.push(g); done.push(o);
  });
  done.forEach(o => o.parent.remove(o));
  let n = 0;
  for (const { mat, cast, recv, list } of groups.values()) {
    const merged = mergeGeometries(list, false); list.forEach(g => g.dispose()); if (!merged) continue;
    const mesh = new THREE.Mesh(merged, mat); mesh.castShadow = cast; mesh.receiveShadow = recv; mesh.userData.mergedStatic = true;
    if (!raycast) mesh.raycast = () => {};
    root.add(mesh); n++;
  }
  return { meshes: done.length, merged: n };
}

// objects: 置き終わった Group の配列（parent の座標系に置かれている前提）
export function bakeStatic(objects, parent) {
  parent.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(parent.matrixWorld).invert(), m = new THREE.Matrix4();
  const groups = {};
  for (const obj of objects) {
    obj.updateMatrixWorld(true);
    obj.traverse(o => {
      if (!o.isMesh) return;
      let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      if (!g.attributes.normal) g.computeVertexNormals();
      g.applyMatrix4(m.multiplyMatrices(inv, o.matrixWorld));
      const c = o.material.color, n = g.attributes.position.count, col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const kind = o.material.userData.kind || 'plastic';
      (groups[kind] ||= []).push(g);
    });
  }
  const meshes = [];
  for (const [kind, list] of Object.entries(groups)) {
    const merged = mergeGeometries(list, false); list.forEach(g => g.dispose());
    const mesh = new THREE.Mesh(merged, batchMat(kind));
    mesh.castShadow = !KINDS[kind]?.t; mesh.receiveShadow = true;
    mesh.raycast = () => {};   // まとめた物はクリック判定に使わない（お題は別メッシュ）
    mesh.userData.baked = true;
    parent.add(mesh); meshes.push(mesh);
  }
  return meshes;
}
