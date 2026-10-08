/**
 * Charges in flight. Every one is simulated: it drops, bounces, sticks, homes or bursts according
 * to the weapon that fired it, hurts whoever it touches and leaves a scorch where it lands.
 */

import { RAPIER } from "../physics";
import * as THREE from "three";
import { sfx } from "../game/audio";
import type { MarkerDef } from "./markers";

/** Anyone who can be hit: the player, a bot. */
export interface Actor {
  id: number;
  name: string;
  team: number;
  color: number;
  alive: boolean;
  /** Seconds of spawn protection left. */
  protect: number;
  collider: RAPIER.Collider;
  /** Chest position. */
  chest(out: THREE.Vector3): THREE.Vector3;
  velocity: THREE.Vector3;
  hurt(by: Actor, dmg: number, weapon: string, head: boolean): void;
  /**
   * Hitboxes of its own: does a shot from `origin` along `dir` reach it within `dist`? Those who
   * have none are hit on the capsule they walk in.
   */
  hitTest?(origin: THREE.Vector3, dir: THREE.Vector3, dist: number, pad: number, out: { t: number; head: boolean }): boolean;
}

/** How much kinder than the model a hitbox is, metres: a shot that grazes still counts. */
const GRAZE = 0.02;

interface Ball {
  p: THREE.Vector3;
  v: THREE.Vector3;
  r: number;
  dmg: number;
  life: number;
  color: number;
  owner: Actor;
  def: MarkerDef;
  bounces: number;
  pierce: boolean;
  /** Children of a cluster do not split again. */
  child: boolean;
  /** Stuck in place (or to an actor) and waiting to burst. */
  fuse: number;
  stuckTo: Actor | null;
  stuckOff: THREE.Vector3;
  hit: Set<number>;
}

const MAX_BALLS = 700;
const MAX_SPLATS = 1100;
const UP = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);
const RAINBOW = [0xff3b30, 0xff9500, 0xffd60a, 0x34c759, 0x0a84ff, 0xbf5af2];

