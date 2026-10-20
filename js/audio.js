// 音：Web Audio でその場で合成（音源ファイル不要）。BGMだけ audio/ フォルダのファイルを読み込む
// 方針（docs/title-and-sound-gemini.md）：
//  ・全部の音を「古い木造の屋根裏」の残響（自作インパルス応答）に通す
//  ・物音はサイン波ではなく、ノイズをフィルターで削り出して作る（紙・木・真鍮）
//  ・鳴らすたびに、フィルター・音量・立ち上がり・音程を少しずつ揺らす（同じ音が二度と鳴らない）
//  ・音階は D マイナー・ペンタトニック。わずかに音程を狂わせて、骨董のオルゴールらしく
import * as THREE from 'three';

let ctx = null, master, reverb, buses = {}, noiseBuf, pinkBuf, brownBuf;
const listenerPos = new THREE.Vector3(), fwd = new THREE.Vector3(), up = new THREE.Vector3();
const VOL_KEY = 'mikke-volume-v1';
const vols = Object.assign({ world: 0.8, sfx: 0.85, music: 0.7 }, (() => { try { return JSON.parse(localStorage.getItem(VOL_KEY) || '{}'); } catch (e) { return {}; } })());

// ---------- 揺らぎ ----------
const rnd = (a, b) => a + Math.random() * (b - a);
const vary = (v, pct) => v * (1 + rnd(-pct, pct));             // ±pct
const db = (d) => Math.pow(10, d / 20);
const jitterDb = (g, d = 2.5) => g * db(rnd(-d, d));           // 音量 ±2.5dB

// ---------- 音階：D マイナー・ペンタトニック（D F G A C） ----------
const PENTA = [0, 3, 5, 7, 10];
export function pentaFreq(i, base = 587.33) { // base = D5
  const oct = Math.floor(i / 5), deg = PENTA[((i % 5) + 5) % 5];
  return base * Math.pow(2, oct + deg / 12);
}

// ---------- 起動 ----------
function makeNoise(kind) {
  const len = ctx.sampleRate * 3, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (kind === 'white') d[i] = w;
    else if (kind === 'pink') { b0 = 0.997 * b0 + w * 0.029591; b1 = 0.985 * b1 + w * 0.032534; b2 = 0.95 * b2 + w * 0.048056; d[i] = (b0 + b1 + b2 + w * 0.05) * 2.2; }
    else { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }   // ブラウン（1/f²）
  }
  return b;
}
// 古い木造の部屋の残響：2.2秒、指数減衰（^3.5）、木が高い音を吸う（2500Hzローパス相当）
function makeImpulse(seconds = 2.2) {
  const rate = ctx.sampleRate, len = Math.floor(rate * seconds), ir = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch); let lp = 0; const a = Math.exp(-2 * Math.PI * 2500 / rate);
    for (let i = 0; i < len; i++) { const t = i / len, w = (Math.random() * 2 - 1) * Math.pow(1 - t, 3.5); lp = lp * a + w * (1 - a); d[i] = lp * (i < rate * 0.012 ? i / (rate * 0.012) : 1); }
  }
  return ir;
}
export function initAudio() {
  if (ctx) { ctx.resume(); return; }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain(); master.gain.value = 0.95;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.25;
  master.connect(comp); comp.connect(ctx.destination);
  reverb = ctx.createConvolver(); reverb.buffer = makeImpulse(2.2); const rvOut = ctx.createGain(); rvOut.gain.value = 0.9; reverb.connect(rvOut); rvOut.connect(master);
  // バス：world（環境音）・sfx（物音）・ui（発見音）・music（音楽）。それぞれ残響へ送る量が違う
  const wet = { world: 0.6, sfx: 0.35, ui: 0.5, music: 0.45, shimmer: 0.95 };
  for (const name of Object.keys(wet)) {
    const g = ctx.createGain(), send = ctx.createGain(); send.gain.value = wet[name];
    g.connect(master); g.connect(send); send.connect(reverb); buses[name] = g;
  }
  noiseBuf = makeNoise('white'); pinkBuf = makeNoise('pink'); brownBuf = makeNoise('brown');
  applyVolumes();
}
export const audioReady = () => !!ctx;
function applyVolumes() {
  if (!ctx) return;
  buses.world.gain.value = vols.world; buses.sfx.gain.value = vols.sfx; buses.ui.gain.value = vols.sfx; buses.shimmer.gain.value = vols.sfx * 0.6;
  buses.music.gain.value = vols.music;
}
export function getVolumes() { return { ...vols }; }
export function setVolume(name, v) { vols[name] = v; try { localStorage.setItem(VOL_KEY, JSON.stringify(vols)); } catch (e) {} applyVolumes(); }

