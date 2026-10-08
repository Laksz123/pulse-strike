/**
 * The island. Five biomes around a jungle heart: beaches on the coast, a swamp in the east,
 * rocky highlands in the north and salt flats with a ship graveyard in the west. Five monuments
 * hold the armed NPCs and the best loot; everywhere else there are only animals.
 * Terrain, colours, the layout of everything and the map data all come from the functions here.
 */

import * as THREE from "three";
import { box, cyl, mat, tbox, tmat } from "./build";
import type { ContainerKind } from "./loot";
import { fbm, mulberry32, pick, range, smoothstep, type Rng } from "./noise";
import { tex } from "./textures";

export const WORLD_SIZE = 1500;
/** Nothing lives beyond this distance from the centre on either axis. */
export const LIMIT = 700;
const SEGMENTS = 230;

export type MonumentId = "sawmill" | "village" | "temple" | "mine" | "graveyard";

export interface Monument {
  id: MonumentId;
  name: string;
  x: number;
  z: number;
  /** Radius of the built-up area; armed NPCs live inside it. */
  r: number;
  tier: 1 | 2 | 3;
  /** Height of the flattened ground. */
  pad: number;
  /** Facing of the buildings. */
  yaw: number;
}

function islandR(a: number): number {
  return 545 + (fbm(Math.cos(a) * 1.3 + 3.1, Math.sin(a) * 1.3 + 7.7, 3) - 0.5) * 150;
}

/** Distance to the shoreline: positive on land, negative out at sea. */
export function coastAt(x: number, z: number): number {
  return islandR(Math.atan2(z, x)) - Math.hypot(x, z);
}

export interface Biome {
  jungle: number;
  beach: number;
  swamp: number;
  high: number;
  salt: number;
  coast: number;
}
export type BiomeId = "jungle" | "beach" | "swamp" | "high" | "salt" | "sea";

export function biomeAt(x: number, z: number, out: Biome): Biome {
  const n = (fbm(x * 0.004 + 20, z * 0.004 + 40, 2) - 0.5) * 160;
  const high = smoothstep(150, 290, -z + n);
  const rest = 1 - high;
  out.high = high;
  out.salt = smoothstep(210, 330, -x - n * 0.6) * rest;
  out.swamp = smoothstep(200, 320, x + n * 0.6) * rest;
  out.jungle = Math.max(0, 1 - high - out.salt - out.swamp);
  out.coast = coastAt(x, z);
  out.beach = 1 - smoothstep(10, 44, out.coast);
  return out;
}

const scratch: Biome = { jungle: 0, beach: 0, swamp: 0, high: 0, salt: 0, coast: 0 };

/** The biome that dominates a point. */
export function biomeId(x: number, z: number): BiomeId {
  const b = biomeAt(x, z, scratch);
  if (b.coast < 0) return "sea";
  if (b.beach > 0.5) return "beach";
  if (b.high > 0.5) return "high";
  if (b.salt > 0.5) return "salt";
  if (b.swamp > 0.5) return "swamp";
  return "jungle";
}

function rawHeight(x: number, z: number): number {
  const b = biomeAt(x, z, scratch);
  const hj = 3 + fbm(x * 0.008 + 11, z * 0.008 + 7) * 11 + fbm(x * 0.045 + 50, z * 0.045 + 90, 2) * 1.4;
  const ridge = 1 - Math.abs(2 * fbm(x * 0.0055 + 5, z * 0.0055 + 60, 4) - 1);
  const hh = 9 + ridge * ridge * 44 + fbm(x * 0.03 + 9, z * 0.03 + 2, 2) * 3;
  const pond = smoothstep(0.56, 0.68, fbm(x * 0.016 + 5, z * 0.016 + 50, 2));
  const hs = 0.7 + fbm(x * 0.03 + 70, z * 0.03 + 30, 2) * 1.2 - pond * 1.7;
  const hsalt = 1.8 + fbm(x * 0.012 + 33, z * 0.012 + 91, 2) * 1.8;
  let h = hj * b.jungle + hh * b.high + hs * b.swamp + hsalt * b.salt;
  if (b.coast < 46) {
    // The shore: a gentle beach above the waterline, a shelf dropping away below it.
    const shore = b.coast > 0 ? 0.25 + b.coast * 0.03 : Math.max(-7, b.coast * 0.13);
    h = shore + (h - shore) * smoothstep(8, 46, b.coast);
  }
  return h;
}

