// Ep 10 · neuron style — "they do it for him / they let him try". Deterministic: frame -> picture.
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


// ---------- ep10: figure opacity (parents fade into the dark) ----------
const _apply = Figure.prototype.apply;
Figure.prototype.apply = function (p) {
  _apply.call(this, p);
  const op = p.op ?? 1;
  const tr = op < 0.999;
  if (this.mat.transparent !== tr) { this.mat.transparent = tr; this.mat.needsUpdate = true; }
  this.mat.opacity = op;
  this.root.visible = op > 0.01;
  const sh = op > 0.55;
  if (this._sh !== sh) { this._sh = sh; this.root.traverse(o => { if (o.isMesh) o.castShadow = sh; }); }
};

// ---------- poses ----------
const BASE = { lean: 0, headPitch: 0, headYaw: 0, headRoll: 0, shLf: 6, shLs: 6, elL: 12, shRf: 6, shRs: 6, elR: 12, hipL: 0, kneeL: 0, hipR: 0, kneeR: 0, hipLs: 3, hipRs: 3, sit: 0, sitY: 0.13, lift: 0, x: 0, z: 0, yaw: 0, gy: 0, scale: 1, glow: 0, squash: 0, op: 1 };
const KNEEL = { hipL: 82, kneeL: 92, hipR: 5, kneeR: 95, hipLs: 6, hipRs: 4, lean: 6, headPitch: 14, shLf: 16, shRf: 16, elL: 35, elR: 35, shLs: -2, shRs: -2 };
const P = {
  stand: {},
  look: { headPitch: 28, lean: 6 },
  carry: { shLf: 48, shRf: 48, elL: 58, elR: 58, shLs: -3, shRs: -3, lean: 4, headPitch: 12 },
  grab: { lean: 52, headPitch: 22, hipL: 72, kneeL: 108, hipR: 72, kneeR: 108, shLf: 8, shRf: 8, elL: 18, elR: 18, shLs: -4, shRs: -4 },
  sitHug: { sit: 1, hipL: 128, kneeL: 146, hipR: 124, kneeR: 140, hipLs: 7, hipRs: 7, lean: 32, headPitch: 34, shLf: 50, shRf: 50, elL: 80, elR: 80, shLs: -14, shRs: -14, scale: 0.9 },
  stepUp: { hipL: 78, kneeL: 92, lean: 18, shLf: -20, shRf: 34, elL: 25, elR: 30, headPitch: 8 },
  stepUpR: { hipR: 78, kneeR: 92, lean: 18, shRf: -20, shLf: 34, elL: 30, elR: 25, headPitch: 8 },
  cheer: { shLf: 168, shRf: 168, shLs: 24, shRs: 24, elL: 6, elR: 6, headPitch: -22, lean: -6 },
  kneel: KNEEL,
  kneelReach: { ...KNEEL, lean: 40, headPitch: 26, shLf: 62, shRf: 62, elL: 10, elR: 10 },
  kneelOffer: { ...KNEEL, lean: 16, headPitch: 20, shLf: 74, shRf: 74, elL: 16, elR: 16, shLs: -5, shRs: -5 },
  kneelNod: { ...KNEEL, lean: 10, headPitch: 30, shLf: 22, shRf: 22, elL: 40, elR: 40 },
  take: { shLf: 80, shRf: 80, elL: 12, elR: 12, lean: 10, headPitch: 8, shLs: -5, shRs: -5 },
  reach: { shLf: 82, shRf: 82, elL: 10, elR: 10, lean: 12, headPitch: -4, shLs: -6, shRs: -6 },
  hands: { shLf: 48, shRf: 48, elL: 98, elR: 98, shLs: -10, shRs: -10, headPitch: 44, lean: 14 },
};
function placePose(h) { // h = slot centre height in the figure's own units
  if (h < 0.3) return { lean: 40, headPitch: 20, hipL: 62, kneeL: 92, hipR: 62, kneeR: 92, shLf: 30, shRf: 30, elL: 14, elR: 14, shLs: -4, shRs: -4 };
  if (h < 0.6) return { lean: 26, headPitch: 18, hipL: 30, kneeL: 45, hipR: 30, kneeR: 45, shLf: 52, shRf: 52, elL: 12, elR: 12, shLs: -4, shRs: -4 };
  if (h < 0.9) return { lean: 10, headPitch: 6, shLf: 78, shRf: 78, elL: 14, elR: 14, shLs: -4, shRs: -4 };
  return { lean: 4, headPitch: -18, shLf: 118, shRf: 118, elL: 16, elR: 16, shLs: -4, shRs: -4, lift: 0.04 };
}
const pose = (...parts) => Object.assign({}, BASE, ...parts);

