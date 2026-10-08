/**
 * The five monuments: the only places with armed NPCs and the best loot.
 * Each builder returns the buildings (in local coordinates, +Y up from the flattened pad) together
 * with where its loot, guards and harvest nodes go.
 */

import * as THREE from "three";
import { box, cyl, mat, tbox, tmat } from "./build";
import type { ContainerKind } from "./loot";
import { mulberry32, range, type Rng } from "./noise";
import { buildContainer, buildShip, type MonumentId } from "./world";

export interface Built {
  group: THREE.Group;
  containers: { kind: ContainerKind; group: THREE.Group; relic?: boolean }[];
  /** Guards in local x/z; `y` lifts them onto a structure. */
  guards: { x: number; z: number; y?: number; elite?: boolean; boss?: boolean; danger?: number }[];
  nodes: { kind: "rock" | "ore" | "crystal" | "scrap"; x: number; z: number }[];
  barrels: { x: number; z: number }[];
}

type Side = "n" | "s" | "e" | "w";

/** Four walls with a doorway, a floor and a roof. `y` raises it onto stilts or a platform. */
function hut(g: THREE.Group, x: number, z: number, w: number, d: number, h: number, wall: string, tint: number, roof: number, door: Side, y = 0): void {
  const t = 0.25;
  const wallX = (sx: number, gap: boolean) => {
    if (!gap) return void tbox(g, t, h, d, x + (sx * w) / 2, y + h / 2, z, wall, true, tint, 1);
    const seg = (d - 1.5) / 2;
    for (const s of [-1, 1]) tbox(g, t, h, seg, x + (sx * w) / 2, y + h / 2, z + s * (seg / 2 + 0.75), wall, true, tint, 1);
    tbox(g, t, h - 2.2, 1.5, x + (sx * w) / 2, y + 2.2 + (h - 2.2) / 2, z, wall, false, tint, 1);
  };
  const wallZ = (sz: number, gap: boolean) => {
    if (!gap) return void tbox(g, w, h, t, x, y + h / 2, z + (sz * d) / 2, wall, true, tint, 1);
    const seg = (w - 1.5) / 2;
    for (const s of [-1, 1]) tbox(g, seg, h, t, x + s * (seg / 2 + 0.75), y + h / 2, z + (sz * d) / 2, wall, true, tint, 1);
    tbox(g, 1.5, h - 2.2, t, x, y + 2.2 + (h - 2.2) / 2, z + (sz * d) / 2, wall, false, tint, 1);
  };
  wallX(-1, door === "w");
  wallX(1, door === "e");
  wallZ(-1, door === "n");
  wallZ(1, door === "s");
  tbox(g, w + 0.8, 0.2, d + 0.8, x, y + h + 0.1, z, "planks", true, roof, 1);
  tbox(g, w * 0.55, 0.25, d + 0.9, x, y + h + 0.32, z, "planks", false, roof, 1);
}

function chest(out: Built, rng: Rng, kind: ContainerKind, x: number, y: number, z: number, yaw: number, relic = false): void {
  const c = buildContainer(rng, kind, relic);
  c.position.set(x, y, z);
  c.rotation.y = yaw;
  out.group.add(c);
  out.containers.push({ kind, group: c, relic });
}

function fresh(): Built {
  return { group: new THREE.Group(), containers: [], guards: [], nodes: [], barrels: [] };
}

function logPile(g: THREE.Group, x: number, z: number, yaw: number): void {
  const p = new THREE.Group();
  for (const [dx, dy] of [[-0.75, 0.35], [0, 0.35], [0.75, 0.35], [-0.38, 1.0], [0.38, 1.0], [0, 1.65]]) {
    tbox(p, 0.7, 0.7, 6, dx, dy, 0, "bark", dy < 0.5, 0xc8b8a0, 1);
    box(p, 0.5, 0.5, 6.06, dx, dy, 0, 0xd8b888);
  }
  p.position.set(x, 0, z);
  p.rotation.y = yaw;
  g.add(p);
}

