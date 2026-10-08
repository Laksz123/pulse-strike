/**
 * Set dressing for the maps: vehicles, barrels, stalls, tanks. Every prop is a group with its
 * origin on the ground at its centre, outlined like the weapons and agents so the whole game reads
 * as one drawing. Props are handed to the map kit, which merges them into the level geometry.
 */

import * as THREE from "three";
import { outline, pbr, rb, sph, tx, ty, tz } from "./models";

const DARK = () => pbr(0x23262d, 0.2, 0.6);
const TYRE = () => pbr(0x1a1b20, 0, 0.9);
const STEEL = () => pbr(0x9099a5, 0.7, 0.4);
const GLASS = () => pbr(0x16293a, 0.6, 0.12);
const paint = (c: number) => pbr(c, 0.15, 0.45);
const lamp = (c: number) => pbr(c, 0, 0.3, c);

function done(g: THREE.Group, edge = 0.03): THREE.Group {
  outline(g, edge);
  return g;
}

function wheels(g: THREE.Group, xs: number[], halfTrack: number, r = 0.38): void {
  for (const x of xs) {
    for (const s of [-1, 1]) {
      const w = tx(g, r, 0.28, 0, r, 0, TYRE(), 18);
      w.position.set(x, r, s * halfTrack);
      w.rotation.set(Math.PI / 2, 0, 0);
      const hub = tx(g, r * 0.5, 0.3, 0, r, 0, STEEL(), 12);
      hub.position.set(x, r, s * halfTrack);
      hub.rotation.set(Math.PI / 2, 0, 0);
    }
  }
}

/** A car, 4.4 m long along X. */
export function car(color: number, kind: "sedan" | "pickup" | "van" = "sedan"): THREE.Group {
  const g = new THREE.Group();
  const body = paint(color);
  if (kind === "van") {
    rb(g, 4.6, 1.5, 1.9, 0, 1.25, 0, body, 0.22);
    rb(g, 1.2, 0.6, 1.92, 1.5, 1.5, 0, GLASS(), 0.1);
    rb(g, 0.05, 0.6, 1.5, 2.29, 1.5, 0, GLASS(), 0.02);
    for (const s of [-1, 1]) rb(g, 1.6, 1.1, 0.04, -0.9, 1.3, s * 0.95, paint(0xffffff), 0.05);
  } else {
    rb(g, 4.4, 0.7, 1.85, 0, 0.72, 0, body, 0.2);
    if (kind === "sedan") {
      rb(g, 2.3, 0.62, 1.66, -0.2, 1.32, 0, body, 0.24);
      rb(g, 2.34, 0.4, 1.5, -0.2, 1.34, 0, GLASS(), 0.12);
      rb(g, 1.7, 0.42, 1.7, -0.2, 1.34, 0, GLASS(), 0.12);
    } else {
      rb(g, 1.5, 0.7, 1.7, 0.5, 1.36, 0, body, 0.22);
      rb(g, 1.54, 0.42, 1.5, 0.5, 1.4, 0, GLASS(), 0.12);
      rb(g, 1.1, 0.44, 1.74, 0.5, 1.4, 0, GLASS(), 0.12);
      for (const s of [-1, 1]) rb(g, 1.9, 0.42, 0.1, -1.2, 1.2, s * 0.86, body, 0.04);
      rb(g, 0.1, 0.42, 1.8, -2.14, 1.2, 0, body, 0.04);
      rb(g, 0.5, 0.5, 0.5, -1.0, 1.3, 0.3, pbr(0xc98a3a, 0, 0.8), 0.04);
      ty(g, 0.26, 0.6, -1.6, 1.36, -0.35, paint(0x2f8cff));
    }
  }
  const front = kind === "van" ? 2.3 : 2.2;
  for (const s of [-1, 1]) {
    rb(g, 0.08, 0.2, 0.36, front, kind === "van" ? 0.85 : 0.82, s * 0.62, lamp(0xfff2c0), 0.04);
    rb(g, 0.08, 0.16, 0.36, -front, kind === "van" ? 0.9 : 0.86, s * 0.66, lamp(0xff3b30), 0.04);
  }
  rb(g, 0.16, 0.26, 1.9, front - 0.02, 0.5, 0, DARK(), 0.06);
  rb(g, 0.16, 0.26, 1.9, -front + 0.02, 0.5, 0, DARK(), 0.06);
  rb(g, 0.06, 0.2, 0.9, front + 0.02, 0.72, 0, DARK(), 0.03);
  wheels(g, [1.4, -1.4], 0.84);
  return done(g);
}

