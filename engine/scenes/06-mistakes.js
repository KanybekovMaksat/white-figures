// Ep 06 · neuron style — two faceless kids build towers. Deterministic: frame -> picture.
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
      pos.copy(hp).lerp(e.p, s); ry = lerp(fy, 0, s); rz = 0;
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

// ---------- characters + choreography ----------
const figL = new Figure(), figR = new Figure();
const sideFig = new Map([[L, figL], [R, figR]]);
for (const f of [figL, figR]) {
  f.handsMidAt = function (t, out) { this.apply(this.track.at(t)); return this.handsMid(out); };
}

function buildSide(side, f, script) {
  const d = side.dir, faceTower = 90 * d, tr = new Track({});
  f.track = tr;
  const base = side === L ? 'L' : 'R';
  // tower base cube 1, cube 2 in hands
  const c1 = makeCube(0); c1.ev.push({ t: 0, kind: 'at', p: slot(side, 0, 0) });
  const pile = pilePositions(side).map((pp, i) => { const c = makeCube(i + 1); c.ev.push({ t: 0, kind: 'at', p: pp.p, ry: pp.ry }); return c; });
  const c2 = makeCube(2); c2.ev.push({ t: 0, kind: 'grab', fig: base, blend: 0 }, { t: 0.32, kind: 'put', fig: base, p: slot(side, 0, 1), dur: 0.22 });
  tr.keys[0] = { t: 0, p: pose(P.carry, { shLf: 66, shRf: 66, elL: 30, elR: 30, lean: 8, headPitch: 10, x: side.standX, yaw: faceTower }) };
  tr.key(0.32, pose(placePose(0.45), { x: side.standX, yaw: faceTower }));
  tr.key(0.55, pose(placePose(0.45), { lean: 14, x: side.standX, yaw: faceTower }));
  return { tr, pile, c2 };
}

// generic build cycle: grab cube from position gp, place in slot (col, level)
function cycle(side, f, tr, cube, figName, tGrab, tPlace, gp, col, level, opt = {}) {
  const d = side.dir, faceTower = 90 * d;
  const sl = slot(side, col, level);
  const standX = sl.x - d * 0.42;
  // where to stand to grab: 0.42 behind the cube along the line from stand
  const gx = gp.x, gz = gp.z;
  const fromX = opt.fromX ?? standX;
  const yawG = yawTo(lerp(fromX, gx, 0.4), lerp(0, gz, 0.4), gx, gz);
  const len = Math.hypot(gx - fromX, gz); const gStandX = gx - (gx - fromX) / len * 0.4, gStandZ = gz - gz / len * 0.4;
  const pre = opt.pre ?? 0.28;
  tr.pose(tGrab - pre, 'look', { x: lerp(fromX, gStandX, 0.5), z: gStandZ * 0.5, yaw: yawG });
  tr.pose(tGrab, 'grab', { x: gStandX, z: gStandZ, yaw: yawG });
  const mid = (tGrab + tPlace) / 2;
  tr.pose(mid, 'carry', { x: lerp(gStandX, standX, 0.55), z: gStandZ * 0.4, yaw: lerp(yawG, faceTower, 0.6) });
  tr.pose(tPlace - 0.02, placePose(sl.y), { x: standX, z: 0, yaw: faceTower });
  tr.pose(tPlace + (opt.hold ?? 0.12), placePose(sl.y), { x: standX, z: 0, yaw: faceTower, lean: placePose(sl.y).lean + 4 });
  cube.ev.push({ t: tGrab, kind: 'grab', fig: figName }, { t: tPlace - 0.06, kind: 'put', fig: figName, p: sl, dur: 0.16 });
  return { sl, standX };
}