function monument(id: MonumentId, name: string, x: number, z: number, r: number, tier: 1 | 2 | 3, yaw: number, pad?: number): Monument {
  return { id, name, x, z, r, tier, yaw, pad: pad ?? Math.max(1.4, rawHeight(x, z)) };
}

// The fishing village sits on the south shore and looks out to sea.
const VILLAGE_A = 1.75;
const villageR = islandR(VILLAGE_A) - 34;

export const MONUMENTS: Monument[] = [
  monument("sawmill", "Лесопилка", 95, 165, 36, 1, 0.4),
  monument("village", "Рыбацкая деревня", Math.cos(VILLAGE_A) * villageR, Math.sin(VILLAGE_A) * villageR, 40, 1, Math.atan2(Math.cos(VILLAGE_A), Math.sin(VILLAGE_A)), 1.25),
  monument("temple", "Затонувший храм", -70, -30, 34, 2, 0),
  monument("mine", "Шахта", 60, -330, 38, 2, 0.2),
  monument("graveyard", "Кладбище кораблей", -400, 70, 95, 3, 0),
];

export function heightAt(x: number, z: number): number {
  let h = rawHeight(x, z);
  for (const m of MONUMENTS) {
    const d = Math.hypot(x - m.x, z - m.z);
    if (d < m.r + 34) h += (m.pad - h) * (1 - smoothstep(m.r, m.r + 34, d));
  }
  return h;
}

/** The monument a point belongs to, with the distance to its edge (negative inside). */
export function nearestMonument(x: number, z: number): { m: Monument; edge: number } {
  let best = MONUMENTS[0];
  let edge = Infinity;
  for (const m of MONUMENTS) {
    const e = Math.hypot(x - m.x, z - m.z) - m.r;
    if (e < edge) {
      edge = e;
      best = m;
    }
  }
  return { m: best, edge };
}

const C = {
  jungleA: new THREE.Color(0x3d7a34), jungleB: new THREE.Color(0x5c9a42), beach: new THREE.Color(0xe8d69e),
  swampA: new THREE.Color(0x55633a), swampB: new THREE.Color(0x3f4c30), mud: new THREE.Color(0x5e5238),
  grass: new THREE.Color(0x6f8f4c), rock: new THREE.Color(0x8f897d), peak: new THREE.Color(0xb8b2a6),
  saltA: new THREE.Color(0xd4ae72), saltB: new THREE.Color(0xf0eadb), seabed: new THREE.Color(0xa99a6c), dirt: new THREE.Color(0x9a8060),
};
const tmpA = new THREE.Color();
const colorBiome: Biome = { jungle: 0, beach: 0, swamp: 0, high: 0, salt: 0, coast: 0 };

/** Ground colour at a point. The 3D terrain and both maps use the same function. */
export function groundColor(x: number, y: number, z: number, out: THREE.Color): THREE.Color {
  const b = biomeAt(x, z, colorBiome);
  const n = fbm(x * 0.03 + 4, z * 0.03 + 9, 2);
  out.setRGB(0, 0, 0);
  const add = (c: THREE.Color, w: number) => {
    out.r += c.r * w;
    out.g += c.g * w;
    out.b += c.b * w;
  };
  add(tmpA.copy(C.jungleA).lerp(C.jungleB, n), b.jungle);
  add(tmpA.copy(C.swampA).lerp(C.swampB, n).lerp(C.mud, 1 - smoothstep(0, 0.5, y)), b.swamp);
  add(tmpA.copy(C.grass).lerp(C.rock, smoothstep(14, 26, y + n * 6)).lerp(C.peak, smoothstep(38, 50, y)), b.high);
  add(tmpA.copy(C.saltA).lerp(C.saltB, smoothstep(0.35, 0.65, n)), b.salt);
  out.lerp(C.beach, b.beach);
  if (y < 0) out.lerp(C.seabed, smoothstep(0, -1.5, y));
  for (const m of MONUMENTS) {
    if (m.id === "graveyard") continue;
    const d = Math.hypot(x - m.x, z - m.z);
    // Trodden earth under the buildings; the fishing village stands on sand.
    if (d < m.r + 10) out.lerp(m.id === "village" ? C.beach : C.dirt, (1 - smoothstep(m.r - 12, m.r + 10, d)) * (m.id === "village" ? 1 : 0.8));
  }
  return out;
}

