/**
 * What the agents look like. Every agent is the same jointed body — same height, same hitbox,
 * same animation — and its own character: this file builds each one's pieces (pelvis, chest,
 * head, arms, legs) and `rig.ts` joints and animates them.
 *
 * Each agent is a strong, simple idea you can read from across the map: a television on a hoodie,
 * a diver's brass helmet, a cowboy hat and a bandana. Faces are eyes only — they blink and narrow
 * — or a mask, a visor, a screen. Team colour is always on the upper arms and the soles.
 * Faces +Z; the agent's right hand is on -X. Units are metres.
 */

import * as THREE from "three";
import { AGENTS, AGENT_BY_ID, type AgentDef } from "./agents";
import { bakeColored, capsule, isFine, outline, pbr, rb, sph, tx, ty, tz } from "./models";

type G = THREE.Object3D;
type M = THREE.Material;

const DARK = () => pbr(0x22252b, 0.1, 0.7);
const STEEL = () => pbr(0x8a919c, 0.75, 0.35);
const paint = (c: number, rough = 0.65) => pbr(c, 0, rough);
const lit = (c: number) => pbr(c, 0, 0.3, c);
const teamOf = (team: number) => pbr(team, 0.05, 0.45, team);

function mesh(p: G, g: THREE.BufferGeometry, m: M, x: number, y: number, z: number): THREE.Mesh {
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z);
  p.add(o);
  return o;
}

/** The top half of a ball: helmets, caps, hoods. */
function dome(p: G, r: number, x: number, y: number, z: number, m: M, sy = 1): THREE.Mesh {
  const o = mesh(p, new THREE.SphereGeometry(r, isFine() ? 24 : 14, isFine() ? 12 : 7, 0, Math.PI * 2, 0, Math.PI / 2), m, x, y, z);
  o.scale.y = sy;
  return o;
}

/** A curved line: a smile when `up` is false, a frown or a brow when it is true. */
function arc(p: G, R: number, r: number, x: number, y: number, z: number, m: M, up = false): THREE.Mesh {
  const o = mesh(p, new THREE.TorusGeometry(R, r, 6, 14, Math.PI * 0.8), m, x, y, z);
  o.rotation.z = up ? Math.PI * 0.1 : Math.PI * 1.1;
  return o;
}

/** A bare head: skin, ears, cheeks. Eyes come separately so they can blink. */
function bare(head: G, skin: number, mouth = true): void {
  const m = paint(skin, 0.7);
  sph(head, 0.2, 0, 0.2, 0, m, 1, 1.02, 0.98);
  for (const sx of [-0.2, 0.2]) sph(head, 0.045, sx, 0.18, -0.01, m, 0.6, 1, 1);
  for (const sx of [-0.135, 0.135]) sph(head, 0.03, sx, 0.125, 0.14, paint(0xf5a898, 0.8), 1, 0.7, 0.3);
  if (mouth) arc(head, 0.04, 0.009, 0, 0.115, 0.188, paint(0x3a1c14));
}

/** Round dark eyes with a glint. */
function dots(y = 0.185, z = 0.186, dx = 0.07, r = 0.031): THREE.Object3D[] {
  return [-dx, dx].map((x) => {
    const e = new THREE.Group();
    e.position.set(x, y, z);
    sph(e, r, 0, 0, 0, paint(0x14161c, 0.25), 1, 1.25, 0.6);
    sph(e, r * 0.34, r * 0.3, r * 0.5, r * 0.5, lit(0xffffff));
    return e;
  });
}

/** Eyes made of light: slits in a mask, lamps behind a visor. */
function lamps(color: number, y: number, z: number, dx: number, w: number, h: number, tilt = 0, round = false): THREE.Object3D[] {
  return [-1, 1].map((s) => {
    const e = new THREE.Group();
    e.position.set(s * dx, y, z);
    e.rotation.z = s * tilt;
    if (round) sph(e, w / 2, 0, 0, 0, lit(color), 1, h / w, 0.4);
    else rb(e, w, h, 0.02, 0, 0, 0, lit(color), Math.min(w, h) / 2.2);
    return e;
  });
}

/** A chain of links hanging from `root`, each a child of the one before: cables, cloaks, coat tails. */
function chain(n: number, step: number, make: (seg: THREE.Group, i: number) => void): { root: THREE.Group; segs: THREE.Group[]; end: THREE.Group } {
  const root = new THREE.Group();
  const segs: THREE.Group[] = [];
  let parent: THREE.Object3D = root;
  for (let i = 0; i < n; i++) {
    const seg = new THREE.Group();
    seg.position.y = i ? -step : 0;
    parent.add(seg);
    make(seg, i);
    segs.push(seg);
    parent = seg;
  }
  const end = new THREE.Group();
  end.position.y = -step;
  parent.add(end);
  return { root, segs, end };
}

/** The trunk every agent starts from: a rounded block, shoulders and a neck. */
function trunk(chest: G, m: M, neck: M, w = 0.5, h = 0.45, d = 0.31): void {
  rb(chest, w, h, d, 0, 0.19, 0, m, 0.14);
  for (const sx of [-1, 1]) sph(chest, 0.114, sx * DIM.shoulderX, DIM.shoulderY - 0.005, 0, m);
  ty(chest, 0.068, 0.1, 0, 0.43, 0, neck);
}

// ---------------------------------------------------------------------------------------------
// The body

/** Where the joints are. The rig and the parts share these. */
export const DIM = {
  /** Pelvis height when standing; hip joints hang below it, the waist sits above. */
  pelvisY: 0.86, hipX: 0.105, hipY: -0.06, thigh: 0.39, shin: 0.39, ankle: 0.075,
  waist: 0.07, shoulderX: 0.235, shoulderY: 0.36, upper: 0.29, fore: 0.27, neck: 0.44,
};

/** The pieces of one agent, each modelled around its own joint. Pairs are [right, left]. */
export interface Parts {
  pelvis: THREE.Group;
  chest: THREE.Group;
  head: THREE.Group;
  upper: [THREE.Group, THREE.Group];
  fore: [THREE.Group, THREE.Group];
  hand: [THREE.Group, THREE.Group];
  thigh: [THREE.Group, THREE.Group];
  shin: [THREE.Group, THREE.Group];
  foot: [THREE.Group, THREE.Group];
  /** Byte's face: a screen whose picture changes. */
  screen: THREE.Mesh | null;
  antenna: THREE.Object3D | null;
  /** Eyes: they blink, narrow when firing and shut when the agent is down. */
  eyes: THREE.Object3D[];
  /** A chain that swings behind: a cable, a cloak, a coat tail. `tailRest` is how each link hangs, `tailLift` how far it flies out at a run. */
  tail: THREE.Object3D[];
  tailRest: number[];
  tailLift: number;
  /** Colours of the arms as seen in first person. */
  sleeve: number;
  glove: number;
}

interface Look {
  sleeve: M;
  cuff: M;
  glove: M;
  legs: M;
  ankle: M;
  /** Lower legs, when they differ from the thighs. */
  shin?: M;
  pad: M | null;
  /** A stripe down the outside of the lower leg. */
  stripe?: M;
  shoe: M;
  toe: M;
  team: M;
  /** Chunky trainers instead of boots. */
  trainers: boolean;
}

const pair = <T,>(make: (side: number) => T): [T, T] => [make(-1), make(1)];

