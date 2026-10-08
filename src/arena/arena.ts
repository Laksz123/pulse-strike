/**
 * A match: the map, the player, the bots, the rules.
 *
 * Everyone has 100 health. Weapons are bought with match money — from kills, rounds and the bomb —
 * and what the player owns outside the match is only how they look. Three modes:
 *   bomb — five against five in rounds, no respawns: attackers plant the bomb on A or B, defenders
 *          stop them or defuse it; first to five rounds, sides swap after four;
 *   tdm  — five against five with respawns, first team to thirty kills;
 *   ffa  — ten players, everyone for themselves, first to twenty kills.
 */

import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { sfx } from "../game/audio";
import { useStore, type ArenaModeId } from "../store";
import { AGENTS, ARM_COLORS, DEFAULT_AGENT } from "./agents";
import { HIT_AT, HOLD, MOVE_TIME, drawTime, knifePose, type KnifeMove } from "./knife";
import { Grenades, NADES, NADE_ORDER, Puffs, type NadeKind } from "./grenades";
import { buildMap, type ArenaMap, type MapId, type P2, type Site } from "./map";
import { DEFAULT_KNIFE, DEFAULT_SIDE, GUNS, MARKER_BY_ID, PATTERNS, RARITY, itemRarity, type MarkerDef } from "./markers";
import { LIGHT, TOUCH } from "../device";
import { LEFT_FOREARM, bake, buildArms, buildMarker, pbr, type Arms, type MarkerModel } from "./models";
import { DRAW_TIME, INSPECT_TIME, RELOAD_CUES, drawPose, inspectPose, kindOf, reloadPose, type GunPose } from "./viewmodel";
import { Paint, type Actor } from "./paint";
import { bombModel } from "./props";
import { AgentRig, makeFlash } from "./rig";
import { studio } from "./render";
import { pushFeed, useArena, type BoardRow, type Mark, type Phase } from "./state";

export interface ArenaMode {
  id: ArenaModeId;
  name: string;
  hint: string;
  teams: boolean;
  /** Players per team; in free-for-all, players in total. */
  size: number;
  /** Rounds (bomb) or kills needed to win. */
  target: number;
  /** Seconds per round, or for the whole match. */
  time: number;
}

export const ARENA_MODES: ArenaMode[] = [
  { id: "bomb", name: "Закладка бомбы", hint: "5 на 5 · раунды без возрождений · до 5 побед", teams: true, size: 5, target: 5, time: 100 },
  { id: "tdm", name: "Командный бой", hint: "5 на 5 · с возрождениями · до 30 убийств", teams: true, size: 5, target: 30, time: 300 },
  { id: "ffa", name: "Каждый за себя", hint: "10 игроков · до 20 убийств", teams: false, size: 10, target: 20, time: 300 },
  { id: "range", name: "Полигон", hint: "Мишени и манекены · всё оружие и гранаты бесплатно", teams: false, size: 1, target: 0, time: 0 },
];
const DUST: Record<string, number> = { oasis: 0xd9c08a, summit: 0xf2f6ff, neon: 0x8a8f99, range: 0xb9bec6 };

/** The player's team, then the other one. */
export const TEAM_COLORS: [number, number] = [0x2f9bff, 0xff5a3c];
const FFA_COLORS = [0x2f9bff, 0xff5a3c, 0x9be000, 0xff3d9a, 0xffd21a, 0x9b4dff, 0x35e0b0, 0xff8a1a, 0x4d7dff, 0xf2f2f2];
const NAMES = ["Viper", "Ghost", "Comet", "Hornet", "Storm", "Cactus", "Pixel", "Rocket", "Lynx", "Fox", "Thunder", "Phoenix", "Falcon", "Vortex", "Onyx", "Blitz"];

export const ARMOR_PRICE = 650;
const START_MONEY = 800;
const DM_MONEY = 2500;
const MAX_MONEY = 9000;
const KILL_MONEY = 300;
const WIN_MONEY = 2700;
const LOSS_MONEY = 1700;
const PLANT_MONEY = 300;
const FREEZE = 7;
const DM_FREEZE = 3;
const ROUND_END = 5;
const BUY_TIME = 20;
const PLANT_TIME = 3.2;
const DEFUSE_TIME = 5;
const BOMB_TIME = 35;
const SWAP_AFTER = 4;
const RESPAWN = 3;
const XP_KILL = 20;
const COINS_KILL = 10;
const EYE = 0.72;
const CENTER = 0.9;
const BASE_FOV = 78;
const V1 = new THREE.Vector3();
const V2 = new THREE.Vector3();
const M1 = new THREE.Matrix4();
const Q1 = new THREE.Quaternion();
const Q2 = new THREE.Quaternion();
/** Where the weapon sits when nothing is happening to it. */
const VM_REST = new THREE.Matrix4().compose(new THREE.Vector3(0.23, -0.25, -0.6), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.03, 0.09, 0)), new THREE.Vector3(1, 1, 1));

/** Turns a supporting hand at `at` so its forearm runs to `elbow`, rolled about the forearm by `turn`. */
function aimHand(at: THREE.Vector3, elbow: THREE.Vector3, turn: number, out: THREE.Quaternion): THREE.Quaternion {
  out.setFromUnitVectors(LEFT_FOREARM, V2.copy(elbow).sub(at).normalize());
  if (turn) out.multiply(Q2.setFromAxisAngle(LEFT_FOREARM, turn));
  return out;
}
const hex = (c: number) => `#${c.toString(16).padStart(6, "0")}`;
const dist2 = (ax: number, az: number, bx: number, bz: number) => Math.hypot(ax - bx, az - bz);

interface Body extends Actor {
  /** Seconds for which the player's side still has this one on the radar. */
  spot: number;
  hp: number;
  armor: number;
  money: number;
  kills: number;
  deaths: number;
  respawnT: number;
  isPlayer: boolean;
  agent: string;
  yaw: number;
}

/** A weapon in the player's hands. */
interface Gun {
  id: string;
  skin: number;
  mag: number;
  reserve: number;
}

/** A weapon lying where its owner fell, for the taking. */
interface Drop extends Gun {
  group: THREE.Group;
  x: number;
  y: number;
  z: number;
  floor: number;
  vx: number;
  vy: number;
  vz: number;
  t: number;
}

/** What the radar draws. */
export interface RadarView {
  me: { x: number; z: number; yaw: number; alive: boolean };
  dots: { x: number; z: number; yaw: number; kind: "ally" | "enemy" | "dead"; alpha: number; bomb: boolean }[];
  bomb: { x: number; z: number; planted: boolean } | null;
}

let tagTex: THREE.Texture | null = null;
/** The chevron over a teammate's head: it shows through walls, so you always know where your side is. */
function allyTag(): THREE.Sprite {
  if (!tagTex) {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const x = c.getContext("2d")!;
    x.lineJoin = "round";
    x.beginPath();
    x.moveTo(11, 15);
    x.lineTo(53, 15);
    x.lineTo(32, 51);
    x.closePath();
    x.lineWidth = 10;
    x.strokeStyle = "#101833";
    x.stroke();
    x.fillStyle = "#49b0ff";
    x.fill();
    tagTex = new THREE.CanvasTexture(c);
    tagTex.colorSpace = THREE.SRGBColorSpace;
  }
  const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tagTex, depthTest: false, depthWrite: false, sizeAttenuation: false, toneMapped: false, fog: false }));
  tag.scale.setScalar(0.05);
  tag.position.y = 2.5;
  tag.renderOrder = 10;
  tag.userData.tag = true;
  return tag;
}

function turn(from: number, to: number, k: number): number {
  const d = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + d * Math.min(1, k);
}

class Bot implements Body {
  spot = 0;
  /** The skin on its weapon, and the mark over its head if it is on the player's side. */
  skin = 0;
  private tag: THREE.Sprite | null = null;
  alive = true;
  protect = 0;
  hp = 100;
  armor = 0;
  money = START_MONEY;
  kills = 0;
  deaths = 0;
  respawnT = 0;
  isPlayer = false;
  yaw = 0;
  velocity = new THREE.Vector3();
  readonly collider: RAPIER.Collider;
  readonly model: AgentRig;
  gun: MarkerDef = MARKER_BY_ID[DEFAULT_SIDE];
  /** Standing still, working on the bomb. */
  act: null | "plant" | "defuse" = null;
  /** Where the round's plan sends this bot, and a spot it is holding near there. */
  post: Site | null = null;
  /** Points still to pass through on the way there, and for a defender the spot to watch from. */
  via: P2[] = [];
  watch: P2 | null = null;
  hold: P2 | null = null;
  holdT = 0;
  off = { x: 0, z: 0 };
  /** Paint in the eyes: sees nothing until it runs out. */
  blindT = 0;
  nade: NadeKind | null = null;
  /** A target on the range: stands where it is put, or paces from side to side, and never shoots back. */
  dummy: { x: number; z: number; move: number } | null = null;
  private goal: P2 | null = null;
  private aimPitch = 0;
  private stepD = 0;
  private clock = Math.random() * 6;
  private mag = 0;
  private reloadT = 0;
  private fireT = 0;
  private burstLeft = 0;
  private target: Body | null = null;
  private visible = false;
  private thinkT = Math.random() * 0.3;
  private react = 0.5;
  private path: P2[] = [];
  private pathT = 0;
  private pathTo: P2 = { x: 1e9, z: 1e9 };
  private strafe = Math.random() < 0.5 ? 1 : -1;
  private strafeT = 1;
  private stuck = 0;
  private tmp = new THREE.Vector3();
  private tmp2 = new THREE.Vector3();

  constructor(private arena: Arena, readonly id: number, readonly name: string, readonly team: number, readonly color: number, readonly agent: string) {
    this.collider = arena.world.createCollider(RAPIER.ColliderDesc.capsule(0.52, 0.36).setTranslation(0, CENTER + 0.1, 0));
    this.model = new AgentRig(agent, color);
    arena.scene.add(this.model.group);
    if (arena.mode.teams && team === 0 && !arena.range) {
      this.tag = allyTag();
      this.model.group.add(this.tag);
    }
    this.equip(this.gun);
  }

  chest(out: THREE.Vector3): THREE.Vector3 {
    const t = this.collider.translation();
    return out.set(t.x, t.y + 0.25, t.z);
  }

  hurt(by: Actor, dmg: number, weapon: string, head: boolean): void {
    this.arena.damage(this, by as Body, dmg, weapon, head);
    this.model.hit();
    // Being shot from somewhere unseen: turn on the shooter at once.
    if (this.alive && by !== this && !this.visible) {
      this.target = by as Body;
      this.thinkT = 0;
    }
  }

  die(): void {
    this.model.die();
    this.act = null;
    if (this.tag) this.tag.visible = false;
  }

  equip(def: MarkerDef): void {
    this.gun = def;
    this.mag = def.mag;
    this.reloadT = 0;
    this.burstLeft = 0;
    // Some bots show off a skin.
    const skins = PATTERNS.map((p, i) => ({ p, i })).filter((x) => !x.p.pass);
    this.skin = Math.random() < 0.35 ? skins[Math.floor(Math.random() * skins.length)].i : 0;
    const built = buildMarker(def.id, this.skin, 0.005);
    bake(built.group, built.muzzle2 ? [built.muzzle, built.muzzle2] : [built.muzzle]);
    this.model.setWeapon(built);
  }

  /** Spends match money the way a sensible player would: the best gun that fits, then armour. */
  buy(deathmatch: boolean): void {
    if (this.gun.side || deathmatch) {
      const pool = GUNS.filter((d) => !d.side && d.price <= this.money);
      if (pool.length) {
        const top = Math.max(...pool.map((d) => d.price));
        const good = pool.filter((d) => d.price >= top * 0.6);
        const pick = good[Math.floor(Math.random() * good.length)];
        if (pick.id !== this.gun.id) {
          this.money -= deathmatch ? 0 : pick.price;
          this.equip(pick);
        }
      } else if (this.money >= 600 && this.gun.id === DEFAULT_SIDE && Math.random() < 0.5) {
        this.money -= 600;
        this.equip(MARKER_BY_ID.baraban);
      }
    }
    if (this.armor < 50 && this.money >= ARMOR_PRICE + 300) {
      this.money -= ARMOR_PRICE;
      this.armor = 100;
    }
    this.mag = this.gun.mag;
    this.nade = Math.random() < 0.4 ? NADE_ORDER[Math.floor(Math.random() * 3)] : null;
  }

  private pace(dt: number): void {
    const d = this.dummy!;
    this.clock += dt;
    this.protect -= dt;
    const z = d.z + Math.sin(this.clock * 0.9) * d.move;
    const was = this.collider.translation().z;
    this.collider.setTranslation({ x: d.x, y: CENTER, z });
    this.velocity.set(0, 0, (z - was) / dt);
    this.yaw = -Math.PI / 2;
    this.model.group.position.set(d.x, 0, z);
    this.model.group.rotation.y = this.yaw;
    this.model.group.visible = true;
    this.model.update(dt, { vx: this.velocity.z, vz: 0, pitch: 0, aim: 0 });
  }

  spawn(at: P2, protect: number): void {
    this.blindT = 0;
    this.alive = true;
    this.hp = 100;
    this.protect = protect;
    this.act = null;
    this.collider.setEnabled(true);
    const floor = this.arena.map.floorAt(at.x, at.z);
    this.collider.setTranslation({ x: at.x, y: floor + CENTER + 0.1, z: at.z });
    this.model.revive();
    if (this.tag) this.tag.visible = true;
    this.spot = 0;
    this.model.group.position.set(at.x, floor, at.z);
    this.yaw = Math.atan2(-at.x, -at.z);
    this.mag = this.gun.mag;
    this.reloadT = 0;
    this.target = null;
    this.visible = false;
    this.path = [];
    this.goal = null;
    this.hold = null;
    this.off = { x: (Math.random() - 0.5) * 4, z: (Math.random() - 0.5) * 4 };
  }

