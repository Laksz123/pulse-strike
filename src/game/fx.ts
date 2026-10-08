/** Short-lived visuals: bullet tracers, impact debris, muzzle flashes. */

import * as THREE from "three";

interface Tracer {
  mesh: THREE.Mesh;
  life: number;
}

interface Chip {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
}

const unit = new THREE.BoxGeometry(1, 1, 1);
const UP = new THREE.Vector3(0, 0, 1);

export class Fx {
  private tracers: Tracer[] = [];
  private chips: Chip[] = [];
  private tracerMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9, fog: false });
  private enemyTracerMat = new THREE.MeshBasicMaterial({ color: 0xff8a5c, transparent: true, opacity: 0.9, fog: false });
  private chipMats = new Map<number, THREE.MeshBasicMaterial>();

  constructor(private scene: THREE.Scene) {}

  tracer(from: THREE.Vector3, to: THREE.Vector3, hostile = false): void {
    const len = from.distanceTo(to);
    if (len < 0.5) return;
    const mesh = new THREE.Mesh(unit, hostile ? this.enemyTracerMat : this.tracerMat);
    mesh.scale.set(0.025, 0.025, len);
    mesh.position.copy(from).lerp(to, 0.5);
    mesh.quaternion.setFromUnitVectors(UP, to.clone().sub(from).normalize());
    this.scene.add(mesh);
    this.tracers.push({ mesh, life: 0.07 });
  }

  /** Debris flying off a surface. */
  impact(point: THREE.Vector3, normal: THREE.Vector3, color: number, count = 5): void {
    let m = this.chipMats.get(color);
    if (!m) {
      m = new THREE.MeshBasicMaterial({ color });
      this.chipMats.set(color, m);
    }
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(unit, m);
      const s = 0.03 + Math.random() * 0.06;
      mesh.scale.set(s, s, s);
      mesh.position.copy(point);
      const vel = normal
        .clone()
        .multiplyScalar(1.5 + Math.random() * 2.5)
        .add(new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 2.5, (Math.random() - 0.5) * 3));
      this.scene.add(mesh);
      this.chips.push({ mesh, vel, life: 0.45 + Math.random() * 0.25 });
    }
  }

  update(dt: number): void {
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      if (t.life <= 0) {
        this.scene.remove(t.mesh);
        this.tracers.splice(i, 1);
      }
    }
    for (let i = this.chips.length - 1; i >= 0; i--) {
      const c = this.chips[i];
      c.life -= dt;
      c.vel.y -= 14 * dt;
      c.mesh.position.addScaledVector(c.vel, dt);
      c.mesh.rotation.x += dt * 9;
      c.mesh.rotation.y += dt * 7;
      if (c.life <= 0) {
        this.scene.remove(c.mesh);
        this.chips.splice(i, 1);
      }
    }
  }
}