function sawmill(rng: Rng): Built {
  const out = fresh();
  const g = out.group;
  // The cutting shed: a roof on posts over the saw bench.
  tbox(g, 16, 0.3, 9, 0, 4.3, -4, "planks", true, 0xa88a68, 0.5);
  tbox(g, 16.6, 0.25, 4, 0, 4.7, -4, "planks", false, 0x8a6e50, 0.5);
  for (const px of [-7.5, 0, 7.5]) for (const pz of [-8, 0]) box(g, 0.35, 4.3, 0.35, px, 2.15, pz, 0x5a3f22, true);
  tbox(g, 6, 0.2, 1.6, 0, 1.1, -4, "planks", true, 0xffffff, 1);
  for (const lx of [-2.6, 2.6]) box(g, 0.3, 1.1, 1.3, lx, 0.55, -4, 0x4a4f55);
  const blade = cyl(g, 0.85, 0.06, 1.2, 1.55, -4, 0xc5ccd3);
  blade.rotation.x = Math.PI / 2;
  tbox(g, 0.6, 0.6, 4.2, -1.6, 1.5, -4, "bark", false, 0xc8b8a0, 1).rotation.y = Math.PI / 2;
  box(g, 0.9, 0.9, 0.9, 3.4, 0.45, -5.4, 0xb3362a);
  logPile(g, -13, 8, 0.2);
  logPile(g, -13, 15, -0.1);
  logPile(g, 11, 12, 1.3);
  for (const [sx, sz] of [[8, -13], [12, -13], [10, -11]]) tbox(g, 3, 0.9, 1.2, sx, 0.45, sz, "planks", true, 0xe8d0a8, 1);
  hut(g, -15, -12, 6, 5, 3, "planks", 0xc8a880, 0x7a4a2e, "e");
  hut(g, 15, 1, 5, 5, 3, "planks", 0xb89870, 0x6b4a2b, "w");
  // Watchtower.
  for (const [tx, tz] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) box(g, 0.3, 9.4, 0.3, -2 + tx, 4.7, 18 + tz, 0x5a3f22, true);
  tbox(g, 3.6, 0.25, 3.6, -2, 6.6, 18, "planks", false, 0xffffff, 1);
  tbox(g, 4.4, 0.2, 4.4, -2, 9.5, 18, "planks", false, 0x7a4a2e, 1);
  for (const s of [-1, 1]) {
    box(g, 3.6, 0.1, 0.1, -2, 7.6, 18 + s * 1.75, 0x5a3f22);
    box(g, 0.1, 0.1, 3.6, -2 + s * 1.75, 7.6, 18, 0x5a3f22);
  }
  for (let i = 0; i < 9; i++) box(g, 0.1, 0.1, 0.8, -3.4, 0.6 + i * 0.7, 18, 0x5a3f22).rotation.y = Math.PI / 2;
  // Stumps and a fence.
  for (const [sx, sz] of [[5, 6], [-6, 4], [2, 14], [-20, 2], [20, -10]]) cyl(g, 0.5, 0.5, sx, 0.25, sz, tmat("bark", 0xc8b8a0), true);
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 2;
    if (Math.abs(Math.sin(a * 1.5)) < 0.35) continue;
    box(g, 0.16, 1.4, 0.16, Math.cos(a) * 31, 0.7, Math.sin(a) * 31, 0x5a3f22);
    box(g, 0.08, 0.1, 6.6, Math.cos(a) * 31, 1.0, Math.sin(a) * 31, 0x6e5a45).rotation.y = -a;
  }
  chest(out, rng, "chest", -16.5, 0, -12.5, 0.2);
  chest(out, rng, "chest", 16.4, 0, 1.4, -0.3);
  chest(out, rng, "chest", 5.6, 0, -6.4, 0);
  out.barrels.push({ x: 7, z: -1 }, { x: -9, z: -6 }, { x: 12, z: 6 }, { x: -18, z: 10 }, { x: 2, z: -11 });
  out.nodes.push({ kind: "scrap", x: 6, z: -15 }, { kind: "scrap", x: -7, z: 11 }, { kind: "scrap", x: 19, z: -6 });
  out.guards.push({ x: 4, z: 2 }, { x: -9, z: 0 }, { x: 10, z: 8 }, { x: -12, z: -6 }, { x: 1, z: 13 }, { x: 0, z: -1, elite: true });
  return out;
}