/** A box truck, 7.6 m long along X. */
export function truck(color: number, cargo = 0xe9edf2): THREE.Group {
  const g = new THREE.Group();
  rb(g, 2.0, 1.9, 2.3, 2.7, 1.55, 0, paint(color), 0.25);
  rb(g, 0.9, 0.75, 2.34, 3.1, 1.9, 0, GLASS(), 0.12);
  rb(g, 0.06, 0.75, 1.9, 3.71, 1.9, 0, GLASS(), 0.03);
  rb(g, 5.4, 2.6, 2.4, -1.1, 2.0, 0, paint(cargo), 0.08);
  for (const x of [-3.2, -1.1, 1.0]) rb(g, 0.1, 2.62, 2.44, x, 2.0, 0, paint(color), 0.03);
  rb(g, 7.4, 0.3, 1.6, 0, 0.62, 0, DARK(), 0.08);
  for (const s of [-1, 1]) rb(g, 0.1, 0.26, 0.4, 3.72, 0.9, s * 0.8, lamp(0xfff2c0), 0.04);
  rb(g, 0.2, 0.34, 2.36, 3.68, 0.52, 0, DARK(), 0.08);
  wheels(g, [2.7, -1.6, -2.8], 1.02, 0.5);
  return done(g, 0.035);
}

export function forklift(): THREE.Group {
  const g = new THREE.Group();
  const y = paint(0xffc21a);
  rb(g, 1.7, 0.7, 1.15, -0.2, 0.75, 0, y, 0.14);
  rb(g, 0.7, 0.6, 1.1, -0.8, 1.3, 0, DARK(), 0.12);
  rb(g, 0.5, 0.12, 0.6, -0.1, 1.15, 0, DARK(), 0.04);
  rb(g, 0.14, 0.5, 0.6, -0.36, 1.4, 0, DARK(), 0.04);
  for (const [x, z] of [[-0.95, 0.5], [-0.95, -0.5], [0.45, 0.5], [0.45, -0.5]]) ty(g, 0.04, 1.25, x, 1.7, z, DARK());
  rb(g, 1.6, 0.07, 1.2, -0.25, 2.35, 0, y, 0.03);
  for (const s of [-1, 1]) {
    rb(g, 0.12, 2.5, 0.12, 0.78, 1.35, s * 0.4, STEEL(), 0.03);
    rb(g, 1.2, 0.06, 0.14, 1.4, 0.18, s * 0.34, STEEL(), 0.02);
  }
  rb(g, 0.1, 0.5, 1.0, 0.86, 0.5, 0, DARK(), 0.03);
  ty(g, 0.06, 0.1, -0.7, 2.44, 0.3, lamp(0xff8a1a));
  wheels(g, [0.4, -0.7], 0.6, 0.3);
  return done(g, 0.025);
}

export function barrel(color: number): THREE.Group {
  const g = new THREE.Group();
  ty(g, 0.42, 1.15, 0, 0.575, 0, paint(color), 0.42, 18);
  for (const y of [0.08, 0.4, 0.76, 1.1]) ty(g, 0.44, 0.06, 0, y, 0, paint(color), 0.44, 18);
  ty(g, 0.36, 0.02, 0, 1.16, 0, DARK(), 0.36, 18);
  ty(g, 0.06, 0.04, 0.2, 1.18, 0, STEEL(), 0.06, 10);
  return done(g, 0.022);
}

export function dumpster(color = 0x2f8f5a): THREE.Group {
  const g = new THREE.Group();
  rb(g, 2.2, 1.1, 1.2, 0, 0.7, 0, paint(color), 0.08);
  rb(g, 2.3, 0.12, 1.3, 0, 1.3, 0, DARK(), 0.04);
  for (const x of [-0.6, 0.6]) rb(g, 0.08, 0.9, 1.24, x, 0.7, 0, paint(color), 0.02);
  for (const x of [-0.9, 0.9]) for (const z of [-0.5, 0.5]) ty(g, 0.09, 0.16, x, 0.08, z, TYRE());
  return done(g, 0.025);
}

/** A concrete road barrier, 2.4 m long along X. */
export function barrier(stripe = 0xffc21a): THREE.Group {
  const g = new THREE.Group();
  rb(g, 2.4, 0.4, 0.7, 0, 0.2, 0, pbr(0xb9bec6, 0, 0.9), 0.06);
  rb(g, 2.36, 0.7, 0.36, 0, 0.72, 0, pbr(0xc6cbd2, 0, 0.9), 0.08);
  for (const x of [-0.8, 0, 0.8]) rb(g, 0.36, 0.3, 0.38, x, 0.8, 0, paint(stripe), 0.03).rotation.z = 0.5;
  return done(g, 0.022);
}

/** A wall of sandbags, 2.6 m long along X, waist high. */
export function sandbags(): THREE.Group {
  const g = new THREE.Group();
  const bag = pbr(0xc9b182, 0, 1);
  for (let row = 0; row < 4; row++) {
    for (let i = 0; i < 4 - (row === 3 ? 1 : 0); i++) {
      const x = -0.98 + i * 0.65 + (row % 2 ? 0.32 : 0);
      rb(g, 0.66, 0.27, 0.42, x, 0.14 + row * 0.25, (row % 2 ? 0.03 : -0.03), row % 2 ? pbr(0xbba476, 0, 1) : bag, 0.11);
    }
  }
  return done(g, 0.02);
}

