/** Inventory icons: every item's 3D model rendered once into a small pixelated image. */

import * as THREE from "three";
import { ITEMS } from "./items";
import { iconModel } from "./models";

const SIZE = 40;
const urls = new Map<string, string>();
let renderer: THREE.WebGLRenderer | null = null;
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);

function setup(): THREE.WebGLRenderer {
  if (renderer) return renderer;
  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
  renderer.setSize(SIZE, SIZE, false);
  renderer.setClearColor(0x000000, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7a66, 1.7));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(3, 5, 2);
  scene.add(sun);
  return renderer;
}

/** Icon for an item, a resource ("wood") or an ammo type ("light"). */
export function iconUrl(id: string): string {
  const cached = urls.get(id);
  if (cached) return cached;
  const r = setup();
  const model = iconModel(id);
  const def = ITEMS[id];
  // Long things are drawn on the diagonal so they fill the square.
  if (def?.kind === "weapon") model.rotation.x = -0.62;
  else if (def?.tool) model.rotation.x = def.tool.motor ? -0.62 : 0.5;
  scene.add(model);
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  const center = bounds.getCenter(new THREE.Vector3());
  const side = def?.kind === "weapon" || def?.tool || id === "lockpick" || id === "bolt";
  const dir = side ? new THREE.Vector3(1, 0.12, 0.1) : new THREE.Vector3(0.75, 0.6, -0.85);
  camera.position.copy(center).addScaledVector(dir.normalize(), 200);
  camera.up.set(0, 1, 0);
  camera.lookAt(center);
  camera.updateMatrixWorld(true);
  let half = 0.01;
  const v = new THREE.Vector3();
  for (let i = 0; i < 8; i++) {
    v.set(i & 1 ? bounds.max.x : bounds.min.x, i & 2 ? bounds.max.y : bounds.min.y, i & 4 ? bounds.max.z : bounds.min.z);
    v.applyMatrix4(camera.matrixWorldInverse);
    half = Math.max(half, Math.abs(v.x), Math.abs(v.y));
  }
  half *= 1.06;
  camera.left = -half;
  camera.right = half;
  camera.top = half;
  camera.bottom = -half;
  camera.updateProjectionMatrix();
  r.render(scene, camera);
  const url = r.domElement.toDataURL();
  scene.remove(model);
  urls.set(id, url);
  return url;
}
