// ゲーム全体の進行：モード切替・ステージ読み込み・ミッケ判定・お題リスト・ヒント・記録
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { StereoEffect } from 'three/addons/effects/StereoEffect.js';
import { Player } from './player.js';
import { V, noRay, disposeTree } from './util.js';
import { initAudio, sfx, updateListener, startAmbience, stopAmbience, ambientEvents, playBgm, playTheme, stopTheme, setVolume, getVolumes } from './audio.js';
import { Panel, drawList, textSprite, button3d, makeReticle, makeVignette, fmtTime, kanjiNum } from './ui3d.js';
import { createHub, BOOKS } from './stages/hub.js';
import { createAttic } from './stages/attic.js';
import { loadManifest } from './assets.js';
import { setUltra } from './catalog/toys.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

await loadManifest();   // Geminiなどで作った画像素材の一覧（無ければ自動生成の絵を使う）

const STAGES = { toyroom: createAttic };   // 1冊目の絵本＝屋根裏部屋
const QUALITY = {
  ultra: { clutter: 1.0, shadow: 4096, pr: 2, post: true, ultra: true },   // PC向け：影・環境光の陰り・質感を最大に
  high: { clutter: 1.0, shadow: 2048, pr: 2 },
  quest: { clutter: 0.5, shadow: 1024, pr: 1, lite: true },   // Quest単体向け（72fps目標）
  mid: { clutter: 0.7, shadow: 1024, pr: 1.5, lite: true },
  low: { clutter: 0.4, shadow: 512, pr: 1, lite: true },
};
const isQuest = /OculusBrowser|Quest/i.test(navigator.userAgent);
const isTouch = matchMedia('(pointer: coarse)').matches;
const $ = s => document.querySelector(s);

// ---------- レンダラー ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.xr.enabled = true; renderer.xr.setReferenceSpaceType('local-floor');
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.03, 60);
const pmrem = new THREE.PMREMGenerator(renderer);
const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
// 本物の屋根裏で撮った光（Poly Haven「pine_attic」CC0）。読めたら映り込みを差し替える
new RGBELoader().load('assets/hdri/pine_attic_1k.hdr', hdr => {
  const t = pmrem.fromEquirectangular(hdr).texture; hdr.dispose();
  if (scene.environment === game.envTex) scene.environment = t;
  game.envTex = t;
}, undefined, () => console.warn('HDRIが読み込めませんでした'));
const stereo = new StereoEffect(renderer);
const player = new Player(renderer, camera);
scene.add(player.rig);
const uiRoot = new THREE.Group(); scene.add(uiRoot);   // 3D UI（レイで押せる）
const fxRoot = noRay(new THREE.Group()); scene.add(fxRoot);
const raycaster = new THREE.Raycaster(); raycaster.far = 30;

// ---------- 状態 ----------
let qualityName = localStorage.getItem('mikke-quality') || (isQuest ? 'quest' : isTouch ? 'mid' : 'high');
if (!QUALITY[qualityName]) qualityName = 'high';
const game = {
  scene, envTex, sfx, get quality() { const q = { ...QUALITY[qualityName] }; if (isQuest) q.shadow = Math.min(q.shadow, 1024); return q; },
  openBook, startPage, lens: false,
};
let mode = null;            // 'pc' | 'xr' | 'phonevr' | 'phone'
let hub = null, stage = null, current = null;  // current = いまいる場所（hub か stage）
let page = null;            // { stageId, n, title, items[], secret, time, hints, cleared }
let records = {};
try { records = JSON.parse(localStorage.getItem('mikke-records-v1') || '{}'); } catch (e) {}
const saveRecords = () => { try { localStorage.setItem('mikke-records-v1', JSON.stringify(records)); } catch (e) {} };
const HINTS = 3;

$('#quality').value = qualityName; $('#quality2').value = qualityName;
function applyPixelRatio() { renderer.setPixelRatio(Math.min(devicePixelRatio, QUALITY[qualityName].pr)); renderer.setSize(innerWidth, innerHeight); }
applyPixelRatio();
const setQuality = (v) => { qualityName = v; localStorage.setItem('mikke-quality', v); $('#quality').value = v; $('#quality2').value = v; applyPixelRatio(); setUltra(!!QUALITY[v].ultra); resizeComposer(); };
setUltra(!!QUALITY[qualityName].ultra);

// ---------- 超高画質：物どうしの接するところの陰り（GTAO）＋光のにじみ ----------
let composer = null;
function getComposer() {
  if (composer) return composer;
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const ao = new GTAOPass(scene, camera, innerWidth, innerHeight);
  ao.updateGtaoMaterial({ radius: 0.35, distanceExponent: 1.5, thickness: 1.2, scale: 1.1 }); ao.blendIntensity = 1.0;
  composer.addPass(ao);
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.22, 0.5, 0.92));
  composer.addPass(new OutputPass());
  resizeComposer(); return composer;
}
function resizeComposer() { if (composer) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(innerWidth, innerHeight); } }
const usePost = () => QUALITY[qualityName].post && (mode === 'pc' || mode === 'phone') && !renderer.xr.isPresenting;
$('#quality').onchange = e => setQuality(e.target.value);
$('#quality2').onchange = e => { setQuality(e.target.value); reloadCurrent(); };

