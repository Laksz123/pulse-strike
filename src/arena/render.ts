/** Rendering helpers for the menus: studio lighting, weapon and agent icons, map previews and the turntable. */

import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { buildMap, type MapId } from "./map";
import { buildMarker, type MarkerModel } from "./models";
import { AgentRig } from "./rig";

/** Soft studio reflections: what makes metal and glossy plastic look like metal and plastic. */
export function studio(renderer: THREE.WebGLRenderer): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  return env;
}

function lights(scene: THREE.Scene): void {
  // Soft and not too bright: toy plastic should stay saturated, not bleach out.
  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(2, 3, 2.5);
  const rim = new THREE.DirectionalLight(0xbfe0ff, 0.7);
  rim.position.set(-3, 1.5, -2);
  scene.add(key, rim);
  scene.environmentIntensity = 0.55;
}

/** Centres a marker on the origin and returns the radius of its bounding sphere. */
function centre(model: THREE.Object3D): number {
  const box = new THREE.Box3().setFromObject(model);
  const c = box.getCenter(new THREE.Vector3());
  model.position.sub(c);
  return box.getSize(new THREE.Vector3()).length() / 2;
}

const icons = new Map<string, string>();
let iconRenderer: THREE.WebGLRenderer | null = null;
let iconScene: THREE.Scene | null = null;
const iconCam = new THREE.PerspectiveCamera(28, 1.6, 0.05, 20);

/** A side-on picture of a marker in a given paint job, for cards and the kill feed. */
export function markerIcon(id: string, skin: number): string {
  const key = `${id}:${skin}`;
  const cached = icons.get(key);
  if (cached) return cached;
  if (!iconRenderer) {
    iconRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    iconRenderer.setSize(480, 300, false);
    iconRenderer.toneMapping = THREE.NeutralToneMapping;
    iconScene = new THREE.Scene();
    iconScene.environment = studio(iconRenderer);
    lights(iconScene);
  }
  const model = buildMarker(id, skin, 0.0045).group;
  const holder = new THREE.Group();
  holder.add(model);
  const r = centre(model);
  holder.rotation.set(0.12, Math.PI / 2 + 0.32, 0.04);
  iconScene!.add(holder);
  iconCam.position.set(0, r * 0.2, r * 3.25);
  iconCam.lookAt(0, 0, 0);
  iconRenderer.render(iconScene!, iconCam);
  const url = iconRenderer.domElement.toDataURL();
  iconScene!.remove(holder);
  icons.set(key, url);
  return url;
}

/** A weapon picture that is already drawn, if it is. */
export function iconReady(id: string, skin: number): string | undefined {
  return icons.get(`${id}:${skin}`);
}

const queue: { id: string; skin: number; done: ((url: string) => void)[] }[] = [];
let pumping = false;

/** Draws a weapon picture when there is a moment for it: a few each frame, in the order they were asked for. */
export function iconLater(id: string, skin: number, done: (url: string) => void): void {
  const ready = iconReady(id, skin);
  if (ready) return done(ready);
  const job = queue.find((j) => j.id === id && j.skin === skin);
  if (job) job.done.push(done);
  else queue.push({ id, skin, done: [done] });
  if (pumping) return;
  pumping = true;
  const pump = () => {
    const until = performance.now() + 9;
    while (queue.length && performance.now() < until) {
      const j = queue.shift()!;
      const url = markerIcon(j.id, j.skin);
      for (const fn of j.done) fn(url);
    }
    if (queue.length) setTimeout(pump, 0);
    else pumping = false;
  };
  setTimeout(pump, 0);
}

/** A portrait of an agent, from the same model that runs around in a match. */
export function agentIcon(id: string, full = false): string {
  const key = `agent:${id}:${full}`;
  const cached = icons.get(key);
  if (cached) return cached;
  markerIcon("sprinter", 0);
  const model = new AgentRig(id, 0x2f9bff, 0.014).group;
  const holder = new THREE.Group();
  holder.add(model);
  holder.rotation.y = 0.45;
  iconScene!.add(holder);
  if (full) {
    iconCam.position.set(0, 1.0, 5.8);
    iconCam.lookAt(0, 0.98, 0);
  } else {
    iconCam.position.set(0.12, 1.56, 3.0);
    iconCam.lookAt(0.02, 1.47, 0);
  }
  iconRenderer!.render(iconScene!, iconCam);
  const url = iconRenderer!.domElement.toDataURL();
  iconScene!.remove(holder);
  icons.set(key, url);
  return url;
}

const thumbs = new Map<MapId, Promise<string>>();
const VIEW: Record<MapId, [number, number, number, number, number, number]> = {
  oasis: [-24, 26, 26, 6, 0, -4],
  summit: [-24, 26, 26, 4, 0, -4],
  neon: [-24, 26, 26, 4, 0, -2],
  range: [-30, 10, -6, 10, 1, 0],
};

