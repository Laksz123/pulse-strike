/**
 * The maps. Each one is built in code from a small kit — textured boxes with world-scale UVs,
 * shells with doorways, containers, and the props — and merged into a few meshes per material.
 * Each map has a file of its own; what is here is the kit they are built with, the bots' map of
 * where they can walk, and the firing range.
 */

import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { pbr } from "./models";
import { neon } from "./neon";
import { oasis } from "./oasis";
import * as P from "./props";
import { summit } from "./summit";

const CELL = 1.25;

export interface P2 {
  x: number;
  z: number;
}

/** A walkable grid over the floor, for the bots. */
export class Nav {
  readonly cols: number;
  readonly rows: number;
  private blocked: Uint8Array;

  constructor(private hx: number, private hz: number) {
    this.cols = Math.round((hx * 2) / CELL);
    this.rows = Math.round((hz * 2) / CELL);
    this.blocked = new Uint8Array(this.cols * this.rows);
  }

  private cx(x: number): number {
    return Math.max(0, Math.min(this.cols - 1, Math.floor((x + this.hx) / CELL)));
  }
  private cz(z: number): number {
    return Math.max(0, Math.min(this.rows - 1, Math.floor((z + this.hz) / CELL)));
  }
  private at(c: number, r: number): P2 {
    return { x: -this.hx + (c + 0.5) * CELL, z: -this.hz + (r + 0.5) * CELL };
  }

  /** Marks the cells under a rotated rectangle (padded for a body's width) as blocked. */
  block(x: number, z: number, hw: number, hd: number, yaw: number, pad = 0.55): void {
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    const reach = Math.hypot(hw, hd) + pad + CELL;
    for (let r = this.cz(z - reach); r <= this.cz(z + reach); r++) {
      for (let c = this.cx(x - reach); c <= this.cx(x + reach); c++) {
        const p = this.at(c, r);
        const dx = p.x - x;
        const dz = p.z - z;
        const lx = dx * cos - dz * sin;
        const lz = dx * sin + dz * cos;
        if (Math.abs(lx) < hw + pad && Math.abs(lz) < hd + pad) this.blocked[r * this.cols + c] = 1;
      }
    }
  }

  free(x: number, z: number): boolean {
    return !this.blocked[this.cz(z) * this.cols + this.cx(x)];
  }

  randomFree(): P2 {
    for (let i = 0; i < 200; i++) {
      const c = 2 + Math.floor(Math.random() * (this.cols - 4));
      const r = 2 + Math.floor(Math.random() * (this.rows - 4));
      if (!this.blocked[r * this.cols + c]) return this.at(c, r);
    }
    return { x: 0, z: 0 };
  }

  private nearestFree(c: number, r: number): number {
    if (!this.blocked[r * this.cols + c]) return r * this.cols + c;
    for (let d = 1; d < 8; d++) {
      for (let dr = -d; dr <= d; dr++) {
        for (let dc = -d; dc <= d; dc++) {
          const cc = c + dc;
          const rr = r + dr;
          if (cc < 0 || rr < 0 || cc >= this.cols || rr >= this.rows) continue;
          if (!this.blocked[rr * this.cols + cc]) return rr * this.cols + cc;
        }
      }
    }
    return r * this.cols + c;
  }

  /** A* over the grid. Returns waypoints from just after `from` to `to`. */
  path(from: P2, to: P2): P2[] {
    const n = this.cols * this.rows;
    const start = this.nearestFree(this.cx(from.x), this.cz(from.z));
    const goal = this.nearestFree(this.cx(to.x), this.cz(to.z));
    if (start === goal) return [to];
    const g = new Float32Array(n).fill(Infinity);
    const came = new Int32Array(n).fill(-1);
    const closed = new Uint8Array(n);
    const open: number[] = [start];
    const f = new Float32Array(n).fill(Infinity);
    const gc = goal % this.cols;
    const gr = Math.floor(goal / this.cols);
    const h = (i: number) => Math.hypot((i % this.cols) - gc, Math.floor(i / this.cols) - gr);
    g[start] = 0;
    f[start] = h(start);
    let guard = 0;
    while (open.length && guard++ < 6000) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (f[open[i]] < f[open[bi]]) bi = i;
      const cur = open.splice(bi, 1)[0];
      if (cur === goal) break;
      closed[cur] = 1;
      const c = cur % this.cols;
      const r = Math.floor(cur / this.cols);
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const cc = c + dc;
          const rr = r + dr;
          if (cc < 0 || rr < 0 || cc >= this.cols || rr >= this.rows) continue;
          const ni = rr * this.cols + cc;
          if (closed[ni] || this.blocked[ni]) continue;
          // No cutting corners between two blocked cells.
          if (dr && dc && (this.blocked[r * this.cols + cc] || this.blocked[rr * this.cols + c])) continue;
          const cost = g[cur] + (dr && dc ? 1.414 : 1);
          if (cost < g[ni]) {
            g[ni] = cost;
            f[ni] = cost + h(ni);
            came[ni] = cur;
            if (!open.includes(ni)) open.push(ni);
          }
        }
      }
    }
    if (came[goal] === -1) return [to];
    const out: P2[] = [];
    for (let i = goal; i !== start && i !== -1; i = came[i]) out.push(this.at(i % this.cols, Math.floor(i / this.cols)));
    out.reverse();
    // Drop waypoints that lie on a straight run.
    return out.filter((p, i) => {
      if (i === 0 || i === out.length - 1) return true;
      const a = out[i - 1];
      const b = out[i + 1];
      return Math.abs((p.x - a.x) * (b.z - p.z) - (p.z - a.z) * (b.x - p.x)) > 0.01;
    });
  }
}


