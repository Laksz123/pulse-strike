/**
 * 3D models for the paintball mode: the markers and the players.
 *
 * The look is chunky toy plastic with a dark outline. Bodies, grips and stocks are side profiles
 * extruded with a bevel, so they read as moulded shapes rather than boxes; a pattern paints its
 * texture over the body. The same model is used in the hands, on the arsenal turntable and in
 * every icon, so a marker never looks like two different things.
 * Convention: -Z is forward, +Y is up, the origin is where the right hand grips. Units are metres.
 */

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { PATTERNS, type Pattern } from "./markers";

const mats = new Map<string, THREE.MeshStandardMaterial>();

export function pbr(color: number, metal = 0.1, rough = 0.55, emissive = 0, opacity = 1): THREE.MeshStandardMaterial {
  const key = `${color}:${metal}:${rough}:${emissive}:${opacity}`;
  let m = mats.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color, metalness: metal, roughness: rough, emissive, emissiveIntensity: emissive ? 1.6 : 0,
      transparent: opacity < 1, opacity, depthWrite: opacity >= 1,
    });
    mats.set(key, m);
  }
  return m;
}

// ---------------------------------------------------------------------------------------------
// Pattern textures

const loader = new THREE.TextureLoader();
const textures = new Map<string, THREE.Texture>();

function patternTexture(name: string): THREE.Texture {
  let t = textures.get(name);
  if (!t) {
    t = loader.load(`/art/pat_${name}.jpg`);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    textures.set(name, t);
  }
  return t;
}

/** Loads every pattern texture; icons rendered before this would come out plain. */
export function preloadPatterns(): Promise<void> {
  const jobs = PATTERNS.filter((p) => p.tex).map(
    (p) =>
      new Promise<void>((done) => {
        const t = loader.load(`/art/pat_${p.tex}.jpg`, () => done(), undefined, () => done());
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 4;
        textures.set(p.tex!, t);
      }),
  );
  return Promise.race([Promise.all(jobs).then(() => undefined), new Promise<void>((done) => setTimeout(done, 4000))]);
}

const bodyMats = new Map<string, THREE.MeshStandardMaterial>();

/** The material of a marker's body in a given pattern: plain plastic, or its texture. */
function bodyMaterial(p: Pattern): THREE.MeshStandardMaterial {
  let m = bodyMats.get(p.name);
  if (!m) {
    const map = p.tex ? patternTexture(p.tex) : null;
    m = new THREE.MeshStandardMaterial({
      color: map ? 0xffffff : p.b, map, roughness: p.metal ? 0.22 : 0.3, metalness: p.metal ? 0.85 : 0.05,
      emissive: p.glow ? 0xffffff : 0x000000, emissiveMap: p.glow ? map : null, emissiveIntensity: p.glow ? 0.75 : 0,
    });
    bodyMats.set(p.name, m);
  }
  return m;
}

// ---------------------------------------------------------------------------------------------
// Geometry helpers

/**
 * How finely round things are cut. What is seen up close — the weapon in the hands, the agent in
 * the lobby, an icon — gets every facet. The world, seen from across a street, is built inside
 * `coarse()` with about a third of them: it looks the same from there and draws three times faster.
 */
let fine = true;
export function coarse<T>(make: () => T): T {
  const was = fine;
  fine = false;
  try {
    return make();
  } finally {
    fine = was;
  }
}

/** Whether round things are being cut fine right now. */
export const isFine = () => fine;

const geos = new Map<string, THREE.BufferGeometry>();
function geo<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
  const k = fine ? key : `lo:${key}`;
  let g = geos.get(k) as T | undefined;
  if (!g) geos.set(k, (g = make()));
  return g;
}
/** Sides of a tube: halved for the world, but never fewer than eight. */
const around = (sides: number) => (fine ? sides : Math.max(8, Math.round(sides * 0.5)));

function add(parent: THREE.Object3D, g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const mesh = new THREE.Mesh(g, m);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

/** Rounded box centred at (x, y, z). */
export function rb(p: THREE.Object3D, w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material, r = 0.012): THREE.Mesh {
  const rr = Math.min(r, w / 2.01, h / 2.01, d / 2.01);
  return add(p, geo(`rb:${w}:${h}:${d}:${rr}`, () => new RoundedBoxGeometry(w, h, d, fine ? 3 : 2, rr)), m, x, y, z);
}

/** Tube along Z, centred at (x, y, z); `r2` makes it a cone. */
export function tz(p: THREE.Object3D, r: number, len: number, x: number, y: number, z: number, m: THREE.Material, r2 = r, sides = 24): THREE.Mesh {
  const mesh = add(p, geo(`cy:${r}:${r2}:${len}:${sides}`, () => new THREE.CylinderGeometry(r2, r, len, around(sides))), m, x, y, z);
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

/** Upright tube. */
export function ty(p: THREE.Object3D, r: number, len: number, x: number, y: number, z: number, m: THREE.Material, r2 = r, sides = 24): THREE.Mesh {
  return add(p, geo(`cy:${r}:${r2}:${len}:${sides}`, () => new THREE.CylinderGeometry(r2, r, len, around(sides))), m, x, y, z);
}

/** Tube across, along X: screws, axles, drums seen from the side. */
export function tx(p: THREE.Object3D, r: number, len: number, x: number, y: number, z: number, m: THREE.Material, sides = 20): THREE.Mesh {
  const mesh = add(p, geo(`cy:${r}:${r}:${len}:${sides}`, () => new THREE.CylinderGeometry(r, r, len, around(sides))), m, x, y, z);
  mesh.rotation.z = Math.PI / 2;
  return mesh;
}

export function sph(p: THREE.Object3D, r: number, x: number, y: number, z: number, m: THREE.Material, sx = 1, sy = 1, sz = 1): THREE.Mesh {
  const mesh = add(p, geo(`sp:${r}`, () => (fine ? new THREE.SphereGeometry(r, 24, 18) : r > 0.09 ? new THREE.SphereGeometry(r, 16, 11) : new THREE.SphereGeometry(r, 10, 7))), m, x, y, z);
  mesh.scale.set(sx, sy, sz);
  return mesh;
}

/** Ring around the Z axis. */
export function ring(p: THREE.Object3D, R: number, r: number, x: number, y: number, z: number, m: THREE.Material): THREE.Mesh {
  return add(p, geo(`to:${R}:${r}`, () => (fine ? new THREE.TorusGeometry(R, r, 10, 28) : new THREE.TorusGeometry(R, r, 6, 14))), m, x, y, z);
}

export function capsule(p: THREE.Object3D, r: number, len: number, x: number, y: number, z: number, m: THREE.Material): THREE.Mesh {
  return add(p, geo(`ca:${r}:${len}`, () => (fine ? new THREE.CapsuleGeometry(r, len, 8, 18) : new THREE.CapsuleGeometry(r, len, 4, 10))), m, x, y, z);
}

export type Pt = [number, number];

/**
 * A moulded part: a side profile, given as [forward, up] points, extruded to width `w` with rounded
 * corners and a bevelled edge. This is what makes a body look cast in one piece.
 */
export function prof(p: THREE.Object3D, pts: Pt[], w: number, m: THREE.Material, z = 0, y = 0, x = 0, r = 0.014, bevel = 0.006): THREE.Mesh {
  const key = `pf:${w}:${r}:${bevel}:${pts.join(";")}`;
  const g = geo(key, () => {
    const shape = new THREE.Shape();
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const P = pts[(i + n - 1) % n];
      const V = pts[i];
      const N = pts[(i + 1) % n];
      const d1 = Math.hypot(P[0] - V[0], P[1] - V[1]);
      const d2 = Math.hypot(N[0] - V[0], N[1] - V[1]);
      const rr = Math.min(r, d1 / 2.2, d2 / 2.2);
      const ax = V[0] + ((P[0] - V[0]) / d1) * rr;
      const ay = V[1] + ((P[1] - V[1]) / d1) * rr;
      if (i === 0) shape.moveTo(ax, ay);
      else shape.lineTo(ax, ay);
      shape.quadraticCurveTo(V[0], V[1], V[0] + ((N[0] - V[0]) / d2) * rr, V[1] + ((N[1] - V[1]) / d2) * rr);
    }
    shape.closePath();
    const b = Math.min(bevel, w / 2.4);
    const depth = Math.max(0.001, w - 2 * b);
    const e = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelOffset: -b, bevelSegments: 3, curveSegments: 6 });
    e.translate(0, 0, -depth / 2);
    // Profile space (forward, up, across) to model space (-Z, +Y, +X).
    e.rotateY(Math.PI / 2);
    // Pattern textures: a quarter of a metre of body shows the whole tile.
    const uv = e.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 4, uv.getY(i) * 4);
    return e;
  });
  return add(p, g, m, x, y, z);
}

// ---------------------------------------------------------------------------------------------
// Outline

const outlineMats = new Map<number, THREE.MeshBasicMaterial>();

