// Ep 11 · neuron style — one kid scrolls, the other builds a cube robot. Deterministic: frame -> picture.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const W = 1080, H = 1920, FPS = 30;
const D2R = Math.PI / 180;
const C = { blue: 0x180E85, lime: 0xB9E132, lblue: 0x2B54A5, navy: 0x14213F, red: 0xE0283C, fig: 0xF4F6FB };

// ---------- easing / helpers ----------
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, s) => a + (b - a) * s;
const smooth = s => s * s * s * (s * (6 * s - 15) + 10);
const easeOut = s => 1 - Math.pow(1 - s, 3);
const easeIn = s => s * s * s;
const win = (t, a, b) => clamp((t - a) / (b - a));
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// ---------- renderer ----------
const glCanvas = document.createElement('canvas');
glCanvas.width = W; glCanvas.height = H;
const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
scene.fog = new THREE.Fog(0x000000, 20, 30);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.32;

const camera = new THREE.PerspectiveCamera(24, W / H, 1, 80);

// ---------- lights ----------
scene.add(new THREE.HemisphereLight(0x2a3a6a, 0x000000, 0.35));
function spot(x, color = 0xffffff) {
  const s = new THREE.SpotLight(color, 28, 20, 0.38, 0.85, 1.6);
  s.position.set(x * 0.6, 7.5, 3.2);
  s.target.position.set(x, 0.6, 0);
  s.castShadow = true;
  s.shadow.mapSize.set(2048, 2048);
  s.shadow.bias = -0.0004; s.shadow.normalBias = 0.02; s.shadow.radius = 6;
  s.shadow.camera.near = 3; s.shadow.camera.far = 14;
  scene.add(s, s.target);
  return s;
}
const spotL = spot(-1.2), spotR = spot(1.1);
const rim = new THREE.DirectionalLight(0x5b7fd6, 2.6); rim.position.set(-2, 4, -6); scene.add(rim);
const rim2 = new THREE.DirectionalLight(0x3d5fc0, 1.6); rim2.position.set(3, 2.5, -5); scene.add(rim2);
const fill = new THREE.DirectionalLight(0xc8d4ff, 0.35); fill.position.set(0, 2, 8); scene.add(fill);
const limeLight = new THREE.PointLight(C.lime, 0, 4.5, 1.6); scene.add(limeLight);
const redLight = new THREE.PointLight(C.red, 0, 4, 1.8); scene.add(redLight);

// ---------- floor: black glass ----------
const mirror = new Reflector(new THREE.PlaneGeometry(40, 40), { textureWidth: W, textureHeight: H, color: 0x8a8f9c, multisample: 4 });
mirror.rotation.x = -Math.PI / 2; scene.add(mirror);
const glass = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: 0x05070d, roughness: 0.32, metalness: 0.0, transparent: true, opacity: 0.8 }));
glass.rotation.x = -Math.PI / 2; glass.position.y = 0.002; glass.receiveShadow = true; scene.add(glass);

// ---------- materials ----------
const figMat = () => new THREE.MeshPhysicalMaterial({ color: C.fig, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.35, sheen: 0.4, sheenRoughness: 0.5, sheenColor: new THREE.Color(0xdfe8ff), emissive: C.lime, emissiveIntensity: 0 });
const cubeTints = [0xE9EDF5, 0xCBD4E6, 0xDDE3EF, 0xB9C5DD];
const cubeMats = cubeTints.map(c => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.5, clearcoat: 0.25, clearcoatRoughness: 0.4, emissive: C.lime, emissiveIntensity: 0 }));
const CS = 0.3, HC = CS / 2;
const cubeGeo = new RoundedBoxGeometry(CS, CS, CS, 5, 0.045);