/** A picture of a map, rendered from the map itself. */
export function mapThumb(id: MapId): Promise<string> {
  let job = thumbs.get(id);
  if (!job) {
    job = (async () => {
      await RAPIER.init();
      // Let the menu paint first, and the textures arrive.
      await new Promise((done) => setTimeout(done, 350));
      const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
      const scene = new THREE.Scene();
      const built = buildMap(id, scene, world);
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(640, 360, false);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.toneMapping = THREE.NeutralToneMapping;
      scene.environment = studio(renderer);
      scene.environmentIntensity = built.env ?? 0.4;
      const v = VIEW[id];
      const cam = new THREE.PerspectiveCamera(62, 16 / 9, 0.1, 700);
      cam.position.set(v[0], v[1], v[2]);
      cam.lookAt(v[3], v[4], v[5]);
      // Textures load asynchronously: draw once they are in.
      await new Promise<void>((done) => {
        const mgr = THREE.DefaultLoadingManager;
        let waited = 0;
        const check = () => {
          let ready = true;
          scene.traverse((o) => {
            const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
            if (m?.map && !(m.map.image as HTMLImageElement | undefined)?.complete && !(m.map.image instanceof HTMLCanvasElement)) ready = false;
          });
          if (ready || (waited += 100) > 4000) done();
          else setTimeout(check, 100);
        };
        void mgr;
        check();
      });
      renderer.render(scene, cam);
      const url = renderer.domElement.toDataURL("image/jpeg", 0.86);
      renderer.dispose();
      renderer.forceContextLoss();
      world.free();
      return url;
    })();
    thumbs.set(id, job);
  }
  return job;
}

/** The slowly turning marker on the arsenal screen. */
export class Turntable {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 1.6, 0.05, 20);
  private holder = new THREE.Group();
  private spin: THREE.Object3D | null = null;
  private rig: AgentRig | null = null;
  private gun: MarkerModel | null = null;
  private clock = 0;
  private raf = 0;
  private dragX: number | null = null;
  private yaw = 0.6;
  private auto = true;
  /** Agents face the viewer and sway instead of spinning all the way round. */
  private sway = false;
  private stop: (() => void)[] = [];

  private canvas: HTMLCanvasElement;

  constructor(host: HTMLElement) {
    // Its own canvas, made here and thrown away with the context: one that has lost its context cannot be given another.
    const canvas = (this.canvas = document.createElement("canvas"));
    canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block";
    host.appendChild(canvas);
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.scene.environment = studio(this.renderer);
    lights(this.scene);
    this.scene.add(this.holder);
    const down = (e: PointerEvent) => {
      this.dragX = e.clientX;
      this.auto = false;
    };
    const move = (e: PointerEvent) => {
      if (this.dragX === null) return;
      this.yaw += (e.clientX - this.dragX) * 0.012;
      this.dragX = e.clientX;
    };
    const up = () => (this.dragX = null);
    canvas.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    this.stop.push(() => canvas.removeEventListener("pointerdown", down), () => window.removeEventListener("pointermove", move), () => window.removeEventListener("pointerup", up));
    let last = performance.now();
    const frame = (now: number) => {
      this.raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (this.auto) this.yaw = this.sway ? 0.5 + Math.sin(now / 1500) * 0.6 : this.yaw + dt * 0.55;
      this.holder.rotation.y = this.yaw;
      if (this.spin) this.spin.rotation.z += dt * 6;
      this.rig?.update(dt, { vx: 0, vz: 0, pitch: 0, aim: 0, cheer: true });
      // A weapon on show works its action every couple of seconds.
      this.clock += dt;
      const beat = this.clock % 2.6;
      this.gun?.anim?.({ t: this.clock, fire: Math.exp(-beat * 4), shots: Math.floor(this.clock / 2.6), charge: Math.max(0, Math.sin(this.clock * 0.9)), spin: 0.15, ammo: 0.5 + Math.sin(this.clock * 0.35) * 0.45 });
      this.fit();
      this.renderer.render(this.scene, this.camera);
    };
    this.raf = requestAnimationFrame(frame);
  }

  private fit(): void {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h) return;
    const need = this.renderer.getSize(new THREE.Vector2());
    if (need.x !== w || need.y !== h) {
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
  }

  /** Shows an agent, standing. */
  showAgent(id: string, weapon?: { id: string; skin: number }): void {
    this.holder.clear();
    const built = new AgentRig(id, 0x2f9bff);
    this.gun = weapon ? buildMarker(weapon.id, weapon.skin, 0.005) : null;
    if (this.gun) built.setWeapon(this.gun);
    built.group.position.y = -0.95;
    this.holder.add(built.group);
    this.rig = built;
    this.spin = null;
    this.sway = true;
    this.camera.position.set(0, 0.2, 4.0);
    this.camera.lookAt(0, 0.02, 0);
    this.auto = true;
  }

  show(id: string, skin: number): void {
    this.holder.clear();
    const built = buildMarker(id, skin);
    this.gun = built;
    const tilt = new THREE.Group();
    tilt.add(built.group);
    const r = centre(built.group);
    tilt.rotation.z = 0.12;
    this.holder.add(tilt);
    this.spin = built.spin ?? null;
    this.rig = null;
    this.sway = false;
    this.camera.position.set(0, r * 0.35, r * 3.3);
    this.camera.lookAt(0, 0, 0);
    this.auto = true;
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    for (const fn of this.stop) fn();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
  }
}
