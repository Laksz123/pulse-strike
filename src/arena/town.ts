/**
 * What a street is made of, whatever the town: houses with windows and eaves, doors painted on
 * walls, awnings, strings of flags and lamps, door leaves standing open. A map hands over its
 * materials and pictures as a style and gets the pieces back, so three different places are built
 * the same way and read as one game.
 */

import * as THREE from "three";
import type { Kit, P2 } from "./map";
import * as P from "./props";

export type Side = "n" | "s" | "w" | "e";

/** How one house looks. */
export interface Look {
  wall: THREE.Material;
  /** A painted band along the foot of the walls. */
  band?: THREE.Material;
  /** The sides that face somewhere people go: they get windows. */
  faces?: string;
  /** The style's first kind of window rather than its second. */
  shutters?: boolean;
  /** Roof beams poking out under the eaves, and the style's second roof. */
  beams?: boolean;
  /** The ground outside those sides is this high. */
  lift?: number;
}

/** A picture for a wall: its file, how wide and tall it hangs, and how far up or down from the usual place. */
export type Pic = [name: string, w: number, h: number, dy?: number];

export interface Style {
  /** The same town every time: the little choices come out of this, not out of chance. */
  seed: number;
  /** Eaves: on plain houses, and on houses with beams. */
  trim: THREE.Material;
  roof: THREE.Material;
  beam: THREE.Material;
  iron: THREE.Material;
  /** Bulbs on a string. */
  bulb: THREE.Material;
  awnings: THREE.Material[];
  /** Colours of flags and washing. */
  cloth: number[];
  /** The two kinds of window, and how often the second has an awning over it. */
  window: Pic;
  screen: Pic;
  screenAwning: number;
  /** How brightly windows and shop fronts glow: nothing by day. */
  lit?: number;
  doors: Record<string, Pic>;
  /** Door leaves standing open. */
  leaf: THREE.Material;
  /** A tub with something growing in it. */
  tub: THREE.Material;
  tree: () => THREE.Group;
  /** The colour of lamp light. */
  lamp: number;
}

/** Which way each side of a building faces. */
export const YAW: Record<Side, number> = { n: Math.PI, s: 0, w: -Math.PI / 2, e: Math.PI / 2 };