// ---------- figure rig ----------
function cap(r, len, mat) { const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 10, 20), mat); m.castShadow = true; return m; }
class Figure {
  constructor() {
    const mat = this.mat = figMat();
    this.root = new THREE.Group(); this.body = new THREE.Group(); this.root.add(this.body);
    this.hips = new THREE.Group(); this.body.add(this.hips);
    const pelvis = new THREE.Mesh(new THREE.SphereGeometry(0.1, 24, 16), mat); pelvis.scale.set(1.15, 0.8, 0.9); pelvis.castShadow = true; this.hips.add(pelvis);
    this.torso = new THREE.Group(); this.hips.add(this.torso);
    const tm = cap(0.118, 0.2, mat); tm.position.y = 0.2; tm.scale.set(1.05, 1, 0.82); this.torso.add(tm);
    this.neck = new THREE.Group(); this.neck.position.y = 0.39; this.torso.add(this.neck);
    const nm = cap(0.04, 0.05, mat); nm.position.y = 0.03; this.neck.add(nm);
    this.head = new THREE.Mesh(new THREE.SphereGeometry(0.162, 40, 28), mat); this.head.position.y = 0.175; this.head.castShadow = true; this.neck.add(this.head);
    this.neck.rotation.order = 'YXZ';
    const arm = (side) => {
      const sh = new THREE.Group(); sh.position.set(0.148 * side, 0.315, 0); sh.rotation.order = 'XYZ'; this.torso.add(sh);
      const u = cap(0.05, 0.19, mat); u.position.y = -0.1; sh.add(u);
      const el = new THREE.Group(); el.position.y = -0.2; sh.add(el);
      const f = cap(0.046, 0.17, mat); f.position.y = -0.1; el.add(f);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.056, 20, 14), mat); hand.position.y = -0.2; hand.castShadow = true; el.add(hand);
      return { sh, el, hand };
    };
    const leg = (side) => {
      const hp = new THREE.Group(); hp.position.set(0.072 * side, 0, 0); hp.rotation.order = 'XYZ'; this.hips.add(hp);
      const t = cap(0.062, 0.24, mat); t.position.y = -0.13; hp.add(t);
      const kn = new THREE.Group(); kn.position.y = -0.26; hp.add(kn);
      const s = cap(0.056, 0.22, mat); s.position.y = -0.13; kn.add(s);
      const ft = new THREE.Mesh(new THREE.SphereGeometry(0.062, 20, 14), mat); ft.scale.set(0.95, 0.75, 1.45); ft.position.set(0, -0.265, 0.035); ft.castShadow = true; kn.add(ft);
      return { hp, kn };
    };
    this.aL = arm(1); this.aR = arm(-1); this.lL = leg(1); this.lR = leg(-1);
    scene.add(this.root);
  }
  apply(p) {
    const ext = (h, k) => 0.26 * Math.cos(h * D2R) + 0.26 * Math.cos((h - k) * D2R) + 0.055;
    const stand = Math.max(ext(p.hipL, p.kneeL), ext(p.hipR, p.kneeR));
    this.hips.position.y = lerp(stand, p.sitY, p.sit) + p.lift;
    this.torso.rotation.x = p.lean * D2R;
    this.neck.rotation.set(p.headPitch * D2R, p.headYaw * D2R, p.headRoll * D2R);
    this.aL.sh.rotation.set(-p.shLf * D2R, 0, p.shLs * D2R); this.aL.el.rotation.x = -p.elL * D2R;
    this.aR.sh.rotation.set(-p.shRf * D2R, 0, -p.shRs * D2R); this.aR.el.rotation.x = -p.elR * D2R;
    this.lL.hp.rotation.set(-p.hipL * D2R, 0, p.hipLs * D2R); this.lL.kn.rotation.x = p.kneeL * D2R;
    this.lR.hp.rotation.set(-p.hipR * D2R, 0, -p.hipRs * D2R); this.lR.kn.rotation.x = p.kneeR * D2R;
    this.root.position.set(p.x, p.gy, p.z);
    this.root.rotation.y = p.yaw * D2R;
    const sq = p.squash;
    this.body.scale.set(p.scale * (1 + sq * 0.5), p.scale * (1 - sq), p.scale * (1 + sq * 0.5));
    this.mat.emissiveIntensity = p.glow * 0.16;
    this.mat.color.setHex(C.fig).lerp(new THREE.Color(0xd9f27a), p.glow * 0.55);
    this.root.updateMatrixWorld(true);
  }
  handsMid(out) {
    const a = this.aL.hand.getWorldPosition(new THREE.Vector3()), b = this.aR.hand.getWorldPosition(new THREE.Vector3());
    return out.copy(a).add(b).multiplyScalar(0.5);
  }
}

// ---------- poses ----------
const BASE = { lean: 0, headPitch: 0, headYaw: 0, headRoll: 0, shLf: 6, shLs: 6, elL: 12, shRf: 6, shRs: 6, elR: 12, hipL: 0, kneeL: 0, hipR: 0, kneeR: 0, hipLs: 3, hipRs: 3, sit: 0, sitY: 0.13, lift: 0, x: 0, z: 0, yaw: 0, gy: 0, scale: 1, glow: 0, squash: 0 };
const P = {
  stand: {},
  look: { headPitch: 28, lean: 6 },
  carry: { shLf: 48, shRf: 48, elL: 58, elR: 58, shLs: -3, shRs: -3, lean: 4, headPitch: 12 },
  grab: { lean: 52, headPitch: 22, hipL: 72, kneeL: 108, hipR: 72, kneeR: 108, shLf: 8, shRf: 8, elL: 18, elR: 18, shLs: -4, shRs: -4 },
  flinch: { lean: 30, headPitch: 38, shLf: 150, shRf: 150, shLs: 28, shRs: 28, elL: 125, elR: 125, hipL: 62, kneeL: 95, hipR: 62, kneeR: 95, scale: 0.9 },
  sitHug: { sit: 1, hipL: 128, kneeL: 146, hipR: 124, kneeR: 140, hipLs: 7, hipRs: 7, lean: 32, headPitch: 34, shLf: 50, shRf: 50, elL: 80, elR: 80, shLs: -14, shRs: -14, scale: 0.9 },
  stepUp: { hipL: 78, kneeL: 92, lean: 18, shLf: -20, shRf: 34, elL: 25, elR: 30, headPitch: 8 },
  stepUpR: { hipR: 78, kneeR: 92, lean: 18, shRf: -20, shLf: 34, elL: 30, elR: 25, headPitch: 8 },
  cheer: { shLf: 168, shRf: 168, shLs: 24, shRs: 24, elL: 6, elR: 6, headPitch: -22, lean: -6 },
};
function placePose(h) { // h = slot centre height
  if (h < 0.3) return { lean: 40, headPitch: 20, hipL: 62, kneeL: 92, hipR: 62, kneeR: 92, shLf: 30, shRf: 30, elL: 14, elR: 14, shLs: -4, shRs: -4 };
  if (h < 0.6) return { lean: 26, headPitch: 18, hipL: 30, kneeL: 45, hipR: 30, kneeR: 45, shLf: 52, shRf: 52, elL: 12, elR: 12, shLs: -4, shRs: -4 };
  if (h < 0.9) return { lean: 10, headPitch: 6, shLf: 78, shRf: 78, elL: 14, elR: 14, shLs: -4, shRs: -4 };
  return { lean: 4, headPitch: -18, shLf: 118, shRf: 118, elL: 16, elR: 16, shLs: -4, shRs: -4, lift: 0.04 };
}
const pose = (...parts) => Object.assign({}, BASE, ...parts);