function boat(g: THREE.Group, x: number, z: number, yaw: number, tint: number): void {
  const b = new THREE.Group();
  tbox(b, 2.2, 0.8, 6, 0, 0.5, 0, "planks", true, tint, 1);
  tbox(b, 1.8, 0.4, 5.4, 0, 0.82, 0, "planks", false, 0x6b4a2b, 1);
  box(b, 2.0, 0.1, 0.5, 0, 0.95, 0.8, 0x8a5a32);
  box(b, 0.1, 0.1, 3.2, 1.3, 1.0, 0, 0x8a5a32).rotation.y = 0.2;
  b.position.set(x, 0, z);
  b.rotation.set(0, yaw, 0.2);
  g.add(b);
}

/** Local +Z looks out to sea: the pier runs that way. */
function village(rng: Rng): Built {
  const out = fresh();
  const g = out.group;
  const deck = 1.0;
  // The pier, on posts that run down into the water.
  tbox(g, 3.2, 0.25, 54, 0, deck, 33, "planks", true, 0xd8c0a0, 0.5);
  for (let z = 8; z <= 60; z += 6.5) for (const sx of [-1.5, 1.5]) box(g, 0.3, 9, 0.3, sx, deck - 4.4, z, 0x4a3524);
  const ramp = tbox(g, 3.2, 0.25, 5.2, 0, deck / 2 - 0.05, 3.6, "planks", true, 0xc8b090, 0.5);
  ramp.rotation.x = -0.2;
  for (let z = 10; z <= 58; z += 8) box(g, 0.14, 1.3, 0.14, 1.5, deck + 0.75, z + 3, 0x4a3524);
  // Stilt huts off both sides of the pier.
  const huts: [number, number, Side, number, number][] = [[-4.3, 17, "e", 0x3f7896, 0xe8d8b8], [4.3, 26, "w", 0xb3362a, 0xd8c8a8], [-4.3, 37, "e", 0xc9a23f, 0xe8d8b8], [4.3, 46, "w", 0x3f7896, 0xd0c0a0]];
  for (const [hx, hz, door, roof, tint] of huts) {
    tbox(g, 5.4, 0.25, 5.4, hx, deck, hz, "planks", true, 0xc8b090, 0.5);
    for (const [px, pz] of [[-2.4, -2.4], [2.4, -2.4], [-2.4, 2.4], [2.4, 2.4]]) box(g, 0.28, 9, 0.28, hx + px, deck - 4.4, hz + pz, 0x4a3524);
    hut(g, hx, hz, 5, 5, 2.6, "planks", tint, roof, door, deck + 0.12);
  }
  chest(out, rng, "chest", -5.4, deck + 0.13, 17.6, 0.4);
  chest(out, rng, "chest", 5.4, deck + 0.13, 26.4, -0.4);
  chest(out, rng, "chest", -5.5, deck + 0.13, 37.5, 0.3);
  chest(out, rng, "military", 5.3, deck + 0.13, 46.4, -0.3);
  // The beach: boats, drying racks, nets and a fire.
  boat(g, -12, 2, 0.5, 0x3f7896);
  boat(g, 13, -2, -0.9, 0xb3362a);
  boat(g, 8, 12, 0.3, 0xe8d8b8);
  for (const rx of [-8, -5.4]) box(g, 0.14, 2.2, 0.14, rx, 1.1, -10, 0x5a3f22);
  box(g, 2.8, 0.08, 0.08, -6.7, 2.1, -10, 0x5a3f22);
  for (let i = 0; i < 5; i++) box(g, 0.14, 0.5, 0.3, -7.7 + i * 0.5, 1.8, -10, i % 2 ? 0x8fa8b8 : 0xb8c8d0);
  const net = tbox(g, 4, 0.06, 3, 16, 0.9, 8, "cloth", false, 0x6a8a7a, 2);
  net.rotation.z = 0.5;
  for (const nx of [14.4, 17.8]) box(g, 0.12, 2.4, 0.12, nx, 1.2, 8, 0x5a3f22);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    tbox(g, 0.3, 0.22, 0.3, 2 + Math.cos(a) * 0.8, 0.1, -12 + Math.sin(a) * 0.8, "stone", false, 0xffffff, 2);
  }
  const flame = cyl(g, 0.3, 0.7, 2, 0.45, -12, mat(0xffa53a, 0xff7a1a));
  flame.castShadow = false;
  hut(g, -17, -14, 5, 4.5, 2.6, "planks", 0xe8d8b8, 0x3f7896, "e");
  chest(out, rng, "chest", -18.2, 0, -14.6, 0.3);
  for (const [cx, cz] of [[10, -14], [11.2, -13.2], [10.4, -12]]) tbox(g, 1, 1, 1, cx, 0.5, cz, "woodcrate", true, 0xffffff, 1);
  out.barrels.push({ x: 1.2, z: 12 }, { x: -1.1, z: 30 }, { x: -9, z: -4 }, { x: 14, z: -10 }, { x: 5, z: -18 });
  out.nodes.push({ kind: "scrap", x: -14, z: 10 }, { kind: "scrap", x: 18, z: 1 });
  out.guards.push({ x: -8, z: -8 }, { x: 10, z: -6 }, { x: 0, z: -16 }, { x: -15, z: 4 }, { x: 16, z: 12, danger: 2 }, { x: -4, z: -22, danger: 2 }, { x: 3, z: -4, elite: true, danger: 2 });
  return out;
}

