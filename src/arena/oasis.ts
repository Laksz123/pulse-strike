/**
 * Oasis: a desert town laid out the way the classic bomb maps are.
 *
 * Attackers start in the west and have three ways east. The long street runs round the south, through
 * a pair of doors, to a ramp up onto site A. The middle is one straight sightline from their spawn
 * through the mid doors to the defenders; from it a flight of stairs climbs to a catwalk that comes
 * out on A, and past the doors a square leads to B's doors and window. The tunnels run round the north,
 * dark, and open straight into B, with a branch that drops back to the middle.
 *
 * Site A is a platform a storey up, walled in, with three ways onto it. Site B is a walled yard with a
 * raised arcade along its back. Defenders start between the two.
 */

import * as THREE from "three";
import type { Kit, MapSpec } from "./map";
import { pbr } from "./models";
import * as P from "./props";
import { town } from "./town";

const LANES = [-6, -3, 0, 3, 6];

export function oasis(k: Kit): MapSpec {
  const sand = k.tex("sand");
  const dirt = k.tex("dirt");
  const paving = k.tex("paving");
  const cobble = k.tex("cobble");
  const stone = k.tex("sandstone");
  const paleStone = k.tex("sandstone", 0xfff0d6);
  const white = k.tex("stucco");
  const cream = k.tex("stucco", 0xffe2b4);
  const peach = k.tex("stucco", 0xf7c59c);
  const rose = k.tex("stucco", 0xf2a78e);
  const skyBlue = k.tex("stucco", 0xa6dcf0);
  const mint = k.tex("stucco", 0xa9e2c6);
  const ochre = k.tex("adobe");
  const clay = k.tex("adobe", 0xffd6ac);
  const teal = k.tex("stucco", 0x35b3ad);
  const blue = k.tex("stucco", 0x4a98e0);
  const coral = k.tex("stucco", 0xe8755a);
  const sun = k.tex("stucco", 0xf5b942);
  const roofTile = k.tex("rooftile");
  const planks = k.tex("planks");
  const oldWood = k.tex("planks", 0xa07c58);
  const mosaic = k.tex("mosaic");
  // Indoors: the same stone and clay, out of the sun.
  const dimCobble = k.tex("cobble", 0x8f8172);
  const dimStone = k.tex("sandstone", 0x8a7862);
  const dimClay = k.tex("adobe", 0x6e5442);
  const trim = pbr(0xfff3dc, 0, 0.9);
  const beam = pbr(0x6b4526, 0, 0.9);
  const iron = pbr(0x2a2d36, 0.3, 0.6);
  const glow = pbr(0xffd27a, 0, 0.3, 0xffb84a);
  const awn = [k.tex("awning"), k.tex("awning", 0x8fd0ff), k.tex("awning", 0xffe08a), k.tex("awning", 0xa6f0c0)];
  const { rnd, pick, awning, line, shade, block, door, wallLamp, planter, leaf } = town(k, {
    seed: 20261007, trim, roof: roofTile, beam, iron, bulb: glow, awnings: awn,
    cloth: [0xff5a4a, 0x2fb7c9, 0xffc93a, 0x7fd44a, 0xff8a3a, 0x9b6dff, 0xffffff],
    window: ["window", 2, 2, -0.25], screen: ["window2", 1.45, 1.45], screenAwning: 0.45,
    doors: { door: ["door", 1.6, 2.4], door2: ["door2", 1.45, 2.18], shutter: ["shutter", 2.5, 2.5] },
    leaf: planks, tub: paleStone, tree: P.palm, lamp: 0xffc070,
  });

  k.sky("#1b73e0", "#7ac6ff", "#f6e4be", 0xffffff);
  k.sun(0xfff0d2, 2.7, -32, 58, 34, 0xcfe6ff, 0xdcb98a, 1.0);
  k.scene.fog = new THREE.Fog(0xf3e0bb, 75, 310);
  k.ground(sand, 6);

  // -------------------------------------------------------------------------------------------
  // The ground

  k.slab(-3.5, 0, 47, 7, cobble, 4, 0.03);
  k.slab(13.4, -7.25, 13.2, 7.5, paving, 4, 0.04);
  k.slab(28, -0.25, 16, 17.5, paving, 4, 0.035);
  k.slab(11, -21.3, 22, 19.4, paving, 4, 0.03);
  k.slab(3, 25.25, 28, 11.5, dirt, 5, 0.03);
  k.slab(-26.5, 24, 19, 14, dirt, 5, 0.03);
  k.slab(-31.5, 1, 9, 20, dirt, 5, 0.03);
  k.slab(-32.5, 14, 7, 6, dirt, 5, 0.03);
  k.slab(-32.5, -12.5, 7, 7, dirt, 5, 0.03);
  k.slab(-29, -21.5, 14, 11, dirt, 5, 0.03);
  k.slab(-15, -20.5, 14, 5, dimCobble, 4, 0.03);
  k.slab(-4.5, -20.5, 7, 11, dimCobble, 4, 0.03);
  k.slab(-3, -9.25, 4, 11.5, dimCobble, 4, 0.035);
  k.slab(-6.5, -10.5, 3, 3, dimCobble, 4, 0.03);
  k.slab(-14, 23, 6, 4, dimCobble, 4, 0.04);

  // -------------------------------------------------------------------------------------------
  // The town: every wall of every lane is the side of a house.

  // The outer ring.
  block(-38, -33, -22, -27, 7.5, { wall: stone, faces: "s", shutters: true, beams: true });
  block(-38, -27, -36, -9, 6.5, { wall: cream, band: teal, faces: "e", shutters: true });
  block(-38, -9, -36, 11, 7.5, { wall: peach, band: coral, faces: "e", beams: true });
  block(-38, 11, -36, 31, 6.2, { wall: white, band: blue, faces: "e" });
  block(-38, 31, -17, 33, 6.8, { wall: stone, faces: "n", shutters: true });
  block(-17, 31, 11, 33, 7.6, { wall: cream, band: coral, faces: "n", shutters: true, beams: true });
  block(11, 31, 38, 33, 8.2, { wall: paleStone, faces: "n", shutters: true, lift: 1.5 });
  block(36, -9, 38, 10.5, 7, { wall: peach, band: teal, faces: "w" });
  block(36, 10.5, 38, 31, 8.4, { wall: white, band: blue, faces: "w", lift: 1.5 });
  // North: over the tunnels, and behind B.
  block(-22, -33, -8, -23, 7.5, { wall: ochre, faces: "w", shutters: true, beams: true });
  block(-8, -33, 0, -26, 7.5, { wall: ochre });
  block(0, -33, 22, -31, 8.6, { wall: stone, faces: "s", shutters: true, lift: 0.9 });
  block(22, -33, 38, -21, 9.4, { wall: white, band: blue, faces: "w" });
  block(22, -21, 38, -9, 7.6, { wall: ochre, faces: "ws", shutters: true, beams: true });
  // Between the attackers' yard, the tunnels and the middle.
  block(-29, -16, -22, -9, 6.6, { wall: rose, band: cream, faces: "wns" });
  block(-27, -9, -22, -3.5, 6, { wall: stone, faces: "ws", shutters: true, beams: true });
  block(-22, -18, -8, -3.5, 7.2, { wall: cream, band: teal, faces: "s", shutters: true });
  block(-8, -15, -5, -12, 7.2, { wall: cream });
  block(-8, -9, -5, -3.5, 7.2, { wall: cream, band: teal, faces: "s", shutters: true });
  block(-1, -11, 6.8, -3.5, 6.6, { wall: peach, band: coral, faces: "se", beams: true });
  block(20, -11, 22, -9, 6, { wall: stone });
  // Between the middle and the long street.
  block(-29, 11, -17, 17, 6.4, { wall: mint, band: cream, faces: "ws" });
  block(-27, 3.5, -17, 11, 6.8, { wall: stone, faces: "nw", shutters: true, beams: true });
  block(-17, 3.5, -8, 19.5, 7.8, { wall: cream, band: blue, faces: "nsw", shutters: true });
  block(-8, 3.5, 0.5, 19.5, 6.6, { wall: ochre, faces: "nse", shutters: true, beams: true });
  block(-17, 19.5, -11, 21, 6.6, { wall: stone, faces: "we", shutters: true });
  block(-17, 25, -11, 31, 6.6, { wall: stone, faces: "we", shutters: true });
  block(0.5, 12.5, 17, 19.5, 7.4, { wall: peach, band: teal, faces: "s" });
  block(4.5, 3.5, 21, 8.5, 6.8, { wall: stone, faces: "nwe", shutters: true, beams: true });
  block(21, 8.5, 25, 12.5, 6.2, { wall: cream, band: coral, faces: "n", shutters: true });
  block(30, 8.5, 36, 12.5, 6.2, { wall: cream, band: coral, faces: "n", shutters: true });

  // Roofs over the tunnels and the long doors: the houses carry on above.
  k.box(-14.7, -20.5, 13.4, 4, 5, dimClay, { y: 3.5, tile: 4 });
  k.box(-4.5, -20.5, 7, 4, 11, dimClay, { y: 3.5, tile: 4 });
  k.box(-3, -9.55, 4, 3.9, 10.9, dimClay, { y: 3.3, tile: 4 });
  k.box(-6.5, -10.5, 3, 3.9, 3, dimClay, { y: 3.3, tile: 4 });
  k.box(-14, 23, 4.8, 3.1, 4, dimClay, { y: 3.5, tile: 4 });
  // Inside them the walls are lined in shadowed stone, so the lamps have something to light.
  const lining = (x1: number, z1: number, x2: number, z2: number, h = 3.5) => {
    const alongX = Math.abs(x2 - x1) > Math.abs(z2 - z1);
    k.box((x1 + x2) / 2, (z1 + z2) / 2, alongX ? Math.abs(x2 - x1) : 0.07, h, alongX ? 0.07 : Math.abs(z2 - z1), dimStone, { solid: false, tile: 3 });
  };
  lining(-21.4, -22.96, -8, -22.96);
  lining(-21.4, -18.04, -8, -18.04);
  lining(-8, -25.96, -1, -25.96);
  lining(-7.96, -26, -7.96, -23);
  lining(-7.96, -18, -7.96, -15);
  lining(-8, -15.04, -5, -15.04);
  lining(-1.04, -26, -1.04, -23);
  lining(-1.04, -19, -1.04, -4.1, 3.3);
  lining(-4.96, -15, -4.96, -12, 3.3);
  lining(-4.96, -9, -4.96, -4.1, 3.3);
  lining(-8, -11.96, -5, -11.96, 3.3);
  lining(-8, -9.04, -5, -9.04, 3.3);
  lining(-7.96, -12, -7.96, -9, 3.3);
  lining(-16.4, 21.04, -11.6, 21.04);
  lining(-16.4, 24.96, -11.6, 24.96);
  for (const [x, z, w, d, h] of [[-15, -20.5, 14, 5, 7.5], [-4.5, -20.5, 7, 11, 7.5], [-14, 23, 6, 4, 6.6]]) k.box(x, z, w + 0.44, 0.32, d + 0.44, roofTile, { y: h, solid: false, tile: 2 });

  // The mouths of the tunnels, and the gates out of the attackers' yard.
  k.arch(-21.7, -23, -21.7, -18, 7.5, ochre, 2.5, 3.6, 3.3, 0.6, 4);
  k.arch(-0.5, -26, -0.5, -11, 7.5, stone, 5, 4, 3.4, 1, 4);
  k.arch(-5, -3.8, -1, -3.8, 7.2, cream, 2, 3, 3.1, 0.6, 4);
  k.arch(-16.7, 21, -16.7, 25, 6.6, stone, 2, 3.2, 3.2, 0.6, 4);
  k.arch(-11.3, 21, -11.3, 25, 6.6, stone, 2, 3.2, 3.2, 0.6, 4);
  k.arch(-27, -3.5, -27, 3.5, 6.4, paleStone, 3.5, 5.6, 4.5, 0.8, 4);
  k.arch(-36, -9.3, -29, -9.3, 5.6, paleStone, 3.5, 4.4, 3.9, 0.6, 4);
  k.arch(-36, 11.3, -29, 11.3, 5.6, paleStone, 3.5, 4.4, 3.9, 0.6, 4);
  for (const [x, z, w, d, h] of [[-27, 0, 1.2, 7.4, 6.4], [-32.5, -9.3, 7.4, 1, 5.6], [-32.5, 11.3, 7.4, 1, 5.6]]) k.box(x, z, w, 0.3, d, trim, { y: h, solid: false });

  // -------------------------------------------------------------------------------------------
  // Site A: a platform a storey up, with the catwalk and the three ways onto it.

  k.box(26.5, 21.75, 19, 1.5, 18.5, paving, { walk: true, tile: 4 });
  k.box(10.75, 10.5, 20.5, 1.5, 4, paving, { walk: true, tile: 4 });
  k.ramp(2.5, 3.5, 2.5, 8.5, 4, 0, 1.5, paleStone, 8);
  k.ramp(11, 27.15, 17, 27.15, 7.7, 0, 1.5, paving, 0, 4);
  k.ramp(27.5, 7.5, 27.5, 12.5, 5, 0, 1.5, paving, 0, 4);
  // The long ramp's wall, and the parapet over the nook beside it.
  k.box(14, 23, 6, 2.6, 0.6, stone, { tile: 3 });
  k.box(14, 23, 6.2, 0.2, 0.8, trim, { y: 2.6, solid: false });
  k.box(17, 21.25, 0.6, 2.7, 3.5, stone, { tile: 3 });
  k.box(17, 21.25, 0.8, 0.2, 3.7, trim, { y: 2.7, solid: false });
  // A gateway at the top of the defenders' ramp.
  k.arch(25, 12.5, 30, 12.5, 6.2, paleStone, 2.5, 4.4, 5, 0.6, 4);
  k.box(27.5, 12.5, 5.2, 0.3, 0.9, trim, { y: 6.2, solid: false });
  // On the site: the stack to plant behind, and the corners.
  k.crate(28.8, 24.0, 1.6, 0.12, 1.5);
  k.crate(30.5, 24.6, 1.2, 0.5, 1.5);
  k.crate(28.9, 24.1, 1.2, 0.6, 3.1);
  k.crate(27.5, 25.5, 1.0, 0.3, 1.5);
  k.crate(33.6, 28.6, 1.6, 0.1, 1.5);
  k.prop(P.barrel(0x2f7fd0), 35.1, 27.1, 0, 0.45, 1.5);
  k.prop(P.barrel(0xd9483b), 34.6, 30.1, 1, 0.45, 1.5);
  k.crate(22.3, 13.7, 1.2, 0.2, 1.5);
  k.crate(23.2, 14.9, 1.0, 0.7, 1.5);
  k.prop(P.barrel(0xf2b530), 18.1, 24.0, 0, 0.45, 1.5);
  k.prop(P.barrel(0xf2b530), 18.3, 25.1, 2, 0.45, 1.5);
  k.prop(P.sandbags(), 21.4, 29.9, 0.1, [1.3, 0.5, 0.3], 1.5);
  planter(33.4, 18.2, 1.5);
  k.prop(P.bench(), 35.3, 22.5, -Math.PI / 2, [0.9, 0.5, 0.3], 1.5);
  k.prop(P.stall(awn[1], [0xff7a1a, 0xffd21a, 0x8be830, 0xff3d7a, 0xff7a1a, 0x9b4dff, 0xffd21a, 0x8be830]), 33.6, 14.1, 0, [1.5, 1.3, 0.55], 1.5);
  k.prop(P.pot(), 31.2, 13.6, 0, 0.42, 1.5);
  k.prop(P.pot(0xb8623a), 30.4, 14.0, 0, 0.42, 1.5);
  k.prop(P.sacks(), 19.6, 13.6, 0.4, [0.7, 0.4, 0.6], 1.5);
  // The catwalk.
  k.crate(8.2, 9.3, 1.2, 0.15, 1.5);
  k.prop(P.barrel(0x3fa55a), 15.4, 11.9, 0, 0.45, 1.5);
  k.prop(P.barrel(0x3fa55a), 16.3, 11.7, 1, 0.45, 1.5);
  k.prop(P.pot(), 1.2, 12.0, 0, 0.42, 1.5);
  k.panel("rug", 6, 3.2, 12.5, 1.4, 2.1, Math.PI);
  k.panel("rug", 11.5, 3.2, 8.5, 1.4, 2.1, 0, 0xcfe8ff);
  wallLamp(13.5, 4.4, 12.5, "n");
  wallLamp(3.0, 4.4, 8.5 + 4, "n");
  line([0.6, 5.6, 9.2], [20.8, 5.2, 11.8], "flags", 0.5);
  door(10, 12.5, "n", "door2", 1.5);
  door(18.5, 8.5, "s", "door", 1.5);
  door(36, 26, "w", "door", 1.5);
  door(36, 16.5, "w", "shutter", 1.5);
  door(24, 31, "n", "door2", 1.5);
  door(30.5, 31, "n", "shutter", 1.5);
  k.label("A", 26.5, 6.4, 30.9, 1.4, Math.PI);
  k.label("A", 35.9, 6.4, 22, 1.4, -Math.PI / 2);
  line([17.2, 6.4, 13.2], [35.8, 6.4, 30.6], "lamps", 0.9);
  line([17.2, 6.2, 30.6], [35.8, 6.6, 13.2], "flags", 0.8);

  // -------------------------------------------------------------------------------------------
  // Site B: a walled yard with an arcade along the back.

  // Its south wall: a window to climb through and a pair of doors.
  const south = (x1: number, x2: number, y: number, h: number) => k.box((x1 + x2) / 2, -11.3, x2 - x1, h, 0.6, stone, { y, tile: 3 });
  south(0, 8, 0, 6.2);
  south(8, 10.4, 0, 1.1);
  south(8, 10.4, 3.25, 2.95);
  south(10.4, 15.5, 0, 6.2);
  south(15.5, 18.5, 3.3, 2.9);
  south(18.5, 22, 0, 6.2);
  k.box(11, -11.3, 22.2, 0.3, 0.9, trim, { y: 6.2, solid: false });
  k.box(9.2, -11.3, 2.7, 0.14, 0.86, oldWood, { y: 1.1, solid: false });
  k.box(9.2, -11.3, 2.7, 0.16, 0.8, oldWood, { y: 3.12, solid: false });
  for (const x of [7.92, 10.48]) k.box(x, -11.3, 0.16, 2.2, 0.8, oldWood, { y: 1.1, solid: false });
  k.box(17, -11.3, 3.4, 0.24, 0.8, oldWood, { y: 3.2, solid: false });
  leaf(15.5, -11, -1.92);
  leaf(18.5, -11, -1.92);
  k.crate(9.2, -10.4, 1.0, 0, 0);
  k.crate(9.2, -12.3, 1.0, 0.1, 0);
  // The arcade: a step up, pillars and a roof of cloth.
  k.box(11, -29.2, 22, 0.9, 3.6, paving, { walk: true, tile: 4 });
  k.ramp(11, -25.6, 11, -27.4, 22, 0, 0.9, paleStone, 4);
  for (const x of [1.2, 6.6, 12, 17.4, 21.2]) {
    k.box(x, -27.8, 0.5, 3.4, 0.5, paleStone, { y: 0.9, tile: 2 });
    k.box(x, -27.8, 0.7, 0.2, 0.7, trim, { y: 4.1, solid: false });
    k.box(x, -27.8, 0.66, 0.5, 0.66, mosaic, { y: 0.9, solid: false, tile: 1.4 });
  }
  k.box(11, -27.8, 21.6, 0.34, 0.36, beam, { y: 4.3, solid: false });
  for (let i = 0; i < 6; i++) k.box(2.2 + i * 3.55, -29.4, 3.3, 0.06, 3.6, awn[i % 4], { y: 4.45 + (i % 2) * 0.08, solid: false, tile: 3 });
  k.box(11, -30.96, 22, 0.5, 0.1, mosaic, { y: 2.2, solid: false, tile: 1.6 });
  // What stands on the site.
  k.crate(13.8, -21.8, 2.4, 0.08);
  k.crate(15.8, -21.3, 1.2, 0.3);
  k.crate(13.5, -19.9, 1.2, -0.2);
  k.prop(P.car(0x35b3ad, "pickup"), 4.9, -16.2, 0.28, [2.2, 0.8, 0.95]);
  k.prop(P.barrel(0xe8742a), 1.0, -12.6, 0, 0.45);
  k.prop(P.barrel(0xe8742a), 1.9, -13.1, 1, 0.45);
  k.crate(1.2, -14.4, 1.2, 0.2);
  k.crate(20.9, -13.0, 1.6, 0.1);
  k.crate(20.9, -13.0, 1.2, 0.5, 1.6);
  k.crate(21.0, -14.8, 1.2, -0.1);
  k.prop(P.sandbags(), 17.6, -24.2, 0.15, [1.3, 0.5, 0.3]);
  k.prop(P.sandbags(), 6.4, -24.6, -0.2, [1.3, 0.5, 0.3]);
  k.crate(2.2, -29.6, 1.2, 0.2, 0.9);
  k.prop(P.stall(awn[0], [0xff3d7a, 0xffd21a, 0x18cfd6, 0x8be830, 0xff7a1a, 0xffd21a, 0xff3d7a, 0x18cfd6]), 15.2, -30.2, 0, [1.5, 1.3, 0.55], 0.9);
  k.prop(P.pot(), 19.4, -30.2, 0, 0.42, 0.9);
  k.prop(P.pot(0xb8623a), 20.4, -29.8, 0, 0.42, 0.9);
  k.prop(P.sacks(), 8.4, -30.2, 0.3, [0.7, 0.4, 0.6], 0.9);
  planter(20.4, -24.6);
  k.prop(P.cart(), 19.4, -18.8, 1.3, [1.2, 0.7, 0.75]);
  door(22, -17, "w", "door");
  door(22, -27, "w", "shutter", 0.9);
  door(4, -11.6, "n", "door2");
  k.label("B", 11, 6.9, -30.9, 1.5, 0);
  k.label("B", 21.9, 6.4, -22, 1.4, -Math.PI / 2);
  line([0.3, 6.4, -12], [21.8, 6.6, -26.5], "flags", 0.8);
  line([0.3, 6.2, -26.5], [21.8, 6.2, -12], "lamps", 0.9);

  // -------------------------------------------------------------------------------------------
  // The middle

  // The mid doors: a wall across the street with a doorway and two leaves left ajar.
  k.box(6.4, -2.5, 0.8, 5, 2, stone, { tile: 3 });
  k.box(6.4, 2.5, 0.8, 5, 2, stone, { tile: 3 });
  k.box(6.4, 0, 0.8, 1.7, 3, stone, { y: 3.3, tile: 3 });
  k.box(6.4, 0, 1.0, 0.3, 7.2, trim, { y: 5, solid: false });
  k.box(6.4, 0, 0.9, 0.22, 3.1, oldWood, { y: 3.2, solid: false });
  leaf(6.8, -1.5, -0.26);
  leaf(6.8, 1.5, 0.52);
  // Cover on the way up it.
  k.crate(-2.2, 2.5, 1.6, 0.1);
  k.crate(-3.8, 2.7, 1.0, 0.4);
  k.prop(P.barrel(0xd9483b), -21.6, -2.7, 0, 0.45);
  k.prop(P.barrel(0x2f7fd0), -20.7, -2.9, 1, 0.45);
  k.prop(P.sacks(), -22.3, 2.7, 0.2, [0.7, 0.4, 0.6]);
  planter(-10.6, 2.6);
  k.prop(P.cart(), -15.6, -2.5, 0.12, [1.2, 0.7, 0.75]);
  k.prop(P.bench(), 3.4, -3.0, 0, [0.9, 0.5, 0.3]);
  shade(-17, 0, 5, 7.6, 5.6, awn[2]);
  shade(-9.5, 0, 4, 7.6, 5.9, awn[1]);
  line([-25, 5.4, -3.4], [-25, 5.4, 3.4], "flags", 0.4);
  line([-5.6, 6, -3.4], [-5.6, 6, 3.4], "wash", 0.4);
  line([1.2, 6, -3.4], [5.9, 4.9, 3.4], "lamps", 0.5);
  door(-19, -3.5, "s", "shutter");
  door(-13.5, -3.5, "s", "door");
  door(-7, -3.5, "s", "door2");
  door(-23, 3.5, "n", "door2");
  door(-12, 3.5, "n", "shutter");
  door(-4.5, 3.5, "n", "door");
  door(2.6, -3.5, "s", "door");
  k.label("B", -3, 4.7, -3.45, 0.9, 0);
  // A beam over the foot of the stairs, with the sign for A.
  for (const x of [0.75, 4.25]) k.box(x, 3.75, 0.3, 3.5, 0.3, oldWood, { solid: false, tile: 2 });
  k.box(2.5, 3.75, 4, 0.3, 0.34, oldWood, { y: 3.5, solid: false, tile: 2 });
  k.box(2.5, 3.75, 2.1, 1.05, 0.1, oldWood, { y: 3.85, solid: false, tile: 2 });
  k.label("A", 2.5, 4.38, 3.66, 0.9, Math.PI);
  wallLamp(-16, 4.2, -3.5, "s");
  wallLamp(-8.4, 4.2, 3.5, "n");

  // The square past the doors, under B's wall.
  k.prop(P.cart(0xe9d9b0), 12.8, -6.6, 0.5, [1.2, 0.7, 0.75]);
  k.crate(8.1, 2.6, 1.2, 0.2);
  planter(18.6, -4.6);
  k.prop(P.bench(), 13.4, 3.0, Math.PI, [0.9, 0.5, 0.3]);
  k.prop(P.pot(), 7.6, -4.2, 0, 0.42);
  k.prop(P.pot(0xb8623a), 7.5, -5.3, 0, 0.42);
  door(6.8, -7.4, "e", "door");
  door(12, 3.5, "n", "shutter");
  door(17, 3.5, "n", "door2");
  k.panel("rug", 13, 2.4, -11, 1.5, 2.2, 0);
  awning(12, 3.1, 3.5, 3, 1.5, Math.PI, awn[0]);
  line([7, 6, -10.8], [19.8, 6, 3.3], "flags", 0.7);
  k.label("B", 17, 4.5, -10.95, 0.9, 0);

  // -------------------------------------------------------------------------------------------
  // The defenders' square: a pool under palms.

  k.box(20.3, -7.5, 0.6, 4.6, 3, stone, { tile: 3 });
  k.box(20.3, -7.5, 0.8, 0.2, 3.2, trim, { y: 4.6, solid: false });
  k.prop(P.fountain(paleStone), 27.4, -4.6, 0, 2.3);
  k.cyl(27.4, -4.6, 2.36, 0.24, mosaic, 0.3, false);
  k.prop(P.palm(), 23.6, -7.8, 0.4, 0.3);
  k.prop(P.palm(), 31.4, -7.9, 2.2, 0.3);
  k.prop(P.palm(), 34.8, 7.2, 4.1, 0.3);
  k.prop(P.car(0xf5b942, "pickup"), 34.4, 3.4, Math.PI / 2 + 0.08, [2.2, 0.8, 0.95]);
  k.crate(22.2, 6.9, 1.6, 0.1);
  k.crate(22.3, 5.2, 1.2, 0.4);
  k.prop(P.bench(), 30.5, -8.6, 0, [0.9, 0.5, 0.3]);
  k.prop(P.pot(), 24.4, 7.9, 0, 0.42);
  k.prop(P.pot(), 30.7, 7.9, 0, 0.42);
  door(36, -5, "w", "door");
  door(36, 0, "w", "shutter");
  door(26, -9, "s", "door2");
  door(33, -9, "s", "door");
  door(22.4, 8.5, "n", "door");
  door(33, 8.5, "n", "door2");
  k.label("A", 27.5, 5.62, 12.15, 0.55, Math.PI);
  line([20.4, 6, -8.8], [35.8, 6.2, 8.3], "lamps", 0.9);
  line([20.4, 6.2, 8.3], [35.8, 6, -8.8], "flags", 0.9);

  // -------------------------------------------------------------------------------------------
  // The long street

  // The pit: a low wall to drop behind, at the end the doors open on.
  k.box(-8.9, 27.5, 4.2, 1.25, 0.5, stone, { tile: 2 });
  k.box(-8.9, 27.5, 4.4, 0.14, 0.7, trim, { y: 1.25, solid: false });
  k.prop(P.sacks(), -10.2, 30.1, 0.4, [0.7, 0.4, 0.6]);
  leaf(-11, 25, -0.9, 1.6, 3.1);
  leaf(-17, 25, Math.PI - 0.5, 1.6, 3.1);
  k.box(-9.6, 20.5, 1.6, 1.6, 1.6, k.tex("crate", 0x8fc4ff), { yaw: 0.1, tile: 1.6 });
  k.crate(-8.0, 20.3, 1.0, 0.5);
  planter(0.4, 20.5);
  k.prop(P.cart(), -1.6, 29.8, 0.06, [1.2, 0.7, 0.75]);
  k.prop(P.barrel(0x2f7fd0), 3.4, 20.2, 0, 0.45);
  k.prop(P.barrel(0x2f7fd0), 4.3, 20.5, 1, 0.45);
  k.prop(P.car(0xe8755a), 6.4, 29.6, 0.06, [2.2, 0.8, 0.95]);
  k.prop(P.car(0xdfe4ea), 13.8, 21.1, 0.02, [2.2, 0.8, 0.95]);
  k.crate(9.8, 20.5, 1.2, 0.2);
  k.prop(P.stall(awn[2], [0xff7a1a, 0x8be830, 0xffd21a, 0xff3d7a, 0x18cfd6, 0xff7a1a, 0x8be830, 0xffd21a]), -4.6, 20.2, 0, [1.5, 1.3, 0.55]);
  shade(-5, 25.2, 5, 11.6, 5.8, awn[0]);
  shade(4.6, 25.2, 4, 11.6, 6.1, awn[3]);
  line([10.6, 6.2, 19.7], [10.6, 6.2, 30.8], "flags", 0.5);
  line([-0.4, 6.4, 19.7], [-0.4, 6.4, 30.8], "wash", 0.5);
  door(-6, 31, "n", "door");
  door(1, 31, "n", "shutter");
  door(8, 31, "n", "door2");
  door(-7.2, 19.5, "s", "door2");
  door(6.5, 19.5, "s", "shutter");
  k.label("A", 14, 4.4, 19.55, 0.9, 0);
  wallLamp(-11, 4.2, 26.5, "e");
  wallLamp(2.6, 4.2, 19.5, "s");
  k.light(-14, 2.9, 23, 0xffc070, 26, 13);

  // -------------------------------------------------------------------------------------------
  // The attackers' yard and the two ways round

  k.prop(P.car(0x4a98e0, "pickup"), -34.6, 8.2, Math.PI / 2, [2.2, 0.8, 0.95]);
  k.prop(P.stall(awn[0], [0xff7a1a, 0xffd21a, 0x8be830, 0xff3d7a, 0xff7a1a, 0x9b4dff, 0xffd21a, 0x8be830]), -27.9, 7.2, -Math.PI / 2, [1.5, 1.3, 0.55]);
  k.prop(P.barrel(0xf2b530), -35.2, -7.9, 0, 0.45);
  k.prop(P.barrel(0x3fa55a), -34.3, -8.2, 1, 0.45);
  k.crate(-28.1, -7.9, 1.2, 0.3);
  k.prop(P.sacks(), -28.2, -6.3, 1.2, [0.6, 0.4, 0.7]);
  k.prop(P.palm(), -35.2, -2.2, 1.3, 0.3);
  k.prop(P.bench(), -35.5, 3.2, Math.PI / 2, [0.9, 0.5, 0.3]);
  door(-36, 5.6, "e", "door");
  door(-36, -5.2, "e", "shutter");
  door(-27, -6.4, "w", "door2");
  k.label("B", -32.5, 4.7, -8.95, 0.7, 0);
  k.label("A", -32.5, 4.7, 10.95, 0.7, Math.PI);
  line([-35.8, 6.2, -8.6], [-27.2, 6.2, 10.6], "flags", 0.8);
  line([-35.8, 6, 10.6], [-27.2, 6, -8.6], "lamps", 0.8);
  // North: the way to the tunnels.
  k.prop(P.cart(), -34.2, -24.6, 0.3, [1.2, 0.7, 0.75]);
  k.crate(-23.4, -25.6, 1.6, 0.1);
  k.crate(-23.3, -24.0, 1.2, 0.4);
  k.prop(P.barrel(0xd9483b), -35.2, -17.1, 0, 0.45);
  k.prop(P.palm(), -24.6, -17.2, 3, 0.3);
  k.prop(P.stall(awn[3], [0x8be830, 0xffd21a, 0xff3d7a, 0x18cfd6, 0x8be830, 0xff7a1a, 0xffd21a, 0xff3d7a]), -29.5, -26.2, 0, [1.5, 1.3, 0.55]);
  k.prop(P.sacks(), -33.6, -10.4, 0.3, [0.7, 0.4, 0.6]);
  door(-36, -21, "e", "door");
  door(-36, -13, "e", "door2");
  door(-25, -27, "s", "door2");
  door(-29, -12.5, "w", "shutter");
  k.label("B", -21.95, 4.6, -20.5, 0.9, -Math.PI / 2);
  line([-35.8, 6, -26.6], [-22.4, 6.4, -16.4], "wash", 0.9);
  wallLamp(-22, 4.2, -24.6, "w");
  // South: the way to the long doors.
  k.prop(P.truck(0xe8755a, 0xfff3dc), -26, 29.2, 0.03, [3.8, 1.7, 1.25]);
  k.prop(P.well(paleStone, roofTile), -27.4, 21.6, 0.5, 1.2);
  k.crate(-18.3, 18.3, 1.6, 0.1);
  k.crate(-18.4, 19.9, 1.0, 0.5);
  k.prop(P.barrel(0x2f7fd0), -35.2, 30.1, 0, 0.45);
  k.prop(P.barrel(0x2f7fd0), -34.2, 30.3, 1, 0.45);
  k.prop(P.palm(), -35, 18.4, 5, 0.3);
  k.prop(P.sacks(), -33.4, 12.6, 0.7, [0.7, 0.4, 0.6]);
  door(-36, 24, "e", "door");
  door(-36, 14.2, "e", "door2");
  door(-23, 17, "s", "shutter");
  door(-17, 27.6, "w", "door");
  door(-30, 31, "n", "shutter");
  k.label("A", -17.05, 4.6, 23, 0.9, -Math.PI / 2);
  line([-35.8, 6, 17.4], [-17.4, 6, 30.6], "flags", 0.9);
  wallLamp(-17, 4.2, 19.6, "w");

  // -------------------------------------------------------------------------------------------
  // The tunnels: dark, with a lamp at each turn.

  k.crate(-13.4, -22.2, 1.2, 0.1);
  k.crate(-12.2, -22.3, 1.0, 0.5);
  k.prop(P.barrel(0x8a5ad0), -16.4, -18.7, 0, 0.45);
  k.crate(-7.1, -25.1, 1.6, 0.1);
  k.crate(-5.6, -25.3, 1.2, 0.3);
  k.prop(P.sacks(), -7.2, -16.0, 0.2, [0.6, 0.4, 0.6]);
  k.prop(P.barrel(0x8a5ad0), -7.3, -11.3, 0, 0.45);
  for (const [x, y, z] of [[-15, 3.1, -20.5], [-4.5, 3.1, -21], [-3, 2.9, -9.5]]) {
    k.prop(P.lantern(), x, z, 0, undefined, y + 0.4);
    k.light(x, y - 0.5, z, 0xffb060, 42, 15);
  }

  // -------------------------------------------------------------------------------------------
  // Beyond the walls: taller houses, a tower, a dome, and the dunes.

  const far = [stone, cream, peach, white, ochre, rose, clay, skyBlue, sun];
  for (let i = 0; i < 13; i++) {
    const x = -42 + i * 7;
    for (const s of [-1, 1]) {
      const h = 9 + rnd() * 7;
      k.box(x, s * (38.5 + rnd() * 2), 6.4, h, 7, pick(far), { solid: false, tile: 4 });
      k.box(x, s * 39.5, 7, 0.4, 8, rnd() < 0.5 ? roofTile : trim, { y: h, solid: false, tile: 2 });
    }
  }
  for (let i = 0; i < 11; i++) {
    const z = -35 + i * 7;
    for (const s of [-1, 1]) {
      const h = 9 + rnd() * 7;
      k.box(s * (43.5 + rnd() * 2), z, 7, h, 6.4, pick(far), { solid: false, tile: 4 });
      k.box(s * 44.5, z, 8, 0.4, 7, rnd() < 0.5 ? roofTile : trim, { y: h, solid: false, tile: 2 });
    }
  }
  // The clock tower at the end of the middle: wherever you are, it says which way is east.
  k.box(46, 0, 6, 24, 6, paleStone, { solid: false, tile: 4 });
  k.box(46, 0, 7, 0.6, 7, trim, { y: 24, solid: false });
  k.box(46, 0, 6.6, 0.5, 6.6, mosaic, { y: 19, solid: false, tile: 1.6 });
  k.box(46, 0, 4.4, 4, 4.4, white, { y: 24.6, solid: false });
  const spire = new THREE.ConeGeometry(4.2, 6, 4);
  spire.rotateY(Math.PI / 4);
  spire.translate(46, 31.6, 0);
  k.add(roofTile, spire);
  const dial = new THREE.CircleGeometry(1.6, 24);
  dial.rotateY(-Math.PI / 2);
  dial.translate(42.96, 21.5, 0);
  k.add(pbr(0xfff8e8, 0, 0.6), dial, false);
  k.box(42.9, 0, 0.08, 1.2, 0.14, iron, { y: 21.5, solid: false });
  k.box(42.9, 0.42, 0.08, 0.14, 0.9, iron, { y: 21.45, solid: false });
  // A dome behind B.
  const dome = new THREE.SphereGeometry(5.2, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  dome.translate(30, 9.6, -27);
  k.add(skyBlue, dome);
  k.cyl(30, -27, 5.5, 0.5, trim, 9.3, false);
  k.cyl(30, -27, 0.16, 2, sun, 14.6, false);
  // Palms over the rooftops.
  for (const [x, z] of [[-41, -20], [-40, 16], [-10, -36.5], [14, 36.5], [41, 20], [41, -14], [-26, 36.5], [5, -37]]) k.prop(P.palm(), x, z, rnd() * 6, undefined, 3 + rnd() * 3);
  // Dunes on the horizon.
  const dune = new THREE.MeshStandardMaterial({ color: 0xe9c98f, roughness: 1 });
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + 0.3;
    const r = 150 + rnd() * 70;
    const g = new THREE.SphereGeometry(40 + rnd() * 40, 16, 8);
    g.scale(1.6, 0.16 + rnd() * 0.14, 1);
    g.rotateY(rnd() * 3);
    g.translate(Math.cos(a) * r, -2, Math.sin(a) * r);
    k.add(dune, g, false);
  }

  return {
    spawns: [LANES.map((z) => ({ x: -33, z })), LANES.map((z) => ({ x: 31.6, z: z * 0.9 }))],
    sites: [{ name: "A", x: 27, z: 22, r: 5.2 }, { name: "B", x: 10.5, z: -19.4, r: 5.2 }],
    routes: {
      A: [
        [{ x: -32.5, z: 14 }, { x: -24, z: 24.5 }, { x: -14, z: 23 }, { x: 0, z: 25 }, { x: 13, z: 27 }],
        [{ x: -32.5, z: 14 }, { x: -24, z: 24.5 }, { x: -14, z: 23 }, { x: 0, z: 25 }, { x: 13, z: 27 }],
        [{ x: -14, z: 0 }, { x: 2.5, z: 2 }, { x: 2.5, z: 10.5 }, { x: 14, z: 10.5 }],
        [{ x: -14, z: 0 }, { x: 4, z: 0 }, { x: 24, z: 2 }, { x: 27.5, z: 9 }],
      ],
      B: [
        [{ x: -32.5, z: -13 }, { x: -27, z: -20.5 }, { x: -13, z: -20 }, { x: -4, z: -21 }],
        [{ x: -32.5, z: -13 }, { x: -27, z: -20.5 }, { x: -13, z: -20 }, { x: -4, z: -21 }],
        [{ x: -14, z: 0 }, { x: -3, z: -2 }, { x: -3, z: -13 }, { x: -4, z: -21 }],
        [{ x: -14, z: 0 }, { x: 4, z: 0 }, { x: 13, z: -2 }, { x: 17, z: -9 }],
      ],
    },
    posts: {
      A: [{ x: 26, z: 20 }, { x: 20, z: 27 }, { x: 20.5, z: 15.5 }, { x: 31.5, z: 27.5 }, { x: 14, z: -1 }],
      B: [{ x: 9, z: -22.5 }, { x: 10, z: -29.3 }, { x: 4.5, z: -13.4 }, { x: 18.4, z: -15.4 }, { x: 14.5, z: -5 }],
    },
  };
}
