/**
 * An agent that moves like a person: a jointed body driven every frame by what it is doing.
 *
 * Nothing here is a recorded animation. Feet follow a stepping cycle whose length matches the
 * ground speed, so they do not slide, and in whatever direction the body is travelling, so a
 * sidestep looks like a sidestep. Knees and elbows are solved from where the feet and hands have
 * to be. Hands stay on the weapon, which rises to the shoulder to aim, drops when there is nothing
 * to shoot at, and kicks back with a flash on every shot. Dying, it topples over.
 */

import * as THREE from "three";
import { DIM, dress, type Parts } from "./agent3d";
import { AGENTS, AGENT_BY_ID, type AgentDef } from "./agents";
import type { MarkerModel } from "./models";

export interface RigInput {
  /** Velocity in the agent's own frame, m/s: x to its left, z forward. */
  vx: number;
  vz: number;
  /** Where it is aiming, radians above the horizon. */
  pitch: number;
  /** 1 = weapon at the shoulder, 0 = lowered. */
  aim: number;
  /** Kneeling over the bomb. */
  busy?: boolean;
  /** In the lobby: relaxed and pleased with itself. */
  cheer?: boolean;
}

type Mood = "idle" | "blink" | "angry" | "hurt" | "dead" | "happy";

const DOWN = new THREE.Vector3(0, -1, 0);
const faces = new Map<string, THREE.CanvasTexture>();

/** Byte's face for a mood, drawn the way an old screen would show it. */
function face(mood: Mood, color: number): THREE.CanvasTexture {
  const key = `${mood}:${color}`;
  let t = faces.get(key);
  if (t) return t;
  const c = document.createElement("canvas");
  c.width = 160;
  c.height = 120;
  const x = c.getContext("2d")!;
  const round = (px: number, py: number, w: number, h: number, r: number) => {
    x.beginPath();
    x.roundRect(px, py, w, h, r);
    x.fill();
  };
  x.fillStyle = "#0a1230";
  round(0, 0, 160, 120, 16);
  x.fillStyle = "rgba(255, 255, 255, 0.04)";
  for (let y = 0; y < 120; y += 4) x.fillRect(0, y, 160, 1);
  const col = new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.45).getStyle();
  x.fillStyle = x.strokeStyle = col;
  x.shadowColor = new THREE.Color(color).getStyle();
  x.shadowBlur = 12;
  x.lineCap = x.lineJoin = "round";
  const L = 50;
  const R = 110;
  const Y = 48;
  const line = (pts: number[], w = 8) => {
    x.lineWidth = w;
    x.beginPath();
    x.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) x.lineTo(pts[i], pts[i + 1]);
    x.stroke();
  };
  if (mood === "idle") {
    round(L - 11, Y - 19, 22, 38, 10);
    round(R - 11, Y - 19, 22, 38, 10);
    x.lineWidth = 7;
    x.beginPath();
    x.arc(80, 76, 17, Math.PI * 0.18, Math.PI * 0.82);
    x.stroke();
  } else if (mood === "blink") {
    round(L - 13, Y - 2, 26, 8, 4);
    round(R - 13, Y - 2, 26, 8, 4);
    x.lineWidth = 7;
    x.beginPath();
    x.arc(80, 76, 17, Math.PI * 0.18, Math.PI * 0.82);
    x.stroke();
  } else if (mood === "angry") {
    for (const [cx, s] of [[L, 1], [R, -1]]) {
      x.beginPath();
      x.moveTo(cx - 14 * s, Y - 16);
      x.lineTo(cx + 14 * s, Y - 3);
      x.lineTo(cx + 14 * s, Y + 17);
      x.lineTo(cx - 14 * s, Y + 17);
      x.closePath();
      x.fill();
    }
    x.lineWidth = 5;
    x.beginPath();
    x.roundRect(56, 78, 48, 20, 6);
    x.stroke();
    for (const mx of [68, 80, 92]) line([mx, 79, mx, 97], 4);
  } else if (mood === "hurt") {
    line([L - 12, Y - 15, L + 11, Y, L - 12, Y + 15]);
    line([R + 12, Y - 15, R - 11, Y, R + 12, Y + 15]);
    x.lineWidth = 7;
    x.beginPath();
    x.arc(80, 92, 9, 0, Math.PI * 2);
    x.stroke();
  } else if (mood === "dead") {
    for (const cx of [L, R]) {
      line([cx - 13, Y - 13, cx + 13, Y + 13]);
      line([cx - 13, Y + 13, cx + 13, Y - 13]);
    }
    line([62, 92, 98, 92], 7);
  } else {
    for (const cx of [L, R]) {
      x.lineWidth = 9;
      x.beginPath();
      x.arc(cx, Y + 10, 15, Math.PI * 1.12, Math.PI * 1.88);
      x.stroke();
    }
    x.beginPath();
    x.arc(80, 74, 20, 0, Math.PI);
    x.closePath();
    x.fill();
  }
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  faces.set(key, t);
  return t;
}

