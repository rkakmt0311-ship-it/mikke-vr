// 共通ヘルパー：乱数・テクスチャ・メッシュ生成など
import * as THREE from 'three';

export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const FONT = '"Hiragino Maru Gothic ProN","Hiragino Sans","Yu Gothic UI","Meiryo",sans-serif';

// シード付き乱数（ページごとに同じ配置を再現するため）
export function makeRng(seed) {
  let s = seed >>> 0;
  const r = () => {
    s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  r.range = (a, b) => a + r() * (b - a);
  r.pick = arr => arr[Math.floor(r() * arr.length)];
  r.shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  return r;
}

export function canvasTex(w, h, draw, repeat = [1, 1]) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

export function woodTex(rng, hue, light, repeat = [2, 2]) {
  return canvasTex(512, 512, g => {
    for (let i = 0; i < 8; i++) {
      g.fillStyle = `hsl(${hue},${38 + rng.range(-6, 6)}%,${light + rng.range(-5, 5)}%)`; g.fillRect(0, i * 64, 512, 64);
      for (let k = 0; k < 36; k++) {
        g.strokeStyle = `rgba(30,15,5,${rng.range(.05, .2)})`; g.beginPath(); const y = i * 64 + rng() * 64;
        g.moveTo(0, y); g.bezierCurveTo(170, y + rng.range(-6, 6), 340, y + rng.range(-6, 6), 512, y + rng.range(-4, 4)); g.stroke();
      }
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, i * 64, 512, 2);
    }
  }, repeat);
}

export function setShadow(light, size, res = 1024, far = 30) {
  light.castShadow = true;
  const c = light.shadow.camera;
  if (c.isOrthographicCamera) { c.left = c.bottom = -size; c.right = c.top = size; }
  c.near = 0.2; c.far = far;
  light.shadow.mapSize.set(res, res); light.shadow.bias = -0.0006; light.shadow.normalBias = 0.02;
}

export function mesh(geo, mat, pos, parent, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geo, mat);
  if (pos) m.position.copy(pos);
  m.castShadow = cast; m.receiveShadow = receive;
  if (parent) parent.add(m);
  return m;
}

// 山盛りの中の位置。surface=true なら表面近く（隠しアイテム用）
export function moundTop(R, H, dx, dz) { return Math.max(0, H * (1 - (dx * dx + dz * dz) / (R * R))); }
export function moundPoint(rng, c, R, H, surface = false, rMax = 1) {
  const r = R * rMax * Math.sqrt(rng()), a = rng() * Math.PI * 2;
  const dx = Math.cos(a) * r, dz = Math.sin(a) * r, top = moundTop(R, H, dx, dz);
  const y = surface ? top * rng.range(0.78, 0.95) : rng() * top;
  return V(c.x + dx, c.y + y, c.z + dz);
}

// InstancedMesh で大量配置（ごちゃごちゃ感の主役）
export function scatter(rng, geo, mat, count, posFn, colors, { scale = () => 1, rot = null, vary = true } = {}) {
  count = Math.max(1, Math.round(count));
  const m = new THREE.InstancedMesh(geo, mat, count);
  const d = new THREE.Object3D(), c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    d.position.copy(posFn(i));
    if (rot) { const r = rot(i); d.rotation.set(r.x, r.y, r.z); }
    else d.rotation.set(rng() * 6.28, rng() * 6.28, rng() * 6.28);
    // 1個ずつ大きさ・縦横比・色を少しずつ変えて、まったく同じ物を作らない
    const s = scale(i); if (typeof s === 'number') d.scale.setScalar(s); else d.scale.copy(s);
    if (vary) d.scale.multiply(V(rng.range(0.78, 1.25), rng.range(0.78, 1.25), rng.range(0.78, 1.25)));
    d.updateMatrix(); m.setMatrixAt(i, d.matrix);
    if (colors) {
      c.set(colors[Math.floor(rng() * colors.length)]);
      if (vary) c.offsetHSL(rng.range(-0.04, 0.04), rng.range(-0.15, 0.08), rng.range(-0.08, 0.08));
      m.setColorAt(i, c);
    }
  }
  m.castShadow = m.receiveShadow = true;
  m.computeBoundingSphere();
  return m;
}

// 角の丸い箱
export function roundedBox(w, h, d, r, seg = 4) {
  const g = new THREE.BoxGeometry(w, h, d, seg, seg, seg), p = g.attributes.position, v = new THREE.Vector3();
  const hx = w / 2 - r, hy = h / 2 - r, hz = d / 2 - r, cl = THREE.MathUtils.clamp;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const c = V(cl(v.x, -hx, hx), cl(v.y, -hy, hy), cl(v.z, -hz, hz));
    v.sub(c); if (v.lengthSq() > 0) v.normalize().multiplyScalar(r); v.add(c);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

export function starShape(outer, inner, n = 5) {
  const s = new THREE.Shape();
  for (let i = 0; i < n * 2; i++) {
    const a = i / (n * 2) * Math.PI * 2 + Math.PI / 2, r = i % 2 ? inner : outer;
    s[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
  }
  return s;
}

// レイキャストの対象外にする（エフェクト類）
export function noRay(obj) { obj.traverse(o => { o.raycast = () => {}; }); return obj; }

export function disposeTree(obj) {
  obj.traverse(o => {
    o.geometry?.dispose();
    [].concat(o.material || []).forEach(m => { for (const k in m) if (m[k]?.isTexture) m[k].dispose(); m.dispose(); });
  });
}

export const clamp01 = x => Math.min(1, Math.max(0, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = t => t * t * (3 - 2 * t);