export function cone(): THREE.Group {
  const g = new THREE.Group();
  rb(g, 0.42, 0.05, 0.42, 0, 0.025, 0, paint(0xff7a1a), 0.02);
  ty(g, 0.16, 0.6, 0, 0.34, 0, paint(0xff7a1a), 0.04, 14);
  ty(g, 0.115, 0.1, 0, 0.38, 0, paint(0xffffff), 0.09, 14);
  return done(g, 0.015);
}

/** A market stall, 3 m wide along X: counter, goods and a striped awning. */
export function stall(awning: THREE.Material, goods: number[]): THREE.Group {
  const g = new THREE.Group();
  const wood = pbr(0x9a6a3a, 0, 0.85);
  rb(g, 3.0, 0.9, 1.0, 0, 0.45, 0, wood, 0.05);
  rb(g, 3.1, 0.08, 1.1, 0, 0.94, 0, pbr(0x7a4f28, 0, 0.85), 0.03);
  for (const x of [-1.42, 1.42]) for (const z of [-0.55, 0.55]) ty(g, 0.05, 2.6, x, 1.3, z, wood, 0.05, 8);
  const top = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.06, 1.9), awning);
  top.position.set(0, 2.62, 0.2);
  top.rotation.x = 0.22;
  top.castShadow = true;
  top.receiveShadow = true;
  g.add(top);
  goods.forEach((c, i) => {
    const x = -1.1 + (i % 4) * 0.72;
    rb(g, 0.6, 0.22, 0.6, x, 1.08, i < 4 ? -0.1 : 0.1, pbr(0xc98a3a, 0, 0.9), 0.03);
    for (let k = 0; k < 5; k++) sph(g, 0.11, x - 0.16 + (k % 3) * 0.16, 1.24 + (k > 2 ? 0.1 : 0), -0.2 + (k % 2) * 0.2 + (i < 4 ? 0 : 0.2), pbr(c, 0, 0.5));
  });
  return done(g, 0.022);
}

export function palm(): THREE.Group {
  const g = new THREE.Group();
  const bark = pbr(0x8a6a44, 0, 1);
  let x = 0;
  for (let i = 0; i < 6; i++) {
    ty(g, 0.2 - i * 0.012, 0.95, x, 0.45 + i * 0.9, 0, i % 2 ? bark : pbr(0x7a5c3a, 0, 1), 0.17 - i * 0.012, 8);
    x += 0.07 * i * 0.3;
  }
  const leaf = pbr(0x3f9a3c, 0, 0.8);
  const leaf2 = pbr(0x56b548, 0, 0.8);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const l = sph(g, 1, x + Math.cos(a) * 1.25, 5.55 - (i % 2) * 0.12, Math.sin(a) * 1.25, i % 2 ? leaf : leaf2, 1.5, 0.07, 0.36);
    l.rotation.set(0, -a, -0.38);
  }
  for (let i = 0; i < 3; i++) sph(g, 0.16, x + Math.cos(i * 2.1) * 0.22, 5.3, Math.sin(i * 2.1) * 0.22, pbr(0x6b4a2e, 0, 0.9));
  return done(g, 0.03);
}

export function fountain(stone: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const add = (r: number, h: number, y: number, m: THREE.Material, r2 = r) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r2, r, h, 14), m);
    mesh.position.y = y;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    g.add(mesh);
  };
  add(2.3, 0.7, 0.35, stone);
  add(2.0, 0.1, 0.68, pbr(0x39b8e8, 0.1, 0.15, 0x124a66), 2.0);
  add(0.4, 1.6, 0.8, stone, 0.3);
  add(0.5, 0.25, 1.7, stone, 1.1);
  add(1.0, 0.06, 1.82, pbr(0x39b8e8, 0.1, 0.15, 0x124a66), 1.0);
  add(0.16, 0.7, 2.1, stone, 0.1);
  return done(g, 0.03);
}

/** A big clay pot. */
export function pot(color = 0xc9703a): THREE.Group {
  const g = new THREE.Group();
  sph(g, 0.42, 0, 0.42, 0, pbr(color, 0, 0.8), 1, 1.05, 1);
  ty(g, 0.26, 0.18, 0, 0.86, 0, pbr(color, 0, 0.8), 0.22, 14);
  ty(g, 0.28, 0.05, 0, 0.96, 0, pbr(0x8a4a22, 0, 0.8), 0.28, 14);
  return done(g, 0.02);
}