export function updateListener(camera) {
  if (!ctx) return;
  camera.getWorldPosition(listenerPos); camera.getWorldDirection(fwd);
  up.set(0, 1, 0).applyQuaternion(camera.getWorldQuaternion(new THREE.Quaternion()));
  const L = ctx.listener, t = ctx.currentTime;
  if (L.positionX) {
    L.positionX.setValueAtTime(listenerPos.x, t); L.positionY.setValueAtTime(listenerPos.y, t); L.positionZ.setValueAtTime(listenerPos.z, t);
    L.forwardX.setValueAtTime(fwd.x, t); L.forwardY.setValueAtTime(fwd.y, t); L.forwardZ.setValueAtTime(fwd.z, t);
    L.upX.setValueAtTime(up.x, t); L.upY.setValueAtTime(up.y, t); L.upZ.setValueAtTime(up.z, t);
  } else { L.setPosition(listenerPos.x, listenerPos.y, listenerPos.z); L.setOrientation(fwd.x, fwd.y, fwd.z, up.x, up.y, up.z); }
}

// ---------- 部品 ----------
function out(pos, bus = 'sfx') {
  const b = buses[bus] || buses.sfx; if (!pos) return b;
  const p = ctx.createPanner(); p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = 0.8; p.rolloffFactor = 1.1;
  if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z; } else p.setPosition(pos.x, pos.y, pos.z);
  p.connect(b); return p;
}
function env(g, t, a, peak, dec) {
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
}
// 音の芯：2つの音を±セントずらして重ね、うねりを出す
function tone(freq, { type = 'sine', a = 0.005, dec = 1, peak = 0.3, pos, when = 0, detune = 0, bus = 'sfx', cents = 8, lp = 0, pair = 0 } = {}) {
  const t = ctx.currentTime + when + rnd(0, 0.004), g = ctx.createGain(); let node = g;
  if (lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = vary(lp, 0.1); g.connect(f); node = f; }
  const make = (dt) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq; o.detune.value = detune + dt; o.connect(g); o.start(t); o.stop(t + a + dec + 0.05); };
  make(rnd(-cents, cents)); if (pair) make(pair);
  env(g, t, Math.max(0.002, vary(a, 0.15)), jitterDb(peak), vary(dec, 0.08)); node.connect(out(pos, bus));
}
function noise({ dec = 0.5, peak = 0.3, type = 'highpass', freq = 4000, q = 0.7, pos, when = 0, a = 0.003, buf = 'white', bus = 'sfx', sweep = 0 } = {}) {
  const t = ctx.currentTime + when, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = buf === 'pink' ? pinkBuf : buf === 'brown' ? brownBuf : noiseBuf; s.loop = true;
  f.type = type; f.frequency.setValueAtTime(vary(freq, 0.15), t); if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, vary(freq, 0.15) * sweep), t + a + dec); f.Q.value = q;
  env(g, t, Math.max(0.002, a + rnd(-0.015, 0.015) * (a > 0.02 ? 1 : 0)), jitterDb(peak), vary(dec, 0.1));
  s.connect(f); f.connect(g); g.connect(out(pos, bus)); s.start(t, Math.random() * 2); s.stop(t + a + dec + 0.1);
}
// 低く落ちる「ドン・コトッ」（木の重み）
function thumpAt(pos, when = 0, peak = 0.35, bus = 'sfx') {
  const t = ctx.currentTime + when, o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.setValueAtTime(vary(110, 0.1), t); o.frequency.exponentialRampToValueAtTime(45, t + 0.08);
  env(g, t, 0.002, jitterDb(peak), 0.22); o.connect(g); g.connect(out(pos, bus)); o.start(t); o.stop(t + 0.35);
  noise({ dec: 0.05, peak: peak * 0.4, type: 'lowpass', freq: 900, pos, when, bus });
}
// 真鍮：1 : 2.76 : 5.4 の金属の倍音
function brassAt(freq, pos, when = 0, peak = 0.12, dec = 1.2, bus = 'sfx') {
  [[1, 1], [2.76, 0.5], [5.4, 0.25]].forEach(([r, k]) => tone(freq * r, { dec: dec / r * 1.3, peak: peak * k, pos, when, bus, cents: 3 }));
  noise({ dec: 0.012, peak: peak * 0.6, type: 'bandpass', freq: freq * 6, q: 2, pos, when, bus });
}
// カリンバ／オルゴールの爪弾き：三角波＋2倍音15%＋最初の15msの「爪の音」
function pluck(freq, { pos, when = 0, peak = 0.16, dec = 1.6, bus = 'ui' } = {}) {
  tone(freq, { type: 'triangle', dec, peak, pos, when, bus, cents: 8, lp: 3800 });
  tone(freq * 2, { dec: dec * 0.6, peak: peak * 0.15, pos, when, bus, cents: 8 });
  noise({ dec: 0.015, peak: peak * 0.5, type: 'highpass', freq: 5200, pos, when, bus });
}

