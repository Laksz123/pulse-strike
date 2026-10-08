/**
 * The scene behind the main menu: the player's agent standing on a lit pad in a staging yard.
 * It is built from the same models, props and textures as the matches, so the menu already looks
 * like the game. The light and sky follow the map that is selected.
 */

import { LIGHT } from "../device";
import * as THREE from "three";
import { texture, type MapId } from "./map";
import { buildMarker, pbr, type MarkerModel } from "./models";
import * as P from "./props";
import { studio } from "./render";
import { AgentRig } from "./rig";

interface Mood {
  sky: [string, string, string];
  sun: number;
  sunPower: number;
  hemi: [number, number, number];
  fog: number;
  ground: string;
  tint: number;
  lamp: number;
  env: number;
}

const MOODS: Partial<Record<MapId, Mood>> = {
  oasis: { sky: ["#1b73e0", "#7ac6ff", "#f6e4be"], sun: 0xfff0d2, sunPower: 2.7, hemi: [0xcfe6ff, 0xdcb98a, 1.0], fog: 0xf3e0bb, ground: "paving", tint: 0xffffff, lamp: 0, env: 0.45 },
  summit: { sky: ["#141f4d", "#5b57a6", "#ffb48c"], sun: 0xffb98a, sunPower: 2.4, hemi: [0xb4c6ff, 0x8f96bb, 0.95], fog: 0xb7b3da, ground: "snow", tint: 0xeef3ff, lamp: 14, env: 0.38 },
  neon: { sky: ["#070a1c", "#1a1640", "#3a2a6a"], sun: 0x9ab0ff, sunPower: 1.5, hemi: [0x8a9aff, 0x30304a, 1.15], fog: 0x1a1838, ground: "wetasphalt", tint: 0xb0b4c8, lamp: 70, env: 0.24 },
};

const BOX_COLORS = [0xd9483b, 0x2f7fd0, 0x3fa55a, 0xf2b530, 0xe8742a, 0x1f9a94];