// keyframe track: keys [{t, ...partialPose}], each key is a full pose after carry-forward
class Track {
  constructor(start) { this.keys = [{ t: 0, p: pose(start) }]; }
  key(t, ...parts) { const prev = this.keys[this.keys.length - 1].p; this.keys.push({ t, p: Object.assign({}, prev, ...parts.map(o => Object.assign({}, o))) }); return this; }
  // key that resets the body pose but keeps root placement
  pose(t, name, extra = {}) { const prev = this.keys[this.keys.length - 1].p; const p = pose(typeof name === 'string' ? P[name] : name, { x: prev.x, z: prev.z, yaw: prev.yaw, gy: prev.gy, scale: prev.scale, glow: prev.glow }, extra); this.keys.push({ t, p }); return this; }
  at(t) {
    const k = this.keys; if (t <= k[0].t) return { ...k[0].p };
    for (let i = 0; i < k.length - 1; i++) {
      if (t < k[i + 1].t) {
        const s = smooth((t - k[i].t) / (k[i + 1].t - k[i].t)); const o = {};
        for (const key in k[i].p) o[key] = lerp(k[i].p[key], k[i + 1].p[key], s);
        return o;
      }
    }
    return { ...k[k.length - 1].p };
  }
}

// ---------- layout ----------
const L = { towerX: -1.5, standX: -1.1, pile: [-0.72, -0.62], dir: -1 };
const R = { towerX: 1.5, standX: 1.1, pile: [0.72, -0.62], dir: 1 };
const colX = (side, i) => side.towerX - side.dir * i * CS; // i=0 tower (A), 1 B, 2 C, 3 D
const slot = (side, col, level) => new THREE.Vector3(colX(side, col), HC + level * CS, 0);
const yawTo = (fx, fz, tx, tz) => Math.atan2(tx - fx, tz - fz) / D2R;

// ---------- cubes ----------
const cubes = [];
function makeCube(tint) { const m = new THREE.Mesh(cubeGeo, cubeMats[tint % cubeMats.length]); m.castShadow = true; m.receiveShadow = true; scene.add(m); const c = { m, ev: [] }; cubes.push(c); return c; }
function pilePositions(side) {
  const [px, pz] = side.pile, s = CS + 0.02, d = side.dir;
  // top layer first (taken first)
  return [
    [px - d * 0.5 * s, HC + CS, pz - 0.5 * s, 8], [px - d * 0.5 * s, HC + CS, pz + 0.5 * s, -6],
    [px - d * s, HC, pz - 0.5 * s, 4], [px, HC, pz - 0.5 * s, -3], [px + d * s * 0.1, HC, pz + 0.5 * s, 10],
    [px - d * s, HC, pz + 0.5 * s, -9], [px + d * s, HC, pz + 0.1, 14], [px + d * s * 1.05, HC, pz - 0.6 * s - 0.05, -12],
  ].map(([x, y, z, r]) => ({ p: new THREE.Vector3(x, y, z), ry: r * D2R }));
}

// fall simulation (2D tumble in the x-y plane + z drift), deterministic
function simFall(p0, vx, vy, vz, w, rz0 = 0) {
  const out = []; let x = p0.x, y = p0.y, z = p0.z, rz = rz0, dt = 1 / 600, t = 0, rest = false;
  let bounces = 0;
  while (t < 2.2) {
    if (!rest) {
      vy -= 9.8 * dt; x += vx * dt; y += vy * dt; z += vz * dt; rz += w * dt;
      const low = HC * (Math.abs(Math.cos(rz)) + Math.abs(Math.sin(rz)));
      if (y - low <= 0) {
        y = low; bounces++;
        if (Math.abs(vy) < 0.6 || bounces > 3) { rest = true; vy = 0; }
        else { vy = -vy * 0.32; vx *= 0.55; vz *= 0.55; w *= 0.45; }
      }
    } else {
      // settle onto nearest face
      const target = Math.round(rz / (Math.PI / 2)) * (Math.PI / 2);
      rz += (target - rz) * 0.02; vx *= 0.985; vz *= 0.985; x += vx * dt; z += vz * dt;
      y = HC * (Math.abs(Math.cos(rz)) + Math.abs(Math.sin(rz)));
    }
    if (Math.round(t * 600) % 5 === 0) out.push({ x, y, z, rz });
    t += dt;
  }
  return { samples: out, end: out[out.length - 1], landT: null };
}
function landTimeOf(sim) { const s = sim.samples; for (let i = 1; i < s.length; i++) if (s[i].y <= HC * (Math.abs(Math.cos(s[i].rz)) + Math.abs(Math.sin(s[i].rz))) + 1e-4) return i / 120; return 0.4; }