// ---------- 楽器 ----------
export const sfx = {
  piano(midi, pos) { if (!ctx) return; const f = 440 * Math.pow(2, (midi - 69) / 12), dec = 1.4 + (108 - midi) / 28;
    tone(f, { type: 'triangle', a: 0.004, dec, peak: 0.2, pos, cents: 4, pair: rnd(5, 8), lp: 2600 }); tone(f * 2, { a: 0.004, dec: dec * 0.55, peak: 0.06, pos, cents: 4 });
    tone(f * 3.01, { a: 0.003, dec: dec * 0.25, peak: 0.025, pos }); thumpAt(pos, 0, 0.04); noise({ dec: 0.03, peak: 0.03, type: 'bandpass', freq: Math.min(6000, f * 4), q: 1, pos }); },
  toyPiano(i, pos) { if (!ctx) return; const f = pentaFreq(i, 293.66); brassAt(f * 2, pos, 0, 0.06, 0.8); tone(f, { type: 'triangle', dec: 1.1, peak: 0.2, pos, lp: 3000 }); },
  xylophone(i, pos) { if (!ctx) return; const f = pentaFreq(i, 587.33);
    tone(f, { dec: 0.45, peak: 0.3, pos, cents: 5 }); tone(f * 3.93, { dec: 0.1, peak: 0.08, pos }); thumpAt(pos, 0, 0.05); noise({ dec: 0.02, peak: 0.06, type: 'bandpass', freq: 2200, pos }); },
  musicBoxNote(i, pos, when = 0, vol = 1) { if (!ctx) return; pluck(pentaFreq(i, 1174.66), { pos, when: when + rnd(0.02, 0.14) * (when > 0 ? 1 : 0), peak: 0.13 * vol, dec: 1.8, bus: pos ? 'sfx' : 'music' }); },
  cymbal(pos, when = 0) { if (!ctx) return; noise({ dec: 1.2, peak: 0.2, freq: 6000, pos, when }); brassAt(420, pos, when, 0.05, 1.4); },
  drum(pos) { if (!ctx) return; thumpAt(pos, 0, 0.6); noise({ dec: 0.12, peak: 0.12, type: 'lowpass', freq: 1200, pos, buf: 'pink' }); },
  boxCreak(pos, open = true) { if (!ctx) return; sfx.creak(pos); thumpAt(pos, open ? 0.55 : 0.5, 0.25); },
  spring(pos) { if (!ctx) return; const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(700, t + 0.12); o.frequency.exponentialRampToValueAtTime(220, t + 0.6);
    f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 3; env(g, t, 0.004, 0.15, 0.6); o.connect(f); f.connect(g); g.connect(out(pos)); o.start(t); o.stop(t + 0.7); thumpAt(pos, 0, 0.2); },
  click(pos) { if (!ctx) return; noise({ dec: 0.025, peak: 0.18, type: 'bandpass', freq: 2600, q: 3, pos }); thumpAt(pos, 0, 0.05); },
  // ---------- 発見 ----------
  mikke(pos) { sfx.mikkeCombo(0, pos); },
  mikkeCombo(level, pos) { if (!ctx) return; const base = Math.min(level, 6) * 2, pats = [[0, 2, 4, 7], [0, 4, 5, 7], [0, 2, 5, 9], [2, 4, 7, 9]], pat = pats[Math.floor(Math.random() * pats.length)];
    thumpAt(null, 0, 0.3, 'ui');                                                              // 0.1秒の「ドン」（ヒットストップと合わせる）
    pat.forEach((n, k) => pluck(pentaFreq(n + base + 2, 587.33), { when: 0.1 + k * rnd(0.07, 0.1), peak: 0.15, dec: 1.6 }));
    tone(pentaFreq(base + 2, 293.66), { dec: 2.4, peak: 0.05, when: 0.1, bus: 'shimmer', cents: 6, pair: 7 }); },
  secret() { if (!ctx) return; [0, 4, 7, 9, 12, 14].forEach((n, k) => { pluck(pentaFreq(n, 587.33), { when: k * rnd(0.11, 0.16), peak: 0.13, dec: 2.4 }); });
    tone(146.83, { dec: 4, peak: 0.08, bus: 'shimmer', cents: 6, pair: 9, a: 0.4 }); },
  clear() { if (!ctx) return; [0, 2, 4, 7, 4, 7, 9, 12].forEach((n, k) => sfx.musicBoxNote(n, null, k * 0.2, 1.4)); tone(146.83, { dec: 5, peak: 0.07, bus: 'shimmer', a: 0.6, pair: 6 }); },
  hint() { if (!ctx) return; noise({ dec: 0.9, peak: 0.06, type: 'bandpass', freq: 3000, q: 0.6, buf: 'pink', a: 0.3, sweep: 0.4, bus: 'shimmer' }); for (let k = 0; k < 5; k++) pluck(pentaFreq(12 - k, 587.33), { when: 0.4 + k * 0.09, peak: 0.05, dec: 1 }); },
  // ---------- UI（紙・木・真鍮の物音） ----------
  ui() { if (!ctx) return; sfx.paper(null, 0.5); },
  paper(pos, vol = 1) { if (!ctx) return; noise({ a: 0.15, dec: 0.2, peak: 0.1 * vol, type: 'bandpass', freq: 1200, q: 1.5, buf: 'pink', pos, bus: pos ? 'sfx' : 'ui' }); },
  book() { if (!ctx) return; sfx.latch(); noise({ a: 0.3, dec: 0.5, peak: 0.12, type: 'bandpass', freq: 900, q: 1.2, buf: 'pink', when: 0.2 }); thumpAt(null, 0.85, 0.3, 'ui'); },
  latch(pos) { if (!ctx) return; brassAt(2400, pos, 0, 0.06, 0.25, pos ? 'sfx' : 'ui'); },
  match() { if (!ctx) return; noise({ a: 0.02, dec: 0.25, peak: 0.25, type: 'bandpass', freq: 3000, q: 0.8, sweep: 0.6, bus: 'ui' }); noise({ a: 0.08, dec: 0.9, peak: 0.12, type: 'lowpass', freq: 600, buf: 'brown', when: 0.18, bus: 'ui' }); },
  blowOut() { if (!ctx) return; noise({ a: 0.05, dec: 0.45, peak: 0.12, type: 'bandpass', freq: 800, q: 0.5, buf: 'pink', sweep: 0.5, bus: 'ui' }); },
  tick(pos, high) { if (!ctx) return; noise({ dec: 0.018, peak: 0.05, type: 'bandpass', freq: high ? 3200 : 2700, q: 6, pos }); },
  // ---------- 3Dならではの演出 ----------
  whistle(when = 0) { if (!ctx) return; const t = ctx.currentTime + when, g = ctx.createGain(), f = ctx.createBiquadFilter();
    [740, 932].forEach(fr => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(fr, t); o.frequency.linearRampToValueAtTime(fr * 0.81, t + 2.2); o.connect(f); o.start(t); o.stop(t + 2.5); });   // 通り過ぎると音が下がる
    f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 1.5; env(g, t, 0.15, 0.08, 2.2); f.connect(g); g.connect(buses.sfx);
    noise({ a: 0.2, dec: 2, peak: 0.05, type: 'bandpass', freq: 2000, q: 0.7, when }); },
  chug(n = 10, pos) { if (!ctx) return; for (let i = 0; i < n; i++) noise({ dec: 0.12, peak: 0.12 * (1 - Math.abs(i - n / 2) / n), type: 'lowpass', freq: 500, buf: 'pink', pos, when: i * rnd(0.2, 0.24) }); },
  groan(pos) { if (!ctx) return; for (let i = 0; i < 9; i++) noise({ a: 0.02, dec: 0.12, peak: 0.08, type: 'bandpass', freq: vary(380, 0.2), q: 8, pos, when: i * rnd(0.18, 0.3) }); thumpAt(pos, 2.4, 0.2); },
  creak(pos) { if (!ctx) return; const n = 3 + Math.floor(Math.random() * 4); for (let i = 0; i < n; i++) noise({ a: 0.01, dec: 0.06, peak: 0.07, type: 'bandpass', freq: vary(400, 0.25), q: 9, pos, when: i * rnd(0.06, 0.14), bus: 'world' }); },
  steps(pos, n = 3) { if (!ctx) return; for (let i = 0; i < n; i++) thumpAt(pos, i * rnd(0.6, 0.8), 0.12, 'world'); },
  projector(pos) { if (!ctx) return; for (let i = 0; i < 18; i++) noise({ dec: 0.025, peak: 0.035, type: 'bandpass', freq: 2200, q: 4, pos, when: i * 0.085 }); },
  shimmer() { if (!ctx) return; for (let k = 0; k < 10; k++) pluck(pentaFreq(10 + (k * 3) % 7, 1174.66), { when: k * rnd(0.07, 0.12), peak: 0.03, dec: 1.4, bus: 'shimmer' }); },
  pages(pos) { if (!ctx) return; for (let i = 0; i < 12; i++) noise({ a: 0.02, dec: 0.05, peak: 0.06, type: 'bandpass', freq: 1800, q: 1, buf: 'pink', pos, when: i * rnd(0.04, 0.07) }); },
  wave(pos) { if (!ctx) return; noise({ a: 0.3, dec: 1.6, peak: 0.22, type: 'lowpass', freq: 1200, buf: 'pink', pos, sweep: 0.5 }); noise({ a: 0.1, dec: 0.9, peak: 0.1, type: 'highpass', freq: 3000, pos, when: 0.3 }); },
  lens(on) { if (!ctx) return; brassAt(1800, null, 0, 0.05, 0.3, 'ui'); if (on) noise({ a: 0.2, dec: 0.6, peak: 0.03, type: 'bandpass', freq: 4000, q: 1, bus: 'shimmer', when: 0.05 }); },
};