  update(dt: number): void {
    const arena = this.arena;
    if (!this.alive) {
      this.model.update(dt, { vx: 0, vz: 0, pitch: 0, aim: 0 });
      if (arena.respawns) {
        this.respawnT -= dt;
        if (this.respawnT <= 0) arena.respawnBot(this);
      }
      return;
    }
    if (this.dummy) return this.pace(dt);
    this.protect -= dt;
    this.spot -= dt;
    this.blindT -= dt;
    const t = this.collider.translation();
    const me = this.tmp.set(t.x, t.y, t.z);
    const frozen = arena.phase === "freeze";

    this.thinkT -= dt;
    if (this.thinkT <= 0) {
      const step = 0.2 + Math.random() * 0.1;
      this.thinkT = step;
      this.holdT -= step;
      // Nearest enemy, strongly preferring one in sight.
      let best: Body | null = null;
      let bestScore = Infinity;
      let bestSeen = false;
      for (const a of arena.bodies) {
        if (!a.alive || a === this || (arena.mode.teams && a.team === this.team)) continue;
        const d = a.chest(this.tmp2).distanceTo(me);
        const seen = this.blindT <= 0 && d < 70 && arena.sees(this, a);
        // What one of the player's side sees, the whole side has on its radar.
        if (seen && this.team === 0 && arena.mode.teams) (a as Body).spot = 2.6;
        const score = d + (seen ? 0 : 60);
        if (score < bestScore) {
          bestScore = score;
          best = a;
          bestSeen = seen;
        }
      }
      if (best !== this.target || (bestSeen && !this.visible)) this.react = 0.32 + Math.random() * 0.4;
      this.target = best;
      this.visible = bestSeen;
      this.goal = arena.goalFor(this);
    }

    let mx = 0;
    let mz = 0;
    let fighting = false;
    const target = this.target && this.target.alive ? this.target : null;
    if (target && this.visible && !frozen && !this.act) {
      const tp = target.chest(this.tmp2);
      const dx = tp.x - me.x;
      const dz = tp.z - me.z;
      const dist = Math.hypot(dx, dz) || 1;
      this.yaw = turn(this.yaw, Math.atan2(dx, dz), dt * 9);
      this.aimPitch = Math.atan2(tp.y - me.y - 0.3, dist);
      this.react -= dt;
      if (this.react <= 0) this.fire(target, dist);
      // Something to throw, and someone worth throwing it at.
      if (this.nade && this.react <= 0 && dist > 9 && dist < 28 && Math.random() < dt * 0.9) {
        arena.throwNade(this, this.nade, tp);
        this.nade = null;
      }
      const hold = this.gun.pellets > 3 ? 7 : this.gun.zoom ? 26 : 15;
      if (dist < hold + 10 || !this.goal) {
        // In a fight: sidestep, close in or back off.
        fighting = true;
        this.strafeT -= dt;
        if (this.strafeT <= 0) {
          this.strafeT = 0.5 + Math.random() * 1.2;
          this.strafe = -this.strafe;
        }
        const along = dist > hold ? 0.6 : dist < hold * 0.5 ? -0.6 : 0;
        mx = (-dz / dist) * this.strafe + (dx / dist) * along;
        mz = (dx / dist) * this.strafe + (dz / dist) * along;
        this.path = [];
      }
    }
    if (!fighting && !frozen && !this.act) {
      // Go where the plan says; with no plan, hunt the nearest enemy.
      const goal = this.goal ?? (target ? { x: target.chest(this.tmp2).x, z: this.tmp2.z } : null);
      if (goal) {
        const far = dist2(goal.x, goal.z, me.x, me.z);
        if (far > 1.1) {
          this.pathT -= dt;
          if (this.pathT <= 0 || !this.path.length || dist2(goal.x, goal.z, this.pathTo.x, this.pathTo.z) > 2.5) {
            this.pathT = 0.8 + Math.random() * 0.5;
            this.pathTo = { x: goal.x, z: goal.z };
            this.path = arena.map.nav.path({ x: me.x, z: me.z }, goal);
          }
        } else {
          this.path = [];
          // Holding a spot: watch where the enemy is likely to come from.
          if (target && !this.visible) {
            const tp = target.chest(this.tmp2);
            this.yaw = turn(this.yaw, Math.atan2(tp.x - me.x, tp.z - me.z), dt * 3);
          }
        }
      }
      if (this.path.length) {
        const wp = this.path[0];
        const dx = wp.x - me.x;
        const dz = wp.z - me.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.6) this.path.shift();
        else {
          mx = dx / d;
          mz = dz / d;
          if (!this.visible) this.yaw = turn(this.yaw, Math.atan2(mx, mz), dt * 7);
        }
      }
    }
    // Standing in lava: out, now, whatever the plan was.
    const lava = frozen ? null : arena.nades.lavaAt(me.x, me.z);
    if (lava) {
      const away = Math.hypot(me.x - lava.x, me.z - lava.z) || 1;
      mx = (me.x - lava.x) / away;
      mz = (me.z - lava.z) / away;
      this.path = [];
    }
    const len = Math.hypot(mx, mz);
    const speed = lava ? 5.6 : fighting ? 4.2 : 5.2;
    if (len > 1) {
      mx /= len;
      mz /= len;
    }
    const moved = arena.moveBody(this.collider, mx * speed * dt, mz * speed * dt, dt);
    this.velocity.set(moved.x / dt, 0, moved.z / dt);
    this.stepD += Math.hypot(moved.x, moved.z);
    if (this.stepD > 1.25) {
      this.stepD = 0;
      arena.footstep(this, Math.hypot(moved.x, moved.z) / dt);
    }
    // Walking into something: pick a new route.
    if (len > 0.3 && Math.hypot(moved.x, moved.z) < speed * dt * 0.2) {
      this.stuck += dt;
      if (this.stuck > 0.5) {
        this.stuck = 0;
        this.strafe = -this.strafe;
        this.pathT = 0;
      }
    } else this.stuck = 0;

    this.reloadT -= dt;
    this.fireT -= dt;
    const p = this.collider.translation();
    const g = this.model.group;
    g.position.set(p.x, p.y - CENTER, p.z);
    g.rotation.y = this.yaw;
    // The body is animated from how it is actually moving, in its own frame.
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    const aiming = !!target && this.visible && !frozen && !this.act;
    if (!aiming) this.aimPitch = 0;
    this.model.update(dt, {
      vx: this.velocity.x * cos - this.velocity.z * sin, vz: this.velocity.x * sin + this.velocity.z * cos,
      pitch: this.aimPitch, aim: aiming ? 1 : 0, busy: !!this.act,
    });
    // Spawn protection: blink.
    g.visible = this.protect <= 0 || Math.floor(this.protect * 12) % 2 === 0;
  }

  private fire(target: Body, dist: number): void {
    const d = this.gun;
    if (this.reloadT > 0 || this.fireT > 0) return;
    if (this.mag <= 0) {
      this.reloadT = d.reload;
      this.mag = d.mag;
      return;
    }
    // Bots shoot in a human rhythm, not at the weapon's mechanical limit.
    const cap = d.mode === "semi" ? 170 : d.mode === "charge" ? 70 : d.mode === "burst" ? d.rpm : d.mode === "auto" ? 420 : d.mode === "spin" ? 520 : 900;
    this.fireT = 60 / Math.min(d.rpm, cap);
    if (d.mode === "burst") {
      this.burstLeft = this.burstLeft > 0 ? this.burstLeft - 1 : (d.burst ?? 3) - 1;
      if (this.burstLeft === 0) this.fireT = 0.55 + Math.random() * 0.3;
    }
    this.mag--;
    const from = this.model.muzzleWorld(new THREE.Vector3());
    this.model.fire(d.kick > 0.04 ? 1.4 : d.mode === "stream" ? 0.35 : 0.8);
    const aim = target.chest(new THREE.Vector3());
    const time = dist / d.speed;
    aim.addScaledVector(target.velocity, time * 0.6);
    aim.y += 0.5 * 9.8 * d.gravity * time * time;
    const dir = aim.sub(from).normalize();
    const spray = d.mode === "auto" || d.mode === "spin" || d.mode === "stream" ? 0.05 : 0.034;
    const err = spray + Math.min(0.05, target.velocity.length() * 0.008);
    dir.x += (Math.random() - 0.5) * 2 * err;
    dir.y += (Math.random() - 0.5) * err;
    dir.z += (Math.random() - 0.5) * 2 * err;
    this.arena.paint.shoot(this, d, from, dir.normalize(), 1, d.mode === "charge" ? 0.5 : 0);
    const mine = this.arena.me.chest(new THREE.Vector3()).distanceTo(from);
    void mine;
    const heard = this.arena.hear(from);
    if (heard.vol > 0.02) sfx.gun(d.id, heard.vol * 0.8, heard.pan);
  }
}

/** A bullseye on the range: knock it back and it rocks upright again. */
class Board implements Actor {
  alive = true;
  protect = 0;
  velocity = new THREE.Vector3();
  readonly name = "Мишень";
  readonly team = 1;
  readonly color = 0xffffff;
  readonly collider: RAPIER.Collider;
  private pivot = new THREE.Group();
  private at: THREE.Vector3;
  private rock = 0;
  private t = 0;

  constructor(private arena: Arena, readonly id: number, p: { x: number; y: number; z: number }) {
    this.at = new THREE.Vector3(p.x, p.y, p.z);
    this.collider = arena.world.createCollider(RAPIER.ColliderDesc.cuboid(0.07, 0.5, 0.5).setTranslation(p.x, p.y, p.z));
    this.pivot.position.set(p.x, Math.max(0, p.y - 1.5), p.z);
    const up = p.y - this.pivot.position.y;
    [[0.5, 0xf7f7f2], [0.38, 0xe5383b], [0.26, 0xf7f7f2], [0.14, 0xe5383b], [0.05, 0xffd21a]].forEach(([r, c], i) => {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.07 + i * 0.012, 28), pbr(c, 0, 0.6));
      ring.rotation.z = Math.PI / 2;
      ring.position.set(-i * 0.004, up, 0);
      ring.castShadow = true;
      this.pivot.add(ring);
    });
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, up, 0.08), pbr(0x23262d, 0.2, 0.6));
    post.position.set(0.06, up / 2, 0);
    this.pivot.add(post);
    arena.scene.add(this.pivot);
  }

  chest(out: THREE.Vector3): THREE.Vector3 {
    return out.copy(this.at);
  }

  hurt(by: Actor, dmg: number): void {
    this.rock = 1;
    this.t = 0;
    this.arena.boardHit(by as Body, dmg);
  }

  update(dt: number): void {
    this.t += dt;
    this.rock *= Math.exp(-3.2 * dt);
    this.pivot.rotation.z = -Math.abs(Math.sin(this.t * 9)) * 0.5 * this.rock;
  }
}

type BombState = "none" | "carried" | "dropped" | "planted";

export class Arena {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(BASE_FOV, 1, 0.05, 700);
  readonly world: RAPIER.World;
  readonly map: ArenaMap;
  readonly paint: Paint;
  readonly mode: ArenaMode;
  readonly bodies: Body[] = [];
  readonly me: Body;
  /** Dead players come back after a few seconds (not in bomb mode). */
  readonly respawns: boolean;
  /** The firing range: targets, everything free, nothing at stake. */
  readonly range: boolean;
  readonly nades: Grenades;
  readonly puffs: Puffs;
  phase: Phase = "freeze";

  private canvas = document.createElement("canvas");
  private renderer: THREE.WebGLRenderer;
  private vmScene = new THREE.Scene();
  private vmCamera = new THREE.PerspectiveCamera(56, 1, 0.01, 10);
  private vmRoot = new THREE.Group();
  private vm: MarkerModel | null = null;
  private byHandle = new Map<number, Actor>();
  private ctrl: RAPIER.KinematicCharacterController;
  private bots: Bot[] = [];

  // Player state.
  private yaw = 0;
  private pitch = 0;
  private kick = 0;
  private vy = 0;
  private vel = new THREE.Vector3();
  private grounded = false;
  private bob = 0;
  private keys = new Set<string>();
  private trigger = false;
  private pressed = false;
  private aiming = false;
  /** Primary, sidearm, blade. */
  private guns: (Gun | null)[] = [null, null, null];
  private knife = { id: DEFAULT_KNIFE, skin: 0 };
  /** The blade's motion in progress. */
  private kMove: { kind: KnifeMove; t: number; dur: number; side: number; hit: boolean; heavy: boolean } | null = null;
  private kSide = 1;
  private kCut = 0;
  private arms: Arms | null = null;
  /** A gun being drawn or looked over. */
  /** The match that is running, for the parts of the screen that draw from it directly. */
  static current: Arena | null = null;
  /** Choosing a team: before the first round, and again whenever M is pressed. */
  private picking = false;
  private pickFirst = false;
  private swapNext = false;
  /** Bodies left where they fell, and those still falling. */
  private corpses: { group: THREE.Object3D; t: number; rig?: AgentRig }[] = [];
  private falling: { bot: Bot; t: number }[] = [];
  private fellAt: THREE.Vector3 | null = null;
  /** Weapons on the ground, the one in reach, and what the screen says about it. */
  private drops: Drop[] = [];
  private near: Drop | null = null;
  private dropHint = "";
  private spotT = 0;
  private vmMove: { kind: "draw" | "inspect"; t: number; dur: number } | null = null;
  /** Where the supporting arm's elbow is, in view space. */
  private elbow = new THREE.Vector3();
  private recoilV = 0;
  private throwK = 0;
  private cueU = 0;
  private racked = false;
  private kFire = 0;
  private altPressed = false;
  private slot = 1;
  private lastSlot = 1;
  private cooldown = 0;
  private reloadT = 0;
  private burstLeft = 0;
  private charge = 0;
  private spin = 0;
  private recoil = 0;
  private swapT = 0;
  private barrel = 0;
  private buyT = 0;
  private buyOpen = false;
  private noPickT = 0;
  private myNades: Record<NadeKind, number> = { flash: 0, smoke: 0, fire: 0 };
  private nadeT = 0;
  private sprintK = 0;
  private strafeK = 0;
  private swayX = 0;
  private swayY = 0;
  private landK = 0;
  private stepN = 0;
  private wasGrounded = true;
  private dmgSeq = 0;
  private boards: Board[] = [];
  private dust: number;
  private spec: Bot | null = null;
  private agentId: string;
  private vmFlash = makeFlash(0.2);
  private vmFlashT = 0;
  private fireK = 0;
  private shots = 0;
  private clock = 0;

  // Match state.
  private score: [number, number] = [0, 0];
  private round = 1;
  private phaseT = 0;
  /** The team attacking in bomb mode: 0 is the player's. */
  private attackers = 0;
  private attackSite: Site;
  private bomb = {
    state: "none" as BombState, carrier: null as Body | null, pos: new THREE.Vector3(), progress: 0, defuser: null as Body | null,
    planter: null as Body | null, beepT: 0, mesh: bombModel(), light: new THREE.PointLight(0xff3b30, 0, 12, 1.6),
  };
  private blast: { mesh: THREE.Mesh; t: number } | null = null;
  /** How long the attackers have been sitting on a site: after a while the defence rotates to it. */
  private hot: { site: Site | null; t: number } = { site: null, t: 0 };
  private over = false;
  private startXp: number;
  private startCases: number;
  private coins = 0;
  private raf = 0;
  private last = 0;
  private hudT = 0;
  private markT = 0;
  /** No mouse to capture: on a phone, or when asked for by the address, the match simply runs. */
  private noLock = TOUCH || new URLSearchParams(location.search).has("nolock");
  /** Touch: where the stick is pushed, whether the fire button is down, and whether the match is held on the pause screen. */
  private stick = { x: 0, y: 0 };
  private fireHeld = false;
  private halted = false;
  private autoT = 0;
  private autoOn = false;
  private cleanup: (() => void)[] = [];
  private v = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  static async create(host: HTMLElement, modeId: ArenaModeId, mapId: MapId): Promise<Arena> {
    await RAPIER.init();
    return new Arena(host, ARENA_MODES.find((m) => m.id === modeId) ?? ARENA_MODES[0], mapId);
  }