// cube events: at | grab(fig) | put(slot) | fall(sim)
function evalCube(c, t, figs) {
  let pos = new THREE.Vector3(), ry = 0, rz = 0, state = null, tmp = new THREE.Vector3();
  for (let i = 0; i < c.ev.length; i++) {
    const e = c.ev[i]; if (t < e.t) break;
    const next = c.ev[i + 1]; const tt = next ? Math.min(t, next.t) : t;
    if (e.kind === 'at') { pos.copy(e.p); ry = e.ry || 0; rz = e.rz || 0; }
    else if (e.kind === 'grab') {
      const f = figs[e.fig]; const hp = f.handsMidAt(tt, tmp);
      const s = smooth(win(tt, e.t, e.t + (e.blend ?? 0.16)));
      const fy = f.track.at(tt).yaw * D2R;
      const startPos = state ? state.pos : pos.clone(); const sry = state ? state.ry : ry, srz = state ? state.rz : rz;
      pos.copy(startPos).lerp(hp, s); ry = lerp(sry, fy, s); rz = lerp(srz, 0, s);
    } else if (e.kind === 'put') {
      const f = figs[e.fig]; const hp = f.handsMidAt(tt, tmp); const fy = f.track.at(tt).yaw * D2R;
      const s = smooth(win(tt, e.t, e.t + e.dur));
      pos.copy(hp).lerp(e.p, s); ry = lerp(fy, e.ry ?? 0, s); rz = 0;
      if (tt >= e.t + e.dur) pos.copy(e.p);
    } else if (e.kind === 'fall') {
      const k = Math.min(e.sim.samples.length - 1, Math.floor((tt - e.t) * 120));
      const sm = e.sim.samples[k]; pos.set(sm.x, sm.y, sm.z); rz = sm.rz; ry = e.ry || 0;
    } else if (e.kind === 'slide') { // small slip before the fall
      const s = easeIn(win(tt, e.t, e.t + e.dur)); pos.copy(e.p).add(new THREE.Vector3(e.dx * s, 0, 0)); rz = e.rz * s; ry = 0;
    }
    state = { pos: pos.clone(), ry, rz };
  }
  c.m.position.copy(pos); c.m.rotation.set(0, ry, rz, 'YXZ');
}

// ---------- characters + choreography (ep 11) ----------
const figL = new Figure(), figR = new Figure();
for (const f of [figL, figR]) f.handsMidAt = function (t, out) { this.apply(this.track.at(t)); return this.handsMid(out); };
Object.assign(P, {
  sitPhone: { sit: 1, sitY: 0.13, hipL: 124, kneeL: 142, hipR: 120, kneeR: 136, hipLs: 9, hipRs: 9, lean: 18, headPitch: 36, shLf: 62, shRf: 62, elL: 78, elR: 78, shLs: -12, shRs: -12 },
});
const fx = {};

// ===== LEFT: scrolls the whole hour =====
const LX = -0.78, LZ = 0.1, LYAW = 16;
{
  const tr = figL.track = new Track(pose(P.sitPhone, { x: LX, z: LZ, yaw: LYAW }));
  const sp = (t, o = {}) => tr.pose(t, 'sitPhone', { x: LX, z: LZ, yaw: LYAW, ...o });
  const hunch = t => smooth(win(t, 1.5, 12));
  const scaleAt = t => lerp(1, 0.88, hunch(t));
  const base = t => ({ lean: lerp(16, 34, hunch(t)), headPitch: lerp(36, 48, hunch(t)), scale: scaleAt(t) });
  sp(1.5, base(1.5)); sp(5.3, base(5.3));
  // glances at the builder, then back down
  sp(5.8, { ...base(5.8), headPitch: 4, headYaw: 42, lean: 10 }); sp(6.6, { ...base(6.6), headPitch: 6, headYaw: 44, lean: 11 });
  sp(7.1, base(7.1)); sp(9.8, base(9.8));
  sp(10.25, { ...base(10.25), headPitch: 8, headYaw: 40, lean: 14 }); sp(10.8, { ...base(10.8), headPitch: 10, headYaw: 40, lean: 15 });
  sp(11.3, base(11.3)); sp(12.4, base(12.4));
  // the robot wakes up: lifts the head toward it
  sp(13.0, { ...base(13), lean: 6, headPitch: -6, headYaw: 46, headRoll: -6 });
  sp(15.0, { ...base(15), lean: 5, headPitch: -8, headYaw: 48, headRoll: -6 });
}

// ===== RIGHT: puts the phone down and builds a robot =====
const RX0 = 0.12, RZ0 = 0.22, RYAW0 = -12;
const rx = 0.92, rz = -0.12; // robot centre
const RYAW = -25 * D2R; // the robot faces the builder and, three-quarters, the camera
const rRight = new THREE.Vector3(Math.cos(RYAW), 0, -Math.sin(RYAW)), rFwd = new THREE.Vector3(Math.sin(RYAW), 0, Math.cos(RYAW));
const rPt = (ox, y) => new THREE.Vector3(rx, y, rz).addScaledVector(rRight, ox);
const S = { pile: [-0.05, -0.95], dir: 1 };
const pileP = pilePositions(S);
const robot = []; // cubes of the robot
const parts = [
  { p: rPt(-0.165, HC), s: 1 }, // leg L
  { p: rPt(0.165, HC), s: 1 }, // leg R
  { p: rPt(-0.165, HC + CS), s: 1 }, // body L
  { p: rPt(0.165, HC + CS), s: 1 }, // body R (slips once)
  { p: rPt(-0.42, HC + CS + 0.04), s: 0.62 }, // arm L
  { p: rPt(0.42, HC + CS + 0.04), s: 0.62 }, // arm R
  { p: rPt(0, 2 * CS + 1.25 * HC), s: 1.25 }, // head
];
parts.forEach((pt, i) => {
  const c = makeCube(i + 1); c.m.scale.setScalar(pt.s);
  const pp = pileP[i]; c.ev.push({ t: 0, kind: 'at', p: pp.p.clone().setY(HC * pt.s + (pp.p.y > HC + 0.01 ? CS : 0)), ry: pp.ry });
  robot.push(c);
});
// eyes on the head (local, unscaled cube units)
const eyeMat = new THREE.MeshBasicMaterial({ color: 0x0b0f1a, toneMapped: false });
for (const ex of [-0.075, 0.075]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.012), eyeMat); e.position.set(ex, 0.02, HC + 0.004); robot[6].m.add(e); }