export function town(k: Kit, st: Style) {
  let seed = st.seed;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pick = <T,>(list: T[]) => list[Math.floor(rnd() * list.length)];
  const cloth = st.cloth.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, side: THREE.DoubleSide }));

  /** A canvas awning hung on a wall, sloping down and out. */
  const awning = (x: number, y: number, z: number, w: number, out: number, yaw: number, m: THREE.Material) => {
    const top = new THREE.BoxGeometry(w, 0.05, out);
    top.translate(0, 0, out / 2);
    const lip = new THREE.BoxGeometry(w, 0.2, 0.04);
    lip.translate(0, -0.1, out);
    for (const g of [top, lip]) {
      g.rotateX(0.36);
      g.rotateY(yaw);
      g.translate(x, y, z);
      k.add(m, g);
    }
  };

  /** A string from one point to another that sags, hung with flags, washing or lamps. */
  const line = (a: [number, number, number], b: [number, number, number], kind: "flags" | "wash" | "lamps", sag = 0.6) => {
    const A = new THREE.Vector3(...a);
    const B = new THREE.Vector3(...b);
    const mid = A.clone().lerp(B, 0.5);
    mid.y -= sag * 2;
    const curve = new THREE.QuadraticBezierCurve3(A, mid, B);
    k.add(st.iron, new THREE.TubeGeometry(curve, 14, 0.014, 4), false);
    const len = A.distanceTo(B);
    const dir = B.clone().sub(A).setY(0).normalize();
    const step = kind === "flags" ? 0.5 : kind === "lamps" ? 1.1 : 0.95;
    const n = Math.floor(len / step);
    for (let i = 1; i < n; i++) {
      const p = curve.getPoint(i / n);
      if (kind === "lamps") {
        const g = new THREE.SphereGeometry(0.09, 8, 6);
        g.translate(p.x, p.y - 0.1, p.z);
        k.add(st.bulb, g, false);
        continue;
      }
      const half = kind === "flags" ? 0.17 : 0.3 + rnd() * 0.12;
      const drop = kind === "flags" ? 0.4 : 0.55 + rnd() * 0.35;
      const l = [p.x - dir.x * half, p.y, p.z - dir.z * half];
      const r = [p.x + dir.x * half, p.y, p.z + dir.z * half];
      const pos = kind === "flags" ? [...l, ...r, p.x, p.y - drop, p.z] : [...l, ...r, r[0], p.y - drop, r[2], ...l, r[0], p.y - drop, r[2], l[0], p.y - drop, l[2]];
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.computeVertexNormals();
      if (kind === "wash" && rnd() < 0.25) continue;
      k.add(cloth[kind === "flags" ? i % Math.min(5, cloth.length) : Math.floor(rnd() * cloth.length)], g, kind === "wash");
    }
  };

  /** A sheet of cloth stretched over a street for shade. */
  const shade = (x: number, z: number, w: number, d: number, y: number, m: THREE.Material, yaw = 0) => {
    k.box(x, z, w, 0.05, d, m, { y, yaw, solid: false, tile: 3 });
  };

  const sideLen = (s: Side, x1: number, z1: number, x2: number, z2: number) => (s === "n" || s === "s" ? x2 - x1 : z2 - z1);
  const sideAt = (s: Side, x1: number, z1: number, x2: number, z2: number, t: number): P2 =>
    s === "n" ? { x: x1 + t, z: z1 } : s === "s" ? { x: x1 + t, z: z2 } : s === "w" ? { x: x1, z: z1 + t } : { x: x2, z: z1 + t };

  /** A house: a solid mass with an eave, a painted foot and windows on the sides people see. */
  const block = (x1: number, z1: number, x2: number, z2: number, h: number, look: Look) => {
    const x = (x1 + x2) / 2;
    const z = (z1 + z2) / 2;
    const w = x2 - x1;
    const d = z2 - z1;
    const lift = look.lift ?? 0;
    k.box(x, z, w, h, d, look.wall, { tile: 4 });
    k.box(x, z, w + 0.44, 0.32, d + 0.44, look.beams ? st.roof : st.trim, { y: h, solid: false, tile: 2 });
    if (look.band) k.box(x, z, w + 0.08, 1.05 + lift, d + 0.08, look.band, { solid: false, tile: 4 });
    for (const s of (look.faces ?? "") as unknown as Side[]) {
      const len = sideLen(s, x1, z1, x2, z2);
      const yaw = YAW[s];
      const n = Math.floor((len - 0.6) / 3.7);
      for (let row = 0; 2.9 + lift + row * 3.1 + 2.2 < h; row++) {
        for (let i = 0; i < n; i++) {
          const p = sideAt(s, x1, z1, x2, z2, ((i + 0.5) / n) * len);
          const y = 2.9 + lift + row * 3.1;
          const roll = rnd();
          if (roll < 0.14) continue;
          if (look.shutters && roll < 0.72) k.panel(st.window[0], p.x, y + (st.window[3] ?? 0), p.z, st.window[1], st.window[2], yaw, 0xffffff, st.lit);
          else {
            k.panel(st.screen[0], p.x, y + (st.screen[3] ?? 0), p.z, st.screen[1], st.screen[2], yaw, 0xffffff, st.lit);
            if (rnd() < st.screenAwning) awning(p.x, y + 1.72, p.z, 1.8, 0.85, yaw, pick(st.awnings));
          }
        }
      }
      if (look.beams) {
        for (let t = 0.7; t < len - 0.3; t += 1.35) {
          const p = sideAt(s, x1, z1, x2, z2, t);
          const flat = s === "n" || s === "s";
          k.box(p.x + Math.sin(yaw) * 0.22, p.z + Math.cos(yaw) * 0.22, flat ? 0.17 : 0.6, 0.17, flat ? 0.6 : 0.17, st.beam, { y: h - 0.85, solid: false });
        }
      }
    }
  };

  /** A door or a shop front painted on a wall. `s` is the side of the building it is on. */
  const door = (x: number, z: number, s: Side, kind = "door", y = 0) => {
    const d = st.doors[kind];
    k.panel(d[0], x, y + (d[3] ?? 0), z, d[1], d[2], YAW[s], 0xffffff, d[0].includes("shop") || d[0].includes("store") ? st.lit : 0);
  };

  /** A lamp on a wall bracket, with or without real light. */
  const wallLamp = (x: number, y: number, z: number, s: Side, lit = 0) => {
    const nx = Math.sin(YAW[s]);
    const nz = Math.cos(YAW[s]);
    k.box(x + nx * 0.25, z + nz * 0.25, nx ? 0.5 : 0.06, 0.06, nz ? 0.5 : 0.06, st.iron, { y: y + 0.1, solid: false });
    k.prop(P.lantern(), x + nx * 0.45, z + nz * 0.45, 0, undefined, y + 0.08);
    if (lit) k.light(x + nx * 0.6, y - 0.3, z + nz * 0.6, st.lamp, lit, 15);
  };

  /** Something growing in a round tub: cover to stand behind. */
  const planter = (x: number, z: number, y = 0) => {
    k.cyl(x, z, 0.85, 0.7, st.tub, y);
    k.prop(st.tree(), x, z, rnd() * 6, undefined, y + 0.5);
  };

  /** One leaf of a door standing open: (x, z) is the hinge, `yaw` which way the leaf runs from it. */
  const leaf = (x: number, z: number, yaw: number, len = 1.5, h = 3.1, y = 0) => {
    const cx = x + (Math.cos(yaw) * len) / 2;
    const cz = z - (Math.sin(yaw) * len) / 2;
    k.box(cx, cz, len, h, 0.12, st.leaf, { y, yaw, tile: 2, nav: false });
    for (const t of [0.5, h - 0.5]) k.box(cx, cz, len + 0.02, 0.12, 0.16, st.iron, { y: y + t, yaw, solid: false });
  };

  return { rnd, pick, awning, line, shade, block, door, wallLamp, planter, leaf };
}