/** Arms and legs: tapered tubes with round joints, modelled hanging down from the joint. */
function limbs(l: Look): Pick<Parts, "upper" | "fore" | "hand" | "thigh" | "shin" | "foot"> {
  const D = DIM;
  const upper = pair(() => {
    const g = new THREE.Group();
    sph(g, 0.1, 0, 0, 0, l.sleeve);
    ty(g, 0.082, D.upper, 0, -D.upper / 2, 0, l.sleeve, 0.097);
    sph(g, 0.082, 0, -D.upper, 0, l.sleeve);
    ty(g, 0.099, 0.05, 0, -0.13, 0, l.team, 0.102);
    return g;
  });
  const fore = pair(() => {
    const g = new THREE.Group();
    ty(g, 0.09, D.fore - 0.03, 0, -(D.fore - 0.03) / 2, 0, l.sleeve, 0.08);
    ty(g, 0.086, 0.055, 0, -(D.fore - 0.04), 0, l.cuff, 0.092);
    return g;
  });
  const hand = pair((side) => {
    const g = new THREE.Group();
    ty(g, 0.07, 0.05, 0, 0.0, 0, l.glove, 0.074);
    sph(g, 0.094, 0, -0.075, 0.005, l.glove, 1, 0.95, 1.08);
    sph(g, 0.043, -side * 0.075, -0.05, 0.055, l.glove);
    return g;
  });
  const thigh = pair(() => {
    const g = new THREE.Group();
    sph(g, 0.112, 0, 0, 0, l.legs);
    ty(g, 0.094, D.thigh, 0, -D.thigh / 2, 0, l.legs, 0.112);
    sph(g, 0.094, 0, -D.thigh, 0, l.legs);
    return g;
  });
  const shin = pair((side) => {
    const g = new THREE.Group();
    ty(g, 0.098, D.shin - 0.05, 0, -(D.shin - 0.05) / 2, 0, l.shin ?? l.legs, 0.09);
    ty(g, 0.09, 0.06, 0, -(D.shin - 0.06), 0, l.ankle, 0.1);
    if (l.pad) {
      rb(g, 0.15, 0.14, 0.09, 0, -0.03, 0.06, l.pad, 0.04);
      rb(g, 0.1, 0.03, 0.02, 0, -0.03, 0.108, l.team, 0.008);
    }
    if (l.stripe) rb(g, 0.02, D.shin - 0.14, 0.07, side * 0.092, -(D.shin - 0.06) / 2, 0, l.stripe, 0.008);
    return g;
  });
  const foot = pair(() => {
    const g = new THREE.Group();
    const y = -D.ankle;
    if (l.trainers) {
      rb(g, 0.2, 0.065, 0.39, 0, y + 0.032, 0.075, l.team, 0.03);
      rb(g, 0.205, 0.03, 0.395, 0, y + 0.075, 0.075, pbr(0xf7f7f2, 0, 0.5), 0.012);
      rb(g, 0.185, 0.115, 0.3, 0, y + 0.135, 0.04, l.shoe, 0.05);
      sph(g, 0.098, 0, y + 0.115, 0.2, l.toe, 1, 0.78, 1.05);
      const tongue = rb(g, 0.1, 0.11, 0.04, 0, y + 0.2, 0.1, l.toe, 0.02);
      tongue.rotation.x = -0.55;
      for (let i = 0; i < 3; i++) rb(g, 0.12, 0.014, 0.022, 0, y + 0.195 - i * 0.022, 0.105 + i * 0.038, pbr(0x1b2244, 0, 0.6), 0.006);
      rb(g, 0.07, 0.07, 0.022, 0, y + 0.165, -0.112, l.team, 0.012);
    } else {
      rb(g, 0.185, 0.045, 0.34, 0, y + 0.022, 0.06, l.team, 0.02);
      rb(g, 0.175, 0.13, 0.32, 0, y + 0.105, 0.055, l.shoe, 0.05);
      sph(g, 0.09, 0, y + 0.095, 0.185, l.shoe, 1, 0.8, 1);
      rb(g, 0.12, 0.03, 0.1, 0, y + 0.175, 0.1, l.toe, 0.012);
    }
    return g;
  });
  return { upper, fore, hand, thigh, shin, foot };
}

type Core = Omit<Parts, "upper" | "fore" | "hand" | "thigh" | "shin" | "foot" | "sleeve" | "glove"> & {
  look: Look;
  tailRoot?: THREE.Object3D;
  /** The aerial and the tail hang from the chest instead of the head and the pelvis. */
  antennaOnChest?: boolean;
  tailOnChest?: boolean;
  /** Sleeve and glove colours for the first-person arms. */
  fp: [number, number];
};