function temple(rng: Rng): Built {
  const out = fresh();
  const g = out.group;
  const moss = 0xb4c2a4;
  const dark = 0x9aa890;
  // A stepped pyramid with a stair up the south face.
  tbox(g, 22, 2.4, 22, 0, 1.2, 0, "stone", true, moss, 1);
  tbox(g, 15, 2.4, 15, 0, 3.6, 0, "stone", true, dark, 1);
  tbox(g, 9, 2.4, 9, 0, 6.0, 0, "stone", true, moss, 1);
  const stair = tbox(g, 4.4, 0.5, 16.4, 0, 3.5, 11.9, "stone", true, 0xc8d0b8, 1);
  stair.rotation.x = 0.455;
  for (const sx of [-2.6, 2.6]) {
    const rail = tbox(g, 0.7, 1.1, 16.2, sx, 4.0, 11.9, "stone", false, dark, 1);
    rail.rotation.x = 0.455;
  }
  // Shrine on top.
  for (const [px, pz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) tbox(g, 0.8, 3.2, 0.8, px, 8.8, pz, "stone", true, 0xd0d8c0, 2);
  tbox(g, 8, 0.6, 8, 0, 10.7, 0, "stone", true, dark, 1);
  tbox(g, 5, 0.6, 5, 0, 11.3, 0, "stone", false, moss, 1);
  chest(out, rng, "military", 0, 7.2, -0.4, 0, true);
  for (const [tx, tz] of [[-3.4, 3.6], [3.4, 3.6], [-2.6, 20], [2.6, 20]]) {
    const y = tz > 10 ? 0 : 7.2;
    box(g, 0.24, 1.6, 0.24, tx, y + 0.8, tz, 0x4a3524);
    const fl = box(g, 0.34, 0.44, 0.34, tx, y + 1.8, tz, 0xffffff);
    fl.material = mat(0xffb04a, 0xff6a10);
    fl.castShadow = false;
  }
  // Side altars with offerings.
  for (const sx of [-1, 1]) {
    tbox(g, 5, 1, 5, sx * 17, 0.5, -4, "stone", true, dark, 1);
    tbox(g, 3, 0.4, 3, sx * 17, 1.2, -4, "stone", false, moss, 1);
    chest(out, rng, "chest", sx * 17, 1.4, -4, sx * 0.6);
  }
  // Statues guarding the stair.
  for (const sx of [-5.4, 5.4]) {
    tbox(g, 1.6, 1.2, 1.6, sx, 0.6, 20, "stone", true, dark, 2);
    tbox(g, 1.2, 2.2, 1.0, sx, 2.3, 20, "stone", false, moss, 2);
    tbox(g, 1.4, 1.3, 1.3, sx, 4.05, 20, "stone", false, 0xc8d0b8, 2);
    box(g, 0.24, 0.18, 0.1, sx - 0.3, 4.2, 20.68, 0x1d1f22);
    box(g, 0.24, 0.18, 0.1, sx + 0.3, 4.2, 20.68, 0x1d1f22);
    box(g, 0.7, 0.14, 0.1, sx, 3.7, 20.68, 0x1d1f22);
  }
  // Ruined colonnade and vines.
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.26;
    if (Math.abs(Math.sin(a) - 1) < 0.3) continue;
    const h = range(rng, 1.2, 5.5);
    tbox(g, 1, h, 1, Math.cos(a) * 27, h / 2, Math.sin(a) * 27, "stone", true, i % 2 ? moss : dark, 2).rotation.y = a;
    if (h > 4) tbox(g, 1.4, 0.4, 1.4, Math.cos(a) * 27, h + 0.2, Math.sin(a) * 27, "stone", false, moss, 2);
  }
  for (let i = 0; i < 14; i++) {
    const side = Math.floor(rng() * 4);
    const t = range(rng, -9, 9);
    const [vx, vz] = side === 0 ? [t, 11.1] : side === 1 ? [t, -11.1] : side === 2 ? [11.1, t] : [-11.1, t];
    if (side === 0 && Math.abs(t) < 3) continue;
    const len = range(rng, 0.8, 2.2);
    tbox(g, side < 2 ? 0.5 : 0.12, len, side < 2 ? 0.12 : 0.5, vx, 2.4 - len / 2, vz, "foliage", false, 0x3f8a3a, 2);
  }
  out.barrels.push({ x: 20, z: 12 }, { x: -21, z: 14 });
  out.nodes.push({ kind: "rock", x: 22, z: -14 }, { kind: "rock", x: -20, z: -16 }, { kind: "crystal", x: 0, z: -19 });
  out.guards.push(
    { x: 8, z: 24, danger: 2 }, { x: -8, z: 24, danger: 2 }, { x: 19, z: 8, danger: 2 }, { x: -19, z: 8, danger: 2 }, { x: 4, z: -22, danger: 2 },
    { x: -12, z: -18, danger: 2 }, { x: 0, z: 3.4, y: 7.3, elite: true, danger: 2 },
  );
  return out;
}

