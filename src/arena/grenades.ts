/**
 * Things you throw. All three are paint, like everything else here:
 *   Клякса — bursts and covers the eyes of anyone looking at it;
 *   Пена   — swells into a hill of foam nobody can see through;
 *   Лава   — spreads into a boiling puddle that hurts to stand in.
 * A grenade is thrown on an arc, bounces off what it hits and goes off on a fuse (the Лава: as
 * soon as it lands). Also here: `Puffs`, the little clouds kicked up by running feet and bounces.
 */

import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { sfx } from "../game/audio";
import type { Actor } from "./paint";

export type NadeKind = "flash" | "smoke" | "fire";

export const NADES: Record<NadeKind, { name: string; price: number; key: string; about: string; color: number; fuse: number }> = {
  flash: { name: "Клякса", price: 200, key: "4", about: "Лопается и заливает краской глаза всем, кто на неё смотрел.", color: 0xffd21a, fuse: 1.5 },
  smoke: { name: "Пена", price: 300, key: "5", about: "Вырастает в гору пены: сквозь неё ничего не видно 12 секунд.", color: 0xeef3f8, fuse: 1.7 },
  fire: { name: "Лава", price: 400, key: "6", about: "Разливается кипящей лужей: стоять в ней больно.", color: 0xff5a1a, fuse: 2.4 },
};
export const NADE_ORDER: NadeKind[] = ["flash", "smoke", "fire"];

const MAX = 240;

/** Short-lived puffs: dust, foam flecks, sparks. One instanced mesh for all of them. */
export class Puffs {
  private list: { p: THREE.Vector3; v: THREE.Vector3; t: number; life: number; size: number; color: number; grow: number }[] = [];
  private mesh: THREE.InstancedMesh;
  private m4 = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();
  private c = new THREE.Color();

  constructor(scene: THREE.Scene) {
    this.mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial({ toneMapped: false }), MAX);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.setColorAt(0, this.c.set(0xffffff));
    scene.add(this.mesh);
  }

  emit(p: THREE.Vector3, v: THREE.Vector3, life: number, size: number, color: number, grow = 1.6): void {
    if (this.list.length >= MAX) this.list.shift();
    this.list.push({ p: p.clone(), v: v.clone(), t: 0, life, size, color, grow });
  }

  /** A ring of dust at a point on the ground. */
  kick(x: number, y: number, z: number, n: number, color: number, size = 0.1): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      this.emit(new THREE.Vector3(x, y + 0.05, z), new THREE.Vector3(Math.cos(a) * 0.9, 0.5 + Math.random() * 0.6, Math.sin(a) * 0.9), 0.35 + Math.random() * 0.25, size * (0.7 + Math.random() * 0.6), color);
    }
  }

  update(dt: number): void {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.t += dt;
      if (p.t >= p.life) {
        this.list.splice(i, 1);
        continue;
      }
      p.v.multiplyScalar(Math.exp(-3 * dt));
      p.p.addScaledVector(p.v, dt);
    }
    this.mesh.count = this.list.length;
    this.list.forEach((p, i) => {
      const u = p.t / p.life;
      // Swell quickly, then shrink away.
      const k = p.size * (u < 0.25 ? 0.4 + (u / 0.25) * 0.6 * p.grow : p.grow * (1 - (u - 0.25) / 0.75));
      this.m4.compose(p.p, this.q, this.s.setScalar(Math.max(0.001, k)));
      this.mesh.setMatrixAt(i, this.m4);
      this.mesh.setColorAt(i, this.c.set(p.color));
    });
    if (this.list.length) {
      this.mesh.instanceMatrix.needsUpdate = true;
      this.mesh.instanceColor!.needsUpdate = true;
    }
  }

  clear(): void {
    this.list.length = 0;
    this.mesh.count = 0;
  }
}

interface Flying {
  kind: NadeKind;
  p: THREE.Vector3;
  v: THREE.Vector3;
  t: number;
  owner: Actor;
  mesh: THREE.Group;
}

interface Cloud {
  p: THREE.Vector3;
  t: number;
  group: THREE.Group;
  blobs: { mesh: THREE.Mesh; size: number; phase: number }[];
}

