// Ep 12 · neuron style — two faceless kids climb cube staircases. Deterministic: frame -> picture.
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

// ---------- staircases ----------
const S = 0.26, HS = S / 2, NSTEP = 8;
const stepGeo = new RoundedBoxGeometry(S, S, S, 5, 0.04);
const ANG = 46 * D2R;
const SIDES = {
  L: { dir: -1, base: new THREE.Vector3(-0.42, 0, 0.55) },
  R: { dir: 1, base: new THREE.Vector3(0.42, 0, 0.55) },
};
for (const s of Object.values(SIDES)) {
  s.u = new THREE.Vector3(s.dir * Math.sin(ANG), 0, -Math.cos(ANG)); // climbing direction
  s.yaw = Math.atan2(s.u.x, s.u.z) / D2R;
  s.tops = [];
}
// along-path distance of each standing spot: k = 0 floor in front, 1..8 step tops
const dAt = k => (k === 0 ? -0.36 : (k - 1) * S);
const spotPos = (side, k) => side.base.clone().addScaledVector(side.u, dAt(k)).setY(k * S);
for (const [name, side] of Object.entries(SIDES)) {
  for (let k = 1; k <= NSTEP; k++) {
    const c = side.base.clone().addScaledVector(side.u, dAt(k));
    for (let j = 0; j < k; j++) {
      const top = j === k - 1;
      const mat = top ? new THREE.MeshPhysicalMaterial({ color: cubeTints[(k + j) % 4], roughness: 0.5, clearcoat: 0.25, clearcoatRoughness: 0.4, emissive: C.lime, emissiveIntensity: 0 }) : cubeMats[(k + j) % 4];
      const m = new THREE.Mesh(stepGeo, mat); m.castShadow = true; m.receiveShadow = true;
      m.position.set(c.x, HS + j * S, c.z); m.rotation.y = side.yaw * D2R;
      scene.add(m);
      if (top) side.tops[k] = m;
    }
  }
}

// ---------- movement schedule ----------
// moves: { t, dur, from, to, kind: 'up' | 'run' | 'back' }
class Mover {
  constructor(side, k0) { this.side = side; this.k0 = k0; this.moves = []; }
  move(t, dur, from, to, kind) { this.moves.push({ t, dur, from, to, kind }); return this; }
  at(t) { // { pos, kRest, hop (0..1 or -1), move }
    let k = this.k0;
    for (const m of this.moves) {
      if (t < m.t) break;
      if (t < m.t + m.dur) {
        const s = (t - m.t) / m.dur;
        const a = spotPos(this.side, m.from), b = spotPos(this.side, m.to);
        const e = m.kind === 'back' ? smooth(s) : smooth(s);
        const p = a.clone().lerp(b, e);
        const arc = m.kind === 'back' ? 0.05 : m.kind === 'run' ? 0.09 : 0.13;
        p.y = lerp(a.y, b.y, e) + Math.sin(Math.PI * s) * arc;
        return { pos: p, hop: s, move: m };
      }
      k = m.to;
    }
    return { pos: spotPos(this.side, k), hop: -1, k };
  }
}

const figL = new Figure(), figR = new Figure();
const fx = { landL: [], landR: [], burst: [], slide: [] };

// LEFT: one calm step every ~1.45 s
const mvL = new Mover(SIDES.L, 0);
const trL = new Track(P.stand);
{
  for (let i = 0; i < NSTEP; i++) {
    const t0 = 1.0 + 1.45 * i, d = 0.44;
    mvL.move(t0, d, i, i + 1, 'up');
    const name = i % 2 ? 'stepUpR' : 'stepUp';
    trL.pose(t0 - 0.12, 'stand', { lean: 10, hipL: 18, kneeL: 30, hipR: 18, kneeR: 30, shLf: -10, shRf: -10, elL: 20, elR: 20 }); // gather
    trL.pose(t0 + d * 0.45, name);
    trL.pose(t0 + d, 'stand', { lean: 6, hipL: 10, kneeL: 18, hipR: 10, kneeR: 18 });
    trL.pose(t0 + d + 0.35, 'stand', { headPitch: i < 7 ? -10 : 0 });
    fx.landL.push(t0 + d);
  }
  const top = 1.0 + 1.45 * 7 + 0.44; // ≈ 11.59
  trL.pose(top + 0.4, 'stand', { headPitch: -4 });
  trL.pose(12.35, 'stand', { lean: 8, hipL: 25, kneeL: 45, hipR: 25, kneeR: 45, shLf: -15, shRf: -15, elL: 20, elR: 20 });
  trL.pose(12.62, 'cheer', { lift: 0.06, glow: 1 });
  trL.pose(12.85, 'cheer', { glow: 1 });
  trL.pose(13.6, 'cheer', { glow: 1, shLs: 30, shRs: 30 });
  trL.pose(14.3, 'cheer', { glow: 1, shLs: 22, shRs: 22, headPitch: -26 });
  trL.pose(15.0, 'cheer', { glow: 1, shLs: 26, shRs: 26 });
  fx.cheer = 12.62;
}
// yaw of the left kid: faces up the stairs, turns to camera on the top
const yawL = t => lerp(SIDES.L.yaw, 18, smooth(win(t, 11.75, 12.3)));