let flashTex: THREE.CanvasTexture | null = null;

/** A muzzle flash: two crossed cards that light up for a couple of frames. */
export function makeFlash(size = 0.42): THREE.Group {
  if (!flashTex) {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const x = c.getContext("2d")!;
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(255, 255, 255, 1)");
    g.addColorStop(0.25, "rgba(255, 236, 150, 0.95)");
    g.addColorStop(0.6, "rgba(255, 150, 40, 0.5)");
    g.addColorStop(1, "rgba(255, 110, 20, 0)");
    x.fillStyle = g;
    x.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const r = i % 2 ? 22 : 64;
      x.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r);
    }
    x.closePath();
    x.fill();
    flashTex = new THREE.CanvasTexture(c);
    flashTex.colorSpace = THREE.SRGBColorSpace;
  }
  const m = new THREE.MeshBasicMaterial({ map: flashTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, fog: false });
  const g = new THREE.Group();
  for (const a of [0, Math.PI / 2]) {
    const card = new THREE.Mesh(new THREE.PlaneGeometry(size, size), m);
    card.rotation.y = a;
    card.userData.outline = true;
    g.add(card);
  }
  const front = new THREE.Mesh(new THREE.PlaneGeometry(size * 0.8, size * 0.8), m);
  front.userData.outline = true;
  g.add(front);
  g.visible = false;
  return g;
}

const _d = new THREE.Vector3();
const _p = new THREE.Vector3();

/** Two bones from `S` reaching for `T`: finds the joint between them, bending toward `pole`. */
function bend(S: THREE.Vector3, T: THREE.Vector3, a: number, b: number, pole: THREE.Vector3, E: THREE.Vector3, end: THREE.Vector3): void {
  _d.subVectors(T, S);
  const len = _d.length();
  const L = Math.max(Math.abs(a - b) + 0.001, Math.min(a + b - 0.001, len));
  if (len > 1e-5) _d.multiplyScalar(1 / len);
  else _d.set(0, -1, 0);
  const along = (a * a - b * b + L * L) / (2 * L);
  const out = Math.sqrt(Math.max(0, a * a - along * along));
  _p.copy(pole).addScaledVector(_d, -pole.dot(_d));
  if (_p.lengthSq() < 1e-6) _p.set(0, 0, 1);
  _p.normalize();
  E.copy(S).addScaledVector(_d, along).addScaledVector(_p, out);
  end.copy(S).addScaledVector(_d, L);
}

function bone(o: THREE.Object3D, from: THREE.Vector3, to: THREE.Vector3): void {
  o.position.copy(from);
  o.quaternion.setFromUnitVectors(DOWN, _d.subVectors(to, from).normalize());
}

const AIM_POS = new THREE.Vector3(-0.085, 0.275, 0.27);
const LOW_POS = new THREE.Vector3(-0.09, 0.1, 0.235);
const LEFT_HOLD = new THREE.Vector3(0, -0.02, -0.22);