interface Pool {
  p: THREE.Vector3;
  t: number;
  tick: number;
  owner: Actor;
  group: THREE.Group;
  flames: THREE.Mesh[];
  light: THREE.PointLight;
}

export interface NadeHooks {
  bodies(): Actor[];
  /** Does `by`'s grenade affect `a`? */
  affects(by: Actor, a: Actor): boolean;
  /** True for the world, false for bodies. */
  solid(c: RAPIER.Collider): boolean;
  hurt(victim: Actor, by: Actor, dmg: number, name: string): void;
  /** A Клякса went off at `at` in `victim`'s sight: how much of it they catch is the arena's business. */
  blind(victim: Actor, at: THREE.Vector3, color: number): void;
  splat(point: THREE.Vector3, normal: THREE.Vector3, color: number, size: number): void;
  /** How loud and to which side something at `p` is, for the player. */
  hear(p: THREE.Vector3): { vol: number; pan: number };
}

const FOAM_LIFE = 12;
const FOAM_R = 4.4;
const LAVA_LIFE = 6.5;
const LAVA_R = 3.1;
const up = new THREE.Vector3(0, 1, 0);

function blobTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const x = c.getContext("2d")!;
  const g = x.createRadialGradient(128, 128, 20, 128, 128, 120);
  g.addColorStop(0, "#fff3b0");
  g.addColorStop(0.5, "#ff9a2a");
  g.addColorStop(1, "#e2360c");
  x.fillStyle = g;
  x.beginPath();
  for (let i = 0; i <= 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    const r = 96 + Math.sin(a * 5) * 12 + Math.sin(a * 9 + 1) * 9;
    x.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r);
  }
  x.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Grenades {
  private flying: Flying[] = [];
  private clouds: Cloud[] = [];
  private pools: Pool[] = [];
  private lava = blobTexture();
  private tmp = new THREE.Vector3();
  private tmp2 = new THREE.Vector3();

  constructor(private scene: THREE.Scene, private world: RAPIER.World, private puffs: Puffs, private hooks: NadeHooks) {}

  throw(kind: NadeKind, owner: Actor, from: THREE.Vector3, velocity: THREE.Vector3): void {
    const mesh = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 10), new THREE.MeshStandardMaterial({ color: NADES[kind].color, roughness: 0.4 }));
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.07, 10), new THREE.MeshStandardMaterial({ color: 0x23262d, roughness: 0.5 }));
    cap.position.y = 0.1;
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.016, 8, 18), new THREE.MeshStandardMaterial({ color: owner.color, emissive: owner.color, emissiveIntensity: 1.2 }));
    band.rotation.x = Math.PI / 2;
    mesh.add(body, cap, band);
    mesh.position.copy(from);
    this.scene.add(mesh);
    this.flying.push({ kind, p: from.clone(), v: velocity.clone(), t: 0, owner, mesh });
  }

  /** Is the line from `a` to `b` cut by foam? */
  blocksSight(a: THREE.Vector3, b: THREE.Vector3): boolean {
    for (const c of this.clouds) {
      if (c.t < 0.5 || c.t > FOAM_LIFE - 1) continue;
      const centre = this.tmp.copy(c.p).setY(c.p.y + 1.3);
      const ab = this.tmp2.subVectors(b, a);
      const u = Math.max(0, Math.min(1, centre.clone().sub(a).dot(ab) / (ab.lengthSq() || 1)));
      if (a.clone().addScaledVector(ab, u).distanceTo(centre) < FOAM_R * 0.82) return true;
    }
    return false;
  }

  /** The centre of the lava someone at (x, z) is standing in, if any. */
  lavaAt(x: number, z: number): THREE.Vector3 | null {
    for (const p of this.pools) if (Math.hypot(p.p.x - x, p.p.z - z) < LAVA_R + 0.3) return p.p;
    return null;
  }

  private floor(p: THREE.Vector3): number {
    const hit = this.world.castRay(new RAPIER.Ray({ x: p.x, y: p.y + 0.3, z: p.z }, { x: 0, y: -1, z: 0 }), 12, true, undefined, undefined, undefined, undefined, (c) => this.hooks.solid(c));
    return hit ? p.y + 0.3 - hit.timeOfImpact : 0;
  }

  private burst(g: Flying): void {
    this.scene.remove(g.mesh);
    const at = g.p.clone();
    const heard = this.hooks.hear(at);
    if (g.kind === "flash") {
      sfx.splatBang(Math.max(0.15, heard.vol));
      for (let i = 0; i < 22; i++) {
        const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9 - 0.35, Math.random() - 0.5).normalize();
        const hit = this.world.castRayAndGetNormal(new RAPIER.Ray(at, dir), 7, true, undefined, undefined, undefined, undefined, (c) => this.hooks.solid(c));
        if (hit) this.hooks.splat(at.clone().addScaledVector(dir, hit.timeOfImpact), new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z), i % 3 ? g.owner.color : NADES.flash.color, 0.8 + Math.random() * 1.4);
        this.puffs.emit(at, dir.multiplyScalar(6 + Math.random() * 5), 0.4 + Math.random() * 0.3, 0.16, i % 2 ? g.owner.color : 0xffffff, 2.4);
      }
      for (const a of this.hooks.bodies()) {
        if (!a.alive) continue;
        const eye = a.chest(new THREE.Vector3());
        eye.y += 0.45;
        const to = this.tmp.subVectors(at, eye);
        const d = to.length();
        if (d > 26) continue;
        if (d > 0.5 && this.world.castRay(new RAPIER.Ray(eye, to.multiplyScalar(1 / d)), d - 0.2, true, undefined, undefined, undefined, undefined, (c) => this.hooks.solid(c))) continue;
        this.hooks.blind(a, at, g.owner.color);
      }
      return;
    }
    at.y = this.floor(at);
    if (g.kind === "smoke") {
      sfx.foam(Math.max(0.15, heard.vol));
      const group = new THREE.Group();
      group.position.copy(at);
      const blobs: Cloud["blobs"] = [];
      const tint = new THREE.Color(g.owner.color).lerp(new THREE.Color(0xffffff), 0.82);
      for (let i = 0; i < 17; i++) {
        const a = (i / 17) * Math.PI * 2 + Math.random();
        const r = i < 4 ? Math.random() * 1.2 : 1.6 + Math.random() * 2.2;
        const size = 1.3 + Math.random() * 1.1 - (r > 3 ? 0.4 : 0);
        const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), new THREE.MeshStandardMaterial({ color: i % 3 ? 0xf7f9fc : tint, roughness: 1, flatShading: false }));
        mesh.position.set(Math.cos(a) * r, 0.5 + Math.random() * (r < 2 ? 2.2 : 1.0), Math.sin(a) * r);
        group.add(mesh);
        blobs.push({ mesh, size, phase: Math.random() * 6 });
      }
      this.scene.add(group);
      this.clouds.push({ p: at, t: 0, group, blobs });
      this.puffs.kick(at.x, at.y, at.z, 14, 0xffffff, 0.3);
      return;
    }
    sfx.ignite(Math.max(0.15, heard.vol));
    const group = new THREE.Group();
    group.position.copy(at).setY(at.y + 0.04);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(LAVA_R, 40), new THREE.MeshBasicMaterial({ map: this.lava, transparent: true, toneMapped: false, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }));
    disc.rotation.x = -Math.PI / 2;
    group.add(disc);
    const flames: THREE.Mesh[] = [];
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * (LAVA_R - 0.4);
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.9, 6), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffd24a : 0xff7a1a, toneMapped: false }));
      f.position.set(Math.cos(a) * r, 0.4, Math.sin(a) * r);
      group.add(f);
      flames.push(f);
    }
    const light = new THREE.PointLight(0xff8a2a, 40, 12, 1.6);
    light.position.y = 1;
    group.add(light);
    this.scene.add(group);
    this.pools.push({ p: at, t: 0, tick: 0, owner: g.owner, group, flames, light });
  }

  update(dt: number): void {
    for (let i = this.flying.length - 1; i >= 0; i--) {
      const g = this.flying[i];
      g.t += dt;
      g.v.y -= 15 * dt;
      const speed = g.v.length();
      const dir = this.tmp.copy(g.v).multiplyScalar(1 / (speed || 1));
      const hit = this.world.castRayAndGetNormal(new RAPIER.Ray(g.p, dir), speed * dt + 0.1, true, undefined, undefined, undefined, undefined, (c) => this.hooks.solid(c));
      let landed = false;
      if (hit) {
        const n = this.tmp2.set(hit.normal.x, hit.normal.y, hit.normal.z);
        g.p.addScaledVector(dir, Math.max(0, hit.timeOfImpact - 0.1));
        g.v.addScaledVector(n, -2 * g.v.dot(n)).multiplyScalar(0.42);
        landed = n.y > 0.5;
        if (speed > 2.5) {
          const h = this.hooks.hear(g.p);
          if (h.vol > 0.02) sfx.bounce(h.vol);
          this.puffs.kick(g.p.x, g.p.y, g.p.z, 3, 0xd9d2c0, 0.07);
        }
      } else g.p.addScaledVector(dir, speed * dt);
      g.mesh.position.copy(g.p);
      g.mesh.rotation.x += dt * speed * 1.5;
      g.mesh.rotation.z += dt * speed;
      if (g.t >= NADES[g.kind].fuse || (g.kind === "fire" && landed) || g.p.y < -5) {
        this.flying.splice(i, 1);
        this.burst(g);
      }
    }
    for (let i = this.clouds.length - 1; i >= 0; i--) {
      const c = this.clouds[i];
      c.t += dt;
      if (c.t >= FOAM_LIFE) {
        this.scene.remove(c.group);
        this.clouds.splice(i, 1);
        continue;
      }
      const grow = Math.min(1, c.t / 0.9);
      const fade = Math.min(1, (FOAM_LIFE - c.t) / 1.5);
      const k = (1 - (1 - grow) ** 3) * fade;
      for (const b of c.blobs) b.mesh.scale.setScalar(Math.max(0.001, b.size * k * (1 + Math.sin(c.t * 1.6 + b.phase) * 0.05)));
    }
    let burning = 0;
    for (let i = this.pools.length - 1; i >= 0; i--) {
      const p = this.pools[i];
      p.t += dt;
      if (p.t >= LAVA_LIFE) {
        this.scene.remove(p.group);
        this.pools.splice(i, 1);
        continue;
      }
      const k = Math.min(1, p.t / 0.35) * Math.min(1, (LAVA_LIFE - p.t) / 0.8);
      p.group.scale.set(k, 1, k);
      p.light.intensity = 40 * k * (0.8 + Math.random() * 0.4);
      p.flames.forEach((f, n) => {
        const s = 0.5 + Math.abs(Math.sin(p.t * 7 + n * 1.7)) * 0.9;
        f.scale.set(0.8 + s * 0.3, s * k, 0.8 + s * 0.3);
        f.position.y = 0.45 * s * k;
      });
      if (Math.random() < dt * 14) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * LAVA_R * k;
        this.puffs.emit(new THREE.Vector3(p.p.x + Math.cos(a) * r, p.p.y + 0.3, p.p.z + Math.sin(a) * r), new THREE.Vector3(0, 2.4, 0), 0.6, 0.09, 0xffc24a);
      }
      burning = Math.max(burning, this.hooks.hear(p.p).vol * k);
      p.tick -= dt;
      if (p.tick <= 0) {
        p.tick = 0.25;
        for (const a of this.hooks.bodies()) {
          if (!a.alive || !this.hooks.affects(p.owner, a)) continue;
          const c = a.chest(this.tmp);
          if (Math.hypot(c.x - p.p.x, c.z - p.p.z) < LAVA_R * k && Math.abs(c.y - 1.1 - p.p.y) < 2) this.hooks.hurt(a, p.owner, 6, NADES.fire.name);
        }
      }
    }
    sfx.loop("fire", burning);
    void up;
  }

  clear(): void {
    for (const g of this.flying) this.scene.remove(g.mesh);
    for (const c of this.clouds) this.scene.remove(c.group);
    for (const p of this.pools) this.scene.remove(p.group);
    this.flying.length = this.clouds.length = this.pools.length = 0;
    sfx.loop("fire", 0);
  }
}