// ===== RIGHT: tries again =====
const fx = {};
{
  const side = R, f = figR, { tr, pile } = buildSide(R, figR);
  const c3 = pile[0];
  // cube 3: grab 0.78, placed 1.12, slips 1.18, falls
  cycle(R, f, tr, c3, 'R', 0.78, 1.12, pile[0].ev[0].p, 0, 2, { pre: 0.2, hold: 0.05 });
  const s3 = slot(R, 0, 2);
  c3.ev.push({ t: 1.2, kind: 'slide', p: s3, dx: 0.07, rz: -0.35, dur: 0.14 });
  const sim3 = simFall(new THREE.Vector3(s3.x + 0.07, s3.y, 0), 0.55, 0.25, 0.42, -6.5, -0.35);
  c3.ev.push({ t: 1.34, kind: 'fall', sim: sim3 });
  fx.fallR1 = 1.34 + landTimeOf(sim3);
  // kid recoils a little, looks at the cube
  tr.pose(1.38, 'stand', { lean: -8, shLf: 30, shRf: 30, elL: 50, elR: 50, headPitch: 20, x: R.standX, yaw: 90 });
  tr.pose(1.95, 'look', { x: R.standX, yaw: 105, headPitch: 32 });
  // encouragement pulse ~1.85; picks it up
  fx.pulseR = [1.85, 5.35];
  const e3 = sim3.end; const gp3 = new THREE.Vector3(e3.x, e3.y, e3.z);
  tr.pose(2.25, 'look', { x: R.standX + 0.15, z: 0.12, yaw: yawTo(R.standX, 0, e3.x, e3.z), headPitch: 34 });
  tr.pose(2.5, 'grab', { x: e3.x - 0.28, z: e3.z - 0.3, yaw: yawTo(e3.x - 0.28, e3.z - 0.3, e3.x, e3.z) });
  c3.ev.push({ t: 2.5, kind: 'grab', fig: 'R' });
  tr.pose(2.85, 'carry', { x: R.standX + 0.05, z: 0.1, yaw: 80 });
  const sA3 = slot(R, 0, 2);
  tr.pose(3.12, placePose(sA3.y), { x: R.standX, z: 0, yaw: 90 });
  tr.pose(3.25, placePose(sA3.y), { x: R.standX, z: 0, yaw: 90, lean: 14 });
  c3.ev.push({ t: 3.06, kind: 'put', fig: 'R', p: sA3, dur: 0.16 });
  // cube 4: goes on top of A (level 3), slips again ~4.7
  const c4 = pile[1];
  cycle(R, f, tr, c4, 'R', 3.62, 4.38, pile[1].ev[0].p, 0, 3, { pre: 0.3, hold: 0.05 });
  const s4 = slot(R, 0, 3);
  c4.ev.push({ t: 4.5, kind: 'slide', p: s4, dx: 0.06, rz: -0.3, dur: 0.14 });
  const sim4 = simFall(new THREE.Vector3(s4.x + 0.06, s4.y, 0), 0.55, 0.3, 0.55, -7, -0.3);
  c4.ev.push({ t: 4.64, kind: 'fall', sim: sim4 });
  fx.fallR2 = 4.64 + landTimeOf(sim4);
  tr.pose(4.7, 'stand', { lean: -6, shLf: 25, shRf: 25, elL: 40, elR: 40, headPitch: 25, x: R.standX, yaw: 100 });
  const e4 = sim4.end;
  // up again, faster
  tr.pose(5.25, 'grab', { x: e4.x - 0.26, z: e4.z - 0.3, yaw: yawTo(e4.x - 0.26, e4.z - 0.3, e4.x, e4.z) });
  c4.ev.push({ t: 5.25, kind: 'grab', fig: 'R' });
  tr.pose(5.5, 'carry', { x: R.standX, z: 0.08, yaw: 80 });
  tr.pose(5.7, placePose(s4.y), { x: R.standX, z: 0, yaw: 90 });
  tr.pose(5.8, placePose(s4.y), { x: R.standX, z: 0, yaw: 90, lean: 8 });
  c4.ev.push({ t: 5.64, kind: 'put', fig: 'R', p: s4, dur: 0.14 });
  fx.placeTimesR = [0.32, 3.12, 5.7];
  // stairs: B(3) C(2) D(1)
  const plan = [[1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [3, 0]];
  let t = 5.95, fromX = R.standX;
  plan.forEach(([col, lev], i) => {
    const c = pile[2 + i]; const g = c.ev[0].p;
    const dur = 0.66;
    const r = cycle(R, f, tr, c, 'R', t + 0.24, t + dur, g, col, lev, { pre: 0.2, hold: 0.04, fromX });
    fx.placeTimesR.push(t + dur); fromX = r.standX; t += dur;
  });
  // t ≈ 9.9 : climb D → C → B → A
  const climbStart = t + 0.12;
  const steps = [[3, 1], [2, 2], [1, 3], [0, 4]]; // col, height in cubes
  let tx = climbStart, prevH = 0, prevX = fromX;
  fx.landR = [];
  steps.forEach(([col, h], i) => {
    const x = colX(R, col), gy = h * CS;
    tr.pose(tx + 0.12, i % 2 ? 'stepUpR' : 'stepUp', { x: lerp(prevX, x, 0.45), z: 0, yaw: 90, gy: prevH + 0.2, lift: 0.02 });
    tr.pose(tx + 0.34, 'stand', { x, z: 0, yaw: 90, gy, lean: 10, shLf: 20, shRf: 20, elL: 30, elR: 30 });
    fx.landR.push(tx + 0.34);
    prevH = gy; prevX = x; tx += 0.42;
  });
  // on top (t ≈ 11.8): turn to the camera, beat, then arms up on the music peak
  tr.pose(12.0, 'stand', { x: prevX, gy: prevH, yaw: 20, headPitch: -5 });
  tr.pose(12.35, 'stand', { x: prevX, gy: prevH, yaw: -12, lean: 8, hipL: 25, kneeL: 45, hipR: 25, kneeR: 45, shLf: -15, shRf: -15, elL: 20, elR: 20 }); // anticipation
  tr.pose(12.62, 'cheer', { x: prevX, gy: prevH, yaw: -12, lift: 0.07, glow: 1 });
  tr.pose(12.85, 'cheer', { x: prevX, gy: prevH, yaw: -12, glow: 1 });
  tr.pose(13.6, 'cheer', { x: prevX, gy: prevH, yaw: -16, glow: 1, shLs: 30, shRs: 30 });
  tr.pose(14.3, 'cheer', { x: prevX, gy: prevH, yaw: -14, glow: 1, shLs: 22, shRs: 22, headPitch: -26 });
  tr.pose(15.0, 'cheer', { x: prevX, gy: prevH, yaw: -14, glow: 1, shLs: 26, shRs: 26 });
  fx.cheer = 12.62; fx.topR = new THREE.Vector3(prevX, prevH, 0);
  fx.squashR = [[1.38, 0.05], ...fx.landR.map(t => [t, 0.09]), [12.35, 0.06], [12.85, 0.08]];
}

// ===== LEFT: scolded =====
{
  const side = L, f = figL, { tr, pile } = buildSide(L, figL);
  const c3 = pile[0];
  cycle(L, f, tr, c3, 'L', 0.74, 1.08, pile[0].ev[0].p, 0, 2, { pre: 0.2, hold: 0.05 });
  const s3 = slot(L, 0, 2);
  c3.ev.push({ t: 1.16, kind: 'slide', p: s3, dx: -0.07, rz: 0.35, dur: 0.14 });
  const sim3 = simFall(new THREE.Vector3(s3.x - 0.07, s3.y, 0), -0.55, 0.25, 0.45, 6.5, 0.35);
  c3.ev.push({ t: 1.3, kind: 'fall', sim: sim3 });
  fx.fallL = 1.3 + landTimeOf(sim3); fx.fallenL = sim3.end;
  // the X slams at 1.62 → flinch
  fx.xSlam = 1.62;
  tr.pose(1.36, 'stand', { lean: -8, shLf: 30, shRf: 30, elL: 50, elR: 50, headPitch: 20, x: L.standX, yaw: -90 });
  tr.pose(1.6, 'stand', { lean: -4, headPitch: 24, x: L.standX, yaw: -70 });
  tr.pose(1.8, 'flinch', { x: L.standX + 0.04, yaw: -40 });
  tr.pose(2.4, 'flinch', { x: L.standX + 0.05, yaw: -35, lean: 34 });
  // sits down, hugs knees
  tr.pose(2.85, 'flinch', { x: L.standX + 0.06, yaw: -20, hipL: 95, kneeL: 125, hipR: 95, kneeR: 125, sit: 0.5 });
  tr.pose(3.35, 'sitHug', { x: L.standX + 0.08, yaw: -14 });
  tr.pose(4.6, 'sitHug', { x: L.standX + 0.08, yaw: -14, lean: 36, headPitch: 40 });
  // half-hearted attempt 1 (reach toward the fallen cube, pull back)
  const reach = (t0) => {
    tr.pose(t0, 'sitHug', { x: L.standX + 0.08, yaw: -24, headPitch: 18, headYaw: -40 });
    tr.pose(t0 + 0.55, 'sitHug', { x: L.standX + 0.08, yaw: -30, lean: 40, headPitch: 14, headYaw: -45, shLf: 70, shLs: 14, elL: 8 });
    tr.pose(t0 + 0.85, 'sitHug', { x: L.standX + 0.08, yaw: -30, lean: 40, headPitch: 18, headYaw: -45, shLf: 66, shLs: 12, elL: 12 });
    tr.pose(t0 + 1.25, 'sitHug', { x: L.standX + 0.08, yaw: -16, lean: 36, headPitch: 42 });
  };
  reach(5.5);
  tr.pose(7.6, 'sitHug', { x: L.standX + 0.08, yaw: -16, lean: 37, headPitch: 44 });
  reach(8.6);
  tr.pose(11.6, 'sitHug', { x: L.standX + 0.08, yaw: -14, lean: 38, headPitch: 44 });
  // looks up at the right kid
  tr.pose(12.55, 'sitHug', { x: L.standX + 0.08, yaw: 8, lean: 14, headPitch: -30, headYaw: 38, headRoll: -6 });
  tr.pose(15.0, 'sitHug', { x: L.standX + 0.08, yaw: 10, lean: 12, headPitch: -32, headYaw: 40, headRoll: -6 });
  fx.squashL = [[1.8, 0.1], [3.35, 0.07]];
}

// ---------- red X (stamp) ----------
const xGroup = new THREE.Group();
const xMat = new THREE.MeshPhysicalMaterial({ color: C.red, emissive: C.red, emissiveIntensity: 2.2, roughness: 0.3, clearcoat: 0.6 });
for (const a of [45, -45]) { const b = new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.13, 0.1, 4, 0.045), xMat); b.rotation.z = a * D2R; b.castShadow = true; xGroup.add(b); }
scene.add(xGroup);
xGroup.traverse(o => o.layers.set(1)); camera.layers.enable(1); // no mirror image of the stamp
const X_REST = new THREE.Vector3(L.standX + 0.04, 1.72, 0.05);