class Track {
  constructor(start) { this.keys = [{ t: 0, p: pose(start) }]; }
  pose(t, name, extra = {}) {
    const prev = this.keys[this.keys.length - 1].p;
    if (t <= this.keys[this.keys.length - 1].t) throw new Error(`track keys out of order at ${t}`);
    const p = pose(typeof name === 'string' ? P[name] : name, { x: prev.x, z: prev.z, yaw: prev.yaw, gy: prev.gy, scale: prev.scale, glow: prev.glow, op: prev.op }, extra);
    this.keys.push({ t, p }); return this;
  }
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
const PS = 1.43; // parent scale
const yawTo = (fx, fz, tx, tz) => Math.atan2(tx - fx, tz - fz) / D2R;
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const LT = -1.6;                    // left: the parent's tower (one column)
const RT = 1.5, RD = 1;              // right: the child's stairs, columns go toward the centre
const slotL = (lev) => v3(LT, HC + lev * CS, 0);
const slotR = (col, lev) => v3(RT - col * CS, HC + lev * CS, 0);

// ---------- cubes ----------
const cubes = [];
function makeCube(tint, p, ry = 0) { const m = new THREE.Mesh(cubeGeo, cubeMats[tint % cubeMats.length]); m.castShadow = true; m.receiveShadow = true; scene.add(m); const c = { m, ev: [] }; cubes.push(c); if (p) c.ev.push({ t: 0, kind: 'at', p, ry: ry * D2R }); return c; }

function simFall(p0, vx, vy, vz, w, rz0 = 0) {
  const out = []; let x = p0.x, y = p0.y, z = p0.z, rz = rz0, dt = 1 / 600, t = 0, rest = false, bounces = 0;
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
      const target = Math.round(rz / (Math.PI / 2)) * (Math.PI / 2);
      rz += (target - rz) * 0.02; vx *= 0.985; vz *= 0.985; x += vx * dt; z += vz * dt;
      y = HC * (Math.abs(Math.cos(rz)) + Math.abs(Math.sin(rz)));
    }
    if (Math.round(t * 600) % 5 === 0) out.push({ x, y, z, rz });
    t += dt;
  }
  return { samples: out, end: out[out.length - 1] };
}
function landTimeOf(sim) { const s = sim.samples; for (let i = 1; i < s.length; i++) if (s[i].y <= HC * (Math.abs(Math.cos(s[i].rz)) + Math.abs(Math.sin(s[i].rz))) + 1e-4) return i / 120; return 0.4; }

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
      pos.copy(hp).lerp(e.p, s); ry = lerp(fy, 0, s); rz = 0;
      if (tt >= e.t + e.dur) pos.copy(e.p);
    } else if (e.kind === 'fall') {
      const k = Math.min(e.sim.samples.length - 1, Math.floor((tt - e.t) * 120));
      const sm = e.sim.samples[k]; pos.set(sm.x, sm.y, sm.z); rz = sm.rz; ry = e.ry || 0;
    } else if (e.kind === 'slide') {
      const s = easeIn(win(tt, e.t, e.t + e.dur)); pos.copy(e.p).add(new THREE.Vector3(e.dx * s, 0, 0)); rz = e.rz * s; ry = 0;
    }
    state = { pos: pos.clone(), ry, rz };
  }
  c.m.position.copy(pos); c.m.rotation.set(0, ry, rz, 'YXZ');
}

