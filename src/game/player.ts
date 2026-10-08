/** First-person character: movement on the physics world, the camera, health. */

import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { maxHpOf, skillOf, useStore } from "../store";
import { sfx } from "./audio";
import type { Game } from "./game";
import { armorProt } from "./items";
import { LIMIT, heightAt } from "./world";

const HALF_HEIGHT = 0.5;
const RADIUS = 0.35;
/** Capsule centre above the feet. */
export const PLAYER_CENTER = HALF_HEIGHT + RADIUS;
const EYE = 0.72;
/** How far the head tilts: just short of straight up and straight down, like any FPS. */
const MAX_PITCH = (87 * Math.PI) / 180;

export class Player {
  readonly collider: RAPIER.Collider;
  private ctrl: RAPIER.KinematicCharacterController;
  yaw = 0;
  pitch = 0;
  /** Recoil offset added to the pitch; decays on its own. */
  kick = 0;
  hp = 100;
  grounded = false;
  sprinting = false;
  /** Horizontal speed, m/s. */
  speed = 0;
  bob = 0;
  /** Seconds since the last hit taken. */
  calm = 0;
  private vel = new THREE.Vector3();
  private vy = 0;
  private stepDist = 0;

  constructor(private game: Game, x: number, z: number) {
    const y = heightAt(x, z) + PLAYER_CENTER + 0.3;
    this.collider = game.world.createCollider(RAPIER.ColliderDesc.capsule(HALF_HEIGHT, RADIUS).setTranslation(x, y, z));
    this.ctrl = game.world.createCharacterController(0.04);
    this.ctrl.enableAutostep(0.5, 0.2, true);
    this.ctrl.enableSnapToGround(0.5);
    this.ctrl.setMaxSlopeClimbAngle((55 * Math.PI) / 180);
    this.ctrl.setMinSlopeSlideAngle((65 * Math.PI) / 180);
    this.yaw = Math.random() * Math.PI * 2;
    this.hp = maxHpOf(useStore.getState().skills);
    // Yaw first, then pitch: without this order the view rolls and inverts once the player turns round.
    game.camera.rotation.order = "YXZ";
  }

  get pos(): RAPIER.Vector {
    return this.collider.translation();
  }

  eye(out: THREE.Vector3): THREE.Vector3 {
    const t = this.collider.translation();
    return out.set(t.x, t.y + EYE, t.z);
  }

  /** Mouse look: right turns right, up looks up, and the head stops at straight up and down. */
  look(dx: number, dy: number, sensitivity: number): void {
    this.yaw -= dx * sensitivity;
    this.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, this.pitch - dy * sensitivity));
  }

  get maxHp(): number {
    return maxHpOf(useStore.getState().skills);
  }

  heal(n: number): void {
    this.hp = Math.min(this.maxHp, this.hp + n);
    useStore.setState({ hp: Math.ceil(this.hp) });
  }

  damage(n: number): void {
    if (this.hp <= 0) return;
    this.hp = Math.max(0, this.hp - n * (1 - armorProt(useStore.getState().armor)));
    this.calm = 0;
    sfx.hurt();
    useStore.setState({ hp: Math.ceil(this.hp), hurtAt: performance.now() });
    this.game.onPlayerHurt();
    if (this.hp <= 0) this.game.onPlayerDeath();
  }

  /** `frozen`: a menu or a minigame has the controls; the body still falls and stands. */
  update(dt: number, ads: boolean, frozen: boolean): void {
    const k = this.game.input.keys;
    const f = frozen ? 0 : (k.has("KeyW") ? 1 : 0) - (k.has("KeyS") ? 1 : 0);
    const r = frozen ? 0 : (k.has("KeyD") ? 1 : 0) - (k.has("KeyA") ? 1 : 0);
    this.sprinting = k.has("ShiftLeft") && f > 0 && !ads;
    const t0 = this.collider.translation();
    const ground0 = heightAt(t0.x, t0.z);
    // Wading is slow.
    const wade = ground0 < -0.25 ? 0.55 : 1;
    const max = (this.sprinting ? 7.8 : ads ? 3.2 : 5.2) * wade;
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    let dx = -sin * f + cos * r;
    let dz = -cos * f - sin * r;
    const len = Math.hypot(dx, dz);
    if (len > 0) {
      dx = (dx / len) * max;
      dz = (dz / len) * max;
    }
    const accel = 1 - Math.exp(-(this.grounded ? 14 : 3) * dt);
    this.vel.x += (dx - this.vel.x) * accel;
    this.vel.z += (dz - this.vel.z) * accel;

    if (this.grounded && this.vy < 0) this.vy = -1;
    if (this.grounded && !frozen && k.has("Space")) this.vy = 7.2;
    this.vy -= 22 * dt;

    const enemies = this.game.enemies;
    this.ctrl.computeColliderMovement(
      this.collider,
      { x: this.vel.x * dt, y: this.vy * dt, z: this.vel.z * dt },
      undefined,
      undefined,
      (c) => !enemies.owns(c.handle),
    );
    const m = this.ctrl.computedMovement();
    this.grounded = this.ctrl.computedGrounded();
    const t = this.collider.translation();
    let x = t.x + m.x;
    let y = t.y + m.y;
    let z = t.z + m.z;
    x = Math.max(-LIMIT, Math.min(LIMIT, x));
    z = Math.max(-LIMIT, Math.min(LIMIT, z));
    // The sea is the edge of the world: no walking in deeper than the chest.
    let ground = heightAt(x, z);
    if (ground < -1.3 && ground < ground0) {
      x = t.x;
      z = t.z;
      ground = ground0;
      this.vel.set(0, 0, 0);
    }
    // Safety net: never fall under the terrain.
    if (y < ground - 3) {
      y = ground + PLAYER_CENTER + 0.5;
      this.vy = 0;
    }
    this.collider.setTranslation({ x, y, z });

    this.speed = Math.hypot(m.x, m.z) / Math.max(dt, 1e-4);
    if (this.grounded && this.speed > 1) {
      this.bob += this.speed * dt * 1.5;
      this.stepDist += this.speed * dt;
      if (this.stepDist > (this.sprinting ? 2.6 : 2.1)) {
        this.stepDist = 0;
        sfx.step();
      }
    }

    // Only food and medicine heal, until a master Survivor learns to patch himself up between fights.
    this.calm += dt;
    if (this.hp < this.maxHp && this.calm > 8 && skillOf("survivor") >= 10) {
      const before = Math.ceil(this.hp);
      this.hp = Math.min(this.maxHp, this.hp + 1.5 * dt);
      if (Math.ceil(this.hp) !== before) useStore.setState({ hp: Math.ceil(this.hp) });
    }

    this.kick *= Math.exp(-9 * dt);
    const cam = this.game.camera;
    const bobY = this.grounded ? Math.sin(this.bob * 2) * 0.035 * Math.min(1, this.speed / 5) : 0;
    cam.position.set(x, y + EYE + bobY, z);
    cam.rotation.set(Math.max(-1.55, Math.min(1.55, this.pitch + this.kick)), this.yaw, 0, "YXZ");
  }
}