/** A horizontal fuel tank on cradles, 5 m long along X. */
export function fuelTank(color = 0xe9edf2, stripe = 0xff3b30): THREE.Group {
  const g = new THREE.Group();
  const body = tx(g, 1.3, 4.4, 0, 1.75, 0, paint(color), 22);
  void body;
  for (const s of [-1, 1]) sph(g, 1.3, s * 2.2, 1.75, 0, paint(color), 0.35, 1, 1);
  tx(g, 1.32, 0.5, 0, 1.75, 0, paint(stripe), 22);
  for (const x of [-1.5, 1.5]) rb(g, 0.4, 0.9, 2.2, x, 0.45, 0, pbr(0x8f959e, 0, 0.9), 0.05);
  ty(g, 0.2, 0.3, 0.9, 3.15, 0, STEEL());
  ty(g, 0.3, 0.06, 0.9, 3.32, 0, paint(stripe));
  for (let i = 0; i < 7; i++) rb(g, 0.04, 0.04, 0.5, -1.0, 0.4 + i * 0.42, 1.36, STEEL(), 0.01);
  for (const s of [-0.24, 0.24]) rb(g, 0.04, 3.0, 0.04, -1.0, 1.6, 1.36 + s, STEEL(), 0.01);
  return done(g, 0.03);
}

/** A lamp post. `head` glows. */
export function lampPost(color: number, h = 5): THREE.Group {
  const g = new THREE.Group();
  ty(g, 0.16, 0.5, 0, 0.25, 0, DARK(), 0.12, 10);
  ty(g, 0.07, h, 0, h / 2, 0, DARK(), 0.055, 10);
  rb(g, 1.1, 0.08, 0.1, 0.5, h, 0, DARK(), 0.03);
  rb(g, 0.6, 0.12, 0.3, 0.9, h - 0.08, 0, DARK(), 0.04);
  rb(g, 0.5, 0.05, 0.22, 0.9, h - 0.16, 0, lamp(color), 0.02);
  return done(g, 0.02);
}

/** A guard tower: legs, a cabin and a searchlight. */
export function tower(): THREE.Group {
  const g = new THREE.Group();
  const m = pbr(0x4a515c, 0.3, 0.6);
  for (const x of [-1, 1]) for (const z of [-1, 1]) rb(g, 0.2, 5, 0.2, x, 2.5, z, m, 0.04);
  for (const y of [1.4, 3.2]) {
    rb(g, 2.2, 0.1, 0.1, 0, y, 1, m, 0.02);
    rb(g, 2.2, 0.1, 0.1, 0, y, -1, m, 0.02);
    rb(g, 0.1, 0.1, 2.2, 1, y, 0, m, 0.02);
    rb(g, 0.1, 0.1, 2.2, -1, y, 0, m, 0.02);
  }
  rb(g, 2.8, 0.2, 2.8, 0, 5.1, 0, m, 0.05);
  for (const x of [-1.3, 1.3]) rb(g, 0.12, 1.1, 2.7, x, 5.75, 0, pbr(0x5c6470, 0.3, 0.6), 0.03);
  rb(g, 2.7, 1.1, 0.12, 0, 5.75, -1.3, pbr(0x5c6470, 0.3, 0.6), 0.03);
  for (const x of [-1.3, 1.3]) for (const z of [-1.3, 1.3]) rb(g, 0.1, 1.4, 0.1, x, 6.9, z, m, 0.02);
  rb(g, 3.2, 0.16, 3.2, 0, 7.65, 0, pbr(0x2f343c, 0.3, 0.6), 0.05);
  tz(g, 0.3, 0.5, 0, 6.5, 1.3, DARK(), 0.36);
  tz(g, 0.3, 0.04, 0, 6.5, 1.56, lamp(0xfff2c0));
  return done(g, 0.03);
}

/** A radar dish on a pedestal. */
export function dish(): THREE.Group {
  const g = new THREE.Group();
  const white = paint(0xe9edf2);
  rb(g, 2.2, 1.0, 2.2, 0, 0.5, 0, pbr(0x8f959e, 0, 0.9), 0.06);
  ty(g, 0.35, 2.2, 0, 2.1, 0, white, 0.28, 12);
  const bowl = sph(g, 2.0, 0, 3.9, 0.3, white, 1, 1, 0.28);
  bowl.rotation.x = -0.6;
  const arm = ty(g, 0.05, 1.5, 0, 4.4, 1.0, STEEL(), 0.05, 8);
  arm.rotation.x = 0.97;
  sph(g, 0.16, 0, 4.85, 1.62, lamp(0xff3b30));
  return done(g, 0.035);
}