export interface TerrainData {
  mesh: THREE.Mesh;
  vertices: Float32Array;
  indices: Uint32Array;
}

export function buildTerrain(): TerrainData {
  const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, SEGMENTS, SEGMENTS);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));

  const vertices = new Float32Array(pos.array);
  const indices = new Uint32Array(geo.index!.array);

  // Faceted look: every triangle gets its own three vertices and one flat colour.
  const flat = geo.toNonIndexed();
  const p = flat.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(p.count * 3);
  const uv = new Float32Array(p.count * 2);
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i += 3) {
    const x = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3;
    const y = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3;
    const z = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
    groundColor(x, y, z, c);
    const shade = 0.92 + fbm(x * 0.4, z * 0.4, 1) * 0.16;
    for (let k = 0; k < 3; k++) {
      colors[(i + k) * 3] = c.r * shade;
      colors[(i + k) * 3 + 1] = c.g * shade;
      colors[(i + k) * 3 + 2] = c.b * shade;
      uv[(i + k) * 2] = p.getX(i + k) / 2.5;
      uv[(i + k) * 2 + 1] = p.getZ(i + k) / 2.5;
    }
  }
  flat.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  flat.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  flat.computeVertexNormals();
  const mesh = new THREE.Mesh(flat, new THREE.MeshLambertMaterial({ vertexColors: true, map: tex("sand") }));
  mesh.receiveShadow = true;
  geo.dispose();
  return { mesh, vertices, indices };
}

export const FOG_COLOR = 0xc6dde6;

/** The sea around the island and the ponds of the swamp: one sheet of water at height zero. */
export function buildWater(): THREE.Mesh {
  const t = tex("noise").clone();
  t.repeat.set(700, 700);
  t.needsUpdate = true;
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(6000, 6000),
    new THREE.MeshLambertMaterial({ color: 0x3aa0c8, map: t, transparent: true, opacity: 0.82 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.receiveShadow = true;
  return water;
}

export function buildSky(): THREE.Group {
  const g = new THREE.Group();
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(1300, 24, 12),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: { top: { value: new THREE.Color(0x3f8fd0) }, horizon: { value: new THREE.Color(FOG_COLOR) } },
      vertexShader: "varying float h; void main(){ h = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader:
        "uniform vec3 top; uniform vec3 horizon; varying float h; void main(){ float t = pow(clamp(h, 0.0, 1.0), 0.5); gl_FragColor = vec4(mix(horizon, top, t), 1.0); }",
    }),
  );
  sky.renderOrder = -2;
  g.add(sky);
  // A square pixel sun.
  const sun = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.MeshBasicMaterial({ color: 0xfff3c8, fog: false, depthWrite: false }));
  sun.position.set(90, 130, 55).normalize().multiplyScalar(1150);
  sun.lookAt(0, 0, 0);
  sun.renderOrder = -1;
  g.add(sun);
  return g;
}

/** Blocky clouds drifting high above the island. */
export function buildClouds(rng: Rng): THREE.Group {
  const g = new THREE.Group();
  const m = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, transparent: true, opacity: 0.88 });
  const geo = new THREE.BoxGeometry(1, 1, 1);
  for (let i = 0; i < 30; i++) {
    const cx = range(rng, -1000, 1000);
    const cz = range(rng, -1000, 1000);
    const y = range(rng, 190, 260);
    for (let k = 0; k < 3 + Math.floor(rng() * 3); k++) {
      const part = new THREE.Mesh(geo, m);
      part.scale.set(range(rng, 40, 90), range(rng, 8, 14), range(rng, 30, 60));
      part.position.set(cx + range(rng, -40, 40), y + range(rng, -4, 4), cz + range(rng, -26, 26));
      g.add(part);
    }
  }
  return g;
}

// ---------------------------------------------------------------------------------------------
// Props