/** Byte: a retro television on a hoodie. */
function byte(def: AgentDef, team: number): Core {
  const hoodie = pbr(def.suit, 0, 0.7);
  const shade = pbr(0xe09a00, 0, 0.7);
  const navy = pbr(def.legs, 0, 0.75);
  const cream = pbr(def.skin, 0, 0.5);
  const creamLo = pbr(0xd8d0bb, 0, 0.55);
  const white = pbr(0xf7f7f2, 0, 0.5);
  const orange = pbr(0xff7a1a, 0, 0.45);
  const teamM = pbr(team, 0.05, 0.45, team);
  const steel = STEEL();
  const dark = DARK();

  const pelvis = new THREE.Group();
  rb(pelvis, 0.37, 0.2, 0.26, 0, -0.03, 0, navy, 0.085);

  const chest = new THREE.Group();
  rb(chest, 0.53, 0.47, 0.34, 0, 0.19, 0, hoodie, 0.16);
  rb(chest, 0.5, 0.09, 0.33, 0, -0.025, 0, shade, 0.04);
  rb(chest, 0.535, 0.06, 0.345, 0, 0.275, 0, teamM, 0.025);
  rb(chest, 0.3, 0.14, 0.05, 0, 0.07, 0.155, shade, 0.035);
  for (const sx of [-1, 1]) {
    sph(chest, 0.118, sx * DIM.shoulderX, DIM.shoulderY - 0.005, 0, hoodie);
    const cord = capsule(chest, 0.012, 0.12, sx * 0.045, 0.32, 0.178, white);
    cord.rotation.z = sx * 0.12;
    sph(chest, 0.021, sx * 0.055, 0.245, 0.182, orange);
    rb(chest, 0.012, 0.09, 0.02, sx * 0.14, 0.07, 0.182, pbr(0xb87c00, 0, 0.8), 0.004);
  }
  sph(chest, 0.17, 0, 0.4, -0.125, hoodie, 1.32, 0.7, 0.95);
  ty(chest, 0.072, 0.1, 0, 0.43, 0, dark);
  for (const y of [0.4, 0.44]) ty(chest, 0.082, 0.018, 0, y, 0, steel);
  // A battery pack on the back: this is what keeps the picture on.
  rb(chest, 0.26, 0.2, 0.09, 0, 0.17, -0.195, dark, 0.03);
  for (let i = 0; i < 3; i++) rb(chest, 0.045, 0.1, 0.012, -0.065 + i * 0.065, 0.17, -0.243, pbr(0x7dff5a, 0, 0.3, 0x7dff5a), 0.008);

  const head = new THREE.Group();
  rb(head, 0.3, 0.05, 0.28, 0, 0.012, 0, dark, 0.02);
  rb(head, 0.63, 0.48, 0.42, 0, 0.27, 0, cream, 0.085);
  rb(head, 0.45, 0.35, 0.16, 0, 0.27, -0.27, creamLo, 0.08);
  for (let i = 0; i < 4; i++) rb(head, 0.3, 0.016, 0.02, 0, 0.35 - i * 0.05, -0.352, dark, 0.006);
  rb(head, 0.57, 0.42, 0.04, 0, 0.27, 0.198, dark, 0.055);
  rb(head, 0.445, 0.345, 0.02, -0.052, 0.275, 0.212, pbr(0x0a1230, 0.2, 0.3), 0.045);
  // Controls down the right-hand side of the front, like the set in grandma's kitchen.
  tz(head, 0.034, 0.03, 0.222, 0.385, 0.228, cream, 0.03);
  tz(head, 0.012, 0.036, 0.222, 0.385, 0.232, dark);
  tz(head, 0.034, 0.03, 0.222, 0.295, 0.228, orange, 0.03);
  tz(head, 0.012, 0.036, 0.222, 0.295, 0.232, dark);
  for (let i = 0; i < 4; i++) rb(head, 0.07, 0.012, 0.012, 0.222, 0.225 - i * 0.026, 0.222, steel, 0.004);
  sph(head, 0.014, 0.222, 0.105, 0.222, pbr(0x7dff5a, 0, 0.3, 0x7dff5a));
  // A carry handle, a sticker and a plaster: it has been through things.
  for (const sx of [-0.09, 0.09]) rb(head, 0.03, 0.05, 0.03, sx, 0.525, 0.02, dark, 0.008);
  rb(head, 0.24, 0.03, 0.045, 0, 0.555, 0.02, dark, 0.012);
  tx(head, 0.07, 0.012, -0.318, 0.33, 0.04, orange);
  tx(head, 0.04, 0.016, -0.318, 0.33, 0.04, white);
  const p1 = rb(head, 0.012, 0.035, 0.13, 0.318, 0.37, -0.04, pbr(0xf2c9a0, 0, 0.7), 0.004);
  p1.rotation.x = 0.6;
  const p2 = rb(head, 0.012, 0.035, 0.13, 0.318, 0.37, -0.04, pbr(0xf2c9a0, 0, 0.7), 0.004);
  p2.rotation.x = -0.6;

  const antenna = new THREE.Group();
  rb(antenna, 0.09, 0.03, 0.07, 0, 0.012, 0, dark, 0.01);
  for (const sx of [-1, 1]) {
    const rod = new THREE.Group();
    rod.rotation.z = -sx * 0.5;
    antenna.add(rod);
    ty(rod, 0.009, 0.34, 0, 0.19, 0, steel, 0.006, 8);
    sph(rod, 0.03, 0, 0.37, 0, orange);
  }
  antenna.position.set(0.13, 0.51, -0.1);

  // The power cable, never plugged in.
  const cable = chain(4, 0.105, (seg) => capsule(seg, 0.02, 0.1, 0, -0.052, 0, dark));
  rb(cable.end, 0.075, 0.08, 0.05, 0, -0.04, 0, cream, 0.018);
  for (const sx of [-0.018, 0.018]) ty(cable.end, 0.008, 0.045, sx, -0.1, 0, steel, 0.008, 6);
  cable.root.position.set(0, 0.02, -0.135);

  const look: Look = {
    sleeve: hoodie, cuff: shade, glove: pbr(def.glove ?? 0xf7f7f2, 0, 0.45), legs: navy, ankle: pbr(def.trim, 0, 0.8), pad: null,
    shoe: white, toe: orange, team: teamM, trainers: true, stripe: white,
  };
  // The screen is added after baking: its picture is swapped while the game runs.
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.415, 0.315), new THREE.MeshBasicMaterial({ toneMapped: false, alphaTest: 0.5 }));
  screen.position.set(-0.052, 0.275, 0.2235);
  return { pelvis, chest, head, screen, antenna, eyes: [], tail: cable.segs, tailRest: [1.0, 0.45, 0.2, 0.1], tailLift: 0.42, look, tailRoot: cable.root, fp: [def.suit, 0xf7f7f2] };
}


const NONE = { screen: null, antenna: null, tail: [] as THREE.Object3D[], tailRest: [] as number[], tailLift: 0 };
const groups = () => ({ pelvis: new THREE.Group(), chest: new THREE.Group(), head: new THREE.Group() });

/** Rookie: a helmet a size too big, goggles he has never needed and a pack with everything in it. */
function rookie(_d: AgentDef, team: number): Core {
  const { pelvis, chest, head } = groups();
  const green = paint(0x7a9a4e);
  const lo = paint(0x56733a);
  const olive = paint(0x3f4f2c);
  const tan = paint(0xc9b182);
  const dark = DARK();
  const tm = teamOf(team);
  rb(pelvis, 0.38, 0.2, 0.26, 0, -0.03, 0, lo, 0.085);
  rb(pelvis, 0.4, 0.06, 0.275, 0, 0.055, 0, olive, 0.02);
  rb(pelvis, 0.07, 0.065, 0.02, 0, 0.055, 0.14, tan, 0.012);
  for (const sx of [-0.17, 0.17]) rb(pelvis, 0.09, 0.11, 0.07, sx, -0.01, 0.09, olive, 0.02);
  ty(pelvis, 0.06, 0.13, -0.21, -0.03, -0.05, tan);
  ty(pelvis, 0.03, 0.03, -0.21, 0.05, -0.05, dark);
  trunk(chest, green, paint(0xf0c39a, 0.7));
  ty(chest, 0.108, 0.06, 0, 0.41, 0, lo, 0.095);
  rb(chest, 0.36, 0.26, 0.06, 0, 0.2, 0.15, olive, 0.04);
  for (const sx of [-0.115, 0, 0.115]) {
    rb(chest, 0.092, 0.115, 0.06, sx, 0.1, 0.19, lo, 0.02);
    rb(chest, 0.096, 0.035, 0.064, sx, 0.145, 0.191, tan, 0.012);
  }
  rb(chest, 0.11, 0.05, 0.02, 0.1, 0.3, 0.184, tm, 0.012);
  for (const sx of [-0.14, 0.14]) rb(chest, 0.06, 0.05, 0.36, sx, 0.415, -0.02, olive, 0.02);
  rb(chest, 0.38, 0.36, 0.17, 0, 0.2, -0.235, olive, 0.05);
  rb(chest, 0.24, 0.14, 0.05, 0, 0.12, -0.335, lo, 0.02);
  tx(chest, 0.075, 0.42, 0, 0.43, -0.23, tan);
  for (const sx of [-0.12, 0.12]) tx(chest, 0.08, 0.03, sx, 0.43, -0.23, dark);
  const antenna = new THREE.Group();
  ty(antenna, 0.008, 0.36, 0, 0.18, 0, dark, 0.006, 8);
  sph(antenna, 0.024, 0, 0.37, 0, paint(0xff7a1a));
  antenna.position.set(0.15, 0.38, -0.29);
  bare(head, 0xf0c39a);
  dome(head, 0.238, 0, 0.235, -0.005, lo, 0.98);
  ty(head, 0.248, 0.035, 0, 0.24, -0.005, olive);
  ty(head, 0.244, 0.04, 0, 0.32, -0.005, dark, 0.228);
  for (const sx of [-0.078, 0.078]) {
    tz(head, 0.066, 0.03, sx, 0.325, 0.205, dark);
    tz(head, 0.052, 0.036, sx, 0.325, 0.212, paint(0xffa52a, 0.15));
  }
  for (const sx of [-0.19, 0.19]) rb(head, 0.02, 0.16, 0.025, sx, 0.15, 0.06, dark, 0.008);
  const plaster = rb(head, 0.085, 0.03, 0.012, 0.118, 0.165, 0.158, paint(0xf7e3c4), 0.006);
  plaster.rotation.set(0, 0.62, 0.4);
  return {
    pelvis, chest, head, ...NONE, antenna, antennaOnChest: true, eyes: dots(0.178), fp: [0x7a9a4e, 0x3f4f2c],
    look: { sleeve: green, cuff: olive, glove: olive, legs: lo, ankle: dark, pad: olive, shoe: dark, toe: olive, team: tm, trainers: false },
  };
}