// RIGHT: sleeps, bursts, gets tired, slides back, sits; again
const mvR = new Mover(SIDES.R, 0);
const trR = new Track(P.sitHug);
const SIT = { ...P.sitHug, scale: 1 };
const TIRED = { lean: 48, headPitch: 30, hipL: 40, kneeL: 55, hipR: 40, kneeR: 55, shLf: 62, shRf: 62, elL: 22, elR: 22, shLs: -6, shRs: -6 };
const SLUMP = { lean: 22, headPitch: 36, shLf: 4, shRf: 4, elL: 6, elR: 6, hipL: 10, kneeL: 20, hipR: 10, kneeR: 20 };
{
  trR.keys[0] = { t: 0, p: pose(SIT, { headPitch: 44, lean: 38 }) };
  trR.pose(2.3, SIT, { headPitch: 46, lean: 40 });
  trR.pose(2.75, 'stand', { lean: 18, headPitch: -12, hipL: 30, kneeL: 50, hipR: 30, kneeR: 50 }); // jumps up
  // burst 1: four fast steps 0 → 4
  let t = 2.95; fx.burst.push(t);
  for (let i = 0; i < 4; i++) {
    const d = 0.27; mvR.move(t, d, i, i + 1, 'run');
    trR.pose(t + d * 0.45, i % 2 ? 'stepUpR' : 'stepUp', { lean: 30, shLf: i % 2 ? 60 : -40, shRf: i % 2 ? -40 : 60 });
    trR.pose(t + d, 'stand', { lean: 20, hipL: 14, kneeL: 24, hipR: 14, kneeR: 24 });
    fx.landR.push(t + d); t += d + 0.02;
  }
  // tired: hands on knees, heaving
  trR.pose(t + 0.3, TIRED);
  trR.pose(t + 1.3, TIRED, { lean: 52, headPitch: 34 });
  // slides back down 4 → 2 (stepping backward, slumped)
  let tb = 5.35; fx.slide.push(tb);
  for (let i = 0; i < 2; i++) {
    const d = 0.5; mvR.move(tb, d, 4 - i, 3 - i, 'back');
    trR.pose(tb + d * 0.5, SLUMP, { lift: 0.02, shLf: 18, shRf: 18, elL: 30, elR: 30 });
    trR.pose(tb + d, SLUMP, { hipL: 22, kneeL: 40, hipR: 22, kneeR: 40 });
    fx.landR.push(tb + d); tb += d + 0.22;
  }
  trR.pose(7.0, SIT, { headPitch: 40, lean: 34 });
  trR.pose(8.15, SIT, { headPitch: 42, lean: 36 });
  trR.pose(8.55, 'stand', { lean: 18, headPitch: -12, hipL: 30, kneeL: 50, hipR: 30, kneeR: 50 });
  // burst 2: 2 → 5
  t = 8.75; fx.burst.push(t);
  for (let i = 0; i < 3; i++) {
    const d = 0.27; mvR.move(t, d, 2 + i, 3 + i, 'run');
    trR.pose(t + d * 0.45, i % 2 ? 'stepUpR' : 'stepUp', { lean: 30, shLf: i % 2 ? 60 : -40, shRf: i % 2 ? -40 : 60 });
    trR.pose(t + d, 'stand', { lean: 20, hipL: 14, kneeL: 24, hipR: 14, kneeR: 24 });
    fx.landR.push(t + d); t += d + 0.02;
  }
  trR.pose(t + 0.3, TIRED);
  trR.pose(10.35, TIRED, { lean: 52, headPitch: 34 });
  tb = 10.5; fx.slide.push(tb);
  for (let i = 0; i < 2; i++) {
    const d = 0.5; mvR.move(tb, d, 5 - i, 4 - i, 'back');
    trR.pose(tb + d * 0.5, SLUMP, { lift: 0.02, shLf: 18, shRf: 18, elL: 30, elR: 30 });
    trR.pose(tb + d, SLUMP, { hipL: 22, kneeL: 40, hipR: 22, kneeR: 40 });
    fx.landR.push(tb + d); tb += d + 0.22;
  }
  trR.pose(12.0, SIT, { headPitch: 40, lean: 34 });
  // looks up at the left kid on the top
  trR.pose(12.6, SIT, { lean: 12, headPitch: -32, headYaw: 0, headRoll: -6 });
  trR.pose(15.0, SIT, { lean: 10, headPitch: -36, headRoll: -6 });
}
// right kid yaw: faces up its stairs; when sitting, sits facing the camera-ish; at the end turns toward the left kid
const yawR = t => {
  let y = SIDES.R.yaw;
  const sit1 = smooth(win(t, 6.6, 7.0)) * (1 - smooth(win(t, 8.2, 8.55)));
  const sit0 = 1 - smooth(win(t, 2.3, 2.75));
  const sit2 = smooth(win(t, 11.6, 12.0));
  y = lerp(y, 20, Math.max(sit0, sit1, sit2));
  return lerp(y, -55, smooth(win(t, 12.2, 12.9)));
};

