// みんなで あそぶ（最大4人）：ブラウザどうしを直接つなぐ（WebRTC / PeerJS）。
// サーバーを持たない GitHub Pages でも動くように、最初のつなぎ役だけ PeerJS の公開サーバーを借りる。
// つなぎ方は「へやの あるじ（ホスト）」に全員がつながる星形。ページと見つけた物はホストの記録が正。
import * as THREE from 'three';
import { textSprite } from './ui3d.js';
import { V, noRay } from './util.js';

const PEER_URL = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.5/+esm';
const PREFIX = 'mikke-vr-room-';
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // 見まちがえやすい I・O・0・1 は使わない
export const MAX_PLAYERS = 4;
export const SLOTS = [
  { name: 'あか', color: '#d9705a' }, { name: 'あお', color: '#6a8fd0' },
  { name: 'みどり', color: '#8ab060' }, { name: 'きいろ', color: '#e0b040' },
];
const newCode = () => Array.from({ length: 4 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join('');
export const normCode = s => (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);

export class Party {
  // hooks: onPage(msg) / onFound(msg) / onRoster(players) / onStatus(text, kind) / getPage() → {stageId,n,found:[]}|null
  constructor(hooks) {
    this.h = hooks; this.peer = null; this.conns = new Map(); this.hostConn = null;
    this.isHost = false; this.code = ''; this.slot = 0; this.name = '';
    this.players = [];   // [{ id, slot, name }]
    this.root = noRay(new THREE.Group()); this.avatars = new Map(); this.poseT = 0;
  }
  get active() { return !!this.peer && (this.isHost || !!this.hostConn?.open); }
  get myId() { return this.peer?.id; }
  nameOf(id) { const p = this.players.find(q => q.id === id); return p ? p.name : ''; }
  slotOf(id) { const p = this.players.find(q => q.id === id); return p ? p.slot : -1; }
  async lib() { if (!this.Peer) { const m = await import(PEER_URL); this.Peer = m.Peer || m.default; } return this.Peer; }
  status(t, kind = '') { this.h.onStatus?.(t, kind); }

  // ---------- へやを つくる ----------
  async host(name, tries = 0) {
    this.leave(); this.status('へやを ひらいています……');
    let Peer; try { Peer = await this.lib(); } catch (e) { this.status('つなぐ ための 道具が 読みこめなかった。', 'err'); return; }
    const code = newCode(), peer = new Peer(PREFIX + code.toLowerCase());
    this.peer = peer; this.name = name || SLOTS[0].name;
    peer.on('open', () => {
      this.isHost = true; this.code = code; this.slot = 0;
      this.players = [{ id: peer.id, slot: 0, name: this.name }];
      this.status('', 'open'); this.h.onRoster?.(this.players);
    });
    peer.on('connection', conn => this.accept(conn));
    peer.on('error', e => {
      if (e.type === 'unavailable-id' && tries < 4) { this.host(name, tries + 1); return; }
      this.status(`へやを ひらけなかった……（${e.type || e.message}）`, 'err');
    });
    peer.on('disconnected', () => { if (this.isHost && !peer.destroyed) peer.reconnect(); });
  }
  accept(conn) {
    conn.on('data', d => this.hostRecv(conn, d));
    conn.on('close', () => this.drop(conn.peer));
    conn.on('error', () => this.drop(conn.peer));
  }
  drop(id) {
    if (!this.conns.has(id)) return;
    const name = this.nameOf(id);
    this.conns.delete(id); this.players = this.players.filter(p => p.id !== id); this.removeAvatar(id);
    this.toAll({ t: 'roster', players: this.players }); this.h.onRoster?.(this.players, `${name}が へやを でた`);
  }
  hostRecv(conn, d) {
    if (!d || typeof d !== 'object') return;
    if (d.t === 'hello') {
      if (this.players.length >= MAX_PLAYERS) { conn.send({ t: 'full' }); setTimeout(() => conn.close(), 400); return; }
      const used = new Set(this.players.map(p => p.slot)); const slot = [0, 1, 2, 3].find(s => !used.has(s));
      const name = String(d.name || '').slice(0, 8) || SLOTS[slot].name;
      this.conns.set(conn.peer, conn); this.players.push({ id: conn.peer, slot, name });
      conn.send({ t: 'welcome', slot, players: this.players, page: this.h.getPage?.() || null });
      this.toAll({ t: 'roster', players: this.players }, conn.peer); this.h.onRoster?.(this.players, `${name}が やってきた`);
      return;
    }
    if (!this.conns.has(conn.peer)) return;
    d.from = conn.peer;
    if (d.t === 'pose') { this.pose(d); this.toAll(d, conn.peer); return; }
    if (d.t === 'found') { if (this.h.onFound?.(d)) this.toAll(d, conn.peer); return; }   // ホストが受け付けた物だけ全員へ
    if (d.t === 'page') { this.h.onPage?.(d); return; }                                   // ページはホストがめくり直して全員へ配る
  }
  toAll(d, except = null) { for (const [id, c] of this.conns) if (id !== except && c.open) c.send(d); }

  // ---------- 合い言葉で はいる ----------
  async join(code, name) {
    this.leave(); code = normCode(code);
    if (code.length !== 4) { this.status('合い言葉は 4もじ だよ。', 'err'); return; }
    this.status('へやを さがしています……');
    let Peer; try { Peer = await this.lib(); } catch (e) { this.status('つなぐ ための 道具が 読みこめなかった。', 'err'); return; }
    const peer = new Peer(); this.peer = peer; this.name = name; this.code = code;
    peer.on('open', () => {
      const conn = peer.connect(PREFIX + code.toLowerCase(), { reliable: true });
      this.hostConn = conn;
      conn.on('open', () => conn.send({ t: 'hello', name }));
      conn.on('data', d => this.clientRecv(d));
      conn.on('close', () => { if (this.peer === peer) { this.status('へやの あるじが いなくなった。ひとりで つづけよう。', 'err'); this.leave(true); } });
    });
    peer.on('error', e => {
      if (e.type === 'peer-unavailable') this.status('その 合い言葉の へやは 見つからなかった。', 'err');
      else this.status(`つながらなかった……（${e.type || e.message}）`, 'err');
      if (!this.hostConn?.open) this.leave(true);
    });
  }
  clientRecv(d) {
    if (!d || typeof d !== 'object') return;
    if (d.t === 'full') { this.status('その へやは もう 4人 いっぱい。', 'err'); this.leave(true); return; }
    if (d.t === 'welcome') {
      this.slot = d.slot; this.players = d.players; this.name = this.nameOf(this.myId) || this.name;
      this.status('', 'joined'); this.h.onRoster?.(this.players);
      if (d.page) this.h.onPage?.({ ...d.page, fromHost: true });
      return;
    }
    if (d.t === 'roster') { const gone = this.players.filter(p => !d.players.some(q => q.id === p.id)); gone.forEach(p => this.removeAvatar(p.id)); this.players = d.players; this.h.onRoster?.(this.players); return; }
    if (d.t === 'pose') { this.pose(d); return; }
    if (d.t === 'found') { this.h.onFound?.(d); return; }
    if (d.t === 'page') { this.h.onPage?.({ ...d, fromHost: true }); return; }
  }

  // ---------- 送る ----------
  send(d) {
    d.from = this.myId;
    if (this.isHost) this.toAll(d);
    else if (this.hostConn?.open) this.hostConn.send(d);
  }
  leave(keepStatus = false) {
    try { this.peer?.destroy(); } catch (e) {}
    this.peer = null; this.hostConn = null; this.conns.clear(); this.isHost = false; this.players = [];
    for (const id of [...this.avatars.keys()]) this.removeAvatar(id);
    if (!keepStatus) this.status('', 'closed');
    this.h.onRoster?.(this.players);
  }

  // ---------- 仲間の すがた（ろうそくの灯をもった、紙の小さなおばけ） ----------
  avatar(id) {
    if (this.avatars.has(id)) return this.avatars.get(id);
    const slot = Math.max(0, this.slotOf(id)), col = SLOTS[slot].color, g = new THREE.Group();
    const sheet = new THREE.MeshStandardMaterial({ color: '#efe6d2', roughness: 0.9, side: THREE.DoubleSide });
    const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new THREE.Vector2(0.02 + Math.sin(t * Math.PI * 0.55) * 0.13 + t * 0.03, 0.3 - t * 0.36)); }
    const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 20), sheet); body.position.y = -0.08; g.add(body);
    const eyeM = new THREE.MeshBasicMaterial({ color: '#231b14' });
    [-0.045, 0.045].forEach(x => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), eyeM); e.position.set(x, 0.12, 0.115); e.scale.z = 0.5; g.add(e); });
    const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.022, 8, 20), new THREE.MeshStandardMaterial({ color: col, roughness: 0.7 }));
    scarf.rotation.x = Math.PI / 2; scarf.position.y = 0.04; g.add(scarf);
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), new THREE.MeshBasicMaterial({ color: col, toneMapped: false }));
    flame.position.set(0.16, 0.02, 0.06); g.add(flame);
    const light = new THREE.PointLight(col, 0.6, 2.2, 2); light.position.copy(flame.position); g.add(light);
    const label = textSprite(this.nameOf(id) || SLOTS[slot].name, { size: 0.09, color: col }); label.position.y = 0.34; g.add(label);
    g.traverse(o => { o.raycast = () => {}; });
    g.visible = false; this.root.add(g);
    const a = { g, flame, light, target: V(), yaw: 0, ready: false, where: '' }; this.avatars.set(id, a); return a;
  }
  removeAvatar(id) { const a = this.avatars.get(id); if (!a) return; this.root.remove(a.g); a.g.traverse(o => { o.geometry?.dispose(); o.material?.map?.dispose?.(); }); this.avatars.delete(id); }
  pose(d) {
    if (d.from === this.myId) return;
    const a = this.avatar(d.from); a.target.fromArray(d.p); a.yaw = d.y + Math.PI; a.where = d.w;   // 顔（+z）を、見ている方へ
    if (!a.ready) { a.g.position.copy(a.target); a.ready = true; }
  }
  // 毎フレーム：自分の位置を10回/秒 送り、仲間をなめらかに動かす
  update(dt, t, me) {
    if (!this.active) return;
    this.poseT += dt;
    if (this.poseT > 0.1) { this.poseT = 0; this.send({ t: 'pose', p: me.p.toArray().map(v => +v.toFixed(3)), y: +me.yaw.toFixed(3), w: me.where }); }
    for (const a of this.avatars.values()) {
      a.g.visible = a.ready && a.where === me.where;
      a.g.position.lerp(a.target, 1 - Math.exp(-dt * 8));
      a.g.position.y = a.target.y - 0.25 + Math.sin(t * 2 + a.yaw) * 0.03;   // 目の高さより少し下に、ふわふわ浮く
      const dy = Math.atan2(Math.sin(a.yaw - a.g.rotation.y), Math.cos(a.yaw - a.g.rotation.y)); a.g.rotation.y += dy * (1 - Math.exp(-dt * 8));
      a.light.intensity = 0.5 + Math.sin(t * 13 + a.yaw * 7) * 0.08; a.flame.scale.setScalar(1 + Math.sin(t * 17) * 0.12);
    }
  }
  shareUrl() { const u = new URL(location.href); u.search = ''; u.hash = ''; u.searchParams.set('room', this.code); return u.toString(); }
}