// ---------- characters ----------
const kidL = new Figure(), momL = new Figure(), kidR = new Figure(), momR = new Figure();
const figs = { L: kidL, LP: momL, R: kidR, RP: momR };
for (const f of Object.values(figs)) f.handsMidAt = function (t, out) { this.apply(this.track.at(t)); return this.handsMid(out); };
const fx = { squash: { L: [], LP: [], R: [], RP: [] } };

// fetch a cube from gp and put it in slot sl; figure walks from `from` (x,z) and places standing at `stand` facing `face`
function fetchPlace(tr, cube, name, sc, tGrab, tPlace, gp, sl, stand, face, from, opt = {}) {
  const len = Math.hypot(from[0] - gp.x, from[1] - gp.z) || 1, R = 0.42 * sc;
  const gx = gp.x + (from[0] - gp.x) / len * R, gz = gp.z + (from[1] - gp.z) / len * R;
  const yawG = yawTo(gx, gz, gp.x, gp.z);
  const pre = opt.pre ?? 0.26;
  tr.pose(tGrab - pre, 'look', { x: lerp(from[0], gx, 0.55), z: lerp(from[1], gz, 0.55), yaw: yawG });
  tr.pose(tGrab, 'grab', { x: gx, z: gz, yaw: yawG });
  tr.pose((tGrab + tPlace) / 2, 'carry', { x: lerp(gx, stand[0], 0.55), z: lerp(gz, stand[1], 0.55), yaw: lerp(yawG, face, 0.6) });
  const pp = placePose(sl.y / sc);
  tr.pose(tPlace - 0.02, pp, { x: stand[0], z: stand[1], yaw: face });
  tr.pose(tPlace + (opt.hold ?? 0.12), pp, { x: stand[0], z: stand[1], yaw: face, lean: pp.lean + 4 });
  cube.ev.push({ t: tGrab, kind: 'grab', fig: name }, { t: tPlace - 0.06, kind: 'put', fig: name, p: sl, dur: 0.16 });
}