// ---------- lime rings ----------
const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(C.lime).multiplyScalar(3), transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
const rings = [0, 1, 2].map(() => { const m = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 96), ringMat.clone()); m.rotation.x = -Math.PI / 2; scene.add(m); return m; });

function squashAt(list, t) { let s = 0; for (const [t0, a] of list) { if (t >= t0) { const u = t - t0; s += a * Math.exp(-u * 9) * Math.cos(u * 22); } } return s; }
fx.squashL = [...fx.landL.map(t => [t, 0.08]), [12.35, 0.06], [12.85, 0.08]];
fx.squashR = [...fx.landR.map(t => [t, 0.07]), [2.75, 0.06], [8.55, 0.06]];

// ---------- 2D composite ----------
const out = document.getElementById('out'); const ctx = out.getContext('2d');
const grains = []; { const r = rng(7); for (let g = 0; g < 4; g++) { const c = document.createElement('canvas'); c.width = 540; c.height = 960; const x = c.getContext('2d'); const id = x.createImageData(540, 960); for (let i = 0; i < id.data.length; i += 4) { const v = 128 + (r() - 0.5) * 90; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; } x.putImageData(id, 0, 0); grains.push(c); } }
const font = new FontFace('Mont', 'url(./assets/Montserrat-VF.ttf)', { weight: '100 900' });
await font.load(); document.fonts.add(font);

function spaced(text, x, y, px, weight, track, alpha, align = 'center', color = '255,255,255') {
  ctx.font = `${weight} ${px}px Mont`; ctx.letterSpacing = `${track * px}px`;
  const w = ctx.measureText(text).width - track * px; // trailing tracking
  const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = `rgba(${color},${alpha})`;
  ctx.fillText(text, x0, y);
}