/** Rush: a courier in a bike helmet with a delivery box on his back. Always late, never slow. */
function rush(_d: AgentDef, team: number): Core {
  const { pelvis, chest, head } = groups();
  const red = paint(0xe5383b);
  const redLo = paint(0xb8242a);
  const white = paint(0xf7f7f2, 0.5);
  const navy = paint(0x232a3d);
  const dark = DARK();
  const tm = teamOf(team);
  rb(pelvis, 0.38, 0.2, 0.26, 0, -0.03, 0, navy, 0.085);
  rb(pelvis, 0.22, 0.11, 0.1, 0.02, 0.01, 0.15, redLo, 0.035);
  rb(pelvis, 0.16, 0.015, 0.02, 0.02, 0.04, 0.2, white, 0.005);
  rb(pelvis, 0.42, 0.04, 0.28, 0, 0.05, 0, dark, 0.015);
  trunk(chest, red, paint(0xc98f62, 0.7));
  rb(chest, 0.505, 0.085, 0.316, 0, 0.23, 0, white, 0.03);
  rb(chest, 0.022, 0.42, 0.012, 0, 0.19, 0.158, white, 0.005);
  ty(chest, 0.115, 0.09, 0, 0.425, 0, redLo, 0.1);
  for (const sx of [-0.15, 0.15]) rb(chest, 0.055, 0.4, 0.03, sx, 0.2, 0.16, dark, 0.012);
  rb(chest, 0.44, 0.46, 0.3, 0, 0.24, -0.31, paint(0x1d2229), 0.045);
  rb(chest, 0.455, 0.06, 0.315, 0, 0.44, -0.31, tm, 0.02);
  rb(chest, 0.3, 0.03, 0.02, 0, 0.36, -0.462, white, 0.008);
  const bolt = rb(chest, 0.06, 0.16, 0.014, 0.02, 0.24, -0.463, paint(0xffd21a), 0.01);
  bolt.rotation.z = 0.45;
  rb(chest, 0.06, 0.14, 0.014, -0.02, 0.14, -0.463, paint(0xffd21a), 0.01).rotation.z = 0.45;
  bare(head, 0xc98f62, false);
  dome(head, 0.236, 0, 0.24, -0.01, white, 0.92);
  for (const sx of [-0.1, 0, 0.1]) rb(head, 0.05, 0.035, 0.42, sx, 0.445 - Math.abs(sx) * 0.42, -0.01, red, 0.015);
  rb(head, 0.26, 0.024, 0.12, 0, 0.255, 0.23, red, 0.012);
  sph(head, 0.09, 0, 0.14, -0.17, paint(0x2a1c14), 1.4, 1, 1);
  rb(head, 0.31, 0.15, 0.23, 0, 0.085, 0.06, navy, 0.07);
  rb(head, 0.1, 0.03, 0.012, 0, 0.1, 0.178, tm, 0.008);
  for (const sx of [-0.215, 0.215]) tx(head, 0.06, 0.05, sx, 0.2, -0.01, dark);
  return {
    pelvis, chest, head, ...NONE, eyes: dots(0.19), fp: [0xe5383b, 0x22252b],
    look: { sleeve: red, cuff: white, glove: dark, legs: navy, ankle: white, pad: null, stripe: red, shoe: white, toe: red, team: tm, trainers: true },
  };
}

/** Wrench: a mechanic who lives behind a welding mask. The two lights in the slot are all anyone has seen. */
function wrench(_d: AgentDef, team: number): Core {
  const { pelvis, chest, head } = groups();
  const orange = paint(0xf08a24);
  const lo = paint(0xc96a14);
  const shirt = paint(0x3a4150);
  const leather = paint(0x8a5a2b, 0.8);
  const grey = paint(0xb9c0cc, 0.45);
  const steel = STEEL();
  const dark = DARK();
  const tm = teamOf(team);
  rb(pelvis, 0.39, 0.2, 0.27, 0, -0.03, 0, orange, 0.085);
  rb(pelvis, 0.43, 0.07, 0.3, 0, 0.05, 0, leather, 0.02);
  for (const sx of [-0.18, 0.19]) rb(pelvis, 0.1, 0.13, 0.08, sx, -0.03, 0.1, leather, 0.02);
  ty(pelvis, 0.018, 0.2, 0.2, -0.08, -0.08, paint(0xc98a4a));
  rb(pelvis, 0.07, 0.05, 0.05, 0.2, 0.04, -0.08, steel, 0.01);
  rb(pelvis, 0.07, 0.14, 0.02, -0.12, -0.06, 0.14, paint(0xd93a2b), 0.01);
  trunk(chest, shirt, dark);
  rb(chest, 0.515, 0.2, 0.325, 0, 0.03, 0, orange, 0.06);
  rb(chest, 0.34, 0.3, 0.04, 0, 0.16, 0.16, orange, 0.03);
  rb(chest, 0.17, 0.11, 0.02, 0, 0.2, 0.185, lo, 0.012);
  ty(chest, 0.012, 0.1, 0.05, 0.27, 0.192, paint(0xffd21a), 0.012, 6);
  for (const sx of [-0.13, 0.13]) {
    rb(chest, 0.065, 0.2, 0.03, sx, 0.36, 0.15, orange, 0.012);
    rb(chest, 0.065, 0.03, 0.34, sx, 0.445, 0, orange, 0.012);
    rb(chest, 0.065, 0.3, 0.03, sx, 0.3, -0.158, orange, 0.012);
    sph(chest, 0.022, sx, 0.29, 0.182, steel);
  }
  sph(chest, 0.05, -0.1, 0.1, 0.176, dark, 1, 0.8, 0.2);
  const tool = new THREE.Group();
  tool.position.set(0, 0.22, -0.2);
  tool.rotation.z = 0.7;
  chest.add(tool);
  rb(tool, 0.06, 0.5, 0.036, 0, 0, 0, steel, 0.012);
  for (const sx of [-0.055, 0.055]) rb(tool, 0.055, 0.12, 0.04, sx, 0.3, 0, steel, 0.015);
  rb(tool, 0.16, 0.05, 0.04, 0, 0.24, 0, steel, 0.015);
  ty(tool, 0.06, 0.04, 0, -0.28, 0, steel).rotation.x = Math.PI / 2;
  sph(head, 0.2, 0, 0.21, -0.03, leather, 1, 1.02, 1);
  rb(head, 0.37, 0.42, 0.15, 0, 0.2, 0.125, grey, 0.085);
  rb(head, 0.29, 0.115, 0.02, 0, 0.25, 0.196, dark, 0.03);
  rb(head, 0.31, 0.135, 0.016, 0, 0.25, 0.19, steel, 0.035);
  for (const [sx, sy] of [[-0.15, 0.37], [0.15, 0.37], [-0.15, 0.04], [0.15, 0.04]]) sph(head, 0.016, sx, sy, 0.19, steel);
  for (const sx of [-0.195, 0.195]) tx(head, 0.04, 0.04, sx, 0.31, 0.04, dark);
  rb(head, 0.1, 0.035, 0.16, 0, 0.415, 0.05, dark, 0.012);
  for (let i = 0; i < 3; i++) rb(head, 0.1, 0.012, 0.012, 0, 0.13 - i * 0.03, 0.2, dark, 0.004);
  return {
    pelvis, chest, head, ...NONE, eyes: lamps(0xffb347, 0.25, 0.208, 0.07, 0.085, 0.05), fp: [0x3a4150, 0x8a5a2b],
    look: { sleeve: shirt, cuff: leather, glove: leather, legs: orange, ankle: dark, pad: lo, shoe: dark, toe: grey, team: tm, trainers: false },
  };
}