export class AgentRig {
  readonly group = new THREE.Group();
  readonly def: AgentDef;
  /** Where the weapon sits: its grip here, in the right hand. */
  readonly mount = new THREE.Group();
  /** Colours for first-person arms. */
  readonly sleeve: number;
  readonly glove: number;
  private stand = new THREE.Group();
  private body = new THREE.Group();
  private chest = new THREE.Group();
  private head = new THREE.Group();
  private parts: Parts;
  private flash = makeFlash();
  private muzzle: THREE.Object3D | null = null;
  private left = new THREE.Vector3();
  private armed = false;
  private phase = Math.random() * 6;
  private move = 0;
  private dx = 0;
  private dz = 1;
  private aimK = 0;
  private pitch = 0;
  private kick = 0;
  private flinch = 0;
  private flashT = 0;
  private crouch = 0;
  private t = Math.random() * 10;
  private deadT = -1;
  private fireT = 9;
  private hurtT = 9;
  private blinkT = 1 + Math.random() * 3;
  private mood: Mood | "" = "";
  private v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];

  constructor(id: string, private team: number, edge = 0.012) {
    this.def = AGENT_BY_ID[id] ?? AGENTS[0];
    const p = (this.parts = dress(id, team, edge));
    this.sleeve = p.sleeve;
    this.glove = p.glove;
    this.group.add(this.stand);
    this.stand.add(this.body, ...p.thigh, ...p.shin, ...p.foot);
    this.body.add(p.pelvis, this.chest);
    this.chest.position.y = DIM.waist;
    this.chest.add(p.chest, this.head, this.mount, ...p.upper, ...p.fore, ...p.hand);
    this.head.position.y = DIM.neck;
    this.head.add(p.head);
    this.mount.rotation.order = "YXZ";
    this.setMood("idle");
    this.update(0, { vx: 0, vz: 0, pitch: 0, aim: 0 });
  }

  /** Puts a weapon in the agent's hands. The model's own muzzle and left-hand grip are used. */
  setWeapon(w: MarkerModel | null, scale = 1): void {
    this.mount.clear();
    this.muzzle = null;
    this.armed = !!w;
    if (!w) return;
    w.group.scale.setScalar(scale);
    this.mount.add(w.group);
    this.muzzle = w.muzzle;
    // The second pistol of a pair is the left hand's; otherwise the left hand supports the barrel.
    if (w.muzzle2) this.left.set(-0.3, 0, 0);
    else if (w.left) this.left.set(w.left[0], w.left[1], Math.min(-0.2, Math.max(-0.27, w.left[2])));
    else this.left.copy(LEFT_HOLD);
    this.left.multiplyScalar(scale);
    this.flash.removeFromParent();
    w.muzzle.add(this.flash);
  }

  /** Where shots leave from, in world space. */
  muzzleWorld(out: THREE.Vector3): THREE.Vector3 {
    this.group.updateMatrixWorld(true);
    if (this.muzzle) return this.muzzle.getWorldPosition(out);
    return this.chest.getWorldPosition(out);
  }

  /** A shot: the weapon kicks, the muzzle flashes. */
  fire(strength = 1): void {
    this.kick = Math.min(1.4, this.kick + 0.5 * strength);
    this.flashT = 0.055;
    this.fireT = 0;
    this.flash.rotation.z = Math.random() * Math.PI;
    this.flash.scale.setScalar(0.7 + Math.random() * 0.6 * strength);
  }

  hit(): void {
    this.flinch = 1;
    this.hurtT = 0;
  }

  die(): void {
    if (this.deadT < 0) this.deadT = 0;
  }

  revive(): void {
    this.deadT = -1;
    this.stand.rotation.set(0, 0, 0);
    this.stand.position.set(0, 0, 0);
    this.stand.scale.setScalar(1);
    this.group.visible = true;
    this.mount.visible = true;
    this.kick = 0;
    this.flinch = 0;
    this.hurtT = 9;
    this.fireT = 9;
  }

  get dead(): boolean {
    return this.deadT >= 0;
  }

  private setMood(m: Mood): void {
    if (m === this.mood) return;
    this.mood = m;
    const s = this.parts.screen;
    if (!s) return;
    const mat = s.material as THREE.MeshBasicMaterial;
    mat.map = face(m, this.team);
    mat.needsUpdate = true;
  }

  update(dt: number, i: RigInput): void {
    const D = DIM;
    const P = this.parts;
    const [a, b, c, d, e, f] = this.v;
    this.t += dt;
    const t = this.t;
    const k = (rate: number) => 1 - Math.exp(-rate * dt);
    const dead = this.deadT >= 0;

    const speed = dead ? 0 : Math.hypot(i.vx, i.vz);
    this.move += (Math.min(1.25, speed / 4.2) - this.move) * k(10);
    if (speed > 0.3) {
      this.dx += (i.vx / speed - this.dx) * k(12);
      this.dz += (i.vz / speed - this.dz) * k(12);
    }
    const move = this.move;
    const on = Math.min(1, move * 1.6);
    const stride = Math.min(1.0, 0.34 + speed * 0.12);
    this.phase += (dt * Math.PI * speed) / stride;
    const ph = this.phase;
    this.aimK += ((dead ? 0 : i.aim) - this.aimK) * k(12);
    this.pitch += (i.pitch - this.pitch) * k(14);
    this.crouch += ((i.busy ? 1 : 0) - this.crouch) * k(8);
    this.kick *= Math.exp(-14 * dt);
    this.flinch *= Math.exp(-9 * dt);
    this.fireT += dt;
    this.hurtT += dt;
    const aim = this.aimK;
    const breathe = Math.sin(t * 1.9);

    // The body: bobbing twice a stride, leaning into the run, twisting against the legs.
    const lean = Math.min(0.2, speed * 0.027);
    this.body.position.set(
      Math.sin(ph) * 0.02 * on,
      D.pelvisY + (Math.cos(ph * 2) * 0.024 - 0.022) * on + breathe * 0.004 * (1 - on) - this.crouch * 0.34 - (i.cheer ? Math.abs(Math.sin(t * 1.3)) * 0.008 : 0),
      0,
    );
    this.body.rotation.set(this.dz * lean + this.crouch * 0.12, Math.sin(ph) * 0.13 * on, -this.dx * lean * 0.9 + Math.sin(ph) * 0.02 * on);
    this.chest.rotation.set(
      -this.dz * lean * 0.35 + this.crouch * 0.42 - this.kick * 0.05 - this.flinch * 0.16 + breathe * 0.008,
      -Math.sin(ph) * 0.16 * on - 0.14 * aim + this.flinch * 0.2 + (i.cheer ? Math.sin(t * 0.7) * 0.05 : 0),
      this.dx * lean * 0.3 + (i.cheer ? Math.sin(t * 0.9) * 0.015 : 0),
    );
    P.chest.scale.set(1 + breathe * 0.006, 1 + breathe * 0.012, 1 + breathe * 0.012);
    this.head.rotation.set(-this.pitch * 0.55 * aim - this.crouch * 0.2 + this.flinch * 0.22 + Math.sin(t * 1.1) * 0.02, 0.14 * aim + (i.cheer ? Math.sin(t * 0.6) * 0.12 : Math.sin(t * 0.45) * 0.05 * (1 - aim)), Math.sin(ph) * 0.02 * on);

    // Legs: each foot is planted while it travels back, lifted while it swings forward.
    for (let n = 0; n < 2; n++) {
      const side = n ? 1 : -1;
      const q = ph + (n ? 0 : Math.PI);
      const along = Math.cos(q) * stride * 0.5 * on;
      const lift = Math.max(0, -Math.sin(q)) * (0.07 + 0.11 * Math.min(1, move)) * on;
      const hip = a.set(side * D.hipX, D.hipY, 0).applyQuaternion(this.body.quaternion).add(this.body.position);
      const want = b.set(side * (0.13 + this.crouch * 0.05) + this.dx * along, D.ankle + lift, this.dz * along + side * 0.012 + this.crouch * (n ? 0.16 : -0.12));
      const knee = c;
      const ankle = d;
      bend(hip, want, D.thigh, D.shin, e.set(side * 0.12, 0.1, 1), knee, ankle);
      bone(P.thigh[n], hip, knee);
      bone(P.shin[n], knee, ankle);
      P.foot[n].position.copy(ankle);
      // Toes down while the foot is in the air or the leg is at full stretch behind.
      P.foot[n].rotation.set(lift * 3.2 + Math.max(0, ankle.y - want.y) * 4 + (this.crouch > 0.5 && !n ? 0.5 : 0), -side * 0.16 * (1 - on), 0);
    }

    // The weapon: at the shoulder to aim, low across the body otherwise; it rides the recoil.
    const m = this.mount;
    m.position.lerpVectors(LOW_POS, AIM_POS, aim);
    const up = this.pitch * aim;
    // Aiming up or down swings the weapon around the shoulders.
    const ry = m.position.y - D.shoulderY;
    const rz = m.position.z;
    m.position.y = D.shoulderY + ry * Math.cos(up) + rz * Math.sin(up);
    m.position.z = rz * Math.cos(up) - ry * Math.sin(up);
    m.position.z -= this.kick * 0.07;
    m.position.y += this.kick * 0.012 + Math.sin(ph * 2) * 0.008 * on * (1 - aim);
    // Lowered, it is carried across the body with the barrel down toward the left foot.
    m.rotation.set(up + this.kick * 0.24 - 0.5 * (1 - aim), Math.PI + 0.14 * aim + 1.0 * (1 - aim), -0.15 * (1 - aim));
    if (this.flashT > 0) {
      this.flashT -= dt;
      this.flash.visible = this.flashT > 0;
    }

    // Arms: hands on the weapon, elbows down and out.
    for (let n = 0; n < 2; n++) {
      const side = n ? 1 : -1;
      const shoulder = a.set(side * D.shoulderX, D.shoulderY, 0);
      const want = b;
      if (!this.armed || dead) {
        want.set(side * (D.shoulderX + 0.07 + (dead ? 0.2 : 0)), D.shoulderY - 0.5, 0.04 + Math.sin(ph + (n ? Math.PI : 0)) * 0.16 * on);
      } else if (n === 0) want.copy(m.position);
      else want.copy(this.left).applyQuaternion(m.quaternion).add(m.position);
      const elbow = c;
      const wrist = d;
      bend(shoulder, want, D.upper, D.fore, e.set(side * 0.7, -1, -0.25), elbow, wrist);
      bone(P.upper[n], shoulder, elbow);
      bone(P.fore[n], elbow, wrist);
      P.hand[n].position.copy(wrist);
      P.hand[n].quaternion.copy(P.fore[n].quaternion);
    }

    // Byte's extras: a face that says what is going on, a springy aerial and a cable that trails.
    if (P.screen) {
      this.blinkT -= dt;
      if (this.blinkT < -0.11) this.blinkT = 1.6 + Math.random() * 3.4;
      this.setMood(dead ? "dead" : this.hurtT < 0.38 ? "hurt" : this.fireT < 0.45 ? "angry" : this.blinkT < 0 ? "blink" : i.cheer && Math.sin(t * 0.5) > 0.55 ? "happy" : "idle");
    }
    if (P.antenna) P.antenna.rotation.set(-lean * 1.2 * this.dz - this.kick * 0.25, 0, Math.sin(t * 11) * 0.03 * (on + this.kick) + Math.sin(ph * 2) * 0.05 * on);
    const wide = P.tailLift < 0.41;
    for (let n = 0; n < P.tail.length; n++) {
      P.tail[n].rotation.x = (P.tailRest[n] ?? 0.1) + move * P.tailLift * (n < 2 ? 1 : 0.4) * Math.max(0, this.dz) + Math.sin(ph * 2 - n * 0.9) * (wide ? 0.09 : 0.2) * on + Math.sin(t * 1.4 - n * 0.7) * 0.04;
      P.tail[n].rotation.z = wide ? 0 : Math.sin(ph - n * 0.8) * 0.22 * on + Math.sin(t * 1.1 - n) * 0.04;
    }
    // Eyes: a blink now and then, narrowed over the sights, shut when down.
    if (P.eyes.length) {
      if (!P.screen) {
        this.blinkT -= dt;
        if (this.blinkT < -0.11) this.blinkT = 1.6 + Math.random() * 3.4;
      }
      const open = dead ? 0.1 : this.blinkT < 0 ? 0.08 : this.hurtT < 0.3 ? 0.3 : this.fireT < 0.4 ? 0.55 : 1;
      for (const eye of P.eyes) eye.scale.y += (open - eye.scale.y) * k(32);
    }

    // Down: topple backwards like a felled tree, bounce once, then shrink away.
    if (dead) {
      this.deadT += dt;
      const u = Math.min(1, this.deadT / 0.5);
      const fall = u < 0.7 ? (u / 0.7) ** 2 : 1 - Math.sin(((u - 0.7) / 0.3) * Math.PI) * 0.08;
      this.stand.rotation.x = -fall * 1.5;
      this.stand.position.y = fall * 0.16;
      this.mount.visible = false;
      const gone = Math.max(0, this.deadT - 2.6) / 0.35;
      this.stand.scale.setScalar(Math.max(0.001, 1 - gone));
      if (gone >= 1) this.group.visible = false;
    }
    void f;
  }
}