/** A helicopter parked on its skids, nose along +X. */
export function helicopter(color = 0x2b3340): THREE.Group {
  const g = new THREE.Group();
  const body = paint(color);
  sph(g, 1.2, 0.6, 1.7, 0, body, 1.9, 1, 1);
  sph(g, 1.0, 1.7, 1.75, 0, GLASS(), 1.25, 0.86, 0.94);
  const boom = tx(g, 0.28, 4.4, -3.4, 2.0, 0, body, 12);
  void boom;
  rb(g, 0.9, 1.4, 0.1, -5.5, 2.5, 0, body, 0.04);
  rb(g, 0.5, 0.1, 1.4, -5.3, 2.1, 0, body, 0.03);
  tx(g, 0.5, 0.06, -5.55, 2.6, 0.12, STEEL(), 14).rotation.set(Math.PI / 2, 0, 0);
  ty(g, 0.14, 0.6, 0.4, 2.9, 0, STEEL());
  for (const a of [0.3, 0.3 + Math.PI / 2]) {
    const blade = rb(g, 9.6, 0.05, 0.34, 0.4, 3.2, 0, DARK(), 0.02);
    blade.rotation.y = a;
  }
  for (const s of [-1, 1]) {
    rb(g, 3.6, 0.08, 0.1, 0.5, 0.12, s * 0.95, STEEL(), 0.03);
    for (const x of [-0.5, 1.4]) rb(g, 0.07, 0.9, 0.07, x, 0.55, s * 0.9, STEEL(), 0.02);
    rb(g, 1.2, 0.5, 0.06, 0.3, 1.7, s * 1.17, lamp(0xff7a1a), 0.03);
  }
  sph(g, 0.1, -5.6, 3.25, 0, lamp(0xff3b30));
  return done(g, 0.035);
}

/** A reactor core: the thing the attackers came to blow up. */
export function reactor(glow = 0x35e0ff): THREE.Group {
  const g = new THREE.Group();
  const m = pbr(0x4a515c, 0.5, 0.45);
  ty(g, 1.5, 0.5, 0, 0.25, 0, m, 1.3, 16);
  ty(g, 0.7, 3.0, 0, 2.0, 0, lamp(glow), 0.7, 16);
  for (const y of [0.9, 1.9, 2.9]) ty(g, 0.86, 0.22, 0, y, 0, m, 0.86, 16);
  ty(g, 1.2, 0.5, 0, 3.75, 0, m, 1.0, 16);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    rb(g, 0.16, 3.4, 0.16, Math.cos(a) * 1.05, 2.0, Math.sin(a) * 1.05, m, 0.04);
  }
  return done(g, 0.03);
}

/** A stack of pallets with boxes. */
export function pallet(boxes = 0xc98a3a): THREE.Group {
  const g = new THREE.Group();
  const wood = pbr(0xb08350, 0, 0.9);
  for (const z of [-0.5, 0, 0.5]) rb(g, 1.2, 0.1, 0.14, 0, 0.05, z, wood, 0.02);
  for (const x of [-0.5, -0.25, 0, 0.25, 0.5]) rb(g, 0.2, 0.04, 1.2, x, 0.13, 0, wood, 0.01);
  rb(g, 1.1, 0.5, 1.1, 0, 0.41, 0, pbr(boxes, 0, 0.9), 0.04);
  rb(g, 1.1, 0.5, 0.55, 0, 0.92, -0.26, pbr(boxes, 0, 0.9), 0.04);
  rb(g, 0.55, 0.4, 0.5, -0.26, 0.87, 0.3, pbr(0xa87234, 0, 0.9), 0.04);
  rb(g, 1.12, 0.05, 0.1, 0, 0.5, 0.56, pbr(0x2f8cff, 0, 0.6), 0.01);
  return done(g, 0.022);
}

/** The bomb: a charge pack with a display. */
export function bombModel(): THREE.Group {
  const g = new THREE.Group();
  rb(g, 0.42, 0.16, 0.3, 0, 0.08, 0, pbr(0x2b3340, 0.3, 0.5), 0.04);
  for (const x of [-0.13, 0, 0.13]) tz(g, 0.055, 0.3, x, 0.2, 0, paint(0xff3b30), 0.055, 12);
  rb(g, 0.2, 0.05, 0.12, 0, 0.275, 0, DARK(), 0.015);
  rb(g, 0.14, 0.02, 0.07, 0, 0.3, 0, lamp(0xff3b30), 0.008);
  rb(g, 0.44, 0.04, 0.05, 0, 0.2, 0.1, DARK(), 0.012);
  rb(g, 0.44, 0.04, 0.05, 0, 0.2, -0.1, DARK(), 0.012);
  return done(g, 0.012);
}

