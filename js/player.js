// プレイヤー：飛行移動・視点・照準（PC / Quest(WebXR) / スマホVR / スマホ手持ち）
import * as THREE from 'three';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import { V, noRay } from './util.js';

const EYE = 1.4;           // PC・スマホでの目の高さ（XRでは実際の身長）
const RADIUS = 0.22;       // 当たり判定の半径
const tmpM = new THREE.Matrix4(), tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3();
const zee = new THREE.Vector3(0, 0, 1), qScreen = new THREE.Quaternion(), qWorld = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
const euler = new THREE.Euler();

export class Player {
  constructor(renderer, camera) {
    this.renderer = renderer; this.camera = camera;
    this.rig = new THREE.Group(); this.rig.add(camera);
    camera.position.set(0, EYE, 0); camera.rotation.order = 'YXZ';
    this.mode = 'pc';
    this.vel = V(); this.speed = 1.5;
    this.bounds = new THREE.Box3(V(-50, 0, -50), V(50, 20, 50)); this.colliders = [];
    this.yaw = 0; this.pitch = 0; this.locked = false;
    this.keys = new Set();
    this.touch = { x: 0, z: 0, y: 0 };
    this.orient = null; this.yawOffset = 0; this.dragYaw = 0; this.dragPitch = 0;
    this.gazeMoving = false;
    this.onSelect = null; this.onButton = null;
    this.headPos = V();
    this._initPC(); this._initXR(); this._initOrientation();
  }

  // ---------- ステージ ----------
  placeAt(pos, yaw = 0) {
    this.rig.position.copy(pos); this.vel.set(0, 0, 0);
    if (this.mode === 'pc') { this.yaw = yaw; this.pitch = -0.1; }
    else if (this.mode === 'xr') this.rig.rotation.y = yaw;
    else { this.dragYaw = 0; this.dragPitch = 0; this.recenter(yaw); }
  }
  setWorld(bounds, colliders, constrain = null) { this.bounds = bounds; this.colliders = colliders; this.constrain = constrain; }