const RUST_TINTS = [0xffffff, 0xe8d8c8, 0xd9c2b0, 0xf2e2c8, 0xc8b8a8];

/** A wrecked ship lying on the seabed. The hold is open through a breach in the starboard side. */
export function buildShip(rng: Rng, length: number): THREE.Group {
  const g = new THREE.Group();
  const W = 8;
  const H = 5;
  const L = length;
  const tint = pick(rng, RUST_TINTS);
  const D = 0.5;

  tbox(g, W, 0.4, L, 0, 0.2, 0, "hull", true, 0xffffff, D);
  tbox(g, 0.4, H, L, -W / 2, H / 2, 0, "rust", true, tint, D);
  // Starboard side with a 5 m breach amidships.
  const seg = L / 2 - 2.5;
  tbox(g, 0.4, H, seg, W / 2, H / 2, -(seg / 2 + 2.5), "rust", true, tint, D);
  tbox(g, 0.4, H, seg, W / 2, H / 2, seg / 2 + 2.5, "rust", true, tint, D);
  const torn = tbox(g, 0.3, 1.6, 2.2, W / 2 + 0.5, 0.5, 1.6, "rust", false, tint, D);
  torn.rotation.set(0.2, 0.3, 1.1);
  tbox(g, W, H, 0.4, 0, H / 2, L / 2, "rust", true, tint, D);
  // Bow: two plates meeting at the stem.
  const b1 = tbox(g, 0.4, H, 7, -W / 4, H / 2, -L / 2 - 2.8, "rust", true, tint, D);
  b1.rotation.y = -0.62;
  const b2 = tbox(g, 0.4, H, 7, W / 4, H / 2, -L / 2 - 2.8, "rust", true, tint, D);
  b2.rotation.y = 0.62;
  // Waterline stripe and portholes.
  box(g, 0.06, 0.5, L - 1, -(W / 2 + 0.21), 1.5, 0, 0x3a2a24);
  for (const sz of [-1, 1]) box(g, 0.06, 0.5, seg - 0.5, W / 2 + 0.21, 1.5, sz * (seg / 2 + 2.5), 0x3a2a24);
  for (const sx of [-1, 1]) {
    for (let z = -L / 2 + 4; z < L / 2 - 2; z += 4.5) {
      if (sx === 1 && Math.abs(z) < 4) continue;
      box(g, 0.08, 0.5, 0.5, sx * (W / 2 + 0.22), 3.6, z, 0x1d1f22);
    }
  }
  // The aft deck survives; the fore deck has collapsed into the hold.
  const deckLen = L * 0.45;
  const deckZ = L * 0.25;
  tbox(g, W, 0.3, deckLen, 0, H, deckZ, "planks", true, 0xb8a892, 0.5);
  // Ramp from the hold up to the deck.
  const ramp = tbox(g, 2.2, 0.25, 12, -W / 2 + 1.5, H / 2, deckZ - deckLen / 2 - 5.4, "planks", true, 0x9a8a78, 0.5);
  ramp.rotation.x = -0.43;
  // Wheelhouse with a doorway facing the bow.
  const cz = deckZ + deckLen * 0.18;
  const WH = 0xe6dfcd;
  tbox(g, 0.3, 2.8, 5, -2.5, H + 1.55, cz, "noise", true, WH, 0.5);
  tbox(g, 0.3, 2.8, 5, 2.5, H + 1.55, cz, "noise", true, WH, 0.5);
  tbox(g, 5.3, 2.8, 0.3, 0, H + 1.55, cz + 2.5, "noise", true, WH, 0.5);
  tbox(g, 1.8, 2.8, 0.3, -1.75, H + 1.55, cz - 2.5, "noise", true, WH, 0.5);
  tbox(g, 1.8, 2.8, 0.3, 1.75, H + 1.55, cz - 2.5, "noise", true, WH, 0.5);
  tbox(g, 5.6, 0.25, 5.4, 0, H + 3.05, cz, "rust", true, tint, D);
  for (const sx of [-1, 1]) {
    box(g, 0.08, 0.8, 1.2, sx * 2.68, H + 2.0, cz - 0.9, 0x23323a);
    box(g, 0.08, 0.8, 1.2, sx * 2.68, H + 2.0, cz + 0.9, 0x23323a);
  }
  box(g, 5.4, 0.3, 0.1, 0, H + 0.5, cz + 2.68, 0xb3362a);
  // Funnel, mast and railings.
  cyl(g, 0.7, 3, 0, H + 4.6, cz + 1.2, tmat("rust", 0xd8c8b8));
  cyl(g, 0.74, 0.5, 0, H + 5.4, cz + 1.2, 0xb3362a);
  cyl(g, 0.12, 7, 0, H + 6.5, cz - 1.6, 0x3a2a24);
  box(g, 3, 0.14, 0.14, 0, H + 8.6, cz - 1.6, 0x3a2a24);
  for (const sx of [-1, 1]) {
    box(g, 0.08, 0.08, deckLen, sx * (W / 2 - 0.1), H + 1.1, deckZ, 0x3a2a24);
    for (let z = deckZ - deckLen / 2; z <= deckZ + deckLen / 2 + 0.1; z += deckLen / 6) box(g, 0.08, 1.1, 0.08, sx * (W / 2 - 0.1), H + 0.55, z, 0x3a2a24);
  }
  for (let i = 0; i < 4; i++) box(g, W, 0.25, 0.25, 0, H - 0.2, -L / 2 + 3 + i * 3.4, 0x4a342a);
  for (let i = 0; i < 5; i++) {
    const r = tbox(g, range(rng, 0.5, 1.4), range(rng, 0.3, 0.7), range(rng, 0.5, 1.2), range(rng, -3, 3), 0.6, range(rng, -L / 2 + 2, 0), "rust", false, tint, 1);
    r.rotation.set(range(rng, -0.4, 0.4), rng() * 3, range(rng, -0.4, 0.4));
  }
  g.userData.tilt = range(rng, -0.1, 0.1);
  g.userData.length = L;
  return g;
}