/** A two-wheeled wooden hand cart loaded with sacks, 2.3 m long along X. */
export function cart(load = 0xd9c9a0): THREE.Group {
  const g = new THREE.Group();
  const wood = pbr(0x9a6a3a, 0, 0.85);
  const dark = pbr(0x6b4526, 0, 0.9);
  rb(g, 2.2, 0.12, 1.2, 0, 0.8, 0, wood, 0.03);
  for (const s of [-1, 1]) rb(g, 2.2, 0.36, 0.08, 0, 1.02, s * 0.6, dark, 0.02);
  rb(g, 0.08, 0.36, 1.2, -1.1, 1.02, 0, dark, 0.02);
  for (const s of [-1, 1]) rb(g, 1.2, 0.07, 0.07, 1.6, 0.7, s * 0.5, dark, 0.02).rotation.z = -0.14;
  for (const s of [-1, 1]) {
    tx(g, 0.56, 0.1, -0.2, 0.56, s * 0.72, dark, 18).rotation.set(Math.PI / 2, 0, 0);
    tx(g, 0.44, 0.12, -0.2, 0.56, s * 0.72, wood, 18).rotation.set(Math.PI / 2, 0, 0);
    tx(g, 0.13, 0.16, -0.2, 0.56, s * 0.72, DARK(), 10).rotation.set(Math.PI / 2, 0, 0);
  }
  rb(g, 0.1, 0.74, 0.1, 0.9, 0.37, 0, dark, 0.02);
  sph(g, 0.34, -0.5, 1.12, -0.14, pbr(load, 0, 1), 1.2, 0.75, 1);
  sph(g, 0.32, 0.22, 1.1, 0.16, pbr(load, 0, 1), 1.15, 0.7, 1);
  sph(g, 0.3, -0.12, 1.4, 0.02, pbr(0xc9b182, 0, 1), 1.1, 0.7, 1);
  return done(g, 0.025);
}

/** A bench, 1.8 m long along X, its back to -Z. */
export function bench(): THREE.Group {
  const g = new THREE.Group();
  const wood = pbr(0xa8743c, 0, 0.85);
  for (const z of [-0.14, 0.02, 0.18]) rb(g, 1.8, 0.06, 0.14, 0, 0.47, z, wood, 0.02);
  for (const y of [0.72, 0.92]) rb(g, 1.8, 0.14, 0.05, 0, y, -0.25, wood, 0.02);
  for (const x of [-0.74, 0.74]) {
    rb(g, 0.08, 0.46, 0.46, x, 0.23, 0, DARK(), 0.02);
    rb(g, 0.08, 0.56, 0.06, x, 0.74, -0.25, DARK(), 0.02);
  }
  return done(g, 0.02);
}

/** A stone well with a little tiled roof, 2.4 m across. */
export function well(stone: THREE.Material, roof: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const add = (r: number, h: number, y: number, m: THREE.Material, r2 = r) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r2, r, h, 14), m);
    mesh.position.y = y;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    g.add(mesh);
  };
  const wood = pbr(0x7a4f28, 0, 0.85);
  add(1.2, 0.95, 0.475, stone, 1.12);
  add(1.24, 0.12, 0.98, stone);
  add(0.92, 0.04, 1.02, pbr(0x2a9fd8, 0.1, 0.15, 0x0f3f5c));
  for (const s of [-1, 1]) rb(g, 0.16, 2.0, 0.16, s * 1.02, 1.95, 0, wood, 0.03);
  tx(g, 0.07, 2.2, 0, 2.5, 0, wood, 10);
  tx(g, 0.16, 0.7, 0, 2.5, 0, pbr(0xc9b182, 0, 1), 12);
  ty(g, 0.012, 0.9, 0.1, 2.05, 0, DARK(), 0.012, 6);
  ty(g, 0.17, 0.26, 0.1, 1.5, 0, pbr(0x8a6a44, 0, 0.9), 0.14, 12);
  for (const s of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.08, 1.05), roof);
    side.position.set(0, 3.22, s * 0.44);
    side.rotation.x = s * 0.6;
    side.castShadow = true;
    g.add(side);
  }
  rb(g, 2.72, 0.1, 0.12, 0, 3.52, 0, wood, 0.03);
  return done(g, 0.03);
}

/** A lantern on a short chain; its origin is the hook it hangs from. */
export function lantern(glow = 0xffc86a): THREE.Group {
  const g = new THREE.Group();
  ty(g, 0.012, 0.16, 0, -0.08, 0, DARK(), 0.012, 6);
  rb(g, 0.3, 0.05, 0.3, 0, -0.18, 0, DARK(), 0.02);
  rb(g, 0.22, 0.32, 0.22, 0, -0.36, 0, lamp(glow), 0.04);
  rb(g, 0.27, 0.05, 0.27, 0, -0.54, 0, DARK(), 0.02);
  for (const [x, z] of [[-0.11, -0.11], [0.11, -0.11], [-0.11, 0.11], [0.11, 0.11]]) rb(g, 0.025, 0.34, 0.025, x, -0.36, z, DARK(), 0.008);
  return done(g, 0.015);
}

/** A heap of sacks, about 1.4 m across and knee high. */
export function sacks(color = 0xd9c9a0): THREE.Group {
  const g = new THREE.Group();
  const a = pbr(color, 0, 1);
  const b = pbr(0xc9b182, 0, 1);
  sph(g, 0.36, -0.36, 0.24, 0.1, a, 1.25, 0.68, 0.9);
  sph(g, 0.36, 0.38, 0.24, -0.08, b, 1.2, 0.68, 0.95);
  sph(g, 0.34, 0.02, 0.26, 0.42, a, 0.95, 0.7, 1.2).rotation.y = 0.5;
  sph(g, 0.34, 0.04, 0.62, 0.02, b, 1.2, 0.66, 0.9).rotation.y = 0.9;
  return done(g, 0.022);
}

