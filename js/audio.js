// 音：Web Audio でその場で合成（音源ファイル不要）。BGMだけ audio/ フォルダのファイルを読み込む
import * as THREE from 'three';

let ctx = null, master, sfxBus, bgmBus, ambBus, noiseBuf;
const listenerPos = new THREE.Vector3(), fwd = new THREE.Vector3(), up = new THREE.Vector3();

// ペンタトニック（ドレミソラ）。どこを叩いても濁りにくい
const PENTA = [0, 2, 4, 7, 9];
export function pentaFreq(i, base = 523.25) { // base = C5
  const oct = Math.floor(i / 5), deg = PENTA[((i % 5) + 5) % 5];
  return base * Math.pow(2, oct + deg / 12);
}

export function initAudio() {
  if (ctx) { ctx.resume(); return; }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
  sfxBus = ctx.createGain(); sfxBus.connect(master);
  bgmBus = ctx.createGain(); bgmBus.gain.value = 0.45; bgmBus.connect(master);
  ambBus = ctx.createGain(); ambBus.gain.value = 1; ambBus.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}
export const audioReady = () => !!ctx;

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

// 出力先：位置があれば立体音響
function out(pos, bus = sfxBus) {
  if (!pos) return bus;
  const p = ctx.createPanner(); p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = 0.8; p.rolloffFactor = 1.2;
  if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z; } else p.setPosition(pos.x, pos.y, pos.z);
  p.connect(bus); return p;
}
function env(g, t, a, peak, dec, sustain = 0.0001) {
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(sustain, t + a + dec);
}
function tone(freq, { type = 'sine', a = 0.005, dec = 1, peak = 0.3, pos, when = 0, detune = 0, dest } = {}) {
  const t = ctx.currentTime + when, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = freq; o.detune.value = detune;
  env(g, t, a, peak, dec); o.connect(g); g.connect(dest || out(pos)); o.start(t); o.stop(t + a + dec + 0.05);
}
function noise({ dec = 0.5, peak = 0.3, type = 'highpass', freq = 4000, q = 0.7, pos, when = 0, dest } = {}) {
  const t = ctx.currentTime + when, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; s.loop = true; f.type = type; f.frequency.value = freq; f.Q.value = q;
  env(g, t, 0.003, peak, dec); s.connect(f); f.connect(g); g.connect(dest || out(pos)); s.start(t, Math.random()); s.stop(t + dec + 0.1);
}