/** Scout: campaign hat, neckerchief, a sash of badges and a pack with a pan on it. Prepared for anything. */
function scout(_d: AgentDef, team: number): Core {
  const { pelvis, chest, head } = groups();
  const khaki = paint(0xd2b272);
  const khakiLo = paint(0xa8884a);
  const olive = paint(0x5f7a3a);
  const red = paint(0xd93a2b);
  const brown = paint(0x6b4a2e, 0.8);
  const dark = DARK();
  const tm = teamOf(team);
  rb(pelvis, 0.38, 0.2, 0.26, 0, -0.03, 0, olive, 0.085);
  rb(pelvis, 0.4, 0.055, 0.275, 0, 0.055, 0, brown, 0.02);
  rb(pelvis, 0.075, 0.07, 0.02, 0, 0.055, 0.14, paint(0xf2b824, 0.3), 0.015);
  rb(pelvis, 0.1, 0.12, 0.07, -0.18, -0.02, 0.08, brown, 0.02);
  trunk(chest, khaki, paint(0xb9825a, 0.7));
  ty(chest, 0.13, 0.055, 0, 0.405, 0.01, red, 0.11);
  const flap = rb(chest, 0.15, 0.15, 0.02, 0, 0.3, 0.166, red, 0.01);
  flap.rotation.z = Math.PI / 4;
  ty(chest, 0.032, 0.04, 0, 0.365, 0.175, paint(0xf2b824, 0.3));
  const sash = rb(chest, 0.62, 0.075, 0.02, 0, 0.2, 0.163, olive, 0.01);
  sash.rotation.z = 0.78;
  [0xffd21a, 0x2f8cff, 0xff7a1a, 0xf7f7f2].forEach((c, i) => tz(chest, 0.027, 0.012, 0.13 - i * 0.075, 0.325 - i * 0.075, 0.176, paint(c, 0.4)));
  for (const sx of [-0.13, 0.13]) {
    rb(chest, 0.12, 0.1, 0.02, sx, 0.07, 0.16, khakiLo, 0.012);
    sph(chest, 0.014, sx, 0.1, 0.172, brown);
  }
  for (const sx of [-0.045, 0.045]) tz(chest, 0.04, 0.1, sx, 0.02, 0.2, dark);
  rb(chest, 0.37, 0.42, 0.18, 0, 0.22, -0.25, olive, 0.05);
  rb(chest, 0.26, 0.16, 0.05, 0, 0.3, -0.35, khakiLo, 0.02);
  tx(chest, 0.075, 0.42, 0, 0.0, -0.26, paint(0x2f7fd0));
  ty(chest, 0.1, 0.02, 0.2, 0.18, -0.33, dark).rotation.x = Math.PI / 2;
  rb(chest, 0.03, 0.16, 0.02, 0.2, 0.02, -0.335, dark, 0.008);
  bare(head, 0xb9825a);
  for (const sx of [-0.17, 0.17]) sph(head, 0.07, sx, 0.2, -0.06, brown, 0.7, 1.1, 1.1);
  for (const [sx, sy] of [[-0.05, 0.15], [0.02, 0.135], [0.06, 0.155]]) sph(head, 0.008, sx, sy, 0.192, paint(0x8a5a3a));
  ty(head, 0.35, 0.024, 0, 0.33, 0, khakiLo);
  ty(head, 0.2, 0.15, 0, 0.415, 0, khakiLo, 0.16);
  sph(head, 0.16, 0, 0.485, 0, khakiLo, 1, 0.3, 1);
  ty(head, 0.204, 0.04, 0, 0.36, 0, brown);
  const antenna = new THREE.Group();
  sph(antenna, 0.05, 0, 0.1, 0, red, 0.5, 2.2, 0.25);
  sph(antenna, 0.03, 0, 0.18, 0, paint(0xf7f7f2), 0.5, 1.4, 0.25);
  antenna.position.set(-0.2, 0.37, 0.02);
  antenna.rotation.z = 0.35;
  return {
    pelvis, chest, head, ...NONE, antenna, eyes: dots(0.19), fp: [0xd2b272, 0xb9825a],
    look: { sleeve: khaki, cuff: khakiLo, glove: paint(0xb9825a, 0.7), legs: olive, ankle: red, pad: null, shoe: brown, toe: paint(0x4a3220), team: tm, trainers: false },
  };
}

/** Brass: a deep-sea diver. Somewhere inside the helmet two lights look back at you. */
function brass(_d: AgentDef, team: number): Core {
  const { pelvis, chest, head } = groups();
  const suit = paint(0x2f5f9e, 0.8);
  const suitLo = paint(0x244a7c, 0.8);
  const br = pbr(0xe0a83a, 0.7, 0.28);
  const brP = paint(0xd9a441, 0.4);
  const lead = paint(0x6a7280, 0.6);
  const dark = DARK();
  const tm = teamOf(team);
  rb(pelvis, 0.4, 0.21, 0.28, 0, -0.03, 0, suit, 0.09);
  rb(pelvis, 0.43, 0.06, 0.3, 0, 0.055, 0, dark, 0.02);
  for (let i = 0; i < 5; i++) rb(pelvis, 0.07, 0.09, 0.05, -0.16 + i * 0.08, 0.04, 0.155, lead, 0.015);
  trunk(chest, suit, dark, 0.54, 0.46, 0.35);
  ty(chest, 0.31, 0.15, 0, 0.37, 0, br, 0.2);
  for (let i = 0; i < 8; i++) sph(chest, 0.02, Math.cos((i / 8) * Math.PI * 2) * 0.27, 0.34, Math.sin((i / 8) * Math.PI * 2) * 0.27, br);
  rb(chest, 0.22, 0.2, 0.06, 0, 0.14, 0.185, lead, 0.04);
  rb(chest, 0.26, 0.03, 0.07, 0, 0.2, 0.186, tm, 0.01);
  for (const sx of [-0.1, 0.1]) {
    ty(chest, 0.088, 0.4, sx, 0.2, -0.255, paint(0xf2c230));
    sph(chest, 0.088, sx, 0.4, -0.255, paint(0xf2c230));
    ty(chest, 0.035, 0.05, sx, 0.5, -0.255, br);
    ty(chest, 0.092, 0.035, sx, 0.12, -0.255, dark);
    const hose = capsule(chest, 0.022, 0.22, sx * 1.5, 0.52, -0.16, dark);
    hose.rotation.x = -0.75;
  }
  rb(chest, 0.34, 0.06, 0.08, 0, 0.3, -0.2, dark, 0.02);
  sph(head, 0.275, 0, 0.27, 0, br);
  tz(head, 0.14, 0.07, 0, 0.27, 0.25, br);
  tz(head, 0.112, 0.02, 0, 0.27, 0.283, pbr(0x061a26, 0.3, 0.15));
  for (const sx of [-0.045, 0.045]) rb(head, 0.014, 0.22, 0.014, sx, 0.27, 0.297, br, 0.005);
  rb(head, 0.22, 0.014, 0.014, 0, 0.27, 0.298, br, 0.005);
  for (let i = 0; i < 8; i++) sph(head, 0.015, Math.cos((i / 8) * Math.PI * 2) * 0.128, 0.27 + Math.sin((i / 8) * Math.PI * 2) * 0.128, 0.288, br);
  for (const sx of [-0.265, 0.265]) {
    tx(head, 0.08, 0.05, sx, 0.27, 0, br);
    tx(head, 0.058, 0.06, sx, 0.27, 0, pbr(0x061a26, 0.3, 0.15));
  }
  ty(head, 0.06, 0.06, 0, 0.56, 0, br);
  ty(head, 0.085, 0.02, 0, 0.6, 0, brP);
  ty(head, 0.2, 0.05, 0, 0.02, 0, br);
  return {
    pelvis, chest, head, ...NONE, eyes: lamps(0x7fe3ff, 0.275, 0.292, 0.05, 0.052, 0.062, 0, true), fp: [0x2f5f9e, 0x8a3b24],
    look: { sleeve: suit, cuff: brP, glove: paint(0x8a3b24, 0.8), legs: suit, shin: suitLo, ankle: brP, pad: null, shoe: lead, toe: brP, team: tm, trainers: false },
  };
}