/** An air conditioner box for a wall; its back is at Z = 0, facing +Z. */
export function aircon(): THREE.Group {
  const g = new THREE.Group();
  rb(g, 0.9, 0.6, 0.4, 0, 0, 0.2, pbr(0xe6e9ee, 0.1, 0.6), 0.04);
  tz(g, 0.22, 0.02, 0.12, 0, 0.41, DARK(), 0.22, 16);
  for (let i = 0; i < 4; i++) rb(g, 0.28, 0.02, 0.02, -0.26, -0.18 + i * 0.12, 0.41, DARK(), 0.006);
  for (const x of [-0.36, 0.36]) rb(g, 0.05, 0.05, 0.44, x, -0.33, 0.22, DARK(), 0.01);
  return done(g, 0.015);
}

/** A pine with snow on its boughs, about 6 m tall. */
export function pine(h = 6): THREE.Group {
  const g = new THREE.Group();
  ty(g, 0.22, h * 0.3, 0, h * 0.15, 0, pbr(0x6b4a2e, 0, 1), 0.18, 8);
  const green = [pbr(0x2f6b45, 0, 0.9), pbr(0x3a7d52, 0, 0.9)];
  const snow = pbr(0xf4f8ff, 0, 0.9);
  for (let i = 0; i < 4; i++) {
    const r = 1.75 - i * 0.38;
    const y = h * 0.24 + i * h * 0.19;
    ty(g, r, h * 0.26, 0, y + h * 0.13, 0, green[i % 2], 0.06, 9);
    ty(g, r * 0.8, h * 0.07, 0, y + h * 0.17, 0, snow, r * 0.52, 9);
  }
  return done(g, 0.03);
}

/** A snowman: three balls, a carrot, a bucket for a hat and a scarf. */
export function snowman(scarf = 0xe8483c): THREE.Group {
  const g = new THREE.Group();
  const snow = pbr(0xf6f9ff, 0, 0.9);
  sph(g, 0.52, 0, 0.46, 0, snow, 1, 0.9, 1);
  sph(g, 0.38, 0, 1.1, 0, snow, 1, 0.92, 1);
  sph(g, 0.27, 0, 1.6, 0, snow);
  ty(g, 0.3, 0.07, 0, 1.3, 0, pbr(scarf, 0, 0.8), 0.3, 14);
  rb(g, 0.12, 0.34, 0.06, 0.16, 1.14, 0.3, pbr(scarf, 0, 0.8), 0.02);
  ty(g, 0.19, 0.24, 0, 1.92, 0, pbr(0x4a8fd0, 0.3, 0.5), 0.15, 12);
  tz(g, 0.01, 0.24, 0, 1.6, 0.36, pbr(0xff8a1a, 0, 0.6), 0.05, 8);
  for (const x of [-0.1, 0.1]) sph(g, 0.035, x, 1.68, 0.24, DARK());
  for (const y of [0.98, 1.14, 1.3]) sph(g, 0.04, 0, y - 0.1, 0.37, DARK());
  for (const s of [-1, 1]) rb(g, 0.5, 0.035, 0.035, s * 0.52, 1.2, 0, pbr(0x6b4a2e, 0, 1), 0.01).rotation.z = s * 0.5;
  return done(g, 0.025);
}

/** A stack of firewood logs with snow on top, 2.4 m long along X and chest high. */
export function logPile(): THREE.Group {
  const g = new THREE.Group();
  const bark = pbr(0x7a5536, 0, 1);
  const cut = pbr(0xd9b98a, 0, 0.9);
  const rows = [4, 3, 2];
  rows.forEach((n, row) => {
    for (let i = 0; i < n; i++) {
      const z = (i - (n - 1) / 2) * 0.44;
      const y = 0.22 + row * 0.38;
      tx(g, 0.21, 2.4, 0, y, z, bark, 12);
      for (const s of [-1, 1]) tx(g, 0.17, 0.02, s * 1.2, y, z, cut, 12);
    }
  });
  rb(g, 2.3, 0.14, 0.8, 0, 1.2, 0, pbr(0xf4f8ff, 0, 0.9), 0.06);
  return done(g, 0.025);
}