export type BoulderKind = "rock" | "ore" | "crystal";

/** A harvestable boulder: plain stone, iron ore or a vein of crystals. */
export function buildBoulder(rng: Rng, kind: BoulderKind): THREE.Group {
  const g = new THREE.Group();
  const s = kind === "crystal" ? range(rng, 0.7, 0.9) : range(rng, 0.9, 1.3);
  const texture = kind === "ore" ? "ore" : "stone";
  const tint = kind === "crystal" ? 0xdfe8ea : pick(rng, [0xffffff, 0xe8e0d4, 0xd8d0c4]);
  const lumps = kind === "crystal" ? 2 : 3 + Math.floor(rng() * 2);
  for (let i = 0; i < lumps; i++) {
    const w = s * range(rng, 0.7, 1.2) * (i === 0 ? 1.2 : 0.8);
    const hh = s * range(rng, 0.55, 0.95) * (i === 0 ? 1.1 : 0.75);
    const d = s * range(rng, 0.7, 1.2) * (i === 0 ? 1.2 : 0.8);
    const m = tbox(g, w, hh, d, i === 0 ? 0 : range(rng, -0.6, 0.6) * s, hh / 2 - 0.05, i === 0 ? 0 : range(rng, -0.6, 0.6) * s, texture, true, tint, 2);
    m.rotation.set(range(rng, -0.12, 0.12), rng() * Math.PI, range(rng, -0.12, 0.12));
  }
  if (kind === "ore") {
    for (let i = 0; i < 7; i++) {
      const a = rng() * Math.PI * 2;
      const o = box(g, 0.18, 0.18, 0.18, Math.cos(a) * s * 0.55, range(rng, 0.2, s * 0.9), Math.sin(a) * s * 0.55, pick(rng, [0xd6783a, 0xe89a4c, 0xb85c28]));
      o.rotation.set(rng(), rng(), rng());
    }
  }
  if (kind === "crystal") {
    const glow = mat(0x8fe9ff, 0x2f93b4);
    const pale = mat(0xcaf6ff, 0x4fb4d4);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + rng();
      const r = i === 0 ? 0 : range(rng, 0.2, 0.55);
      const hh = i === 0 ? range(rng, 1.3, 1.8) : range(rng, 0.5, 1.1);
      const w = i === 0 ? 0.36 : range(rng, 0.16, 0.28);
      const m = box(g, w, hh, w, Math.cos(a) * r, hh / 2 + 0.25, Math.sin(a) * r, 0xffffff, i === 0);
      m.material = i % 2 ? pale : glow;
      m.rotation.set(Math.sin(a) * r * 0.9, rng() * 2, -Math.cos(a) * r * 0.9);
    }
  }
  g.userData.radius = s;
  return g;
}