// ===== LEFT: the parent does everything =====
{
  makeCube(0, slotL(0));
  const pile = [[-1.05, -0.62, 8], [-1.38, -0.66, -6], [-1.2, -0.98, 4], [-0.88, -0.95, -9], [-1.56, -1.0, 12], [-0.74, -0.6, -4], [-0.56, -0.92, 10]]
    .map(([x, z, r], i) => makeCube(i + 1, v3(x, HC, z), r));
  const tr = momL.track = new Track({});
  const MX = -1.1, face = -90;
  // t=0: already carrying cube L1
  const c1 = makeCube(2); c1.ev.push({ t: 0, kind: 'grab', fig: 'LP', blend: 0 }, { t: 0.3, kind: 'put', fig: 'LP', p: slotL(1), dur: 0.2 });
  tr.keys[0] = { t: 0, p: pose(P.carry, { shLf: 66, shRf: 66, elL: 30, elR: 30, lean: 8, headPitch: 10, x: MX, yaw: face, scale: PS }) };
  tr.pose(0.3, placePose(0.45 / PS), { x: MX, yaw: face });
  tr.pose(0.48, placePose(0.45 / PS), { x: MX, yaw: face, lean: 30 });
  const plan = [[0.74, 1.2], [1.64, 2.12], [2.56, 3.06], [3.5, 4.06], [4.5, 5.12]]; // fast, neat
  let from = [MX, 0];
  plan.forEach(([g, p], i) => {
    fetchPlace(tr, pile[i], 'LP', PS, g, p, pile[i].ev[0].p, slotL(2 + i), [MX, 0], face, from, { pre: 0.22, hold: 0.1 });
    from = [MX, 0];
  });
  fx.placeL = [0.3, ...plan.map(p => p[1])];
  // admires the perfect tower, looks at the child, leaves into the dark
  tr.pose(5.7, 'stand', { x: MX, z: 0.02, yaw: -55, headPitch: -24, shLf: 12, shRf: 12 });
  tr.pose(6.4, 'stand', { x: MX, yaw: -55, headPitch: -26 });
  tr.pose(6.85, 'stand', { x: MX, yaw: 70, headPitch: 18, lean: 6 });
  tr.pose(7.2, 'stand', { x: MX, yaw: 72, headPitch: 16, lean: 4 });
  tr.pose(7.45, 'stand', { x: MX - 0.05, z: -0.06, yaw: -150 });
  tr.pose(8.0, 'stand', { x: -1.86, z: -0.58, yaw: -168, op: 0.75 });
  tr.pose(8.9, 'stand', { x: -1.98, z: -2.3, yaw: -175, op: 0 });
  tr.pose(15, 'stand', { x: -1.98, z: -2.3, yaw: -175, op: 0 });
}
{
  const tr = kidL.track = new Track({});
  const KX = -0.58, KZ = 0.14;
  tr.keys[0] = { t: 0, p: pose({ x: KX, z: KZ, yaw: -80, headPitch: -4 }) };
  tr.pose(0.35, 'stand', { headPitch: 8 });
  tr.pose(1.25, 'stand', { yaw: -95, headYaw: -12, headPitch: 4 });
  tr.pose(1.75, 'reach', { x: KX - 0.06, yaw: -100 });             // "let me!"
  tr.pose(2.12, 'reach', { x: KX - 0.06, yaw: -100, headPitch: -12 });
  tr.pose(2.5, 'stand', { x: KX, yaw: -90, headPitch: 20, lean: 6 }); // the parent got there first
  tr.pose(3.05, 'stand', { yaw: -88, headPitch: -12 });
  tr.pose(3.6, { shLf: 60, elL: 20, shLs: -4, lean: 6, headPitch: -2 }, { yaw: -96 }); // smaller second try, one hand
  tr.pose(4.0, { shLf: 56, elL: 24, shLs: -4, lean: 6, headPitch: -8 }, { yaw: -96 });
  tr.pose(4.4, 'stand', { yaw: -88, headPitch: 18, lean: 5 });
  tr.pose(5.15, 'stand', { yaw: -84, headPitch: -26, lean: -4 });   // looks up at the tall tower
  tr.pose(6.3, 'stand', { yaw: -84, headPitch: -28, lean: -4 });
  tr.pose(6.95, 'stand', { yaw: -100, headPitch: -16 });             // the parent looks down at them
  tr.pose(7.6, 'stand', { yaw: -135, headPitch: 0, headYaw: -20 }); // watches the parent leave
  // alone: tries to start their own tower
  const base = v3(-1.05, HC, 0.36);
  const own1 = cubes[6], own2 = cubes[7];
  fetchPlace(tr, own1, 'L', 1, 8.35, 8.95, own1.ev[0].p, base, [-0.63, 0.36], -90, [KX, KZ], { pre: 0.3, hold: 0.1 });
  const top = v3(base.x, HC + CS, base.z);
  fetchPlace(tr, own2, 'L', 1, 9.45, 10.02, own2.ev[0].p, top, [-0.63, 0.36], -90, [-0.63, 0.36], { pre: 0.26, hold: 0.04 });
  own2.ev.push({ t: 10.1, kind: 'slide', p: top, dx: -0.07, rz: 0.38, dur: 0.14 });
  const sim = simFall(v3(top.x - 0.07, top.y, top.z), -0.32, 0.25, 0.5, 6.5, 0.38);
  own2.ev.push({ t: 10.24, kind: 'fall', sim });
  fx.fallL = 10.24 + landTimeOf(sim);
  tr.pose(10.3, 'stand', { lean: -8, shLf: 30, shRf: 30, elL: 50, elR: 50, headPitch: 22, x: -0.6, z: 0.36, yaw: -80 });
  tr.pose(10.85, 'hands', { yaw: -30 });                               // looks at their hands: "I don't know how"
  tr.pose(11.35, 'hands', { yaw: -26, headPitch: 48 });
  tr.pose(11.95, 'sitHug', { yaw: -18, x: -0.58 });
  tr.pose(12.55, 'sitHug', { yaw: 8, lean: 14, headPitch: -30, headYaw: 38, headRoll: -6 });
  tr.pose(15.0, 'sitHug', { yaw: 10, lean: 12, headPitch: -32, headYaw: 40, headRoll: -6 });
  fx.squash.L = [[2.5, 0.05], [10.3, 0.08], [11.95, 0.06]];
}