/** Marshal: a hat with a wide brim, a bandana up to the eyes, a star and a long coat that flies out behind. */
function marshal(_d: AgentDef, team: number): Core {
  const { pelvis, chest, head } = groups();
  const coat = paint(0x8a5a34, 0.8);
  const coatLo = paint(0x6b4226, 0.8);
  const jeans = paint(0x33384a);
  const felt = paint(0x3d2a1c, 0.9);
  const gold = paint(0xf2b824, 0.3);
  const red = paint(0xc8322b);
  const dark = DARK();
  const tm = teamOf(team);
  rb(pelvis, 0.38, 0.2, 0.26, 0, -0.03, 0, jeans, 0.085);
  const belt = rb(pelvis, 0.44, 0.07, 0.3, 0, 0.03, 0, felt, 0.02);
  belt.rotation.z = -0.1;
  sph(pelvis, 0.05, 0, 0.03, 0.15, gold, 1.2, 0.9, 0.35);
  for (let i = 0; i < 5; i++) ty(pelvis, 0.012, 0.045, 0.07 + i * 0.03, 0.02 - i * 0.003, 0.152, gold, 0.012, 6);
  rb(pelvis, 0.1, 0.2, 0.07, -0.22, -0.09, 0.03, felt, 0.02);
  rb(pelvis, 0.045, 0.09, 0.05, -0.22, 0.03, 0.02, paint(0xb9c0cc, 0.4), 0.015);
  trunk(chest, coat, paint(0xd9a57c, 0.7));
  rb(chest, 0.13, 0.42, 0.02, 0, 0.19, 0.158, paint(0xe9dcc0), 0.008);
  for (const sx of [-1, 1]) {
    const lapel = rb(chest, 0.09, 0.3, 0.025, sx * 0.1, 0.26, 0.164, coatLo, 0.012);
    lapel.rotation.z = sx * 0.3;
  }
  tz(chest, 0.06, 0.016, 0.14, 0.26, 0.17, gold, 0.06, 5);
  sph(chest, 0.018, 0.14, 0.26, 0.182, paint(0xfff3c2, 0.3));
  ty(chest, 0.33, 0.13, 0, 0.345, 0, coatLo, 0.15);
  ty(chest, 0.1, 0.07, 0, 0.42, 0, coatLo, 0.115);
  const band = rb(chest, 0.64, 0.055, 0.02, 0, 0.17, 0.168, felt, 0.01);
  band.rotation.z = -0.72;
  for (let i = 0; i < 5; i++) ty(chest, 0.013, 0.05, -0.14 + i * 0.065, 0.3 - i * 0.058, 0.18, gold, 0.013, 6);
  // The coat's skirt: three hinged boards that trail when he runs.
  const tails = chain(3, 0.19, (seg, i) => {
    rb(seg, 0.5 + i * 0.04, 0.2, 0.03, 0, -0.095, 0, i % 2 ? coatLo : coat, 0.012);
  });
  tails.root.position.set(0, 0.05, -0.15);
  bare(head, 0xd9a57c, false);
  for (const sx of [-0.19, 0.19]) rb(head, 0.03, 0.12, 0.09, sx, 0.2, -0.01, felt, 0.012);
  ty(head, 0.37, 0.022, 0, 0.31, 0, felt);
  for (const sx of [-1, 1]) {
    const curl = rb(head, 0.14, 0.022, 0.6, sx * 0.31, 0.335, 0, felt, 0.01);
    curl.rotation.z = sx * 0.5;
  }
  ty(head, 0.2, 0.17, 0, 0.405, 0, felt, 0.165);
  rb(head, 0.2, 0.04, 0.3, 0, 0.495, 0, felt, 0.02);
  ty(head, 0.204, 0.035, 0, 0.34, 0, red);
  tz(head, 0.03, 0.012, 0, 0.34, 0.205, gold, 0.03, 5);
  rb(head, 0.33, 0.17, 0.25, 0, 0.085, 0.05, red, 0.075);
  const tip = rb(head, 0.15, 0.15, 0.02, 0, -0.01, 0.165, red, 0.01);
  tip.rotation.z = Math.PI / 4;
  for (const sx of [-1, 1]) {
    const brow = rb(head, 0.085, 0.022, 0.02, sx * 0.07, 0.245, 0.185, felt, 0.008);
    brow.rotation.z = -sx * 0.32;
  }
  return {
    pelvis, chest, head, ...NONE, eyes: dots(0.195, 0.188, 0.07, 0.027), tail: tails.segs, tailRest: [0.1, 0.06, 0.04], tailLift: 0.4, tailRoot: tails.root, fp: [0x8a5a34, 0xc98a4a],
    look: { sleeve: coat, cuff: coatLo, glove: paint(0xc98a4a, 0.8), legs: jeans, ankle: paint(0x6b3f22), pad: null, shoe: paint(0x6b3f22, 0.6), toe: gold, team: tm, trainers: false },
  };
}