  // ---------- PC ----------
  _initPC() {
    const el = this.renderer.domElement;
    addEventListener('keydown', e => { this.keys.add(e.code); if (e.code === 'Tab') e.preventDefault(); });
    addEventListener('keyup', e => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === el; this.onLockChange?.(this.locked); });
    addEventListener('mousemove', e => {
      if (!this.locked) return;
      if (this.fallback && !(e.buttons & 1)) return;   // ロック不可の環境ではドラッグで見回す
      if (this.fallback) this.dragDist += Math.abs(e.movementX) + Math.abs(e.movementY);
      this.yaw -= e.movementX * 0.0022 * (this.fallback ? 1.6 : 1); this.pitch = THREE.MathUtils.clamp(this.pitch - e.movementY * 0.0022 * (this.fallback ? 1.6 : 1), -1.5, 1.5);
    });
    el.addEventListener('mousedown', e => {
      if (this.mode !== 'pc') return;
      if (!this.locked) { this.lock(); return; }
      if (this.fallback) { this.dragDist = 0; this.downBtn = e.button; return; }
      if (e.button === 0) this.onSelect?.('main'); else if (e.button === 2) this.onSelect?.('gimmick');
    });
    el.addEventListener('mouseup', e => {
      if (this.mode !== 'pc' || !this.fallback || this.dragDist > 6) return;
      // フォールバック時は画面の中央ではなくクリックした場所を狙う
      this.clickNdc = new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
      this.onSelect?.(e.button === 2 ? 'gimmick' : 'main');
      this.clickNdc = null;
    });
    el.addEventListener('contextmenu', e => e.preventDefault());
  }
  lock() {
    const el = this.renderer.domElement;
    const fail = () => { this.fallback = true; this.locked = true; this.onLockChange?.(true); };
    try { const p = el.requestPointerLock?.(); if (p?.catch) p.catch(fail); else if (!el.requestPointerLock) fail(); } catch (e) { fail(); }
  }
  unlockFallback() { if (this.fallback) { this.locked = false; this.onLockChange?.(false); } }

  // ---------- WebXR ----------
  _initXR() {
    const xr = this.renderer.xr, factory = new XRControllerModelFactory();
    this.ctrls = [0, 1].map(i => {
      const c = xr.getController(i), grip = xr.getControllerGrip(i);
      grip.add(factory.createControllerModel(grip));
      this.rig.add(c); this.rig.add(grip);
      const info = { c, grip, hand: null, src: null, prev: [] };
      c.addEventListener('connected', e => { info.hand = e.data.handedness; info.src = e.data; });
      c.addEventListener('disconnected', () => { info.hand = null; info.src = null; });
      c.addEventListener('selectstart', () => { if (this.mode !== 'xr') return; this.onSelect?.(info.hand === 'left' ? 'gimmick' : 'main'); });
      c.addEventListener('squeezestart', () => { if (this.mode === 'xr') this.onButton?.('lens'); });   // グリップでルーペ
      return info;
    });
    // レーザー（右手）
    const lg = new THREE.BufferGeometry().setFromPoints([V(0, 0, 0), V(0, 0, -1)]);
    this.laser = noRay(new THREE.Line(lg, new THREE.LineBasicMaterial({ color: '#ffe08a', transparent: true, opacity: 0.8 })));
    this.laserDot = noRay(new THREE.Mesh(new THREE.SphereGeometry(0.012, 12, 8), new THREE.MeshBasicMaterial({ color: '#fff3c0', depthTest: false })));
    this.laserDot.renderOrder = 999;
    this.laser.visible = this.laserDot.visible = false;
    this.snapReady = true;
  }
  get right() { return this.ctrls.find(c => c.hand === 'right') || this.ctrls.find(c => c.hand) || null; }
  get left() { return this.ctrls.find(c => c.hand === 'left') || null; }
  enterXR() {
    this.mode = 'xr'; this.camera.position.set(0, 0, 0); this.camera.rotation.set(0, 0, 0);
    this.rig.rotation.y = this.yaw;
  }
  exitXR() { this.mode = 'pc'; this.camera.position.set(0, EYE, 0); this.rig.rotation.set(0, 0, 0); this.laser.visible = this.laserDot.visible = false; }

  // ---------- スマホ（ジャイロ） ----------
  _initOrientation() {
    addEventListener('deviceorientation', e => { if (e.alpha !== null) this.orient = { a: e.alpha, b: e.beta, g: e.gamma }; });
  }
  async requestOrientation() {
    try { if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) await DeviceOrientationEvent.requestPermission(); } catch (e) {}
  }
  _deviceQuat(out) {
    const o = this.orient, d = THREE.MathUtils.DEG2RAD;
    const sa = (screen.orientation?.angle ?? window.orientation ?? 0) * d;
    euler.set(o.b * d, o.a * d, -o.g * d, 'YXZ');
    out.setFromEuler(euler); out.multiply(qWorld); out.multiply(qScreen.setFromAxisAngle(zee, -sa));
    return out;
  }
  // 今向いている方向をステージの正面（yaw）に合わせる
  recenter(yaw = 0) {
    let cur = 0;
    if (this.orient) { const q = this._deviceQuat(new THREE.Quaternion()); tmpV.set(0, 0, -1).applyQuaternion(q); cur = Math.atan2(-tmpV.x, -tmpV.z); }
    this.yawOffset = yaw - cur;
  }
  enterPhone(vr) { this.mode = vr ? 'phonevr' : 'phone'; this.camera.position.set(0, EYE, 0); this.rig.rotation.set(0, 0, 0); this.speed = vr ? 0.7 : 1.2; }

  // ---------- 毎フレーム ----------
  update(dt) {
    const cam = this.camera;
    // 視点
    if (this.mode === 'pc') { this.rig.rotation.set(0, this.yaw, 0); cam.rotation.set(this.pitch, 0, 0); }
    else if (this.mode === 'phone' || this.mode === 'phonevr') {
      this.rig.rotation.set(0, this.yawOffset + this.dragYaw, 0);
      if (this.orient) this._deviceQuat(cam.quaternion);
      else cam.rotation.set(this.dragPitch, 0, 0, 'YXZ');
    }

    // 移動の入力
    let ix = 0, iz = 0, iy = 0, free = false;
    if (this.mode === 'pc') {
      const k = this.keys;
      ix = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
      iz = (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0);
      iy = (k.has('Space') ? 1 : 0) - (k.has('ShiftLeft') || k.has('ShiftRight') ? 1 : 0);
    } else if (this.mode === 'phone') { ix = this.touch.x; iz = this.touch.z; iy = this.touch.y; }
    else if (this.mode === 'phonevr') { iz = this.gazeMoving ? 1 : 0; free = true; }
    else if (this.mode === 'xr') this._xrInput(dt, v => { ix = v[0]; iz = v[1]; iy = v[2]; });

    // 向きに合わせた移動ベクトル
    cam.getWorldDirection(tmpV);
    const fwd = free ? tmpV.clone() : V(tmpV.x, 0, tmpV.z).normalize();
    const right = V(-fwd.z, 0, fwd.x).normalize();
    if (free && Math.abs(fwd.y) > 0.999) right.set(1, 0, 0);
    const want = V().addScaledVector(fwd, iz).addScaledVector(right, ix); want.y += iy;
    if (want.lengthSq() > 1) want.normalize();
    want.multiplyScalar(this.speed);
    this.vel.lerp(want, 1 - Math.exp(-dt * 7));
    this.rig.position.addScaledVector(this.vel, dt);
    this.moving = this.vel.lengthSq() > 0.02;

    // 当たり判定（頭の位置で判定）
    this.rig.updateMatrixWorld(true);
    cam.getWorldPosition(this.headPos);
    const p = this.headPos.clone(), b = this.bounds, r = RADIUS;
    p.x = THREE.MathUtils.clamp(p.x, b.min.x + r, b.max.x - r);
    p.y = THREE.MathUtils.clamp(p.y, b.min.y + 0.25, b.max.y - r);
    p.z = THREE.MathUtils.clamp(p.z, b.min.z + r, b.max.z - r);
    for (const box of this.colliders) {
      if (p.x < box.min.x - r || p.x > box.max.x + r || p.y < box.min.y - r || p.y > box.max.y + r || p.z < box.min.z - r || p.z > box.max.z + r) continue;
      const pen = [[p.x - (box.min.x - r), 'x', box.min.x - r], [(box.max.x + r) - p.x, 'x', box.max.x + r],
        [p.y - (box.min.y - r), 'y', box.min.y - r], [(box.max.y + r) - p.y, 'y', box.max.y + r],
        [p.z - (box.min.z - r), 'z', box.min.z - r], [(box.max.z + r) - p.z, 'z', box.max.z + r]];
      pen.sort((a, c) => a[0] - c[0]); p[pen[0][1]] = pen[0][2];
    }
    if (this.constrain) this.constrain(p, r);   // 斜めの天井など、箱では表せない形
    if (!p.equals(this.headPos)) { this.rig.position.add(p.sub(this.headPos)); this.rig.updateMatrixWorld(true); cam.getWorldPosition(this.headPos); }
  }

  _xrInput(dt, set) {
    const session = this.renderer.xr.getSession(); if (!session) return;
    let mx = 0, mz = 0, my = 0;
    for (const info of this.ctrls) {
      const gp = info.src?.gamepad; if (!gp) continue;
      const ax = gp.axes, sx = ax[2] ?? ax[0] ?? 0, sy = ax[3] ?? ax[1] ?? 0;
      const dz = v => Math.abs(v) < 0.15 ? 0 : v;
      if (info.hand === 'left') { mx = dz(sx); mz = -dz(sy); }
      else {
        my = -dz(sy);
        if (Math.abs(sx) > 0.7 && this.snapReady) { this.snapTurn(sx > 0 ? -Math.PI / 6 : Math.PI / 6); this.snapReady = false; }
        if (Math.abs(sx) < 0.3) this.snapReady = true;
      }
      // ボタン（押した瞬間だけ）
      gp.buttons.forEach((btn, i) => {
        const was = info.prev[i]; info.prev[i] = btn.pressed;
        if (btn.pressed && !was) {
          if (info.hand === 'right' && i === 4) this.onButton?.('hint');
          if (info.hand === 'right' && i === 5) this.onButton?.('list');
          if (info.hand === 'left' && i === 4) this.onButton?.('list');
          if (info.hand === 'left' && i === 5) this.onButton?.('menu');
        }
      });
    }
    set([mx, mz, my]);
  }
  snapTurn(a) {
    const before = this.camera.getWorldPosition(V());
    this.rig.rotation.y += a; this.rig.updateMatrixWorld(true);
    const after = this.camera.getWorldPosition(V());
    this.rig.position.add(before.sub(after));
  }

  // ---------- 照準 ----------
  aim(raycaster, ndc = null) {
    if (this.mode === 'xr' && this.right) {
      const c = this.right.c; tmpM.identity().extractRotation(c.matrixWorld);
      raycaster.ray.origin.setFromMatrixPosition(c.matrixWorld);
      raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tmpM);
      raycaster.camera = this.camera;
      return true;
    }
    raycaster.setFromCamera(ndc || this.clickNdc || new THREE.Vector2(0, 0), this.camera);
    return true;
  }
  showLaser(hitPoint, dist) {
    const r = this.right; if (this.mode !== 'xr' || !r) { this.laser.visible = this.laserDot.visible = false; return; }
    if (this.laser.parent !== r.c) r.c.add(this.laser);
    this.laser.visible = true; this.laser.scale.z = dist ?? 8;
    if (hitPoint) { this.laserDot.visible = true; if (this.laserDot.parent !== this.rig.parent && this.rig.parent) this.rig.parent.add(this.laserDot); this.laserDot.position.copy(hitPoint); }
    else this.laserDot.visible = false;
  }
}