  private constructor(host: HTMLElement, mode: ArenaMode, mapId: MapId) {
    this.mode = mode;
    this.respawns = mode.id !== "bomb";
    this.range = mode.id === "range";
    if (this.range) mapId = "range";
    this.dust = DUST[mapId] ?? 0xb9bec6;
    host.appendChild(this.canvas);
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.autoClear = false;
    this.renderer.shadowMap.enabled = !LIGHT;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // Neutral tone mapping keeps the painted colours saturated.
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    const env = studio(this.renderer);
    this.scene.environment = env;
    this.scene.environmentIntensity = 0.4;
    this.scene.add(this.camera);
    this.camera.rotation.order = "YXZ";

    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.ctrl = this.world.createCharacterController(0.03);
    this.ctrl.enableAutostep(0.4, 0.2, true);
    this.ctrl.enableSnapToGround(0.4);
    this.ctrl.setMaxSlopeClimbAngle((50 * Math.PI) / 180);
    this.map = buildMap(mapId, this.scene, this.world);
    this.scene.environmentIntensity = this.map.env ?? 0.4;
    this.attackSite = this.map.sites[0];
    this.paint = new Paint(this.scene, this.world, () => this.bodies, this.byHandle, mode.teams);
    this.puffs = new Puffs(this.scene);
    this.nades = new Grenades(this.scene, this.world, this.puffs, {
      bodies: () => this.bodies,
      affects: (by, a) => a === by || !this.mode.teams || a.team !== by.team,
      solid: (c) => !this.byHandle.has(c.handle),
      hurt: (v, by, dmg, name) => this.damage(v as Body, by as Body, dmg, name, false),
      blind: (v, at, color) => this.blind(v as Body, at, color),
      splat: (at, n, color, size) => this.paint.splat(at, n, color, size),
      hear: (at) => this.hear(at),
    });
    this.bomb.mesh.visible = false;
    this.bomb.mesh.scale.setScalar(1.5);
    this.scene.add(this.bomb.mesh, this.bomb.light);

    // The player.
    const s = useStore.getState();
    this.startXp = s.xp;
    this.startCases = s.cases;
    this.agentId = s.agents.find((a) => a.uid === s.agent)?.id ?? DEFAULT_AGENT;
    const blade = s.markers.find((m) => m.uid === s.knife);
    if (blade && MARKER_BY_ID[blade.id]?.melee) this.knife = { id: blade.id, skin: blade.skin };
    this.attackers = Math.random() < 0.5 ? 0 : 1;
    const myColor = mode.teams ? TEAM_COLORS[0] : FFA_COLORS[0];
    const collider = this.world.createCollider(RAPIER.ColliderDesc.capsule(0.52, 0.34).setTranslation(0, 3, 0));
    const velocity = new THREE.Vector3();
    this.me = {
      id: 0, name: "Ты", team: 0, color: myColor, alive: true, protect: 0, collider, velocity, hp: 100, armor: 0,
      money: this.range ? 99999 : mode.id === "bomb" ? START_MONEY : DM_MONEY, kills: 0, deaths: 0, respawnT: 0, isPlayer: true, agent: this.agentId, yaw: 0, spot: 0,
      chest: (out) => {
        const t = collider.translation();
        return out.set(t.x, t.y + 0.25, t.z);
      },
      hurt: (by, dmg, weapon, head) => this.damage(this.me, by as Body, dmg, weapon, head),
    };
    this.bodies.push(this.me);
    this.byHandle.set(collider.handle, this.me);

    // The bots: mostly common agents, now and then a rare one.
    const names = [...NAMES].sort(() => Math.random() - 0.5);
    if (this.range && this.map.range) {
      this.map.range.dummies.forEach((d, i) => {
        const bot = new Bot(this, 100 + i, "Манекен", 1, TEAM_COLORS[1], AGENTS[(i * 3 + 1) % AGENTS.length].id);
        bot.dummy = d;
        this.bots.push(bot);
        this.bodies.push(bot);
        this.byHandle.set(bot.collider.handle, bot);
      });
      this.map.range.boards.forEach((b, i) => {
        const board = new Board(this, 200 + i, b);
        this.boards.push(board);
        this.byHandle.set(board.collider.handle, board);
      });
    }
    const total = this.range ? 1 : mode.teams ? mode.size * 2 : mode.size;
    for (let i = 1; i < total; i++) {
      const team = mode.teams ? (i < mode.size ? 0 : 1) : i;
      const color = mode.teams ? TEAM_COLORS[team] : FFA_COLORS[i % FFA_COLORS.length];
      const pool = AGENTS.filter((a) => (Math.random() < 0.3 ? a.rarity >= 2 : a.rarity < 2));
      const bot = new Bot(this, i, names[i % names.length], team, color, pool[Math.floor(Math.random() * pool.length)].id);
      bot.money = this.me.money;
      this.bots.push(bot);
      this.bodies.push(bot);
      this.byHandle.set(bot.collider.handle, bot);
    }

    // The weapon in the player's hands lives in its own scene, drawn over the world.
    this.vmScene.environment = env;
    this.vmScene.environmentIntensity = 0.55;
    this.vmScene.add(this.vmRoot, new THREE.HemisphereLight(0xffffff, 0xb8c4d6, 0.5));
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(1.5, 3, 2);
    this.vmScene.add(key);

    this.bindInput();
    this.resize();
    useArena.setState({
      mode: mode.id, modeName: mode.name, mapName: this.map.name, teams: mode.teams, score: [0, 0], target: mode.target, time: 0, round: 1,
      respawn: 0, dead: false, killedBy: "", spectating: "", feed: [], board: [], showBoard: false, result: null, paused: !this.noLock, scoped: false,
      charge: 0, hitAt: 0, killAt: 0, hurtAt: 0, headAt: 0, banner: null, marks: [], action: null, hint: "", buyOpen: false, canBuy: true,
      blind: null, dmg: [], range: this.range, teamPick: false, teamFirst: false,
    });
    this.startRound(true);
    // With two sides, the first thing is to choose one.
    if (mode.teams && !this.range) {
      this.picking = this.pickFirst = true;
      useArena.setState({ teamPick: true, teamFirst: true, paused: false, banner: null });
    }
    Arena.current = this;
    (window as unknown as { __arena?: Arena }).__arena = this;
  }

  // -------------------------------------------------------------------------------------------
  // Teams

  /** Opens the team choice in the middle of a match. */
  openTeams(): void {
    if (!this.mode.teams || this.range || this.over || this.picking) return;
    if (this.buyOpen) this.closeBuy(false);
    this.picking = true;
    this.keys.clear();
    this.trigger = false;
    this.aiming = false;
    useArena.setState({ teamPick: true, teamFirst: false, paused: false });
    if (document.pointerLockElement) document.exitPointerLock();
  }

  /** Closes it without changing anything; before the first round there is no going back without a choice. */
  closeTeams(): void {
    if (!this.picking || this.pickFirst) return;
    this.picking = false;
    useArena.setState({ teamPick: false });
    this.lock();
  }

  /** Takes a side. Before the first round it starts the match; later it swaps the sides over. */
  chooseTeam(side: "attack" | "defend" | "auto"): void {
    if (!this.picking) return;
    const first = this.pickFirst;
    const want = side === "auto" ? (first ? (Math.random() < 0.5 ? 0 : 1) : this.attackers) : side === "attack" ? 0 : 1;
    this.picking = this.pickFirst = false;
    useArena.setState({ teamPick: false, teamFirst: false });
    if (first) {
      this.attackers = want;
      this.startRound(true);
    } else if (want !== this.attackers) {
      if (this.mode.id === "bomb") {
        this.swapNext = true;
        useStore.getState().toast("Смена стороны — со следующего раунда", "#ffd640");
      } else {
        this.attackers = want;
        if (this.me.alive) this.placeMe(this.spawnFor(this.me), 1.5);
        useStore.getState().toast(want === 0 ? "Теперь вы в атаке" : "Теперь вы в защите", "#ffd640");
        this.pushHud();
      }
    }
    this.lock();
  }

  // -------------------------------------------------------------------------------------------
  // Rounds

  private spawnsOf(team: number): P2[] {
    if (!this.mode.teams) return this.map.ffa;
    return this.map.spawns[team === this.attackers ? 0 : 1];
  }

  /** The spawn point furthest from every enemy (and from points just handed out). */
  private spawnFor(b: Body, avoid: P2[] = []): P2 {
    const points = this.spawnsOf(b.team);
    let best = points[0];
    let bestD = -1;
    for (const p of points) {
      let d = 1e9;
      for (const a of this.bodies) {
        if (a === b || !a.alive || (this.mode.teams && a.team === b.team)) continue;
        a.chest(this.v);
        d = Math.min(d, dist2(this.v.x, this.v.z, p.x, p.z));
      }
      for (const u of avoid) d = Math.min(d, dist2(u.x, u.z, p.x, p.z) * 6);
      d += Math.random() * 3;
      if (d > bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  private gun(id: string): Gun {
    const s = useStore.getState();
    const d = MARKER_BY_ID[id];
    const skin = s.markers.find((m) => m.uid === s.equipped[id])?.skin ?? 0;
    return { id, skin, mag: d.mag, reserve: id === DEFAULT_SIDE ? 9999 : d.mag * d.spare };
  }

  private refill(): void {
    // Topped up, but still the same weapon: one picked up off the ground keeps the skin it came with.
    this.guns = this.guns.map((g) => (g ? { ...this.gun(g.id), skin: g.skin } : null));
    if (!this.guns[1]) this.guns[1] = this.gun(DEFAULT_SIDE);
    this.guns[2] = { id: this.knife.id, skin: this.knife.skin, mag: 1, reserve: 9999 };
  }

  private startRound(first = false): void {
    const bombMode = this.mode.id === "bomb";
    this.phase = "freeze";
    this.phaseT = bombMode ? FREEZE : DM_FREEZE;
    this.nades.clear();
    this.puffs.clear();
    if (this.range) {
      this.phase = "live";
      this.phaseT = 0;
      this.myNades = { flash: 9, smoke: 9, fire: 9 };
    }
    this.hot = { site: null, t: 0 };
    this.buyT = 0;
    this.paint.clear();
    // A new round starts clean: no bodies, nothing lying about.
    for (const c of this.corpses) this.scene.remove(c.group);
    for (const d of this.drops) this.scene.remove(d.group);
    this.corpses = [];
    this.falling = [];
    this.drops = [];
    this.near = null;
    this.dropHint = "";
    this.fellAt = null;
    this.bomb.state = "none";
    this.bomb.carrier = null;
    this.bomb.defuser = null;
    this.bomb.planter = null;
    this.bomb.progress = 0;
    this.bomb.mesh.visible = false;
    this.bomb.light.intensity = 0;
    // In bomb mode the dead start the round with nothing but the free sidearm.
    if (!first && bombMode && !this.me.alive) {
      this.guns = [null, null, null];
      this.me.armor = 0;
      this.myNades = { flash: 0, smoke: 0, fire: 0 };
    }
    this.refill();
    for (const b of this.bots) {
      if (!first && bombMode && !b.alive) {
        b.equip(MARKER_BY_ID[DEFAULT_SIDE]);
        b.armor = 0;
      }
    }
    for (const b of this.bodies) b.alive = false;
    const used: P2[] = [];
    for (const b of this.bodies) {
      const at = this.spawnFor(b, used);
      used.push(at);
      if (b.isPlayer) this.placeMe(at, 0);
      else {
        const bot = b as Bot;
        bot.spawn(bot.dummy ?? at, 0);
        if (!bot.dummy) bot.buy(!bombMode);
      }
    }
    if (bombMode) {
      // The plan: attackers pick a site, defenders split between the two with one floating.
      this.attackSite = this.map.sites[Math.random() < 0.5 ? 0 : 1];
      let n = 0;
      for (const b of this.bots) {
        const attacking = b.team === this.attackers;
        b.post = attacking ? this.attackSite : this.map.sites[n++ % 2];
        // Attackers each take one of the ways in; defenders each take a place to watch from.
        const ways = attacking ? this.map.routes?.[b.post.name] : undefined;
        b.via = ways?.length ? ways[Math.floor(Math.random() * ways.length)].map((p) => ({ ...p })) : [];
        const spots = attacking ? undefined : this.map.posts?.[b.post.name];
        b.watch = spots?.length ? spots[Math.floor(Math.random() * spots.length)] : null;
      }
      const team = this.bodies.filter((b) => b.team === this.attackers);
      this.bomb.carrier = team[Math.floor(Math.random() * team.length)];
      this.bomb.state = "carried";
    }
    this.equip(this.guns[0] ? 0 : 1);
    const attacking = this.attackers === 0;
    useArena.setState({
      round: this.round, attacking, dead: false, respawn: 0, spectating: "", action: null,
      banner: this.range
        ? null
        : bombMode
        ? { title: `Раунд ${this.round}`, sub: attacking ? `Атака: заложи бомбу на A или B. Команда идёт на ${this.attackSite.name}` : "Защита: не дай заложить бомбу или обезвредь её", tone: 0 }
        : { title: this.mode.name, sub: `До ${this.mode.target} убийств. Закупись: B`, tone: 0 },
    });
    this.pushHud();
  }

  private endRound(winner: number, why: string): void {
    if (this.phase === "end") return;
    this.phase = "end";
    this.phaseT = ROUND_END;
    this.score[winner]++;
    const planted = this.bomb.planter !== null;
    for (const b of this.bodies) {
      const won = b.team === winner;
      b.money = Math.min(MAX_MONEY, b.money + (won ? WIN_MONEY : LOSS_MONEY + (planted && b.team === this.attackers ? 300 : 0)));
    }
    for (const b of this.bots) b.act = null;
    const mine = winner === 0;
    if (mine) {
      this.reward(30, 15);
      sfx.win();
    } else sfx.lose();
    useArena.setState({ banner: { title: mine ? "Раунд за вами" : "Раунд проигран", sub: why, tone: mine ? 1 : 2 }, action: null });
    this.pushHud();
  }

  private nextRound(): void {
    if (this.score[0] >= this.mode.target || this.score[1] >= this.mode.target) return this.finish();
    this.round++;
    if (this.swapNext) {
      this.swapNext = false;
      this.attackers = 1 - this.attackers;
    }
    if (this.round === SWAP_AFTER + 1) {
      // Half time: sides swap and everyone starts over.
      this.attackers = 1 - this.attackers;
      for (const b of this.bodies) {
        b.money = START_MONEY;
        b.armor = 0;
        b.alive = false;
      }
      this.guns = [null, null, null];
      this.myNades = { flash: 0, smoke: 0, fire: 0 };
      for (const b of this.bots) b.equip(MARKER_BY_ID[DEFAULT_SIDE]);
      useStore.getState().toast("Смена сторон", "#ffd24a");
      this.startRound(true);
      return;
    }
    this.startRound();
  }

  private updateRound(dt: number): void {
    if (this.range) return;
    this.phaseT -= dt;
    this.buyT -= dt;
    const bombMode = this.mode.id === "bomb";
    if (this.phase === "freeze") {
      if (this.phaseT <= 0) {
        this.phase = "live";
        this.phaseT = this.mode.time;
        this.buyT = BUY_TIME;
        useArena.setState({ banner: null });
      }
      return;
    }
    if (this.phase === "end") {
      if (this.phaseT <= 0) this.nextRound();
      return;
    }
    if (!bombMode) {
      if (this.phaseT <= 0) this.finish();
      return;
    }
    // Where is the attack? Two or more attackers on a site, or the bomb itself, give it away.
    let hot: Site | null = null;
    for (const site of this.map.sites) {
      let n = 0;
      for (const b of this.bodies) {
        if (!b.alive || b.team !== this.attackers) continue;
        const t = b.collider.translation();
        if (dist2(t.x, t.z, site.x, site.z) < site.r + 6) n += this.bomb.carrier === b ? 2 : 1;
      }
      if (n >= 2) hot = site;
    }
    if (hot && hot === this.hot.site) this.hot.t += dt;
    else this.hot = { site: hot, t: 0 };
    const att = this.bodies.filter((b) => b.alive && b.team === this.attackers).length;
    const def = this.bodies.filter((b) => b.alive && b.team !== this.attackers).length;
    if (this.phase === "live") {
      if (def === 0) return this.endRound(this.attackers, "Защита уничтожена");
      if (att === 0) return this.endRound(1 - this.attackers, "Атака уничтожена");
      if (this.phaseT <= 0) return this.endRound(1 - this.attackers, "Время вышло");
      return;
    }
    // Planted.
    if (this.bomb.progress >= 1 && this.bomb.defuser) {
      const who = this.bomb.defuser;
      who.money = Math.min(MAX_MONEY, who.money + PLANT_MONEY);
      if (who.isPlayer) {
        this.reward(40, 20);
        useStore.getState().passEvent("bomb", 1);
      }
      sfx.defused();
      this.bomb.light.intensity = 0;
      return this.endRound(1 - this.attackers, `${who.name === "Ты" ? "Ты обезвредил" : `${who.name} обезвредил`} бомбу`);
    }
    if (this.phaseT <= 0) return this.explode();
    if (def === 0) return this.endRound(this.attackers, "Защита уничтожена");
  }

  // -------------------------------------------------------------------------------------------
  // The bomb

  private siteAt(x: number, z: number): Site | null {
    return this.map.sites.find((s) => dist2(s.x, s.z, x, z) < s.r) ?? null;
  }

  private plant(by: Body): void {
    const t = by.collider.translation();
    const site = this.siteAt(t.x, t.z) ?? this.attackSite;
    this.bomb.state = "planted";
    this.bomb.carrier = null;
    this.bomb.planter = by;
    this.bomb.progress = 0;
    this.bomb.defuser = null;
    this.bomb.pos.set(t.x, this.map.floorAt(t.x, t.z) + 0.02, t.z);
    this.bomb.mesh.position.copy(this.bomb.pos);
    this.bomb.mesh.visible = true;
    this.bomb.light.position.set(t.x, this.bomb.pos.y + 0.7, t.z);
    this.phase = "planted";
    this.phaseT = BOMB_TIME;
    by.money = Math.min(MAX_MONEY, by.money + PLANT_MONEY);
    for (const b of this.bots) {
      b.act = null;
      b.hold = null;
      b.via = [];
    }
    if (by.isPlayer) {
      this.reward(40, 20);
      useStore.getState().passEvent("bomb", 1);
    }
    sfx.planted();
    useStore.getState().toast(`Бомба заложена на ${site.name}`, "#ff6a5a");
    useArena.setState({ action: null });
    this.pushHud();
  }

  private drop(at: THREE.Vector3): void {
    this.bomb.state = "dropped";
    this.bomb.carrier = null;
    this.bomb.progress = 0;
    this.bomb.pos.set(at.x, this.map.floorAt(at.x, at.z) + 0.02, at.z);
    this.bomb.mesh.position.copy(this.bomb.pos);
    this.bomb.mesh.visible = true;
  }

  private explode(): void {
    const at = this.bomb.pos.clone();
    at.y += 1;
    sfx.boom();
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffb04a, transparent: true, opacity: 0.9, toneMapped: false }));
    mesh.position.copy(at);
    this.scene.add(mesh);
    this.blast = { mesh, t: 0 };
    this.bomb.mesh.visible = false;
    this.bomb.light.intensity = 0;
    const by = this.bomb.planter ?? this.me;
    for (const b of [...this.bodies]) {
      if (!b.alive) continue;
      const d = b.chest(this.v).distanceTo(at);
      if (d < 22) this.damage(b, by, d < 10 ? 500 : Math.round(260 * (1 - d / 22)), "Бомба", false, true);
    }
    this.endRound(this.attackers, "Бомба взорвана");
  }