// ===== RIGHT: the parent lets the child try =====
{
  makeCube(0, slotR(0, 0));
  const pile = [[0.42, -0.46, 7], [0.16, -0.4, -8], [0.28, -0.8, 5], [-0.02, -0.7, -11], [0.52, -0.92, 14]]
    .map(([x, z, r], i) => makeCube(i + 1, v3(x, HC, z), r));
  const k = kidR.track = new Track({}), m = momR.track = new Track({});
  const MX = 0.6, MZ = 0.05;
  m.keys[0] = { t: 0, p: pose(P.kneelNod, { x: MX, z: MZ, yaw: 90, scale: PS }) };
  // child: cube L1 in hands at t=0 (like 06)
  const c1 = makeCube(2); c1.ev.push({ t: 0, kind: 'grab', fig: 'R', blend: 0 }, { t: 0.3, kind: 'put', fig: 'R', p: slotR(0, 1), dur: 0.2 });
  k.keys[0] = { t: 0, p: pose(P.carry, { shLf: 66, shRf: 66, elL: 30, elR: 30, lean: 8, headPitch: 10, x: 1.08, yaw: 90 }) };
  k.pose(0.3, placePose(0.45), { x: 1.08, yaw: 90 });
  k.pose(0.5, placePose(0.45), { x: 1.08, yaw: 90, lean: 30 });
  // handoff A: parent fetches, offers; the child takes and places it — it slips
  const handoff = (cube, tTurn, tGrab, tOffer, tTake, kidFrom) => {
    const gp = cube.ev[0].p, yp = yawTo(MX, MZ, gp.x, gp.z);
    m.pose(tTurn, 'kneel', { yaw: lerp(90, yp, 0.6) });
    m.pose(tGrab, 'kneelReach', { yaw: yp });
    m.pose(tOffer, 'kneelOffer', { yaw: 90 });
    m.pose(tTake + 0.12, 'kneelOffer', { yaw: 90 });
    m.pose(tTake + 0.5, 'kneel', { yaw: 90 });
    cube.ev.push({ t: tGrab, kind: 'grab', fig: 'RP' }, { t: tTake, kind: 'grab', fig: 'R', blend: 0.2 });
    k.pose(tOffer - 0.15, 'stand', { x: lerp(kidFrom[0], 1.13, 0.5), z: lerp(kidFrom[1], 0.05, 0.5), yaw: -80 });
    k.pose(tTake - 0.05, 'take', { x: 1.13, z: 0.05, yaw: -90 });
    k.pose(tTake + 0.25, 'carry', { x: 1.12, z: 0.05, yaw: -60 });
  };
  const A = pile[0];
  handoff(A, 0.6, 0.9, 1.25, 1.45, [1.08, 0]);
  const sA = slotR(0, 2);
  k.pose(1.95, placePose(sA.y), { x: 1.08, z: 0, yaw: 90 });
  k.pose(2.02, placePose(sA.y), { x: 1.08, z: 0, yaw: 90, lean: 14 });
  A.ev.push({ t: 1.88, kind: 'put', fig: 'R', p: sA, dur: 0.14 });
  A.ev.push({ t: 2.1, kind: 'slide', p: sA, dx: 0.06, rz: -0.36, dur: 0.14 });
  const simA = simFall(v3(sA.x + 0.06, sA.y, 0), 0.28, 0.25, 0.55, -6.5, -0.36);
  A.ev.push({ t: 2.24, kind: 'fall', sim: simA });
  fx.fallR = 2.24 + landTimeOf(simA);
  k.pose(2.32, 'stand', { lean: -8, shLf: 30, shRf: 30, elL: 50, elR: 50, headPitch: 20, x: 1.08, yaw: 110 });
  k.pose(2.75, 'look', { x: 1.1, yaw: -60, headPitch: 18 });            // looks at the parent…
  m.pose(2.95, "kneelNod", { yaw: 90 });                                 // …who nods: it's fine, again
  m.pose(3.18, "kneel", { yaw: 90, headPitch: 6 });
  m.pose(3.4, "kneelNod", { yaw: 90 });
  fx.pulseR = [3.0];
  const e = simA.end;
  const gA = [e.x - 0.3, e.z - 0.3];
  k.pose(3.05, 'look', { x: lerp(1.1, gA[0], 0.5), z: lerp(0, gA[1], 0.5), yaw: yawTo(1.1, 0, e.x, e.z), headPitch: 32 });
  k.pose(3.3, 'grab', { x: gA[0], z: gA[1], yaw: yawTo(gA[0], gA[1], e.x, e.z) });
  A.ev.push({ t: 3.3, kind: 'grab', fig: 'R' });
  k.pose(3.6, 'carry', { x: 1.1, z: 0.08, yaw: 80 });
  k.pose(3.88, placePose(sA.y), { x: 1.08, z: 0, yaw: 90 });
  k.pose(4.02, placePose(sA.y), { x: 1.08, z: 0, yaw: 90, lean: 14 });
  A.ev.push({ t: 3.82, kind: 'put', fig: 'R', p: sA, dur: 0.16 });
  // handoff B → column 1, placed from behind, facing the camera
  const B = pile[1];
  handoff(B, 3.95, 4.25, 4.6, 4.8, [1.08, 0]);
  const sB = slotR(1, 0);
  k.pose(5.12, 'carry', { x: 1.2, z: -0.3, yaw: 20 });
  k.pose(5.38, placePose(sB.y), { x: 1.2, z: -0.42, yaw: 0 });
  k.pose(5.52, placePose(sB.y), { x: 1.2, z: -0.42, yaw: 0, lean: 44 });
  B.ev.push({ t: 5.32, kind: 'put', fig: 'R', p: sB, dur: 0.16 });
  fx.pulseR.push(5.5);
  k.pose(6.0, 'stand', { x: 1.2, z: -0.42, yaw: -40, headPitch: 6 });
  // the parent stands up, steps back into the dark
  m.pose(5.75, 'kneelNod', { yaw: 90 });
  m.pose(6.35, 'stand', { yaw: 80, headPitch: 14 });
  m.pose(7.05, 'stand', { yaw: 85, headPitch: 12 });
  m.pose(7.4, 'stand', { x: MX + 0.06, z: MZ - 0.1, yaw: 170 });
  m.pose(8.0, 'stand', { x: 0.74, z: -0.62, yaw: 172, op: 0.75 });
  m.pose(8.9, 'stand', { x: 0.82, z: -2.3, yaw: 178, op: 0 });
  m.pose(15, 'stand', { x: 0.82, z: -2.3, yaw: 178, op: 0 });
  k.pose(7.0, 'stand', { x: 1.2, z: -0.42, yaw: -70, headPitch: 8 });
  k.pose(7.6, 'stand', { x: 1.2, z: -0.42, yaw: -150, headPitch: 2 });  // watches the parent go
  // alone: builds on, quickly
  const C = pile[2], D = pile[3];
  fetchPlace(k, C, 'R', 1, 8.1, 8.62, C.ev[0].p, slotR(1, 1), [1.2, -0.42], 0, [1.2, -0.42], { pre: 0.26, hold: 0.06 });
  fetchPlace(k, D, 'R', 1, 9.0, 9.5, D.ev[0].p, slotR(2, 0), [0.9, -0.42], 0, [1.2, -0.42], { pre: 0.22, hold: 0.06 });
  // climb: column 2 → 1 → 0
  const steps = [[2, 1], [1, 2], [0, 3]];
  let tx = 9.72, prevH = 0, prevX = 0.9, prevZ = -0.42;
  fx.landR = [];
  steps.forEach(([col, h], i) => {
    const x = RT - col * CS, gy = h * CS;
    k.pose(tx + 0.12, i % 2 ? 'stepUpR' : 'stepUp', { x: lerp(prevX, x, 0.45), z: lerp(prevZ, 0, 0.6), yaw: i === 0 ? 40 : 90, gy: prevH + 0.2, lift: 0.02 });
    k.pose(tx + 0.36, 'stand', { x, z: 0, yaw: 90, gy, lean: 10, shLf: 20, shRf: 20, elL: 30, elR: 30 });
    fx.landR.push(tx + 0.36);
    prevH = gy; prevX = x; prevZ = 0; tx += 0.44;
  });
  k.pose(11.4, 'stand', { x: prevX, gy: prevH, yaw: 20, headPitch: -5 });
  k.pose(11.85, 'stand', { x: prevX, gy: prevH, yaw: -40, headPitch: 14 });   // glances at the left kid
  k.pose(12.35, 'stand', { x: prevX, gy: prevH, yaw: -12, lean: 8, hipL: 25, kneeL: 45, hipR: 25, kneeR: 45, shLf: -15, shRf: -15, elL: 20, elR: 20 });
  k.pose(12.62, 'cheer', { x: prevX, gy: prevH, yaw: -12, lift: 0.07, glow: 1 });
  k.pose(12.85, 'cheer', { x: prevX, gy: prevH, yaw: -12, glow: 1 });
  k.pose(13.6, 'cheer', { x: prevX, gy: prevH, yaw: -16, glow: 1, shLs: 30, shRs: 30 });
  k.pose(14.3, 'cheer', { x: prevX, gy: prevH, yaw: -14, glow: 1, shLs: 22, shRs: 22, headPitch: -26 });
  k.pose(15.0, 'cheer', { x: prevX, gy: prevH, yaw: -14, glow: 1, shLs: 26, shRs: 26 });
  fx.cheer = 12.62;
  fx.squash.R = [[2.32, 0.05], ...fx.landR.map(t => [t, 0.09]), [12.35, 0.06], [12.85, 0.08]];
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

const LABEL_ANCHOR = { L: new THREE.Vector3(-1.2, 2.55, 0), R: new THREE.Vector3(1.2, 2.45, 0) };
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
  // labels (always on, from frame 0)
  LABEL_ANCHOR.R.y = lerp(2.45, 2.85, smooth(win(t, 9.3, 12.3)));
  const la = toScreen(LABEL_ANCHOR.L), ra = toScreen(LABEL_ANCHOR.R);
  spaced('ДЕЛАЮТ', la.x, la.y - 44, 34, 700, 0.18, 0.85);
  spaced('ЗА НЕГО', la.x, la.y, 34, 700, 0.18, 0.85);
  spaced('ДАЮТ', ra.x, ra.y - 44, 34, 700, 0.18, 0.85);
  spaced('ПОПРОБОВАТЬ', ra.x, ra.y, 34, 700, 0.18, 0.85);
  // moral
  const m = smooth(win(t, 8.0, 9.0)), m2 = smooth(win(t, 8.35, 9.35));
  if (m > 0) {
    spaced('СДЕЛАТЬ ЗА НЕГО — БЫСТРЕЕ.', W / 2, 545 + (1 - m) * 18, 44, 800, lerp(0.12, 0.05, m), m);
    spaced('НАУЧИТЬ — НАВСЕГДА.', W / 2, 605 + (1 - m2) * 18, 44, 800, lerp(0.12, 0.05, m2), m2);
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
    const by = 1566 + dy + Math.sin((t - 13.6) * 1.6 * 2 * Math.PI) * 6;
    ctx.strokeStyle = `rgba(185,225,50,${e})`; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(W / 2 - 14, by - 7); ctx.lineTo(W / 2, by + 7); ctx.lineTo(W / 2 + 14, by - 7); ctx.stroke();
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
function poseAll(t) {
  for (const [name, f] of Object.entries(figs)) {
    const p = f.track.at(t);
    p.lean += Math.sin(t * 2.3 + name.length + (name[0] === 'L' ? 1 : 0)) * 1.2;
    const sp = clamp(gait(f.track, t) / 1.2);
    if (sp > 0.02 && p.sit < 0.1 && p.hipL < 60) { const ph = t * (name.length > 1 ? 11 : 15); p.hipL += Math.sin(ph) * 22 * sp; p.hipR -= Math.sin(ph) * 22 * sp; p.kneeL += Math.max(0, -Math.sin(ph)) * 30 * sp; p.kneeR += Math.max(0, Math.sin(ph)) * 30 * sp; }
    p.squash = squashAt(fx.squash[name], t);
    f.apply(p);
  }
}
function update(t) {
  const dist = lerp(18.0, 17.3, smooth(win(t, 0, 9))) + 2.4 * smooth(win(t, 9.3, 12.3));
  const tgt = new THREE.Vector3(0.02, lerp(1.6, 1.95, smooth(win(t, 9.3, 12.3))), 0);
  camera.position.set(tgt.x, tgt.y + Math.sin(20 * D2R) * dist, Math.cos(20 * D2R) * dist);
  camera.lookAt(tgt);
  poseAll(t);
  for (const c of cubes) evalCube(c, t, figs);
  poseAll(t);

  const pulses = [...fx.pulseR.map(t0 => [t0, kidR, 0.8]), [fx.cheer, kidR, 1.3], [fx.cheer + 0.5, kidR, 1.0], [fx.cheer + 1.2, kidR, 0.8]];
  let used = 0; rings.forEach(r => (r.visible = false));
  let limeBoost = 0;
  for (const [t0, f, k] of pulses) {
    const u = t - t0; if (u < 0 || u > 1.3) continue;
    const r = rings[used++ % rings.length]; r.visible = true;
    const s = easeOut(clamp(u / 1.3));
    r.scale.setScalar(lerp(0.25, 1.05 * k, s));
    r.position.set(f.root.position.x, f.root.position.y + 0.012, f.root.position.z);
    r.material.opacity = (1 - s) * 0.9; limeBoost = Math.max(limeBoost, (1 - s));
  }
  const glow = kidR.mat.emissiveIntensity / 0.16;
  limeLight.position.set(kidR.root.position.x, kidR.root.position.y + 0.9, 0.45);
  limeLight.intensity = 2.0 * limeBoost + 2.2 * glow;
  redLight.intensity = 0;

  spotL.intensity = lerp(28, 17, smooth(win(t, 10.4, 12.2)));
  spotR.intensity = lerp(28, 34, smooth(win(t, 12.3, 13.2)));
  spotR.target.position.set(1.1, lerp(0.6, 1.4, smooth(win(t, 10, 12))), 0);
  bloom.strength = 0.45 + 0.12 * glow;
}

window.renderFrame = (frame) => {
  const t = frame / FPS;
  update(t);
  composer.render();
  composite(t, frame);
  return out.toDataURL('image/png');
};
window.fx = fx;
window.ready = true;