function mine(rng: Rng): Built {
  const out = fresh();
  const g = out.group;
  const rock = 0xb0a898;
  // The hillside and the mouth of the shaft.
  tbox(g, 20, 12, 10, 0, 6, -21, "stone", true, rock, 0.5);
  tbox(g, 12, 8, 9, -13, 4, -17, "stone", true, 0xa09888, 0.5).rotation.y = 0.3;
  tbox(g, 11, 9, 9, 13, 4.5, -18, "stone", true, 0xbab2a2, 0.5).rotation.y = -0.25;
  tbox(g, 8, 5, 6, 3, 13, -22, "stone", false, rock, 0.5).rotation.y = 0.4;
  box(g, 4.2, 4.2, 0.6, 0, 2.1, -15.9, 0x0e0e10);
  for (const sx of [-2.4, 2.4]) tbox(g, 0.5, 4.6, 0.5, sx, 2.3, -15.6, "planks", true, 0x8a6e50, 2);
  tbox(g, 5.8, 0.5, 0.6, 0, 4.7, -15.6, "planks", false, 0x8a6e50, 2);
  const lamp = box(g, 0.3, 0.3, 0.3, 0, 4.2, -15.3, 0xffffff);
  lamp.material = mat(0xffe08a, 0xffb030);
  // Rails, sleepers and ore carts.
  for (const sx of [-0.6, 0.6]) box(g, 0.12, 0.12, 32, sx, 0.08, 0.5, 0x33363b);
  for (let z = -15; z <= 16; z += 1.4) box(g, 1.9, 0.08, 0.26, 0, 0.04, z, 0x5a3f22);
  for (const cz of [-5, 9]) {
    tbox(g, 1.5, 0.8, 2.1, 0, 0.9, cz, "rust", true, 0xd8c8b8, 1);
    for (const [wx, wz] of [[-0.75, -0.7], [0.75, -0.7], [-0.75, 0.7], [0.75, 0.7]]) cyl(g, 0.24, 0.1, wx, 0.3, cz + wz, 0x2e2e2e).rotation.z = Math.PI / 2;
    for (let i = 0; i < 5; i++) box(g, 0.36, 0.36, 0.36, range(rng, -0.4, 0.4), 1.4, cz + range(rng, -0.6, 0.6), i % 2 ? 0xd6783a : 0x8f897d).rotation.set(rng(), rng(), rng());
  }
  // Headframe with a winding wheel.
  for (const [hx, hz, rz, rx] of [[-1.6, -1.6, -0.14, 0.14], [1.6, -1.6, 0.14, 0.14], [-1.6, 1.6, -0.14, -0.14], [1.6, 1.6, 0.14, -0.14]]) {
    box(g, 0.4, 11, 0.4, 16 + hx, 5.4, 4 + hz, 0x6b4a2b, true).rotation.set(rx, 0, rz);
  }
  for (const y of [3.6, 7.2]) for (const s of [-1, 1]) box(g, 3, 0.25, 0.25, 16, y, 4 + s * (1.4 - y * 0.05), 0x5a3f22);
  const wheel = cyl(g, 1.3, 0.2, 16, 10.6, 4, 0x33363b);
  wheel.rotation.x = Math.PI / 2;
  box(g, 0.06, 10, 0.06, 16, 5.4, 4, 0x1d1f22);
  hut(g, -17, 8, 6, 5, 3, "planks", 0xb89870, 0x6b4a2b, "e");
  hut(g, 14, 18, 5, 5, 3, "rust", 0xd8c8b8, 0x4a4f55, "n");
  chest(out, rng, "chest", -18.4, 0, 8.6, 0.3);
  chest(out, rng, "military", 14.6, 0, 19.2, 0);
  chest(out, rng, "chest", 19, 0, 0, 0.8);
  for (const [cx, cz] of [[-8, 16], [-6.8, 16.6], [-7.4, 17.8], [8, -8]]) tbox(g, 1, 1, 1, cx, 0.5, cz, "woodcrate", true, 0xffffff, 1);
  out.barrels.push({ x: 6, z: 4 }, { x: -10, z: -4 }, { x: 20, z: 12 }, { x: -20, z: 16 });
  out.nodes.push(
    { kind: "ore", x: -6, z: -10 }, { kind: "ore", x: 7, z: -11 }, { kind: "ore", x: -22, z: -6 }, { kind: "ore", x: 24, z: -8 }, { kind: "ore", x: -12, z: 22 },
    { kind: "ore", x: 4, z: 24 }, { kind: "ore", x: 26, z: 8 }, { kind: "ore", x: -26, z: 4 },
    { kind: "crystal", x: -4, z: -13.5 }, { kind: "crystal", x: 4.4, z: -13.8 }, { kind: "crystal", x: -9, z: -12 }, { kind: "crystal", x: 22, z: -14 },
    { kind: "rock", x: -24, z: 22 }, { kind: "rock", x: 28, z: 20 }, { kind: "scrap", x: 9, z: 10 },
  );
  out.guards.push(
    { x: 5, z: 6, danger: 2 }, { x: -6, z: 2, danger: 2 }, { x: -12, z: 12, danger: 2 }, { x: 10, z: 22, danger: 2 }, { x: 22, z: 4, danger: 2 }, { x: -4, z: 22, danger: 2 },
    { x: 4, z: -8, danger: 3 }, { x: -5, z: -7, danger: 3 }, { x: 0, z: 14, elite: true, danger: 3 },
  );
  return out;
}