// ---------- 場所の読み込み ----------
function enterPlace(place) {
  if (current) { scene.remove(current.root); if (current !== hub) disposeTree(current.root); }
  current = place; scene.add(place.root);
  place.enter(scene, renderer);
  player.setWorld(place.bounds, place.colliders, place.constrain);
  player.placeAt(place.spawn.pos, place.spawn.yaw);
  const amb = place.ambience || {};
  startAmbience({ ...amb, events: (amb.events || []).map(k => ambientEvents[k]) });
  playBgm(place.bgm);
}
function goHub() {
  page = null; stage = null;
  if (!hub) hub = createHub(game);
  enterPlace(hub);
  renderList(); hide3dMenu(); hideMenu();
}
let turning = false;
async function startPage(stageId, n) {
  if (turning) return; turning = true;
  hideMenu(); hide3dMenu();
  if (current === hub) hub.blowOut(); else sfx.paper(null, 1.2);
  await fade(1, 0.45);                                  // ろうそくが消えて、0.4秒の暗転
  showLoading(true); await new Promise(r => setTimeout(r, 40));
  if (!stage || stage.id !== stageId) { stage = STAGES[stageId](game); enterPlace(stage); }
  else player.placeAt(stage.spawn.pos, stage.spawn.yaw);
  const info = stage.setPage(n);
  page = { stageId, n, title: info.title, items: info.targets.map(t => ({ ...t, found: false })),
    secret: { ...info.secret, found: false }, time: 0, hints: 0, cleared: false };
  memoOpenUntil = performance.now() + 9000; renderList(); combo = 0; lastFoundAt = -99;
  showLoading(false);
  await fade(0, 1.4);                                   // 丸窓の光が、ゆっくり差しこむ
  toast(info.title, true, info.hasLens ? '（ルーペでしか 見えない ものも あるらしい……）' : '');
  turning = false;
}
// 暗転：PC・スマホは画面の幕、ゴーグルは顔のまわりの黒い球
const fadeSphere = noRay(new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), new THREE.MeshBasicMaterial({ color: '#0d0a08', side: THREE.BackSide, transparent: true, opacity: 0, depthTest: false, depthWrite: false })));
fadeSphere.renderOrder = 1000; fadeSphere.visible = false; camera.add(fadeSphere);
let fadeAnim = null, fadeLevel = 0;
function fade(to, dur) { return new Promise(res => { fadeAnim = { from: fadeLevel, to, t: 0, dur, res }; }); }
function updateFade(dt) {
  if (!fadeAnim) return; const f = fadeAnim; f.t += dt; const k = Math.min(1, f.t / f.dur), e = k * k * (3 - 2 * k);
  fadeLevel = f.from + (f.to - f.from) * e; const el = $('#fade'); el.style.transition = 'none'; el.style.opacity = fadeLevel;
  fadeSphere.visible = fadeLevel > 0.001; fadeSphere.material.opacity = fadeLevel;
  if (k >= 1) { fadeAnim = null; f.res(); }
}
function reloadCurrent() {
  if (page) { const s = page.stageId, n = page.n; stage = null; startPage(s, n); }
}
function openBook(b) {
  if (!b.ready) { toast('', true, 'この絵本は、まだ ひらかない。'); sfx.paper(); return; }
  if (hub.isOpen) return;
  hub.showPages(b, records); setTimeout(() => toast('', true, 'もくじから、ページを えらんでね。'), 1600);
}
function showLoading(on) { $('#loading').classList.toggle('show', on); }