// ---------- 楽器 ----------
export const sfx = {
  toyPiano(i, pos) { if (!ctx) return; const f = pentaFreq(i, 523.25 / 2);
    tone(f, { type: 'triangle', dec: 1.2, peak: 0.28, pos }); tone(f * 4.02, { dec: 0.25, peak: 0.06, pos }); tone(f * 2, { dec: 0.6, peak: 0.08, pos, detune: 6 }); },
  // 本物のピアノ風（MIDIノート番号）。倍音を重ねて、ゆっくり減衰
  piano(midi, pos) { if (!ctx) return; const f = 440 * Math.pow(2, (midi - 69) / 12), dec = 1.2 + (108 - midi) / 30;
    tone(f, { type: 'triangle', a: 0.004, dec, peak: 0.22, pos }); tone(f * 2, { a: 0.004, dec: dec * 0.6, peak: 0.08, pos, detune: 3 });
    tone(f * 3, { a: 0.003, dec: dec * 0.3, peak: 0.03, pos }); noise({ dec: 0.03, peak: 0.03, type: 'bandpass', freq: Math.min(6000, f * 4), q: 1, pos }); },
  xylophone(i, pos) { if (!ctx) return; const f = pentaFreq(i, 523.25);
    tone(f, { dec: 0.45, peak: 0.35, pos }); tone(f * 3.93, { dec: 0.12, peak: 0.1, pos }); noise({ dec: 0.02, peak: 0.05, freq: 2000, pos }); },
  musicBoxNote(i, pos, when = 0, vol = 1) { if (!ctx) return; const f = pentaFreq(i, 1046.5);
    tone(f, { dec: 1.6, peak: 0.16 * vol, pos, when }); tone(f * 2.76, { dec: 0.3, peak: 0.04 * vol, pos, when }); },
  cymbal(pos, when = 0) { if (!ctx) return; noise({ dec: 1.1, peak: 0.22, freq: 6000, pos, when }); noise({ dec: 0.25, peak: 0.12, type: 'bandpass', freq: 3200, q: 2, pos, when }); },
  drum(pos) { if (!ctx) return; const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.25);
    env(g, t, 0.003, 0.6, 0.45); o.connect(g); g.connect(out(pos)); o.start(t); o.stop(t + 0.5);
    noise({ dec: 0.06, peak: 0.12, type: 'lowpass', freq: 1500, pos }); },
  boxCreak(pos, open = true) { if (!ctx) return; const t = ctx.currentTime, o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(open ? 90 : 140, t); o.frequency.linearRampToValueAtTime(open ? 140 : 80, t + 0.5);
    f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 6; env(g, t, 0.05, 0.06, 0.5);
    o.connect(f); f.connect(g); g.connect(out(pos)); o.start(t); o.stop(t + 0.7);
    noise({ dec: 0.08, peak: 0.15, type: 'lowpass', freq: 600, pos, when: open ? 0.5 : 0.55 }); },
  spring(pos) { if (!ctx) return; const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(200, t); o.frequency.exponentialRampToValueAtTime(900, t + 0.15); o.frequency.exponentialRampToValueAtTime(300, t + 0.5);
    env(g, t, 0.005, 0.2, 0.6); o.connect(g); g.connect(out(pos)); o.start(t); o.stop(t + 0.7); },
  click(pos) { if (!ctx) return; noise({ dec: 0.03, peak: 0.2, type: 'bandpass', freq: 2500, q: 3, pos }); },
  // ---------- 3Dならではの演出 ----------
  // 見つけた音：続けて見つけるほど高くなる。毎回少しずつ違う（同じチャイムの繰り返しで耳障りにならないように）
  mikkeCombo(level, pos) { if (!ctx) return; const base = Math.min(level, 6) * 2, pat = [[0, 2, 4, 7], [0, 4, 7, 9], [0, 2, 7, 9], [4, 7, 9, 12]][Math.floor(Math.random() * 4)];
    tone(90, { type: 'sine', a: 0.002, dec: 0.18, peak: 0.25 });                              // 0.1秒の「ドン」（ヒットストップと合わせる）
    noise({ dec: 0.08, peak: 0.08, type: 'bandpass', freq: 5000, q: 2 });
    pat.forEach((n, k) => { tone(pentaFreq(n + base + 5, 523.25), { type: 'triangle', dec: 1.1, peak: 0.14, when: 0.1 + k * 0.075 }); tone(pentaFreq(n + base + 10, 523.25), { dec: 0.5, peak: 0.04, when: 0.1 + k * 0.075 }); }); },
  whistle(when = 0) { if (!ctx) return; const t = ctx.currentTime + when, o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = o2.type = 'sawtooth'; o.frequency.setValueAtTime(740, t); o.frequency.linearRampToValueAtTime(600, t + 2.2); o2.frequency.setValueAtTime(932, t); o2.frequency.linearRampToValueAtTime(760, t + 2.2);   // 通り過ぎると音が下がる
    f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 1.5; env(g, t, 0.15, 0.1, 2.2);
    o.connect(f); o2.connect(f); f.connect(g); g.connect(sfxBus); o.start(t); o2.start(t); o.stop(t + 2.5); o2.stop(t + 2.5); },
  chug(n = 10, pos) { if (!ctx) return; for (let i = 0; i < n; i++) noise({ dec: 0.12, peak: 0.12 * (1 - Math.abs(i - n / 2) / n), type: 'lowpass', freq: 500, pos, when: i * 0.22 }); },
  groan(pos) { if (!ctx) return; const t = ctx.currentTime, o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(55, t); o.frequency.linearRampToValueAtTime(80, t + 2.4); f.type = 'bandpass'; f.frequency.value = 600; f.Q.value = 9;
    env(g, t, 0.4, 0.08, 2.2); o.connect(f); f.connect(g); g.connect(out(pos)); o.start(t); o.stop(t + 2.8); },
  creak(pos) { if (!ctx) return; const t = ctx.currentTime, o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(110, t); o.frequency.linearRampToValueAtTime(70, t + 0.8); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 10;
    env(g, t, 0.08, 0.05, 0.8); o.connect(f); f.connect(g); g.connect(out(pos)); o.start(t); o.stop(t + 1); },
  steps(pos, n = 3) { if (!ctx) return; for (let i = 0; i < n; i++) { noise({ dec: 0.09, peak: 0.07, type: 'lowpass', freq: 380, pos, when: i * 0.7 }); tone(70, { dec: 0.1, peak: 0.05, pos, when: i * 0.7 }); } },
  projector(pos) { if (!ctx) return; for (let i = 0; i < 16; i++) noise({ dec: 0.03, peak: 0.035, type: 'bandpass', freq: 2200, q: 4, pos, when: i * 0.09 }); },
  shimmer() { if (!ctx) return; for (let k = 0; k < 10; k++) tone(pentaFreq(10 + (k * 3) % 7, 1046.5), { dec: 1.2, peak: 0.03, when: k * 0.09 }); },
  pages(pos) { if (!ctx) return; for (let i = 0; i < 14; i++) noise({ dec: 0.04, peak: 0.06, type: 'bandpass', freq: 2600, q: 1, pos, when: i * 0.05 }); },
  wave(pos) { if (!ctx) return; noise({ dec: 1.6, peak: 0.25, type: 'lowpass', freq: 1200, pos }); noise({ dec: 0.9, peak: 0.12, type: 'highpass', freq: 3000, pos, when: 0.2 }); },
  lens(on) { if (!ctx) return; noise({ dec: 0.03, peak: 0.15, type: 'bandpass', freq: 3200, q: 3 }); if (on) tone(1568, { dec: 0.6, peak: 0.05, when: 0.04 }); },
  // ---------- 演出 ----------
  mikke(pos) { if (!ctx) return; [0, 2, 4, 5, 7].forEach((n, k) => { tone(pentaFreq(n + 5, 523.25), { type: 'triangle', dec: 0.9, peak: 0.16, when: k * 0.07 }); });
    noise({ dec: 0.6, peak: 0.04, freq: 8000 }); },
  secret() { if (!ctx) return; [0, 4, 7, 9, 12, 14].forEach((n, k) => { tone(pentaFreq(n, 523.25), { dec: 2.2, peak: 0.12, when: k * 0.12 }); tone(pentaFreq(n, 523.25) * 2, { dec: 1, peak: 0.04, when: k * 0.12 }); }); },
  clear() { if (!ctx) return; [0, 2, 4, 7, 4, 7, 9, 12].forEach((n, k) => sfx.musicBoxNote(n, null, k * 0.18, 1.6)); },
  hint() { if (!ctx) return; const t = ctx.currentTime; for (let k = 0; k < 6; k++) tone(pentaFreq(10 - k, 523.25), { dec: 0.5, peak: 0.05, when: k * 0.05 }); },
  ui() { if (!ctx) return; tone(880, { dec: 0.12, peak: 0.08 }); },
  book() { if (!ctx) return; noise({ dec: 0.35, peak: 0.12, type: 'bandpass', freq: 1800, q: 0.8 }); noise({ dec: 0.25, peak: 0.08, type: 'bandpass', freq: 3000, q: 1, when: 0.15 }); },
  tick(pos, high) { if (!ctx) return; tone(high ? 2400 : 2000, { dec: 0.03, peak: 0.03, pos }); },
};