export type MapId = "oasis" | "summit" | "neon" | "range";

export interface Site {
  name: "A" | "B";
  x: number;
  z: number;
  r: number;
}

/** What a map says about itself, beyond its scenery. */
export interface MapSpec {
  /** Attackers' spawn points, then defenders'. */
  spawns: [P2[], P2[]];
  sites: Site[];
  /** Ways for attackers to reach each site, by its letter: lists of points to pass through in order. */
  routes?: Record<string, P2[][]>;
  /** Places for defenders to stand watch over each site, by its letter. */
  posts?: Record<string, P2[]>;
  /** How much the sky lights everything: lower at night. */
  env?: number;
  /** Something in the air that moves: called every frame with where the eye is. */
  tick?(dt: number, eye: THREE.Vector3): void;
}

export interface ArenaMap extends MapSpec {
  id: MapId;
  name: string;
  nav: Nav;
  half: [number, number];
  /** Spawn points for free-for-all. */
  ffa: P2[];
  /** How high the floor is at a point: zero, or the top of a platform or a ramp. */
  floorAt(x: number, z: number): number;
  /** The firing range only: where the dummies stand and the bullseyes hang. */
  range?: RangeData;
}

export interface RangeData {
  dummies: { x: number; z: number; move: number }[];
  boards: { x: number; y: number; z: number }[];
}

export const MAPS: { id: MapId; name: string; about: string; mood: string }[] = [
  { id: "oasis", name: "Oasis", about: "Город в пустыне: мид с дверями, длинная улица, тёмные туннели и два плента.", mood: "Полдень" },
  { id: "summit", name: "Summit", about: "Горная деревня в снегу: «банан» на B, главная улица, апартаменты с балконом над A.", mood: "Сумерки" },
  { id: "neon", name: "Neon", about: "Ночной квартал: аркадный зал и пандус на A, мид со снайперским гнездом, апартаменты и магазин у B.", mood: "Ночь" },
];

const HX = 36;
const HZ = 26;
const loader = new THREE.TextureLoader();
const texCache = new Map<string, THREE.Texture>();

export function texture(name: string, kind = "tex"): THREE.Texture {
  const key = `${kind}_${name}`;
  let t = texCache.get(key);
  if (!t) {
    t = loader.load(`/art/${key}.jpg`);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    texCache.set(key, t);
  }
  return t;
}

/** A box whose texture repeats every `tile` metres whatever its size. */
function boxGeo(w: number, h: number, d: number, tile: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d).toNonIndexed();
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    for (let i = 0; i < 6; i++) {
      const k = f * 6 + i;
      uv.setXY(k, (uv.getX(k) * dims[f][0]) / tile, (uv.getY(k) * dims[f][1]) / tile);
    }
  }
  return g;
}

interface BoxOpt {
  /** Height of the underside above the ground. */
  y?: number;
  yaw?: number;
  /** Metres per texture repeat. */
  tile?: number;
  /** Has a collider. */
  solid?: boolean;
  /** A floor to walk on rather than something in the way: a platform, a landing. */
  walk?: boolean;
  /** False: in the way of people but left off the bots' map, like a door standing open in a doorway. */
  nav?: boolean;
}

/** A raised floor: a rectangle `hw` by `hl` about a centre, lying along a direction, rising from `h0` at its near end to `h1`. */
interface Floor { x: number; z: number; dx: number; dz: number; hw: number; hl: number; h0: number; h1: number }

type Door = { side: "n" | "s" | "w" | "e"; at: number; w: number };

export class Kit {
  readonly nav: Nav;
  private floors: Floor[] = [];
  private batches = new Map<string, { material: THREE.Material; geos: THREE.BufferGeometry[]; shadow: boolean }>();
  private mats = new Map<string, THREE.MeshStandardMaterial>();
  private m4 = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private up = new THREE.Vector3(0, 1, 0);
  /** Big upright faces, for paint and posters: centre, outward normal, length and height. */
  private faces: { x: number; z: number; nx: number; nz: number; len: number; h: number }[] = [];

  constructor(readonly scene: THREE.Scene, readonly world: RAPIER.World, readonly hx = HX, readonly hz = HZ) {
    this.nav = new Nav(hx, hz);
  }

  /** How high the floor is at a point. */
  floorAt = (x: number, z: number): number => {
    let h = 0;
    for (const f of this.floors) {
      const along = (x - f.x) * f.dx + (z - f.z) * f.dz;
      const across = (x - f.x) * f.dz - (z - f.z) * f.dx;
      if (Math.abs(along) > f.hl || Math.abs(across) > f.hw) continue;
      h = Math.max(h, f.h0 + ((along + f.hl) / (f.hl * 2)) * (f.h1 - f.h0));
    }
    return h;
  };