// ---------- 環境音（部屋の空気）とBGM ----------
let ambNodes = [], bgmSrc = null, ambTimer = null;
export function stopAmbience() {
  ambNodes.forEach(n => { try { n.stop(); } catch (e) {} }); ambNodes = [];
  if (ambTimer) clearTimeout(ambTimer); ambTimer = null;
  if (bgmSrc) { try { bgmSrc.stop(); } catch (e) {} bgmSrc = null; }
  stopTheme();
}
// ブラウンノイズ → ローパス（180〜320Hz, Q4）を 0.08Hz でゆっくり揺らす ＝ 隙間風の息づかい
export function startAmbience({ roomTone = 0.03, lowpass = 260, events = [] } = {}) {
  if (!ctx) return; stopAmbience();
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), lfoG = ctx.createGain();
  s.buffer = brownBuf; s.loop = true; f.type = 'lowpass'; f.frequency.value = lowpass; f.Q.value = 4; g.gain.value = Math.min(0.06, roomTone * 1.2);
  lfo.frequency.value = 0.08; lfoG.gain.value = 70; lfo.connect(lfoG); lfoG.connect(f.frequency);
  s.connect(f); f.connect(g); g.connect(buses.world); s.start(); lfo.start(); ambNodes.push(s, lfo);
  const next = () => { ambTimer = setTimeout(() => { if (events.length) events[Math.floor(Math.random() * events.length)](); next(); }, rnd(15000, 40000)); };   // 15〜40秒に1回
  next();
}
const somewhere = () => new THREE.Vector3(rnd(-3, 3), rnd(1.5, 4.5), rnd(-3, 3));
export const ambientEvents = {
  creak: () => sfx.creak(somewhere()),
  chime: () => pluck(pentaFreq(Math.floor(rnd(5, 12)), 1174.66), { pos: somewhere(), peak: 0.02, dec: 2.5, bus: 'world' }),
};