// ---------- ミッケ判定 ----------
function visibleChain(o) { for (; o; o = o.parent) if (!o.visible) return false; return true; }
function resolve(o) {
  for (; o; o = o.parent) {
    if (o.userData.itemId) return { type: 'item', obj: o };
    if (o.userData.interact) return { type: 'interact', obj: o, data: o.userData.interact };
  }
  return null;
}
const inUI = o => { for (; o; o = o.parent) if (o === uiRoot) return true; return false; };
const pickC = V(), pickBox = new THREE.Box3(), pickSph = new THREE.Sphere();
const NEST = 0.4;   // 手前の物から この距離（m）までの奥にあるお題も選べる（ラッパ・ランタン・箱の中）
function pick(ndc = null) {
  player.aim(raycaster, ndc);
  const targets = [uiRoot]; if (current) targets.push(current.root);
  const hits = raycaster.intersectObjects(targets, true).filter(h => visibleChain(h.object));
  const first = hits[0] || null;
  if (!page || (first && inUI(first.object))) return first;
  const want = [...page.items, page.secret].filter(i => !i.found && i.obj.parent && visibleChain(i.obj)).map(i => i.obj);
  if (!want.length) return first;
  // 1) 光線上の、まだ見つけていないお題を優先（入れ物の中に見えている物も押せるように）
  for (const h of hits) {
    if (first && h.distance > first.distance + NEST) break;
    const r = resolve(h.object); if (r?.type === 'item' && want.includes(r.obj)) return h;
  }
  // 2) ねらいの補正：光線のすぐ近く（約2°以内）のお題。小さい物・輪っかの形の物を押しやすく
  const { origin, direction } = raycaster.ray; let best = null, bestK = 1;
  for (const o of want) {
    pickBox.setFromObject(o); if (pickBox.isEmpty()) continue; pickBox.getBoundingSphere(pickSph);
    const t = pickC.copy(pickSph.center).sub(origin).dot(direction); if (t <= 0) continue;
    const d = pickC.copy(origin).addScaledVector(direction, t).distanceTo(pickSph.center);
    const tol = Math.max(pickSph.radius * 1.15, t * 0.035), k = d / tol;
    if (k > 1 || (first && t - pickSph.radius > first.distance + NEST)) continue;
    if (k < bestK) { bestK = k; best = { object: o, distance: t, point: pickSph.center.clone() }; }
  }
  return best || first;
}
function activate(hit, via = 'main') {
  if (!hit) return;
  const r = resolve(hit.object); if (!r) return;
  if (r.type === 'interact') { r.data.fn(hit); return; }
  if (!page) return;
  const it = page.items.find(i => i.obj === r.obj && !i.found);
  if (it) { found(it, false); return; }
  if (page.secret.obj === r.obj && !page.secret.found) found(page.secret, true);
  // まちがいは何も起きない
}
const flying = [], floaters = [];
const MURMURS = ['（……よく 見つけたね）', '（……そこに いたのか）', '（……目が 慣れてきたね）', '（……息を ひそめて いたのに）', '（……あと すこし）', '（……ほこりを かぶって いたね）'];
let murmurI = Math.floor(Math.random() * MURMURS.length);
const murmur = () => MURMURS[murmurI++ % MURMURS.length];
// ご褒美の流れ（Vlambeer・Juice it or lose it を参考）：
// 0〜100ms 世界が止まる（ヒットストップ）＋「ドン」 → 物が内側から光る → 光の粒がリストへ吸い込まれる → 音が解決する
let combo = 0, lastFoundAt = -99, freezeUntil = 0;
function found(it, secret) {
  it.found = true; it.obj.userData.found = true; it.obj.userData.lensOnly = false; it.obj.visible = true;
  const wp = it.obj.getWorldPosition(V()), now = clock.elapsedTime;
  combo = now - lastFoundAt < 30 ? combo + 1 : 0; lastFoundAt = now;   // 30秒以内に続けて見つけると、音が上がっていく
  freezeUntil = performance.now() + 110;
  it.obj.traverse(o => { if (o.isMesh && o.material?.emissive) { o.material = o.material.clone(); o.material.emissive.set(secret ? '#ffd700' : '#ffcf70'); o.material.emissiveIntensity = 0; o.userData.glow = true; } });
  spawnBurst(wp, secret);
  if (secret) { sfx.secret(); toast('ひみつを ミッケ！', false, '（……だれにも 内緒だよ）'); spawnFloater('ひみつ', wp, '#e9b8a8'); }
  else { sfx.mikkeCombo(combo, wp); toast('ミッケ！', false, combo >= 2 ? `（……${kanjiNum(combo + 1)}つ つづけて）` : murmur()); spawnFloater('ミッケ！', wp); }
  openMemo(4);
  scene.attach(it.obj); flying.push({ obj: it.obj, t: -0.35, from: it.obj.position.clone(), s: it.obj.scale.x });
  renderList();
  if (!page.cleared && page.items.every(i => i.found)) {
    page.cleared = true;
    const key = `${page.stageId}-${page.n + 1}`, prev = records[key];
    const rec = { best: Math.min(prev?.best ?? Infinity, page.time), hints: prev ? Math.min(prev.hints, page.hints) : page.hints, secret: !!(prev?.secret || page.secret.found) };
    records[key] = rec; saveRecords();
    setTimeout(() => { sfx.clear(); toast('すべて 見つけだしたね。', true, '夜が 明けるまで、好きなだけ 部屋を 歩いてごらん。'); }, 1200);
    renderList();
  } else if (secret && page.cleared) { const key = `${page.stageId}-${page.n + 1}`; records[key].secret = true; saveRecords(); }
}
const bursts = [];
function listAnchor() {
  if (mode === 'xr' && player.left) return player.left.grip.getWorldPosition(V());
  return camera.localToWorld(mode === 'phonevr' ? V(0, -0.35, -0.8) : V(-0.42, 0.24, -0.7));
}
function spawnBurst(from, secret) {
  const N = 48, g = new THREE.BufferGeometry(), pos = new Float32Array(N * 3); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = noRay(new THREE.Points(g, new THREE.PointsMaterial({ color: secret ? '#ffd700' : '#ffe9a8', size: 0.035, transparent: true, depthTest: false, blending: THREE.AdditiveBlending, toneMapped: false })));
  pts.renderOrder = 991; fxRoot.add(pts);
  const seeds = Array.from({ length: N }, () => [V((Math.random() - 0.5) * 0.6, Math.random() * 0.5, (Math.random() - 0.5) * 0.6), Math.random() * 0.25]);
  bursts.push({ pts, t: 0, from: from.clone(), seeds });
}
function updateBursts(dt) {
  const to = listAnchor();
  for (let i = bursts.length - 1; i >= 0; i--) {
    const b = bursts[i]; b.t += dt; const p = b.pts.geometry.attributes.position;
    b.seeds.forEach(([off, delay], k) => { const u = Math.min(1, Math.max(0, (b.t - delay) / 0.9)), e = u * u * (3 - 2 * u);
      const ctrl = b.from.clone().add(off).add(V(0, 0.4, 0));                                   // ふわっと広がってから、曲線を描いてリストへ
      const a = V().lerpVectors(b.from, ctrl, Math.min(1, b.t * 4)), c = V().lerpVectors(ctrl, to, e);
      p.setXYZ(k, ...V().lerpVectors(a, c, e).toArray()); });
    p.needsUpdate = true; b.pts.material.opacity = b.t > 1.1 ? Math.max(0, 1 - (b.t - 1.1) * 3) : 1;
    if (b.t > 1.5) { fxRoot.remove(b.pts); b.pts.geometry.dispose(); bursts.splice(i, 1); }
  }
}
function spawnFloater(text, pos, color = '#fff') {
  const s = textSprite(text, { size: 0.16, color }); s.position.copy(pos).y += 0.15; fxRoot.add(s); floaters.push({ s, t: 0, y: s.position.y });
}