/** A fibre plant: picked by hand for cloth. */
export function buildFiber(rng: Rng): THREE.Group {
  const g = new THREE.Group();
  const stalks = 5 + Math.floor(rng() * 4);
  for (let i = 0; i < stalks; i++) {
    const a = rng() * Math.PI * 2;
    const r = range(rng, 0.05, 0.35);
    const h = range(rng, 0.7, 1.3);
    const sx = Math.cos(a) * r;
    const sz = Math.sin(a) * r;
    const stalk = box(g, 0.06, h, 0.06, sx, h / 2, sz, 0x4f7a34);
    stalk.rotation.set(sz * 0.6, 0, -sx * 0.6);
    box(g, 0.3, 0.07, 0.16, sx * 1.3, h * 0.55, sz * 1.3, 0x6a9a40).rotation.y = a;
    box(g, 0.26, 0.07, 0.14, sx * 1.5, h * 0.8, sz * 1.5, 0x82b04c).rotation.y = a + 1;
    box(g, 0.14, 0.14, 0.14, sx * 1.6, h + 0.03, sz * 1.6, pick(rng, [0xf2c9d8, 0xffffff, 0xf0d040]));
  }
  return g;
}

export function buildScrapPile(rng: Rng): THREE.Group {
  const g = new THREE.Group();
  const slab = tbox(g, 1.5, 0.5, 1.3, 0, 0.25, 0, "rust", true, 0xd8c8b8, 1);
  slab.rotation.y = rng() * 3;
  for (let i = 0; i < 6; i++) {
    const m = tbox(g, range(rng, 0.4, 1.2), range(rng, 0.08, 0.3), range(rng, 0.4, 1), range(rng, -0.6, 0.6), range(rng, 0.4, 0.8), range(rng, -0.6, 0.6), "rust", false, pick(rng, RUST_TINTS), 1);
    m.rotation.set(range(rng, -0.5, 0.5), rng() * 3, range(rng, -0.5, 0.5));
  }
  const pipe = cyl(g, 0.09, 1.5, 0.3, 0.7, 0.2, 0x4a4f55);
  pipe.rotation.set(1.3, rng() * 3, 0.2);
  const gear = cyl(g, 0.3, 0.1, -0.4, 0.62, -0.3, 0x2e2e2e);
  gear.rotation.x = 1.2;
  box(g, 0.5, 0.06, 0.06, 0.5, 0.75, -0.4, 0xb3362a).rotation.y = rng() * 3;
  g.userData.radius = 0.9;
  return g;
}