  private updateBomb(dt: number): void {
    const b = this.bomb;
    if (this.mode.id !== "bomb" || this.phase === "freeze" || this.phase === "end") {
      if (useArena.getState().hint !== this.dropHint) useArena.setState({ hint: this.dropHint });
      return;
    }
    this.noPickT -= dt;
    const me = this.me;
    const using = this.keys.has("KeyE") && me.alive && !this.buyOpen;
    let action: { label: string; progress: number } | null = null;
    let hint = "";
    if (b.state === "carried" && b.carrier) {
      const c = b.carrier;
      const t = c.collider.translation();
      const site = this.siteAt(t.x, t.z);
      if (c.isPlayer) {
        if (site && this.grounded) {
          hint = `Удерживай E — заложить бомбу на ${site.name}`;
          if (using) {
            b.progress += dt / PLANT_TIME;
            action = { label: "Закладка бомбы", progress: b.progress };
          } else b.progress = 0;
        } else {
          b.progress = 0;
          hint = "Бомба у тебя: неси на A или B · G — бросить";
        }
      } else {
        const bot = c as Bot;
        if (site && dist2(site.x, site.z, t.x, t.z) < site.r - 0.8) {
          bot.act = "plant";
          b.progress += dt / PLANT_TIME;
        }
      }
      if (b.progress >= 1) this.plant(c);
    } else if (b.state === "dropped") {
      // Any attacker who walks over the bomb picks it up.
      for (const a of this.bodies) {
        if (!a.alive || a.team !== this.attackers || (a.isPlayer && this.noPickT > 0)) continue;
        const t = a.collider.translation();
        if (dist2(t.x, t.z, b.pos.x, b.pos.z) < 1.3) {
          b.state = "carried";
          b.carrier = a;
          b.mesh.visible = false;
          if (a.isPlayer) sfx.pickup();
          break;
        }
      }
    } else if (b.state === "planted") {
      // Beeps speed up as the timer runs down.
      b.beepT -= dt;
      if (b.beepT <= 0) {
        b.beepT = Math.max(0.12, this.phaseT / 28);
        const d = me.chest(this.v).distanceTo(b.pos);
        if (d < 60) sfx.beep(this.phaseT < 8 ? 1.25 : 1);
        b.light.intensity = 60;
      }
      b.light.intensity *= Math.exp(-9 * dt);
      const defending = this.attackers !== 0;
      if (b.defuser && !b.defuser.alive) {
        b.defuser = null;
        b.progress = 0;
      }
      if (defending && me.alive) {
        const t = me.collider.translation();
        const near = dist2(t.x, t.z, b.pos.x, b.pos.z) < 2;
        if (near && (!b.defuser || b.defuser === me)) {
          hint = "Удерживай E — обезвредить бомбу";
          if (using) {
            b.defuser = me;
            b.progress += dt / DEFUSE_TIME;
            action = { label: "Обезвреживание", progress: b.progress };
          } else if (b.defuser === me) {
            b.defuser = null;
            b.progress = 0;
          }
        } else if (b.defuser === me) {
          b.defuser = null;
          b.progress = 0;
        }
      }
      for (const bot of this.bots) {
        if (!bot.alive || bot.team === this.attackers) continue;
        const t = bot.collider.translation();
        const near = dist2(t.x, t.z, b.pos.x, b.pos.z) < 1.7;
        if (near && !b.defuser) {
          b.defuser = bot;
          b.progress = 0;
        }
        if (b.defuser === bot) {
          bot.act = "defuse";
          b.progress += dt / DEFUSE_TIME;
        }
      }
      if (b.defuser && !b.defuser.isPlayer && defending) action = { label: `${b.defuser.name} обезвреживает`, progress: b.progress };
      if (!defending && b.defuser) hint = "Бомбу обезвреживают!";
    }
    if (!hint || hint.startsWith("Бомба у тебя")) hint = this.dropHint || hint;
    const st = useArena.getState();
    if (st.hint !== hint || (st.action?.progress ?? -1) !== (action?.progress ?? -1) || st.action?.label !== action?.label) useArena.setState({ hint, action });
  }

  // -------------------------------------------------------------------------------------------
  // What the dead leave behind

  /** A weapon falls where its owner did. */
  private dropGun(g: Gun, at: THREE.Vector3, toss?: THREE.Vector3): void {
    const built = buildMarker(g.id, g.skin, 0.006);
    bake(built.group, built.muzzle2 ? [built.muzzle, built.muzzle2] : [built.muzzle]);
    // On its side, the way a dropped weapon lies.
    built.group.rotation.z = Math.PI / 2;
    built.group.position.x = built.muzzle2 ? 0.15 : 0;
    built.group.scale.setScalar(1.4);
    built.group.position.y = 0.05;
    const group = new THREE.Group();
    group.add(built.group);
    // A ring in the colour of its rarity, so it can be found on the ground.
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.42, 0.54, 32),
      new THREE.MeshBasicMaterial({ color: RARITY[itemRarity({ id: g.id, skin: g.skin })]?.hex ?? 0xffffff, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, toneMapped: false }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.01;
    group.add(ring);
    group.rotation.y = Math.random() * 6;
    this.scene.add(group);
    const a = Math.random() * Math.PI * 2;
    const floor = this.map.floorAt(at.x, at.z) + 0.07;
    this.drops.push({
      ...g, group, x: at.x, y: Math.max(floor, at.y), z: at.z, floor, t: 0,
      vx: toss ? toss.x : Math.cos(a) * 1.4, vy: 2.4, vz: toss ? toss.z : Math.sin(a) * 1.4,
    });
    while (this.drops.length > 24) this.scene.remove(this.drops.shift()!.group);
  }

  /** Takes a weapon off the ground into the slot it belongs in; what was there is dropped in its place. */
  private pickUp(d: Drop): void {
    const def = MARKER_BY_ID[d.id];
    if (!def || !this.me.alive) return;
    const slot = def.side ? 1 : 0;
    const old = this.guns[slot];
    this.scene.remove(d.group);
    this.drops = this.drops.filter((x) => x !== d);
    this.near = null;
    if (old) {
      const f = this.camera.getWorldDirection(new THREE.Vector3());
      this.dropGun({ ...old }, this.me.chest(new THREE.Vector3()), f.setY(0).normalize().multiplyScalar(3));
    }
    this.guns[slot] = { id: d.id, skin: d.skin, mag: d.mag, reserve: d.reserve };
    this.equip(slot);
    sfx.pickup();
    this.pushHud();
  }