// ---------- ヒント（光の粒がお題の方へ流れる） ----------
let hintFx = null;
function useHint() {
  if (!page || page.cleared) return;
  if (page.hints >= HINTS) { toast('', true, '光の つぶは、もう 残っていない。'); return; }
  const head = camera.getWorldPosition(V());
  const left = page.items.filter(i => !i.found).map(i => ({ i, d: i.obj.getWorldPosition(V()).distanceTo(head) })).sort((a, b) => a.d - b.d);
  if (!left.length) return;
  page.hints++; renderList(); sfx.hint();
  if (hintFx) fxRoot.remove(hintFx.pts);
  const N = 40, g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffe27a', size: 0.05, transparent: true, opacity: 1, depthTest: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  pts.renderOrder = 990; fxRoot.add(pts);
  hintFx = { pts, t: 0, target: left[0].i.obj, N };
  toast('', true, `しっ……耳を すませて ごらん（光の つぶ あと ${kanjiNum(HINTS - page.hints)}つ）`);
}
function updateHint(dt) {
  if (!hintFx) return;
  const h = hintFx; h.t += dt;
  const start = camera.getWorldPosition(V()).add(camera.getWorldDirection(V()).multiplyScalar(0.4)).add(V(0, -0.15, 0));
  const end = h.target.getWorldPosition(V()), p = h.pts.geometry.attributes.position;
  for (let i = 0; i < h.N; i++) {
    const f = (h.t * 0.45 + i / h.N) % 1, q = V().lerpVectors(start, end, f);
    q.y += Math.sin(f * Math.PI) * 0.3 + Math.sin(h.t * 6 + i) * 0.02;
    p.setXYZ(i, q.x, q.y, q.z);
  }
  p.needsUpdate = true; h.pts.material.opacity = Math.min(1, (5 - h.t));
  if (h.t > 5) { fxRoot.remove(h.pts); h.pts.geometry.dispose(); hintFx = null; }
}

// ---------- お題リスト ----------
function listState() {
  if (!page) return null;
  return { title: page.title, time: page.time, hintsLeft: HINTS - page.hints, items: page.items, secretFound: page.secret.found, secretName: page.secret.name, cleared: page.cleared };
}
let listVisible = true;
// メモ：ふだんは1行に折りたたみ、ページの始めと見つけた直後だけ広がる。Tab（📜）で広げたままにできる
let memoPinned = false, memoOpenUntil = 0;
const openMemo = (sec) => { memoOpenUntil = performance.now() + sec * 1000; renderList(); };
function renderList() {
  const el = $('#list');
  el.classList.toggle('collapsed', !memoPinned && performance.now() > memoOpenUntil);
  if (!page) { el.innerHTML = '<div class="head"><span class="t">絵本の 部屋</span></div><div class="body"><div class="lead">書見台の 絵本を ひらいて、もくじから えらんでね。</div></div>'; el.classList.remove('collapsed'); el.hidden = !listVisible; draw3dList(); return; }
  const left = page.items.filter(i => !i.found).length;
  el.innerHTML = `<div class="head"><span class="t">${page.title.split('　')[0]}</span><span class="left">${page.cleared ? 'すべて 見つけた' : `あと ${kanjiNum(left)}つ`}</span><span class="time">${fmtTime(page.time)}</span></div>` +
    `<div class="body">${page.items.map(i => `<div class="it ${i.found ? 'done' : ''}">${i.name}</div>`).join('')}` +
    `<div class="sec ${page.secret.found ? 'done' : ''}">${page.secret.found ? `ひみつ：${page.secret.name}` : '＋ リストに ない ひみつ'}</div></div>`;
  el.hidden = !listVisible;
  draw3dList();
}
// 3Dリスト（Questは左手首、スマホVRは目の前）
const list3d = new Panel(0.3, 0.36, 900); noRay(list3d.mesh);
function draw3dList() {
  const st = listState();
  if (!st) list3d.draw((c, w, h) => drawList(c, w, h, { title: '絵本の 部屋', time: 0, hintsLeft: HINTS, items: [{ name: '書見台の 絵本を ひらこう', found: false }], secretFound: false }));
  else list3d.draw((c, w, h) => drawList(c, w, h, st));
}
let lastListSec = -1;