{
  const tr = figR.track = new Track(pose(P.sitPhone, { x: RX0, z: RZ0, yaw: RYAW0 }));
  tr.pose(1.25, 'sitPhone', { x: RX0, z: RZ0, yaw: RYAW0 });
  // puts the phone face down in front
  tr.pose(1.55, 'sitPhone', { x: RX0, z: RZ0, yaw: RYAW0, lean: 46, headPitch: 30, shLf: 62, shRf: 62, elL: 20, elR: 20 });
  tr.pose(1.75, 'sitPhone', { x: RX0, z: RZ0, yaw: RYAW0, lean: 40, headPitch: 22, shLf: 40, shRf: 40, elL: 30, elR: 30 });
  fx.phoneDown = 1.62;
  // stands up
  tr.pose(2.05, 'grab', { x: RX0, z: RZ0, yaw: RYAW0 + 20 });
  tr.pose(2.3, 'stand', { x: RX0 - 0.02, z: RZ0 - 0.05, yaw: 160, headPitch: 10 });
  fx.squashR = [[2.3, 0.06]];
  fx.placeR = [];
  const BUILD = new THREE.Vector3(rx, 0, rz).addScaledVector(rFwd, 0.42).addScaledVector(rRight, -0.36);
  const FYAW = yawTo(BUILD.x, BUILD.z, rx, rz);
  // build from behind the robot, facing the camera
  const carry = (c, tGrab, tPlace, gp, target, opt = {}) => {
    const last = tr.keys[tr.keys.length - 1].p;
    const fromX = last.x, fromZ = last.z;
    const len = Math.hypot(gp.x - fromX, gp.z - fromZ) || 1;
    const gsx = gp.x - (gp.x - fromX) / len * 0.4, gsz = gp.z - (gp.z - fromZ) / len * 0.4;
    const yawG = yawTo(gsx, gsz, gp.x, gp.z);
    const pre = opt.pre ?? 0.22;
    tr.pose(tGrab - pre, 'look', { x: lerp(fromX, gsx, 0.6), z: lerp(fromZ, gsz, 0.6), yaw: yawG });
    tr.pose(tGrab, 'grab', { x: gsx, z: gsz, yaw: yawG });
    const st = BUILD.clone().addScaledVector(rRight, (target.clone().sub(new THREE.Vector3(rx, 0, rz)).dot(rRight)) * 0.35);
    const sx = st.x, sz = st.z, fy = FYAW;
    tr.pose((tGrab + tPlace) / 2, 'carry', { x: lerp(gsx, sx, 0.55), z: lerp(gsz, sz, 0.55), yaw: lerp(yawG, fy, 0.6) });
    const pp = placePose(target.y + (opt.reach ?? 0));
    tr.pose(tPlace - 0.02, pp, { x: sx, z: sz, yaw: fy });
    tr.pose(tPlace + (opt.hold ?? 0.12), pp, { x: sx, z: sz, yaw: fy, lean: pp.lean + 4 });
    c.ev.push({ t: tGrab, kind: 'grab', fig: 'R' }, { t: tPlace - 0.06, kind: 'put', fig: 'R', p: target, dur: 0.16, ry: RYAW });
    fx.placeR.push(tPlace);
    fx.squashR.push([tPlace, 0.04]);
  };
  const g = i => robot[i].ev[0].p;
  carry(robot[0], 2.6, 3.1, g(0), parts[0].p);
  carry(robot[1], 3.45, 3.95, g(1), parts[1].p);
  carry(robot[2], 4.3, 4.8, g(2), parts[2].p);
  carry(robot[3], 5.1, 5.55, g(3), parts[3].p, { hold: 0.04 });
  // body R slips and falls to the right / toward the camera
  const s4 = parts[3].p;
  robot[3].ev.push({ t: 5.62, kind: 'slide', p: s4, dx: 0.07, rz: -0.35, dur: 0.14 });
  const sim = simFall(new THREE.Vector3(s4.x + 0.07, s4.y, s4.z), 0.45, 0.25, 0.32, -6.5, -0.35);
  robot[3].ev.push({ t: 5.76, kind: 'fall', sim, ry: 0 });
  fx.fallR = 5.76 + landTimeOf(sim);
  const e = sim.end;
  const bs = BUILD.clone().addScaledVector(rRight, 0.1);
  tr.pose(5.85, 'stand', { x: bs.x, z: bs.z, yaw: FYAW - 50, lean: -8, shLf: 30, shRf: 30, elL: 50, elR: 50, headPitch: 28 });
  fx.squashR.push([5.85, 0.06]);
  fx.pulseR = [6.2];
  // goes around and picks it up — no drama
  tr.pose(6.35, 'look', { x: lerp(bs.x, e.x - 0.4, 0.6), z: lerp(bs.z, e.z + 0.1, 0.6), yaw: yawTo(bs.x, bs.z, e.x, e.z), headPitch: 34 });
  tr.pose(6.6, 'grab', { x: e.x - 0.4, z: e.z + 0.1, yaw: yawTo(e.x - 0.4, e.z + 0.1, e.x, e.z) });
  robot[3].ev.push({ t: 6.6, kind: 'grab', fig: 'R' });
  tr.pose(6.85, 'carry', { x: bs.x, z: bs.z, yaw: FYAW });
  tr.pose(7.05, placePose(s4.y), { x: bs.x, z: bs.z, yaw: FYAW });
  tr.pose(7.15, placePose(s4.y), { x: bs.x, z: bs.z, yaw: FYAW, lean: 30 });
  robot[3].ev.push({ t: 6.99, kind: 'put', fig: 'R', p: s4, dur: 0.14, ry: RYAW });
  fx.placeR.push(7.05);
  carry(robot[4], 7.55, 8.05, g(4), parts[4].p, { reach: 0.3 });
  carry(robot[5], 8.4, 8.9, g(5), parts[5].p, { reach: 0.3 });
  carry(robot[6], 9.3, 9.9, g(6), parts[6].p, { reach: 0.2, hold: 0.2 });
  // walks around to the front-left of the robot and looks at it
  const FX = rx - 0.74, FZ = rz + 0.16, FY = yawTo(FX, FZ, rx, rz);
  tr.pose(10.45, 'stand', { x: lerp(BUILD.x, FX, 0.5), z: lerp(BUILD.z, FZ, 0.5), yaw: FY, headPitch: 10 });
  tr.pose(10.95, 'stand', { x: FX, z: FZ, yaw: FY, headPitch: 6 });
  tr.pose(11.6, 'stand', { x: FX, z: FZ, yaw: FY, headPitch: 4, lean: 10, shRf: 40, elR: 40 }); // touches the robot
  tr.pose(12.2, 'stand', { x: FX, z: FZ, yaw: FY, headPitch: 2 });
  tr.pose(12.45, 'stand', { x: FX, z: FZ, yaw: FY - 20, lean: 8, hipL: 25, kneeL: 45, hipR: 25, kneeR: 45, shLf: -15, shRf: -15, elL: 20, elR: 20 });
  tr.pose(12.72, 'cheer', { x: FX, z: FZ, yaw: FY - 30, lift: 0.07, glow: 1 });
  tr.pose(12.95, 'cheer', { x: FX, z: FZ, yaw: FY - 30, glow: 1 });
  tr.pose(13.8, 'cheer', { x: FX, z: FZ, yaw: FY - 44, glow: 1, shLs: 30, shRs: 30 });
  tr.pose(15.0, 'cheer', { x: FX, z: FZ, yaw: FY - 42, glow: 1, shLs: 24, shRs: 24, headPitch: -16 });
  fx.eyes = 12.4; fx.cheer = 12.72;
  fx.squashR.push([12.45, 0.06], [12.95, 0.08]);
}
fx.squashL = [];