/** Skis and boards stood in a rack, 1.8 m wide along X, leaning back toward -Z. */
export function skiRack(): THREE.Group {
  const g = new THREE.Group();
  const wood = pbr(0x8a5e38, 0, 0.9);
  rb(g, 1.8, 0.1, 0.1, 0, 1.0, -0.12, wood, 0.02);
  rb(g, 1.8, 0.1, 0.3, 0, 0.06, 0, wood, 0.02);
  for (const x of [-0.86, 0.86]) rb(g, 0.1, 1.1, 0.1, x, 0.55, -0.12, wood, 0.02);
  const colors = [0xff4a5a, 0x2fb7c9, 0xffc93a, 0x7fd44a, 0xff8a3a, 0x9b6dff];
  colors.forEach((c, i) => {
    const board = i % 3 === 2;
    const s = rb(g, board ? 0.26 : 0.09, board ? 1.45 : 1.75, 0.03, -0.72 + i * 0.29, board ? 0.78 : 0.92, 0, pbr(c, 0.1, 0.5), 0.03);
    s.rotation.x = -0.12;
  });
  return done(g, 0.02);
}

/** A cable-car cabin on its hanger; the origin is where it grips the cable. */
export function gondola(color = 0xe8483c): THREE.Group {
  const g = new THREE.Group();
  rb(g, 0.16, 1.5, 0.16, 0, -0.75, 0, DARK(), 0.04);
  rb(g, 0.9, 0.16, 0.5, 0, -0.06, 0, DARK(), 0.05);
  rb(g, 2.6, 2.0, 1.9, 0, -2.5, 0, paint(color), 0.3);
  rb(g, 2.64, 0.8, 1.6, 0, -2.2, 0, pbr(0xffe2a0, 0, 0.3, 0xffc86a), 0.1);
  rb(g, 2.3, 0.8, 1.94, 0, -2.2, 0, pbr(0xffe2a0, 0, 0.3, 0xffc86a), 0.1);
  rb(g, 2.7, 0.14, 2.0, 0, -1.48, 0, pbr(0xf4f8ff, 0, 0.9), 0.06);
  return done(g, 0.04);
}

/** A fire hydrant. */
export function hydrant(color = 0xff4a3d): THREE.Group {
  const g = new THREE.Group();
  ty(g, 0.17, 0.62, 0, 0.31, 0, paint(color), 0.15, 12);
  sph(g, 0.16, 0, 0.64, 0, paint(color), 1, 0.7, 1);
  ty(g, 0.2, 0.06, 0, 0.05, 0, paint(color), 0.2, 12);
  tx(g, 0.07, 0.5, 0, 0.42, 0, STEEL(), 10);
  return done(g, 0.018);
}

/** A heap of full rubbish bags. */
export function trashBags(): THREE.Group {
  const g = new THREE.Group();
  const a = pbr(0x23262d, 0.1, 0.5);
  const b = pbr(0x2f3340, 0.1, 0.5);
  sph(g, 0.4, -0.3, 0.32, 0.05, a, 1.05, 0.85, 0.95);
  sph(g, 0.38, 0.36, 0.3, -0.1, b, 1, 0.8, 1.05);
  sph(g, 0.34, 0.02, 0.3, 0.42, a, 0.95, 0.82, 1);
  sph(g, 0.3, 0.05, 0.66, 0.08, b, 1, 0.8, 1);
  return done(g, 0.02);
}

/** A bus shelter, 3.4 m wide along X, open toward +Z, with a bench inside. */
export function busStop(glow = 0x3fe0ff): THREE.Group {
  const g = new THREE.Group();
  const frame = DARK();
  for (const x of [-1.66, 1.66]) rb(g, 0.1, 2.5, 0.1, x, 1.25, -0.6, frame, 0.02);
  rb(g, 3.6, 0.12, 1.5, 0, 2.56, -0.05, frame, 0.04);
  rb(g, 3.3, 1.9, 0.05, 0, 1.25, -0.62, pbr(0x9fd8ff, 0.2, 0.15, 0x16304a, 0.45), 0.02);
  rb(g, 0.05, 1.9, 1.1, -1.66, 1.25, -0.1, pbr(glow, 0, 0.3, glow), 0.02);
  rb(g, 2.2, 0.08, 0.42, 0.3, 0.5, -0.3, STEEL(), 0.02);
  for (const x of [-0.6, 1.2]) rb(g, 0.08, 0.5, 0.36, x, 0.25, -0.3, frame, 0.02);
  rb(g, 3.5, 0.06, 0.06, 0, 2.46, 0.66, pbr(glow, 0, 0.3, glow), 0.02);
  return done(g, 0.02);
}

/** A clipped city tree: a thin trunk and a round head of leaves. */
export function bush(): THREE.Group {
  const g = new THREE.Group();
  ty(g, 0.09, 1.5, 0, 0.75, 0, pbr(0x5a3e2a, 0, 1), 0.07, 8);
  const leaf = pbr(0x2f8a5a, 0, 0.9);
  sph(g, 0.8, 0, 2.0, 0, leaf, 1, 0.9, 1);
  sph(g, 0.55, 0.45, 1.75, 0.2, pbr(0x3aa06a, 0, 0.9));
  sph(g, 0.5, -0.4, 1.8, -0.25, leaf);
  return done(g, 0.03);
}