export function buildContainer(rng: Rng, kind: ContainerKind, relic = false): THREE.Group {
  const g = new THREE.Group();
  if (kind === "barrel") {
    const color = pick(rng, [0x3f8fb5, 0xc04a3a, 0x5d9a55, 0xb9763c]);
    cyl(g, 0.42, 1.1, 0, 0.55, 0, tmat("barrel", color), true);
    cyl(g, 0.4, 0.06, 0, 1.12, 0, 0x3a3a3a).name = "lid";
  } else if (kind === "chest") {
    tbox(g, 1.2, 0.6, 0.7, 0, 0.3, 0, "woodcrate", true, 0xffffff, 1);
    const lid = tbox(g, 1.26, 0.22, 0.76, 0, 0.7, 0, "planks", false, 0xffffff, 1);
    lid.name = "lid";
    box(g, 0.16, 0.22, 0.06, 0, 0.5, 0.37, 0xd9b44a);
    box(g, 0.06, 0.1, 0.07, 0, 0.47, 0.38, 0x1d1f22);
    for (const sx of [-0.45, 0.45]) box(g, 0.08, 0.62, 0.72, sx, 0.3, 0, 0x4a4f55);
  } else if (relic) {
    // The temple reliquary: a stone coffer bound in gold.
    tbox(g, 1.6, 0.9, 1.0, 0, 0.45, 0, "stone", true, 0xd8d0b8, 2);
    const lid = tbox(g, 1.7, 0.3, 1.1, 0, 1.05, 0, "stone", false, 0xc8c0a8, 2);
    lid.name = "lid";
    for (const sx of [-0.55, 0, 0.55]) box(g, 0.12, 0.94, 1.04, sx, 0.45, 0, 0xd9b44a);
    box(g, 0.3, 0.3, 0.08, 0, 0.55, 0.52, 0xffd24a);
    const gem = box(g, 0.16, 0.16, 0.1, 0, 0.55, 0.56, 0xffffff);
    gem.material = mat(0x8fe9ff, 0x2f93b4);
  } else {
    tbox(g, 1.6, 0.8, 0.9, 0, 0.4, 0, "crate", true, 0xffffff, 1);
    const lid = tbox(g, 1.66, 0.2, 0.96, 0, 0.9, 0, "crate", false, 0xd8e0c8, 1);
    lid.name = "lid";
    box(g, 0.2, 0.26, 0.06, 0, 0.62, 0.47, 0xd9b44a);
    box(g, 0.07, 0.12, 0.07, 0, 0.58, 0.48, 0x1d1f22);
    for (const sx of [-0.6, 0.6]) box(g, 0.1, 0.84, 0.94, sx, 0.4, 0, 0x2a331f);
    box(g, 0.3, 0.06, 0.3, 0.45, 1.03, -0.2, 0xb3362a).name = "lid2";
  }
  g.rotation.y = rng() * Math.PI * 2;
  return g;
}

// ---------------------------------------------------------------------------------------------
// Layout

export type TreeSpecies = "jungle" | "fig" | "palm" | "mangrove" | "pine" | "saxaul";
export type AnimalKind = "deer" | "boar" | "wolf" | "croc" | "panther";

interface P2 {
  x: number;
  z: number;
}

export interface TreeSpot extends P2 {
  y: number;
  species: TreeSpecies;
  scale: number;
  yaw: number;
}

export interface Layout {
  trees: TreeSpot[];
  ferns: (P2 & { y: number; scale: number; yaw: number })[];
  rocks: P2[];
  ores: P2[];
  crystals: P2[];
  fibers: P2[];
  barrels: P2[];
  animals: (P2 & { kind: AnimalKind; danger: number })[];
}

const inMonument = (x: number, z: number, margin: number) => MONUMENTS.some((m) => Math.hypot(x - m.x, z - m.z) < m.r + margin);