function tent(g: THREE.Group, x: number, z: number, yaw: number): void {
  const t = new THREE.Group();
  tbox(t, 4, 1.4, 5.5, 0, 0.7, 0, "cloth", true, 0x5d6f48, 2);
  for (const s of [-1, 1]) tbox(t, 2.6, 0.14, 5.7, s * 1.05, 1.95, 0, "cloth", false, 0x4b5a3a, 2).rotation.z = s * -0.55;
  box(t, 1.2, 1.3, 0.1, 0, 0.65, 2.76, 0x1d1f22);
  t.position.set(x, 0, z);
  t.rotation.y = yaw;
  g.add(t);
}

function graveyard(rng: Rng): Built {
  const out = fresh();
  const g = out.group;
  const ships: [number, number, number, number, boolean][] = [[-36, -46, 0.4, 40, true], [42, -30, 2.1, 34, false], [-52, 34, -0.9, 44, true], [36, 52, 1.2, 36, false]];
  for (const [sx, sz, yaw, L, crate] of ships) {
    const ship = buildShip(rng, L);
    ship.position.set(sx, -0.9, sz);
    ship.rotation.set(0, yaw, ship.userData.tilt as number);
    g.add(ship);
    const c = buildContainer(rng, "chest");
    c.position.set(-1.6, 0.4, L * 0.32);
    ship.add(c);
    out.containers.push({ kind: "chest", group: c });
    if (crate) {
      const m = buildContainer(rng, "military");
      m.position.set(0, 5.15, L * 0.25 + L * 0.45 * 0.18 + 1.2);
      m.rotation.y = 0;
      ship.add(m);
      out.containers.push({ kind: "military", group: m });
    }
    for (let i = 0; i < 3; i++) {
      const a = rng() * Math.PI * 2;
      const r = L / 2 + range(rng, 3, 12);
      out.nodes.push({ kind: "scrap", x: sx + Math.cos(a) * r, z: sz + Math.sin(a) * r });
    }
  }
  // The military camp in the middle of the wrecks.
  tent(g, -7, -4, 0.3);
  tent(g, 7, -6, -0.4);
  tent(g, 0, 9, Math.PI);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    if (Math.abs(Math.cos(a)) < 0.25) continue;
    tbox(g, 2.2, 0.9, 0.9, Math.cos(a) * 16, 0.45, Math.sin(a) * 16, "cloth", true, 0xc8b890, 2).rotation.y = -a + Math.PI / 2;
  }
  box(g, 0.2, 14, 0.2, -3, 7, 3, 0x4a4f55, true);
  for (let i = 0; i < 4; i++) box(g, 1.6 - i * 0.3, 0.08, 0.08, -3, 9 + i * 1.2, 3, 0x4a4f55);
  cyl(g, 0.9, 0.2, -3, 13.6, 3.6, 0xc5ccd3).rotation.x = 1.1;
  tbox(g, 2.4, 0.12, 1.2, 3, 0.95, 2, "planks", true, 0xffffff, 1);
  for (const lx of [2, 4]) box(g, 0.12, 0.95, 1, lx, 0.47, 2, 0x4a4f55);
  box(g, 0.7, 0.5, 0.4, 3, 1.26, 2, 0x2a331f);
  for (const [cx, cz, cy] of [[10, 4, 0.5], [11.2, 4.4, 0.5], [10.6, 4.2, 1.5], [-11, 6, 0.5]]) tbox(g, 1.1, 1, 1.1, cx, cy, cz, "crate", cy < 1, 0xffffff, 1);
  chest(out, rng, "military", 0, 0, -1, 0.2);
  chest(out, rng, "chest", -9.5, 0, 5, 0.5);
  out.barrels.push({ x: 12, z: -2 }, { x: -13, z: -8 }, { x: 4, z: 14 }, { x: -24, z: -20 }, { x: 28, z: 10 }, { x: -20, z: 50 });
  out.guards.push(
    { x: 14, z: 10, danger: 3 }, { x: -14, z: 12, danger: 3 }, { x: 16, z: -12, danger: 3 }, { x: -18, z: -14, danger: 3 }, { x: -30, z: -24, danger: 3 },
    { x: 34, z: -10, danger: 3 }, { x: -36, z: 22, danger: 3 }, { x: 26, z: 36, danger: 3 }, { x: 0, z: -22, danger: 3 },
    { x: 20, z: 24, elite: true, danger: 3 }, { x: 3, z: 6, boss: true, danger: 3 },
  );
  return out;
}

export function buildMonument(id: MonumentId): Built {
  const rng = mulberry32(id.length * 977 + id.charCodeAt(0) * 31);
  if (id === "sawmill") return sawmill(rng);
  if (id === "village") return village(rng);
  if (id === "temple") return temple(rng);
  if (id === "mine") return mine(rng);
  return graveyard(rng);
}