// ---------- トースト ----------
let toastTimer = null;
function toast(text, small = false, sub = '') {
  const el = $('#toast'); const line = small ? (sub || text) : sub;
  el.querySelector('.big').textContent = small ? '' : text; el.querySelector('.murmur').textContent = small && sub && text ? `${text}　${sub}` : line;
  el.classList.toggle('small', small); el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), small ? 3200 : 2000);
  if ((mode === 'xr' || mode === 'phonevr') && small) spawnFloater(small && sub && text ? text : line, camera.getWorldPosition(V()).add(camera.getWorldDirection(V()).multiplyScalar(1.4)).add(V(0, -0.25, 0)));
}

// ---------- ルーペ（The Room の接眼レンズ）：かざすと、ふだん見えない物が見える ----------
const lensRing = noRay(new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.01, 8, 64), new THREE.MeshBasicMaterial({ color: '#c9a458', depthTest: false, toneMapped: false })));
lensRing.position.z = -0.55; lensRing.renderOrder = 997; lensRing.visible = false; camera.add(lensRing);
function setLens(on) {
  game.lens = on; sfx.lens(on);
  $('#lens').hidden = !on || mode === 'xr' || mode === 'phonevr';
  renderer.domElement.style.filter = on && (mode === 'pc' || mode === 'phone') ? 'sepia(.25) saturate(1.15) contrast(1.05)' : '';
  lensRing.visible = on && (mode === 'xr' || mode === 'phonevr');
  if (on) toast('', true, 'ルーペを のぞく……');
}
const toggleLens = () => setLens(!game.lens);

// ---------- メニュー（HTML） ----------
function showMenu() {
  if (mode === 'xr' || mode === 'phonevr') { show3dMenu(); return; }
  const mp = $('#menu-pages'); mp.innerHTML = '';
  if (page) BOOKS[0].acts.forEach((a, n) => { const [act, name] = a.split('　'), b = document.createElement('button');
    b.innerHTML = `<span class="act">${act}</span>${name}${records[`${page.stageId}-${n + 1}`] ? '<span class="done">済</span>' : ''}`; b.onclick = () => startPage(page.stageId, n); mp.appendChild(b); });
  $('#menu').hidden = false;
}
function hideMenu() { $('#menu').hidden = true; }
$('#menu').addEventListener('click', e => {
  const a = e.target.dataset.menu; if (!a) return;
  if (a === 'resume') { hideMenu(); if (mode === 'pc') player.lock(); }
  if (a === 'hub') { goHub(); if (mode === 'pc') player.lock(); }
  if (a === 'quit') location.reload();
  if (a === 'settings') { hideMenu(); openSettings(true); }
});
let settingsFromMenu = false;
function openSettings(fromMenu = false) { settingsFromMenu = fromMenu === true; const v = getVolumes(); $('#vol-world').value = v.world; $('#vol-sfx').value = v.sfx; $('#vol-music').value = v.music; $('#settings').hidden = false; sfx.paper(); }
['world', 'sfx', 'music'].forEach(k => $(`#vol-${k}`).addEventListener('input', e => { setVolume(k, +e.target.value); if (k !== 'music') sfx.latch(); }));
document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => { $(`#${b.dataset.close}`).hidden = true; sfx.paper(); if (settingsFromMenu) showMenu(); });
$('#btn-settings').onclick = openSettings;

// ---------- メニュー（3D：Quest・スマホVR） ----------
let menu3d = null;
function show3dMenu() {
  hide3dMenu(); sfx.ui();
  menu3d = new THREE.Group();
  const btns = [['つづきを 読む', hide3dMenu]];
  if (page) BOOKS[0].acts.forEach((a, n) => btns.push([a.split('　')[1], () => startPage(page.stageId, n)]));
  btns.push(['絵本の 部屋へ', goHub]);
  btns.push([`えの こまかさ：${{ ultra: 'いちばん', high: 'こまかく', quest: 'ゴーグル', mid: 'ふつう', low: 'かるく' }[qualityName]}`, () => { setQuality({ ultra: 'high', high: 'quest', quest: 'mid', mid: 'low', low: 'high' }[qualityName]); reloadCurrent(); show3dMenu(); }]);
  btns.push([mode === 'xr' ? 'ゴーグルを はずす' : '表紙に もどる', () => { if (mode === 'xr') renderer.xr.getSession()?.end(); else location.reload(); }]);
  btns.forEach(([label, fn], i) => { const b = button3d(label, 0.42, 0.085, () => { sfx.ui(); fn(); }); b.position.set(0, 0.22 - i * 0.1, 0); menu3d.add(b); });
  const head = camera.getWorldPosition(V()), dir = camera.getWorldDirection(V()); dir.y = 0; dir.normalize();
  menu3d.position.copy(head).addScaledVector(dir, 1.1); menu3d.lookAt(head.x, menu3d.position.y, head.z);
  uiRoot.add(menu3d);
}
function hide3dMenu() { if (menu3d) { uiRoot.remove(menu3d); menu3d = null; } }

