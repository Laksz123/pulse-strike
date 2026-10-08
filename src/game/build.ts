/**
 * Building blocks. Every model in the game is assembled from boxes in code, either with plain
 * colours (`box`, `vox`) or with pixel textures at a fixed texel density (`tbox`).
 * Static props are then merged into a couple of meshes with `bake` to keep draw calls low.
 */

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { tex } from "./textures";

const materials = new Map<string, THREE.MeshLambertMaterial>();

export function mat(color: number, emissive = 0): THREE.MeshLambertMaterial {
  const key = `${color}:${emissive}`;
  let m = materials.get(key);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color, flatShading: true, emissive });
    materials.set(key, m);
  }
  return m;
}

/** A textured material; `tint` multiplies the texture. */
export function tmat(texture: string, tint = 0xffffff): THREE.MeshLambertMaterial {
  const key = `t:${texture}:${tint}`;
  let m = materials.get(key);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color: tint, flatShading: true, map: tex(texture) });
    materials.set(key, m);
  }
  return m;
}

const unitBox = new THREE.BoxGeometry(1, 1, 1);
const unitCyl = new THREE.CylinderGeometry(1, 1, 1, 8);
const unitCone = new THREE.ConeGeometry(1, 1, 8);
const unitBlob = new THREE.IcosahedronGeometry(1, 0);
const sized = new Map<string, THREE.BoxGeometry>();

/** A box whose UVs repeat the texture `density` times per metre on every face. */
function sizedBox(w: number, h: number, d: number, density: number): THREE.BoxGeometry {
  const key = `${w.toFixed(2)}:${h.toFixed(2)}:${d.toFixed(2)}:${density}`;
  let g = sized.get(key);
  if (g) return g;
  g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  // Face order: +x, -x, +y, -y, +z, -z; four vertices each.
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, uv.getX(i) * dims[f][0] * density, uv.getY(i) * dims[f][1] * density);
    }
  }
  sized.set(key, g);
  return g;
}

export type SolidKind = "box" | "cyl" | "ball";

function finish(mesh: THREE.Mesh, parent: THREE.Object3D, solid: SolidKind | false): THREE.Mesh {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (solid) mesh.userData.solid = solid;
  parent.add(mesh);
  return mesh;
}

/** A plain box of size w × h × d centred at (x, y, z). Solid boxes get a physics collider. */
export function box(
  parent: THREE.Object3D,
  w: number, h: number, d: number,
  x: number, y: number, z: number,
  color: number,
  solid = false,
): THREE.Mesh {
  const m = new THREE.Mesh(unitBox, mat(color));
  m.scale.set(w, h, d);
  m.position.set(x, y, z);
  return finish(m, parent, solid ? "box" : false);
}

/** A textured box. Texels stay the same size on every box: one tile per `1 / density` metres. */
export function tbox(
  parent: THREE.Object3D,
  w: number, h: number, d: number,
  x: number, y: number, z: number,
  texture: string,
  solid = false,
  tint = 0xffffff,
  density = 1,
): THREE.Mesh {
  const m = new THREE.Mesh(sizedBox(w, h, d, density), tmat(texture, tint));
  m.position.set(x, y, z);
  return finish(m, parent, solid ? "box" : false);
}

/** An upright cylinder of radius r and height h centred at (x, y, z). */
export function cyl(
  parent: THREE.Object3D,
  r: number, h: number,
  x: number, y: number, z: number,
  color: number | THREE.Material,
  solid = false,
): THREE.Mesh {
  const m = new THREE.Mesh(unitCyl, typeof color === "number" ? mat(color) : color);
  m.scale.set(r, h, r);
  m.position.set(x, y, z);
  return finish(m, parent, solid ? "cyl" : false);
}

export function cone(
  parent: THREE.Object3D,
  r: number, h: number,
  x: number, y: number, z: number,
  color: number | THREE.Material,
): THREE.Mesh {
  const m = new THREE.Mesh(unitCone, typeof color === "number" ? mat(color) : color);
  m.scale.set(r, h, r);
  m.position.set(x, y, z);
  return finish(m, parent, false);
}

/** A faceted lump. */
export function blob(
  parent: THREE.Object3D,
  rx: number, ry: number, rz: number,
  x: number, y: number, z: number,
  color: number | THREE.Material,
  solid = false,
): THREE.Mesh {
  const m = new THREE.Mesh(unitBlob, typeof color === "number" ? mat(color) : color);
  m.scale.set(rx, ry, rz);
  m.position.set(x, y, z);
  return finish(m, parent, solid ? "ball" : false);
}

/**
 * Voxel-style modelling: each part is [x, y, z, w, h, d, colour] with (x, y, z) the minimum corner,
 * in model units. Scale the parent group to turn units into metres.
 */
export type VoxPart = [number, number, number, number, number, number, number];

export function vox(parent: THREE.Object3D, parts: VoxPart[]): void {
  for (const [x, y, z, w, h, d, color] of parts) box(parent, w, h, d, x + w / 2, y + h / 2, z + d / 2, color);
}

/** Half extents / radius of a mesh built by the helpers above, in world units. */
export function solidShape(mesh: THREE.Mesh, scale: THREE.Vector3): { hx: number; hy: number; hz: number; r: number } {
  const p = (mesh.geometry as THREE.BoxGeometry).parameters as { width?: number; height?: number; depth?: number };
  return {
    hx: ((p.width ?? 1) * scale.x) / 2,
    hy: ((p.height ?? 1) * scale.y) / 2,
    hz: ((p.depth ?? 1) * scale.z) / 2,
    r: (scale.x + scale.z) / 2,
  };
}

const bakedMats = new Map<string, THREE.MeshLambertMaterial>();

/**
 * Merges the static meshes under `root` into one mesh per texture. Named meshes (lids and other
 * parts that move on their own) are left alone. Call after colliders have been created.
 */
export function bake(root: THREE.Object3D): void {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const groups = new Map<string, { geos: THREE.BufferGeometry[]; map: THREE.Texture | null; emissive: number }>();
  const remove: THREE.Mesh[] = [];
  const m4 = new THREE.Matrix4();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || mesh.name || mesh.userData.baked) return;
    const material = mesh.material as THREE.MeshLambertMaterial;
    if (!material.isMeshLambertMaterial) return;
    const g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    g.applyMatrix4(m4.multiplyMatrices(inv, mesh.matrixWorld));
    const n = g.attributes.position.count;
    const colors = new Float32Array(n * 3);
    const c = material.color;
    for (let i = 0; i < n; i++) colors.set([c.r, c.g, c.b], i * 3);
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    for (const name of Object.keys(g.attributes)) if (!["position", "normal", "uv", "color"].includes(name)) g.deleteAttribute(name);
    const key = `${material.map?.uuid ?? "solid"}:${material.emissive.getHex()}`;
    let group = groups.get(key);
    if (!group) groups.set(key, (group = { geos: [], map: material.map, emissive: material.emissive.getHex() }));
    group.geos.push(g);
    remove.push(mesh);
  });
  for (const mesh of remove) mesh.removeFromParent();
  for (const [key, group] of groups) {
    const merged = mergeGeometries(group.geos, false);
    if (!merged) continue;
    for (const g of group.geos) g.dispose();
    let material = bakedMats.get(key);
    if (!material) {
      material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, map: group.map, emissive: group.emissive });
      bakedMats.set(key, material);
    }
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.baked = true;
    root.add(mesh);
  }
}