/** A splat drawn in code: a blob with lobes and satellite drops. */
function splatTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff";
  const blob = (x: number, y: number, r: number) => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };
  blob(64, 64, 30);
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2 + Math.random() * 0.4;
    const d = 26 + Math.random() * 16;
    blob(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, 7 + Math.random() * 9);
    if (i % 2) blob(64 + Math.cos(a) * (d + 16), 64 + Math.sin(a) * (d + 16), 2 + Math.random() * 4);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Paint {
  private balls: Ball[] = [];
  private ballMesh: THREE.InstancedMesh;
  private splatMesh: THREE.InstancedMesh;
  private splatAt = 0;
  private splatCount = 0;
  private m4 = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private q2 = new THREE.Quaternion();
  private s = new THREE.Vector3();
  private color = new THREE.Color();
  private tmp = new THREE.Vector3();
  private tmp2 = new THREE.Vector3();
  private found = { t: 0, head: false };

  constructor(
    private scene: THREE.Scene,
    private world: RAPIER.World,
    private actors: () => Actor[],
    private byHandle: Map<number, Actor>,
    /** In team modes paint passes through teammates. */
    private teams: boolean,
  ) {
    this.ballMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ toneMapped: false }), MAX_BALLS);
    this.ballMesh.count = 0;
    this.ballMesh.frustumCulled = false;
    this.splatMesh = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshStandardMaterial({ map: splatTexture(), alphaTest: 0.5, transparent: false, roughness: 0.22, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
      MAX_SPLATS,
    );
    this.splatMesh.count = 0;
    this.splatMesh.frustumCulled = false;
    this.splatMesh.receiveShadow = true;
    scene.add(this.ballMesh, this.splatMesh);
    // Instance colours need their buffers before the first draw.
    this.ballMesh.setColorAt(0, this.color.set(0xffffff));
    this.splatMesh.setColorAt(0, this.color.set(0xffffff));
  }

  private enemy(a: Actor, b: Actor): boolean {
    return a !== b && (!this.teams || a.team !== b.team);
  }

  /** Fires a marker once: all its pellets, with its spread. `charge` is 0..1 for charged shots. */
  shoot(owner: Actor, def: MarkerDef, origin: THREE.Vector3, dir: THREE.Vector3, spreadMul = 1, charge = 0): void {
    const right = this.tmp.crossVectors(dir, UP).normalize().clone();
    const up = this.tmp2.crossVectors(right, dir).normalize().clone();
    const spread = def.spread * spreadMul;
    for (let i = 0; i < def.pellets; i++) {
      const d = dir.clone();
      if (def.fan) d.addScaledVector(right, ((i / (def.pellets - 1)) * 2 - 1) * spread).addScaledVector(up, (Math.random() - 0.5) * 0.01);
      else {
        const a = Math.random() * Math.PI * 2;
        const m = spread * Math.sqrt(Math.random());
        d.addScaledVector(right, Math.cos(a) * m).addScaledVector(up, Math.sin(a) * m);
      }
      d.normalize();
      const speed = def.mode === "charge" ? def.speed + charge * 170 : def.speed * (def.pellets > 1 && !def.fan ? 0.92 + Math.random() * 0.16 : 1);
      this.spawn({
        p: origin.clone(), v: d.multiplyScalar(speed), r: def.size * (def.mode === "charge" ? 1 + charge * 0.9 : 1), life: def.sticky ? 8 : 5,
        dmg: def.dmg * (def.mode === "charge" ? 1 + charge * 2 : 1),
        color: def.id === "raduga" ? RAINBOW[Math.floor(Math.random() * RAINBOW.length)] : owner.color,
        owner, def, bounces: def.bounces ?? 0, pierce: def.mode === "charge" && charge > 0.95, child: false, fuse: -1, stuckTo: null,
        stuckOff: new THREE.Vector3(), hit: new Set(),
      });
    }
  }

  /** A new round: everything in flight is gone. The marks on the walls stay. */
  clear(): void {
    this.balls.length = 0;
    this.ballMesh.count = 0;
  }

  private spawn(b: Ball): void {
    if (this.balls.length >= MAX_BALLS) this.balls.shift();
    this.balls.push(b);
  }

  /** Paint on a surface. */
  splat(point: THREE.Vector3, normal: THREE.Vector3, color: number, size: number): void {
    const i = this.splatAt;
    this.splatAt = (this.splatAt + 1) % MAX_SPLATS;
    this.splatCount = Math.min(MAX_SPLATS, this.splatCount + 1);
    this.q.setFromUnitVectors(Z, normal);
    this.q2.setFromAxisAngle(Z, Math.random() * Math.PI * 2);
    this.q.multiply(this.q2);
    const s = size * (0.8 + Math.random() * 0.5);
    this.m4.compose(this.tmp.copy(point).addScaledVector(normal, 0.012 + Math.random() * 0.006), this.q, this.s.set(s, s, 1));
    this.splatMesh.setMatrixAt(i, this.m4);
    this.splatMesh.setColorAt(i, this.color.set(color));
    this.splatMesh.count = this.splatCount;
    this.splatMesh.instanceMatrix.needsUpdate = true;
    this.splatMesh.instanceColor!.needsUpdate = true;
  }

  /** A blast: scorches in every direction and damage, falling off with distance, to every enemy in sight of it. */
  burst(point: THREE.Vector3, radius: number, dmg: number, owner: Actor, color: number, weapon: string): void {
    sfx.splat(0.9);
    for (let i = 0; i < 14; i++) {
      const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8 - 0.5, Math.random() - 0.5).normalize();
      const hit = this.world.castRayAndGetNormal(new RAPIER.Ray(point, dir), radius, true, undefined, undefined, undefined, undefined, (c) => !this.byHandle.has(c.handle));
      if (hit) this.splat(point.clone().addScaledVector(dir, hit.timeOfImpact), new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z), color, 0.5 + Math.random() * 0.8);
    }
    for (const a of this.actors()) {
      if (!a.alive || a.protect > 0 || !this.enemy(owner, a)) continue;
      const to = a.chest(this.tmp).sub(point);
      const d = to.length();
      if (d >= radius) continue;
      // Cover works: a wall between the blast and the body stops it.
      if (d > 0.4 && this.world.castRay(new RAPIER.Ray(point, to.multiplyScalar(1 / d)), d - 0.3, true, undefined, undefined, undefined, undefined, (c) => !this.byHandle.has(c.handle))) continue;
      a.hurt(owner, Math.round(dmg * (1 - 0.7 * (d / radius))), weapon, false);
    }
  }

  private cluster(b: Ball, at: THREE.Vector3): void {
    const n = b.def.cluster ?? 0;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const up = 0.15 + Math.random() * 0.7;
      const v = new THREE.Vector3(Math.cos(a), up, Math.sin(a)).normalize().multiplyScalar(22 + Math.random() * 10);
      this.spawn({
        p: at.clone().add(new THREE.Vector3(0, 0.15, 0)), v, r: 0.06, dmg: b.def.dmg * 0.5, life: 3, color: RAINBOW[i % RAINBOW.length], owner: b.owner,
        def: { ...b.def, cluster: undefined, splash: undefined, gravity: 1 }, bounces: 0, pierce: false, child: true, fuse: -1, stuckTo: null,
        stuckOff: new THREE.Vector3(), hit: new Set(),
      });
    }
  }

  /** Ends a ball at `at`: splat, burst and split as its marker demands. */
  private land(b: Ball, at: THREE.Vector3, normal: THREE.Vector3): void {
    this.splat(at, normal, b.color, b.r * (b.def.splash ? 10 : 7));
    if (b.def.splash && !b.child) this.burst(at, b.def.splash[0], b.def.splash[1], b.owner, b.color, b.def.name);
    if (b.def.cluster && !b.child) this.cluster(b, at);
  }

  update(dt: number): void {
    const actors = this.actors();
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const b = this.balls[i];
      b.life -= dt;
      if (b.fuse >= 0) {
        // A sticky mine waiting to go off.
        if (b.stuckTo) {
          if (!b.stuckTo.alive) b.stuckTo = null;
          else b.p.copy(b.stuckTo.chest(this.tmp)).add(b.stuckOff);
        }
        b.fuse -= dt;
        if (b.fuse <= 0) {
          this.burst(b.p, b.def.splash?.[0] ?? 3, b.def.splash?.[1] ?? 80, b.owner, b.color, b.def.name);
          this.balls.splice(i, 1);
        }
        continue;
      }
      if (b.life <= 0) {
        this.balls.splice(i, 1);
        continue;
      }
      if (b.def.homing) {
        // Steer toward the nearest enemy ahead.
        let best: Actor | null = null;
        let bestD = 45;
        const dir = this.tmp2.copy(b.v).normalize();
        for (const a of actors) {
          if (!a.alive || !this.enemy(b.owner, a)) continue;
          const to = a.chest(this.tmp).sub(b.p);
          const d = to.length();
          if (d < bestD && to.dot(dir) / d > 0.2) {
            bestD = d;
            best = a;
          }
        }
        if (best) {
          const want = best.chest(this.tmp).sub(b.p).normalize();
          const speed = b.v.length();
          b.v.normalize().lerp(want, Math.min(1, b.def.homing * dt)).normalize().multiplyScalar(speed);
        }
      }
      b.v.y -= 9.8 * b.def.gravity * dt;
      const speed = b.v.length();
      const step = speed * dt;
      const dir = this.tmp2.copy(b.v).multiplyScalar(1 / (speed || 1));
      // The scenery first, then everyone who stands nearer than it along this stretch of the flight.
      const ray = new RAPIER.Ray(b.p, dir);
      const wall = this.world.castRayAndGetNormal(ray, step + b.r, true, undefined, undefined, undefined, undefined, (c) => !this.byHandle.has(c.handle));
      let reach = wall ? wall.timeOfImpact : step + b.r;
      let target: Actor | null = null;
      let head = false;
      for (const a of actors) {
        if (!a.alive || !this.enemy(b.owner, a) || b.hit.has(a.id)) continue;
        // Nowhere near this stretch: no need to look closer.
        const to = a.chest(this.tmp).sub(b.p);
        const along = Math.max(0, Math.min(reach, to.dot(dir)));
        if (to.addScaledVector(dir, -along).lengthSq() > 2.6) continue;
        if (a.hitTest) {
          if (!a.hitTest(b.p, dir, reach, b.r + GRAZE, this.found)) continue;
          reach = this.found.t;
          head = this.found.head;
        } else {
          const t = a.collider.castRay(ray, reach, true);
          if (t < 0 || t >= reach) continue;
          reach = t;
          head = b.p.y + dir.y * t - a.chest(this.tmp).y > 0.42;
        }
        target = a;
      }
      if (!wall && !target) {
        b.p.addScaledVector(dir, step);
        continue;
      }
      const at = b.p.clone().addScaledVector(dir, Math.max(0, reach - b.r * 0.5));
      const normal = wall ? new THREE.Vector3(wall.normal.x, wall.normal.y, wall.normal.z) : dir.clone().negate();
      if (target) {
        b.hit.add(target.id);
        if (target.protect > 0) {
          this.balls.splice(i, 1);
          continue;
        }
        if (b.def.sticky && !b.child) {
          // Stuck to a person: they carry the mine until it bursts.
          b.fuse = b.def.sticky;
          b.stuckTo = target;
          b.stuckOff.copy(at).sub(target.chest(this.tmp));
          b.v.set(0, 0, 0);
          continue;
        }
        target.hurt(b.owner, Math.round(b.dmg * (head ? b.def.head : 1)), b.def.name, head);
        if (b.def.splash && !b.child) this.burst(at, b.def.splash[0], b.def.splash[1], b.owner, b.color, b.def.name);
        if (b.def.cluster && !b.child) this.cluster(b, at);
        if (b.pierce) {
          b.p.copy(at).addScaledVector(dir, 0.3);
          continue;
        }
        this.balls.splice(i, 1);
        continue;
      }
      if (b.bounces > 0) {
        b.bounces--;
        this.splat(at, normal, b.color, b.r * 4);
        b.v.addScaledVector(normal, -2 * b.v.dot(normal)).multiplyScalar(0.86);
        b.p.copy(at).addScaledVector(normal, b.r + 0.02);
        continue;
      }
      if (b.def.sticky && !b.child) {
        b.fuse = b.def.sticky;
        b.p.copy(at).addScaledVector(normal, b.r * 0.6);
        this.splat(at, normal, b.color, b.r * 4);
        continue;
      }
      this.land(b, at, normal);
      this.balls.splice(i, 1);
    }

    // Draw the balls that are in flight.
    const n = this.balls.length;
    this.ballMesh.count = n;
    for (let i = 0; i < n; i++) {
      const b = this.balls[i];
      const pulse = b.fuse >= 0 ? 1 + Math.sin(b.fuse * 40) * 0.25 : 1;
      // In flight a charge is a streak along its path: the faster, the longer.
      const speed = b.fuse >= 0 ? 0 : b.v.length();
      if (speed > 1) this.q.setFromUnitVectors(Z, this.tmp.copy(b.v).multiplyScalar(1 / speed));
      else this.q.identity();
      this.m4.compose(b.p, this.q, this.s.set(b.r * pulse, b.r * pulse, b.r * pulse * (1 + Math.min(9, speed * 0.045))));
      this.ballMesh.setMatrixAt(i, this.m4);
      this.ballMesh.setColorAt(i, this.color.set(b.color));
    }
    if (n) {
      this.ballMesh.instanceMatrix.needsUpdate = true;
      this.ballMesh.instanceColor!.needsUpdate = true;
    }
  }
}