// ---------- スマホVR：足元の操作リング・照準 ----------
const reticle = makeReticle(); reticle.visible = false; camera.add(reticle);
const vignette = makeVignette(); vignette.visible = false; camera.add(vignette);
const footRing = new THREE.Group(); footRing.visible = false; uiRoot.add(footRing);
let goBtn, stopBtn, phoneListOn = false;
function buildFootRing() {
  const mk = (label, fn, a) => { const b = button3d(label, 0.28, 0.12, fn, { font: 0.45 }); const r = 0.68;
    b.position.set(Math.sin(a) * r, 0, -Math.cos(a) * r); b.lookAt(0, 0.9, 0); footRing.add(b); return b; };
  goBtn = mk('すすむ', () => { player.gazeMoving = true; goBtn.visible = false; stopBtn.visible = true; sfx.ui(); }, -1.0);
  stopBtn = mk('とまる', () => { player.gazeMoving = false; stopBtn.visible = false; goBtn.visible = true; sfx.ui(); }, -1.0); stopBtn.visible = false;
  mk('リスト', () => { phoneListOn = !phoneListOn; sfx.ui(); }, -0.5);
  mk('ルーペ', toggleLens, 0);
  mk('ヒント', useHint, 0.5);
  mk('メニュー', () => show3dMenu(), 1.0);
}
buildFootRing();
const gaze = { key: null, t: 0, fired: false };

// ---------- モード開始 ----------
function numberModes() { let k = 1; document.querySelectorAll('#modes li').forEach(li => { if (!li.hidden) li.querySelector('.num').textContent = kanjiNum(k++); }); }
numberModes();
$('#btn-ignite').onclick = async () => {
  initAudio(); sfx.match();
  try { await Promise.race([document.fonts.load('700 40px "Shippori Mincho B1"'), new Promise(r => setTimeout(r, 1500))]); } catch (e) {}
  $('#ignite').classList.add('lit');
  goHub(); hub.light();
  setTimeout(() => playTheme(), 1400);
  setTimeout(() => { $('#cover').hidden = false; requestAnimationFrame(() => $('#cover').classList.add('show')); }, 700);
  setTimeout(() => { $('#ignite').hidden = true; }, 1500);
};
$('#btn-pc').onclick = () => { initAudio(); sfx.paper(); mode = 'pc'; startGame(); player.lock(); };
$('#btn-phonevr').onclick = async () => {
  initAudio(); await player.requestOrientation();
  // 全画面・横向き固定・スリープ防止（対応していない端末では何もしない）
  Promise.resolve().then(() => document.documentElement.requestFullscreen?.()).then(() => screen.orientation?.lock?.('landscape')).catch(() => {});
  navigator.wakeLock?.request('screen').catch(() => {});
  mode = 'phonevr'; player.enterPhone(true); reticle.visible = true; startGame();
  setTimeout(() => player.recenter(current.spawn.yaw), 600);
};
$('#btn-phone').onclick = async () => {
  initAudio(); await player.requestOrientation();
  navigator.wakeLock?.request('screen').catch(() => {});
  mode = 'phone'; player.enterPhone(false); startGame();
  $('#touch').hidden = false; $('#phonebtns').hidden = false; $('#crosshair').hidden = true;
  setTimeout(() => player.recenter(current.spawn.yaw), 600);
};
if (navigator.xr) navigator.xr.isSessionSupported('immersive-vr').then(ok => {
  if (ok) { $('#li-xr').hidden = false; numberModes(); }
  else if (isQuest) $('#xr-note').textContent = 'ゴーグルで ひらくには、https の ページで ひらいてね。';
}).catch(() => {});
$('#btn-xr').onclick = async () => {
  initAudio();
  try {
    const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor'] });
    renderer.xr.setFramebufferScaleFactor(QUALITY[qualityName].lite ? 0.85 : 1);   // 描く解像度を少し下げて72fpsを保つ
    await renderer.xr.setSession(session);
    renderer.xr.setFoveation(1);   // 視野の端を粗く描く（Questの固定中心窩レンダリング）
    mode = 'xr'; player.enterXR(); startGame();
    session.addEventListener('end', () => { player.exitXR(); mode = 'pc'; $('#hud').hidden = false; hide3dMenu(); toast('', true, 'ゴーグルを はずしたね。画面を おすと、つづきから。'); });
  } catch (e) { $('#xr-note').textContent = 'ゴーグルで ひらけなかった……（' + e.message + '）'; }
};
function startGame() {
  $('#start').hidden = true; $('#settings').hidden = true;
  $('#hud').hidden = mode === 'xr' || mode === 'phonevr';
  $('#lockmsg').hidden = mode !== 'pc';
  if (!current) goHub(); else { const p = current.spawn; player.placeAt(p.pos, p.yaw); }
}

