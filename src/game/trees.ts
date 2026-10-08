/**
 * The island's trees. There are thousands of them, so they are drawn as instanced meshes split into
 * map chunks (to keep frustum culling useful); each tree is still an individual harvest node whose
 * instances can lean, fall and vanish.
 */

import * as THREE from "three";
import { bake, tbox } from "./build";
import type { NodeVisual } from "./harvest";
import { mulberry32, range } from "./noise";
import { LIMIT, type TreeSpecies, type TreeSpot } from "./world";

interface Model {
  parts: { geo: THREE.BufferGeometry; mat: THREE.Material }[];
  /** Trunk box for the collider: width, height, and how far its centre leans off the root. */
  w: number;
  h: number;
  lean: number;
  hp: number;
}

const CHUNK = 300;
const models = new Map<string, Model>();

function branch(g: THREE.Group, x: number, y: number, z: number, len: number, rx: number, rz: number, tint: number): void {
  const m = tbox(g, 0.22, len, 0.22, x, y, z, "bark", false, tint, 2);
  m.rotation.set(rx, 0, rz);
}

function buildModel(species: TreeSpecies, variant: number): Model {
  const rng = mulberry32(species.length * 131 + variant * 17 + species.charCodeAt(0));
  const g = new THREE.Group();
  const k = variant ? 0.86 : 1;
  const flip = variant ? -1 : 1;
  let w = 0.6;
  let h = 8;
  let lean = 0;
  let hp = 12;
  if (species === "jungle") {
    h = 8 * k;
    const bark = 0xb5a694;
    tbox(g, 0.55, h, 0.55, 0, h / 2, 0, "bark", false, bark, 2);
    for (const [dx, dz] of [[0.42, 0], [-0.42, 0], [0, 0.42], [0, -0.42]]) branch(g, dx, 0.55, dz, 1.5, dz * 1.1, -dx * 1.1, bark);
    tbox(g, 4.6, 1.4, 4.4, 0.2 * flip, h + 0.2, 0, "foliage", false, 0x3f8a3a, 2);
    tbox(g, 3.2, 1.2, 3.4, -0.3 * flip, h + 1.3, 0.2, "foliage", false, 0x52a046, 2);
    tbox(g, 2.6, 1.0, 3.6, 1.9 * flip, h - 0.8, 0.5, "foliage", false, 0x357c33, 2);
    tbox(g, 3.0, 1.0, 2.4, -1.7 * flip, h - 1.1, -1.0, "foliage", false, 0x46923f, 2);
    tbox(g, 0.1, 2.6, 0.1, 1.9 * flip, h - 2.4, 1.3, "foliage", false, 0x2f6b2c, 2);
    tbox(g, 0.1, 1.9, 0.1, -2.0 * flip, h - 2.3, -0.9, "foliage", false, 0x2f6b2c, 2);
  } else if (species === "fig") {
    h = 10.5 * k;
    w = 1.0;
    hp = 18;
    const bark = 0xa89a86;
    tbox(g, 0.95, h, 0.95, 0, h / 2, 0, "bark", false, bark, 2);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      branch(g, Math.cos(a) * 0.7, 0.8, Math.sin(a) * 0.7, 2.1, Math.sin(a) * 0.9, -Math.cos(a) * 0.9, bark);
    }
    tbox(g, 7.2, 1.6, 6.8, 0, h + 0.3, 0, "foliage", false, 0x2f7a35, 2);
    tbox(g, 5.0, 1.4, 5.2, 0.4 * flip, h + 1.7, -0.2, "foliage", false, 0x3f8f40, 2);
    tbox(g, 4.0, 1.2, 4.2, -2.6 * flip, h - 1.2, 1.4, "foliage", false, 0x2a6e30, 2);
    tbox(g, 3.6, 1.2, 3.8, 2.8 * flip, h - 1.5, -1.6, "foliage", false, 0x378238, 2);
    for (const [dx, dz] of [[2.8, 2.2], [-3, -1.6], [0.6, -3]]) tbox(g, 0.1, 3.4, 0.1, dx * flip, h - 2.4, dz, "foliage", false, 0x2a5f29, 2);
  } else if (species === "palm") {
    h = 7 * k;
    w = 0.5;
    hp = 8;
    lean = 0.4 * flip;
    const n = 5;
    let x = 0;
    for (let i = 0; i < n; i++) {
      tbox(g, 0.34 - i * 0.02, h / n + 0.04, 0.34 - i * 0.02, x, (i + 0.5) * (h / n), 0, "bark", false, 0xcdb592, 2);
      x += 0.2 * flip * (0.5 + i * 0.25);
    }
    const top = x - 0.2 * flip;
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.3;
      const frond = tbox(g, 2.8, 0.1, 0.7, top + Math.cos(a) * 1.25, h - 0.15, -Math.sin(a) * 1.25, "foliage", false, i % 2 ? 0x6aa83c : 0x58983a, 2);
      frond.rotation.set(0, a, -0.36);
    }
    tbox(g, 0.9, 0.5, 0.9, top, h + 0.1, 0, "foliage", false, 0x7ab848, 2);
    for (const [dx, dz] of [[0.25, 0.1], [-0.2, 0.2], [0, -0.28]]) tbox(g, 0.24, 0.24, 0.24, top + dx, h - 0.35, dz, "bark", false, 0x8a6a45, 2);
  } else if (species === "mangrove") {
    h = 4 * k;
    w = 0.9;
    hp = 8;
    const bark = 0x8f8068;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + variant;
      const r = tbox(g, 0.14, 2.0, 0.14, Math.cos(a) * 0.55, 0.8, Math.sin(a) * 0.55, "bark", false, bark, 2);
      r.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6);
    }
    tbox(g, 0.36, h - 1.2, 0.36, 0, 1.4 + (h - 1.2) / 2, 0, "bark", false, bark, 2);
    tbox(g, 3.6, 1.0, 3.4, 0.2 * flip, h + 0.2, 0, "foliage", false, 0x3a6b3a, 2);
    tbox(g, 2.2, 0.8, 2.4, -0.3 * flip, h + 1.0, 0.2, "foliage", false, 0x4a7d42, 2);
  } else if (species === "pine") {
    h = 6.5 * k;
    w = 0.45;
    hp = 10;
    tbox(g, 0.4, h, 0.4, 0, h / 2, 0, "bark", false, 0x9a7a5a, 2);
    const tiers = [3.2, 2.6, 2.0, 1.4, 0.8];
    tiers.forEach((s, i) => {
      tbox(g, s, 0.9, s, 0, h * 0.38 + i * (h * 0.165), 0, "foliage", false, i % 2 ? 0x2f6048 : 0x38705a, 2).rotation.y = i * 0.5;
    });
  } else {
    // Saxaul: a crooked desert shrub-tree.
    h = 2.7 * k;
    w = 0.5;
    hp = 8;
    let x = 0;
    let z = 0;
    for (let i = 0; i < 4; i++) {
      const tw = 0.42 - i * 0.05;
      tbox(g, tw, h / 4 + 0.05, tw, x, (i + 0.5) * (h / 4), z, "bark", false, 0xffffff, 2);
      x += range(rng, -0.14, 0.14);
      z += range(rng, -0.14, 0.14);
    }
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + rng();
      const r = range(rng, 0.6, 1.2);
      tbox(g, range(rng, 1.1, 1.8), 0.45, range(rng, 1.1, 1.8), x + Math.cos(a) * r, h + range(rng, -0.2, 0.5), z + Math.sin(a) * r, "foliage", false, 0x9aa05a, 2);
    }
    tbox(g, 1.6, 0.5, 1.6, x, h + 0.7, z, "foliage", false, 0xa8ae66, 2);
  }
  bake(g);
  const parts = g.children.filter((c): c is THREE.Mesh => (c as THREE.Mesh).isMesh).map((m) => ({ geo: m.geometry, mat: m.material as THREE.Material }));
  return { parts, w, h, lean, hp };
}

