/**
 * Summit: a mountain village at dusk, under snow.
 *
 * Attackers start in the south-west. North of them the lane everyone calls the banana bends round
 * to site B: long, exposed, with a car and a log pile to work up behind. East of them the main
 * street runs to a crossroads; from there it is a short walk onto site A, or up through the
 * apartments — indoors, a storey up — to a balcony that looks down on A. A back lane behind the
 * houses joins the banana's foot to the crossroads and to an alley that comes out at B's side door.
 *
 * Site B is a yard with a covered porch along the back. Site A is a square with a raised terrace in
 * one corner. Defenders start in the north-east, between the two.
 */

import * as THREE from "three";
import type { Kit, MapSpec } from "./map";
import { pbr } from "./models";
import * as P from "./props";
import { town } from "./town";

export function summit(k: Kit): MapSpec {
  const snow = k.tex("snow", 0xeef3ff);
  const white = k.tex("snow");
  const ice = k.tex("icepath");
  const flags = k.tex("paving", 0xc9d4e8);
  const logs = k.tex("logs");
  const darkLogs = k.tex("logs", 0xa98463);
  const stone = k.tex("fieldstone");
  const paleStone = k.tex("fieldstone", 0xdde5f2);
  const sidingW = k.tex("siding", 0xf2ead8);
  const sidingR = k.tex("siding", 0xd2584a);
  const sidingB = k.tex("siding", 0x5f8fd2);
  const sidingG = k.tex("siding", 0x6aa97a);
  const sidingY = k.tex("siding", 0xf0c264);
  const slate = k.tex("snowroof");
  const floor = k.tex("planks", 0x9a7352);
  const planks = k.tex("planks", 0xb98a5e);
  const beam = pbr(0x5a3a22, 0, 0.9);
  const iron = pbr(0x2a2d36, 0.3, 0.6);
  const bulb = pbr(0xffe6ae, 0, 0.3, 0xffc060);
  const warm = 0xffb86a;
  const awn = [k.tex("awning", 0xffb0a8), k.tex("awning", 0x9fd0ff), k.tex("awning", 0xa8f0c0)];
  const { rnd, pick, awning, line, block, door, planter, leaf } = town(k, {
    seed: 20261008, trim: white, roof: slate, beam, iron, bulb, awnings: awn,
    cloth: [0xff5a4a, 0x2fb7c9, 0xffc93a, 0x7fd44a, 0xffffff],
    window: ["chaletwindow", 1.95, 1.95, -0.2], screen: ["chaletwindow", 1.6, 1.6], screenAwning: 0, lit: 0.85,
    doors: { door: ["chaletdoor", 1.5, 2.25], shop: ["skishop", 2.7, 2.7], map: ["trailmap", 1.9, 1.9, 0.8] },
    leaf: planks, tub: paleStone, tree: () => P.pine(4.6), lamp: warm,
  });

  k.sky("#141f4d", "#5b57a6", "#ffb48c", 0xcbbfe8);
  k.sun(0xffb98a, 1.9, -52, 30, 26, 0xb4c6ff, 0x8f96bb, 0.95);
  k.scene.fog = new THREE.Fog(0xb7b3da, 60, 280);
  k.ground(snow, 7);

  /** Snow blown up against the foot of a wall. */
  const drift = (x: number, z: number, r: number, y = 0) => {
    const g = new THREE.SphereGeometry(r, 12, 8);
    g.scale(1, 0.34, 0.8 + rnd() * 0.5);
    g.rotateY(rnd() * 3);
    g.translate(x, y - r * 0.06, z);
    k.add(white, g);
  };
  /** A street lamp that really lights the snow under it. */
  const lamp = (x: number, z: number, yaw: number, power = 46) => {
    k.prop(P.lampPost(0xffe2a0, 5), x, z, yaw, 0.2);
    if (power) k.light(x + Math.cos(yaw) * 0.9, 4.4, z - Math.sin(yaw) * 0.9, warm, power, 22);
  };
  /** A car that has stood out all night. */
  const snowedCar = (x: number, z: number, yaw: number, color: number, kind: "sedan" | "pickup" | "van" = "sedan") => {
    k.prop(P.car(color, kind), x, z, yaw, kind === "van" ? [2.35, 1.0, 1.0] : [2.2, 0.8, 0.95]);
    k.box(x, z, kind === "van" ? 4.3 : 2.2, 0.16, 1.6, white, { y: kind === "van" ? 2.0 : 1.62, yaw, solid: false });
  };

  // -------------------------------------------------------------------------------------------
  // The ground: paths trodden through the snow, and paving where the squares are swept.

  k.slab(-17, 8.5, 22, 4.6, ice, 5, 0.03);
  k.slab(-1.5, 8, 9, 11, ice, 5, 0.035);
  k.slab(8.5, 8.5, 11, 6, ice, 5, 0.03);
  k.slab(-31.5, -13, 4.6, 30, ice, 5, 0.03);
  k.slab(-15, -25.5, 23, 5, ice, 5, 0.035);
  k.slab(-1.75, -5, 3.4, 14, ice, 5, 0.04);
  k.slab(-16, -4, 24, 2.8, ice, 5, 0.03);
  k.slab(20, -17.5, 8, 5.4, ice, 5, 0.03);
  k.slab(-32, 10, 6, 14, ice, 5, 0.04);
  k.slab(27, 2, 5, 4.4, ice, 5, 0.03);
  k.slab(6, -21.5, 20, 19, flags, 4, 0.045);
  k.slab(23, 16, 18, 24, flags, 4, 0.045);
  k.slab(30, -10, 12, 20, flags, 4, 0.04);

  // -------------------------------------------------------------------------------------------
  // The village: stone below, timber above, snow on every roof.

  block(-38, -33, -35, 2, 7, { wall: stone, faces: "e", beams: true });
  block(-38, 2, -36, 33, 7.6, { wall: logs, band: stone, faces: "e", shutters: true });
  block(-35, -33, -26, -28, 6.6, { wall: sidingR, band: stone, faces: "s" });
  block(-26, -33, -4, -30, 7.6, { wall: logs, band: stone, faces: "s", shutters: true, beams: true });
  block(-4, -33, 16, -31, 8.6, { wall: stone, faces: "s", lift: 0.9, beams: true });
  block(16, -33, 24, -22, 7.6, { wall: sidingB, band: stone, faces: "sw" });
  block(24, -33, 38, -20, 9, { wall: logs, band: stone, faces: "s", shutters: true, beams: true });
  block(36, -20, 38, 33, 7.6, { wall: sidingY, band: stone, faces: "w" });
  block(32, 4, 36, 28, 8.2, { wall: stone, faces: "w", beams: true });
  block(30, 0, 36, 4, 6.6, { wall: logs, band: stone, faces: "ns", shutters: true });
  block(14, 28, 36, 33, 8, { wall: sidingR, band: stone, faces: "n" });
  block(9, 25, 14, 33, 7.2, { wall: logs, faces: "n", lift: 1.6 });
  block(-19, 23, 9, 33, 7.6, { wall: sidingW, band: stone });
  block(-28, 12, -19, 33, 7.6, { wall: logs, band: stone, faces: "n", shutters: true, beams: true });
  block(-36, 18, -28, 33, 7, { wall: sidingG, band: stone, faces: "n" });
  block(-15, 12, -6, 18, 7.6, { wall: sidingY, band: stone, faces: "n" });
  block(-6, 14, 3, 18, 7.6, { wall: stone, faces: "n", beams: true });
  block(3, 13, 9, 18, 7.6, { wall: stone, faces: "n" });
  block(0.5, -12, 16, 2, 8, { wall: logs, band: stone, faces: "nw", shutters: true, beams: true });
  block(3, 2, 24, 4, 6.8, { wall: sidingB, band: stone, faces: "s" });
  block(16, -13, 24, 2, 7.6, { wall: sidingR, band: stone, faces: "ne" });
  block(-26, -21, -4, -10, 7.6, { wall: stone, faces: "nwe", beams: true });
  block(-28, -10, -4, -6, 6.8, { wall: logs, band: stone, faces: "wse", shutters: true });
  block(-28, -2, -6, 5, 7, { wall: sidingG, band: stone, faces: "nsw" });
  block(-6, -2, -4, 2, 7, { wall: stone, faces: "se" });

  // -------------------------------------------------------------------------------------------
  // The apartments: up a flight of stairs off the main street, along a corridor, out onto a balcony over A.

  k.ramp(-17, 12, -17, 18, 4, 0, 1.6, floor, 8);
  k.box(-5, 20.5, 28, 1.6, 5, floor, { walk: true, tile: 3 });
  k.box(11.5, 21, 5, 1.6, 8, floor, { walk: true, tile: 3 });
  k.ramp(11.5, 13, 11.5, 17, 5, 0, 1.6, floor, 8);
  // Their roof, and the roof over the stairs.
  k.box(-5, 20.5, 28, 2.8, 5, darkLogs, { y: 4.8, tile: 4 });
  k.box(-17, 15.3, 4, 2.8, 5.4, darkLogs, { y: 4.8, tile: 4 });
  k.box(-5, 20.5, 28.4, 0.32, 5.4, white, { y: 7.6, solid: false });
  k.arch(-19, 12.3, -15, 12.3, 7.6, logs, 2, 3, 3.3, 0.6, 4);
  // Lined in timber, so the lamps have something to warm.
  const lining = (x1: number, z1: number, x2: number, z2: number, y: number, h: number) => {
    const alongX = Math.abs(x2 - x1) > Math.abs(z2 - z1);
    k.box((x1 + x2) / 2, (z1 + z2) / 2, alongX ? Math.abs(x2 - x1) : 0.07, h, alongX ? 0.07 : Math.abs(z2 - z1), darkLogs, { y, solid: false, tile: 3 });
  };
  lining(-19, 18.04, 9, 18.04, 1.6, 3.2);
  lining(-19, 22.96, 9, 22.96, 1.6, 3.2);
  lining(-18.96, 12.6, -18.96, 23, 0, 4.8);
  lining(-15.04, 12.6, -15.04, 18, 0, 4.8);
  // The balcony: a rail to shoot over and to vault, a roof on posts.
  k.box(14, 21, 0.4, 2.65, 8, logs, { tile: 3 });
  k.box(14, 15, 0.4, 2.65, 4, logs, { tile: 3 });
  k.box(14, 19, 0.56, 0.14, 12, white, { y: 2.65, solid: false });
  for (const z of [17.3, 24.7]) k.box(13.8, z, 0.3, 2.2, 0.3, beam, { y: 2.65, solid: false });
  k.box(11.4, 21, 5.8, 0.3, 8.6, slate, { y: 4.85, solid: false, tile: 2 });
  for (const x of [8.96]) for (const z of [18.1, 22.9]) k.box(x, z, 0.3, 3.2, 0.3, beam, { y: 1.6, solid: false });
  // Inside: things left in a corridor.
  k.crate(-12, 22.2, 1.2, 0.2, 1.6);
  k.crate(-2.5, 18.9, 1.2, 0.1, 1.6);
  k.crate(-1.3, 18.8, 0.9, 0.5, 1.6);
  k.prop(P.barrel(0x8a5ad0), 5.6, 22.3, 0, 0.45, 1.6);
  k.prop(P.skiRack(), -7.5, 18.4, 0, [0.9, 0.9, 0.2], 1.6);
  k.prop(P.bench(), 2.6, 22.6, Math.PI, [0.9, 0.5, 0.3], 1.6);
  k.panel("rug", -15, 2.5, 22.9, 1.4, 2.1, Math.PI);
  k.panel("trailmap", 1, 2.6, 18.1, 1.7, 1.7, 0);
  for (const x of [-11, 3]) {
    k.prop(P.lantern(), x, 20.5, 0, undefined, 4.8);
    k.light(x, 4.0, 20.5, warm, 30, 13);
  }
  k.crate(12.9, 24.1, 1.0, 0.2, 1.6);
  door(11.5, 25, "n", "door", 1.6);

  // -------------------------------------------------------------------------------------------
  // Site A: a swept square with a terrace in the corner.

  k.box(28.5, 24.5, 7, 0.9, 7, flags, { walk: true, tile: 4 });
  k.ramp(28.5, 19.1, 28.5, 21, 7, 0, 0.9, paleStone, 5);
  k.box(25, 24.5, 0.5, 1.9, 7, stone, { tile: 2 });
  k.box(25, 24.5, 0.7, 0.16, 7.2, white, { y: 1.9, solid: false });
  // A ski hire hut under the balcony: something solid to come round.
  block(14.2, 23.2, 19, 27.6, 4.2, { wall: sidingR, band: stone });
  door(19, 25.4, "e", "shop");
  // The gateway from the defenders' side.
  k.arch(24, 2, 30, 2, 6.6, paleStone, 3, 4.4, 3.8, 0.7, 4);
  k.box(27, 2, 6.2, 0.3, 1, white, { y: 6.6, solid: false });
  // What stands on the site.
  k.crate(24.8, 17.4, 1.6, 0.1);
  k.crate(26.5, 18.0, 1.2, 0.5);
  k.crate(24.9, 17.5, 1.2, 0.6, 1.6);
  k.crate(21.4, 12.6, 1.0, 0.3);
  k.prop(P.snowman(), 19.6, 9.2, -0.6, 0.5);
  k.prop(P.logPile(), 17.6, 5.6, 0.04, [1.2, 0.65, 0.9]);
  k.prop(P.truck(0x5f8fd2, 0xf2ead8), 30.4, 12.6, Math.PI / 2, [3.8, 1.7, 1.25]);
  k.box(30.4, 13.7, 2.3, 0.18, 5.2, white, { y: 3.3, solid: false });
  k.prop(P.barrel(0xd2584a), 15.2, 14.6, 0, 0.45);
  k.prop(P.barrel(0xd2584a), 15.4, 15.7, 1, 0.45);
  k.prop(P.sandbags(), 21.6, 26.9, 0, [1.3, 0.5, 0.3]);
  k.crate(30.6, 26.6, 1.2, 0.2, 0.9);
  k.prop(P.bench(), 28.4, 27.5, Math.PI, [0.9, 0.5, 0.3], 0.9);
  planter(26.3, 22.4, 0.9);
  k.prop(P.pine(6.4), 30.8, 6.4, 1, 0.35);
  k.prop(P.skiRack(), 22, 4.5, 0, [0.9, 0.9, 0.2]);
  door(32, 16, "w", "shop");
  door(32, 23.6, "w", "door", 0.9);
  door(18, 28, "n", "door");
  door(27, 28, "n", "map", 0.9);
  door(19, 4, "s", "door");
  k.label("A", 23, 6.7, 27.9, 1.4, Math.PI);
  k.label("A", 31.9, 6.7, 18, 1.3, -Math.PI / 2);
  line([14.4, 6.4, 4.4], [31.8, 6.4, 27.6], "lamps", 0.9);
  line([14.4, 6.2, 27.6], [31.8, 6.6, 4.4], "flags", 0.9);
  lamp(14.6, 4.7, -Math.PI / 4, 50);
  for (const [x, z, r] of [[31.2, 27.2, 1.5], [14.9, 12.2, 1.2], [20.4, 27.3, 1.3], [31.3, 5.2, 1.4], [16, 4.9, 1.2]]) drift(x, z, r, z > 20 && x > 25 ? 0.9 : 0);

  // -------------------------------------------------------------------------------------------
  // Site B: a yard with a covered porch along the back.

  k.box(6, -29.3, 20, 0.9, 3.4, flags, { walk: true, tile: 4 });
  k.ramp(6, -25.7, 6, -27.6, 20, 0, 0.9, paleStone, 5);
  for (const x of [-3.5, 1.3, 6, 10.7, 15.5]) {
    k.box(x, -27.9, 0.42, 3.3, 0.42, darkLogs, { y: 0.9, tile: 2 });
    k.box(x, -27.9, 0.6, 0.5, 0.6, stone, { y: 0.9, solid: false, tile: 1.5 });
  }
  k.box(6, -27.9, 20.2, 0.3, 0.34, beam, { y: 4.2, solid: false });
  k.box(6, -29.4, 20.6, 0.3, 4, slate, { y: 4.5, solid: false, tile: 2 });
  k.prop(P.fountain(paleStone), 11.6, -16.6, 0, 2.3);
  k.crate(1.8, -22.4, 2.0, 0.1);
  k.crate(3.7, -22.9, 1.2, 0.4);
  for (const z of [-25.3, -23.6, -21.9]) k.box(12.4, z, 2.2, 0.95, 1.1, k.tex("crate", 0xd8c0a0), { yaw: 0.04, tile: 1.1 });
  k.prop(P.logPile(), 4.6, -13.2, 0.02, [1.2, 0.65, 0.9]);
  k.prop(P.sandbags(), -1.4, -18.4, Math.PI / 2, [1.3, 0.5, 0.3]);
  k.prop(P.snowman(0x2fb7c9), 8.6, -13.1, 3.1, 0.5);
  k.crate(-2.8, -29.6, 1.2, 0.2, 0.9);
  k.prop(P.skiRack(), 8.6, -30.5, 0, [0.9, 0.9, 0.2], 0.9);
  k.prop(P.barrel(0xf0c264), 14.6, -30, 0, 0.45, 0.9);
  k.prop(P.bench(), 2.4, -30.4, 0, [0.9, 0.5, 0.3], 0.9);
  planter(1.4, -14.4);
  door(16, -27, "w", "door", 0.9);
  door(5, -12, "n", "shop");
  door(11.5, -12, "n", "door");
  door(-4, -15.6, "e", "map", 0.8);
  k.label("B", 6, 7, -30.9, 1.4, 0);
  k.label("B", 15.9, 6.4, -26.4, 1.2, -Math.PI / 2);
  line([-3.8, 6.4, -12.4], [15.8, 6.6, -27.4], "lamps", 0.9);
  line([-3.8, 6.2, -27.4], [15.8, 6.2, -12.4], "flags", 0.9);
  lamp(-3.2, -13, Math.PI / 4, 50);
  for (const [x, z, r] of [[15.2, -22.6, 1.3], [-3.2, -20.6, 1.2], [8, -12.6, 1.4], [0.6, -12.7, 1.1]]) drift(x, z, r);

  // -------------------------------------------------------------------------------------------
  // The banana

  snowedCar(-21.6, -23.4, 0.12, 0xd2584a);
  k.prop(P.logPile(), -33.4, -17.6, Math.PI / 2, [1.2, 0.65, 0.9]);
  k.box(-15.5, -26.6, 4.4, 1.2, 0.5, stone, { tile: 2 });
  k.box(-15.5, -26.6, 4.6, 0.16, 0.7, white, { y: 1.2, solid: false });
  k.prop(P.sandbags(), -7.2, -28.6, 0.1, [1.3, 0.5, 0.3]);
  k.prop(P.barrel(0x5f8fd2), -11.6, -21.9, 0, 0.45);
  k.prop(P.barrel(0x5f8fd2), -10.6, -22.1, 1, 0.45);
  k.crate(-27.2, -26.8, 1.6, 0.2);
  k.crate(-27.3, -25.2, 1.0, 0.5);
  k.prop(P.pine(6.6), -33.6, -26.4, 0, 0.35);
  k.prop(P.snowman(0xffc93a), -27.4, -12.4, 1, 0.5);
  k.prop(P.bench(), -34.3, -6.5, Math.PI / 2, [0.9, 0.5, 0.3]);
  k.prop(P.skiRack(), -28.4, -8, -Math.PI / 2, [0.9, 0.9, 0.2]);
  door(-35, -20, "e", "door");
  door(-35, -4, "e", "shop");
  door(-30.5, -28, "s", "door");
  door(-18, -30, "s", "shop");
  door(-9, -30, "s", "door");
  door(-13, -21, "n", "door");
  door(-26, -15, "w", "map", 0.8);
  k.label("B", -24, 5, -20.95, 0.9, Math.PI);
  line([-34.8, 6, -27.6], [-26.2, 6, -10.4], "lamps", 0.8);
  line([-25.6, 6.2, -29.8], [-4.4, 6.2, -21.2], "flags", 0.8);
  lamp(-34.4, -11.5, 0);
  lamp(-12, -29.4, -Math.PI / 2, 0);
  for (const [x, z, r] of [[-34.2, -22.4, 1.4], [-26.6, -19, 1.2], [-20, -29.2, 1.5], [-6, -21.8, 1.2], [-34.2, 0.8, 1.2]]) drift(x, z, r);

  // -------------------------------------------------------------------------------------------
  // The main street, the crossroads and the back lanes

  k.prop(P.stall(awn[0], [0xff7a1a, 0xffd21a, 0xd2584a, 0xffffff, 0xff7a1a, 0xffd21a, 0xd2584a, 0xffffff]), -23.5, 5.8, 0, [1.5, 1.3, 0.55]);
  k.prop(P.logPile(), -9.4, 10.9, 0, [1.2, 0.65, 0.9]);
  k.prop(P.snowman(), -13.4, 5.9, 0.6, 0.5);
  k.prop(P.barrel(0x6aa97a), -26.6, 11.2, 0, 0.45);
  k.crate(-0.4, 12.8, 1.6, 0.1);
  k.crate(1.3, 12.9, 1.2, 0.4);
  k.crate(-5, 3.2, 1.2, 0.2);
  planter(-4.6, 9.6);
  k.prop(P.bench(), 8.6, 4.6, 0, [0.9, 0.5, 0.3]);
  k.prop(P.barrel(0xd2584a), 4.2, 12.3, 0, 0.45);
  door(-24, 12, "n", "door");
  door(-10.5, 12, "n", "shop");
  door(-22, 5, "s", "door");
  door(-14, 5, "s", "map", 0.8);
  door(-8.8, 5, "s", "door");
  door(-1.5, 14, "n", "shop");
  door(7, 4, "s", "shop");
  door(6, 13, "n", "door");
  k.label("A", 2.95, 5, 3, 0.7, -Math.PI / 2);
  k.label("A", -17, 5.3, 11.95, 0.8, Math.PI);
  k.label("B", -5, 5, 2.05, 0.7, 0);
  line([-27.6, 6, 5.2], [-6.4, 6, 11.8], "lamps", 0.8);
  line([-27.6, 6.2, 11.8], [-6.4, 6.2, 5.2], "flags", 0.8);
  line([-5.6, 6.2, 2.4], [2.6, 6.2, 13.6], "lamps", 0.6);
  lamp(-19.6, 5.6, -Math.PI / 2);
  lamp(2.4, 4.6, Math.PI);
  for (const [x, z, r] of [[-27.2, 5.6, 1.2], [-7, 11.4, 1.3], [2.3, 13.3, 1.1], [12.6, 4.7, 1.3], [-5.3, 13.2, 1.2]]) drift(x, z, r);
  // The back lane and the alley to B's side door.
  k.crate(-20, -5.2, 1.2, 0.2);
  k.prop(P.barrel(0xf0c264), -10.4, -2.5, 0, 0.45);
  k.prop(P.trashBags(), -6.2, -5.3, 0.4, 0.5);
  k.crate(-0.4, -8.6, 1.0, 0.3);
  door(-16, -6, "s", "door");
  door(-12, -2, "n", "door");
  door(0.5, -4, "w", "door");
  line([-27.4, 5.4, -5.8], [-4.4, 5.4, -2.2], "wash", 0.5);

  // -------------------------------------------------------------------------------------------
  // The two spawns

  k.prop(P.truck(0xd2584a, 0xf2ead8), -32, 16.6, 0.02, [3.8, 1.7, 1.25]);
  k.box(-33.1, 16.6, 5.2, 0.18, 2.3, white, { y: 3.3, yaw: 0.02, solid: false });
  k.crate(-28.9, 3.3, 1.6, 0.1);
  k.crate(-29, 4.9, 1.0, 0.5);
  k.prop(P.pine(6.2), -35, 3.2, 2, 0.35);
  k.prop(P.skiRack(), -35.6, 9.5, Math.PI / 2, [0.9, 0.9, 0.2]);
  door(-36, 12.4, "e", "shop");
  door(-36, 6, "e", "door");
  door(-32, 18, "n", "map", 0.8);
  k.label("A", -28.05, 5.3, 3.5, 0.8, -Math.PI / 2);
  // A gate on the way north, with the sign for B over it.
  k.arch(-35, 2, -28, 2, 5.8, paleStone, 3.5, 4.6, 4, 0.6, 4);
  k.box(-31.5, 2, 7.2, 0.3, 0.9, white, { y: 5.8, solid: false });
  k.label("B", -31.5, 4.95, 2.35, 0.7, 0);
  line([-35.8, 6, 2.4], [-28.2, 6, 17.6], "lamps", 0.8);
  // Defenders.
  snowedCar(34.2, -3.6, Math.PI / 2 + 0.06, 0xf0c264, "pickup");
  k.crate(25.2, -18.6, 1.6, 0.1);
  k.crate(26.9, -18.9, 1.2, 0.4);
  k.prop(P.pine(6.6), 34.6, -18.2, 3, 0.35);
  k.prop(P.pine(5.6), 25.4, -1.4, 1, 0.35);
  k.prop(P.bench(), 30, -19.4, 0, [0.9, 0.5, 0.3]);
  k.prop(P.barrel(0x23262d), 31.6, -9.4, 0, 0.45);
  k.cyl(31.6, -9.4, 0.3, 0.1, pbr(0xffb24a, 0, 0.3, 0xff7a1a), 1.16, false);
  k.light(31.6, 2, -9.4, 0xff9a4a, 34, 14);
  door(36, -14, "w", "shop");
  door(36, -7, "w", "door");
  door(29, -20, "s", "door");
  door(33.4, 0, "n", "map", 0.8);
  k.label("A", 27, 5.2, 1.6, 0.8, Math.PI);
  k.label("B", 24.05, 5.4, -11.5, 0.8, Math.PI / 2);
  line([24.4, 6.2, -19.6], [35.8, 6.2, -0.4], "lamps", 0.8);
  line([16.4, 6, -21.6], [23.6, 6, -13.4], "flags", 0.6);
  k.prop(P.barrel(0x5f8fd2), 17.2, -14, 0, 0.45);
  k.crate(22.6, -21, 1.2, 0.2);
  for (const [x, z, r] of [[35.2, -1.2, 1.3], [24.8, -9, 1.2], [35.2, -12, 1.2], [-35.2, 17.2, 1.3]]) drift(x, z, r);

  // -------------------------------------------------------------------------------------------
  // Beyond the walls: more roofs, pines, a cable car across the sky and the mountains.

  const far = [logs, sidingR, sidingB, sidingW, stone, sidingG, sidingY, darkLogs];
  for (let i = 0; i < 13; i++) {
    for (const s of [-1, 1]) {
      const h = 8 + rnd() * 6;
      k.box(-42 + i * 7, s * (38.5 + rnd() * 2), 6.4, h, 7, pick(far), { solid: false, tile: 4 });
      k.box(-42 + i * 7, s * 39.5, 7.2, 0.5, 8.2, white, { y: h, solid: false });
    }
  }
  for (let i = 0; i < 11; i++) {
    for (const s of [-1, 1]) {
      const h = 8 + rnd() * 6;
      k.box(s * (43.5 + rnd() * 2), -35 + i * 7, 7, h, 6.4, pick(far), { solid: false, tile: 4 });
      k.box(s * 44.5, -35 + i * 7, 8.2, 0.5, 7.2, white, { y: h, solid: false });
    }
  }
  for (const [x, z] of [[-41, -22], [-40.5, 14], [-12, -37], [12, 37], [41, 22], [41, -12], [-27, 37], [6, -37.5], [40.5, 2], [-20, -37]]) k.prop(P.pine(7 + rnd() * 3), x, z, rnd() * 6, undefined, 4 + rnd() * 3);
  // The cable car.
  const A = new THREE.Vector3(-56, 24, 30);
  const B = new THREE.Vector3(58, 17, -28);
  const cable = new THREE.QuadraticBezierCurve3(A, A.clone().lerp(B, 0.5).setY(17), B);
  k.add(iron, new THREE.TubeGeometry(cable, 30, 0.05, 5), false);
  const yaw = Math.atan2(-(B.z - A.z), B.x - A.x);
  [0.2, 0.46, 0.72].forEach((t, i) => {
    const p = cable.getPoint(t);
    k.prop(P.gondola([0xd2584a, 0xf0c264, 0x5f8fd2][i]), p.x, p.z, yaw, undefined, p.y);
  });
  for (const end of [A, B]) {
    k.box(end.x, end.z, 1.2, end.y + 1, 1.2, iron, { solid: false });
    k.box(end.x, end.z, 5, 0.5, 2.4, iron, { y: end.y + 0.6, yaw, solid: false });
  }
  const rock = new THREE.MeshStandardMaterial({ color: 0x6d7cab, roughness: 1 });
  const cap = new THREE.MeshStandardMaterial({ color: 0xf4f6ff, roughness: 0.9 });
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2 + 0.2;
    const d = 190 + rnd() * 70;
    const R = 70 + rnd() * 45;
    const H = 95 + rnd() * 70;
    const body = new THREE.ConeGeometry(R, H, 7);
    body.rotateY(rnd() * 3);
    body.translate(Math.cos(a) * d, H / 2 - 10, Math.sin(a) * d);
    k.add(rock, body, false);
    const top = new THREE.ConeGeometry(R * 0.5, H * 0.48, 7);
    top.rotateY(rnd() * 3);
    top.translate(Math.cos(a) * d, H - 10 - H * 0.24 + 0.6, Math.sin(a) * d);
    k.add(cap, top, false);
  }

  // Snow, falling all the time: a cloud of flakes that stays round the eye wherever it goes.
  const N = 1500;
  const SPAN = 48;
  const TALL = 24;
  const at = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) at.set([Math.random() * SPAN, Math.random() * TALL, Math.random() * SPAN], i * 3);
  const flakes = new THREE.BufferGeometry();
  flakes.setAttribute("position", new THREE.BufferAttribute(at.slice(), 3));
  const cloud = new THREE.Points(flakes, new THREE.PointsMaterial({ color: 0xffffff, size: 0.085, transparent: true, opacity: 0.9, depthWrite: false, fog: false }));
  cloud.frustumCulled = false;
  k.scene.add(cloud);
  let clock = 0;
  const wrap = (v: number, span: number) => ((v % span) + span) % span;
  const tick = (dt: number, eye: THREE.Vector3) => {
    clock += dt;
    const out = flakes.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < N; i++) {
      const fall = clock * (1.5 + (i % 7) * 0.22);
      const sway = Math.sin(clock * 0.7 + i) * 0.5;
      out.setXYZ(
        i,
        eye.x - SPAN / 2 + wrap(at[i * 3] + sway - eye.x, SPAN),
        eye.y - 6 + wrap(at[i * 3 + 1] - fall - eye.y, TALL),
        eye.z - SPAN / 2 + wrap(at[i * 3 + 2] - eye.z, SPAN),
      );
    }
    out.needsUpdate = true;
  };

  void awning;
  void leaf;
  return {
    spawns: [[4, 6.5, 9, 11.5, 14].map((z) => ({ x: -32, z })), [-17, -14, -11, -8, -5].map((z) => ({ x: 29.5, z }))],
    sites: [{ name: "A", x: 22, z: 15.4, r: 5.2 }, { name: "B", x: 6.4, z: -19.6, r: 5.2 }],
    routes: {
      A: [
        [{ x: -17, z: 8.5 }, { x: -2, z: 8 }, { x: 8, z: 8.5 }],
        [{ x: -17, z: 8.5 }, { x: -2, z: 8 }, { x: 8, z: 8.5 }],
        [{ x: -17, z: 9 }, { x: -17, z: 15 }, { x: -9, z: 20.5 }, { x: 6, z: 20.5 }, { x: 11.5, z: 21 }, { x: 11.5, z: 14.5 }, { x: 11.5, z: 9 }],
        [{ x: -31.5, z: -4 }, { x: -15, z: -4 }, { x: -2, z: -3.6 }, { x: -1.5, z: 6 }, { x: 8, z: 8.5 }],
      ],
      B: [
        [{ x: -31.5, z: -4 }, { x: -30.5, z: -18 }, { x: -23, z: -26.5 }, { x: -9, z: -25 }],
        [{ x: -31.5, z: -4 }, { x: -30.5, z: -18 }, { x: -23, z: -26.5 }, { x: -9, z: -25 }],
        [{ x: -31.5, z: -4 }, { x: -15, z: -4 }, { x: -2, z: -4 }, { x: -2, z: -10.5 }],
        [{ x: -17, z: 8.5 }, { x: -2, z: 7 }, { x: -2, z: -2 }, { x: -2, z: -10.5 }],
      ],
    },
    posts: {
      A: [{ x: 21, z: 13.8 }, { x: 28.5, z: 24.5 }, { x: 17, z: 20 }, { x: 27, z: 7.6 }, { x: 9, z: 8.5 }, { x: 22.5, z: 21.5 }],
      B: [{ x: 6, z: -18 }, { x: 9.5, z: -29.4 }, { x: -1.5, z: -25.5 }, { x: 15, z: -20 }, { x: 20, z: -17.5 }, { x: -1.6, z: -14.4 }],
    },
    env: 0.34,
    tick,
  };
}
