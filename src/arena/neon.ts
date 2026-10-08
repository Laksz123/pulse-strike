/**
 * Neon: a few blocks of a city at night, lit by its signs.
 *
 * Attackers start in the west. South of them a street leads to the ramp up onto site A, and beside
 * it an arcade hall — indoors, all screens — comes out on the same site a little further along.
 * Straight ahead is the middle, watched from a nest at its far end; before the nest it splits, a
 * connector climbing south to A and a short lane running north to B. North of the spawn a corridor
 * of flats runs indoors all the way to B's side.
 *
 * Site A is a raised plaza. Site B is a yard with a loading dock along the back and a shop on its
 * far side that the defenders come through. Defenders start in the east, behind the nest.
 */

import * as THREE from "three";
import type { Kit, MapSpec } from "./map";
import { pbr } from "./models";
import * as P from "./props";
import { town, YAW, type Side } from "./town";

const LANES = [-6, -3, 0, 3, 6];

export function neon(k: Kit): MapSpec {
  const wet = k.tex("wetasphalt");
  wet.roughness = 0.42;
  wet.metalness = 0.12;
  const walk = k.tex("sidewalk", 0xb4bad0);
  const plaza = k.tex("sidewalk", 0xd8dcec);
  const checker = k.tex("checker", 0xd8d0f0);
  const tiles = k.tex("subway", 0xc8d4ee);
  const dimTiles = k.tex("subway", 0x8a94b6);
  const brick = k.tex("brick", 0x9a6a66);
  const plum = k.tex("brick", 0x7c5c90);
  const conc = k.tex("wall", 0x8c92ac);
  const dark = k.tex("wall", 0x565c78);
  const navy = k.tex("stucco", 0x3f518a);
  const violet = k.tex("stucco", 0x6c4c8a);
  const teal = k.tex("stucco", 0x2f6c7c);
  const steel = k.tex("corrugated", 0x7c88a4);
  const foot = k.tex("wall", 0x363c54);
  const trim = pbr(0x1c2030, 0.2, 0.6);
  const iron = pbr(0x23262d, 0.3, 0.6);
  const glowing = (c: number, power = 2.2) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: power, roughness: 0.4 });
  const PINK = 0xff4fa8;
  const CYAN = 0x3fe0ff;
  const GOLD = 0xffd23a;
  const LIME = 0x7dff6a;
  const tubes: Record<number, THREE.Material> = { [PINK]: glowing(PINK), [CYAN]: glowing(CYAN), [GOLD]: glowing(GOLD), [LIME]: glowing(LIME) };
  const awn = [k.tex("awning", 0xff8ac0), k.tex("awning", 0x8fe0ff), k.tex("awning", 0xffe08a)];
  const { rnd, pick, awning, line, block, door } = town(k, {
    seed: 20261009, trim, roof: trim, beam: iron, iron, bulb: glowing(0xffe2a0, 1.6), awnings: awn,
    cloth: [PINK, CYAN, GOLD, LIME, 0xffffff],
    window: ["cityw_lit", 1.7, 1.7], screen: ["cityw_dark", 1.7, 1.7], screenAwning: 0, lit: 1,
    doors: { door: ["metaldoor", 1.35, 2.05], store: ["store", 4.6, 3.07], shutter: ["shutter", 2.5, 2.5], posters: ["posters", 2.4, 2.4, 0.5] },
    leaf: steel, tub: conc, tree: P.bush, lamp: PINK,
  });

  k.sky("#070a1c", "#1a1640", "#3a2a6a", 0x2a2550, true);
  k.sun(0x9db4ff, 1.2, 30, 60, -24, 0x93a2ff, 0x3a3a58, 1.35);
  k.scene.fog = new THREE.Fog(0x191736, 55, 260);
  k.ground(wet, 6);

  // -------------------------------------------------------------------------------------------
  // Pieces of a city

  /** A neon tube along a wall or an eave. */
  const tube = (x1: number, z1: number, x2: number, z2: number, y: number, c: number) => {
    const alongX = Math.abs(x2 - x1) > Math.abs(z2 - z1);
    k.box((x1 + x2) / 2, (z1 + z2) / 2, alongX ? Math.abs(x2 - x1) : 0.09, 0.09, alongX ? 0.09 : Math.abs(z2 - z1), tubes[c], { y, solid: false });
  };
  /** A lit sign on a wall: a picture on a dark board. */
  const sign = (name: string, x: number, y: number, z: number, w: number, h: number, s: Side) => {
    const nx = Math.sin(YAW[s]);
    const nz = Math.cos(YAW[s]);
    k.box(x + nx * 0.06, z + nz * 0.06, nx ? 0.12 : w + 0.2, h + 0.2, nz ? 0.12 : w + 0.2, trim, { y: y - 0.1, solid: false });
    k.panel(name, x + nx * 0.13, y, z + nz * 0.13, w, h, YAW[s], 0xffffff, 1.5);
  };
  /** A machine with a lit front: `kind` is the picture on it. Stands with its back to side `s` of a wall. */
  const machine = (kind: "vending" | "arcade", x: number, z: number, s: Side, y = 0) => {
    const w = kind === "vending" ? 1.1 : 0.82;
    const h = kind === "vending" ? 2.0 : 1.9;
    const flat = s === "n" || s === "s";
    k.box(x, z, flat ? w : 0.8, h, flat ? 0.8 : w, kind === "vending" ? pbr(0x1f8fc0, 0.2, 0.5) : pbr(0x2a1f4a, 0.2, 0.5), { y });
    k.panel(kind, x + Math.sin(YAW[s]) * 0.4, y + 0.03, z + Math.cos(YAW[s]) * 0.4, w - 0.06, h - 0.06, YAW[s], 0xffffff, 1.2);
  };
  /** A street lamp with a coloured light under it. */
  const lamp = (x: number, z: number, yaw: number, c: number, power = 55, y = 0) => {
    k.prop(P.lampPost(c, 5.4), x, z, yaw, 0.2, y);
    if (power) k.light(x + Math.cos(yaw) * 0.9, y + 4.7, z - Math.sin(yaw) * 0.9, c, power, 24);
  };
  /** A sign board hung over a way through, for the letter of the site it leads to. */
  const gantry = (text: string, x: number, z: number, w: number, alongX: boolean, yaw: number) => {
    k.box(x, z, alongX ? w : 0.24, 0.3, alongX ? 0.24 : w, iron, { y: 5.3, solid: false });
    k.box(x, z, alongX ? 2 : 0.14, 1.1, alongX ? 0.14 : 2, trim, { y: 4.2, solid: false });
    k.label(text, x + Math.sin(yaw) * 0.09, 4.75, z + Math.cos(yaw) * 0.09, 0.8, yaw);
  };
  /** A thin wall across a doorway: `gap` is where the door is, along the wall from its first end. */
  const doorWall = (x: number, z1: number, z2: number, g1: number, g2: number, h: number, m: THREE.Material) => {
    k.box(x, (z1 + g1) / 2, 0.4, h, g1 - z1, m, { tile: 3 });
    k.box(x, (g2 + z2) / 2, 0.4, h, z2 - g2, m, { tile: 3 });
    k.box(x, (g1 + g2) / 2, 0.4, h - 2.9, g2 - g1, m, { y: 2.9, tile: 3 });
    k.box(x, (g1 + g2) / 2, 0.5, 0.14, g2 - g1 + 0.3, iron, { y: 2.83, solid: false });
  };
  /** Shelves of a shop, along Z: a dark frame and rows of bright things. */
  const shelves = (x: number, z: number, len: number) => {
    k.box(x, z, 0.7, 1.9, len, iron);
    const goods = [0xff5a4a, 0x2fb7c9, 0xffc93a, 0x7fd44a, 0xff8a3a, 0x9b6dff].map((c) => pbr(c, 0, 0.6));
    for (const sx of [-1, 1]) {
      for (let row = 0; row < 3; row++) {
        for (let t = -len / 2 + 0.3; t < len / 2 - 0.2; t += 0.42) k.box(x + sx * 0.37, z + t, 0.08, 0.34, 0.3, pick(goods), { y: 0.3 + row * 0.56, solid: false });
      }
    }
    k.box(x, z, 0.8, 0.06, len + 0.1, glowing(0xdff4ff, 1.4), { y: 1.9, solid: false });
  };

  // -------------------------------------------------------------------------------------------
  // The ground: pavements along the fronts, the plaza, the floors indoors.

  k.slab(-7, -3, 42, 1, walk, 3, 0.05);
  k.slab(-7, 3, 42, 1, walk, 3, 0.05);
  k.slab(-19, 18.6, 32, 1.2, walk, 3, 0.05);
  k.slab(-19, 27.4, 32, 1.2, walk, 3, 0.05);
  k.slab(5, -22.5, 22, 17, walk, 3, 0.04);
  k.slab(31, -3, 10, 18, walk, 3, 0.04);
  k.slab(-32, 0, 8, 16, walk, 3, 0.04);
  k.slab(-14.5, 12.5, 27, 5, checker, 2.4, 0.05);
  k.slab(-17, -24, 22, 6, dimTiles, 3, 0.05);
  k.slab(21, -22.5, 10, 9, tiles, 3, 0.05);

  // -------------------------------------------------------------------------------------------
  // The blocks

  block(-38, -33, -35, -8, 9, { wall: brick, band: foot, faces: "e", shutters: true });
  block(-38, -8, -36, 8, 8, { wall: navy, band: foot, faces: "e" });
  block(-38, 8, -35, 33, 9.5, { wall: plum, band: foot, faces: "e", shutters: true });
  block(-35, -33, -6, -27, 9, { wall: conc, band: foot, faces: "e" });
  block(-6, -33, 16, -31, 10, { wall: brick, band: foot, faces: "s", shutters: true, lift: 1 });
  block(16, -33, 26, -27, 8.5, { wall: teal, band: foot });
  block(26, -33, 38, -27, 9.5, { wall: plum, band: foot, faces: "s", shutters: true });
  block(32, -27, 38, -12, 8.5, { wall: conc, band: foot, faces: "ws" });
  block(36, -12, 38, 33, 9, { wall: navy, band: foot, faces: "w", shutters: true });
  block(-28, -21, -6, -3.5, 9, { wall: plum, band: foot, faces: "swe", shutters: true });
  block(-6, -14, 2, -3.5, 8, { wall: teal, band: foot, faces: "nse" });
  block(8, -14, 16, -3.5, 8.5, { wall: brick, band: foot, faces: "nsw", shutters: true });
  block(16, -18, 26, -3.5, 9, { wall: conc, band: foot, faces: "e" });
  block(-28, 3.5, 8, 10, 8.5, { wall: navy, band: foot, faces: "nw", shutters: true });
  block(14, 3.5, 26, 10, 8, { wall: violet, band: foot, faces: "s", lift: 1.2 });
  block(30, 6, 36, 10, 7.5, { wall: brick, band: foot, faces: "n" });
  block(-28, 15, -3, 18, 8.5, { wall: brick, band: foot, faces: "s", shutters: true });
  block(-3, 15, 4, 20, 8.5, { wall: brick, band: foot });
  block(-3, 27, 4, 28, 5, { wall: conc, band: foot });
  block(-35, 28, 4, 33, 9, { wall: teal, band: foot, faces: "n", shutters: true });
  block(4, 30, 30, 33, 9.5, { wall: violet, band: foot, faces: "n", shutters: true, lift: 1.2 });
  block(30, 10, 36, 33, 9, { wall: conc, band: foot, faces: "w", lift: 1.2 });
  // Beside the nest's ramp.
  k.box(23, -3, 6, 4.6, 1, dark, { tile: 3 });
  k.box(23, 3, 6, 4.6, 1, dark, { tile: 3 });

  // -------------------------------------------------------------------------------------------
  // Site A: a raised plaza, with the three ways up onto it.

  k.box(17, 20, 26, 1.2, 20, plaza, { walk: true, tile: 3 });
  k.ramp(-3, 23.5, 4, 23.5, 7, 0, 1.2, plaza, 0, 3);
  k.ramp(-1, 12.5, 4, 12.5, 5, 0, 1.2, checker, 6, 2.4);
  k.ramp(11, 5, 11, 10, 6, 0, 1.2, conc, 6);
  k.ramp(28, 6, 28, 10, 4, 0, 1.2, conc, 6);
  // A booth to hide behind, and a truck selling something hot.
  block(22.4, 11.4, 25.4, 14.4, 4.4, { wall: teal, band: foot, lift: 1.2 });
  k.panel("store", 23.9, 1.5, 14.4, 2.7, 1.8, 0, 0xffffff, 1.2);
  tube(22.4, 14.46, 25.4, 14.46, 4.5, CYAN);
  k.prop(P.truck(PINK, 0xfff3dc), 21.6, 27.3, 0.03, [3.8, 1.7, 1.25], 1.2);
  k.crate(19.6, 21.6, 1.6, 0.1, 1.2);
  k.crate(21.3, 22.2, 1.2, 0.5, 1.2);
  k.crate(19.7, 21.7, 1.2, 0.6, 2.8);
  k.crate(14.4, 16.6, 1.0, 0.3, 1.2);
  for (const z of [17.8, 19, 20.2]) machine("arcade", 29.56, z, "w", 1.2);
  machine("vending", 7.6, 29.56, "n", 1.2);
  machine("vending", 8.9, 29.56, "n", 1.2);
  k.prop(P.busStop(CYAN), 13.4, 29.1, Math.PI, [1.75, 1.3, 0.7], 1.2);
  k.prop(P.bench(), 28.9, 24.4, -Math.PI / 2, [0.9, 0.5, 0.3], 1.2);
  k.prop(P.barrier(), 6.4, 19.2, Math.PI / 2, [1.2, 0.55, 0.36], 1.2);
  k.prop(P.barrier(), 9.6, 13.2, 0.2, [1.2, 0.55, 0.36], 1.2);
  k.prop(P.dumpster(0x7c5c90), 28.4, 28.8, 0, [1.15, 0.7, 0.65], 1.2);
  k.prop(P.hydrant(), 5, 16.4, 0, 0.25, 1.2);
  k.cyl(11.4, 23.2, 0.85, 0.7, conc, 1.2);
  k.prop(P.bush(), 11.4, 23.2, 1, undefined, 1.7);
  k.cyl(25.6, 18.4, 0.85, 0.7, conc, 1.2);
  k.prop(P.bush(), 25.6, 18.4, 2, undefined, 1.7);
  door(30, 13.6, "w", "store", 1.2);
  door(30, 26.6, "w", "posters", 1.2);
  door(18, 10, "s", "shutter", 1.2);
  sign("neon_arrow", 30, 5.2, 21, 3.6, 2.4, "w");
  sign("neon_drink", 17, 4.6, 30, 2.4, 3.6, "n");
  tube(4.2, 29.94, 29.8, 29.94, 6.4, PINK);
  tube(29.94, 10.2, 29.94, 29.8, 6.8, CYAN);
  k.label("A", 9, 6, 29.9, 1.3, Math.PI);
  k.label("A", 29.9, 8, 14, 1.2, -Math.PI / 2);
  line([4.4, 7, 10.4], [29.6, 7, 29.6], "lamps", 1);
  lamp(16, 10.6, -Math.PI / 2, GOLD, 60, 1.2);

  // -------------------------------------------------------------------------------------------
  // The arcade hall: the indoor way to A.

  k.box(-14.3, 12.5, 26.6, 3.9, 5, dark, { y: 3.6, tile: 4 });
  doorWall(-27.8, 10, 15, 10.7, 14.3, 7.5, plum);
  for (const x of [-25.4, -24.4, -23.4, -18.6, -17.6, -12, -11, -10]) machine("arcade", x, 10.42, "s");
  machine("vending", -6.2, 10.42, "s");
  machine("vending", -4.9, 10.42, "s");
  k.panel("posters", -21, 0.6, 14.96, 2.6, 2.6, Math.PI);
  k.panel("posters", -8, 0.6, 14.96, 2.6, 2.6, Math.PI, 0xd8c8ff);
  k.panel("neon_bowl", -14.6, 0.9, 14.94, 2, 2, Math.PI, 0xffffff, 1.5);
  k.crate(-16, 14.2, 1.2, 0.2);
  k.prop(P.bench(), -3.6, 14.4, Math.PI, [0.9, 0.5, 0.3]);
  tube(-27.4, 10.06, -1.2, 10.06, 3.3, PINK);
  tube(-27.4, 14.94, -1.2, 14.94, 3.3, CYAN);
  k.light(-15, 2.9, 12.5, 0xff5ac8, 44, 16);
  sign("neon_arrow", -28, 3.6, 12.5, 3, 2, "w");

  // -------------------------------------------------------------------------------------------
  // The middle, the nest at its end, and the two ways off it.

  k.box(17, 0, 6, 1.6, 7, conc, { walk: true, tile: 3 });
  k.ramp(26, 0, 20, 0, 5, 0, 1.6, conc, 8);
  k.box(14, 0, 0.5, 2.7, 7, dark, { tile: 3 });
  k.box(14, 0, 0.7, 0.14, 7.2, iron, { y: 2.7, solid: false });
  for (const z of [-3.2, 3.2]) k.box(14.1, z, 0.3, 2.1, 0.3, iron, { y: 2.7, solid: false });
  k.box(16.8, 0, 6.4, 0.3, 7.4, trim, { y: 4.8, solid: false });
  tube(13.7, -3.5, 13.7, 3.5, 4.86, PINK);
  k.panel("posters", 13.74, 0.2, 0, 2.4, 2.4, -Math.PI / 2);
  k.crate(15.2, 2.6, 1.0, 0.2, 1.6);
  k.prop(P.sandbags(), 15, -1.6, Math.PI / 2, [1.3, 0.5, 0.3], 1.6);
  // Along the street.
  k.crate(-9, 2.3, 1.6, 0.1);
  k.crate(-7.3, 2.6, 1.2, 0.4);
  k.crate(-8.9, 2.4, 1.2, 0.5, 1.6);
  k.prop(P.car(GOLD), -18.5, -2.2, 0.04, [2.2, 0.8, 0.95]);
  k.prop(P.dumpster(), -24.4, 2.7, 0, [1.15, 0.7, 0.65]);
  k.prop(P.barrier(), 0.4, -2.7, 0.08, [1.2, 0.55, 0.36]);
  k.prop(P.trashBags(), -13.2, 3, 0.3, 0.5);
  k.prop(P.hydrant(), -3.2, 3.05, 0, 0.25);
  machine("vending", 10.6, -3.08, "s");
  door(-21, -3.5, "s", "store");
  door(-11.5, -3.5, "s", "shutter");
  door(-3, -3.5, "s", "door");
  door(12.6, -3.5, "s", "door");
  door(-20, 3.5, "n", "shutter");
  door(-9.5, 3.5, "n", "store");
  door(2, 3.5, "n", "posters");
  sign("neon_bowl", -15.6, 4.3, -3.5, 2.4, 2.4, "s");
  sign("neon_drink", -14.6, 4, 3.5, 2, 3, "n");
  sign("neon_arrow", 2.6, 5, 3.5, 3.3, 2.2, "n");
  tube(-27.8, -3.56, -6.2, -3.56, 6.2, CYAN);
  tube(-27.8, 3.56, 7.8, 3.56, 6.6, PINK);
  awning(-21, 3.3, -3.5, 5, 1.4, 0, awn[0]);
  awning(-9.5, 3.3, 3.5, 5, 1.4, Math.PI, awn[1]);
  k.label("B", 9, 5.2, -3.45, 0.8, 0);
  k.label("A", 6.7, 4.9, 3.45, 0.7, Math.PI);
  line([-27.6, 7, -3.3], [-6.4, 7, 3.3], "lamps", 0.8);
  line([-5.6, 7, 3.3], [13.4, 6.4, -3.3], "flags", 0.8);
  lamp(-12, -3, -Math.PI / 2, PINK, 60);
  lamp(6.6, 3.1, Math.PI / 2, CYAN, 55);
  // The short lane to B and the connector to A.
  k.prop(P.dumpster(0x3f518a), 3.2, -9, Math.PI / 2, [1.15, 0.7, 0.65]);
  k.prop(P.trashBags(), 7.2, -12.6, 1, 0.5);
  door(2, -8.2, "e", "posters");
  door(8, -6, "w", "door");
  tube(8.06, -13.8, 8.06, -3.7, 3.4, LIME);
  k.prop(P.barrier(), 9.2, 4.3, 0, [1.2, 0.55, 0.36]);
  door(8, 6.8, "e", "posters");
  tube(13.94, 3.7, 13.94, 9.8, 4.2, GOLD);

  // -------------------------------------------------------------------------------------------
  // Site B: a yard with a loading dock, and the shop beside it.

  k.box(5, -29.5, 22, 1, 3, conc, { walk: true, tile: 3 });
  k.ramp(5, -25.9, 5, -28, 22, 0, 1, conc, 5);
  k.box(5, -28, 22, 0.1, 0.24, glowing(GOLD, 1.2), { y: 0.96, solid: false });
  k.prop(P.car(0xfff3dc, "van"), 11.4, -17.2, 0.14, [2.35, 1.0, 1.0]);
  k.crate(3.2, -23.8, 2.0, 0.08);
  k.crate(5.1, -24.4, 1.2, 0.3);
  k.crate(2.9, -21.9, 1.2, -0.2);
  k.prop(P.bench(), -5.3, -17, Math.PI / 2, [0.9, 0.5, 0.3]);
  k.prop(P.barrier(), -2.2, -23.6, Math.PI / 2 + 0.1, [1.2, 0.55, 0.36]);
  k.prop(P.dumpster(0x7c5c90), 14.6, -15.1, 0, [1.15, 0.7, 0.65]);
  k.prop(P.trashBags(), -4.9, -15, 0.4, 0.5);
  k.prop(P.hydrant(), 9.2, -14.6, 0, 0.25);
  machine("vending", -4.6, -30.56, "s", 1);
  machine("vending", -3.3, -30.56, "s", 1);
  k.crate(12.4, -29.8, 1.2, 0.2, 1);
  k.crate(13.7, -29.6, 1.0, 0.5, 1);
  k.prop(P.forklift(), 6.4, -29.6, 0.3, [1.15, 1.2, 0.65], 1);
  door(1, -31, "s", "shutter", 1);
  door(9.5, -31, "s", "shutter", 1);
  door(-6, -19.6, "e", "door");
  door(11.8, -14, "n", "posters");
  door(-2, -14, "n", "door");
  sign("neon_bowl", 16, 4.2, -22.5, 2.4, 2.4, "w");
  sign("neon_arrow", 4, 6.4, -31, 3.6, 2.4, "s");
  tube(-5.8, -30.94, 15.8, -30.94, 5, CYAN);
  tube(15.94, -30.8, 15.94, -14.2, 6.6, PINK);
  k.label("B", 12, 8, -30.9, 1.3, 0);
  k.label("B", -5.9, 6.4, -18, 1.1, Math.PI / 2);
  line([-5.6, 7, -14.4], [15.6, 7, -30.6], "lamps", 1);
  lamp(15, -27.2, Math.PI, CYAN, 60);
  // The shop: glass doors at both ends, shelves between.
  k.box(21, -22.5, 9.2, 4, 9, dark, { y: 3.6, tile: 4 });
  doorWall(16.2, -27, -18, -25, -20, 7.6, teal);
  doorWall(25.8, -27, -18, -25, -20, 7.6, teal);
  shelves(19.4, -25.2, 2.6);
  shelves(22.6, -19.8, 2.6);
  machine("vending", 24.6, -26.56, "s");
  k.box(21, -22.5, 9.4, 0.08, 0.4, glowing(0xdff4ff, 1.6), { y: 3.5, solid: false });
  k.light(21, 2.9, -22.5, 0xcfeaff, 40, 15);
  tube(16.5, -26.94, 25.5, -26.94, 3.2, LIME);

  // -------------------------------------------------------------------------------------------
  // The flats: the indoor way to B.

  k.box(-17, -24, 21.2, 4.1, 6, dark, { y: 3.4, tile: 4 });
  doorWall(-27.8, -27, -21, -25.8, -22.2, 7.5, conc);
  doorWall(-6.2, -27, -21, -25.8, -22.2, 7.5, conc);
  const lining = (x1: number, z1: number, x2: number, z2: number, h: number, m: THREE.Material) => {
    const alongX = Math.abs(x2 - x1) > Math.abs(z2 - z1);
    k.box((x1 + x2) / 2, (z1 + z2) / 2, alongX ? Math.abs(x2 - x1) : 0.07, h, alongX ? 0.07 : Math.abs(z2 - z1), m, { solid: false, tile: 2.4 });
  };
  lining(-27.6, -26.96, -6.4, -26.96, 3.4, dimTiles);
  lining(-27.6, -21.04, -6.4, -21.04, 3.4, dimTiles);
  for (const x of [-23, -21.9, -20.8, -19.7]) {
    k.box(x, -26.5, 0.9, 1.0, 0.8, pbr(0xe9edf2, 0.2, 0.5));
    const port = new THREE.CircleGeometry(0.28, 16);
    port.translate(x, 0.52, -26.09);
    k.add(glowing(CYAN, 0.9), port, false);
  }
  machine("vending", -9.6, -26.56, "s");
  k.crate(-14.6, -21.8, 1.2, 0.2);
  k.prop(P.bench(), -17.4, -26.5, 0, [0.9, 0.5, 0.3]);
  k.prop(P.trashBags(), -25.8, -21.8, 0.2, 0.5);
  tube(-27.4, -21.1, -6.6, -21.1, 3.1, CYAN);
  k.light(-17, 2.8, -24, 0x8fe6ff, 40, 16);
  sign("neon_drink", -28, 3.3, -24, 1.6, 2.4, "w");

  // -------------------------------------------------------------------------------------------
  // The spawns and the ways round

  k.prop(P.car(0xfff3dc, "van"), -34.8, 5.2, Math.PI / 2, [2.35, 1.0, 1.0]);
  k.prop(P.busStop(PINK), -35.2, -4.6, Math.PI / 2, [1.75, 1.3, 0.7]);
  k.crate(-28.9, -7, 1.6, 0.1);
  k.crate(-29, -5.4, 1.0, 0.5);
  door(-36, 0.6, "e", "store");
  gantry("B", -31.5, -8, 7, true, 0);
  gantry("A", -31.5, 8, 7, true, Math.PI);
  // North passage.
  k.prop(P.dumpster(), -34, -19, Math.PI / 2, [1.15, 0.7, 0.65]);
  k.prop(P.trashBags(), -33.8, -16.6, 0.2, 0.5);
  k.prop(P.barrier(), -29.2, -12.4, Math.PI / 2, [1.2, 0.55, 0.36]);
  machine("vending", -34.56, -24.6, "e");
  door(-35, -12, "e", "posters");
  door(-28, -15, "w", "shutter");
  tube(-34.94, -26.8, -34.94, -8.2, 5.4, PINK);
  // South passage and the street to the ramp.
  k.prop(P.car(0x3f8ad0), -20, 26.3, 0.03, [2.2, 0.8, 0.95]);
  k.prop(P.car(PINK, "pickup"), -11.6, 19.7, Math.PI + 0.05, [2.2, 0.8, 0.95]);
  k.prop(P.dumpster(0x3f518a), -33.4, 26.6, 0.1, [1.15, 0.7, 0.65]);
  k.prop(P.barrier(), -5.6, 26.2, 0.3, [1.2, 0.55, 0.36]);
  k.prop(P.barrier(), -6.4, 20.8, -0.2, [1.2, 0.55, 0.36]);
  for (const [x, z] of [[-8, 23.4], [-8.4, 24.6]]) k.prop(P.cone(), x, z);
  k.prop(P.hydrant(), -27, 18.6, 0, 0.25);
  k.prop(P.busStop(GOLD), -27.6, 27.3, Math.PI, [1.75, 1.3, 0.7]);
  machine("vending", -34.56, 12, "e");
  door(-22, 18, "s", "store");
  door(-13, 18, "s", "shutter");
  door(-16, 28, "n", "store");
  door(-6, 28, "n", "posters");
  door(-35, 22, "e", "door");
  sign("neon_arrow", -24, 5, 28, 3.6, 2.4, "n");
  sign("neon_bowl", -8, 4.6, 18, 2.4, 2.4, "s");
  tube(-34.8, 18.06, -3.2, 18.06, 6.4, CYAN);
  tube(-34.8, 27.94, 3.8, 27.94, 6, PINK);
  k.label("A", -1.5, 6, 20.06, 0.9, 0);
  line([-34.6, 7, 18.4], [-3.4, 7, 27.6], "lamps", 1);
  lamp(-17, 27.4, Math.PI / 2, PINK, 55);
  // Defenders.
  k.prop(P.car(0x3f8ad0), 34.9, -9.4, Math.PI / 2, [2.2, 0.8, 0.95]);
  k.prop(P.busStop(CYAN), 35.3, -5, -Math.PI / 2, [1.75, 1.3, 0.7]);
  k.prop(P.barrier(), 30.6, 4.6, 0, [1.2, 0.55, 0.36]);
  machine("vending", 35.56, 3.6, "w");
  machine("vending", 35.56, 4.9, "w");
  k.prop(P.hydrant(), 26.6, -11.2, 0, 0.25);
  door(36, -9.6, "w", "store");
  door(26, -7.4, "e", "posters");
  door(33, 6, "n", "shutter");
  k.label("A", 31.4, 4.8, 5.95, 0.7, Math.PI);
  k.label("B", 33.8, 5.4, -11.95, 0.8, 0);
  tube(35.94, -11.8, 35.94, 5.8, 6.6, PINK);
  lamp(32.6, -11.4, -Math.PI / 2, CYAN, 55);
  k.prop(P.dumpster(), 31, -22, Math.PI / 2, [1.15, 0.7, 0.65]);
  k.prop(P.trashBags(), 27, -26, 0.5, 0.5);
  k.crate(31.2, -15.4, 1.2, 0.2);
  door(32, -18.5, "w", "door");
  tube(31.94, -26.8, 31.94, -12.2, 5.6, LIME);

  // -------------------------------------------------------------------------------------------
  // Beyond the walls: towers with their windows lit, and signs on the roofs.

  const shell = pbr(0x141a30, 0.1, 0.7);
  const lit = [glowing(0xffd98a, 1.4), glowing(0x9fd8ff, 1.4), glowing(0xff9ad0, 1.4), glowing(0xfff3dc, 1.2)];
  const tower = (x: number, z: number, w: number, d: number, s: Side) => {
    const h = 16 + rnd() * 22;
    k.box(x, z, w, h, d, shell, { solid: false });
    const nx = Math.sin(YAW[s]);
    const nz = Math.cos(YAW[s]);
    const len = nx ? d : w;
    for (let y = 9; y < h - 1.5; y += 2.6) {
      for (let t = -len / 2 + 1; t < len / 2 - 0.6; t += 1.7) {
        if (rnd() < 0.55) continue;
        k.box(x + nx * (w / 2 + 0.04) + (nz ? t : 0), z + nz * (d / 2 + 0.04) + (nx ? t : 0), nx ? 0.06 : 1, 1.3, nz ? 0.06 : 1, pick(lit), { y, solid: false });
      }
    }
    if (rnd() < 0.4) k.box(x, z, 0.14, 4, 0.14, iron, { y: h, solid: false });
  };
  for (let i = 0; i < 12; i++) {
    tower(-42 + i * 7.6, -40 - rnd() * 3, 7, 8, "s");
    tower(-42 + i * 7.6, 40 + rnd() * 3, 7, 8, "n");
  }
  for (let i = 0; i < 10; i++) {
    tower(-45 - rnd() * 3, -34 + i * 7.6, 8, 7, "e");
    tower(45 + rnd() * 3, -34 + i * 7.6, 8, 7, "w");
  }
  // Billboards over the rooftops, so each end of the map has its own light.
  k.box(-1, -33.5, 0.3, 4, 0.3, iron, { y: 10, solid: false });
  k.box(11, -33.5, 0.3, 4, 0.3, iron, { y: 10, solid: false });
  k.panel("posters", 5, 11.2, -33.2, 12, 5, 0, 0xffffff, 0.9);
  k.box(5, -33.4, 12.6, 5.6, 0.2, trim, { y: 10.9, solid: false });
  k.panel("neon_arrow", 17, 10.4, 33.2, 9, 6, Math.PI, 0xffffff, 1.5);
  k.box(17, 33.4, 9.6, 6.6, 0.2, trim, { y: 10.1, solid: false });
  k.panel("neon_drink", 38.2, 9.6, 0, 4, 6, -Math.PI / 2, 0xffffff, 1.5);
  k.box(38.4, 0, 0.2, 6.6, 4.6, trim, { y: 9.3, solid: false });

  return {
    spawns: [LANES.map((z) => ({ x: -31.6, z })), [-10, -7, -4, -1, 2].map((z) => ({ x: 32.6, z }))],
    sites: [{ name: "A", x: 16.6, z: 20, r: 5.2 }, { name: "B", x: 6.4, z: -20.6, r: 5.2 }],
    routes: {
      A: [
        [{ x: -31.5, z: 13 }, { x: -22, z: 23 }, { x: -7, z: 23.5 }, { x: 2, z: 23.5 }],
        [{ x: -31.5, z: 12.5 }, { x: -20, z: 12.5 }, { x: -4, z: 12.5 }, { x: 3, z: 12.5 }],
        [{ x: -14, z: 0 }, { x: 6, z: 0 }, { x: 11, z: 2 }, { x: 11, z: 9 }],
        [{ x: -14, z: 0 }, { x: 6, z: 0 }, { x: 11, z: 2 }, { x: 11, z: 9 }],
      ],
      B: [
        [{ x: -31.5, z: -14 }, { x: -31.5, z: -24 }, { x: -20, z: -24 }, { x: -8, z: -24 }],
        [{ x: -31.5, z: -14 }, { x: -31.5, z: -24 }, { x: -20, z: -24 }, { x: -8, z: -24 }],
        [{ x: -14, z: 0 }, { x: 5, z: -1 }, { x: 5, z: -12 }],
        [{ x: -14, z: 0 }, { x: 5, z: -1 }, { x: 5, z: -12 }],
      ],
    },
    posts: {
      A: [{ x: 16, z: 18 }, { x: 8.4, z: 26.6 }, { x: 7.4, z: 14.6 }, { x: 12.4, z: 12.4 }, { x: 26.6, z: 16.4 }, { x: 17, z: 0 }],
      B: [{ x: 7.6, z: -21 }, { x: -2.6, z: -19 }, { x: 5, z: -16.2 }, { x: 13.4, z: -22.5 }, { x: 9, z: -29.6 }, { x: 17, z: 0 }],
    },
    env: 0.28,
  };
}