/** Neon: lit from the inside. A crest of glowing spikes, a visor of light and a jacket wired like a sign. */
function neon(_d: AgentDef, team: number): Core {
  const { pelvis, chest, head } = groups();
  const black = paint(0x1b1d2a, 0.55);
  const jet = paint(0x12131c, 0.5);
  const pink = lit(0xff2bd6);
  const cyan = lit(0x18f0ff);
  const tm = teamOf(team);
  rb(pelvis, 0.38, 0.2, 0.26, 0, -0.03, 0, jet, 0.085);
  rb(pelvis, 0.41, 0.05, 0.28, 0, 0.055, 0, black, 0.02);
  tz(pelvis, 0.04, 0.02, 0, 0.055, 0.145, cyan, 0.04, 6);
  rb(pelvis, 0.11, 0.13, 0.08, 0.19, -0.03, 0.06, black, 0.025);
  rb(pelvis, 0.08, 0.014, 0.01, 0.19, 0.0, 0.103, pink, 0.004);
  trunk(chest, black, jet);
  ty(chest, 0.14, 0.13, 0, 0.42, 0, black, 0.12);
  ty(chest, 0.122, 0.018, 0, 0.485, 0, pink);
  for (const sx of [-0.14, 0.14]) rb(chest, 0.02, 0.36, 0.014, sx, 0.2, 0.158, cyan, 0.006);
  for (const sx of [-1, 1]) {
    const v = rb(chest, 0.14, 0.024, 0.014, sx * 0.055, 0.25, 0.16, pink, 0.008);
    v.rotation.z = -sx * 0.6;
    rb(chest, 0.2, 0.06, 0.26, sx * 0.25, 0.44, 0, jet, 0.025);
    rb(chest, 0.2, 0.014, 0.265, sx * 0.25, 0.412, 0, cyan, 0.006);
  }
  rb(chest, 0.26, 0.016, 0.014, 0, 0.02, 0.158, cyan, 0.006);
  rb(chest, 0.28, 0.3, 0.09, 0, 0.2, -0.19, jet, 0.035);
  for (const sx of [-0.09, 0, 0.09]) rb(chest, 0.04, 0.22, 0.014, sx, 0.2, -0.238, sx ? pink : cyan, 0.01);
  bare(head, 0xe8c3a0, false);
  rb(head, 0.34, 0.16, 0.25, 0, 0.08, 0.04, jet, 0.07);
  rb(head, 0.08, 0.016, 0.012, 0, 0.09, 0.168, cyan, 0.006);
  dome(head, 0.208, 0, 0.21, -0.012, jet, 0.95);
  rb(head, 0.43, 0.12, 0.3, 0, 0.215, 0.03, black, 0.055);
  rb(head, 0.36, 0.085, 0.02, 0, 0.215, 0.176, pbr(0x05060c, 0.4, 0.15), 0.035);
  for (const sx of [-0.218, 0.218]) tx(head, 0.05, 0.03, sx, 0.215, 0, pink);
  const antenna = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const spike = ty(antenna, 0.035, 0.13 + Math.sin((i / 5) * Math.PI) * 0.1, 0, 0.07, 0.14 - i * 0.065, i % 2 ? cyan : pink, 0.004, 6);
    spike.rotation.x = -0.25 - i * 0.12;
  }
  antenna.position.set(0, 0.385, -0.02);
  return {
    pelvis, chest, head, ...NONE, antenna, eyes: lamps(0x18f0ff, 0.217, 0.19, 0.085, 0.1, 0.034, 0.18), fp: [0x1b1d2a, 0x12131c],
    look: { sleeve: black, cuff: pink, glove: jet, legs: jet, ankle: cyan, pad: null, stripe: pink, shoe: black, toe: pink, team: tm, trainers: true },
  };
}

/** Titan: a walking gold vault. A reactor in the chest, two thrusters on the back, a slit of light for a face. */
function titan(_d: AgentDef, team: number): Core {
  const { pelvis, chest, head } = groups();
  const gold = paint(0xf2b824, 0.32);
  const goldLo = paint(0xc98c12, 0.4);
  const under = paint(0x2a2c33, 0.6);
  const red = paint(0xb3202a);
  const steel = STEEL();
  const glow = lit(0x7fe3ff);
  const tm = teamOf(team);
  rb(pelvis, 0.38, 0.2, 0.27, 0, -0.03, 0, under, 0.085);
  rb(pelvis, 0.2, 0.2, 0.06, 0, -0.03, 0.14, gold, 0.04);
  for (const sx of [-0.2, 0.2]) rb(pelvis, 0.07, 0.2, 0.26, sx, -0.04, 0, gold, 0.03);
  rb(pelvis, 0.43, 0.06, 0.3, 0, 0.06, 0, goldLo, 0.02);
  tz(pelvis, 0.045, 0.03, 0, 0.06, 0.155, steel);
  rb(chest, 0.6, 0.48, 0.38, 0, 0.2, 0, gold, 0.15);
  ty(chest, 0.085, 0.1, 0, 0.43, 0, under);
  ty(chest, 0.17, 0.09, 0, 0.42, 0, goldLo, 0.13);
  tz(chest, 0.115, 0.04, 0, 0.24, 0.19, goldLo);
  tz(chest, 0.085, 0.05, 0, 0.24, 0.193, steel);
  tz(chest, 0.062, 0.056, 0, 0.24, 0.196, glow);
  rb(chest, 0.61, 0.05, 0.385, 0, 0.07, 0, tm, 0.02);
  for (const sx of [-1, 1]) {
    rb(chest, 0.012, 0.2, 0.012, sx * 0.17, 0.26, 0.19, under, 0.004);
    sph(chest, 0.17, sx * 0.305, 0.4, 0, gold, 1.15, 0.85, 1.25);
    rb(chest, 0.2, 0.035, 0.44, sx * 0.31, 0.33, 0, red, 0.012);
    sph(chest, 0.03, sx * 0.31, 0.5, 0.1, steel);
    ty(chest, 0.085, 0.3, sx * 0.13, 0.22, -0.27, steel);
    ty(chest, 0.07, 0.05, sx * 0.13, 0.05, -0.27, lit(0xff8a1a), 0.085);
    sph(chest, 0.085, sx * 0.13, 0.37, -0.27, goldLo);
  }
  rb(chest, 0.14, 0.34, 0.1, 0, 0.22, -0.22, under, 0.03);
  rb(head, 0.4, 0.42, 0.41, 0, 0.22, 0, gold, 0.14);
  rb(head, 0.3, 0.24, 0.03, 0, 0.2, 0.2, under, 0.05);
  rb(head, 0.045, 0.13, 0.024, 0, 0.14, 0.214, glow, 0.012);
  rb(head, 0.055, 0.16, 0.4, 0, 0.44, -0.02, red, 0.022);
  for (const sx of [-0.21, 0.21]) {
    tx(head, 0.075, 0.04, sx, 0.2, 0, steel);
    rb(head, 0.03, 0.16, 0.05, sx * 1.07, 0.33, -0.04, goldLo, 0.012);
  }
  rb(head, 0.2, 0.06, 0.06, 0, 0.045, 0.17, goldLo, 0.02);
  return {
    pelvis, chest, head, ...NONE, eyes: lamps(0x7fe3ff, 0.255, 0.214, 0.065, 0.1, 0.04), fp: [0xf2b824, 0x2a2c33],
    look: { sleeve: gold, cuff: under, glove: under, legs: under, shin: gold, ankle: under, pad: red, shoe: gold, toe: red, team: tm, trainers: false },
  };
}