// ---------- 入力のつなぎこみ ----------
player.onSelect = (via) => {
  if (mode === 'pc' && !$('#menu').hidden) return;
  activate(pick(), via);
};
player.onButton = (b) => {
  if (b === 'hint') useHint();
  if (b === 'lens') toggleLens();
  if (b === 'list') { listVisible = !listVisible; renderList(); }
  if (b === 'menu') menu3d ? hide3dMenu() : show3dMenu();
};
player.onLockChange = (locked) => {
  if (mode !== 'pc') return;
  $('#lockmsg').hidden = locked;
  if (!locked && current) showMenu(); else hideMenu();
};
addEventListener('keydown', e => {
  if (mode !== 'pc') return;
  if (e.code === 'Escape' && player.fallback && player.locked) { player.unlockFallback(); return; }
  if (e.code === 'KeyH') useHint();
  if (e.code === 'KeyL') toggleLens();
  if (e.code === 'Tab') { memoPinned = !memoPinned; renderList(); }
  if (e.code === 'KeyE' && player.locked) activate(pick(), 'gimmick');
});
// スマホ手持ち：スティック・上下ボタン・タップ・ドラッグ
(() => {
  const joy = $('#joy'), knob = $('#knob'); let jid = null, jc = null;
  joy.addEventListener('pointerdown', e => { jid = e.pointerId; const r = joy.getBoundingClientRect(); jc = [r.left + r.width / 2, r.top + r.height / 2]; joy.setPointerCapture(jid); move(e); });
  const move = e => { if (e.pointerId !== jid) return; let dx = e.clientX - jc[0], dy = e.clientY - jc[1]; const l = Math.hypot(dx, dy), m = 50; if (l > m) { dx *= m / l; dy *= m / l; }
    knob.style.transform = `translate(${dx}px,${dy}px)`; player.touch.x = dx / m; player.touch.z = -dy / m; };
  const end = e => { if (e.pointerId !== jid) return; jid = null; knob.style.transform = ''; player.touch.x = player.touch.z = 0; };
  joy.addEventListener('pointermove', move); joy.addEventListener('pointerup', end); joy.addEventListener('pointercancel', end);
  const hold = (el, v) => { el.addEventListener('pointerdown', () => player.touch.y = v); ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => el.addEventListener(t, () => player.touch.y = 0)); };
  hold($('#btn-up'), 1); hold($('#btn-down'), -1);
  const cv = renderer.domElement; let down = null, last = null;
  cv.addEventListener('pointerdown', e => { if (mode !== 'phone') return; down = [e.clientX, e.clientY, performance.now()]; last = [e.clientX, e.clientY]; });
  cv.addEventListener('pointermove', e => { if (mode !== 'phone' || !down) return;
    player.dragYaw -= (e.clientX - last[0]) * 0.005; if (!player.orient) player.dragPitch = THREE.MathUtils.clamp(player.dragPitch - (e.clientY - last[1]) * 0.005, -1.4, 1.4);
    last = [e.clientX, e.clientY]; });
  cv.addEventListener('pointerup', e => { if (mode !== 'phone' || !down) return;
    if (Math.hypot(e.clientX - down[0], e.clientY - down[1]) < 10 && performance.now() - down[2] < 400)
      activate(pick(new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1)));
    down = null; });
  $('#phonebtns').addEventListener('click', e => { const a = e.target.dataset.act;
    if (a === 'list') { memoPinned = !memoPinned; renderList(); } if (a === 'hint') useHint(); if (a === 'lens') toggleLens(); if (a === 'menu') showMenu(); });
})();

addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); stereo.setSize(innerWidth, innerHeight); resizeComposer(); });

window.__mikke = { game, player, pick, activate, startPage, goHub, useHint, get page() { return page; }, get stage() { return stage; }, camera, renderer };