  /** A hand-painted texture as a material, optionally tinted. */
  tex(name: string, tint = 0xffffff, glow = 0): THREE.MeshStandardMaterial {
    const key = `${name}:${tint}:${glow}`;
    let m = this.mats.get(key);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ map: texture(name), color: tint, roughness: 0.94, metalness: 0, emissive: glow, emissiveIntensity: glow ? 1 : 0 });
      this.mats.set(key, m);
    }
    return m;
  }

  /** Adds any geometry, already in place, to the map. */
  add(material: THREE.Material, g: THREE.BufferGeometry, shadow = true): void {
    const src = g.index ? g.toNonIndexed() : g;
    if (!src.attributes.uv) src.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(src.attributes.position.count * 2), 2));
    const out = new THREE.BufferGeometry();
    for (const name of ["position", "normal", "uv"]) out.setAttribute(name, src.attributes[name]);
    this.push(material, out, shadow);
  }

  private push(material: THREE.Material, g: THREE.BufferGeometry, shadow = true): void {
    let b = this.batches.get(material.uuid);
    if (!b) this.batches.set(material.uuid, (b = { material, geos: [], shadow }));
    b.geos.push(g);
  }

  box(x: number, z: number, w: number, h: number, d: number, material: THREE.Material, o: BoxOpt = {}): void {
    const y = (o.y ?? 0) + h / 2;
    const yaw = o.yaw ?? 0;
    this.q.setFromAxisAngle(this.up, yaw);
    const g = boxGeo(w, h, d, o.tile ?? 3);
    g.applyMatrix4(this.m4.compose(new THREE.Vector3(x, y, z), this.q, new THREE.Vector3(1, 1, 1)));
    this.push(material, g);
    if (o.solid === false) return;
    if (!yaw && !(o.y ?? 0) && h >= 3) {
      if (w >= 4) for (const s of [-1, 1]) this.faces.push({ x, z: z + (s * d) / 2, nx: 0, nz: s, len: w, h });
      if (d >= 4) for (const s of [-1, 1]) this.faces.push({ x: x + (s * w) / 2, z, nx: s, nz: 0, len: d, h });
    }
    this.solid(x, z, w, h, d, o);
  }

  /** Something in the way that is not drawn: the collider and the hole in the bots' map, or a floor to stand on. */
  solid(x: number, z: number, w: number, h: number, d: number, o: BoxOpt = {}): void {
    const y0 = o.y ?? 0;
    const yaw = o.yaw ?? 0;
    this.q.setFromAxisAngle(this.up, yaw);
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2).setTranslation(x, y0 + h / 2, z).setRotation(this.q));
    if (o.walk) {
      this.floors.push({ x, z, dx: Math.sin(yaw), dz: Math.cos(yaw), hw: w / 2, hl: d / 2, h0: y0 + h, h1: y0 + h });
      return;
    }
    // Low kerbs can be stepped over; anything overhead can be walked under.
    if (o.nav !== false && y0 < 1.6 && y0 + h > 0.45) this.nav.block(x, z, w / 2, d / 2, yaw);
  }

  /** A line the bots will not cross though nothing stands on it: the edge of a drop. */
  edge(x1: number, z1: number, x2: number, z2: number): void {
    this.nav.block((x1 + x2) / 2, (z1 + z2) / 2, Math.hypot(x2 - x1, z2 - z1) / 2, 0.1, Math.atan2(-(z2 - z1), x2 - x1), 0.5);
  }

  /**
   * A slope `w` wide from (x1, z1) at height `h0` up to (x2, z2) at `h1`. With `steps` it is drawn as that many
   * stairs; either way it is walked as a slope, and what is under it is filled in.
   */
  ramp(x1: number, z1: number, x2: number, z2: number, w: number, h0: number, h1: number, material: THREE.Material, steps = 0, tile = 3): void {
    const run = Math.hypot(x2 - x1, z2 - z1);
    const rise = h1 - h0;
    const ux = (x2 - x1) / run;
    const uz = (z2 - z1) / run;
    const yaw = Math.atan2(ux, uz);
    const at = (t: number) => ({ x: x1 + ux * run * t, z: z1 + uz * run * t });
    if (steps) {
      for (let i = 0; i < steps; i++) {
        const c = at((i + 0.5) / steps);
        // Each tread sits half a riser below the slope it is walked on, so the slope meets the floor at both ends with no lip.
        this.box(c.x, c.z, w, h0 + (rise * (i + 0.5)) / steps, run / steps, material, { yaw, solid: false, tile });
      }
    } else {
      // A wedge: the slope, the tall end and the two sides.
      const hw = w / 2;
      const pos: number[] = [];
      const uv: number[] = [];
      const quad = (p: number[][], t: number[][]) => {
        for (const i of [0, 1, 2, 0, 2, 3]) {
          pos.push(...p[i]);
          uv.push(t[i][0] / tile, t[i][1] / tile);
        }
      };
      const len = Math.hypot(run, rise);
      quad([[-hw, h0, 0], [-hw, h1, run], [hw, h1, run], [hw, h0, 0]], [[0, 0], [0, len], [w, len], [w, 0]]);
      quad([[-hw, 0, run], [hw, 0, run], [hw, h1, run], [-hw, h1, run]], [[0, 0], [w, 0], [w, h1], [0, h1]]);
      quad([[-hw, 0, 0], [-hw, 0, run], [-hw, h1, run], [-hw, h0, 0]], [[0, 0], [run, 0], [run, h1], [0, h0]]);
      quad([[hw, 0, run], [hw, 0, 0], [hw, h0, 0], [hw, h1, run]], [[run, 0], [0, 0], [0, h0], [run, h1]]);
      if (h0 > 0) quad([[hw, 0, 0], [-hw, 0, 0], [-hw, h0, 0], [hw, h0, 0]], [[0, 0], [w, 0], [w, h0], [0, h0]]);
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
      g.computeVertexNormals();
      g.applyMatrix4(this.m4.compose(new THREE.Vector3(x1, 0, z1), this.q.setFromAxisAngle(this.up, yaw), new THREE.Vector3(1, 1, 1)));
      this.push(material, g);
    }
    const a = Math.atan2(rise, run);
    const q = new THREE.Quaternion().setFromAxisAngle(this.up, yaw).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -a));
    const n = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    const mid = at(0.5);
    const thick = 0.4;
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(w / 2, thick / 2, Math.hypot(run, rise) / 2)
        .setTranslation(mid.x - (n.x * thick) / 2, (h0 + h1) / 2 - (n.y * thick) / 2, mid.z - (n.z * thick) / 2)
        .setRotation(q),
    );
    this.q.setFromAxisAngle(this.up, yaw);
    for (let i = 0; i < 4; i++) {
      const h = h0 + (rise * i) / 4;
      if (h < 0.15) continue;
      const c = at((i + 0.5) / 4);
      this.world.createCollider(RAPIER.ColliderDesc.cuboid(w / 2, h / 2, run / 8).setTranslation(c.x, h / 2, c.z).setRotation(this.q));
    }
    this.floors.push({ x: mid.x, z: mid.z, dx: ux, dz: uz, hw: w / 2, hl: run / 2, h0, h1 });
  }

  /** A wall with an arched opening `w` wide and `h` high, its middle `at` metres along the wall from (x1, z1). */
  arch(x1: number, z1: number, x2: number, z2: number, height: number, material: THREE.Material, at: number, w: number, h: number, thick = 0.6, tile = 3): void {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const r = w / 2;
    const shape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(len, 0), new THREE.Vector2(len, height), new THREE.Vector2(0, height)]);
    const hole = new THREE.Path();
    hole.moveTo(at - r, 0);
    hole.lineTo(at - r, h - r);
    hole.absarc(at, h - r, r, Math.PI, 0, true);
    hole.lineTo(at + r, 0);
    hole.lineTo(at - r, 0);
    shape.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false, curveSegments: 9 }).toNonIndexed();
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / tile, uv.getY(i) / tile);
    g.translate(0, 0, -thick / 2);
    const yaw = Math.atan2(-(z2 - z1), x2 - x1);
    g.applyMatrix4(this.m4.compose(new THREE.Vector3(x1, 0, z1), this.q.setFromAxisAngle(this.up, yaw), new THREE.Vector3(1, 1, 1)));
    this.push(material, g);
    const ux = (x2 - x1) / len;
    const uz = (z2 - z1) / len;
    const part = (a: number, b: number, y: number, hh: number) => {
      if (b - a < 0.05 || hh < 0.05) return;
      const c = (a + b) / 2;
      this.solid(x1 + ux * c, z1 + uz * c, b - a, hh, thick, { y, yaw });
    };
    part(0, at - r, 0, height);
    part(at + r, len, 0, height);
    part(at - r, at + r, h - r * 0.35, height - h + r * 0.35);
  }

  /** A picture on a wall: a door, a window, a rug. `yaw` is which way it faces. */
  panel(name: string, x: number, y: number, z: number, w: number, h: number, yaw: number, tint = 0xffffff, glow = 0): void {
    const key = `dec:${name}:${tint}:${glow}`;
    let m = this.mats.get(key);
    if (!m) {
      const map = texture(name, "dec");
      m = new THREE.MeshStandardMaterial({ map, color: tint, roughness: 0.9, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      // Lit from inside: the picture is its own light.
      if (glow) {
        m.emissive.set(0xffffff);
        m.emissiveMap = map;
        m.emissiveIntensity = glow;
      }
      this.mats.set(key, m);
    }
    const g = new THREE.PlaneGeometry(w, h).toNonIndexed();
    g.applyMatrix4(this.m4.compose(new THREE.Vector3(x + Math.sin(yaw) * 0.025, y + h / 2, z + Math.cos(yaw) * 0.025), this.q.setFromAxisAngle(this.up, yaw), new THREE.Vector3(1, 1, 1)));
    this.push(m, g, false);
  }

  /** A patch of different ground: paving, a pad, a painted line. */
  slab(x: number, z: number, w: number, d: number, material: THREE.Material, tile = 4, lift = 0.03, yaw = 0): void {
    this.box(x, z, w, lift, d, material, { tile, solid: false, yaw });
  }

  /** A wall from one point to another. */
  wall(x1: number, z1: number, x2: number, z2: number, h: number, material: THREE.Material, thick = 0.5, y = 0, tile = 3): void {
    const len = Math.hypot(x2 - x1, z2 - z1);
    this.box((x1 + x2) / 2, (z1 + z2) / 2, len, h, thick, material, { y, yaw: Math.atan2(-(z2 - z1), x2 - x1), tile });
  }

  cyl(x: number, z: number, r: number, h: number, material: THREE.Material, y = 0, solid = true): void {
    const g = new THREE.CylinderGeometry(r, r, h, 18).toNonIndexed();
    g.translate(x, y + h / 2, z);
    this.push(material, g);
    if (!solid) return;
    this.world.createCollider(RAPIER.ColliderDesc.cylinder(h / 2, r).setTranslation(x, y + h / 2, z));
    if (y < 1.6) this.nav.block(x, z, r * 0.8, r * 0.8, 0);
  }

  /** Places a prop. `hit` is its collider: half extents of a box, or the radius of a post. */
  prop(group: THREE.Group, x: number, z: number, yaw = 0, hit?: [number, number, number] | number, y = 0): void {
    group.position.set(x, y, z);
    group.rotation.y = yaw;
    group.updateMatrixWorld(true);
    group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const material = mesh.material as THREE.Material;
      const src = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", src.attributes.position);
      g.setAttribute("normal", src.attributes.normal);
      g.setAttribute("uv", src.attributes.uv ?? new THREE.BufferAttribute(new Float32Array(src.attributes.position.count * 2), 2));
      g.applyMatrix4(mesh.matrixWorld);
      this.push(material, g, !mesh.userData.outline && !material.transparent);
    });
    if (hit === undefined) return;
    if (typeof hit === "number") {
      this.world.createCollider(RAPIER.ColliderDesc.cylinder(1.5, hit).setTranslation(x, y + 1.5, z));
      this.nav.block(x, z, hit * 0.8, hit * 0.8, 0);
      return;
    }
    this.q.setFromAxisAngle(this.up, yaw);
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(hit[0], hit[1], hit[2]).setTranslation(x, y + hit[1], z).setRotation(this.q));
    if (y < 1.6) this.nav.block(x, z, hit[0], hit[2], yaw);
  }

  /** Rows of windows on all four faces of a building. */
  windows(x: number, z: number, w: number, d: number, h: number, glass: THREE.Material, frame: THREE.Material | null = null, step = 3.2): void {
    for (let y = 2.1; y + 1.6 < h; y += 3) {
      for (const [len, fx, fz, yaw] of [[w, 0, d / 2, 0], [w, 0, -d / 2, 0], [d, w / 2, 0, Math.PI / 2], [d, -w / 2, 0, Math.PI / 2]] as number[][]) {
        const n = Math.max(1, Math.floor((len - 1.6) / step));
        for (let i = 0; i < n; i++) {
          const t = (i + 0.5) / n - 0.5;
          const px = x + fx + (yaw ? 0 : t * len);
          const pz = z + fz + (yaw ? t * len : 0);
          this.box(px, pz, 1.1, 1.4, 0.14, glass, { y, yaw, solid: false });
          if (frame) this.box(px, pz, 1.4, 0.14, 0.3, frame, { y: y - 0.16, yaw, solid: false });
        }
      }
    }
  }

  /** A solid building: walls, a roof slab that overhangs, a plinth and windows. */
  building(x: number, z: number, w: number, d: number, h: number, wall: THREE.Material, roof: THREE.Material, glass: THREE.Material | null, plinth?: THREE.Material): void {
    this.box(x, z, w, h, d, wall);
    this.box(x, z, w + 0.6, 0.35, d + 0.6, roof, { y: h, solid: false });
    if (plinth) this.box(x, z, w + 0.16, 0.6, d + 0.16, plinth, { solid: false });
    if (glass) this.windows(x, z, w, d, h, glass, plinth ?? null);
  }

  /** A hollow building with doorways. `at` is the doorway's centre along its wall, measured from the building's centre. */
  shell(x: number, z: number, w: number, d: number, h: number, wall: THREE.Material, roof: THREE.Material | null, doors: Door[], thick = 0.5): void {
    const side = (name: Door["side"], ax: number, az: number, len: number, alongX: boolean) => {
      const gaps = doors.filter((dr) => dr.side === name).sort((a, b) => a.at - b.at);
      let from = -len / 2;
      const seg = (a: number, b: number, y = 0, hh = h) => {
        if (b - a < 0.05) return;
        const c = (a + b) / 2;
        if (alongX) this.box(ax + c, az, b - a, hh, thick, wall, { y });
        else this.box(ax, az + c, thick, hh, b - a, wall, { y });
      };
      for (const g of gaps) {
        seg(from, g.at - g.w / 2);
        seg(g.at - g.w / 2, g.at + g.w / 2, 3.1, h - 3.1);
        from = g.at + g.w / 2;
      }
      seg(from, len / 2);
    };
    side("n", x, z - d / 2 + thick / 2, w, true);
    side("s", x, z + d / 2 - thick / 2, w, true);
    side("w", x - w / 2 + thick / 2, z, d - thick * 2, false);
    side("e", x + w / 2 - thick / 2, z, d - thick * 2, false);
    if (roof) this.box(x, z, w + 0.5, 0.3, d + 0.5, roof, { y: h, solid: false });
  }

  /** A shipping container, 6 m long along X. */
  container(x: number, z: number, yaw: number, tint: number, y = 0): void {
    this.box(x, z, 6.06, 2.59, 2.44, this.tex("corrugated", tint), { y, yaw, tile: 2.6 });
    const dark = pbr(0x23262d, 0.2, 0.6);
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    for (const ex of [-3.0, 3.0]) {
      for (const ez of [-1.19, 1.19]) this.box(x + ex * c + ez * s, z - ex * s + ez * c, 0.16, 2.63, 0.16, dark, { y: y - 0.02, yaw, solid: false });
    }
    for (const ez of [-0.6, -0.2, 0.2, 0.6]) this.box(x + 3.05 * c + ez * s, z - 3.05 * s + ez * c, 0.06, 2.3, 0.06, dark, { y: y + 0.14, yaw, solid: false });
  }

  /** A wooden crate. */
  crate(x: number, z: number, size: number, yaw = 0, y = 0): void {
    this.box(x, z, size, size, size, this.tex("crate"), { y, yaw, tile: size });
  }

  light(x: number, y: number, z: number, color: number, intensity: number, distance: number): void {
    const l = new THREE.PointLight(color, intensity, distance, 1.6);
    l.position.set(x, y, z);
    this.scene.add(l);
  }

  /** Paint thrown at the walls and the ground: this is a place where people shoot paint at each other. */
  splats(n: number): void {
    const texs = [0, 1, 2].map(() => {
      const c = document.createElement("canvas");
      c.width = c.height = 128;
      const x = c.getContext("2d")!;
      x.fillStyle = "#fff";
      const blob = (bx: number, by: number, r: number) => {
        x.beginPath();
        x.arc(bx, by, r, 0, Math.PI * 2);
        x.fill();
      };
      blob(64, 64, 26);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + Math.random() * 0.5;
        const d = 22 + Math.random() * 18;
        blob(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, 5 + Math.random() * 10);
        if (i % 2) blob(64 + Math.cos(a) * (d + 15), 64 + Math.sin(a) * (d + 15), 2 + Math.random() * 4);
      }
      // A run of paint down the wall.
      x.fillRect(58 + Math.random() * 10, 64, 5, 50);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    });
    const colors = [0xff3d7a, 0x18cfd6, 0xffd21a, 0x8be830, 0xff7a1a, 0x9b4dff, 0x2f9bff];
    const walls = this.faces.filter((f) => Math.abs(f.x + f.nx) < this.hx && Math.abs(f.z + f.nz) < this.hz);
    const put = (x: number, y: number, z: number, size: number, i: number, onWall: { nx: number; nz: number } | null) => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(size, size),
        new THREE.MeshBasicMaterial({ map: texs[i % 3], color: colors[i % colors.length], transparent: true, opacity: 0.92, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }),
      );
      m.position.set(x, y, z);
      if (onWall) m.rotation.y = Math.atan2(onWall.nx, onWall.nz);
      else {
        m.rotation.x = -Math.PI / 2;
        m.rotation.z = Math.random() * 6;
      }
      m.renderOrder = 1;
      this.scene.add(m);
    };
    for (let i = 0; i < n && walls.length; i++) {
      const f = walls[Math.floor(Math.random() * walls.length)];
      const t = (Math.random() - 0.5) * (f.len - 2.4);
      const size = 1.3 + Math.random() * 1.6;
      put(f.x + f.nx * 0.03 + (f.nz ? t : 0), 0.9 + Math.random() * Math.max(0.2, Math.min(f.h, 5) - 2), f.z + f.nz * 0.03 + (f.nx ? t : 0), size, i, f);
    }
    for (let i = 0; i < n * 0.6; i++) {
      const p = this.nav.randomFree();
      put(p.x, this.floorAt(p.x, p.z) + 0.07, p.z, 1.2 + Math.random() * 1.8, i + 3, null);
    }
  }

  /** A sign: a few characters on a board, upright on a wall or flat on the ground. */
  label(text: string, x: number, y: number, z: number, size: number, yaw = 0, flat = false, color = "#ffd640"): void {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 128;
    const ctx = c.getContext("2d")!;
    if (!flat) {
      ctx.fillStyle = "#101833";
      ctx.beginPath();
      ctx.roundRect(4, 4, 248, 120, 22);
      ctx.fill();
    }
    ctx.fillStyle = color;
    ctx.font = "900 92px Nunito, Rubik, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 128, 70);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size * 2, size), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.position.set(x, y, z);
    if (flat) {
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = yaw;
    } else m.rotation.y = yaw;
    this.scene.add(m);
  }

  /** The letter and ring painted on a bomb site. */
  site(s: Site): void {
    const c = document.createElement("canvas");
    c.width = c.height = 512;
    const ctx = c.getContext("2d")!;
    ctx.strokeStyle = "rgba(255, 214, 64, 0.95)";
    ctx.lineWidth = 16;
    ctx.setLineDash([46, 26]);
    ctx.beginPath();
    ctx.arc(256, 256, 236, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 214, 64, 0.95)";
    ctx.font = "900 250px Rubik, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(s.name, 256, 272);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(s.r * 2, s.r * 2), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = -Math.PI / 2;
    m.position.set(s.x, this.floorAt(s.x, s.z) + 0.09, s.z);
    m.renderOrder = 1;
    this.scene.add(m);
  }

  /** Ground, the invisible ceiling-high fence and the sky. */
  ground(material: THREE.Material, tile: number): void {
    const HX = this.hx;
    const HZ = this.hz;
    const g = boxGeo(HX * 2 + 8, 1, HZ * 2 + 8, tile);
    g.translate(0, -0.5, 0);
    this.push(material, g);
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(HX + 8, 0.5, HZ + 8).setTranslation(0, -0.5, 0));
    for (const [x, z, w, d] of [[0, -HZ - 0.75, HX * 2 + 4, 1], [0, HZ + 0.75, HX * 2 + 4, 1], [-HX - 0.75, 0, 1, HZ * 2 + 4], [HX + 0.75, 0, 1, HZ * 2 + 4]]) {
      this.world.createCollider(RAPIER.ColliderDesc.cuboid(w / 2, 12, d / 2).setTranslation(x, 12, z));
    }
  }

  sky(top: string, mid: string, low: string, clouds: number, stars = false): void {
    const c = document.createElement("canvas");
    c.width = 16;
    c.height = 256;
    const ctx = c.getContext("2d")!;
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, top);
    g.addColorStop(0.45, mid);
    g.addColorStop(0.56, low);
    g.addColorStop(1, low);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 16, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    const dome = new THREE.Mesh(new THREE.SphereGeometry(330, 24, 16), new THREE.MeshBasicMaterial({ map: t, side: THREE.BackSide, fog: false, toneMapped: false }));
    this.scene.add(dome);
    const puff = new THREE.MeshBasicMaterial({ color: clouds, fog: false, toneMapped: false });
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.4;
      const cloud = new THREE.Group();
      for (let k = 0; k < 4; k++) {
        const blob = new THREE.Mesh(new THREE.SphereGeometry(10 + ((i * 7 + k * 3) % 8), 10, 8), puff);
        blob.position.set(k * 13 - 20, ((k * 5) % 7) - 3, ((k * 3) % 5) * 2);
        blob.scale.y = 0.42;
        cloud.add(blob);
      }
      cloud.position.set(Math.cos(a) * 210, 60 + ((i * 13) % 40), Math.sin(a) * 210);
      cloud.rotation.y = -a;
      this.scene.add(cloud);
    }
    if (stars) {
      const pts: number[] = [];
      for (let i = 0; i < 500; i++) {
        const a = Math.random() * Math.PI * 2;
        const e = 0.12 + Math.random() * 1.4;
        pts.push(Math.cos(a) * Math.cos(e) * 320, Math.sin(e) * 320, Math.sin(a) * Math.cos(e) * 320);
      }
      const sg = new THREE.BufferGeometry();
      sg.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
      this.scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false, toneMapped: false })));
    }
  }

  sun(color: number, intensity: number, x: number, y: number, z: number, skyC: number, groundC: number, ambient: number): void {
    const sun = new THREE.DirectionalLight(color, intensity);
    sun.position.set(x, y, z);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -50;
    sc.right = 50;
    sc.top = 50;
    sc.bottom = -50;
    sc.near = 1;
    sc.far = 220;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.05;
    this.scene.add(sun, new THREE.HemisphereLight(skyC, groundC, ambient));
  }

  /** Merges everything placed so far into one mesh per material. */
  finish(): void {
    for (const b of this.batches.values()) {
      const mesh = new THREE.Mesh(mergeGeometries(b.geos, false), b.material);
      mesh.castShadow = b.shadow;
      mesh.receiveShadow = b.shadow;
      this.scene.add(mesh);
    }
    this.batches.clear();
  }

  /** Free-for-all spawn points: spread out, on open ground. */
  scatter(n: number): P2[] {
    const out: P2[] = [];
    for (let i = 0; i < 4000 && out.length < n; i++) {
      const p = { x: (Math.random() * 2 - 1) * (this.hx - 4), z: (Math.random() * 2 - 1) * (this.hz - 4) };
      if (!this.nav.free(p.x, p.z) || !this.nav.free(p.x + 1.3, p.z) || !this.nav.free(p.x - 1.3, p.z) || !this.nav.free(p.x, p.z + 1.3) || !this.nav.free(p.x, p.z - 1.3)) continue;
      if (out.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < 9)) continue;
      out.push(p);
    }
    return out;
  }
}