export function generateLayout(seed = 1987): { layout: Layout; rng: Rng } {
  const rng = mulberry32(seed);
  const span = () => range(rng, -LIMIT + 40, LIMIT - 40);
  const b: Biome = { jungle: 0, beach: 0, swamp: 0, high: 0, salt: 0, coast: 0 };

  // Trees: dense jungle broken by clearings, palms on the sand, mangroves in the swamp, pines up north.
  const trees: TreeSpot[] = [];
  const taken = new Set<number>();
  for (let i = 0; i < 30000; i++) {
    const x = span();
    const z = span();
    biomeAt(x, z, b);
    if (b.coast < 5 || inMonument(x, z, 3)) continue;
    const y = heightAt(x, z);
    let species: TreeSpecies;
    let chance: number;
    if (b.beach > 0.5) {
      species = "palm";
      chance = y > 0.5 ? 0.1 : 0;
    } else if (b.high > 0.5) {
      species = "pine";
      chance = y < 32 ? 0.13 : 0;
    } else if (b.salt > 0.5) {
      species = "saxaul";
      chance = 0.012;
    } else if (b.swamp > 0.5) {
      species = "mangrove";
      chance = y > 0.05 ? 0.24 : 0.04;
    } else {
      const r = rng();
      species = r < 0.6 ? "jungle" : r < 0.8 ? "palm" : "fig";
      chance = fbm(x * 0.018 + 3, z * 0.018 + 8, 2) > 0.37 ? 0.68 : 0.05;
    }
    if (rng() > chance) continue;
    const cell = Math.round(x / 2.6) * 4096 + Math.round(z / 2.6);
    if (taken.has(cell)) continue;
    taken.add(cell);
    trees.push({ x, z, y: y - 0.2, species, scale: range(rng, 0.8, 1.25), yaw: rng() * Math.PI * 2 });
  }

  const ferns: Layout["ferns"] = [];
  for (let i = 0; i < 16000; i++) {
    const x = span();
    const z = span();
    biomeAt(x, z, b);
    if (b.coast < 12 || b.jungle + b.swamp < 0.6 || inMonument(x, z, -4)) continue;
    const y = heightAt(x, z);
    if (y < 0.15 || rng() > 0.55) continue;
    ferns.push({ x, z, y, scale: range(rng, 0.7, 1.6), yaw: rng() * Math.PI * 2 });
  }

  const scatter = (n: number, ok: (x: number, z: number, y: number) => boolean): P2[] => {
    const out: P2[] = [];
    for (let guard = 0; out.length < n && guard < n * 60; guard++) {
      const x = span();
      const z = span();
      biomeAt(x, z, b);
      if (b.coast < 10 || inMonument(x, z, 4)) continue;
      if (ok(x, z, heightAt(x, z))) out.push({ x, z });
    }
    return out;
  };
  const rocks = scatter(170, (_x, _z, y) => y > 0.3 && (b.high > 0.5 || rng() < 0.35));
  const ores = scatter(95, (_x, _z, y) => y > 0.5 && (b.high > 0.5 || (b.jungle > 0.5 && rng() < 0.12)));
  const crystals = scatter(16, (_x, _z, y) => b.high > 0.7 && y > 24);
  const fibers = scatter(150, (_x, _z, y) => y > 0.4 && b.high < 0.3 && b.salt < 0.5);
  const barrels = scatter(28, (_x, _z, y) => y > 0.6 && (b.beach > 0.4 || b.salt > 0.5 || rng() < 0.2));

  // Animals. Outside the monuments nothing carries a gun, but plenty has teeth.
  const animals: Layout["animals"] = [];
  const herd = (kind: AnimalKind, groups: number, size: [number, number], ok: (y: number) => boolean) => {
    for (const p of scatter(groups, (x, z, y) => ok(y) && !inMonument(x, z, 40))) {
      const n = size[0] + Math.floor(rng() * (size[1] - size[0] + 1));
      const danger = Math.hypot(p.x, p.z) > 320 ? 2 : 1;
      for (let i = 0; i < n; i++) animals.push({ kind, x: p.x + range(rng, -6, 6), z: p.z + range(rng, -6, 6), danger });
    }
  };
  herd("deer", 14, [2, 4], (y) => b.jungle > 0.6 && y > 1);
  herd("boar", 16, [1, 2], (y) => b.jungle + b.swamp > 0.6 && y > 0.5);
  herd("wolf", 8, [2, 3], (y) => b.high > 0.55 && y < 34);
  herd("croc", 12, [1, 1], (y) => b.swamp > 0.7 && y < 0.7);
  herd("panther", 5, [1, 1], (y) => b.jungle > 0.8 && y > 2);

  return { layout: { trees, ferns, rocks, ores, crystals, fibers, barrels, animals }, rng };
}

/** A random place to wake up: in the jungle, away from the monuments and the predators. */
export function pickSpawn(layout: Layout): P2 {
  const b: Biome = { jungle: 0, beach: 0, swamp: 0, high: 0, salt: 0, coast: 0 };
  const danger = layout.animals.filter((a) => a.kind !== "deer");
  for (let i = 0; i < 400; i++) {
    const x = range(Math.random, -420, 420);
    const z = range(Math.random, -160, 460);
    biomeAt(x, z, b);
    if (b.jungle < 0.8 || b.coast < 60 || inMonument(x, z, 110)) continue;
    if (danger.every((a) => Math.hypot(a.x - x, a.z - z) > 45)) return { x, z };
  }
  return { x: 0, z: 90 };
}

/** Local coordinates of a monument to world coordinates. */
export function monumentPoint(m: Monument, x: number, z: number): P2 {
  const c = Math.cos(m.yaw);
  const s = Math.sin(m.yaw);
  return { x: m.x + x * c + z * s, z: m.z - x * s + z * c };
}