// ---------- 毎フレーム ----------
const clock = new THREE.Clock();
let perfAcc = 0, perfN = 0, perfT = 0;
const camDir = V();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  const frozen = performance.now() < freezeUntil;
  updateFade(dt);
  if (!mode && current === hub) camera.rotation.set(-0.3 + Math.sin(t * 0.37) * 0.012, -0.28 + Math.sin(t * 0.21) * 0.03, 0);   // 本が左寄りに見えるように
  if (!frozen && mode && (mode !== 'pc' || player.locked)) player.update(dt);
  if (!frozen) current?.update(dt, t, camera);
  updateBursts(dt);
  updateListener(camera);

  if (page && !page.cleared && mode) { page.time += dt; const s = Math.floor(page.time); if (s !== lastListSec) { lastListSec = s; renderList(); } }

  // 見つけたアイテムが手元へ飛んでくる
  const head = camera.getWorldPosition(V());
  for (let i = flying.length - 1; i >= 0; i--) {
    const f = flying[i]; if (frozen) continue; f.t += dt / 0.7; const k = Math.max(0, Math.min(1, f.t));
    const glow = f.t < 0 ? 1 + f.t / 0.35 : 1 - k; f.obj.traverse(o => { if (o.userData.glow) o.material.emissiveIntensity = Math.max(0, glow) * 2.2; });   // 内側から光る
    if (f.t < 0) { f.obj.scale.setScalar(f.s * (1 + Math.sin((f.t + 0.35) / 0.35 * Math.PI) * 0.25)); continue; }
    const to = head.clone().add(camera.getWorldDirection(V()).multiplyScalar(0.35));
    f.obj.position.lerpVectors(f.from, to, k * k); f.obj.scale.setScalar(f.s * (1 - k * 0.8)); f.obj.rotation.y += dt * 8;
    if (k >= 1) { scene.remove(f.obj); flying.splice(i, 1); }
  }
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i]; f.t += dt; f.s.position.y = f.y + f.t * 0.25; f.s.material.opacity = Math.max(0, 1 - f.t / 1.8);
    if (f.t > 1.8) { fxRoot.remove(f.s); f.s.material.map.dispose(); floaters.splice(i, 1); }
  }
  updateHint(dt);

  // Quest：レーザー・手首リスト
  if (mode === 'xr') {
    const hit = pick(); player.showLaser(hit?.point, hit?.distance);
    hoverUi(hit);
    const L = player.left;
    if (L) {
      if (list3d.mesh.parent !== L.grip) { L.grip.add(list3d.mesh); list3d.mesh.position.set(0, 0.06, 0.12); list3d.mesh.rotation.set(-Math.PI / 2.2, 0, 0); list3d.mesh.scale.setScalar(0.8); }
      const n = V(0, 0, 1).applyQuaternion(list3d.mesh.getWorldQuaternion(new THREE.Quaternion()));
      const toHead = head.clone().sub(list3d.mesh.getWorldPosition(V())).normalize();
      list3d.mesh.visible = listVisible && n.dot(toHead) > 0.35;
    }
  }
  // スマホVR：見つめる操作
  if (mode === 'phonevr') updateGaze(dt, head);
  else { footRing.visible = false; vignette.visible = false; if (mode !== 'xr' && list3d.mesh.parent) list3d.mesh.parent.remove(list3d.mesh); }

  // 描画
  if (mode === 'phonevr') stereo.render(scene, camera); else if (usePost()) getComposer().render(dt); else renderer.render(scene, camera);

  // 重いときは自動で解像度を下げる（XR以外）
  if (mode && mode !== 'xr') { perfAcc += dt; perfN++; perfT += dt;
    if (perfT > 4) { const avg = perfAcc / perfN; if (avg > 1 / 38 && renderer.getPixelRatio() > 0.8) { renderer.setPixelRatio(renderer.getPixelRatio() * 0.8); resizeComposer(); } perfAcc = perfN = perfT = 0; } }
});

let hovered = null;
function hoverUi(hit) {
  const o = hit?.object?.userData?.setHover ? hit.object : null;
  if (o !== hovered) { hovered?.userData.setHover?.(false); o?.userData.setHover(true); hovered = o; }
}

function updateGaze(dt, head) {
  camera.getWorldDirection(camDir);
  const pitch = Math.asin(THREE.MathUtils.clamp(camDir.y, -1, 1));
  // 足元を見ると操作リングが出る
  const ringOn = pitch < -0.6;
  if (ringOn && !footRing.visible) { const yaw = Math.atan2(-camDir.x, -camDir.z); footRing.rotation.set(0, yaw, 0); }
  footRing.visible = ringOn;
  footRing.position.set(head.x, head.y - 1.05, head.z);
  // リスト（目の前に浮かぶ）
  if (phoneListOn) {
    if (list3d.mesh.parent !== uiRoot) uiRoot.add(list3d.mesh);
    const flat = V(camDir.x, 0, camDir.z).normalize(), want = head.clone().addScaledVector(flat, 0.9).add(V(0, -0.1, 0));
    list3d.mesh.position.lerp(want, 1 - Math.exp(-dt * 3)); list3d.mesh.lookAt(head); list3d.mesh.visible = true; list3d.mesh.scale.setScalar(1);
  } else if (list3d.mesh.parent) list3d.mesh.parent.remove(list3d.mesh);
  vignette.visible = player.moving; vignette.material.opacity = player.moving ? 0.55 : 0;

  // 見つめてゲージをためる
  const hit = pick();
  const r = hit ? resolve(hit.object) : null;
  const key = r ? r.obj : (hit ? hit.object.uuid + ':' + hit.instanceId : null);
  hoverUi(hit);
  if (key !== gaze.key) { gaze.key = key; gaze.t = 0; gaze.fired = false; }
  else if (hit && !gaze.fired) {
    gaze.t += dt;
    const need = r?.data?.dwell ?? 1.5;
    if (gaze.t >= need) {
      gaze.fired = true; activate(hit);
      if (r?.type === 'interact' && r.data.kind === 'play') setTimeout(() => { if (gaze.key === key) { gaze.t = 0; gaze.fired = false; } }, 700);
    }
  }
  const need = r?.data?.dwell ?? 1.5;
  const prog = gaze.fired || !hit ? 0 : Math.round(Math.min(1, gaze.t / need) * 40) / 40;
  if (prog !== gaze.prog) { gaze.prog = prog; reticle.userData.setProgress(prog); }
  const d = THREE.MathUtils.clamp(hit ? hit.distance : 3, 0.35, 4);
  reticle.position.set(0, 0, -d); reticle.scale.setScalar(d);
}