// ---------- phones ----------
function makePhone() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new RoundedBoxGeometry(0.19, 0.34, 0.024, 3, 0.012), new THREE.MeshPhysicalMaterial({ color: 0x141c33, emissive: 0x2B54A5, emissiveIntensity: 0.9, roughness: 0.35, clearcoat: 0.8 }));
  body.castShadow = true; g.add(body);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.315), new THREE.MeshBasicMaterial({ color: 0x2B54A5, toneMapped: false }));
  scr.position.z = 0.0125; g.add(scr);
  const light = new THREE.PointLight(0x3b66d6, 0, 1.8, 1.6); scene.add(light);
  scene.add(g); return { g, scr, light, body };
}
const phL = makePhone(), phR = makePhone();
const PH_FLOOR = new THREE.Vector3(0.22, 0.014, 0.66);
const qHeld = new THREE.Quaternion(), qFloor = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0.5, 0, 'YXZ'));
function hash(n) { const r = rng(n * 7919 + 13); r(); return r(); }
function placePhone(ph, fig, t, k) {
  const hm = fig.handsMid(new THREE.Vector3());
  const yaw = fig.root.rotation.y;
  const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  hm.addScaledVector(fwd, 0.02).y += 0.03;
  qHeld.setFromEuler(new THREE.Euler(-52 * D2R, yaw + Math.PI, 0, 'YXZ'));
  ph.g.position.copy(hm); ph.g.quaternion.copy(qHeld);
  // "content" changes: the screen brightness steps
  const step = Math.floor(t * 2.6 + k * 0.37);
  const lvl = 0.75 + 0.5 * hash(step + k * 1000);
  ph.scr.material.color.setHex(0x2B54A5).multiplyScalar(lvl * 2.0);
  ph.light.position.copy(hm).addScaledVector(fwd, -0.16).y += 0.14;
  return lvl;
}

// ---------- lime rings ----------
const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(C.lime).multiplyScalar(3), transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
const rings = [0, 1, 2].map(() => { const m = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 96), ringMat.clone()); m.rotation.x = -Math.PI / 2; scene.add(m); return m; });
function squashAt(list, t) { let s = 0; for (const [t0, a] of list) { if (t >= t0) { const u = t - t0; s += a * Math.exp(-u * 9) * Math.cos(u * 22); } } return s; }
function gait(tr, t) { const a = tr.at(t - 0.03), b = tr.at(t + 0.03); return Math.hypot(b.x - a.x, b.z - a.z) / 0.06; }