// ---------- 環境音とBGM ----------
let ambNodes = [], bgmSrc = null, ambTimer = null;
export function stopAmbience() {
  ambNodes.forEach(n => { try { n.stop(); } catch (e) {} }); ambNodes = [];
  if (ambTimer) clearInterval(ambTimer); ambTimer = null;
  if (bgmSrc) { try { bgmSrc.stop(); } catch (e) {} bgmSrc = null; }
}
// 部屋の空気感：低いノイズ＋時々遠くの小さな物音（驚かせない音量）
export function startAmbience({ roomTone = 0.03, lowpass = 300, events = [] } = {}) {
  if (!ctx) return; stopAmbience();
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; s.loop = true; f.type = 'lowpass'; f.frequency.value = lowpass; g.gain.value = roomTone;
  s.connect(f); f.connect(g); g.connect(ambBus); s.start(); ambNodes.push(s);
  if (events.length) ambTimer = setInterval(() => { if (Math.random() < 0.25) events[Math.floor(Math.random() * events.length)](); }, 5000);
}
export const ambientEvents = {
  creak: () => { const t = ctx.currentTime, o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(70, t); o.frequency.linearRampToValueAtTime(95, t + 1.2); f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 8;
    env(g, t, 0.3, 0.012, 1.2); o.connect(f); f.connect(g); g.connect(out(new THREE.Vector3((Math.random() - 0.5) * 8, 3, (Math.random() - 0.5) * 8), ambBus)); o.start(t); o.stop(t + 1.8); },
  chime: () => { const n = Math.floor(Math.random() * 10); tone(pentaFreq(n, 1046.5), { dec: 2.5, peak: 0.02, dest: out(new THREE.Vector3((Math.random() - 0.5) * 8, 2, (Math.random() - 0.5) * 8), ambBus) }); },
};

// BGM：audio/bgm_<name>.mp3 があれば流す（なければ静かに何もしない）
const bgmCache = {};
export async function playBgm(name) {
  if (!ctx) return;
  try {
    if (!(name in bgmCache)) {
      bgmCache[name] = null;
      for (const ext of ['mp3', 'ogg', 'm4a', 'wav']) {
        const r = await fetch(`audio/bgm_${name}.${ext}`);
        if (r.ok) { bgmCache[name] = await ctx.decodeAudioData(await r.arrayBuffer()); break; }
      }
    }
    const buf = bgmCache[name]; if (!buf) return;
    if (bgmSrc) { try { bgmSrc.stop(); } catch (e) {} }
    bgmSrc = ctx.createBufferSource(); bgmSrc.buffer = buf; bgmSrc.loop = true; bgmSrc.connect(bgmBus); bgmSrc.start();
  } catch (e) { /* BGMなしで続行 */ }
}