function modelOf(species: TreeSpecies, variant: number): Model {
  const key = `${species}:${variant}`;
  let m = models.get(key);
  if (!m) models.set(key, (m = buildModel(species, variant)));
  return m;
}

interface Tree {
  spot: TreeSpot;
  model: Model;
  bucket: string;
  index: number;
}

const Y = new THREE.Vector3(0, 1, 0);

export class TreeField {
  private trees: Tree[] = [];
  private buckets = new Map<string, { model: Model; n: number }>();
  private meshes = new Map<string, THREE.InstancedMesh[]>();
  private m4 = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private q2 = new THREE.Quaternion();
  private p = new THREE.Vector3();
  private s = new THREE.Vector3();

  /** Registers a tree; returns its id. Call `build` once all are added. */
  add(spot: TreeSpot): number {
    const id = this.trees.length;
    const variant = id % 2;
    const model = modelOf(spot.species, variant);
    const bucket = `${spot.species}:${variant}:${Math.floor((spot.x + LIMIT) / CHUNK)}:${Math.floor((spot.z + LIMIT) / CHUNK)}`;
    let b = this.buckets.get(bucket);
    if (!b) this.buckets.set(bucket, (b = { model, n: 0 }));
    this.trees.push({ spot, model, bucket, index: b.n++ });
    return id;
  }