// ---------- タイトルの主題（少し調子の外れた古いオルゴール） ----------
// LIMBO方式：表＝±6セントずらした2音のうねり（1800Hzのローパス）、裏＝1オクターブ下を深い残響だけで鳴らす影
const THEME = [[4, 1], [5, 0.5], [4, 0.5], [2, 1], [0, 1], [2, 0.5], [4, 1.5], [-1, 1], [7, 1], [5, 0.5], [4, 0.5], [2, 1], [4, 1], [0, 1], [-1, 2], [-1, 1]];
let themeTimer = null, themeOn = false;
export function playTheme(loop = true) {
  if (!ctx || themeOn) return; themeOn = true;
  const play = () => {
    if (!themeOn) return; let w = 0.2;
    THEME.forEach(([n, len]) => {
      if (n >= 0) {
        const f = pentaFreq(n, 1174.66);
        tone(f, { type: 'triangle', dec: 2.2, peak: 0.09, when: w, bus: 'music', cents: 2, pair: 6, detune: -6, lp: 1800 });
        noise({ dec: 0.012, peak: 0.04, type: 'highpass', freq: 5200, when: w, bus: 'music' });
        tone(f / 2, { a: 1.5, dec: 4, peak: 0.025, when: w, bus: 'shimmer', cents: 6 });
      }
      w += len * 0.42 + rnd(0.02, 0.14);   // 1音ごとの「ため」（ゼンマイの緩み）
    });
    if (loop) themeTimer = setTimeout(play, (w + 3) * 1000);
  };
  play();
}
export function stopTheme() { themeOn = false; if (themeTimer) clearTimeout(themeTimer); themeTimer = null; }

// BGM：audio/bgm_<name>.mp3 があれば流す（なければ静かに何もしない）
const bgmCache = {};
export async function playBgm(name) {
  if (!ctx) return;
  try {
    if (!(name in bgmCache)) {
      bgmCache[name] = null;
      for (const ext of ['mp3', 'ogg', 'm4a', 'wav']) {
        const r = await fetch(`audio/bgm_${name}.${ext}`, { method: 'HEAD' });
        if (r.ok) { const r2 = await fetch(`audio/bgm_${name}.${ext}`); bgmCache[name] = await ctx.decodeAudioData(await r2.arrayBuffer()); break; }
      }
    }
    const buf = bgmCache[name]; if (!buf) return false;
    if (bgmSrc) { try { bgmSrc.stop(); } catch (e) {} }
    bgmSrc = ctx.createBufferSource(); bgmSrc.buffer = buf; bgmSrc.loop = true; bgmSrc.connect(buses.music); bgmSrc.start();
    return true;
  } catch (e) { return false; }
}