  private updateDrops(dt: number): void {
    const me = this.me;
    const t = me.collider.translation();
    let best: Drop | null = null;
    let bestD = 1.9;
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.t += dt;
      if (d.y > d.floor || d.vy > 0) {
        d.vy -= 16 * dt;
        d.y = Math.max(d.floor, d.y + d.vy * dt);
        // Stops against a wall rather than passing through it.
        const nx = d.x + d.vx * dt;
        const nz = d.z + d.vz * dt;
        if (this.map.nav.free(nx, nz) && this.map.floorAt(nx, nz) <= d.y + 0.3) {
          d.x = nx;
          d.z = nz;
          d.floor = Math.max(d.floor, this.map.floorAt(nx, nz) + 0.07);
        }
        d.group.rotation.y += dt * 7;
        if (d.y <= d.floor) d.vy = 0;
      }
      d.group.position.set(d.x, d.y, d.z);
      if (this.respawns && d.t > 40) {
        this.scene.remove(d.group);
        this.drops.splice(i, 1);
        continue;
      }
      if (!me.alive || d.t < 0.6) continue;
      const dist = dist2(t.x, t.z, d.x, d.z);
      if (dist < bestD && Math.abs(t.y - CENTER - d.floor) < 1.3) {
        bestD = dist;
        best = d;
      }
    }
    this.near = best;
    this.dropHint = "";
    if (!best) return;
    const def = MARKER_BY_ID[best.id];
    const slot = def.side ? 1 : 0;
    // An empty slot takes it at once; otherwise it is the player's call.
    if (!this.guns[slot] && bestD < 1.2) this.pickUp(best);
    else this.dropHint = `E — подобрать ${def.name}`;
  }

  /** The player's own body, left where they fell. */
  private layPlayer(): void {
    if (this.range) return;
    const t = this.me.collider.translation();
    const rig = new AgentRig(this.agentId, this.me.color);
    const y = Math.max(this.map.floorAt(t.x, t.z), 0);
    rig.group.position.set(t.x, y, t.z);
    rig.group.rotation.y = this.yaw + Math.PI;
    rig.die();
    this.scene.add(rig.group);
    this.corpses.push({ group: rig.group, t: 0, rig });
    this.fellAt = new THREE.Vector3(t.x, y, t.z);
  }

  private updateCorpses(dt: number): void {
    for (let i = this.falling.length - 1; i >= 0; i--) {
      const f = this.falling[i];
      f.t += dt;
      if (f.t < 0.62) continue;
      this.falling.splice(i, 1);
      if (f.bot.alive) continue;
      // Once it is down, what lies there is a copy: the bot itself is free to come back.
      const body = f.bot.model.group.clone(true);
      const drop: THREE.Object3D[] = [];
      body.traverse((o) => {
        if (o.userData.tag) drop.push(o);
        const mesh = o as THREE.Mesh;
        const m = mesh.material as THREE.MeshBasicMaterial | undefined;
        if (m && (m as THREE.Material).type === "MeshBasicMaterial" && m.map) mesh.material = m.clone();
      });
      for (const o of drop) o.removeFromParent();
      this.scene.add(body);
      f.bot.model.group.visible = false;
      this.corpses.push({ group: body, t: 0 });
    }
    const still = { vx: 0, vz: 0, pitch: 0, aim: 0 };
    for (const c of this.corpses) {
      c.t += dt;
      if (c.rig && c.t < 0.6) c.rig.update(dt, still);
    }
    // Where the dead come back, the bodies do not pile up for ever.
    const cap = this.respawns ? 14 : 40;
    while (this.corpses.length > cap || (this.respawns && this.corpses.length && this.corpses[0].t > 50)) this.scene.remove(this.corpses.shift()!.group);
  }

  /** What the radar shows: the player's side always, the other side only while someone on ours has eyes on them. */
  radar(): RadarView {
    const t = this.me.collider.translation();
    const dots: RadarView["dots"] = [];
    const teams = this.mode.teams;
    for (const b of this.bots) {
      if (b.dummy) continue;
      const p = b.collider.translation();
      const ally = teams && b.team === this.me.team;
      if (!b.alive) {
        if (ally && !this.respawns) dots.push({ x: p.x, z: p.z, yaw: 0, kind: "dead", alpha: 0.7, bomb: false });
        continue;
      }
      if (ally) dots.push({ x: p.x, z: p.z, yaw: b.yaw, kind: "ally", alpha: 1, bomb: this.bomb.carrier === b });
      else if (b.spot > 0) dots.push({ x: p.x, z: p.z, yaw: b.yaw, kind: "enemy", alpha: Math.min(1, b.spot / 0.9), bomb: false });
    }
    const bm = this.bomb;
    const attacking = this.attackers === this.me.team;
    const bomb = this.mode.id !== "bomb" ? null : bm.state === "planted" ? { x: bm.pos.x, z: bm.pos.z, planted: true } : bm.state === "dropped" && attacking ? { x: bm.pos.x, z: bm.pos.z, planted: false } : null;
    return { me: { x: t.x, z: t.z, yaw: this.yaw, alive: this.me.alive }, dots, bomb };
  }

  private nearestBot(team: number, to: THREE.Vector3): Bot | null {
    let best: Bot | null = null;
    let bestD = Infinity;
    for (const b of this.bots) {
      if (!b.alive || b.team !== team) continue;
      const t = b.collider.translation();
      const d = dist2(t.x, t.z, to.x, to.z);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    return best;
  }

  private holdNear(bot: Bot, x: number, z: number, r: number): P2 {
    if (!bot.hold || bot.holdT <= 0 || dist2(bot.hold.x, bot.hold.z, x, z) > r + 1.5) {
      bot.holdT = 5 + Math.random() * 7;
      bot.hold = { x, z };
      for (let i = 0; i < 12; i++) {
        const a = Math.random() * Math.PI * 2;
        const d = Math.sqrt(Math.random()) * r;
        const p = { x: x + Math.cos(a) * d, z: z + Math.sin(a) * d };
        if (this.map.nav.free(p.x, p.z)) {
          bot.hold = p;
          break;
        }
      }
    }
    return bot.hold;
  }

  /** Where the round's plan wants a bot to be. Null: no plan, go and fight. */
  goalFor(bot: Bot): P2 | null {
    if (this.mode.id !== "bomb" || this.phase === "end") return null;
    const b = this.bomb;
    const attacking = bot.team === this.attackers;
    if (b.state === "planted") return attacking ? this.holdNear(bot, b.pos.x, b.pos.z, 8) : { x: b.pos.x, z: b.pos.z };
    if (attacking) {
      if (b.state === "dropped" && this.nearestBot(this.attackers, b.pos) === bot) return { x: b.pos.x, z: b.pos.z };
      const s = this.attackSite;
      // Along the way it chose first.
      if (bot.via.length) {
        const t = bot.collider.translation();
        if (dist2(bot.via[0].x, bot.via[0].z, t.x, t.z) < 4) bot.via.shift();
        if (bot.via.length) return bot.via[0];
      }
      if (b.carrier === bot) return { x: s.x + bot.off.x * 0.5, z: s.z + bot.off.z * 0.5 };
      return this.holdNear(bot, s.x, s.z, s.r + 2.5);
    }
    const hot = this.hot.t > 7 ? this.hot.site : null;
    if (bot.watch && (!hot || hot === bot.post)) return this.holdNear(bot, bot.watch.x, bot.watch.z, 1.6);
    const post = hot ?? bot.post ?? this.map.sites[0];
    return this.holdNear(bot, post.x, post.z, post.r + 2);
  }

  // -------------------------------------------------------------------------------------------
  // Bodies

  private placeMe(at: P2, protect: number): void {
    const me = this.me;
    me.alive = true;
    me.hp = 100;
    me.protect = protect;
    me.collider.setEnabled(true);
    const floor = this.map.floorAt(at.x, at.z);
    me.collider.setTranslation({ x: at.x, y: floor + CENTER + 0.2, z: at.z });
    this.yaw = Math.atan2(at.x, at.z);
    this.pitch = 0;
    this.vy = 0;
    this.vel.set(0, 0, 0);
    this.reloadT = 0;
    this.charge = 0;
    this.spin = 0;
    this.spec = null;
    this.camera.position.set(at.x, floor + CENTER + EYE, at.z);
    this.camera.rotation.set(0, this.yaw, 0, "YXZ");
    useArena.setState({ respawn: 0, dead: false, hp: 100, spectating: "" });
  }

  respawnBot(bot: Bot): void {
    if (bot.dummy) return bot.spawn(bot.dummy, 0);
    bot.spawn(this.spawnFor(bot), 1.5);
    bot.money = Math.min(MAX_MONEY, bot.money + 300);
    bot.buy(true);
  }

  /** How loud something at `at` is for the player, and to which side. */
  hear(at: THREE.Vector3): { vol: number; pan: number } {
    const eye = this.camera.position;
    const dx = at.x - eye.x;
    const dz = at.z - eye.z;
    const d = Math.hypot(dx, dz, at.y - eye.y);
    return { vol: Math.max(0, 1 - d / 55) ** 1.6, pan: d > 0.5 ? (dx * Math.cos(this.yaw) - dz * Math.sin(this.yaw)) / d : 0 };
  }

  /** A bot's foot comes down: a sound if it is near, and dust if it is running. */
  footstep(bot: Bot, speed: number): void {
    const t = bot.collider.translation();
    const h = this.hear(this.v.set(t.x, t.y - CENTER, t.z));
    if (h.vol > 0.06) sfx.foot(h.vol * 0.55, h.pan);
    if (speed > 4.6) this.puffs.kick(t.x, t.y - CENTER, t.z, 2, this.dust, 0.085);
  }

  /** A Клякса burst where `victim` could see it: the more squarely they were looking, the worse. */
  private blind(victim: Body, at: THREE.Vector3, color: number): void {
    const eye = victim.chest(new THREE.Vector3());
    const to = at.clone().sub(eye);
    const d = to.length() || 1;
    const facing = victim.isPlayer ? this.camera.getWorldDirection(new THREE.Vector3()).dot(to) / d : (Math.sin(victim.yaw) * to.x + Math.cos(victim.yaw) * to.z) / d;
    const amount = Math.max(0, Math.min(1, facing + 0.3)) * Math.max(0.25, Math.min(1, 1.3 - d / 22));
    if (amount < 0.15) return;
    if (victim.isPlayer) useArena.setState({ blind: { at: performance.now(), amount, color: hex(color) } });
    else (victim as Bot).blindT = 0.8 + amount * 3;
  }

  /** Throws a grenade: the player where they are looking, a bot in an arc onto `target`. */
  throwNade(by: Body, kind: NadeKind, target?: THREE.Vector3): void {
    const from = by.chest(new THREE.Vector3());
    from.y += 0.45;
    const vel = new THREE.Vector3();
    if (by.isPlayer || !target) {
      this.camera.getWorldDirection(vel);
      from.copy(this.camera.position).addScaledVector(vel, 0.5);
      vel.multiplyScalar(17).add(this.v.set(by.velocity.x * 0.5, 3.4, by.velocity.z * 0.5));
    } else {
      const dx = target.x - from.x;
      const dz = target.z - from.z;
      const d = Math.hypot(dx, dz) || 1;
      const time = d / 12;
      vel.set((dx / d) * 12, (target.y - 1 - from.y + 7.5 * time * time) / time, (dz / d) * 12);
    }
    this.nades.throw(kind, by, from, vel);
    const h = this.hear(from);
    if (h.vol > 0.05) sfx.throw();
  }

  boardHit(by: Body, dmg: number): void {
    if (!by.isPlayer) return;
    useArena.setState({ hitAt: performance.now() });
    sfx.target(0.9 + Math.random() * 0.3);
    this.pushDmg(dmg, false, false);
  }

  /** A number that floats up from the crosshair: what that hit took off. */
  private pushDmg(n: number, head: boolean, kill: boolean): void {
    const id = ++this.dmgSeq;
    useArena.setState((st) => ({ dmg: [...st.dmg.slice(-7), { id, n, head, kill, x: Math.random() }] }));
    setTimeout(() => useArena.setState((st) => ({ dmg: st.dmg.filter((d) => d.id !== id) })), 900);
  }

  /** Moves a body's capsule with collision; returns how far it actually went. */
  moveBody(collider: RAPIER.Collider, dx: number, dz: number, dt: number): { x: number; z: number } {
    this.ctrl.computeColliderMovement(collider, { x: dx, y: -9 * dt, z: dz }, undefined, undefined, (c) => !this.byHandle.has(c.handle));
    const m = this.ctrl.computedMovement();
    const t = collider.translation();
    collider.setTranslation({ x: t.x + m.x, y: Math.max(CENTER, t.y + m.y), z: t.z + m.z });
    return { x: m.x, z: m.z };
  }

  /** Can `a` see `b`? One ray from eyes to chest that only the scenery can stop. */
  sees(a: Actor, b: Actor): boolean {
    const from = a.chest(new THREE.Vector3());
    from.y += 0.45;
    const to = b.chest(new THREE.Vector3());
    if (this.nades.blocksSight(from, to)) return false;
    const dir = to.sub(from);
    const dist = dir.length();
    dir.multiplyScalar(1 / dist);
    return !this.world.castRay(new RAPIER.Ray(from, dir), dist, true, undefined, undefined, undefined, undefined, (c) => !this.byHandle.has(c.handle));
  }

  /** Experience, pass progress and coins for the player. */
  private reward(xp: number, coins: number): void {
    if (this.range) return;
    const s = useStore.getState();
    this.coins += coins;
    useStore.setState({ salt: s.salt + coins });
    s.addXp(xp);
    s.addPassXp(xp);
  }

  damage(victim: Body, by: Body, dmg: number, weapon: string, head: boolean, force = false): void {
    if (!victim.alive || this.over) return;
    if (!force && (victim.protect > 0 || this.phase === "freeze")) return;
    let d = dmg;
    if (victim.armor > 0 && !force) {
      const soak = Math.min(victim.armor, d * 0.5);
      victim.armor -= soak;
      d -= soak;
    }
    victim.hp -= d;
    const now = performance.now();
    if (by.isPlayer && victim !== by) {
      useArena.setState(head ? { hitAt: now, headAt: now } : { hitAt: now });
      (head ? sfx.headshot : sfx.hit)();
      this.pushDmg(Math.round(d), head, victim.hp <= 0);
    }
    if (victim.isPlayer) {
      useArena.setState({ hurtAt: now, hp: Math.max(0, Math.ceil(victim.hp)), armor: Math.round(victim.armor) });
      sfx.hurt();
    }
    if (victim.hp <= 0) this.kill(victim, by, weapon, head);
  }

  private kill(victim: Body, by: Body, weapon: string, head: boolean): void {
    victim.alive = false;
    victim.hp = 0;
    victim.deaths++;
    victim.collider.setEnabled(false);
    if (!this.range) {
      const bot = victim.isPlayer ? null : (victim as Bot);
      const held = bot ? { id: bot.gun.id, skin: bot.skin, mag: bot.gun.mag, reserve: bot.gun.spare } : this.guns[this.slot === 2 ? 0 : this.slot] ?? this.guns[0] ?? this.guns[1];
      if (held && held.id !== DEFAULT_SIDE && !MARKER_BY_ID[held.id]?.melee) this.dropGun({ ...held }, victim.chest(new THREE.Vector3()));
    }
    if (!victim.isPlayer) {
      (victim as Bot).die();
      if (!this.range) this.falling.push({ bot: victim as Bot, t: 0 });
    } else this.layPlayer();
    if (this.bomb.carrier === victim) this.drop(victim.chest(this.v));
    if (this.bomb.defuser === victim) {
      this.bomb.defuser = null;
      this.bomb.progress = 0;
    }
    const credit = by !== victim && (!this.mode.teams || by.team !== victim.team);
    if (credit) {
      by.kills++;
      if (!this.range) by.money = Math.min(MAX_MONEY, by.money + KILL_MONEY);
      if (this.mode.id === "tdm") this.score[by.team]++;
    }
    pushFeed({
      killer: by.name, victim: victim.name, weapon, head, tone: by.isPlayer ? 1 : victim.isPlayer ? 2 : 0, killerColor: hex(by.color), victimColor: hex(victim.color),
    });
    if (by.isPlayer && credit) {
      this.reward(XP_KILL + (head ? 5 : 0), COINS_KILL);
      const s = useStore.getState();
      s.passEvent("kill", 1);
      if (head) s.passEvent("head", 1);
      useArena.setState({ killAt: performance.now() });
      sfx.kill();
    }
    if (this.respawns) victim.respawnT = this.range ? 1.5 : RESPAWN;
    if (victim.isPlayer) {
      this.trigger = false;
      this.aiming = false;
      if (this.buyOpen) this.closeBuy(false);
      sfx.tagged();
      useArena.setState({ dead: true, respawn: this.respawns ? RESPAWN : 0, killedBy: `${by.name} · ${weapon}`, scoped: false, charge: 0, action: null, hint: "" });
    }
    this.pushHud();
    if (this.mode.id === "tdm" && this.score[by.team] >= this.mode.target) this.finish();
    if (this.mode.id === "ffa" && by.kills >= this.mode.target) this.finish();
  }

  private board(): BoardRow[] {
    return this.bodies
      .map((b) => ({ name: b.name, team: b.team, color: hex(b.color), agent: b.agent, kills: b.kills, deaths: b.deaths, money: b.money, alive: b.alive, you: b.isPlayer }))
      .sort((a, b) => a.team - b.team || b.kills - a.kills || a.deaths - b.deaths);
  }

  get canBuy(): boolean {
    return this.me.alive && !this.over && (this.range || this.phase === "freeze" || this.buyT > 0);
  }

  private pushHud(): void {
    const g = this.guns[this.slot];
    const def = g ? MARKER_BY_ID[g.id] : null;
    const leader = Math.max(0, ...this.bodies.filter((b) => !b.isPlayer).map((b) => b.kills));
    const dot = (b: Body) => ({ name: b.name, alive: b.alive, you: b.isPlayer });
    const mine = this.bodies.filter((b) => (this.mode.teams ? b.team === 0 : b.isPlayer));
    const theirs = this.bodies.filter((b) => (this.mode.teams ? b.team !== 0 : !b.isPlayer));
    useArena.setState({
      score: this.mode.id === "ffa" ? [this.me.kills, leader] : [this.score[0], this.score[1]],
      time: Math.max(0, Math.ceil(this.phaseT)), phase: this.phase, roster: [mine.map(dot), theirs.map(dot)],
      hp: Math.max(0, Math.ceil(this.me.hp)), armor: Math.round(this.me.armor), money: this.me.money,
      mag: g?.mag ?? 0, magMax: def?.mag ?? 0, reserve: g?.reserve ?? 0, reloading: this.reloadT > 0, slot: this.slot,
      slots: this.guns.map((x) => (x ? { id: x.id, skin: x.skin } : null)), hasBomb: this.bomb.carrier === this.me, canBuy: this.canBuy,
      attacking: this.attackers === 0, board: this.board(), nades: { ...this.myNades }, range: this.range,
    });
  }

  private pushMarks(): void {
    if (this.mode.id !== "bomb") return;
    const marks: Mark[] = [];
    const eye = this.camera.position;
    const add = (label: string, x: number, y: number, z: number, tone: Mark["tone"]) => {
      const d = Math.round(Math.hypot(x - eye.x, z - eye.z));
      this.v.set(x, y, z).project(this.camera);
      marks.push({ label, x: (this.v.x + 1) / 2, y: (1 - this.v.y) / 2, off: this.v.z > 1 || Math.abs(this.v.x) > 1.05 || Math.abs(this.v.y) > 1.05, dist: d, tone });
    };
    const b = this.bomb;
    if (b.state !== "planted") for (const s of this.map.sites) add(s.name, s.x, this.map.floorAt(s.x, s.z) + 2.4, s.z, "site");
    if (b.state === "planted" || (b.state === "dropped" && this.attackers === 0)) add("BOMB", b.pos.x, b.pos.y + 1.1, b.pos.z, "bomb");
    useArena.setState({ marks });
  }

  /** Ends the match and hands out the rewards. */
  finish(): void {
    if (this.over) return;
    this.over = true;
    sfx.hush();
    if (document.pointerLockElement) document.exitPointerLock();
    if (this.range) return useStore.getState().setScreen("menu");
    const rows = [...this.bodies].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
    const place = rows.indexOf(this.me) + 1;
    const won = this.mode.teams ? this.score[0] > this.score[1] : place === 1 && this.me.kills > 0;
    this.reward(this.mode.teams ? (won ? 150 : 50) : Math.max(30, 160 - place * 15), won ? 60 : 15);
    const s = useStore.getState();
    s.passEvent("match", 1);
    if (won) s.passEvent("win", 1);
    (won ? sfx.win : sfx.lose)();
    const after = useStore.getState();
    after.bank();
    this.pushHud();
    useArena.setState({
      result: { won, place, kills: this.me.kills, deaths: this.me.deaths, xp: after.xp - this.startXp, coins: this.coins, cases: Math.max(0, after.cases - this.startCases) },
      showBoard: false, scoped: false, banner: null, buyOpen: false, action: null, hint: "", marks: [],
    });
  }

  // -------------------------------------------------------------------------------------------
  // Buying

  buy(id: string): void {
    const d = MARKER_BY_ID[id];
    const me = this.me;
    if (!d || !this.canBuy) return;
    const slot = d.side ? 1 : 0;
    const s = useStore.getState();
    if (this.guns[slot]?.id === id) return s.toast("Это оружие уже у тебя", "#9fb3c8");
    if (!this.range && me.money < d.price) {
      sfx.deny();
      return s.toast("Не хватает денег", "#f0a35c");
    }
    if (!this.range) me.money -= d.price;
    this.guns[slot] = this.gun(id);
    sfx.buy();
    this.equip(slot);
  }

  buyArmor(): void {
    const me = this.me;
    if (!this.canBuy || me.armor >= 100) return;
    if (me.money < ARMOR_PRICE) {
      sfx.empty();
      return useStore.getState().toast("Не хватает денег", "#f0a35c");
    }
    me.money -= ARMOR_PRICE;
    me.armor = 100;
    sfx.buy();
    this.pushHud();
  }

  buyNade(kind: NadeKind): void {
    const me = this.me;
    if (!this.canBuy || this.range) return;
    const s = useStore.getState();
    if (this.myNades[kind] >= 1) return s.toast("Больше одной не унести", "#9fb3c8");
    if (me.money < NADES[kind].price) {
      sfx.deny();
      return s.toast("Не хватает денег", "#f0a35c");
    }
    me.money -= NADES[kind].price;
    this.myNades[kind]++;
    sfx.buy();
    this.pushHud();
  }

  private useNade(kind: NadeKind): void {
    if (!this.me.alive || this.nadeT > 0 || this.phase === "freeze" || this.buyOpen || this.myNades[kind] <= 0) return;
    if (!this.range) this.myNades[kind]--;
    this.nadeT = 0.7;
    this.throwK = 1;
    this.throwNade(this.me, kind);
    this.pushHud();
  }

  openBuy(): void {
    if (!this.canBuy || this.buyOpen) return;
    this.buyOpen = true;
    this.keys.clear();
    this.trigger = false;
    this.aiming = false;
    useArena.setState({ buyOpen: true, paused: false });
    if (document.pointerLockElement) document.exitPointerLock();
  }

  closeBuy(relock = true): void {
    if (!this.buyOpen) return;
    this.buyOpen = false;
    useArena.setState({ buyOpen: false });
    if (relock) this.lock();
    // Closed by the game, not by the player: the mouse is free, so wait for a click to carry on.
    else if (!this.locked && !this.picking) useArena.setState({ paused: true });
  }

  // -------------------------------------------------------------------------------------------
  // The weapon in hand

  private equip(slot: number): void {
    const g = this.guns[slot];
    if (!g) return;
    if (slot !== this.slot) this.lastSlot = this.slot;
    this.slot = slot;
    if (this.vm) {
      this.vmRoot.remove(this.vm.group);
      sfx.swap();
    }
    this.vm = buildMarker(g.id, g.skin);
    this.vm.group.traverse((o) => {
      o.castShadow = false;
      o.receiveShadow = false;
    });
    // Arms in the agent's colours, hands closed on the weapon.
    const melee = !!MARKER_BY_ID[g.id].melee;
    const [sleeve, glove] = ARM_COLORS[this.agentId] ?? ARM_COLORS[AGENTS[0].id];
    this.arms = buildArms(this.vm, sleeve, glove, this.me.color, melee);
    this.elbow.copy(this.arms.rest).addScaledVector(LEFT_FOREARM, 0.75).applyMatrix4(VM_REST);
    const hold = HOLD[g.id];
    this.vm.group.rotation.set(melee && hold ? hold.tilt : 0, melee && hold ? hold.turn : 0, 0);
    this.kMove = melee ? { kind: "draw", t: 0, dur: drawTime(g.id), side: 1, hit: true, heavy: false } : null;
    this.vmMove = melee ? null : { kind: "draw", t: 0, dur: DRAW_TIME[kindOf(g.id)] };
    this.racked = false;
    this.vmRoot.add(this.vm.group);
    this.swapT = melee ? drawTime(g.id) * 0.7 : DRAW_TIME[kindOf(g.id)] * 0.82;
    this.reloadT = 0;
    this.charge = 0;
    this.spin = 0;
    this.burstLeft = 0;
    this.pushHud();
  }

  private def(): MarkerDef | null {
    const g = this.guns[this.slot];
    return g ? MARKER_BY_ID[g.id] : null;
  }

  private reload(): void {
    const d = this.def();
    const g = this.guns[this.slot];
    if (!d || !g || d.melee || this.reloadT > 0 || g.mag >= d.mag || g.reserve <= 0) return;
    this.reloadT = d.reload;
    this.cueU = 0;
    this.vmMove = null;
    this.burstLeft = 0;
    this.charge = 0;
    sfx.reload();
    this.pushHud();
  }

  private shoot(d: MarkerDef, charge = 0): void {
    const g = this.guns[this.slot]!;
    g.mag--;
    this.camera.updateMatrixWorld();
    const f = new THREE.Vector3();
    this.camera.getWorldDirection(f);
    // The charge leaves the muzzle but flies to where the crosshair points.
    const eye = this.camera.position.clone();
    this.vmRoot.updateMatrixWorld(true);
    const muzzle = this.vm!.muzzle2 && this.barrel++ % 2 ? this.vm!.muzzle2 : this.vm!.muzzle;
    const from = muzzle.getWorldPosition(new THREE.Vector3()).applyMatrix4(this.camera.matrixWorld);
    this.fireK = 1;
    this.shots++;
    muzzle.add(this.vmFlash);
    this.vmFlash.visible = true;
    this.vmFlash.rotation.z = Math.random() * Math.PI;
    this.vmFlash.scale.setScalar((0.7 + Math.random() * 0.5) * (d.kick > 0.04 ? 1.5 : d.mode === "stream" ? 0.5 : 1));
    this.vmFlashT = 0.05;
    const hit = this.world.castRay(new RAPIER.Ray(eye, f), 200, true, undefined, undefined, this.me.collider);
    const far = eye.clone().addScaledVector(f, hit ? Math.max(4, hit.timeOfImpact) : 60);
    const dir = far.sub(from).normalize();
    // Arcing weapons are aimed a touch high so the crosshair stays honest at mid range.
    dir.y += (9.8 * d.gravity * 12) / (d.speed * d.speed);
    const moving = Math.hypot(this.vel.x, this.vel.z) > 3 ? 1.5 : 1;
    this.paint.shoot(this.me, d, from, dir.normalize(), (this.aiming ? 0.5 : 1) * moving * (this.grounded ? 1 : 1.8), charge);
    sfx.gun(d.id, 0.9);
    const kick = d.kick * (this.aiming ? 0.7 : 1);
    this.kick += kick;
    this.yaw += (Math.random() - 0.5) * kick * 0.5;
    // A shove, not a jump: the spring in the wrists takes it up and brings the weapon back past centre.
    this.recoilV += 8 + d.kick * 70;
    if (this.vmMove?.kind === "inspect") this.vmMove = null;
    useArena.setState({ mag: g.mag });
  }

  /** A strike lands: whoever is closest in front and in reach takes it; a wall rings. */
  private strike(d: MarkerDef, heavy: boolean): void {
    const eye = this.camera.position;
    const f = this.camera.getWorldDirection(new THREE.Vector3());
    const reach = d.melee!.range + (heavy ? 0.25 : 0);
    let best: Actor | null = null;
    let bestD = reach + 0.5;
    for (const a of [...this.bodies, ...this.boards] as Actor[]) {
      if (a === this.me || !a.alive || a.protect > 0 || (this.mode.teams && a.team === this.me.team)) continue;
      const to = a.chest(new THREE.Vector3()).sub(eye);
      const dist = to.length();
      if (dist > bestD || to.dot(f) / dist < 0.7) continue;
      if (dist > 0.6 && this.world.castRay(new RAPIER.Ray(eye, to.clone().multiplyScalar(1 / dist)), dist - 0.4, true, undefined, undefined, undefined, undefined, (c) => !this.byHandle.has(c.handle))) continue;
      best = a;
      bestD = dist;
    }
    if (best) {
      // From behind it is worse.
      const yaw = (best as Body).yaw;
      const behind = this.bots.includes(best as Bot) && Math.sin(yaw) * f.x + Math.cos(yaw) * f.z > 0.45;
      const dmg = (heavy ? d.melee!.heavy : d.dmg) * (behind ? (heavy ? 3 : 1.5) : 1);
      const at = best.chest(new THREE.Vector3());
      best.hurt(this.me, Math.round(dmg), d.name, false);
      sfx.stab();
      for (let i = 0; i < 7; i++) this.puffs.emit(at, new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).multiplyScalar(5), 0.3, 0.07, best.color, 2);
      this.kick += heavy ? 0.05 : 0.025;
      return;
    }
    const wall = this.world.castRayAndGetNormal(new RAPIER.Ray(eye, f), reach * 0.85, true, undefined, undefined, undefined, undefined, (c) => !this.byHandle.has(c.handle));
    if (wall) {
      const at = eye.clone().addScaledVector(f, wall.timeOfImpact);
      sfx.clank();
      for (let i = 0; i < 5; i++) this.puffs.emit(at, new THREE.Vector3(wall.normal.x + Math.random() - 0.5, wall.normal.y + Math.random(), wall.normal.z + Math.random() - 0.5).multiplyScalar(3), 0.22, 0.04, 0xfff3c2, 1.5);
    }
  }

  /** The blade in hand: quick slashes on the left button, a heavy strike on the right, F to look it over. */
  private updateKnife(dt: number, d: MarkerDef): void {
    const vm = this.vm!;
    this.cooldown -= dt;
    this.swapT = Math.max(0, this.swapT - dt);
    this.vmFlash.visible = false;
    this.clock += dt;
    this.kFire *= Math.exp(-7 * dt);
    this.recoil *= Math.exp(-13 * dt);
    const acting = useArena.getState().action !== null;
    const ready = this.me.alive && this.phase !== "freeze" && !this.buyOpen && !acting;
    let m = this.kMove;
    if (m) {
      m.t += dt;
      const u = m.t / m.dur;
      if (!m.hit && u >= HIT_AT[m.heavy ? "heavy" : "slash"]) {
        m.hit = true;
        this.strike(d, m.heavy);
      }
      if (u >= 1) m = this.kMove = null;
    }
    const striking = !!m && (m.kind === "slash" || m.kind === "heavy");
    if (ready && this.cooldown <= 0 && !striking && (this.trigger || this.pressed || this.altPressed)) {
      const heavy = this.altPressed && !this.pressed && !this.trigger;
      this.kCut = (this.kCut + 1) % 3;
      this.kSide = this.kCut === 2 ? 0 : this.kCut === 0 ? 1 : -1;
      m = this.kMove = { kind: heavy ? "heavy" : "slash", t: 0, dur: heavy ? MOVE_TIME.heavy : Math.max(0.3, Math.min(MOVE_TIME.slash, 55 / d.rpm)), side: this.kSide, hit: false, heavy };
      this.cooldown = heavy ? 0.95 : 60 / d.rpm;
      this.kFire = 1;
      sfx.slash(heavy);
    }
    if (this.keys.has("KeyF") && ready && !m) {
      m = this.kMove = { kind: "inspect", t: 0, dur: MOVE_TIME.inspect, side: 1, hit: true, heavy: false };
      sfx.flick();
    }
    this.pressed = false;
    this.altPressed = false;

    const speed = Math.hypot(this.vel.x, this.vel.z);
    const sprint = this.keys.has("ShiftLeft") && this.keys.has("KeyW");
    const ease = (rate: number) => 1 - Math.exp(-rate * dt);
    this.sprintK += ((sprint && speed > 6 && this.grounded ? 1 : 0) - this.sprintK) * ease(9);
    this.swayX *= Math.exp(-9 * dt);
    this.swayY *= Math.exp(-9 * dt);
    this.landK *= Math.exp(-7 * dt);
    const run = this.sprintK * (striking ? 0 : 1);
    const walk = Math.min(1, speed / 5.6) * (this.grounded ? 1 : 0.15);
    const hold = HOLD[d.id] ?? HOLD.k_combat;
    const u = m ? Math.min(1, m.t / m.dur) : 0;
    const p = knifePose(d.id, m?.kind ?? null, u, m?.side ?? 1, this.clock);
    const swap = 0;
    this.throwK *= Math.exp(-6 * dt);
    this.vmRoot.position.set(
      0.17 + p.x + Math.cos(this.bob) * (0.008 + 0.03 * run) * walk + this.swayX,
      -0.15 + hold.y + p.y - Math.abs(Math.sin(this.bob)) * (0.012 + 0.03 * run) * walk - run * 0.04 + this.swayY - this.landK * 0.06 - swap * 0.3 - this.throwK * 0.28 - (acting ? 0.25 : 0) + Math.sin(this.clock * 1.6) * 0.004,
      -0.42 + hold.z + p.z + run * 0.03,
    );
    this.vmRoot.rotation.set(p.pitch + run * 0.25 - this.swayY * 2, p.yaw + run * 0.3 + this.swayX * 2.5, p.roll + Math.sin(this.bob) * 0.07 * run * walk - this.strafeK * 0.05 + Math.sin(this.clock * 1.1) * 0.015);
    vm.group.rotation.set(hold.tilt, hold.turn, hold.flat + p.spin);
    this.vmRoot.visible = this.me.alive;
    const looking = m?.kind === "inspect" ? u : 0;
    vm.anim?.({ t: this.clock, fire: this.kFire, shots: 0, charge: looking, spin: m?.kind === "draw" ? 1 - u : 0, ammo: 1 });
    sfx.loop("charge", d.id === "k_saber" && this.me.alive ? 0.12 + this.kFire * 0.2 : 0);
    sfx.loop("spin", d.id === "k_ripper" && this.me.alive ? 0.12 + this.kFire * 0.7 + (looking > 0.2 && looking < 0.8 ? 0.6 : 0) : 0);
    sfx.loop("stream", 0);
    if (Math.abs(this.camera.fov - BASE_FOV) > 0.05) {
      this.camera.fov += (BASE_FOV - this.camera.fov) * ease(16);
      this.camera.updateProjectionMatrix();
    }
    const st = useArena.getState();
    if (st.scoped || st.charge > 0) useArena.setState({ scoped: false, charge: 0 });
  }

  private updateWeapon(dt: number): void {
    const d = this.def();
    const g = this.guns[this.slot];
    if (!d || !g || !this.vm) return;
    if (d.melee) return this.updateKnife(dt, d);
    this.cooldown -= dt;
    this.swapT = Math.max(0, this.swapT - dt);
    this.vmFlashT -= dt;
    if (this.vmFlashT <= 0) this.vmFlash.visible = false;
    const acting = useArena.getState().action !== null;
    const ready = this.me.alive && this.swapT <= 0 && this.phase !== "freeze" && !this.buyOpen && !acting;
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) {
        const take = Math.min(d.mag - g.mag, g.reserve);
        g.mag += take;
        if (g.reserve < 9000) g.reserve -= take;
        this.pushHud();
      }
    } else if (ready) {
      if (g.mag <= 0 && (this.trigger || this.burstLeft > 0)) {
        if (g.reserve > 0) this.reload();
        else if (this.pressed) sfx.empty();
      } else if (d.mode === "charge") {
        if (this.trigger) this.charge = Math.min(1, this.charge + dt / 1.1);
        else if (this.charge > 0) {
          if (this.cooldown <= 0) {
            this.shoot(d, this.charge);
            this.cooldown = 60 / d.rpm;
          }
          this.charge = 0;
        }
      } else if (d.mode === "spin") {
        this.spin = Math.max(0, Math.min(1, this.spin + (this.trigger ? dt / 0.7 : -dt / 0.5)));
        if (this.trigger && this.spin > 0.35 && this.cooldown <= 0) {
          this.shoot(d);
          this.cooldown = 60 / (d.rpm * this.spin);
        }
      } else if (d.mode === "burst") {
        if (this.pressed && this.burstLeft === 0 && this.cooldown <= 0) this.burstLeft = d.burst ?? 3;
        if (this.burstLeft > 0 && this.cooldown <= 0) {
          this.shoot(d);
          this.burstLeft--;
          this.cooldown = this.burstLeft > 0 ? 60 / d.rpm : 0.3;
        }
      } else if (this.cooldown <= 0 && (d.mode === "semi" ? this.pressed : this.trigger)) {
        this.shoot(d);
        this.cooldown = 60 / d.rpm;
      }
    }
    if (!this.trigger && d.mode === "spin") this.spin = Math.max(0, this.spin - dt / 0.5);
    this.pressed = false;

    // Pose of the view model.
    const zoom = this.aiming && !!d.zoom;
    const scoped = zoom && d.zoom! < 30;
    const sprint = this.keys.has("ShiftLeft") && this.keys.has("KeyW") && !this.aiming;
    const speed = Math.hypot(this.vel.x, this.vel.z);
    this.recoilV += (-190 * this.recoil - 24 * this.recoilV) * dt;
    this.recoil = Math.max(-0.3, Math.min(1.3, this.recoil + this.recoilV * dt));
    const ease = (rate: number) => 1 - Math.exp(-rate * dt);
    this.sprintK += ((sprint && speed > 6 && this.grounded ? 1 : 0) - this.sprintK) * ease(9);
    this.swayX *= Math.exp(-9 * dt);
    this.swayY *= Math.exp(-9 * dt);
    this.landK *= Math.exp(-7 * dt);
    this.throwK *= Math.exp(-6 * dt);
    // What the hands are doing with the weapon: drawing it, reloading it, turning it over.
    const kind = kindOf(d.id);
    if (this.vmMove) {
      this.vmMove.t += dt;
      if (this.vmMove.t >= this.vmMove.dur) this.vmMove = null;
    }
    if (this.keys.has("KeyF") && ready && !this.vmMove && this.reloadT <= 0 && !this.trigger) {
      this.vmMove = { kind: "inspect", t: 0, dur: INSPECT_TIME };
      sfx.flick();
    }
    let p: GunPose;
    if (this.reloadT > 0) {
      const u = 1 - this.reloadT / d.reload;
      p = reloadPose(kind, u);
      const cues = RELOAD_CUES[kind];
      const passed = (list: number[]) => list.some((at) => this.cueU < at && u >= at);
      if (passed(cues.out)) sfx.magOut();
      if (passed(cues.in)) sfx.magIn();
      if (passed(cues.rack)) sfx.rack();
      this.cueU = u;
    } else if (this.vmMove) {
      const u = this.vmMove.t / this.vmMove.dur;
      p = this.vmMove.kind === "draw" ? drawPose(kind, u) : inspectPose(kind, u, this.clock);
      if (p.rack > 0.5 && !this.racked) sfx.rack();
      this.racked = p.rack > 0.5;
    } else p = drawPose(kind, 1);
    const run = this.sprintK * (this.reloadT > 0 || this.vmMove ? 0.3 : 1);
    // Each step swings the weapon across and dips it: a little at a walk, a lot at a run.
    const walk = Math.min(1, speed / 5.6) * (this.grounded ? 1 : 0.15) * (this.aiming ? 0.15 : 1);
    const swing = Math.cos(this.bob) * (0.006 + 0.024 * run) * walk;
    const dipStep = Math.abs(Math.sin(this.bob)) * (0.01 + 0.028 * run) * walk;
    const dip = acting ? 1 : 0;
    const aimK = this.aiming ? 1 : 0;
    this.vmRoot.position.set(
      0.23 - aimK * 0.13 + swing + this.swayX - run * 0.035 + p.x,
      -0.25 + aimK * 0.07 - dipStep - dip * 0.2 - this.throwK * 0.28 - run * 0.05 + this.swayY - this.landK * 0.06 + Math.max(-0.03, Math.min(0.03, this.vy * 0.004)) + p.y + Math.sin(this.clock * 1.5) * 0.0025,
      -0.6 + this.recoil * 0.075 + this.charge * 0.03 + run * 0.05 + p.z,
    );
    // Running, the weapon comes down and across the body; it rolls with each stride and with a sidestep.
    this.vmRoot.rotation.set(
      this.recoil * 0.12 - dip * 0.8 + 0.03 + run * 0.2 - this.swayY * 2 + p.pitch,
      (0.09 + run * 0.5) * (1 - aimK) + this.swayX * 2.5 + Math.cos(this.bob) * 0.035 * run * walk + p.yaw,
      dip * 0.3 + run * 0.2 + Math.sin(this.bob) * 0.06 * run * walk - this.strafeK * 0.05 * (1 - aimK) + (Math.random() - 0.5) * this.spin * 0.012 + p.roll + this.recoilV * 0.004,
    );
    // The supporting hand goes where the job is: the magazine well, the action, or off to fetch a magazine.
    const A = this.arms;
    if (A?.left) {
      const heavy = kind === "heavy";
      const sum = Math.max(1, p.well + p.action + p.away);
      const w = p.well / sum;
      const ac = p.action / sum;
      const aw = p.away / sum;
      const on = 1 - w - ac - aw;
      // A magazine is taken from below; the heavy ones are loaded from the top, palm down.
      const G = A.grab;
      const back = (heavy ? 0.09 : -0.085) * p.pull;
      const wx = heavy ? 0 : G.x, wy = heavy ? -0.1 : G.y + back, wz = heavy ? -0.1 : G.z;
      const ax = heavy ? G.x : -0.045, ay = heavy ? G.y + back : 0.06, az = heavy ? G.z : 0.01;
      // Away is down out of sight; with something bulky off the top, out to the side instead.
      A.left.position.set(
        A.rest.x * on + wx * w + ax * ac + (heavy ? -0.55 : -0.16) * aw,
        A.rest.y * on + wy * w + ay * ac + (heavy ? -0.1 : -0.52) * aw,
        A.rest.z * on + wz * w + az * ac + (heavy ? 0.12 : 0.14) * aw,
      );
      // The forearm always runs back to an elbow that stays put beside the body, so however the
      // weapon is turned the arm comes in from the lower left; the hand rolls over to work on top.
      this.vmRoot.updateMatrix();
      const elbow = V1.copy(this.elbow);
      elbow.y -= aw * 0.45;
      // Reaching over the top, the arm comes round from the side rather than up through the view.
      if (heavy) elbow.set(elbow.x - ac * 0.24, elbow.y - ac * 0.06, elbow.z - ac * 0.12);
      elbow.applyMatrix4(M1.copy(this.vmRoot.matrix).invert());
      const turn = heavy ? Math.PI * ac : -1.1 * ac;
      aimHand(A.left.position, elbow, turn, A.left.quaternion);
      if (A.item) A.item.visible = p.mag;
      // The feed goes with the hand that took it, and is back in the weapon when the hand lets go.
      const F = this.vm.mag;
      if (F) {
        if (p.mag) {
          // A magazine turns by as much as the hand has turned since it took hold; a tank is kept level.
          if (heavy) F.quaternion.identity();
          else F.quaternion.copy(A.left.quaternion).multiply(aimHand(G, elbow, 0, Q1).invert());
          F.position.copy(A.seat).sub(G).applyQuaternion(F.quaternion).add(A.left.position);
        } else {
          F.position.copy(A.seat);
          F.quaternion.identity();
        }
      }
    }
    sfx.loop("charge", d.mode === "charge" && ready ? this.charge : 0);
    sfx.loop("spin", d.mode === "spin" && this.me.alive ? this.spin : 0);
    sfx.loop("stream", d.mode === "stream" && this.trigger && ready && g.mag > 0 && this.reloadT <= 0 ? 1 : 0);
    this.vmRoot.visible = this.me.alive && !scoped;
    if (this.vm.spin) this.vm.spin.rotation.z += dt * this.spin * 30;
    this.clock += dt;
    this.fireK *= Math.exp(-(d.rpm > 500 ? 22 : d.rpm > 150 ? 9 : 3.2) * dt);
    this.vm.anim?.({ t: this.clock, fire: this.fireK, shots: this.shots, charge: this.charge, spin: this.spin, ammo: this.reloadT > 0 ? Math.max(0, (1 - this.reloadT / d.reload - 0.58) / 0.42) : g.mag / d.mag, rack: p.rack });
    if (this.vm.glow) {
      for (const gl of this.vm.glow) {
        const m = gl.material as THREE.MeshStandardMaterial;
        if (m.emissiveIntensity !== undefined && d.mode === "charge") m.emissiveIntensity = 0.5 + this.charge * 3.5;
      }
    }
    const fov = zoom ? d.zoom! : this.aiming ? 62 : sprint ? BASE_FOV + 5 : BASE_FOV;
    if (Math.abs(this.camera.fov - fov) > 0.05) {
      this.camera.fov += (fov - this.camera.fov) * (1 - Math.exp(-16 * dt));
      this.camera.updateProjectionMatrix();
    }
    const st = useArena.getState();
    const charge = d.mode === "charge" ? this.charge : d.mode === "spin" ? this.spin : 0;
    if (st.scoped !== scoped || Math.abs(st.charge - charge) > 0.02) useArena.setState({ scoped, charge });
  }

  // -------------------------------------------------------------------------------------------
  // Input

  private get locked(): boolean {
    return this.noLock || document.pointerLockElement === this.canvas;
  }

  private bindInput(): void {
    const on = <K extends keyof DocumentEventMap>(target: Document | Window | HTMLElement, type: K, fn: (e: DocumentEventMap[K]) => void) => {
      target.addEventListener(type, fn as EventListener);
      this.cleanup.push(() => target.removeEventListener(type, fn as EventListener));
    };
    on(window, "keydown", (e) => {
      if (this.over) return;
      if (e.code === "Tab") {
        e.preventDefault();
        if (!e.repeat) useArena.setState({ showBoard: true });
        return;
      }
      if (e.code === "KeyB" && !e.repeat) {
        if (this.buyOpen) this.closeBuy();
        else if (this.locked) this.openBuy();
        return;
      }
      if (this.buyOpen && e.code === "Escape") return this.closeBuy();
      if (this.picking) {
        if (e.code === "Digit1") this.chooseTeam("attack");
        else if (e.code === "Digit2") this.chooseTeam("defend");
        else if (e.code === "Digit3" || e.code === "Space") this.chooseTeam("auto");
        else if (e.code === "KeyM" || e.code === "Escape") this.closeTeams();
        return;
      }
      if (e.code === "KeyM" && !e.repeat && this.locked) return this.openTeams();
      if (!this.locked || e.repeat || this.buyOpen) return;
      if (e.code === "Space") e.preventDefault();
      this.keys.add(e.code);
      const nade = { Digit4: "flash", Digit5: "smoke", Digit6: "fire" }[e.code] as NadeKind | undefined;
      if (nade) this.useNade(nade);
      const digit = /^Digit([123])$/.exec(e.code);
      if (digit && this.guns[Number(digit[1]) - 1] && Number(digit[1]) - 1 !== this.slot) this.equip(Number(digit[1]) - 1);
      if (e.code === "KeyQ" && this.guns[this.lastSlot] && this.lastSlot !== this.slot) this.equip(this.lastSlot);
      if (e.code === "KeyR") this.reload();
      if (e.code === "KeyE" && this.near && this.dropHint && useArena.getState().hint === this.dropHint) this.pickUp(this.near);
      if (e.code === "KeyG" && this.bomb.carrier === this.me && this.me.alive && this.phase === "live") {
        const t = this.me.collider.translation();
        this.drop(this.v.set(t.x - Math.sin(this.yaw) * 1.6, 0, t.z - Math.cos(this.yaw) * 1.6));
        this.noPickT = 2;
        this.pushHud();
      }
    });
    on(window, "keyup", (e) => {
      this.keys.delete(e.code);
      if (e.code === "Tab") useArena.setState({ showBoard: false });
    });
    on(document, "mousemove", (e) => {
      if (!this.locked || this.over || this.buyOpen || !this.me.alive) return;
      if (Math.abs(e.movementX) > 400 || Math.abs(e.movementY) > 400) return;
      const sens = 0.0022 * useStore.getState().settings.sens * (this.camera.fov / BASE_FOV);
      this.yaw -= e.movementX * sens;
      this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch - e.movementY * sens));
      // The weapon lags a moment behind the turn.
      this.swayX = Math.max(-0.035, Math.min(0.035, this.swayX - e.movementX * 0.00004));
      this.swayY = Math.max(-0.03, Math.min(0.03, this.swayY + e.movementY * 0.00004));
    });
    // Sound may only start from a touch; some phones count the finger lifting, not landing.
    on(window, "pointerdown" as keyof DocumentEventMap, () => sfx.unlock());
    on(window, "touchend" as keyof DocumentEventMap, () => sfx.unlock());
    on(this.canvas, "mousedown", (e) => {
      sfx.unlock();
      // Fingers have their own buttons; a tap that reaches the picture is not a shot.
      if (TOUCH) return;
      if (!this.locked) return this.lock();
      if (e.button === 0) {
        this.trigger = true;
        this.pressed = true;
      } else if (e.button === 2) {
        this.aiming = true;
        this.altPressed = true;
      }
    });
    on(window, "mouseup" as keyof DocumentEventMap, (e) => {
      const b = (e as MouseEvent).button;
      if (b === 0) this.trigger = false;
      else if (b === 2) this.aiming = false;
    });
    on(this.canvas, "contextmenu", (e) => e.preventDefault());
    on(this.canvas, "wheel", () => {
      if (!this.locked) return;
      for (let i = 1; i <= 2; i++) {
        const next = (this.slot + i) % 3;
        if (this.guns[next]) return this.equip(next);
      }
    });
    on(document, "pointerlockchange", () => {
      if (!this.locked) {
        this.keys.clear();
        this.trigger = false;
        this.aiming = false;
      }
      useArena.setState({ paused: !this.locked && !this.over && !this.buyOpen && !this.picking });
    });
    on(window, "resize" as keyof DocumentEventMap, () => this.resize());
  }

  lock(): void {
    if (this.halted) {
      this.halted = false;
      useArena.setState({ paused: false });
    }
    if (this.over || this.noLock) return;
    sfx.unlock();
    void Promise.resolve(this.canvas.requestPointerLock()).catch(() => {});
    setTimeout(() => {
      if (!this.locked && !this.over && !this.buyOpen && !this.picking) useArena.setState({ paused: true });
    }, 400);
  }

  private resize(): void {
    const w = this.canvas.clientWidth || innerWidth;
    const h = this.canvas.clientHeight || innerHeight;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, LIGHT ? 1.5 : 2));
    this.renderer.setSize(w, h, false);
    for (const cam of [this.camera, this.vmCamera]) {
      cam.aspect = w / h;
      cam.updateProjectionMatrix();
    }
  }

  // -------------------------------------------------------------------------------------------
  // Loop

  private render(): void {
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    this.renderer.clearDepth();
    this.renderer.render(this.vmScene, this.vmCamera);
  }

  start(): void {
    this.last = performance.now();
    const frame = (now: number) => {
      this.raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      // Whatever is in the air keeps moving, paused or not.
      this.map.tick?.(dt, this.camera.position);
      if (this.picking && this.pickFirst) this.overview(now);
      else if ((this.locked || this.buyOpen || this.picking) && !this.over && !this.halted) this.update(dt);
      this.render();
    };
    this.raf = requestAnimationFrame(frame);
  }

  // -------------------------------------------------------------------------------------------
  // Touch: what the on-screen controls call.

  /** The stick: how far it is pushed, -1..1 each way; up is forward. */
  touchStick(x: number, y: number): void {
    this.stick.x = x;
    this.stick.y = y;
  }

  /** A finger dragged across the picture turns the view, by that many pixels. */
  touchLook(dx: number, dy: number): void {
    if (this.over || this.buyOpen || this.picking || this.halted || !this.me.alive) return;
    const s = useStore.getState().settings;
    const sens = 0.0058 * (s.touchSens ?? 1) * (this.camera.fov / BASE_FOV);
    this.yaw -= dx * sens;
    this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch - dy * sens));
    this.swayX = Math.max(-0.035, Math.min(0.035, this.swayX - dx * 0.00009));
    this.swayY = Math.max(-0.03, Math.min(0.03, this.swayY + dy * 0.00009));
  }

  touchFire(down: boolean): void {
    this.fireHeld = down;
    this.trigger = down || this.autoOn;
    if (down) this.pressed = true;
  }

  /** The aim button: holds the sights up until pressed again; with a blade, the heavy strike. */
  touchAim(): void {
    if (this.def()?.melee) this.altPressed = true;
    else this.aiming = !this.aiming;
  }

  /** Holds the match on the pause screen; `lock` lets it go. */
  pause(): void {
    if (this.over || this.picking) return;
    if (this.buyOpen) this.closeBuy(false);
    this.halted = true;
    this.keys.clear();
    this.stick.x = this.stick.y = 0;
    this.trigger = this.fireHeld = false;
    useArena.setState({ paused: true });
  }

  /**
   * Fires by itself while the sights are on an enemy: on a phone one thumb moves and the other aims,
   * and there is none left for the trigger. The fire button still works, and this can be turned off.
   */
  private autoFire(dt: number): void {
    const s = useStore.getState().settings;
    const d = this.def();
    this.autoT -= dt;
    if (this.autoT <= 0) {
      this.autoT = 0.06;
      let on = false;
      if ((s.autoFire ?? true) && d && this.me.alive && this.phase !== "freeze" && this.phase !== "end" && !this.buyOpen && !this.picking) {
        const eye = this.camera.position;
        const f = this.camera.getWorldDirection(this.v2);
        const reach = d.melee ? d.melee.range + 0.5 : d.pellets > 3 ? 18 : 75;
        for (const a of [...this.bots, ...this.boards] as Actor[]) {
          if (!a.alive || a.protect > 0 || (this.mode.teams && a.team === this.me.team)) continue;
          const to = a.chest(this.v).sub(eye);
          const dist = to.length();
          if (dist > reach) continue;
          const along = to.dot(f);
          if (along <= 0) continue;
          // Within half a body's width of where the sights point, and nothing in between.
          const off = Math.sqrt(Math.max(0, dist * dist - along * along));
          if (off > (d.melee ? 0.9 : 0.42 + dist * 0.004)) continue;
          if (this.sees(this.me, a)) {
            on = true;
            break;
          }
        }
      }
      this.autoOn = on;
    }
    if (!this.autoOn) {
      if (!this.fireHeld) this.trigger = false;
      return;
    }
    // A weapon that charges is held until it is full, then let go.
    if (d?.mode === "charge") this.trigger = this.fireHeld || this.charge < 0.98;
    else {
      this.trigger = true;
      if (this.cooldown <= 0) this.pressed = true;
    }
  }

  /** Before a side is chosen: the map from above, turning slowly. */
  private overview(now: number): void {
    const a = now * 0.00006;
    const r = Math.max(this.map.half[0], this.map.half[1]) * 1.25;
    this.camera.position.set(Math.cos(a) * r, r * 0.8, Math.sin(a) * r);
    this.camera.lookAt(0, 0, 0);
    this.vmRoot.visible = false;
  }

  /** Advance the match by hand: used by automated checks. */
  tick(seconds: number): void {
    for (let t = 0; t < seconds && !this.over; t += 1 / 60) this.update(1 / 60);
    this.render();
  }

  /** Dead in a round with no respawns: watch a teammate from over the shoulder. */
  private spectate(dt: number): void {
    if (!this.spec || !this.spec.alive) {
      this.spec = this.bots.find((b) => b.alive && b.team === this.me.team) ?? this.bots.find((b) => b.alive) ?? null;
      useArena.setState({ spectating: this.spec?.name ?? "" });
    }
    const s = this.spec;
    if (!s) return;
    const head = s.chest(this.v).clone();
    head.y += 0.6;
    const back = new THREE.Vector3(-Math.sin(s.yaw), 0, -Math.cos(s.yaw));
    const hit = this.world.castRay(new RAPIER.Ray(head, back), 3, true, undefined, undefined, undefined, undefined, (c) => !this.byHandle.has(c.handle));
    const d = Math.max(0.6, (hit ? Math.min(3, hit.timeOfImpact) : 3) - 0.3);
    const want = head.clone().addScaledVector(back, d);
    want.y += 0.5;
    this.camera.position.lerp(want, 1 - Math.exp(-10 * dt));
    this.camera.lookAt(head.x - back.x * 6, head.y - 0.2, head.z - back.z * 6);
  }

  private updateMe(dt: number): void {
    const me = this.me;
    if (!me.alive) {
      if (this.respawns) {
        me.respawnT -= dt;
        if (me.respawnT <= 0) {
          this.refill();
          me.money = Math.min(MAX_MONEY, me.money + 300);
          this.placeMe(this.spawnFor(me), 1.5);
          this.buyT = 12;
          this.equip(this.guns[0] ? 0 : 1);
        } else {
          if (Math.ceil(me.respawnT * 10) !== Math.ceil((me.respawnT + dt) * 10)) useArena.setState({ respawn: Math.max(0.01, me.respawnT) });
          const at = this.fellAt;
          if (at) {
            // Pulled back and up, as far as the walls allow.
            const back = this.v.set(Math.sin(this.yaw), 0.75, Math.cos(this.yaw)).normalize();
            const from = this.v2.set(at.x, at.y + 0.9, at.z);
            const hit = this.world.castRay(new RAPIER.Ray(from, back), 4, true, undefined, undefined, undefined, undefined, (c) => !this.byHandle.has(c.handle));
            const d = Math.max(0.8, (hit ? hit.timeOfImpact : 4) - 0.3);
            this.camera.position.lerp(from.addScaledVector(back, d), 1 - Math.exp(-4 * dt));
            this.camera.lookAt(at.x, at.y + 0.5, at.z);
          }
        }
      } else this.spectate(dt);
      return;
    }
    me.protect -= dt;
    const k = this.keys;
    const held = this.phase === "freeze" || this.buyOpen || useArena.getState().action !== null;
    // Keys, or the stick: pushed all the way forward, the stick runs.
    const push = Math.hypot(this.stick.x, this.stick.y);
    const f = held ? 0 : (k.has("KeyW") ? 1 : 0) - (k.has("KeyS") ? 1 : 0) - this.stick.y;
    const r = held ? 0 : (k.has("KeyD") ? 1 : 0) - (k.has("KeyA") ? 1 : 0) + this.stick.x;
    const sprint = (k.has("ShiftLeft") || (push > 0.92 && -this.stick.y > 0.75)) && f > 0 && !this.aiming;
    // A blade is light: no slowing down to aim, and a little faster on the feet.
    const blade = !!this.def()?.melee;
    const max = (sprint ? 7.6 : this.aiming && !blade ? 3.6 : 5.6) * (blade ? 1.1 : 1);
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    let dx = -sin * f + cos * r;
    let dz = -cos * f - sin * r;
    const len = Math.hypot(dx, dz);
    if (len > 0) {
      // A stick pushed part of the way walks slowly.
      const pace = max * (push > 0 ? Math.min(1, Math.max(0.35, push)) : 1);
      dx = (dx / len) * pace;
      dz = (dz / len) * pace;
    }
    const accel = 1 - Math.exp(-(this.grounded ? 16 : 4) * dt);
    this.vel.x += (dx - this.vel.x) * accel;
    this.vel.z += (dz - this.vel.z) * accel;
    if (this.grounded && this.vy < 0) this.vy = -1;
    if (this.grounded && k.has("Space") && !held) this.vy = 7.4;
    this.vy -= 22 * dt;
    this.ctrl.computeColliderMovement(me.collider, { x: this.vel.x * dt, y: this.vy * dt, z: this.vel.z * dt }, undefined, undefined, (c) => !this.byHandle.has(c.handle));
    const m = this.ctrl.computedMovement();
    this.grounded = this.ctrl.computedGrounded();
    if (this.grounded && !this.wasGrounded && this.vy < -6) {
      this.landK = 1;
      sfx.land();
      const at = me.collider.translation();
      this.puffs.kick(at.x, at.y - CENTER, at.z, 6, this.dust, 0.1);
    }
    this.wasGrounded = this.grounded;
    this.strafeK += (r - this.strafeK) * (1 - Math.exp(-8 * dt));
    const t = me.collider.translation();
    const y = Math.max(CENTER, t.y + m.y);
    me.collider.setTranslation({ x: t.x + m.x, y, z: t.z + m.z });
    me.velocity.set(m.x / dt, 0, m.z / dt);
    const speed = Math.hypot(m.x, m.z) / dt;
    if (this.grounded && speed > 1) this.bob += speed * dt * 1.5;
    // One footfall every half turn of the bob.
    const stepN = Math.floor(this.bob / Math.PI);
    if (stepN !== this.stepN) {
      this.stepN = stepN;
      if (this.grounded && speed > 1.5) sfx.foot(sprint ? 0.55 : 0.32, stepN % 2 ? 0.12 : -0.12);
    }
    this.kick *= Math.exp(-10 * dt);
    this.camera.position.set(t.x + m.x, y + EYE + (this.grounded ? Math.sin(this.bob * 2) * 0.03 * Math.min(1, speed / 5) : 0) - this.landK * 0.09, t.z + m.z);
    this.camera.rotation.set(Math.max(-1.55, Math.min(1.55, this.pitch + this.kick)), this.yaw, -this.strafeK * 0.014, "YXZ");
  }

  private update(dt: number): void {
    this.updateRound(dt);
    if (this.over) return;
    this.updateMe(dt);
    this.world.step();
    for (const b of this.bots) b.update(dt);
    if (TOUCH) this.autoFire(dt);
    this.updateDrops(dt);
    this.updateCorpses(dt);
    this.updateBomb(dt);
    this.updateWeapon(dt);
    // What the player can see goes on the radar too.
    this.spotT -= dt;
    if (this.spotT <= 0 && this.me.alive) {
      this.spotT = 0.15;
      const f = this.camera.getWorldDirection(this.v2);
      for (const b of this.bots) {
        if (!b.alive || b.dummy || (this.mode.teams && b.team === this.me.team)) continue;
        const to = b.chest(this.v).sub(this.camera.position);
        const d = to.length();
        if (d < 90 && to.dot(f) / d > 0.45 && this.sees(this.me, b)) b.spot = 2.6;
      }
    }
    this.paint.update(dt);
    this.nades.update(dt);
    this.puffs.update(dt);
    this.nadeT -= dt;
    for (const b of this.boards) b.update(dt);
    if (this.blast) {
      const b = this.blast;
      b.t += dt;
      b.mesh.scale.setScalar(1 + b.t * 34);
      (b.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.9 - b.t * 1.2);
      if (b.t > 0.8) {
        this.scene.remove(b.mesh);
        this.blast = null;
      }
    }
    this.markT -= dt;
    if (this.markT <= 0) {
      this.markT = 1 / 30;
      this.camera.updateMatrixWorld();
      this.pushMarks();
    }
    this.hudT -= dt;
    if (this.hudT <= 0) {
      this.hudT = 0.2;
      this.pushHud();
    }
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.nades.clear();
    sfx.hush();
    for (const fn of this.cleanup) fn();
    if (document.pointerLockElement) document.exitPointerLock();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
    this.world.free();
    if (Arena.current === this) Arena.current = null;
  }
}