  model(id: number): Model {
    return this.trees[id].model;
  }

  build(scene: THREE.Scene): void {
    for (const [key, b] of this.buckets) {
      const list = b.model.parts.map((part) => {
        const mesh = new THREE.InstancedMesh(part.geo, part.mat, b.n);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
        return mesh;
      });
      this.meshes.set(key, list);
    }
    this.trees.forEach((_, id) => this.pose(id, null, 1));
    for (const list of this.meshes.values()) for (const mesh of list) mesh.computeBoundingSphere();
  }

  /** Writes a tree's transform into its instances. `tilt` leans it, `scale` 0 hides it. */
  private pose(id: number, tilt: THREE.Quaternion | null, scale: number): void {
    const t = this.trees[id];
    this.q.setFromAxisAngle(Y, t.spot.yaw);
    if (tilt) this.q.premultiply(tilt);
    const s = t.spot.scale * scale;
    this.m4.compose(this.p.set(t.spot.x, t.spot.y, t.spot.z), this.q, this.s.set(s, s, s));
    for (const mesh of this.meshes.get(t.bucket)!) {
      mesh.setMatrixAt(t.index, this.m4);
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  /** The handle the harvest system uses to animate one tree. */
  visual(id: number): NodeVisual {
    const t = this.trees[id];
    return {
      pos: new THREE.Vector3(t.spot.x, t.spot.y, t.spot.z),
      radius: t.model.w * t.spot.scale,
      shrink: () => {},
      wobble: () => this.pose(id, this.q2.setFromAxisAngle(this.s.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize(), 0.03), 1),
      fall: (axis, angle) => this.pose(id, this.q2.setFromAxisAngle(axis, angle), 1),
      remove: () => this.pose(id, null, 0),
    };
  }
}

/** Ferns and low bushes: pure decoration, no collision. */
export function buildFerns(scene: THREE.Scene, ferns: { x: number; z: number; y: number; scale: number; yaw: number }[]): void {
  const g = new THREE.Group();
  tbox(g, 1.3, 0.5, 0.12, 0, 0.3, 0, "foliage", false, 0x4f9440, 2).rotation.z = 0.25;
  tbox(g, 1.3, 0.5, 0.12, 0, 0.3, 0, "foliage", false, 0x3f8436, 2).rotation.set(0, Math.PI / 2, -0.25);
  tbox(g, 0.5, 0.7, 0.5, 0, 0.35, 0, "foliage", false, 0x5aa348, 2);
  bake(g);
  const part = g.children.find((c): c is THREE.Mesh => (c as THREE.Mesh).isMesh)!;
  const chunks = new Map<string, typeof ferns>();
  for (const f of ferns) {
    const key = `${Math.floor((f.x + LIMIT) / CHUNK)}:${Math.floor((f.z + LIMIT) / CHUNK)}`;
    let list = chunks.get(key);
    if (!list) chunks.set(key, (list = []));
    list.push(f);
  }
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  for (const list of chunks.values()) {
    const mesh = new THREE.InstancedMesh(part.geometry, part.material, list.length);
    list.forEach((f, i) => {
      q.setFromAxisAngle(Y, f.yaw);
      mesh.setMatrixAt(i, m4.compose(p.set(f.x, f.y - 0.05, f.z), q, s.set(f.scale, f.scale, f.scale)));
    });
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    scene.add(mesh);
  }
}