/** A dark shell pushed out along the normals and drawn inside-out: the cartoon outline. */
function outlineMaterial(thickness: number): THREE.MeshBasicMaterial {
  let m = outlineMats.get(thickness);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color: 0x0e1322, side: THREE.BackSide });
    m.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>\n  transformed += normalize(normal) * ${thickness.toFixed(5)};`);
    };
    m.customProgramCacheKey = () => `outline:${thickness}`;
    outlineMats.set(thickness, m);
  }
  return m;
}

/** Gives every solid mesh under `root` an outline. */
export function outline(root: THREE.Object3D, thickness: number): void {
  const targets: THREE.Mesh[] = [];
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || mesh.userData.outline) return;
    const m = mesh.material as THREE.Material;
    if (m.transparent && !mesh.userData.edge) return;
    targets.push(mesh);
  });
  const material = outlineMaterial(thickness);
  for (const mesh of targets) {
    const shell = new THREE.Mesh(mesh.geometry, material);
    shell.userData.outline = true;
    shell.userData.shell = true;
    mesh.add(shell);
  }
}

// ---------------------------------------------------------------------------------------------
// Parts shared by the markers

/** The pattern being built: its colours and body material. */
let PAL: Pattern = PATTERNS[0];
const plastic = (c: number) => pbr(c, 0.05, 0.3);
/** Body: the big surfaces, where the pattern shows. */
const BODY = () => bodyMaterial(PAL);
/** Accent: rails, caps, pump handles. */
const ACC = () => pbr(PAL.a, 0.05, 0.3, PAL.glow ? PAL.a : 0);
/** Detail: barrels, tips. */
const DET = () => plastic(PAL.c);
const BLACK = () => pbr(0x1b1d24, 0.2, 0.5);
const RUBBER = () => pbr(0x262932, 0, 0.85);
const CHROME = () => pbr(0xc9d2dc, 0.9, 0.2);
const GLASS = () => pbr(0xbfe6ff, 0.1, 0.05, 0, 0.36);
const SHINE = () => pbr(0xffffff, 0, 0.2, 0xffffff, 0.85);

export interface MarkerModel {
  group: THREE.Group;
  /** Tip of the barrel. */
  muzzle: THREE.Object3D;
  /** Barrels that rotate while firing. */
  spin?: THREE.Object3D;
  /** Parts that glow brighter as a charge builds. */
  glow?: THREE.Mesh[];
  /** Second muzzle, for the dual pistols. */
  muzzle2?: THREE.Object3D;
  /** Where the left hand goes, if it holds the marker. */
  left?: [number, number, number];
  /** What comes out on a reload, and where the hand holds it to take it. */
  mag?: THREE.Object3D;
  grab?: [number, number, number];
  /** Moves the weapon's working parts: call every frame with what the weapon is doing. */
  anim?: (s: WeaponState) => void;
}

/** What a weapon's moving parts react to. */
export interface WeaponState {
  /** Seconds, always running. */
  t: number;
  /** 1 at the instant of a shot, fading to 0. */
  fire: number;
  /** Shots fired so far: things that step once per shot count these. */
  shots: number;
  /** Charge and spin-up, 0..1. */
  charge: number;
  spin: number;
  /** How full the magazine is, 0..1. */
  ammo: number;
  /** The action being worked by hand, 0..1: a slide pulled, a bolt drawn, a pump racked. */
  rack?: number;
}

type Anim = (s: WeaponState) => void;
type Builder = (g: THREE.Group) => Omit<MarkerModel, "group">;
const glowMat = (c: number) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.9, roughness: 0.3 });
/** The paint itself: it glows a little in its cell. */
const JUICE = () => pbr(PAL.a, 0, 0.2, PAL.a);

/** Grip, trigger and guard. */
function grip(g: THREE.Object3D, z = 0, m: THREE.Material = RUBBER()): void {
  prof(g, [[0.03, 0.006], [0.036, -0.02], [0.022, -0.062], [0.012, -0.12], [-0.038, -0.12], [-0.046, -0.06], [-0.03, 0.006]], 0.038, m, z, 0, 0, 0.012, 0.008);
  for (let i = 0; i < 3; i++) rb(g, 0.04, 0.005, 0.03, 0, -0.045 - i * 0.022, z + 0.012 + i * 0.006, BLACK(), 0.002);
  rb(g, 0.04, 0.012, 0.046, 0, -0.122, z + 0.014, ACC(), 0.005);
  const guard = add(g, geo("guard", () => {
    const t = new THREE.TorusGeometry(0.03, 0.0045, 8, 18, Math.PI);
    t.rotateZ(Math.PI);
    t.rotateY(Math.PI / 2);
    return t;
  }), BLACK(), 0, 0.002, z - 0.066);
  guard.scale.set(1, 1.05, 1.15);
  rb(g, 0.008, 0.03, 0.012, 0, -0.012, z - 0.058, CHROME(), 0.004).rotation.x = -0.3;
}

function stock(g: THREE.Object3D, z: number, len: number, m: THREE.Material, pad = true): void {
  prof(g, [[0, 0.072], [0, 0.0], [-len * 0.45, -0.018], [-len, -0.055], [-len, 0.058], [-len * 0.3, 0.076]], 0.044, m, z, 0, 0, 0.016, 0.008);
  if (pad) rb(g, 0.05, 0.125, 0.022, 0, 0.002, z + len + 0.004, RUBBER(), 0.01);
}

function muzzleAt(g: THREE.Object3D, z: number, y = 0.04, x = 0): THREE.Object3D {
  const o = new THREE.Object3D();
  o.position.set(x, y, z);
  g.add(o);
  return o;
}

/** The main block of a weapon: a side profile with chamfered ends, from `rear` behind the grip to `front`. */
function frame(g: THREE.Object3D, front: number, h: number, w: number, rear = 0.07, m: THREE.Material = BODY(), y = 0): THREE.Mesh {
  return prof(g, [[-rear, 0.014], [-rear, h - 0.014], [-rear + 0.022, h], [front - 0.024, h], [front, h - 0.022], [front, 0.01], [front - 0.03, 0], [-rear + 0.02, 0]], w, m, 0, y, 0, 0.012, 0.007);
}

/** A barrel in a ringed shroud with a muzzle brake. `z0` is where it leaves the body. */
function shroud(g: THREE.Object3D, y: number, z0: number, len: number, r = 0.02): void {
  tz(g, r * 0.62, len + 0.03, 0, y, z0 - len / 2 - 0.015, BLACK());
  tz(g, r, len * 0.62, 0, y, z0 - len * 0.31, DET());
  for (let i = 0; i < 3; i++) ring(g, r + 0.001, 0.0035, 0, y, z0 - len * 0.12 - i * len * 0.19, BLACK());
  tz(g, r + 0.006, 0.05, 0, y, z0 - len - 0.005, ACC(), r + 0.004);
  for (const a of [0, Math.PI / 2]) rb(g, r * 2.6, 0.007, 0.022, 0, y, z0 - len - 0.005, BLACK(), 0.002).rotation.z = a;
}

/** A rail along the top with a row of teeth. */
function rail(g: THREE.Object3D, y: number, z0: number, len: number): void {
  rb(g, 0.022, 0.008, len, 0, y, z0 - len / 2, BLACK(), 0.003);
  for (let i = 0; i < Math.floor(len / 0.022); i++) rb(g, 0.028, 0.006, 0.01, 0, y + 0.006, z0 - 0.012 - i * 0.022, BLACK(), 0.002);
}

/** A small glass sight. */
function sight(g: THREE.Object3D, y: number, z: number): void {
  rb(g, 0.03, 0.012, 0.045, 0, y, z, BLACK(), 0.004);
  for (const sx of [-0.016, 0.016]) rb(g, 0.005, 0.036, 0.008, sx, y + 0.022, z - 0.016, BLACK(), 0.002);
  rb(g, 0.036, 0.005, 0.008, 0, y + 0.041, z - 0.016, BLACK(), 0.002);
  const lens = rb(g, 0.028, 0.03, 0.002, 0, y + 0.022, z - 0.016, pbr(PAL.a, 0, 0.1, PAL.a, 0.45), 0.004);
  lens.userData.outline = true;
}

/**
 * A paint cell: a glass tube with the paint visible inside. The level follows the magazine and
 * bubbles climb through it, faster when the weapon fires. Lies along the barrel unless `up`.
 */
function cell(g: THREE.Object3D, x: number, y: number, z: number, r: number, len: number, up = false): Anim {
  const tube = up ? ty : tz;
  const glass = tube(g, r, len, x, y, z, GLASS());
  glass.renderOrder = 2;
  glass.userData.edge = true;
  const L = len * 0.94;
  const juice = tube(g, r * 0.76, L, x, y, z, JUICE());
  for (const e of [-1, 1]) tube(g, r * 1.14, 0.014, x, up ? y + (e * len) / 2 : y, up ? z : z + (e * len) / 2, e > 0 ? BLACK() : ACC());
  const bubbles = [0, 1, 2].map(() => {
    const b = sph(g, r * 0.2, x, y, z, SHINE());
    b.userData.outline = true;
    return b;
  });
  return (s) => {
    const k = 0.1 + 0.9 * s.ammo;
    juice.scale.y = k;
    if (up) juice.position.y = y - (L * (1 - k)) / 2;
    else juice.position.z = z + (L * (1 - k)) / 2;
    bubbles.forEach((b, i) => {
      const u = (s.t * (0.45 + s.fire * 2.5) + i / 3) % 1;
      const along = (u - 0.5) * L * k;
      const wob = Math.sin(s.t * 3 + i * 2.1) * r * 0.32;
      if (up) b.position.set(x + wob, y - (L * (1 - k)) / 2 + along, z);
      else b.position.set(x + wob, y + r * 0.25, z + (L * (1 - k)) / 2 - along);
      b.visible = s.ammo > 0.02;
    });
  };
}

/** A part that can leave the weapon: build the feed into it and it goes with the hand on a reload. */
function feed(g: THREE.Object3D): THREE.Group {
  const m = new THREE.Group();
  g.add(m);
  return m;
}

/** A paint canister plugged in under the body ahead of the trigger, for weapons with no magazine of their own. */
function canister(g: THREE.Object3D, z: number): { mag: THREE.Group; grab: [number, number, number] } {
  const m = feed(g);
  rb(m, 0.036, 0.088, 0.056, 0, -0.036, z, BLACK(), 0.009);
  rb(m, 0.041, 0.034, 0.032, 0, -0.03, z, JUICE(), 0.006);
  rb(m, 0.041, 0.014, 0.062, 0, -0.084, z, ACC(), 0.005);
  return { mag: m, grab: [0, -0.122, z] };
}

/** Runs several animations as one. */
const all = (...fs: (Anim | undefined)[]): Anim => (s) => {
  for (const f of fs) f?.(s);
};

const BUILD: Record<string, Builder> = {
  // Twins: a pair of pistols. The slides snap back in turn.
  dvoyka(g) {
    const gun = (x: number) => {
      const p = new THREE.Group();
      p.position.x = x;
      g.add(p);
      grip(p);
      prof(p, [[-0.045, 0.002], [-0.045, 0.032], [0.175, 0.032], [0.175, 0.008], [0.06, 0.002]], 0.036, BLACK(), 0, 0, 0, 0.008, 0.005);
      rb(p, 0.03, 0.026, 0.095, 0, 0.012, -0.125, BLACK(), 0.008);
      tz(p, 0.009, 0.1, 0, 0.012, -0.126, JUICE());
      tz(p, 0.012, 0.04, 0, 0.058, -0.19, DET());
      const slide = new THREE.Group();
      p.add(slide);
      prof(slide, [[-0.06, 0.034], [-0.06, 0.074], [-0.04, 0.088], [0.165, 0.088], [0.182, 0.072], [0.182, 0.034]], 0.042, BODY(), 0, 0, 0, 0.01, 0.006);
      for (let i = 0; i < 4; i++) rb(slide, 0.045, 0.034, 0.005, 0, 0.06, 0.022 + i * 0.011, BLACK(), 0.002);
      rb(slide, 0.008, 0.012, 0.012, 0, 0.094, -0.165, ACC(), 0.003);
      rb(slide, 0.03, 0.012, 0.012, 0, 0.094, 0.045, BLACK(), 0.003);
      rb(slide, 0.044, 0.012, 0.06, 0, 0.062, -0.09, ACC(), 0.004);
      return slide;
    };
    const a = gun(0);
    const b = gun(-0.3);
    return {
      muzzle: muzzleAt(g, -0.215, 0.058), muzzle2: muzzleAt(g, -0.215, 0.058, -0.3),
      anim: (s) => {
        const hand = (s.rack ?? 0) * 0.04;
        a.position.z = Math.max(hand, s.shots % 2 ? s.fire * 0.04 : 0);
        b.position.z = Math.max(hand, s.shots % 2 ? 0 : s.fire * 0.04);
      },
    };
  },

  // Hammer: a revolver with a barrel like a girder. The cylinder turns a notch with every shot.
  baraban(g) {
    grip(g, 0.012, pbr(0x6b4226, 0, 0.6));
    prof(g, [[-0.05, 0.004], [-0.06, 0.05], [-0.03, 0.098], [0.04, 0.098], [0.04, 0.03], [0.12, 0.03], [0.12, 0.004]], 0.04, BODY(), 0, 0, 0, 0.01, 0.006);
    prof(g, [[0.105, 0.03], [0.105, 0.1], [0.36, 0.1], [0.38, 0.085], [0.38, 0.045], [0.3, 0.03]], 0.04, BODY(), 0, 0, 0, 0.008, 0.006);
    rb(g, 0.012, 0.012, 0.25, 0, 0.108, -0.24, BLACK(), 0.003);
    for (let i = 0; i < 5; i++) rb(g, 0.042, 0.014, 0.018, 0, 0.088, -0.15 - i * 0.045, BLACK(), 0.004);
    tz(g, 0.017, 0.02, 0, 0.07, -0.385, BLACK());
    tz(g, 0.011, 0.25, 0, 0.042, -0.25, CHROME());
    rb(g, 0.01, 0.022, 0.012, 0, 0.116, -0.36, ACC(), 0.003);
    const drum = new THREE.Group();
    drum.position.set(0, 0.066, -0.035);
    g.add(drum);
    tz(drum, 0.046, 0.085, 0, 0, 0, DET());
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      tz(drum, 0.0125, 0.09, Math.cos(a) * 0.028, Math.sin(a) * 0.028, 0, JUICE());
      rb(drum, 0.01, 0.012, 0.06, Math.cos(a + 0.52) * 0.046, Math.sin(a + 0.52) * 0.046, 0, BLACK(), 0.003).rotation.z = a + 0.52;
    }
    const hammer = rb(g, 0.014, 0.04, 0.022, 0, 0.108, 0.05, CHROME(), 0.005);
    return {
      muzzle: muzzleAt(g, -0.4, 0.07), left: [0, -0.03, -0.1],
      anim: (s) => {
        // Opened to load, the cylinder swings out to the side and is given a spin.
        const open = s.rack ?? 0;
        drum.rotation.z = -((s.shots - s.fire) * Math.PI) / 3 + open * 9;
        drum.position.x = -open * 0.045;
        hammer.rotation.x = -0.6 * (1 - s.fire);
      },
    };
  },

  // Striker: a compact carbine. The bolt racks, and the cell on its back shows what is left.
  sprinter(g) {
    grip(g);
    frame(g, 0.25, 0.086, 0.046);
    stock(g, 0.07, 0.19, BODY());
    shroud(g, 0.05, -0.25, 0.26, 0.021);
    rail(g, 0.09, -0.02, 0.2);
    sight(g, 0.1, -0.05);
    const mag = feed(g);
    prof(mag, [[0.06, 0.004], [0.065, -0.085], [0.11, -0.095], [0.125, 0.004]], 0.034, BLACK(), 0, 0, 0, 0.008, 0.005);
    rb(mag, 0.036, 0.014, 0.05, 0, -0.092, -0.09, ACC(), 0.005);
    rb(g, 0.05, 0.03, 0.11, 0, 0.035, -0.14, ACC(), 0.008);
    // The cell rides on the left, where the shooter can see how much is left.
    const juice = cell(g, -0.04, 0.05, -0.1, 0.02, 0.15);
    for (const z of [-0.16, -0.04]) rb(g, 0.02, 0.05, 0.014, -0.03, 0.05, z, BLACK(), 0.004);
    const bolt = rb(g, 0.022, 0.014, 0.03, 0.03, 0.062, -0.02, CHROME(), 0.005);
    rb(g, 0.004, 0.02, 0.1, 0.0245, 0.062, 0.02, BLACK(), 0.002);
    return {
      muzzle: muzzleAt(g, -0.55, 0.05), left: [0, -0.02, -0.2], mag, grab: [0, -0.13, -0.09],
      anim: all(juice, (s) => (bolt.position.z = -0.02 + Math.max(s.fire, s.rack ?? 0) * 0.07)),
    };
  },

  // Breaker: a pump shotgun with a mouth like a drain. Pump back, pump forward.
  zalp(g) {
    grip(g);
    frame(g, 0.2, 0.094, 0.052);
    stock(g, 0.07, 0.2, pbr(0x6b4226, 0, 0.6));
    tz(g, 0.03, 0.4, 0, 0.066, -0.38, DET());
    tz(g, 0.022, 0.41, 0, 0.066, -0.385, BLACK());
    tz(g, 0.04, 0.05, 0, 0.066, -0.59, ACC(), 0.034);
    ring(g, 0.036, 0.005, 0, 0.066, -0.615, BLACK());
    tz(g, 0.019, 0.34, 0, 0.018, -0.35, CHROME());
    for (const z of [-0.2, -0.52]) rb(g, 0.03, 0.075, 0.016, 0, 0.044, z, BLACK(), 0.005);
    const pump = new THREE.Group();
    g.add(pump);
    tz(pump, 0.031, 0.14, 0, 0.018, -0.39, RUBBER());
    for (let i = 0; i < 5; i++) ring(pump, 0.032, 0.004, 0, 0.018, -0.335 - i * 0.027, ACC());
    for (let i = 0; i < 5; i++) {
      tx(g, 0.013, 0.012, 0.03, 0.05, -0.02 - i * 0.03, JUICE());
      tx(g, 0.014, 0.004, 0.037, 0.05, -0.02 - i * 0.03, CHROME());
    }
    rb(g, 0.008, 0.016, 0.014, 0, 0.102, -0.57, ACC(), 0.003);
    return {
      muzzle: muzzleAt(g, -0.62, 0.066), left: [0, -0.045, -0.27],
      // Back fast while the shot still echoes, forward again more slowly.
      anim: (s) => (pump.position.z = Math.max((s.rack ?? 0) * 0.1, Math.sin(Math.min(1, (1 - s.fire) * 1.6) * Math.PI) * 0.1 * (s.fire > 0.02 ? 1 : 0))),
    };
  },

  // Rattler: an automatic fed from a drum of paint that turns as it empties.
  treshotka(g) {
    grip(g);
    frame(g, 0.27, 0.088, 0.048);
    prof(g, [[0, 0.07], [0, 0.02], [-0.16, 0.0], [-0.2, -0.04], [-0.2, 0.06], [-0.06, 0.078]], 0.03, BLACK(), 0.07, 0, 0, 0.012, 0.006);
    rb(g, 0.04, 0.1, 0.02, 0, 0.01, 0.275, RUBBER(), 0.008);
    tz(g, 0.03, 0.2, 0, 0.052, -0.36, BODY());
    for (let i = 0; i < 5; i++) for (const a of [0.6, Math.PI - 0.6]) rb(g, 0.012, 0.012, 0.02, Math.cos(a) * 0.028, 0.052 + Math.sin(a) * 0.028, -0.29 - i * 0.035, BLACK(), 0.004);
    tz(g, 0.016, 0.1, 0, 0.052, -0.5, BLACK());
    tz(g, 0.024, 0.035, 0, 0.052, -0.545, ACC());
    rail(g, 0.092, 0.03, 0.26);
    sight(g, 0.102, -0.02);
    const mag = feed(g);
    const drum = new THREE.Group();
    drum.position.set(0, -0.045, -0.15);
    mag.add(drum);
    tx(drum, 0.062, 0.05, 0, 0, 0, DET(), 24);
    tx(drum, 0.05, 0.056, 0, 0, 0, JUICE(), 24);
    for (let i = 0; i < 6; i++) rb(drum, 0.06, 0.016, 0.03, 0, Math.sin((i / 6) * Math.PI * 2) * 0.05, Math.cos((i / 6) * Math.PI * 2) * 0.05, BLACK(), 0.005).rotation.x = -(i / 6) * Math.PI * 2;
    tx(drum, 0.016, 0.066, 0, 0, 0, CHROME());
    rb(g, 0.036, 0.05, 0.05, 0, 0.0, -0.15, BLACK(), 0.008);
    const bolt = rb(g, 0.02, 0.014, 0.03, -0.031, 0.06, -0.05, CHROME(), 0.005);
    return {
      muzzle: muzzleAt(g, -0.565, 0.052), left: [0, -0.03, -0.25], mag, grab: [0, -0.14, -0.15],
      anim: (s) => {
        drum.rotation.x = -(s.shots - s.fire) * 0.5;
        bolt.position.z = -0.05 + Math.max(s.fire, s.rack ?? 0) * 0.06;
      },
    };
  },

  // Triad: three barrels, three shots. The lamps on its side count them off.
  ochered(g) {
    grip(g);
    frame(g, 0.3, 0.1, 0.05, 0.2);
    rb(g, 0.052, 0.13, 0.024, 0, 0.03, 0.21, RUBBER(), 0.01);
    const mag = feed(g);
    prof(mag, [[0.09, 0.004], [0.095, -0.1], [0.14, -0.108], [0.15, 0.004]], 0.036, BLACK(), 0, 0, 0, 0.008, 0.005);
    rb(mag, 0.038, 0.016, 0.052, 0, -0.106, -0.12, ACC(), 0.005);
    for (const [x, y] of [[0, 0.076], [-0.018, 0.04], [0.018, 0.04]]) {
      tz(g, 0.0155, 0.22, x, y, -0.4, DET());
      tz(g, 0.0095, 0.23, x, y, -0.405, BLACK());
    }
    for (const z of [-0.32, -0.49]) tz(g, 0.047, 0.022, 0, 0.054, z, ACC(), 0.047, 3).rotation.z = Math.PI / 6;
    rail(g, 0.104, 0.1, 0.3);
    sight(g, 0.114, -0.02);
    const lamps = [0, 1, 2].map((i) => {
      const m = glowMat(PAL.a);
      for (const sx of [-1, 1]) tx(g, 0.011, 0.006, sx * 0.027, 0.07, -0.12 - i * 0.034, m);
      return m;
    });
    rb(g, 0.054, 0.03, 0.13, 0, 0.07, -0.155, BLACK(), 0.006);
    return {
      muzzle: muzzleAt(g, -0.525, 0.054), left: [0, -0.01, -0.24], mag, grab: [0, -0.146, -0.12],
      anim: (s) => lamps.forEach((m, i) => (m.emissiveIntensity = 0.25 + (s.shots % 3 === i ? 2.6 * s.fire + 0.5 : 0))),
    };
  },

  // Cyclone: six barrels and a motor. The fan at the back spins up with them.
  raduga(g) {
    grip(g, 0.02);
    frame(g, 0.2, 0.12, 0.085, 0.09, BODY(), -0.012);
    tz(g, 0.058, 0.13, 0, 0.05, -0.25, BLACK());
    for (let i = 0; i < 4; i++) ring(g, 0.059, 0.005, 0, 0.05, -0.2 - i * 0.032, ACC());
    const spin = new THREE.Group();
    spin.position.set(0, 0.05, 0);
    g.add(spin);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      tz(spin, 0.0125, 0.32, Math.cos(a) * 0.033, Math.sin(a) * 0.033, -0.47, i % 2 ? DET() : CHROME());
    }
    for (const z of [-0.36, -0.5, -0.62]) tz(spin, 0.05, 0.016, 0, 0, z, ACC());
    tz(spin, 0.012, 0.34, 0, 0, -0.46, BLACK());
    rb(g, 0.02, 0.05, 0.02, 0, 0.14, -0.14, BLACK(), 0.005);
    rb(g, 0.02, 0.05, 0.02, 0, 0.14, 0.0, BLACK(), 0.005);
    tz(g, 0.016, 0.2, 0, 0.165, -0.07, RUBBER());
    const fan = new THREE.Group();
    fan.position.set(0, 0.05, 0.095);
    g.add(fan);
    for (let i = 0; i < 5; i++) rb(fan, 0.085, 0.018, 0.006, 0, 0, 0, CHROME(), 0.003).rotation.z = (i / 5) * Math.PI;
    ring(g, 0.05, 0.006, 0, 0.05, 0.097, BLACK());
    const mag = feed(g);
    rb(mag, 0.07, 0.11, 0.12, 0.075, 0.03, -0.04, DET(), 0.012);
    const juice = cell(mag, 0.075, 0.03, -0.04, 0.022, 0.1, true);
    return {
      muzzle: muzzleAt(g, -0.65, 0.05), spin, left: [0, 0.115, -0.07], mag, grab: [0.075, 0.118, -0.04],
      anim: all(juice, (s) => (fan.rotation.z = s.t * (1.5 + s.spin * 40))),
    };
  },

  // Torrent: a tank, a pump and a nozzle. Watch the gauge.
  gidrant(g) {
    grip(g);
    frame(g, 0.22, 0.07, 0.05);
    stock(g, 0.07, 0.17, BODY(), false);
    const mag = feed(g);
    const juice = cell(mag, 0, 0.125, -0.08, 0.05, 0.24);
    for (const z of [-0.17, 0.01]) rb(g, 0.06, 0.07, 0.018, 0, 0.1, z, BLACK(), 0.006);
    tz(g, 0.018, 0.22, 0, 0.04, -0.32, CHROME());
    tz(g, 0.026, 0.05, 0, 0.04, -0.25, ACC());
    tz(g, 0.022, 0.09, 0, 0.04, -0.45, DET(), 0.04);
    ring(g, 0.04, 0.005, 0, 0.04, -0.495, BLACK());
    const hose = capsule(g, 0.01, 0.13, 0.03, 0.085, -0.2, RUBBER());
    hose.rotation.x = Math.PI / 2 - 0.55;
    tz(g, 0.03, 0.012, -0.031, 0.04, 0.0, BLACK()).rotation.y = Math.PI / 2;
    const dial = tx(g, 0.027, 0.006, -0.036, 0.04, 0.0, pbr(0xf5f5f0, 0, 0.4));
    void dial;
    const needle = new THREE.Group();
    needle.position.set(-0.041, 0.04, 0.0);
    g.add(needle);
    rb(needle, 0.003, 0.024, 0.004, 0, 0.01, 0, pbr(0xff3b30, 0, 0.4), 0.001);
    const lever = rb(g, 0.012, 0.012, 0.1, 0.034, 0.02, -0.12, ACC(), 0.004);
    return {
      muzzle: muzzleAt(g, -0.5, 0.04), left: [0, -0.02, -0.26], mag, grab: [0, 0.208, -0.08],
      anim: all(juice, (s) => {
        needle.rotation.x = -1.1 + s.fire * 2.2 + Math.sin(s.t * 30) * 0.05 * s.fire;
        lever.position.z = -0.12 + Math.sin(s.t * 26) * 0.012 * s.fire;
      }),
    };
  },

  // Longshot: a long barrel, a big scope and a bolt worked after every shot.
  dalnoboy(g) {
    grip(g);
    frame(g, 0.24, 0.08, 0.044);
    prof(g, [[0, 0.074], [0, 0.0], [-0.1, -0.02], [-0.24, -0.06], [-0.24, 0.07], [-0.12, 0.092], [-0.04, 0.092]], 0.044, BODY(), 0.07, 0, 0, 0.016, 0.008);
    rb(g, 0.05, 0.14, 0.022, 0, 0.004, 0.315, RUBBER(), 0.01);
    tz(g, 0.017, 0.5, 0, 0.052, -0.49, DET());
    for (let i = 0; i < 6; i++) rb(g, 0.04, 0.008, 0.05, 0, 0.052, -0.3 - i * 0.065, BLACK(), 0.003).rotation.z = (i % 2) * (Math.PI / 2);
    tz(g, 0.026, 0.09, 0, 0.052, -0.75, ACC());
    for (const a of [0, Math.PI / 2]) rb(g, 0.06, 0.012, 0.03, 0, 0.052, -0.75, BLACK(), 0.003).rotation.z = a;
    tz(g, 0.03, 0.26, 0, 0.142, -0.07, BLACK());
    tz(g, 0.04, 0.06, 0, 0.142, -0.22, BLACK(), 0.03);
    tz(g, 0.036, 0.05, 0, 0.142, 0.07, BLACK(), 0.036);
    const lens = tz(g, 0.033, 0.004, 0, 0.142, -0.252, glowMat(PAL.a));
    tz(g, 0.03, 0.004, 0, 0.142, 0.096, glowMat(PAL.a));
    for (const z of [-0.14, 0.0]) rb(g, 0.026, 0.04, 0.03, 0, 0.1, z, ACC(), 0.006);
    ty(g, 0.012, 0.022, 0, 0.18, -0.07, CHROME());
    for (const sx of [-1, 1]) {
      const leg = rb(g, 0.01, 0.01, 0.2, sx * 0.02, 0.022, -0.36, BLACK(), 0.004);
      leg.rotation.y = sx * 0.06;
    }
    const mag = feed(g);
    prof(mag, [[0.07, 0.004], [0.075, -0.07], [0.115, -0.078], [0.125, 0.004]], 0.03, BLACK(), 0, 0, 0, 0.008, 0.005);
    rb(mag, 0.033, 0.012, 0.05, 0, -0.076, -0.097, ACC(), 0.004);
    const bolt = new THREE.Group();
    g.add(bolt);
    tz(bolt, 0.01, 0.07, 0, 0.06, 0.02, CHROME());
    const knob = sph(bolt, 0.014, -0.045, 0.045, 0.045, ACC());
    tx(bolt, 0.006, 0.05, -0.022, 0.052, 0.045, CHROME());
    void knob;
    return {
      muzzle: muzzleAt(g, -0.8, 0.052), glow: [lens], left: [0, -0.02, -0.26], mag, grab: [0, -0.114, -0.097],
      // Up, back, forward, down: the bolt cycles while the shot rings.
      anim: (s) => {
        const u = 1 - s.fire;
        const pull = Math.max(s.rack ?? 0, s.fire > 0.03 ? Math.sin(Math.min(1, u * 1.4) * Math.PI) : 0);
        bolt.position.z = pull * 0.06;
        bolt.rotation.z = -pull * 0.5;
      },
    };
  },

  // Overload: two rails and a row of coils. Hold the trigger and they wake up one by one.
  impuls(g) {
    grip(g);
    frame(g, 0.2, 0.09, 0.05);
    stock(g, 0.07, 0.18, BODY());
    for (const y of [0.086, 0.02]) {
      rb(g, 0.03, 0.014, 0.46, 0, y, -0.42, DET(), 0.005);
      rb(g, 0.036, 0.02, 0.05, 0, y, -0.64, ACC(), 0.006);
    }
    const coils: THREE.Mesh[] = [];
    for (let i = 0; i < 6; i++) {
      const c = ring(g, 0.026, 0.008, 0, 0.053, -0.24 - i * 0.065, glowMat(PAL.a));
      c.scale.set(0.8, 1.25, 1);
      coils.push(c);
    }
    tz(g, 0.009, 0.44, 0, 0.053, -0.42, CHROME());
    rb(g, 0.06, 0.05, 0.13, 0, 0.11, -0.06, BLACK(), 0.012);
    const caps = [0, 1, 2].map((i) => ty(g, 0.016, 0.04, -0.018 + i * 0.018, 0.15, -0.1 + i * 0.04, glowMat(PAL.c)));
    const fins = [-1, 1].map((sx) => {
      const f = new THREE.Group();
      f.position.set(sx * 0.026, 0.053, -0.2);
      g.add(f);
      rb(f, 0.006, 0.07, 0.14, sx * 0.01, 0, -0.06, ACC(), 0.003);
      return f;
    });
    return {
      muzzle: muzzleAt(g, -0.67, 0.053), glow: coils, left: [0, -0.04, -0.22], ...canister(g, -0.115),
      anim: (s) => {
        coils.forEach((c, i) => {
          const on = Math.max(0, Math.min(1, s.charge * 6 - i)) + s.fire;
          (c.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.3 + on * 3;
          c.rotation.z = s.t * (1 + s.charge * 14) * (i % 2 ? 1 : -1);
        });
        caps.forEach((c, i) => ((c.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.4 + Math.max(0, Math.sin(s.t * 5 + i * 2)) * (0.6 + s.charge * 2)));
        fins.forEach((f, i) => (f.rotation.y = (i ? 1 : -1) * (s.charge * 0.5 + s.fire * 0.3)));
      },
    };
  },

  // Sweeper: five barrels side by side behind a wide mouth. The shutter snaps across.
  veer(g) {
    grip(g);
    frame(g, 0.2, 0.084, 0.05);
    stock(g, 0.07, 0.17, BODY());
    prof(g, [[0.19, 0.012], [0.19, 0.078], [0.4, 0.07], [0.42, 0.058], [0.42, 0.03], [0.4, 0.02]], 0.17, BODY(), 0, 0, 0, 0.01, 0.006);
    for (let i = 0; i < 5; i++) {
      tz(g, 0.0145, 0.06, -0.064 + i * 0.032, 0.045, -0.42, DET());
      tz(g, 0.0095, 0.066, -0.064 + i * 0.032, 0.045, -0.422, BLACK());
    }
    rb(g, 0.18, 0.012, 0.03, 0, 0.078, -0.4, ACC(), 0.004);
    rb(g, 0.18, 0.012, 0.03, 0, 0.012, -0.4, ACC(), 0.004);
    const juice = cell(g, 0, 0.112, -0.05, 0.022, 0.13);
    const shutter = rb(g, 0.04, 0.05, 0.008, -0.064, 0.045, -0.457, CHROME(), 0.004);
    for (const sx of [-1, 1]) rb(g, 0.012, 0.03, 0.16, sx * 0.07, 0.045, -0.3, BLACK(), 0.004);
    return {
      muzzle: muzzleAt(g, -0.46, 0.045), left: [0, -0.03, -0.25], ...canister(g, -0.115),
      anim: all(juice, (s) => (shutter.position.x = -0.064 + ((s.shots % 2 ? 1 - s.fire : s.fire) * 0.128))),
    };
  },

  // Ricochet: a spring you can see and a ball that cannot sit still.
  rikoshet(g) {
    grip(g);
    frame(g, 0.17, 0.084, 0.048);
    stock(g, 0.07, 0.16, BODY(), false);
    const dome = sph(g, 0.06, 0, 0.12, -0.05, GLASS());
    dome.renderOrder = 2;
    dome.userData.edge = true;
    ring(g, 0.046, 0.008, 0, 0.085, -0.05, ACC()).rotation.x = Math.PI / 2;
    const ballM = glowMat(PAL.a);
    const ball = sph(g, 0.024, 0, 0.12, -0.05, ballM);
    const coil: THREE.Mesh[] = [];
    for (let i = 0; i < 7; i++) coil.push(ring(g, 0.026, 0.006, 0, 0.045, -0.2 - i * 0.032, CHROME()));
    tz(g, 0.013, 0.26, 0, 0.045, -0.3, BLACK());
    tz(g, 0.034, 0.05, 0, 0.045, -0.44, ACC(), 0.026);
    tz(g, 0.03, 0.03, 0, 0.045, -0.18, DET());
    for (const a of [0.5, 2.6, 4.7]) rb(g, 0.008, 0.008, 0.24, Math.cos(a) * 0.036, 0.045 + Math.sin(a) * 0.036, -0.31, DET(), 0.003);
    return {
      muzzle: muzzleAt(g, -0.47, 0.045), left: [0, -0.04, -0.23], ...canister(g, -0.112),
      anim: (s) => {
        const squash = 1 - s.fire * 0.55;
        coil.forEach((c, i) => (c.position.z = -0.2 - i * 0.032 * squash));
        const bounce = Math.abs(Math.sin(s.t * (4 + s.fire * 20)));
        ball.position.set(Math.sin(s.t * 7.3) * 0.022, 0.1 + bounce * 0.04, -0.05 + Math.cos(s.t * 5.1) * 0.022);
        ballM.emissiveIntensity = 0.8 + s.fire * 2;
      },
    };
  },

  // Mortar: a tube you could park in, with the next bomb waiting in the breech.
  mortira(g) {
    grip(g);
    frame(g, 0.16, 0.07, 0.05);
    tz(g, 0.062, 0.48, 0, 0.115, -0.2, BODY());
    tz(g, 0.07, 0.06, 0, 0.115, -0.45, ACC(), 0.064);
    tz(g, 0.05, 0.49, 0, 0.115, -0.205, BLACK());
    tz(g, 0.058, 0.09, 0, 0.115, 0.08, DET(), 0.078);
    for (const z of [-0.33, -0.12, 0.02]) ring(g, 0.064, 0.006, 0, 0.115, z, BLACK());
    rb(g, 0.04, 0.05, 0.05, 0, 0.05, -0.02, BLACK(), 0.008);
    rb(g, 0.012, 0.07, 0.012, -0.068, 0.2, -0.25, BLACK(), 0.004);
    rb(g, 0.03, 0.03, 0.004, -0.068, 0.225, -0.25, pbr(PAL.a, 0, 0.1, PAL.a, 0.5), 0.004).userData.outline = true;
    const mag = feed(g);
    const bomb = new THREE.Group();
    bomb.position.set(0, 0.205, -0.07);
    mag.add(bomb);
    sph(bomb, 0.042, 0, 0, 0, JUICE());
    ty(bomb, 0.012, 0.02, 0, 0.045, 0, BLACK());
    sph(bomb, 0.01, 0, 0.062, 0, glowMat(0xffb04a));
    for (const sx of [-1, 1]) rb(g, 0.01, 0.06, 0.1, sx * 0.045, 0.19, -0.07, ACC(), 0.004);
    const flaps = [-1, 1].map((sx) => {
      const f = new THREE.Group();
      f.position.set(sx * 0.074, 0.115, 0.115);
      g.add(f);
      rb(f, 0.008, 0.08, 0.07, 0, 0, 0.035, CHROME(), 0.003);
      return f;
    });
    return {
      muzzle: muzzleAt(g, -0.48, 0.115), left: [0, 0.03, -0.2], mag, grab: [0, 0.285, -0.07],
      anim: (s) => {
        // The bomb drops into the tube with the shot and the next one rises into place.
        bomb.position.y = 0.205 - (s.fire > 0.5 ? (1 - s.fire) * 0.16 : s.fire * 0.16);
        bomb.rotation.y = s.t * 0.8;
        flaps.forEach((f, i) => (f.rotation.y = (i ? 1 : -1) * s.fire * 0.9));
      },
    };
  },

  // Leech: six fat chambers of something that will not let go. The drum clunks round.
  lipuchka(g) {
    grip(g);
    frame(g, 0.12, 0.08, 0.046);
    stock(g, 0.07, 0.18, BODY());
    const mag = feed(g);
    const drum = new THREE.Group();
    drum.position.set(0, 0.052, -0.2);
    mag.add(drum);
    tz(drum, 0.07, 0.13, 0, 0, 0, DET());
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      tz(drum, 0.021, 0.136, Math.cos(a) * 0.043, Math.sin(a) * 0.043, 0, JUICE());
      rb(drum, 0.012, 0.014, 0.1, Math.cos(a + 0.52) * 0.07, Math.sin(a + 0.52) * 0.07, 0, BLACK(), 0.004).rotation.z = a + 0.52;
    }
    tz(drum, 0.014, 0.15, 0, 0, 0, CHROME());
    tz(g, 0.03, 0.2, 0, 0.095, -0.37, BODY());
    tz(g, 0.022, 0.21, 0, 0.095, -0.375, BLACK());
    tz(g, 0.038, 0.04, 0, 0.095, -0.46, ACC());
    rb(mag, 0.03, 0.03, 0.2, 0, 0.012, -0.2, BLACK(), 0.008);
    prof(g, [[0.28, 0.004], [0.285, -0.07], [0.32, -0.076], [0.33, 0.004]], 0.03, RUBBER(), 0, 0, 0, 0.008, 0.005);
    rail(g, 0.128, -0.28, 0.14);
    return {
      muzzle: muzzleAt(g, -0.48, 0.095), left: [0, -0.03, -0.3], mag, grab: [0, -0.05, -0.2],
      anim: (s) => (drum.rotation.z = -((s.shots - s.fire * s.fire) * Math.PI) / 3),
    };
  },

  // Swarm: a honeycomb of launch tubes behind two wings that open when it lets go.
  roy(g) {
    grip(g);
    frame(g, 0.18, 0.09, 0.05);
    stock(g, 0.07, 0.16, BODY(), false);
    tz(g, 0.075, 0.2, 0, 0.065, -0.29, BODY(), 0.075, 6);
    const cells: THREE.MeshStandardMaterial[] = [];
    for (let i = 0; i < 7; i++) {
      const a = (i / 6) * Math.PI * 2;
      const r = i === 6 ? 0 : 0.044;
      tz(g, 0.019, 0.21, Math.cos(a) * r, 0.065 + Math.sin(a) * r, -0.295, BLACK(), 0.019, 6);
      const m = glowMat(PAL.a);
      tz(g, 0.012, 0.006, Math.cos(a) * r, 0.065 + Math.sin(a) * r, -0.395, m, 0.012, 6);
      cells.push(m);
    }
    tz(g, 0.08, 0.02, 0, 0.065, -0.39, ACC(), 0.08, 6);
    tz(g, 0.08, 0.02, 0, 0.065, -0.2, ACC(), 0.08, 6);
    const wings = [-1, 1].map((sx) => {
      const w = new THREE.Group();
      w.position.set(sx * 0.07, 0.065, -0.2);
      g.add(w);
      prof(w, [[0, -0.045], [0, 0.045], [0.16, 0.03], [0.2, 0.0], [0.16, -0.03]], 0.008, DET(), 0, 0, sx * 0.008, 0.008, 0.003);
      rb(w, 0.01, 0.014, 0.12, sx * 0.012, 0, -0.08, ACC(), 0.003);
      return w;
    });
    return {
      muzzle: muzzleAt(g, -0.41, 0.065), left: [0, -0.05, -0.23], ...canister(g, -0.115),
      anim: (s) => {
        wings.forEach((w, i) => (w.rotation.y = (i ? -1 : 1) * (0.12 + s.fire * 0.75 + Math.sin(s.t * 2) * 0.03)));
        cells.forEach((m, i) => (m.emissiveIntensity = 0.5 + Math.max(0, Math.sin(s.t * 6 - i * 0.9)) * 1.2 + s.fire * 2));
      },
    };
  },

  // Supernova: a small star held between two prongs, with rings that will not stop turning.
  sverhnova(g) {
    grip(g);
    frame(g, 0.14, 0.09, 0.05);
    stock(g, 0.07, 0.17, BODY(), false);
    for (const sy of [-1, 1]) {
      const prong: Pt[] = [[0.12, 0.053 + sy * 0.03], [0.2, 0.053 + sy * 0.085], [0.44, 0.053 + sy * 0.075], [0.47, 0.053 + sy * 0.05], [0.24, 0.053 + sy * 0.05], [0.17, 0.053 + sy * 0.012]];
      prof(g, prong, 0.034, BODY(), 0, 0, 0, 0.008, 0.005);
      rb(g, 0.04, 0.012, 0.2, 0, 0.053 + sy * 0.092, -0.32, ACC(), 0.004);
      tz(g, 0.012, 0.02, 0, 0.053 + sy * 0.05, -0.46, glowMat(PAL.c));
    }
    const coreM = glowMat(PAL.a);
    const core = sph(g, 0.036, 0, 0.053, -0.31, coreM);
    const halo = sph(g, 0.05, 0, 0.053, -0.31, pbr(PAL.a, 0, 0.1, PAL.a, 0.28));
    halo.userData.outline = true;
    const rings = [0, 1].map((i) => {
      const h = new THREE.Group();
      h.position.set(0, 0.053, -0.31);
      g.add(h);
      const r = ring(h, 0.06 + i * 0.012, 0.004, 0, 0, 0, CHROME());
      r.rotation.y = Math.PI / 2;
      return h;
    });
    const mag = feed(g);
    tz(mag, 0.03, 0.05, 0, 0.053, -0.16, DET());
    tz(mag, 0.018, 0.03, 0, 0.053, -0.195, glowMat(PAL.c));
    ty(mag, 0.012, 0.03, 0, 0.09, -0.16, ACC());
    return {
      muzzle: muzzleAt(g, -0.4, 0.053), glow: [core], left: [0, -0.04, -0.22], mag, grab: [0, 0.13, -0.16],
      anim: (s) => {
        // The star collapses as it is thrown and swells back.
        const size = (1 - s.fire * 0.75) * (1 + Math.sin(s.t * 5) * 0.06);
        core.scale.setScalar(size);
        halo.scale.setScalar(size * (1.05 + Math.sin(s.t * 3) * 0.1));
        coreM.emissiveIntensity = 1.1 + Math.sin(s.t * 5) * 0.3 + s.fire * 3;
        rings[0].rotation.set(s.t * (1.4 + s.fire * 10), 0, s.t * 0.6);
        rings[1].rotation.set(0.9, s.t * (1.1 + s.fire * 8), s.t * 0.4);
      },
    };
  },
};

// ---------------------------------------------------------------------------------------------
// Blades. The handle lies along Z through the origin, where the hand closes on it; the blade
// runs forward (-Z) with its edge down. `fire` is a swing, `charge` runs 0..1 while the blade is
// being looked over, and each one does its own trick with that.

const STEEL = () => pbr(0xdfe6ee, 0.85, 0.22);
/** Bare steel on the plain finish; a skin paints the blade itself. */
const BLADE = () => (PAL.tex ? BODY() : STEEL());
const edge = (g: THREE.Object3D, pts: Pt[], w = 0.009, m: THREE.Material = BLADE()) => prof(g, pts, w, m, 0, 0, 0, 0.004, 0.0038);

function hilt(g: THREE.Object3D, len = 0.105, r = 0.0165, m: THREE.Material = RUBBER(), z = 0.006): void {
  tz(g, r, len, 0, 0, z, m);
  for (let i = 0; i < 4; i++) ring(g, r, 0.003, 0, 0, z - len * 0.32 + i * len * 0.21, ACC());
  tz(g, r + 0.003, 0.014, 0, 0, z + len / 2 + 0.006, DET());
}

Object.assign(BUILD, {
  k_combat(g: THREE.Group) {
    edge(g, [[0.045, 0.017], [0.2, 0.017], [0.262, -0.002], [0.25, -0.016], [0.2, -0.022], [0.045, -0.022]]);
    rb(g, 0.011, 0.007, 0.13, 0, 0.004, -0.13, BLACK(), 0.002);
    for (let i = 0; i < 4; i++) rb(g, 0.011, 0.01, 0.007, 0, 0.018, -0.06 - i * 0.012, BLACK(), 0.002);
    rb(g, 0.022, 0.07, 0.013, 0, -0.002, -0.046, DET(), 0.005);
    hilt(g);
    return { muzzle: muzzleAt(g, -0.26, 0), anim: undefined };
  },

  k_kunai(g: THREE.Group) {
    edge(g, [[0.03, 0.007], [0.075, 0.034], [0.215, 0.0], [0.075, -0.034], [0.03, -0.007]], 0.011);
    rb(g, 0.012, 0.006, 0.12, 0, 0, -0.11, BLACK(), 0.002);
    tz(g, 0.011, 0.1, 0, 0, 0.012, pbr(0xf2ead8, 0, 0.9));
    for (let i = 0; i < 6; i++) ring(g, 0.0115, 0.0028, 0, 0, -0.03 + i * 0.017, ACC());
    const loop = ring(g, 0.021, 0.005, 0, 0, 0.083, STEEL());
    loop.rotation.y = Math.PI / 2;
    return { muzzle: muzzleAt(g, -0.215, 0), anim: undefined };
  },

  k_cleaver(g: THREE.Group) {
    edge(g, [[0.04, 0.032], [0.235, 0.05], [0.252, 0.034], [0.252, -0.075], [0.07, -0.075], [0.045, -0.03]], 0.011);
    tx(g, 0.013, 0.014, 0, 0.022, -0.215, BLACK());
    rb(g, 0.012, 0.012, 0.18, 0, -0.07, -0.16, ACC(), 0.003);
    tz(g, 0.018, 0.115, 0, 0, 0.008, pbr(0x6b4226, 0, 0.6));
    for (const z of [-0.025, 0.008, 0.04]) tx(g, 0.006, 0.04, 0, 0, z, CHROME(), 10);
    tz(g, 0.021, 0.014, 0, 0, 0.07, DET());
    rb(g, 0.02, 0.05, 0.012, 0, 0, -0.044, DET(), 0.005);
    return { muzzle: muzzleAt(g, -0.25, 0), anim: undefined };
  },

  k_machete(g: THREE.Group) {
    edge(g, [[0.04, 0.018], [0.3, 0.03], [0.44, 0.052], [0.465, 0.036], [0.43, -0.022], [0.3, -0.032], [0.04, -0.022]], 0.009);
    rb(g, 0.01, 0.007, 0.3, 0, 0.012, -0.2, BLACK(), 0.002);
    for (let i = 0; i < 7; i++) rb(g, 0.01, 0.012, 0.008, 0, 0.03 + i * 0.002, -0.3 - i * 0.016, BLACK(), 0.002);
    hilt(g, 0.115, 0.017, BLACK());
    const bow = ring(g, 0.055, 0.005, 0, -0.03, 0.008, DET());
    bow.rotation.y = Math.PI / 2;
    bow.scale.set(1, 0.65, 1);
    return { muzzle: muzzleAt(g, -0.46, 0.02), anim: undefined };
  },

  k_karambit(g: THREE.Group) {
    edge(g, [[0.03, 0.022], [0.1, 0.034], [0.165, 0.014], [0.205, -0.04], [0.205, -0.095], [0.165, -0.052], [0.115, -0.022], [0.03, -0.018]], 0.011);
    rb(g, 0.012, 0.006, 0.07, 0, 0.012, -0.09, BLACK(), 0.002).rotation.x = 0.25;
    prof(g, [[-0.07, -0.018], [-0.075, 0.012], [-0.02, 0.022], [0.035, 0.02], [0.035, -0.02], [-0.02, -0.024]], 0.022, RUBBER(), 0, 0, 0, 0.008, 0.005);
    for (const z of [-0.012, 0.022]) tx(g, 0.005, 0.026, 0, 0, z, ACC(), 8);
    const loop = ring(g, 0.022, 0.006, 0, -0.004, 0.092, DET());
    loop.rotation.y = Math.PI / 2;
    return { muzzle: muzzleAt(g, -0.2, -0.06), anim: undefined };
  },

  k_butterfly(g: THREE.Group) {
    edge(g, [[0.04, 0.013], [0.2, 0.013], [0.24, 0.0], [0.2, -0.013], [0.04, -0.013]], 0.008);
    for (let i = 0; i < 3; i++) tx(g, 0.006, 0.012, 0, 0, -0.08 - i * 0.035, BLACK(), 10);
    tx(g, 0.008, 0.03, 0, 0, -0.04, DET(), 10);
    const halves = [1, -1].map((sy) => {
      const h = new THREE.Group();
      h.position.set(0, sy * 0.008, -0.04);
      g.add(h);
      rb(h, 0.014, 0.013, 0.118, 0, 0, 0.059, sy > 0 ? BODY() : ACC(), 0.005);
      for (let i = 0; i < 4; i++) tx(h, 0.004, 0.018, 0, 0, 0.025 + i * 0.024, BLACK(), 8);
      return h;
    });
    rb(halves[0], 0.008, 0.03, 0.008, 0, -0.01, 0.112, DET(), 0.003);
    return {
      muzzle: muzzleAt(g, -0.24, 0),
      // Looked over, one handle swings clear round the blade and back, twice.
      anim: (s: WeaponState) => {
        const u = s.charge > 0.12 && s.charge < 0.88 ? (s.charge - 0.12) / 0.76 : 0;
        // Drawn, it comes out folded and is flicked open.
        halves[1].rotation.x = -Math.max(Math.abs(Math.sin(u * Math.PI * 2)), Math.min(1, s.spin * 1.6)) * Math.PI * 0.96;
        halves[0].rotation.x = Math.max(0, Math.sin(u * Math.PI * 4)) * 0.35 + s.fire * 0.05;
      },
    };
  },

  k_tomahawk(g: THREE.Group) {
    tz(g, 0.014, 0.36, 0, 0, -0.07, pbr(0x6b4226, 0, 0.6));
    for (let i = 0; i < 5; i++) ring(g, 0.0145, 0.003, 0, 0, -0.03 + i * 0.022, ACC());
    tz(g, 0.017, 0.016, 0, 0, 0.116, DET());
    edge(g, [[0.19, 0.03], [0.25, 0.03], [0.265, -0.02], [0.29, -0.125], [0.2, -0.135], [0.155, -0.11], [0.185, -0.03]], 0.014);
    edge(g, [[0.2, 0.025], [0.24, 0.025], [0.228, 0.1], [0.212, 0.1]], 0.012, STEEL());
    rb(g, 0.02, 0.05, 0.05, 0, 0, -0.22, DET(), 0.006);
    rb(g, 0.016, 0.014, 0.1, 0, -0.125, -0.235, ACC(), 0.003);
    return { muzzle: muzzleAt(g, -0.28, -0.06), anim: undefined };
  },

  k_katana(g: THREE.Group) {
    edge(g, [[0.05, 0.013], [0.3, 0.023], [0.5, 0.047], [0.645, 0.09], [0.66, 0.074], [0.52, 0.019], [0.3, -0.006], [0.05, -0.013]], 0.009);
    rb(g, 0.01, 0.005, 0.42, 0, 0.012, -0.27, BLACK(), 0.002).rotation.x = -0.06;
    tz(g, 0.04, 0.009, 0, 0, -0.046, DET(), 0.04, 14);
    tz(g, 0.022, 0.014, 0, 0, -0.036, ACC());
    tz(g, 0.016, 0.2, 0, 0, 0.068, BLACK());
    for (let i = 0; i < 7; i++) {
      const d = rb(g, 0.034, 0.016, 0.016, 0, 0, -0.02 + i * 0.028, ACC(), 0.003);
      d.rotation.z = Math.PI / 4;
    }
    tz(g, 0.019, 0.016, 0, 0, 0.176, DET());
    const glint = sph(g, 0.012, 0.006, 0.03, -0.1, pbr(0xffffff, 0, 0.2, 0xffffff, 0.9), 0.25, 1, 3);
    glint.userData.outline = true;
    return {
      muzzle: muzzleAt(g, -0.65, 0.07),
      // A point of light runs up the blade when it is drawn or looked at.
      anim: (s: WeaponState) => {
        const u = s.spin > 0 ? 1 - s.spin : s.charge > 0 ? (s.charge * 2.2) % 1 : 1 - s.fire;
        glint.position.z = -0.08 - u * 0.52;
        glint.position.y = 0.012 + u * u * 0.06;
        glint.visible = s.spin > 0 || s.charge > 0 || s.fire > 0.05;
      },
    };
  },

  k_ripper(g: THREE.Group) {
    rb(g, 0.06, 0.085, 0.13, 0, 0.012, -0.015, BODY(), 0.02);
    hilt(g, 0.11, 0.017, RUBBER(), 0.06);
    rb(g, 0.02, 0.03, 0.14, 0, 0.075, -0.02, BLACK(), 0.008);
    for (const z of [-0.075, 0.035]) rb(g, 0.02, 0.05, 0.02, 0, 0.055, z, BLACK(), 0.006);
    tz(g, 0.018, 0.05, 0.036, 0.03, 0.01, CHROME()).rotation.z = 0.5;
    for (let i = 0; i < 4; i++) rb(g, 0.004, 0.04, 0.006, -0.031, 0.02, -0.05 + i * 0.014, BLACK(), 0.002);
    edge(g, [[0.07, 0.03], [0.36, 0.03], [0.4, 0.0], [0.36, -0.03], [0.07, -0.03]], 0.012, BLACK());
    rb(g, 0.014, 0.012, 0.22, 0, 0, -0.2, ACC(), 0.004);
    const teeth: THREE.Mesh[] = [];
    for (let i = 0; i < 26; i++) teeth.push(add(g, geo("tooth", () => new THREE.ConeGeometry(0.0085, 0.02, 4)), CHROME(), 0, 0, 0));
    return {
      muzzle: muzzleAt(g, -0.4, 0),
      // The chain runs round the bar: slowly at rest, flat out through a cut or when it is shown off.
      anim: (s: WeaponState) => {
        const run = s.t * (0.25 + s.fire * 3 + (s.charge > 0.2 && s.charge < 0.8 ? 3 : 0));
        teeth.forEach((t, i) => {
          const a = ((i / teeth.length + run) % 1) * Math.PI * 2;
          t.position.set(0, Math.sin(a) * 0.04, -0.235 - Math.cos(a) * 0.172);
          t.rotation.x = -a + Math.PI / 2;
        });
      },
    };
  },

  k_saber(g: THREE.Group) {
    tz(g, 0.019, 0.15, 0, 0, 0.02, DET());
    for (let i = 0; i < 4; i++) ring(g, 0.02, 0.0035, 0, 0, -0.02 + i * 0.026, BLACK());
    tz(g, 0.026, 0.03, 0, 0, -0.06, BODY(), 0.02);
    tz(g, 0.022, 0.012, 0, 0, 0.1, ACC());
    rb(g, 0.01, 0.012, 0.03, 0.02, 0.012, 0.0, glowMat(PAL.a), 0.003);
    const beam = new THREE.Group();
    beam.position.z = -0.075;
    g.add(beam);
    const coreM = glowMat(0xffffff);
    coreM.emissiveIntensity = 2.2;
    tz(beam, 0.0085, 0.5, 0, 0, -0.25, coreM).userData.outline = true;
    const glowM = glowMat(PAL.a);
    glowM.emissiveIntensity = 1.8;
    tz(beam, 0.016, 0.51, 0, 0, -0.255, glowM).userData.outline = true;
    const halo = tz(beam, 0.03, 0.52, 0, 0, -0.26, pbr(PAL.a, 0, 0.1, PAL.a, 0.22));
    halo.userData.outline = true;
    sph(beam, 0.016, 0, 0, -0.51, glowM).userData.outline = true;
    return {
      muzzle: muzzleAt(g, -0.58, 0),
      // Looked over, the blade is switched off and lit again; otherwise it only flickers.
      anim: (s: WeaponState) => {
        const c = s.charge;
        // Drawn, it is dark until the thumb finds the switch.
        const lit = s.spin > 0 ? Math.max(0, 1 - s.spin * 2.2) : 1;
        const on = lit * (c <= 0 ? 1 : c < 0.3 ? 1 - c / 0.3 : c < 0.5 ? 0 : Math.min(1, (c - 0.5) / 0.18));
        beam.scale.set(1 + Math.sin(s.t * 47) * 0.04 + s.fire * 0.25, 1 + Math.sin(s.t * 53) * 0.04 + s.fire * 0.25, Math.max(0.001, on));
        beam.visible = on > 0.01;
        glowM.emissiveIntensity = 1.6 + Math.sin(s.t * 31) * 0.25 + s.fire * 2;
      },
    };
  },
});

/** Which way the supporting forearm runs from its wrist, in the hand's own space. */
export const LEFT_FOREARM = new THREE.Vector3(-0.55, -0.45, 0.7).normalize();

export interface Arms {
  group: THREE.Group;
  /** The hand that supports the weapon: it lets go to reload, to work the action, to show the weapon off. */
  left: THREE.Group | null;
  /** Where that hand rests on the weapon. */
  rest: THREE.Vector3;
  /** Where it holds the feed to take it out, and where the feed sits when it is in. */
  grab: THREE.Vector3;
  seat: THREE.Vector3;
  /** Something loose to load with, for weapons whose feed stays in: a shell in the palm. */
  item: THREE.Object3D | null;
  /** A blade, apart from the hand that holds it, so it can turn and fly while the hand stays where it is. */
  blade: THREE.Group | null;
  /** Opens the fingers round a blade: `open` 0..1 for the hand, `hook` 0..1 for the one finger (`hookAt`) that keeps hold. */
  grip: ((open: number, hook: number, hookAt: number) => void) | null;
}

/** First-person arms: gloved hands that close on the weapon, sleeves in the agent's colours. */
/** Where a handle lies in the closed hand, in the hand's own space: across the palm, in the crook of the fingers. */
export const GRIP_AT = new THREE.Vector3(0, 0.078, -0.04);
/** Where a ring sits on the forefinger when a blade is spun on it, and which way that finger points. */
export const RING_AT = new THREE.Vector3(-0.031, 0.123, -0.009);
export const RING_DIR = new THREE.Vector3(0, 0.955, -0.296).normalize();

export function buildArms(model: MarkerModel, sleeve: number, glove: number, team: number, melee: boolean, bend = 0.5): Arms {
  const arms = new THREE.Group();
  const gl = pbr(glove, 0, 0.55);
  const dark = pbr(new THREE.Color(glove).multiplyScalar(0.7).getHex(), 0, 0.6);
  const sl = pbr(sleeve, 0, 0.7);
  const band = pbr(team, 0.05, 0.45, team);
  const plate = pbr(0x2a2d36, 0.2, 0.5);
  const up = new THREE.Vector3(0, 1, 0);
  const forearm = (into: THREE.Object3D, wrist: THREE.Vector3, toward: THREE.Vector3) => {
    const dir = toward.clone().normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(up, dir);
    const part = (r1: number, r2: number, len: number, at: number, m: THREE.Material) => {
      const o = new THREE.Mesh(new THREE.CylinderGeometry(r2, r1, len, 18), m);
      o.position.copy(wrist).addScaledVector(dir, at + len / 2);
      o.quaternion.copy(q);
      into.add(o);
    };
    part(0.043, 0.047, 0.05, -0.012, dark);
    part(0.041, 0.056, 0.42, 0.03, sl);
    part(0.05, 0.052, 0.035, 0.085, band);
    part(0.048, 0.049, 0.012, 0.05, plate);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.043, 14, 10), gl);
    knob.position.copy(wrist);
    into.add(knob);
  };
  /** A fist around an upright grip at `c`; `side` 1 is a right hand, -1 a left. */
  const fist = (c: THREE.Vector3, side: number, toward: THREE.Vector3) => {
    const h = new THREE.Group();
    h.position.copy(c);
    arms.add(h);
    rb(h, 0.066, 0.1, 0.078, side * 0.003, 0, 0.004, gl, 0.026);
    for (let i = 0; i < 4; i++) {
      rb(h, 0.074, 0.02, 0.03, -side * 0.004, 0.036 - i * 0.0235, -0.034, gl, 0.0095);
      sph(h, 0.0125, -side * 0.038, 0.036 - i * 0.0235, -0.012, gl);
      sph(h, 0.011, side * 0.03, 0.036 - i * 0.0235, -0.042, dark);
    }
    const thumb = capsule(h, 0.0135, 0.045, -side * 0.037, 0.04, -0.004, gl);
    thumb.rotation.x = Math.PI / 2 - 0.25;
    // A hard plate over the knuckles and a strap at the wrist.
    rb(h, 0.012, 0.07, 0.05, side * 0.038, 0.004, -0.004, plate, 0.005);
    rb(h, 0.03, 0.03, 0.01, side * 0.028, 0.012, 0.044, dark, 0.006);
    forearm(arms, new THREE.Vector3(c.x + side * 0.012, c.y - 0.034, c.z + 0.058), toward);
  };
  let left: THREE.Group | null = null;
  let item: THREE.Object3D | null = null;
  const rest = new THREE.Vector3();
  const grab = new THREE.Vector3(0, -0.085, -0.1);
  const seat = new THREE.Vector3();
  if (model.grab) grab.fromArray(model.grab);
  if (model.mag) seat.copy(model.mag.position);
  let blade: THREE.Group | null = null;
  let grip: Arms["grip"] = null;
  if (melee) {
    // The blade gets a group of its own, so it can spin in the fingers and leave the hand.
    blade = new THREE.Group();
    while (model.group.children.length) blade.add(model.group.children[0]);
    model.group.add(blade);
    // A right hand, built the way a hand is: the wrist at the origin, the fingers along +Y, the
    // thumb on -X, the back of the hand facing +Z. It closes round a handle that lies across the
    // palm at GRIP_AT; whoever holds a blade puts the blade there, not the other way round.
    const h = arms;
    const limb = (into: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, r: number, m: THREE.Material) => {
      const d = b.clone().sub(a);
      const o = capsule(into, r, Math.max(0.001, d.length()), 0, 0, 0, m);
      o.position.copy(a).addScaledVector(d, 0.5);
      o.quaternion.setFromUnitVectors(up, d.normalize());
      return o;
    };
    const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    // The wrist, the palm, the heel of the hand and the pad under the fingers.
    rb(h, 0.064, 0.04, 0.042, 0, 0.004, -0.002, gl, 0.017);
    rb(h, 0.09, 0.076, 0.038, 0, 0.057, 0, gl, 0.017);
    rb(h, 0.036, 0.056, 0.03, 0.03, 0.036, -0.012, gl, 0.014);
    rb(h, 0.078, 0.024, 0.016, 0, 0.082, -0.014, dark, 0.007);
    // The back of the glove: a hard shell in two pieces, a team mark, a strap over the wrist with its buckle.
    rb(h, 0.064, 0.03, 0.011, 0.001, 0.066, 0.02, plate, 0.006);
    rb(h, 0.052, 0.024, 0.011, 0.001, 0.036, 0.021, plate, 0.006);
    rb(h, 0.026, 0.012, 0.005, 0.001, 0.036, 0.0275, band, 0.0024);
    rb(h, 0.074, 0.02, 0.05, 0, 0.006, -0.002, dark, 0.008);
    rb(h, 0.02, 0.024, 0.008, -0.012, 0.006, 0.024, plate, 0.003);
    for (const x of [-0.03, 0.03]) capsule(h, 0.004, 0.05, x, 0.052, 0.0195, dark);
    // What makes it a glove and not a mitten: a bar over the knuckles, vents and bolts in the shell,
    // a tab on the strap, stitching, and padding on the palm that shows when the hand opens.
    rb(h, 0.084, 0.013, 0.012, 0, 0.091, 0.013, plate, 0.006);
    for (const x of [-0.017, 0, 0.017]) rb(h, 0.011, 0.0045, 0.004, x + 0.001, 0.07, 0.0245, dark, 0.0018);
    for (const [x, y] of [[-0.026, 0.076], [0.028, 0.076], [-0.02, 0.027], [0.022, 0.027]]) sph(h, 0.0026, x, y, 0.0262, CHROME());
    rb(h, 0.02, 0.017, 0.006, 0.026, 0.006, 0.0235, band, 0.0025);
    for (let i = 0; i < 5; i++) rb(h, 0.0022, 0.005, 0.002, -0.03 + i * 0.006, 0.0165, 0.0235, plate, 0.001);
    rb(h, 0.072, 0.03, 0.007, 0, 0.056, -0.0185, dark, 0.003);
    rb(h, 0.03, 0.034, 0.007, 0.024, 0.026, -0.0245, dark, 0.003);
    for (const x of [-0.024, 0, 0.024]) rb(h, 0.002, 0.026, 0.002, x, 0.056, -0.0225, plate, 0.001);
    // Four fingers of three joints each. A knuckle guard sits on every first joint, a plate on the back of every first bone.
    const MCP = [[-0.031, 0.094], [-0.0105, 0.099], [0.0105, 0.096], [0.0305, 0.087]];
    const LEN = [[0.048, 0.03, 0.025], [0.052, 0.033, 0.026], [0.048, 0.031, 0.025], [0.038, 0.024, 0.022]];
    const fingers: THREE.Group[][] = [];
    MCP.forEach(([x, y], i) => {
      const r0 = i === 3 ? 0.0102 : 0.0114;
      const joints: THREE.Group[] = [];
      let parent: THREE.Object3D = h;
      let at = V(x, y, 0);
      LEN[i].forEach((len, n) => {
        const r = r0 - n * 0.0007;
        const g = new THREE.Group();
        g.position.copy(at);
        parent.add(g);
        sph(g, r + 0.0012, 0, 0, 0, gl);
        capsule(g, r, len - r * 0.6, 0, len / 2, 0, n === 2 ? dark : gl);
        if (n === 0) {
          sph(g, r + 0.0022, 0, -0.001, 0.0045, plate, 1, 0.9, 0.75);
          rb(g, r * 1.5, len * 0.5, 0.006, 0, len * 0.52, r * 0.82, plate, 0.0028);
        } else if (n === 1) rb(g, r * 1.3, len * 0.5, 0.005, 0, len * 0.5, r * 0.8, dark, 0.0022);
        else {
          sph(g, r * 0.92, 0, len - r * 0.5, -r * 0.3, gl, 1, 1, 0.8);
          rb(g, r * 1.25, len * 0.62, 0.004, 0, len * 0.58, -r * 0.84, plate, 0.002);
        }
        // A seam round the finger short of each joint.
        if (n < 2) ring(g, r + 0.0006, 0.0013, 0, len * 0.84, 0, dark).rotation.x = Math.PI / 2;
        joints.push(g);
        parent = g;
        at = V(0, len, 0);
      });
      fingers.push(joints);
    });
    // The thumb: the ball of it, then two bones that lie across the front of the closed fingers.
    const thumb = new THREE.Group();
    thumb.position.set(-0.034, 0.022, -0.012);
    h.add(thumb);
    sph(thumb, 0.0185, 0.002, 0.004, 0, gl, 1, 1.15, 0.95);
    limb(thumb, V(0, 0, 0), V(-0.017, 0.03, -0.022), 0.0158, gl);
    const t1 = new THREE.Group();
    t1.position.set(-0.017, 0.03, -0.022);
    thumb.add(t1);
    sph(t1, 0.0152, 0, 0, 0, gl);
    limb(t1, V(0, 0, 0), V(0.019, 0.01, -0.03), 0.013, gl);
    rb(t1, 0.014, 0.012, 0.02, 0.006, 0.014, -0.012, plate, 0.004).lookAt(V(0.019, 0.01, -0.03).multiplyScalar(4));
    const t2 = new THREE.Group();
    t2.position.set(0.019, 0.01, -0.03);
    t1.add(t2);
    sph(t2, 0.0136, 0, 0, 0, gl);
    limb(t2, V(0, 0, 0), V(0.024, 0.008, -0.007), 0.0118, dark);
    rb(t2, 0.016, 0.004, 0.012, 0.014, 0.014, -0.004, plate, 0.002).rotation.z = 0.32;
    // Closed, a finger wraps the handle; open, it is all but straight; hooked, it points — through a ring.
    const SHUT = [1.25, 1.1, 1.0];
    const OPEN = [0.3, 0.28, 0.18];
    const HOOK = [0.28, 0.16, 0.1];
    grip = (open, hook, hookAt) => {
      fingers.forEach((f, i) => {
        const to = i === hookAt ? HOOK : OPEN;
        const k = i === hookAt ? hook : open;
        // The little finger shuts a touch tighter, the forefinger a touch looser: a fist is not a block.
        const tight = i === 3 ? 0.12 : i === 0 ? -0.06 : 0;
        for (let n = 0; n < 3; n++) f[n].rotation.x = -(SHUT[n] + tight + (to[n] - SHUT[n] - tight) * k);
      });
      const o = Math.max(open, hook * 0.8);
      thumb.rotation.set(0.25 * o, 0, 0.55 * o);
      t1.rotation.set(0, -0.5 * o, 0.35 * o);
      t2.rotation.y = -0.3 * o;
    };
    grip(0, 0, -1);
    // The forearm leaves the wrist bent toward the little finger by `bend`: that is how a blade is pointed.
    const arm = new THREE.Group();
    arm.rotation.z = Math.PI + bend;
    h.add(arm);
    const tube = (r1: number, r2: number, len: number, at: number, m: THREE.Material, squash = 0.86) => {
      const o = new THREE.Mesh(new THREE.CylinderGeometry(r2, r1, len, 22), m);
      o.position.y = at + len / 2;
      o.scale.z = squash;
      arm.add(o);
    };
    tube(0.033, 0.036, 0.03, -0.006, dark);
    tube(0.035, 0.05, 0.46, 0.022, sl);
    tube(0.0385, 0.0405, 0.03, 0.05, band);
    tube(0.0365, 0.0375, 0.012, 0.03, plate);
    tube(0.0415, 0.043, 0.008, 0.092, dark);
    tube(0.0375, 0.039, 0.006, 0.105, dark);
    tube(0.045, 0.0465, 0.006, 0.2, dark);
    // A patch on the sleeve and a pull-tab on the cuff.
    rb(arm, 0.03, 0.05, 0.006, 0, 0.155, 0.0355, plate, 0.003);
    rb(arm, 0.022, 0.012, 0.004, 0, 0.165, 0.039, band, 0.002);
    rb(arm, 0.022, 0.004, 0.004, 0, 0.145, 0.039, CHROME(), 0.0015);
    rb(arm, 0.012, 0.022, 0.005, 0.03, 0.03, 0.02, band, 0.002);
  } else {
    fist(new THREE.Vector3(0.002, -0.064, 0.012), 1, new THREE.Vector3(0.2, -0.52, 0.83));
    if (model.muzzle2) fist(new THREE.Vector3(-0.298, -0.064, 0.012), -1, new THREE.Vector3(-0.2, -0.52, 0.83));
    else {
      // The other hand cradles the weapon from below, fingers up its near side.
      const l = model.left ?? [0, -0.02, -0.2];
      const h = (left = new THREE.Group());
      rest.set(l[0], l[1] - 0.03, l[2]);
      h.position.copy(rest);
      arms.add(h);
      rb(h, 0.074, 0.05, 0.105, 0, 0, 0, gl, 0.022);
      for (let i = 0; i < 4; i++) {
        rb(h, 0.021, 0.062, 0.022, -0.04, 0.022, -0.038 + i * 0.0245, gl, 0.009);
        sph(h, 0.012, -0.036, 0.055, -0.038 + i * 0.0245, gl);
      }
      capsule(h, 0.013, 0.04, 0.04, 0.02, -0.01, gl).rotation.x = Math.PI / 2;
      rb(h, 0.06, 0.012, 0.07, 0, -0.028, 0, plate, 0.005);
      forearm(h, new THREE.Vector3(-0.018, -0.03, 0.052), LEFT_FOREARM);
      if (!model.mag) {
        // A shell lying in the palm, ready to be thumbed in.
        const m = (item = new THREE.Group());
        m.position.set(0.002, 0.046, -0.004);
        h.add(m);
        tz(m, 0.017, 0.062, 0, 0, 0, pbr(PAL.a, 0, 0.3, PAL.a, 1));
        tz(m, 0.0185, 0.014, 0, 0, 0.031, pbr(0xe8c35a, 0.6, 0.3));
        m.visible = false;
      }
    }
  }
  arms.traverse((o) => {
    o.castShadow = false;
    o.receiveShadow = false;
  });
  outline(arms, 0.0055);
  model.group.add(arms);
  return { group: arms, left, rest, grab, seat, item, blade, grip };
}

/**
 * What a rare skin adds beyond its paint job: a charm that swings from the body, strips of light
 * down the sides, sparks drifting off the barrel and, on the rarest, things in orbit around it.
 */
function finish(g: THREE.Group, muzzle: THREE.Object3D, p: Pattern): Anim | undefined {
  if (p.rarity < 2) return undefined;
  const run: Anim[] = [];
  const box = new THREE.Box3().setFromObject(g);
  const hw = Math.min(0.05, Math.max(0.024, Math.min(box.max.x, 0.05)));
  const my = muzzle.position.y;
  const mz = muzzle.position.z;
  const bit = (m: THREE.Mesh) => {
    m.userData.outline = true;
    return m;
  };
  const charm = new THREE.Group();
  charm.position.set(-hw - 0.006, 0.03, 0.03);
  g.add(charm);
  ty(charm, 0.0025, 0.05, 0, -0.025, 0, CHROME(), 0.0025, 6);
  sph(charm, 0.007, 0, 0, 0, CHROME());
  if (p.rarity >= 4) {
    const gem = add(charm, geo("gem", () => new THREE.OctahedronGeometry(0.018)), glowMat(p.a), 0, -0.068, 0);
    gem.scale.y = 1.4;
  } else {
    sph(charm, 0.014, 0, -0.06, 0, pbr(p.a, 0.05, 0.3));
    ty(charm, 0.012, 0.03, 0, -0.085, 0, pbr(p.c, 0.05, 0.3), 0.002, 6).rotation.x = Math.PI;
  }
  run.push((s) => {
    charm.rotation.x = Math.sin(s.t * 2.3) * 0.2 + s.fire * 0.7;
    charm.rotation.z = -0.12 + Math.sin(s.t * 1.7) * 0.12;
  });
  if (p.rarity >= 3) {
    const m = glowMat(p.c);
    const len = Math.min(0.2, Math.abs(mz) * 0.4);
    for (const sx of [-1, 1]) bit(rb(g, 0.004, 0.007, len, sx * (hw - 0.02), 0.03, -0.05 - len / 2, m, 0.002)).position.x = sx * (hw * 0.5 + 0.002);
    run.push((s) => (m.emissiveIntensity = 0.8 + Math.sin(s.t * 4) * 0.4 + s.fire * 2.5));
  }
  if (p.rarity >= 4) {
    const motes = [0, 1, 2, 3, 4, 5].map(() => bit(sph(g, 0.006, 0, 0, 0, glowMat(p.glow ? p.c : 0xfff3c2))));
    run.push((s) =>
      motes.forEach((m, i) => {
        const u = (s.t * 0.5 + i / 6) % 1;
        m.position.set(Math.sin(i * 5.1 + s.t) * 0.03, my + 0.03 + u * 0.12, mz * (0.3 + ((i * 0.37) % 1) * 0.6));
        m.scale.setScalar((1 - u) * (1 + s.fire));
      }),
    );
  }
  if (p.rarity >= 5) {
    const orbit = new THREE.Group();
    orbit.position.set(0, my, mz * 0.62);
    g.add(orbit);
    bit(ring(orbit, 0.085, 0.0025, 0, 0, 0, glowMat(p.a)));
    const moons = [0, 1, 2].map((i) => bit(sph(orbit, 0.011 + i * 0.003, Math.cos(i * 2.1) * 0.085, Math.sin(i * 2.1) * 0.085, 0, glowMat(i === 1 ? p.c : p.a))));
    void moons;
    run.push((s) => {
      orbit.rotation.z = s.t * (1.5 + s.spin * 4 + s.charge * 4) + s.fire * 1.5;
      orbit.rotation.x = Math.sin(s.t * 0.9) * 0.25;
    });
  }
  return all(...run);
}

/** Builds a weapon in a skin (an index into PATTERNS). `edge` is the outline thickness; 0 = none. */
export function buildMarker(id: string, skin: number, edge = 0.0035): MarkerModel {
  PAL = PATTERNS[skin] ?? PATTERNS[0];
  const group = new THREE.Group();
  const parts = (BUILD[id] ?? BUILD.sprinter)(group);
  const extra = finish(group, parts.muzzle, PAL);
  if (edge > 0) outline(group, edge);
  const anim = parts.anim || extra ? all(parts.anim, extra) : undefined;
  anim?.({ t: 0, fire: 0, shots: 0, charge: 0, spin: 0, ammo: 1 });
  return { group, ...parts, anim };
}

// ---------------------------------------------------------------------------------------------
// Baking

/**
 * Collapses everything under `group` into one mesh per material, in the group's own space.
 * A model of sixty parts becomes five draw calls. Objects listed in `keep` (muzzles, mounts)
 * survive as direct children with their world position intact.
 */
export function bake(group: THREE.Object3D, keep: THREE.Object3D[] = []): void {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const buckets = new Map<string, { material: THREE.Material; parts: THREE.BufferGeometry[]; shadow: boolean }>();
  const m4 = new THREE.Matrix4();
  group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    let hidden = false;
    for (let p: THREE.Object3D | null = mesh; p && p !== group; p = p.parent) if (keep.includes(p)) hidden = true;
    if (hidden) return;
    const material = mesh.material as THREE.Material;
    const src = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", src.attributes.position);
    g.setAttribute("normal", src.attributes.normal);
    g.setAttribute("uv", src.attributes.uv ?? new THREE.BufferAttribute(new Float32Array(src.attributes.position.count * 2), 2));
    g.applyMatrix4(m4.multiplyMatrices(inv, mesh.matrixWorld));
    let b = buckets.get(material.uuid);
    if (!b) buckets.set(material.uuid, (b = { material, parts: [], shadow: !mesh.userData.outline && !material.transparent }));
    b.parts.push(g);
  });
  for (const k of keep) group.attach(k);
  for (const c of [...group.children]) if (!keep.includes(c)) group.remove(c);
  for (const b of buckets.values()) {
    const mesh = new THREE.Mesh(mergeGeometries(b.parts, false), b.material);
    mesh.castShadow = b.shadow;
    mesh.receiveShadow = b.shadow;
    group.add(mesh);
  }
}

const PAINTED = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.04 });

/**
 * Like `bake`, but plain coloured parts all go into a single mesh that carries its colours per
 * vertex. A character part of thirty pieces in eight colours becomes two draw calls: the part
 * and its outline. Textured, glowing, metal and see-through pieces keep their own material.
 */
export function bakeColored(group: THREE.Object3D, keep: THREE.Object3D[] = []): void {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const buckets = new Map<string, { material: THREE.Material; parts: THREE.BufferGeometry[]; shadow: boolean }>();
  const m4 = new THREE.Matrix4();
  group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (let p: THREE.Object3D | null = mesh; p && p !== group; p = p.parent) if (keep.includes(p)) return;
    const material = mesh.material as THREE.MeshStandardMaterial;
    const src = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", src.attributes.position);
    g.setAttribute("normal", src.attributes.normal);
    g.setAttribute("uv", src.attributes.uv ?? new THREE.BufferAttribute(new Float32Array(src.attributes.position.count * 2), 2));
    g.applyMatrix4(m4.multiplyMatrices(inv, mesh.matrixWorld));
    const plain = material.isMeshStandardMaterial && !mesh.userData.outline && !material.map && !material.transparent && material.emissiveIntensity === 0 && material.metalness < 0.5;
    let key = material.uuid;
    let use: THREE.Material = material;
    if (plain) {
      const n = g.attributes.position.count;
      const colors = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) colors.set([material.color.r, material.color.g, material.color.b], i * 3);
      g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      key = "painted";
      use = PAINTED;
    }
    let b = buckets.get(key);
    if (!b) buckets.set(key, (b = { material: use, parts: [], shadow: !mesh.userData.outline && !material.transparent }));
    b.parts.push(g);
  });
  for (const k of keep) group.attach(k);
  for (const c of [...group.children]) if (!keep.includes(c)) group.remove(c);
  for (const b of buckets.values()) {
    const mesh = new THREE.Mesh(mergeGeometries(b.parts, false), b.material);
    mesh.castShadow = b.shadow;
    mesh.receiveShadow = b.shadow;
    if (!b.shadow) mesh.userData.outline = true;
    group.add(mesh);
  }
}