/** Hazard: a clean suit, two filters and a pair of green lamps behind the glass. Do not ask what was in the room. */
function hazard(_d: AgentDef, team: number): Core {
  const { pelvis, chest, head } = groups();
  const white = paint(0xf1f3f5, 0.55);
  const grey = paint(0xcfd5dd, 0.6);
  const yellow = paint(0xffd21a, 0.5);
  const lime = paint(0x7ac70c, 0.4);
  const dark = DARK();
  const steel = STEEL();
  const tm = teamOf(team);
  rb(pelvis, 0.4, 0.21, 0.28, 0, -0.03, 0, white, 0.09);
  rb(pelvis, 0.425, 0.06, 0.3, 0, 0.055, 0, yellow, 0.02);
  for (let i = 0; i < 6; i++) rb(pelvis, 0.03, 0.062, 0.302, -0.17 + i * 0.068, 0.055, 0, dark, 0.004).rotation.z = 0.5;
  trunk(chest, white, dark, 0.54, 0.47, 0.35);
  rb(chest, 0.06, 0.44, 0.02, 0, 0.19, 0.176, grey, 0.01);
  rb(chest, 0.17, 0.13, 0.07, -0.13, 0.19, 0.18, yellow, 0.02);
  tz(chest, 0.04, 0.012, -0.15, 0.2, 0.218, paint(0xf7f7f2));
  rb(chest, 0.008, 0.035, 0.008, -0.15, 0.21, 0.226, dark, 0.003).rotation.z = 0.5;
  sph(chest, 0.016, -0.08, 0.22, 0.218, lit(0x9dff3a));
  tz(chest, 0.065, 0.012, 0.14, 0.25, 0.178, yellow);
  for (let i = 0; i < 3; i++) {
    const w = rb(chest, 0.03, 0.045, 0.006, 0.14 + Math.sin((i / 3) * Math.PI * 2) * 0.034, 0.25 + Math.cos((i / 3) * Math.PI * 2) * 0.034, 0.186, dark, 0.008);
    w.rotation.z = -(i / 3) * Math.PI * 2;
  }
  sph(chest, 0.014, 0.14, 0.25, 0.187, dark);
  rb(chest, 0.545, 0.05, 0.355, 0, 0.05, 0, tm, 0.02);
  ty(chest, 0.105, 0.42, 0, 0.2, -0.265, lime);
  sph(chest, 0.105, 0, 0.41, -0.265, lime);
  ty(chest, 0.04, 0.06, 0, 0.53, -0.265, steel);
  for (const y of [0.1, 0.32]) rb(chest, 0.4, 0.04, 0.12, 0, y, -0.2, dark, 0.012);
  const hose = capsule(chest, 0.024, 0.3, 0.15, 0.42, -0.1, dark);
  hose.rotation.x = -1.0;
  ty(chest, 0.19, 0.07, 0, 0.42, 0, grey, 0.14);
  sph(head, 0.255, 0, 0.25, -0.01, white, 1, 1.04, 1);
  rb(head, 0.37, 0.215, 0.05, 0, 0.285, 0.218, grey, 0.07);
  rb(head, 0.32, 0.165, 0.03, 0, 0.285, 0.236, pbr(0x0c1a14, 0.4, 0.12), 0.055);
  rb(head, 0.15, 0.11, 0.11, 0, 0.115, 0.2, dark, 0.035);
  for (const sx of [-1, 1]) {
    const can = tz(head, 0.062, 0.09, sx * 0.13, 0.115, 0.195, grey);
    can.rotation.y = sx * 0.65;
    const cap = tz(head, 0.05, 0.02, sx * 0.165, 0.115, 0.238, lime);
    cap.rotation.y = sx * 0.65;
  }
  rb(head, 0.03, 0.2, 0.3, 0, 0.42, -0.02, grey, 0.012);
  return {
    pelvis, chest, head, ...NONE, eyes: lamps(0x9dff3a, 0.29, 0.25, 0.075, 0.07, 0.085, 0, true), fp: [0xf1f3f5, 0xffd21a],
    look: { sleeve: white, cuff: yellow, glove: yellow, legs: white, ankle: yellow, pad: null, shoe: dark, toe: lime, team: tm, trainers: false },
  };
}

/** Phantom: a hood, a pale mask and a cloak in tatters. Nobody has heard it walk. */
function phantom(_d: AgentDef, team: number): Core {
  const { pelvis, chest, head } = groups();
  const robe = paint(0x211a33, 0.7);
  const robeLo = paint(0x15101f, 0.7);
  const violet = paint(0x7a3df0, 0.5);
  const ivory = paint(0xece6f7, 0.4);
  const glow = lit(0xb48cff);
  const tm = teamOf(team);
  rb(pelvis, 0.38, 0.2, 0.26, 0, -0.03, 0, robeLo, 0.085);
  rb(pelvis, 0.42, 0.08, 0.29, 0, 0.05, 0, violet, 0.03);
  for (const [sx, len] of [[0.13, 0.22], [0.18, 0.15]]) rb(pelvis, 0.045, len, 0.02, sx, -0.02 - len / 2, 0.15, violet, 0.01);
  trunk(chest, robe, robeLo, 0.48, 0.45, 0.3);
  for (const sx of [-1, 1]) {
    const wrap = rb(chest, 0.62, 0.06, 0.02, 0, 0.2, 0.154, violet, 0.01);
    wrap.rotation.z = sx * 0.75;
  }
  const sigil = tz(chest, 0.06, 0.016, 0, 0.2, 0.166, glow, 0.06, 4);
  sigil.rotation.z = Math.PI / 4;
  rb(chest, 0.485, 0.05, 0.305, 0, 0.04, 0, tm, 0.02);
  ty(chest, 0.34, 0.15, 0, 0.36, 0, robeLo, 0.15);
  ty(chest, 0.343, 0.022, 0, 0.292, 0, glow, 0.337);
  // The cloak: four hinged strips, the last one in rags.
  const cloak = chain(4, 0.2, (seg, i) => {
    rb(seg, 0.5 + i * 0.03, 0.21, 0.025, 0, -0.1, 0, i % 2 ? robe : robeLo, 0.012);
    if (i === 3) for (const sx of [-0.19, -0.06, 0.07, 0.2]) ty(seg, 0.06, 0.14, sx, -0.26, 0, robeLo, 0.002, 4).rotation.x = Math.PI;
  });
  cloak.root.position.set(0, 0.36, -0.17);
  sph(head, 0.255, 0, 0.245, -0.03, robe, 1, 1.06, 1.04);
  const peak = ty(head, 0.11, 0.24, 0, 0.47, -0.17, robe, 0.004, 10);
  peak.rotation.x = -1.0;
  sph(head, 0.19, 0, 0.215, 0.07, pbr(0x06040c, 0, 0.9), 1, 1.05, 0.7);
  sph(head, 0.17, 0, 0.205, 0.165, ivory, 0.95, 1.18, 0.34);
  for (const sx of [-0.065, 0.065]) rb(head, 0.016, 0.1, 0.012, sx, 0.14, 0.221, violet, 0.006);
  rb(head, 0.016, 0.07, 0.012, 0, 0.34, 0.212, violet, 0.006);
  return {
    pelvis, chest, head, ...NONE, eyes: lamps(0xb48cff, 0.245, 0.226, 0.065, 0.078, 0.028, 0.32), tail: cloak.segs, tailRest: [0.14, 0.07, 0.05, 0.04], tailLift: 0.34,
    tailRoot: cloak.root, tailOnChest: true, fp: [0x211a33, 0x15101f],
    look: { sleeve: robe, cuff: violet, glove: robeLo, legs: robeLo, ankle: violet, pad: null, shoe: robeLo, toe: violet, team: tm, trainers: false },
  };
}

const BUILD: Record<string, (def: AgentDef, team: number) => Core> = { byte, rookie, rush, wrench, scout, brass, marshal, neon, titan, hazard, phantom };

/** Builds every piece of an agent in team colours, outlined and baked. `edge` is the outline thickness; 0 = none. */
export function dress(id: string, team: number, edge = 0.012): Parts {
  const def = AGENT_BY_ID[id] ?? AGENTS[0];
  const { look, tailRoot, antennaOnChest, tailOnChest, fp, ...core } = (BUILD[def.id] ?? byte)(def, team);
  const parts: Parts = { ...core, ...limbs(look), sleeve: fp[0], glove: fp[1] };
  const solid = [parts.pelvis, parts.chest, parts.head, ...parts.upper, ...parts.fore, ...parts.hand, ...parts.thigh, ...parts.shin, ...parts.foot];
  for (const g of solid) {
    if (edge > 0) outline(g, edge);
    bakeColored(g);
  }
  if (parts.antenna) {
    if (edge > 0) outline(parts.antenna, edge);
    bakeColored(parts.antenna);
    (antennaOnChest ? parts.chest : parts.head).add(parts.antenna);
  }
  if (parts.screen) parts.head.add(parts.screen);
  for (const e of parts.eyes) parts.head.add(e);
  if (tailRoot) {
    if (edge > 0) outline(tailRoot, edge);
    tailRoot.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && !m.userData.outline) m.castShadow = true;
    });
    (tailOnChest ? parts.chest : parts.pelvis).add(tailRoot);
  }
  return parts;
}