export class LobbyScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 1.6, 0.1, 500);
  private holder = new THREE.Group();
  private agent: AgentRig | null = null;
  private gun: MarkerModel | null = null;
  private sun = new THREE.DirectionalLight(0xffffff, 2);
  private rim = new THREE.DirectionalLight(0x9fd0ff, 1.2);
  private hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 1);
  private lamp = new THREE.PointLight(0xffd0a0, 0, 26, 1.6);
  private dome: THREE.Mesh;
  private ground: THREE.Mesh;
  private raf = 0;
  private yaw = 0;
  private drag: number | null = null;
  private idle = 0;
  private stop: (() => void)[] = [];

  private canvas: HTMLCanvasElement;

  constructor(host: HTMLElement) {
    // Its own canvas, made here and thrown away with the context: one that has lost its context cannot be given another.
    const canvas = (this.canvas = document.createElement("canvas"));
    canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block";
    host.appendChild(canvas);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, LIGHT ? 1.25 : 2));
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene.environment = studio(this.renderer);

    this.dome = new THREE.Mesh(new THREE.SphereGeometry(240, 24, 16), new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false, toneMapped: false }));
    this.ground = new THREE.Mesh(new THREE.CircleGeometry(120, 48), new THREE.MeshStandardMaterial({ roughness: 0.95 }));
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -14;
    sc.right = 14;
    sc.top = 14;
    sc.bottom = -14;
    sc.far = 90;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.04;
    this.rim.position.set(-6, 5, -8);
    this.lamp.position.set(4.6, 4.6, -4.8);
    this.scene.add(this.dome, this.ground, this.sun, this.rim, this.hemi, this.lamp, this.holder);
    this.build();
    this.setMood("oasis");
    this.camera.position.set(0, 1.3, 5.9);
    this.camera.lookAt(0, 0.9, 0);

    const down = (e: PointerEvent) => (this.drag = e.clientX);
    const move = (e: PointerEvent) => {
      if (this.drag === null) return;
      this.yaw += (e.clientX - this.drag) * 0.01;
      this.drag = e.clientX;
      this.idle = 0;
    };
    const up = () => (this.drag = null);
    canvas.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    this.stop.push(() => canvas.removeEventListener("pointerdown", down), () => window.removeEventListener("pointermove", move), () => window.removeEventListener("pointerup", up));

    let last = performance.now();
    const frame = (now: number) => {
      this.raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      this.fit();
      // Left alone, the agent drifts back to face the camera.
      this.idle += dt;
      if (this.drag === null && this.idle > 2.5) this.yaw += (0 - this.yaw) * (1 - Math.exp(-1.5 * dt));
      const t = now / 1000;
      this.holder.rotation.y = 0.32 + this.yaw + Math.sin(t * 0.5) * 0.06;
      this.agent?.update(dt, { vx: 0, vz: 0, pitch: 0, aim: 0, cheer: true });
      this.gun?.anim?.({ t, fire: 0, shots: 0, charge: Math.max(0, Math.sin(t * 0.8)) * 0.6, spin: 0.1, ammo: 0.55 + Math.sin(t * 0.3) * 0.4 });
      this.renderer.render(this.scene, this.camera);
    };
    this.raf = requestAnimationFrame(frame);
  }

  private fit(): void {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h) return;
    const size = this.renderer.getSize(new THREE.Vector2());
    if (size.x !== w || size.y !== h) {
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      // Narrow windows: pull back so the agent still fits between the panels.
      this.camera.fov = w / h < 1.5 ? 36 : 30;
      this.camera.updateProjectionMatrix();
    }
  }

  /** The pad the agent stands on, and a yard of props behind it. */
  private build(): void {
    const s = this.scene;
    const add = (o: THREE.Object3D, x: number, z: number, yaw = 0, y = 0) => {
      o.position.set(x, y, z);
      o.rotation.y = yaw;
      o.traverse((m) => {
        const mesh = m as THREE.Mesh;
        if (mesh.isMesh && !mesh.userData.outline) {
          mesh.castShadow = true;
          mesh.receiveShadow = true;
        }
      });
      s.add(o);
    };
    const tex = (name: string, rx: number, ry: number) => {
      const t = texture(name).clone();
      t.repeat.set(rx, ry);
      t.needsUpdate = true;
      return t;
    };
    const box = (w: number, h: number, d: number, map: THREE.Texture, tint = 0xffffff) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ map, color: tint, roughness: 0.94 }));
    // The pad.
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.35, 0.14, 48), new THREE.MeshStandardMaterial({ map: tex("metalfloor", 2, 2), roughness: 0.7, metalness: 0.2 }));
    add(pad, 0, 0, 0, 0.07);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.06, 0.045, 10, 64), new THREE.MeshBasicMaterial({ color: 0x35e0ff, toneMapped: false }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.15;
    s.add(ring);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.055, 8, 64), pbr(0x101833, 0.3, 0.5));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.12;
    s.add(rim);
    // Containers: two stacks that frame the agent.
    const cont = (x: number, z: number, yaw: number, tint: number, y = 0) => add(box(6.06, 2.59, 2.44, tex("corrugated", 2.3, 1), tint), x, z, yaw, y + 1.295);
    cont(-8.2, -6.5, 0.5, BOX_COLORS[1]);
    cont(-8.6, -6.9, 0.38, BOX_COLORS[4], 2.59);
    cont(-13.5, -11, 0.2, BOX_COLORS[2]);
    cont(8.8, -7.5, -0.42, BOX_COLORS[0]);
    cont(9.4, -7.2, -0.6, BOX_COLORS[3], 2.59);
    cont(14.5, -12.5, -0.15, BOX_COLORS[5]);
    cont(1.5, -17, 0.05, BOX_COLORS[1]);
    cont(-5, -19, -0.1, BOX_COLORS[0]);
    cont(-4.6, -19.2, 0, BOX_COLORS[3], 2.59);
    const crate = (x: number, z: number, size: number, yaw: number, y = 0) => add(box(size, size, size, tex("crate", 1, 1)), x, z, yaw, y + size / 2);
    // Everything else stands behind the agent: nothing between it and the camera.
    crate(-3.7, -3.4, 1.3, 0.3);
    crate(-5.0, -3.9, 1.3, -0.2);
    crate(-4.3, -3.6, 1.0, 0.6, 1.3);
    crate(2.7, -4.6, 1.1, 0.5);
    add(P.barrel(0x2f7fd0), 3.6, -3.3, 0);
    add(P.barrel(0xf2b530), 4.5, -3.8, 1);
    add(P.sandbags(), -2.3, -2.3, 0.35);
    add(P.pallet(), 2.2, -2.7, -0.5);
    add(P.lampPost(0xffd9a0, 5.2), 5.4, -4.8, Math.PI);
    add(P.car(0xe8742a, "pickup"), -8.6, -5.4, 0.95);
    add(P.truck(0x2f7fd0), 10.2, -6.8, -2.0);
    add(P.cone(), -1.7, -1.5);
    add(P.cone(), 1.9, -1.8);
  }

  setMood(map: MapId): void {
    const m = MOODS[map] ?? MOODS.oasis!;
    const c = document.createElement("canvas");
    c.width = 16;
    c.height = 256;
    const ctx = c.getContext("2d")!;
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, m.sky[0]);
    g.addColorStop(0.42, m.sky[1]);
    g.addColorStop(0.53, m.sky[2]);
    g.addColorStop(1, m.sky[2]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 16, 256);
    const sky = new THREE.CanvasTexture(c);
    sky.colorSpace = THREE.SRGBColorSpace;
    const dm = this.dome.material as THREE.MeshBasicMaterial;
    dm.map?.dispose();
    dm.map = sky;
    dm.needsUpdate = true;
    const gm = this.ground.material as THREE.MeshStandardMaterial;
    const gt = texture(m.ground).clone();
    gt.repeat.set(48, 48);
    gt.needsUpdate = true;
    gm.map?.dispose();
    gm.map = gt;
    gm.color.set(m.tint);
    gm.needsUpdate = true;
    this.scene.fog = new THREE.Fog(m.fog, 16, 70);
    this.scene.environmentIntensity = m.env;
    this.sun.color.set(m.sun);
    this.sun.intensity = m.sunPower;
    this.sun.position.set(map === "summit" ? -14 : 9, map === "summit" ? 9 : 16, 10);
    this.hemi.color.set(m.hemi[0]);
    this.hemi.groundColor.set(m.hemi[1]);
    this.hemi.intensity = m.hemi[2];
    this.lamp.intensity = m.lamp;
    this.rim.intensity = map === "neon" ? 2.2 : 1.1;
  }

  setAgent(id: string, weapon: { id: string; skin: number }): void {
    if (this.agent) this.holder.remove(this.agent.group);
    const a = new AgentRig(id, 0x2f9bff);
    const gun = buildMarker(weapon.id, weapon.skin, 0.005);
    gun.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && !mesh.userData.outline) mesh.castShadow = true;
    });
    a.setWeapon(gun, 1.3);
    this.gun = gun;
    a.group.position.y = 0.14;
    this.holder.add(a.group);
    this.agent = a;
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    for (const fn of this.stop) fn();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
  }
}