const BOX_COLORS = [0xd9483b, 0x2f7fd0, 0x3fa55a, 0xf2b530, 0xe8742a, 0x1f9a94, 0x8a5ad0, 0xdfe4ea];

/** The firing range: a line to shoot from, lanes with the distance marked, dummies, bullseyes and a pit for grenades. */
function range(k: Kit): RangeData {
  const concrete = k.tex("concrete");
  const wall = k.tex("wall");
  const yellow = pbr(0xffc21a, 0, 0.8);
  k.sky("#2f8ff0", "#8fd0ff", "#d9f1ff", 0xffffff);
  k.sun(0xfff1d6, 2.3, 30, 60, 24, 0xcfe8ff, 0x8f9aa8, 1.05);
  k.scene.fog = new THREE.Fog(0xcfeaff, 90, 320);
  k.ground(concrete, 5);
  for (const [x, z, w, d] of [[0, -26.5, 74, 1], [0, 26.5, 74, 1], [-36.5, 0, 1, 54], [36.5, 0, 1, 54]]) {
    k.box(x, z, w, 6, d, wall);
    k.box(x, z, w + 0.2, 0.4, d + 0.2, yellow, { y: 5.6, solid: false });
  }
  // The firing line: benches with gaps to walk through.
  for (const z of [-17, -5.5, 5.5, 17]) k.box(-21, z, 1.0, 1.05, 8.5, k.tex("metalfloor"));
  k.slab(-22.4, 0, 0.3, 50, yellow, 4, 0.05);
  for (const z of [-10, 0.5, 10]) k.slab(6, z, 54, 0.14, yellow, 4, 0.05);
  [10, 20, 30, 40].forEach((d) => {
    k.label(`${d} м`, -21 + d, 0.08, -21, 2.2, -Math.PI / 2, true);
    k.slab(-21 + d, 0, 0.16, 50, pbr(0xffffff, 0, 0.8), 4, 0.05);
  });
  k.label("МАНЕКЕНЫ", -18, 3.4, -15, 1.3, -Math.PI / 2);
  k.label("МИШЕНИ", -18, 3.4, 5, 1.3, -Math.PI / 2);
  k.label("ГРАНАТЫ", -18, 3.4, 17, 1.3, -Math.PI / 2);
  for (const z of [-15, 5, 17]) k.box(-18, z, 0.12, 3.6, 0.12, pbr(0x23262d, 0.2, 0.6), { solid: false });
  // A bank of sand to stop what misses.
  k.box(33.6, 0, 4.6, 3.4, 52, k.tex("sand"));
  // The grenade pit.
  k.prop(P.sandbags(), 8.4, 11.2, 0, [1.3, 0.5, 0.3]);
  k.prop(P.sandbags(), 5.2, 14.6, Math.PI / 2, [1.3, 0.5, 0.3]);
  k.prop(P.sandbags(), 11.6, 14.8, Math.PI / 2, [1.3, 0.5, 0.3]);
  // Something to look at.
  k.container(-30, -22, 0, BOX_COLORS[1]);
  k.container(-30, 22, 0, BOX_COLORS[4]);
  k.container(-30, 22, 0, BOX_COLORS[3], 2.59);
  k.crate(-27.5, -13, 1.6, 0.2);
  k.crate(-27.3, -11.4, 1.2, 0.6);
  for (const [x, z, c] of [[-28, 10, 0x2f7fd0], [-27, 11, 0xd9483b], [-28.2, 11.6, 0xf2b530]]) k.prop(P.barrel(c), x, z, 0, 0.45);
  k.prop(P.tower(), 30, -22.5, 0.6, [1.2, 2.6, 1.2]);
  for (const z of [-24, 24]) for (const x of [-10, 12]) k.prop(P.lampPost(0xfff2c0, 6), x, z, z < 0 ? Math.PI / 2 : -Math.PI / 2, 0.2);
  for (const [x, z] of [[-19.4, -11.6], [-19.4, 0], [-19.4, 11.6]]) k.prop(P.cone(), x, z);
  return {
    dummies: [
      { x: -11, z: -15, move: 0 }, { x: -1, z: -15, move: 0 }, { x: 9, z: -16, move: 0 }, { x: 19, z: -14, move: 0 },
      { x: -5, z: -4.6, move: 3.6 }, { x: 12, z: -4.6, move: 4.4 }, { x: 26, z: -6, move: 0 },
      { x: 8, z: 15, move: 0 }, { x: 9.6, z: 16.4, move: 0 }, { x: 9.9, z: 13.7, move: 0 }, { x: 7, z: 13.3, move: 0 },
    ],
    boards: [
      { x: -11, y: 1.5, z: 5 }, { x: -1, y: 1.5, z: 3.6 }, { x: 9, y: 1.5, z: 6.4 }, { x: 19, y: 1.5, z: 4.4 }, { x: 29, y: 1.6, z: 5.6 },
      { x: 31.2, y: 4.2, z: -12 }, { x: 31.2, y: 4.6, z: -2 }, { x: 31.2, y: 4.2, z: 8 },
    ],
  };
}

const BUILDERS: Record<Exclude<MapId, "range">, (k: Kit) => MapSpec> = { oasis, summit, neon };
/** Half the width and depth of each map. */
const SIZE: Partial<Record<MapId, [number, number]>> = { oasis: [38, 33], summit: [38, 33], neon: [38, 33] };

/** Builds a map into the scene and the physics world. */
export function buildMap(id: MapId, scene: THREE.Scene, world: RAPIER.World): ArenaMap {
  const [hx, hz] = SIZE[id] ?? [HX, HZ];
  const k = new Kit(scene, world, hx, hz);
  if (id === "range") {
    const data = range(k);
    k.finish();
    k.splats(10);
    return { id, name: "Полигон", nav: k.nav, half: [hx, hz], spawns: [[{ x: -27, z: 0 }], [{ x: -27, z: 0 }]], ffa: [{ x: -27, z: 0 }], sites: [], range: data, floorAt: k.floorAt };
  }
  const spec = BUILDERS[id](k);
  for (const s of spec.sites) k.site(s);
  k.finish();
  k.splats(22);
  return { id, name: MAPS.find((m) => m.id === id)!.name, nav: k.nav, half: [hx, hz], ...spec, ffa: k.scatter(14), floorAt: k.floorAt };
}