// ---------- 2D composite ----------
const out = document.getElementById('out'); const ctx = out.getContext('2d');
const grains = []; { const r = rng(7); for (let g = 0; g < 4; g++) { const c = document.createElement('canvas'); c.width = 540; c.height = 960; const x = c.getContext('2d'); const id = x.createImageData(540, 960); for (let i = 0; i < id.data.length; i += 4) { const v = 128 + (r() - 0.5) * 90; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; } x.putImageData(id, 0, 0); grains.push(c); } }
const font = new FontFace('Mont', 'url(./assets/Montserrat-VF.ttf)', { weight: '100 900' });
await font.load(); document.fonts.add(font);
function spaced(text, x, y, px, weight, track, alpha, align = 'center', color = '255,255,255') {
  ctx.font = `${weight} ${px}px Mont`; ctx.letterSpacing = `${track * px}px`;
  const w = ctx.measureText(text).width - track * px;
  const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = `rgba(${color},${alpha})`;
  ctx.fillText(text, x0, y);
}
const LABEL_ANCHOR = { L: new THREE.Vector3(-0.78, 1.55, 0), R: new THREE.Vector3(0.75, 1.55, 0) };
function toScreen(v) { const p = v.clone().project(camera); return { x: (p.x + 1) / 2 * W, y: (1 - p.y) / 2 * H }; }
function composite(t, frame) {
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  ctx.drawImage(glCanvas, 0, 0);
  ctx.globalCompositeOperation = 'screen';
  let g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(20,33,63,1)'); g.addColorStop(0.42, 'rgba(14,22,46,0.75)'); g.addColorStop(0.72, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';
  g = ctx.createRadialGradient(W / 2, H * 0.55, H * 0.22, W / 2, H * 0.55, H * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.6)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // labels
  const la = toScreen(LABEL_ANCHOR.L), ra = toScreen(LABEL_ANCHOR.R);
  spaced('ЛИСТАЕТ', la.x, la.y - 44, 34, 700, 0.18, 0.85);
  spaced('ЧУЖОЕ', la.x, la.y, 34, 700, 0.18, 0.85);
  spaced('СОЗДАЁТ', ra.x, ra.y - 44, 34, 700, 0.18, 0.85);
  spaced('СВОЁ', ra.x, ra.y, 34, 700, 0.18, 0.85);
  // the same hour for both: 18:00 → 19:00
  const min = Math.min(60, Math.floor(clamp(t / 12) * 60));
  const clock = min >= 60 ? '19:00' : `18:${String(min).padStart(2, '0')}`;
  ctx.font = '700 44px Mont'; ctx.letterSpacing = '4px'; ctx.fontVariantNumeric = 'tabular-nums';
  spaced(clock, W / 2, 410, 44, 700, 0.08, 0.85);
  // moral
  const m = smooth(win(t, 8.0, 9.0)), m2 = smooth(win(t, 8.35, 9.35));
  if (m > 0) {
    spaced('ОДИН И ТОТ ЖЕ ЧАС.', W / 2, 545 + (1 - m) * 18, 44, 800, lerp(0.12, 0.06, m), m);
    spaced('РАЗНОЕ БУДУЩЕЕ.', W / 2, 605 + (1 - m2) * 18, 44, 800, lerp(0.12, 0.06, m2), m2, 'center', m2 > 0 ? '185,225,50' : '255,255,255');
  }
  // end card
  const e = smooth(win(t, 13.6, 14.0));
  if (e > 0) {
    g = ctx.createLinearGradient(0, 1380, 0, 1640);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, `rgba(0,0,0,${0.75 * e})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 1380, W, 260);
    const dy = (1 - e) * 14;
    spaced('СМОТРИТЕ ПОДРОБНОСТИ', W / 2, 1478 + dy, 34, 700, 0.14, 0.9 * e);
    spaced('В ОПИСАНИИ', W / 2, 1522 + dy, 34, 700, 0.14, 0.9 * e);
    const cy = 1566 + dy + Math.sin(t * 1.6 * Math.PI * 2) * 6;
    ctx.strokeStyle = `rgba(185,225,50,${e})`; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(W / 2 - 14, cy - 7); ctx.lineTo(W / 2, cy + 7); ctx.lineTo(W / 2 + 14, cy - 7); ctx.stroke();
  }
  ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.09;
  ctx.drawImage(grains[frame % 4], 0, 0, W, H);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}

// ---------- post ----------
const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
composer.setPixelRatio(1); composer.setSize(W, H);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), 0.45, 0.45, 1.05); composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------- frame ----------
const figs = { L: figL, R: figR };
function poseFigs(t) {
  for (const [name, f] of Object.entries(figs)) {
    const p = f.track.at(t);
    p.lean += Math.sin(t * 2.3 + (name === 'L' ? 1 : 0)) * 1.2;
    const sp = clamp(gait(f.track, t) / 1.2);
    if (sp > 0.02 && p.sit < 0.1) { const ph = t * 15; p.hipL += Math.sin(ph) * 22 * sp; p.hipR -= Math.sin(ph) * 22 * sp; p.kneeL += Math.max(0, -Math.sin(ph)) * 30 * sp; p.kneeR += Math.max(0, Math.sin(ph)) * 30 * sp; }
    // thumb flicks while holding the phone
    const scrolling = name === 'L' || t < 1.3;
    if (scrolling) { const fl = Math.max(0, Math.sin(t * 9 + (name === 'L' ? 0 : 2))) ** 6; p.elR += fl * 9; p.shRs += fl * 4; }
    p.squash = squashAt(name === 'L' ? fx.squashL : fx.squashR, t);
    f.apply(p);
  }
}
function update(t) {
  const dist = lerp(13.4, 12.6, smooth(win(t, 0, 15)));
  const tgt = new THREE.Vector3(0.06, 1.05, 0);
  camera.position.set(tgt.x, tgt.y + Math.sin(20 * D2R) * dist, Math.cos(20 * D2R) * dist);
  camera.lookAt(tgt);

  poseFigs(t);
  for (const c of cubes) evalCube(c, t, figs);
  poseFigs(t);

  // robot wakes: hop + head turn toward the kid
  const hop = t > 12.62 ? Math.max(0, Math.sin(win(t, 12.62, 12.98) * Math.PI)) * 0.13 + Math.max(0, Math.sin(win(t, 13.35, 13.62) * Math.PI)) * 0.06 : 0;
  for (const c of robot) if (t > 10) c.m.position.y += hop;
  const turn = smooth(win(t, 12.45, 12.85));
  if (t > 10) { robot[6].m.rotation.set(lerp(0, -0.22, turn), RYAW + lerp(0, -0.62, turn) + (t > 13 ? Math.sin((t - 13) * 2.2) * 0.1 : 0), 0, 'YXZ'); }
  if (t > 10) { const a = smooth(win(t, 12.62, 12.9)); robot[4].m.rotation.set(0, RYAW, 0.5 * a, 'YXZ'); robot[5].m.rotation.set(0, RYAW, -0.5 * a, 'YXZ'); }
  const eyes = smooth(win(t, fx.eyes, fx.eyes + 0.12));
  const blink = t > 13.9 && t < 14.0 ? 0.15 : 1;
  eyeMat.color.setHex(0x0b0f1a).lerp(new THREE.Color(C.lime).multiplyScalar(5), eyes * blink);

  // phones
  const lvlL = placePhone(phL, figL, t, 0);
  const grow = smooth(win(t, 1.5, 12));
  phL.scr.material.color.multiplyScalar(lerp(1, 1.35, grow));
  phL.light.intensity = lerp(0.5, 1.5, grow) * (0.85 + 0.25 * lvlL);
  if (t < 1.45) { const l = placePhone(phR, figR, t, 1); phR.light.intensity = 0.5 * (0.85 + 0.25 * l); }
  else {
    const held = new THREE.Vector3(); placePhone(phR, figR, Math.min(t, 1.45), 1);
    const s = smooth(win(t, 1.45, fx.phoneDown + 0.05));
    if (s < 1) { held.copy(phR.g.position); const q = phR.g.quaternion.clone(); placePhone(phR, figR, t, 1); phR.g.position.lerp(PH_FLOOR, s); phR.g.quaternion.slerp(qFloor, s); }
    else { phR.g.position.copy(PH_FLOOR); phR.g.quaternion.copy(qFloor); }
    phR.light.intensity = 0.5 * (1 - smooth(win(t, 1.5, fx.phoneDown + 0.05)));
    phR.scr.material.color.multiplyScalar(1 - smooth(win(t, 1.55, fx.phoneDown + 0.1)));
    phR.body.material.emissiveIntensity = 0.9 * (1 - smooth(win(t, 1.5, fx.phoneDown + 0.05)));
  }

  // lime pulses
  const pulses = [...fx.pulseR.map(t0 => [t0, 1]), [fx.cheer, 1.3], [fx.cheer + 0.5, 1.0], [fx.cheer + 1.2, 0.8]];
  let used = 0; rings.forEach(r => (r.visible = false));
  let limeBoost = 0;
  for (const [t0, k] of pulses) {
    const u = t - t0; if (u < 0 || u > 1.3) continue;
    const r = rings[used++ % rings.length]; r.visible = true;
    const s = easeOut(clamp(u / 1.3));
    r.scale.setScalar(lerp(0.25, 1.05 * k, s));
    const cx = t0 > 12 ? (figR.root.position.x + rx) / 2 : figR.root.position.x;
    r.position.set(cx, 0.012, t0 > 12 ? (figR.root.position.z + rz) / 2 : figR.root.position.z);
    r.material.opacity = (1 - s) * 0.9; limeBoost = Math.max(limeBoost, (1 - s));
  }
  const glow = figR.mat.emissiveIntensity / 0.16;
  limeLight.position.set((figR.root.position.x + rx) / 2, 0.9, 0.5);
  limeLight.intensity = 1.0 * limeBoost + 0.8 * glow + 0.4 * eyes;

  // the scroller's side sinks into the dark, the builder's side warms
  spotL.intensity = lerp(26, 11, smooth(win(t, 2, 12)));
  spotL.target.position.set(LX, 0.4, 0);
  spotR.intensity = lerp(26, 33, smooth(win(t, 12.3, 13.2)));
  spotR.target.position.set(0.6, 0.5, 0);
  bloom.strength = 0.45 + 0.12 * glow;
}

window.renderFrame = (frame) => {
  const t = frame / FPS;
  update(t);
  composer.render();
  composite(t, frame);
  return out.toDataURL('image/png');
};
window.ready = true;