function toScreen(v) { const p = v.clone().project(camera); return { x: (p.x + 1) / 2 * W, y: (1 - p.y) / 2 * H }; }
function endCard(t) {
  const a = smooth(win(t, 13.6, 14.0)); if (a <= 0) return;
  const g = ctx.createLinearGradient(0, 1380, 0, 1640);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, `rgba(0,0,0,${0.75 * a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 1380, W, 260);
  const dy = (1 - a) * 14;
  spaced('СМОТРИТЕ ПОДРОБНОСТИ', W / 2, 1478 + dy, 34, 700, 0.14, 0.9 * a);
  spaced('В ОПИСАНИИ', W / 2, 1522 + dy, 34, 700, 0.14, 0.9 * a);
  const by = 1566 + dy + Math.sin(t * 1.6 * 2 * Math.PI) * 6;
  ctx.strokeStyle = `rgba(185,225,50,${a})`; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(W / 2 - 14, by - 7); ctx.lineTo(W / 2, by + 7); ctx.lineTo(W / 2 + 14, by - 7); ctx.stroke();
}
const LBL = { L: null, R: null };
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
  // labels: above the top step of each staircase (fixed from frame 0)
  const la = 0.85 * (1 - smooth(win(t, 13.3, 13.7))); // labels give way to the end card
  spaced('15 МИНУТ', LBL.L.x, LBL.L.y - 44, 34, 700, 0.18, la);
  spaced('КАЖДЫЙ ДЕНЬ', LBL.L.x, LBL.L.y, 34, 700, 0.18, la);
  spaced('3 ЧАСА', LBL.R.x, LBL.R.y - 44, 34, 700, 0.18, la);
  spaced('РАЗ В МЕСЯЦ', LBL.R.x, LBL.R.y, 34, 700, 0.18, la);
  // day counter
  const day = Math.min(30, 1 + Math.floor(29 * clamp(t / 12)));
  const m = smooth(win(t, 8.0, 9.0)), m2 = smooth(win(t, 8.35, 9.35));
  const tick = Math.exp(-((t * 29 / 12) % 1) * 6) * (t < 12 ? 1 : 0);
  spaced(`ДЕНЬ ${day}`, W / 2, 400, 40, 700, 0.12, lerp(0.85, 0.55, m) + 0.1 * tick, 'center', day === 30 ? '205,235,110' : '255,255,255');
  if (m > 0) {
    spaced('НЕ ТАЛАНТ.', W / 2, 545 + (1 - m) * 18, 44, 800, lerp(0.12, 0.06, m), m);
    spaced('ПРИВЫЧКА.', W / 2, 605 + (1 - m2) * 18, 44, 800, lerp(0.12, 0.06, m2), m2, 'center', '205,235,110');
  }
  endCard(t);
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
const CAM = { dist: 21.8, elev: 18, ty: 1.3 };
function setCam(t) {
  const dist = lerp(CAM.dist, CAM.dist - 0.8, smooth(win(t, 0, 15)));
  const tgt = new THREE.Vector3(0, CAM.ty, -0.3);
  camera.position.set(tgt.x, tgt.y + Math.sin(CAM.elev * D2R) * dist, tgt.z + Math.cos(CAM.elev * D2R) * dist);
  camera.lookAt(tgt); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
}
setCam(0);
for (const n of ['L', 'R']) {
  // labels on the floor in front of each staircase (the top is where the kid ends up)
  const mid = SIDES[n].base.clone().addScaledVector(SIDES[n].u, 0.9).setY(0); mid.z += 0.9;
  const p = toScreen(mid); LBL[n] = { x: clamp(p.x, 200, 880), y: p.y + 120 };
}
// key lights aim at each staircase
for (const [sp, n] of [[spotL, 'L'], [spotR, 'R']]) {
  const mid = spotPos(SIDES[n], 4); sp.position.set(mid.x * 0.7, 8, 3.4); sp.target.position.set(mid.x, 0.8, mid.z);
}
redLight.intensity = 0;

function placeFig(f, tr, mv, yaw, t, squash) {
  const p = tr.at(t); const m = mv.at(t);
  p.lean += Math.sin(t * 2.3 + (f === figL ? 1 : 0)) * 1.2;
  p.x = m.pos.x; p.z = m.pos.z; p.gy = m.pos.y; p.yaw = yaw(t);
  p.squash = squashAt(squash, t);
  f.apply(p);
}
function update(t) {
  setCam(t);
  placeFig(figL, trL, mvL, yawL, t, fx.squashL);
  placeFig(figR, trR, mvR, yawR, t, fx.squashR);
  // right kid breathing hard when tired
  // lime ticks on the left steps
  SIDES.L.tops.forEach((m, k) => { if (!m) return; const tl = fx.landL[k - 1]; const u = t - tl; m.material.emissiveIntensity = u >= 0 ? (k === NSTEP ? 0.35 + 0.9 * Math.exp(-u * 3) : 0.12 + 1.1 * Math.exp(-u * 3.5)) : 0; });
  // lime rings on the cheer
  const pulses = [[fx.cheer, 1.3], [fx.cheer + 0.5, 1.0], [fx.cheer + 1.2, 0.8]];
  rings.forEach(r => (r.visible = false)); let used = 0, boost = 0;
  for (const [t0, k] of pulses) {
    const u = t - t0; if (u < 0 || u > 1.3) continue;
    const r = rings[used++]; r.visible = true; const s = easeOut(clamp(u / 1.3));
    r.scale.setScalar(lerp(0.2, 0.8 * k, s)); r.position.set(figL.root.position.x, figL.root.position.y + 0.012, figL.root.position.z);
    r.material.opacity = (1 - s) * 0.9; boost = Math.max(boost, 1 - s);
  }
  const glow = figL.mat.emissiveIntensity / 0.16;
  limeLight.position.set(figL.root.position.x, figL.root.position.y + 0.9, figL.root.position.z + 0.45);
  limeLight.intensity = 2.0 * boost + 2.2 * glow;
  spotL.intensity = lerp(28, 34, smooth(win(t, 12.3, 13.2)));
  spotR.intensity = lerp(28, 20, smooth(win(t, 11.5, 12.8)));
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