// ---------- lime rings ----------
const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(C.lime).multiplyScalar(3), transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
const rings = [0, 1, 2].map(() => { const m = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 96), ringMat.clone()); m.rotation.x = -Math.PI / 2; scene.add(m); return m; });

// ---------- squash ----------
function squashAt(list, t) { let s = 0; for (const [t0, a] of list) { if (t >= t0) { const u = t - t0; s += a * Math.exp(-u * 9) * Math.cos(u * 22); } } return s; }
function gait(tr, t) { const a = tr.at(t - 0.03), b = tr.at(t + 0.03); return Math.hypot(b.x - a.x, b.z - a.z) / 0.06; }

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

const LABEL_ANCHOR = { L: new THREE.Vector3(-1.2, 2.2, 0), R: new THREE.Vector3(1.25, 2.95, 0) };
function toScreen(v) { const p = v.clone().project(camera); return { x: (p.x + 1) / 2 * W, y: (1 - p.y) / 2 * H }; }
function composite(t, frame) {
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  ctx.drawImage(glCanvas, 0, 0);
  // navy void: lifts the black toward navy at the top, keeps black at the bottom
  ctx.globalCompositeOperation = 'screen';
  let g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(20,33,63,1)'); g.addColorStop(0.42, 'rgba(14,22,46,0.75)'); g.addColorStop(0.72, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // vignette
  ctx.globalCompositeOperation = 'source-over';
  g = ctx.createRadialGradient(W / 2, H * 0.55, H * 0.22, W / 2, H * 0.55, H * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.6)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // labels (always on, from frame 0)
  LABEL_ANCHOR.R.y = lerp(2.45, 2.95, smooth(win(t, 9.3, 12.3)));
  const la = toScreen(LABEL_ANCHOR.L), ra = toScreen(LABEL_ANCHOR.R);
  spaced('РУГАЮТ', la.x, la.y - 44, 34, 700, 0.18, 0.85);
  spaced('ЗА ОШИБКИ', la.x, la.y, 34, 700, 0.18, 0.85);
  spaced('ХВАЛЯТ', ra.x, ra.y - 44, 34, 700, 0.18, 0.85);
  spaced('ЗА ПОПЫТКИ', ra.x, ra.y, 34, 700, 0.18, 0.85);
  // moral
  const m = smooth(win(t, 8.0, 9.0)), m2 = smooth(win(t, 8.35, 9.35));
  if (m > 0) {
    spaced('РЕБЁНОК БОИТСЯ ОШИБОК,', W / 2, 545 + (1 - m) * 18, 44, 800, lerp(0.12, 0.06, m), m);
    spaced('ПОКА ИХ БОИТЕСЬ ВЫ.', W / 2, 605 + (1 - m2) * 18, 44, 800, lerp(0.12, 0.06, m2), m2);
  }
  // grain
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
function update(t) {
  // camera: slow push-in, small shake on the stamp
  const push = smooth(win(t, 0, 15));
  const dist = lerp(18.0, 17.3, smooth(win(t, 0, 9))) + 2.4 * smooth(win(t, 9.3, 12.3));
  const sh = t > fx.xSlam ? Math.exp(-(t - fx.xSlam) * 10) * 0.05 : 0;
  const tgt = new THREE.Vector3(0.02, lerp(1.6, 1.95, smooth(win(t, 9.3, 12.3))), 0);
  camera.position.set(tgt.x + Math.sin(t * 61) * sh, tgt.y + Math.sin(20 * D2R) * dist + Math.cos(t * 53) * sh, Math.cos(20 * D2R) * dist);
  camera.lookAt(tgt);

  for (const [name, f] of Object.entries(figs)) {
    const p = f.track.at(t);
    // breathing + walk cycle
    p.lean += Math.sin(t * 2.3 + (name === 'L' ? 1 : 0)) * 1.2;
    const sp = clamp(gait(f.track, t) / 1.2);
    if (sp > 0.02 && p.sit < 0.1) { const ph = t * 15; p.hipL += Math.sin(ph) * 22 * sp; p.hipR -= Math.sin(ph) * 22 * sp; p.kneeL += Math.max(0, -Math.sin(ph)) * 30 * sp; p.kneeR += Math.max(0, Math.sin(ph)) * 30 * sp; }
    p.squash = squashAt(name === 'L' ? fx.squashL : fx.squashR, t);
    f.apply(p);
  }
  for (const c of cubes) evalCube(c, t, figs);
  // re-apply final poses (evalCube re-posed figures while sampling)
  for (const [name, f] of Object.entries(figs)) {
    const p = f.track.at(t);
    p.lean += Math.sin(t * 2.3 + (name === 'L' ? 1 : 0)) * 1.2;
    const sp = clamp(gait(f.track, t) / 1.2);
    if (sp > 0.02 && p.sit < 0.1) { const ph = t * 15; p.hipL += Math.sin(ph) * 22 * sp; p.hipR -= Math.sin(ph) * 22 * sp; p.kneeL += Math.max(0, -Math.sin(ph)) * 30 * sp; p.kneeR += Math.max(0, Math.sin(ph)) * 30 * sp; }
    p.squash = squashAt(name === 'L' ? fx.squashL : fx.squashR, t);
    f.apply(p);
  }

  // red X stamp
  const xs = fx.xSlam;
  if (t < xs - 0.2) xGroup.visible = false;
  else {
    xGroup.visible = true;
    const fall = easeIn(win(t, xs - 0.2, xs));
    const y = lerp(X_REST.y + 3.4, X_REST.y, fall);
    const u = Math.max(0, t - xs);
    const imp = t >= xs ? Math.exp(-u * 8) * Math.cos(u * 26) : 0;
    xGroup.position.set(X_REST.x, y - imp * 0.05 + (t > xs + 0.6 ? Math.sin((t - xs) * 1.6) * 0.025 : 0), X_REST.z);
    xGroup.scale.set(1 + imp * 0.22, 1 - imp * 0.2, 1);
    xGroup.rotation.set(0, Math.sin(t * 0.9) * 0.12, (1 - fall) * 0.4);
    xMat.emissiveIntensity = lerp(1.6, 4.0, Math.exp(-u * 3)) * (t < xs ? 0.8 : 1);
  }
  redLight.position.set(X_REST.x, X_REST.y - 0.2, 0.4);
  redLight.intensity = t >= xs ? 1.2 + 6 * Math.exp(-(t - xs) * 4) : 0;

  // lime pulses
  const pulses = [...fx.pulseR.map(t0 => [t0, figR, 1]), [fx.cheer, figR, 1.3], [fx.cheer + 0.5, figR, 1.0], [fx.cheer + 1.2, figR, 0.8]];
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
  const glow = figR.mat.emissiveIntensity / 0.16;
  limeLight.position.set(figR.root.position.x, figR.root.position.y + 0.9, 0.45);
  limeLight.intensity = 2.0 * limeBoost + 2.2 * glow;

  // spots: left dims after the stamp, right warms at the payoff
  spotL.intensity = lerp(28, 17, smooth(win(t, 1.7, 3.5)));
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
window.ready = true;
