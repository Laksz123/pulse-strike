/**
 * Everything alive that is not the player.
 * Armed humans live only inside the monuments, dressed for the place they guard, each with a leader
 * and, in the ship graveyard, the Captain. The rest of the island belongs to animals: deer that
 * run, boars that charge when crowded, and wolves, crocodiles and panthers that hunt.
 */

import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { skillOf, useStore } from "../store";
import { sfx } from "./audio";
import { bake, vox, type VoxPart } from "./build";
import type { Game } from "./game";
import { rollEnemy, type Species } from "./loot";
import { heightAt, type AnimalKind, type Monument, type MonumentId } from "./world";

export interface SpawnSpec {
  species: Species;
  x: number;
  z: number;
  /** Height above the ground, for guards posted on a structure. */
  y?: number;
  danger: number;
  elite?: boolean;
  /** The monument a human guards: sets the outfit and how far he will stray. */
  post?: Monument;
}

interface Spawn extends SpawnSpec {
  home: THREE.Vector3;
  enemy: Enemy | null;
  respawnAt: number;
}

interface Enemy {
  species: Species;
  spawn: Spawn;
  group: THREE.Group;
  legs: THREE.Object3D[];
  collider: RAPIER.Collider;
  /** Capsule centre above the feet. */
  center: number;
  /** Height above the feet where the head starts. */
  headY: number;
  hp: number;
  maxHp: number;
  bar: THREE.Sprite;
  barBg: THREE.Sprite;
  aggro: boolean;
  hasLos: boolean;
  losT: number;
  /** Seconds until the next shot or bite. */
  attackT: number;
  burst: number;
  wanderT: number;
  wander: THREE.Vector2;
  strafe: number;
  strafeT: number;
  /** Seconds a frightened animal keeps running. */
  fleeT: number;
  yaw: number;
  walk: number;
  /** >= 0 once dead: seconds since death. */
  deadT: number;
}

interface AnimalCfg {
  hp: number;
  run: number;
  walk: number;
  sight: number;
  dmg: number;
  reach: number;
  cooldown: number;
  /** hunt: attacks on sight; neutral: attacks when crowded or hurt; flee: runs. */
  mode: "hunt" | "neutral" | "flee";
  capsule: [number, number];
  center: number;
  top: number;
  xp: number;
}

const ANIMALS: Record<AnimalKind, AnimalCfg> = {
  wolf: { hp: 44, run: 6.6, walk: 1.8, sight: 30, dmg: 10, reach: 1.9, cooldown: 0.9, mode: "hunt", capsule: [0.12, 0.43], center: 0.55, top: 1.25, xp: 14 },
  deer: { hp: 40, run: 8.4, walk: 1.4, sight: 24, dmg: 0, reach: 0, cooldown: 1, mode: "flee", capsule: [0.25, 0.45], center: 0.7, top: 1.95, xp: 10 },
  boar: { hp: 90, run: 6.0, walk: 1.3, sight: 9, dmg: 14, reach: 2.0, cooldown: 1.1, mode: "neutral", capsule: [0.1, 0.5], center: 0.6, top: 1.35, xp: 18 },
  croc: { hp: 150, run: 4.6, walk: 0.7, sight: 13, dmg: 24, reach: 2.5, cooldown: 1.4, mode: "hunt", capsule: [0.02, 0.45], center: 0.47, top: 0.95, xp: 30 },
  panther: { hp: 130, run: 8.6, walk: 1.6, sight: 34, dmg: 20, reach: 2.1, cooldown: 0.8, mode: "hunt", capsule: [0.12, 0.46], center: 0.58, top: 1.35, xp: 60 },
};

/** One model unit: human figures are 30 units tall. */
const U = 0.06;
const barMat = new THREE.SpriteMaterial({ color: 0xd6453d, depthTest: false, fog: false });
const eliteBarMat = new THREE.SpriteMaterial({ color: 0xffc21a, depthTest: false, fog: false });
const barBgMat = new THREE.SpriteMaterial({ color: 0x14110d, depthTest: false, fog: false, transparent: true, opacity: 0.7 });
const any = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

function part(parent: THREE.Object3D, x: number, y: number, z: number, parts: VoxPart[]): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  vox(g, parts);
  parent.add(g);
  return g;
}

/** A figure is dozens of boxes: merge each moving limb, then the body, into a mesh apiece. */
function merge(root: THREE.Group, limbs: THREE.Object3D[]): void {
  for (const limb of limbs) bake(limb);
  bake(root);
}

interface Outfit {
  cloth: number[];
  vest: number;
  pants: number;
  scarf: number[];
  head: "wrap" | "straw" | "hood" | "hardhat" | "helmet";
}

const OUTFITS: Record<MonumentId, Outfit> = {
  sawmill: { cloth: [0x8a4636, 0x6a5e44, 0x7a3a2e], vest: 0x4a3a2a, pants: 0x3b352c, scarf: [0xd9cdb4, 0xb3362a], head: "wrap" },
  village: { cloth: [0x3f7896, 0xe8e0d0, 0x2f6078], vest: 0x27506a, pants: 0x4a4436, scarf: [0xe8e0d0, 0xc9a23f], head: "straw" },
  temple: { cloth: [0x6a1f1f, 0x581a1a], vest: 0x3a1010, pants: 0x2a1414, scarf: [0xd9b44a], head: "hood" },
  mine: { cloth: [0x4a5058, 0x5a5448], vest: 0xe07b28, pants: 0x33363b, scarf: [0x4a4f55], head: "hardhat" },
  graveyard: { cloth: [0x56683f, 0x4b5a3a], vest: 0x36422a, pants: 0x3a4230, scarf: [0x2a331f, 0x56683f], head: "helmet" },
};

/** Models face +Z and stand on the origin. */
function buildHuman(style: MonumentId, danger: number, elite: boolean, boss: boolean): { group: THREE.Group; legs: THREE.Object3D[] } {
  const root = new THREE.Group();
  const g = new THREE.Group();
  g.scale.setScalar(U * (boss ? 1.28 : elite ? 1.12 : 1));
  root.add(g);
  const o = OUTFITS[style];
  const cloth = boss ? 0x1f2f45 : any(o.cloth);
  const pants = boss ? 0x2a2a2e : o.pants;
  const vest = boss ? 0x16233a : o.vest;
  const scarf = boss ? 0x8a8a8a : any(o.scarf);
  const skin = any([0xc49a6c, 0xb0835a, 0xd4aa7c]);
  const body: VoxPart[] = [
    [-4, 12, -2, 8, 11, 4, cloth], [-4.3, 15, -2.3, 8.6, 7, 4.6, vest], [-4.2, 12, -2.2, 8.4, 1.5, 4.4, 0x2a221a], [-1, 12.2, 2.2, 2, 1.2, 0.5, 0xc9a23f],
    [-3, 14, -4.6, 6, 7, 2.4, 0x4a4033], [-3.5, 23, -3.5, 7, 7, 7, skin],
  ];
  const goggles: VoxPart[] = [[-3.2, 26.4, 3.2, 6.4, 1.8, 0.6, 0x1d1f22], [-2.7, 26.6, 3.5, 2.1, 1.4, 0.5, 0xe07b28], [0.6, 26.6, 3.5, 2.1, 1.4, 0.5, 0xe07b28]];
  const eyes: VoxPart[] = [[-2.4, 26.6, 3.3, 1.4, 1.2, 0.4, 0x1d1f22], [1, 26.6, 3.3, 1.4, 1.2, 0.4, 0x1d1f22]];
  if (boss) {
    body.push(
      [-4.6, 5, -2.6, 9.2, 8, 5.2, cloth], [-4.8, 20, -2.8, 9.6, 3, 5.6, cloth], [-5.6, 21, -2.4, 1.6, 2, 4.8, 0xc9a23f], [4, 21, -2.4, 1.6, 2, 4.8, 0xc9a23f],
      [-4, 29.5, -4, 8, 2.4, 8, 0x16233a], [-3.6, 29.5, 3.6, 7.2, 0.8, 2.6, 0x0f1826], [-1, 30.4, 3.9, 2, 1.2, 0.5, 0xc9a23f], [-3, 23, 3.2, 6, 3.2, 0.8, 0x8a8a8a],
      [-0.6, 15, 2.3, 1.2, 6, 0.5, 0xc9a23f], ...goggles,
    );
  } else if (o.head === "wrap") {
    body.push([-3.7, 23, -3.7, 7.4, 3, 7.4, scarf], [-3.8, 28.2, -3.8, 7.6, 2.2, 7.6, scarf], [2, 24, -4.4, 2, 5, 1, scarf], ...goggles);
  } else if (o.head === "straw") {
    body.push([-6, 29.4, -6, 12, 0.8, 12, 0xd9c070], [-3, 30.2, -3, 6, 1.6, 6, 0xc9b060], [-3.7, 23, -3.7, 7.4, 2.4, 7.4, scarf], ...eyes, [-4.1, 16, -2.4, 8.2, 1.2, 4.8, 0xe8e0d0]);
  } else if (o.head === "hood") {
    body.push(
      [-4.2, 22.6, -4.2, 8.4, 8.4, 7.4, cloth], [-3.6, 24, 3, 7.2, 5.4, 0.8, 0xd9b44a], [-2.4, 26.6, 3.7, 1.5, 1.2, 0.4, 0x1d1f22], [0.9, 26.6, 3.7, 1.5, 1.2, 0.4, 0x1d1f22],
      [-4.5, 3, -2.5, 9, 10, 5, cloth], [-0.7, 4, 2.4, 1.4, 16, 0.5, 0xd9b44a],
    );
  } else if (o.head === "hardhat") {
    body.push([-3.9, 28, -3.9, 7.8, 2.6, 7.8, 0xf0c040], [-4.3, 27.8, -4.3, 8.6, 0.8, 9.4, 0xd9a520], [-1, 29, 3.9, 2, 1.6, 0.8, 0xfff3c8], ...eyes, [-4.4, 17, -2.4, 8.8, 1, 4.8, 0xf0f0e0]);
  } else {
    body.push(
      [-3.9, 27.6, -3.9, 7.8, 2.8, 7.8, 0x3c4a2e], [-4.2, 27.4, -4.2, 8.4, 0.8, 8.4, 0x2a331f], [-3.7, 23, -3.7, 7.4, 3, 7.4, scarf], ...goggles,
      [-4.6, 16, -2.6, 2, 5, 5.2, 0x2a331f], [2.6, 16, -2.6, 2, 5, 5.2, 0x2a331f],
    );
  }
  if (elite && !boss) body.push([-4.6, 20, -2.6, 9.2, 2, 5.2, 0xb3362a], [-5.4, 21, -2.2, 1.4, 2, 4.4, 0xb3362a], [4, 21, -2.2, 1.4, 2, 4.4, 0xb3362a]);
  if (danger >= 2 && !boss) body.push([-4.5, 13, -2.5, 9, 0.9, 5, 0xc9a23f]);
  vox(g, body);
  const legs: THREE.Object3D[] = [];
  for (const sx of [-1, 1]) {
    legs.push(part(g, sx * 2, 12, 0, [[-2, -12, -2, 4, 12, 4, pants], [-2.2, -12, -2.4, 4.4, 3, 5.2, 0x1d1a16], [-2.1, -7, -2.2, 4.2, 2, 0.6, 0x4a4033]]));
  }
  // Arms raised to hold the gun.
  const right = part(g, 5.5, 22, 0, [[-1.5, -10, -1.5, 3.4, 10, 3.4, cloth], [-1.4, -11.5, -1.4, 3.2, 2, 3.2, skin]]);
  right.rotation.set(-1.25, -0.25, 0);
  const left = part(g, -5.5, 22, 0, [[-1.9, -10, -1.5, 3.4, 10, 3.4, cloth], [-1.8, -11.5, -1.4, 3.2, 2, 3.2, skin]]);
  left.rotation.set(-1.15, 0.6, 0);
  vox(g, boss
    ? [[2, 18.5, 4, 2, 2.6, 20, 0x1d1f22], [2.4, 19.2, 24, 1.2, 1.2, 8, 0x33363b], [1, 14.5, 9, 4, 4, 4, 0x33363b], [2, 17, 0, 2, 3, 5, 0x8a5a32]]
    : [[2.3, 19, 5, 1.5, 2.2, 13, 0x1d1f22], [2.5, 19.6, 18, 1, 1, 5, 0x33363b], [2.3, 15.5, 9, 1.5, 4, 2.2, 0x33363b], [2.3, 18, 1, 1.5, 2.6, 5, 0x8a5a32]]);
  merge(root, [...legs, right, left]);
  return { group: root, legs };
}

interface Beast {
  len: number;
  w: number;
  h: number;
  leg: number;
  color: number;
  dark: number;
  extra: VoxPart[];
  tail: [number, number];
  legW?: number;
}

const BEASTS: Record<AnimalKind, Beast> = {
  wolf: {
    len: 16, w: 6, h: 6, leg: 7, color: 0x7d7466, dark: 0x4a433a, tail: [6, -0.5],
    extra: [[-2.6, 6.4, -6, 5.2, 1, 12, 0xa89c88], [-3.2, 8, 4, 6.4, 6.4, 5, 0x7d7466], [-2.5, 10, 8, 5, 5, 6, 0x7d7466], [-1.5, 10, 14, 3, 2.6, 3.4, 0x4a433a],
      [-2.5, 15, 9.5, 1.6, 2.2, 1.6, 0x7d7466], [0.9, 15, 9.5, 1.6, 2.2, 1.6, 0x7d7466], [-2.7, 13, 13.4, 0.8, 1, 1, 0xffc21a], [1.9, 13, 13.4, 0.8, 1, 1, 0xffc21a]],
  },
  deer: {
    len: 15, w: 5, h: 6, leg: 11, color: 0xa87848, dark: 0x6b4a2b, tail: [2, 0.6], legW: 1.6,
    extra: [[-2.2, 10.4, -6, 4.4, 1, 12, 0xd8c0a0], [-1.5, 15, 5, 3, 7, 3.4, 0xa87848], [-1.6, 21, 5.5, 3.2, 3.4, 5.4, 0xa87848], [-1, 21, 10.6, 2, 2, 1.6, 0x4a3524],
      [-2.2, 24.2, 6, 1, 2, 1.4, 0xa87848], [1.2, 24.2, 6, 1, 2, 1.4, 0xa87848], [-1.9, 24, 7.6, 0.6, 5, 0.6, 0xe8dcc0], [1.3, 24, 7.6, 0.6, 5, 0.6, 0xe8dcc0],
      [-3.4, 27, 7.6, 2, 0.6, 0.6, 0xe8dcc0], [1.4, 27, 7.6, 2, 0.6, 0.6, 0xe8dcc0], [-3.4, 27.4, 7.6, 0.6, 2.4, 0.6, 0xe8dcc0], [2.8, 27.4, 7.6, 0.6, 2.4, 0.6, 0xe8dcc0],
      [-1.7, 22.6, 9.6, 0.6, 0.8, 0.8, 0x1d1f22], [1.1, 22.6, 9.6, 0.6, 0.8, 0.8, 0x1d1f22], [-1, 14, -8.4, 2, 2.4, 1, 0xf7f3ea]],
  },
  boar: {
    len: 14, w: 7, h: 7, leg: 5, color: 0x5a4636, dark: 0x3a2c22, tail: [2, 0.2],
    extra: [[-3, 5.4, 6, 6, 5.6, 5.4, 0x5a4636], [-1.6, 6, 11.2, 3.2, 2.6, 2.4, 0xb08878], [-2.6, 6.2, 11, 0.8, 2.4, 0.8, 0xf7f3ea], [1.8, 6.2, 11, 0.8, 2.4, 0.8, 0xf7f3ea],
      [-1, 12, -6, 2, 1.6, 15, 0x2a2018], [-3.2, 10.6, 6.4, 1.4, 1.8, 1.2, 0x3a2c22], [1.8, 10.6, 6.4, 1.4, 1.8, 1.2, 0x3a2c22],
      [-2.6, 8.8, 11, 0.7, 0.8, 0.5, 0xb3362a], [1.9, 8.8, 11, 0.7, 0.8, 0.5, 0xb3362a]],
  },
  croc: {
    len: 20, w: 8, h: 3.4, leg: 2, color: 0x4f6a3a, dark: 0x384c2a, tail: [0, 0], legW: 2.4,
    extra: [[-2.6, 2, 10, 5.2, 2.6, 9, 0x4f6a3a], [-2.2, 1.4, 10, 4.4, 0.8, 8.4, 0xb8c08a], [-3.4, 1.6, -9, 6.8, 0.8, 18, 0xa8b07a],
      [-3, 2.4, -18, 6, 2.6, 8, 0x4f6a3a], [-2, 2.6, -25, 4, 2, 7, 0x4f6a3a], [-1, 2.8, -31, 2, 1.4, 6, 0x384c2a],
      [-2.4, 5.4, -8, 1, 1, 16, 0x384c2a], [1.4, 5.4, -8, 1, 1, 16, 0x384c2a], [-0.5, 5.4, -24, 1, 1.2, 14, 0x384c2a],
      [-2.4, 4.6, 11, 1.2, 1.2, 1.4, 0xd8ff40], [1.2, 4.6, 11, 1.2, 1.2, 1.4, 0xd8ff40], [-2.4, 1.6, 15, 0.6, 0.8, 4, 0xf7f3ea], [1.8, 1.6, 15, 0.6, 0.8, 4, 0xf7f3ea]],
  },
  panther: {
    len: 17, w: 5.4, h: 5.4, leg: 7, color: 0x1d1f24, dark: 0x101114, tail: [10, -0.25],
    extra: [[-2.9, 8, 5, 5.8, 5.6, 5, 0x1d1f24], [-2.5, 10.4, 8.5, 5, 4.6, 5, 0x1d1f24], [-1.5, 10.6, 13.4, 3, 2.2, 1.6, 0x2a2c33],
      [-2.5, 15, 9.4, 1.4, 1.4, 1.4, 0x1d1f24], [1.1, 15, 9.4, 1.4, 1.4, 1.4, 0x1d1f24], [-2.2, 13.2, 13.2, 1, 0.8, 0.5, 0xd8ff40], [1.2, 13.2, 13.2, 1, 0.8, 0.5, 0xd8ff40]],
  },
};

function buildBeast(kind: AnimalKind): { group: THREE.Group; legs: THREE.Object3D[] } {
  const b = BEASTS[kind];
  const root = new THREE.Group();
  const g = new THREE.Group();
  g.scale.setScalar(U);
  root.add(g);
  const tone = 0.9 + Math.random() * 0.2;
  const color = new THREE.Color(b.color).multiplyScalar(tone).getHex();
  vox(g, [[-b.w / 2, b.leg, -b.len / 2, b.w, b.h, b.len, color], ...b.extra]);
  if (b.tail[0]) part(g, 0, b.leg + b.h - 1.5, -b.len / 2, [[-0.8, -0.8, -b.tail[0], 1.6, 1.6, b.tail[0], color], [-0.7, -0.7, -b.tail[0] - 1.2, 1.4, 1.4, 1.4, b.dark]]).rotation.x = b.tail[1];
  const legs: THREE.Object3D[] = [];
  const lw = b.legW ?? 2;
  const spread = kind === "croc" ? b.w / 2 + 0.6 : b.w / 2 - lw / 2;
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    legs.push(part(g, sx * spread, b.leg, sz * (b.len / 2 - lw), [[-lw / 2, -b.leg, -lw / 2, lw, b.leg, lw, color], [-lw / 2 - 0.1, -b.leg, -lw / 2 - 0.1, lw + 0.2, 1.2, lw + 0.6, b.dark]]));
  }
  merge(root, legs);
  return { group: root, legs };
}

export class Enemies {
  private spawns: Spawn[] = [];
  private list: Enemy[] = [];
  private handles = new Set<number>();
  private ctrl: RAPIER.KinematicCharacterController;
  private eyeA = new THREE.Vector3();
  private eyeB = new THREE.Vector3();

  constructor(private game: Game) {
    this.ctrl = game.world.createCharacterController(0.04);
    this.ctrl.enableAutostep(0.5, 0.2, true);
    this.ctrl.enableSnapToGround(0.6);
    this.ctrl.setMaxSlopeClimbAngle((60 * Math.PI) / 180);
  }

  owns(handle: number): boolean {
    return this.handles.has(handle);
  }

  addSpawn(spec: SpawnSpec): void {
    const spawn: Spawn = { ...spec, home: new THREE.Vector3(spec.x, heightAt(spec.x, spec.z) + (spec.y ?? 0), spec.z), enemy: null, respawnAt: 0 };
    this.spawns.push(spawn);
    this.spawnEnemy(spawn);
  }

  private spawnEnemy(spawn: Spawn): void {
    const { species, danger, home } = spawn;
    const human = species === "human" || species === "boss";
    const boss = species === "boss";
    const elite = !!spawn.elite;
    const animal = human ? null : ANIMALS[species as AnimalKind];
    const built = human ? buildHuman(spawn.post?.id ?? "sawmill", danger, elite, boss) : buildBeast(species as AnimalKind);
    const center = animal ? animal.center : boss ? 1.15 : elite ? 1.0 : 0.9;
    const desc = animal
      ? RAPIER.ColliderDesc.capsule(animal.capsule[0], animal.capsule[1])
      : boss ? RAPIER.ColliderDesc.capsule(0.68, 0.47) : RAPIER.ColliderDesc.capsule(elite ? 0.6 : 0.52, elite ? 0.4 : 0.38);
    const collider = this.game.world.createCollider(desc.setTranslation(home.x, home.y + center + 0.2, home.z));
    const maxHp = animal ? animal.hp + danger * 8 : boss ? 650 : (45 + danger * 22) * (elite ? 2.6 : 1);
    const top = animal ? animal.top : boss ? 2.6 : elite ? 2.3 : 2.05;
    const barBg = new THREE.Sprite(barBgMat);
    const bar = new THREE.Sprite(boss || elite ? eliteBarMat : barMat);
    const w = boss ? 1.5 : elite ? 1.1 : 0.8;
    barBg.scale.set(w + 0.06, 0.12, 1);
    bar.scale.set(w, 0.07, 1);
    for (const s of [barBg, bar]) {
      s.position.y = top;
      s.visible = false;
      s.renderOrder = 9;
      built.group.add(s);
    }
    bar.userData.w = w;
    const e: Enemy = {
      species, spawn, group: built.group, legs: built.legs, collider, center, headY: boss ? 1.84 : elite ? 1.6 : 1.44, hp: maxHp, maxHp, bar, barBg,
      aggro: false, hasLos: false, losT: Math.random() * 0.3,
      attackT: 1, burst: 0, wanderT: 0, wander: new THREE.Vector2(), strafe: Math.random() < 0.5 ? 1 : -1, strafeT: 2, fleeT: 0,
      yaw: Math.random() * 6.28, walk: 0, deadT: -1,
    };
    built.group.traverse((o) => (o.castShadow = (o as THREE.Mesh).isMesh));
    built.group.position.copy(home);
    this.game.scene.add(built.group);
    this.handles.add(collider.handle);
    this.game.targets.set(collider.handle, {
      onHit: (dmg, headMult, point, dir) => this.hit(e, dmg, headMult, point, dir),
    });
    spawn.enemy = e;
    this.list.push(e);
  }

  /** Noise wakes the armed and frightens the timid. */
  alert(at: { x: number; z: number }, radius: number): void {
    for (const e of this.list) {
      if (e.deadT >= 0 || e.aggro) continue;
      const t = e.collider.translation();
      if (Math.hypot(t.x - at.x, t.z - at.z) > radius) continue;
      if (e.species === "deer") e.fleeT = 5;
      else if (e.species === "human" || e.species === "boss" || e.species === "wolf" || e.species === "panther") e.aggro = true;
    }
  }

  private hit(e: Enemy, dmg: number, headMult: number, point: THREE.Vector3, dir: THREE.Vector3): boolean {
    if (e.deadT >= 0) return false;
    const human = e.species === "human" || e.species === "boss";
    const feet = e.collider.translation().y - e.center;
    const head = human && point.y - feet > e.headY;
    let mult = head ? headMult + (skillOf("gunner") >= 5 ? 0.1 : 0) : 1;
    if (human) mult *= skillOf("gunner") >= 10 ? 1.1 : 1;
    else mult *= 1 + skillOf("hunter") * 0.08;
    e.hp -= dmg * mult;
    e.aggro = e.species !== "deer";
    e.fleeT = 6;
    this.alert(e.collider.translation(), 22);
    this.game.fx.impact(point, dir.clone().negate(), 0x8a1f1f, head ? 8 : 4);
    e.bar.visible = e.barBg.visible = true;
    const f = Math.max(0.001, e.hp / e.maxHp);
    e.bar.scale.x = (e.bar.userData.w as number) * f;
    // Anchor the bar's left edge to the background's left edge.
    e.bar.center.set(1 / (2 * f), 0.5);
    if (e.hp > 0) return false;
    this.kill(e);
    return true;
  }

  private kill(e: Enemy): void {
    e.deadT = 0;
    e.bar.visible = e.barBg.visible = false;
    this.handles.delete(e.collider.handle);
    this.game.targets.delete(e.collider.handle);
    this.game.world.removeCollider(e.collider, false);
    e.spawn.enemy = null;
    const human = e.species === "human" || e.species === "boss";
    e.spawn.respawnAt = this.game.time + (e.species === "boss" ? 900 : e.spawn.elite ? 420 : human ? 200 : 150);
    const s = useStore.getState();
    const left = s.give(rollEnemy(e.species, e.spawn.danger, !!e.spawn.elite, skillOf("hunter")));
    if (left.length) s.toast("Рюкзак полон: часть добычи пропала", "#f0a35c");
    if (human) {
      s.addXp(e.species === "boss" ? 400 : (e.spawn.elite ? 90 : 20) * e.spawn.danger);
      s.skillXp("gunner", e.species === "boss" ? 120 : e.spawn.elite ? 40 : 12);
      s.event(e.species === "boss" ? "kill:boss" : e.spawn.elite ? "kill:elite" : "kill:human");
      if (e.spawn.elite || e.species === "boss") s.event("kill:human");
    } else {
      const xp = ANIMALS[e.species as AnimalKind].xp;
      s.addXp(xp);
      s.skillXp("hunter", xp);
      s.event("kill:animal");
      if (e.species === "panther") s.event("kill:panther");
    }
    const now = useStore.getState();
    useStore.setState({
      kills: now.kills + 1,
      stats: { ...now.stats, kills: now.stats.kills + 1, bosses: now.stats.bosses + (e.species === "boss" ? 1 : 0) },
    });
    if (e.species === "boss") {
      s.toast("Капитан повержен", "#ffc21a");
      sfx.rare();
    } else if (e.spawn.elite) s.toast("Главарь убит", "#ffc21a");
  }

  private los(e: Enemy, target: THREE.Vector3): boolean {
    const t = e.collider.translation();
    const human = e.species === "human" || e.species === "boss";
    this.eyeA.set(t.x, t.y + (human ? 0.6 : 0.2), t.z);
    const dir = this.eyeB.copy(target).sub(this.eyeA);
    const dist = dir.length();
    dir.multiplyScalar(1 / dist);
    const hit = this.game.world.castRay(new RAPIER.Ray(this.eyeA, dir), dist + 0.5, true, undefined, undefined, e.collider, undefined, (c) => !this.handles.has(c.handle));
    return !!hit && hit.collider.handle === this.game.player.collider.handle;
  }

  private shoot(e: Enemy, dist: number, target: THREE.Vector3): void {
    const player = this.game.player;
    const t = e.collider.translation();
    const from = new THREE.Vector3(t.x + Math.sin(e.yaw) * 0.9, t.y + 0.3, t.z + Math.cos(e.yaw) * 0.9);
    let chance = Math.max(0.1, Math.min(0.55, 0.66 - dist / 80));
    if (player.sprinting) chance *= 0.6;
    const hit = Math.random() < chance;
    const to = target.clone();
    if (hit) {
      to.y -= 0.25;
      player.damage(e.species === "boss" ? 11 : (5 + e.spawn.danger * 2) * (e.spawn.elite ? 1.3 : 1));
    } else {
      to.add(new THREE.Vector3((Math.random() - 0.5) * 2.4, (Math.random() - 0.3) * 1.6, (Math.random() - 0.5) * 2.4));
      to.sub(from).multiplyScalar(1.6).add(from);
    }
    this.game.fx.tracer(from, to, true);
    sfx.shot(e.species === "boss" ? "lmg" : "rifle", Math.max(0.15, 0.7 - dist / 90));
  }

  update(dt: number): void {
    const game = this.game;
    const player = game.player;
    const pp = player.pos;
    const eye = player.eye(new THREE.Vector3());
    const playerHandle = player.collider.handle;
    const stealth = skillOf("hunter") >= 10 ? 0.75 : 1;

    for (const spawn of this.spawns) {
      if (!spawn.enemy && game.time > spawn.respawnAt && Math.hypot(spawn.home.x - pp.x, spawn.home.z - pp.z) > 90) {
        this.spawnEnemy(spawn);
      }
    }

    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];
      if (e.deadT >= 0) {
        e.deadT += dt;
        e.group.rotation.x = -Math.min(1, e.deadT / 0.3) * (Math.PI / 2);
        if (e.deadT > 4) e.group.position.y -= dt * 0.5;
        if (e.deadT > 6) {
          game.scene.remove(e.group);
          this.list.splice(i, 1);
        }
        continue;
      }
      const t = e.collider.translation();
      const dx = pp.x - t.x;
      const dz = pp.z - t.z;
      const dist = Math.hypot(dx, dz);
      e.group.visible = dist < 260;
      if (dist > 170) continue;
      const human = e.species === "human" || e.species === "boss";
      const boss = e.species === "boss";
      const cfg = human ? null : ANIMALS[e.species as AnimalKind];
      const post = e.spawn.post;

      e.losT -= dt;
      if (e.losT <= 0) {
        e.losT = 0.25 + Math.random() * 0.15;
        e.hasLos = dist < 90 && this.los(e, eye);
      }
      const fromHome = Math.hypot(e.spawn.home.x - t.x, e.spawn.home.z - t.z);
      // Guards care only about someone near their monument; animals about someone near them.
      const playerAtPost = post ? Math.hypot(pp.x - post.x, pp.z - post.z) < post.r + 40 : true;
      const sight = (human ? (boss ? 60 : 46) : cfg!.sight * stealth) * (player.sprinting ? 1.2 : 1);
      if (!e.aggro && e.hasLos && dist < sight && playerAtPost) {
        if (cfg?.mode === "flee") e.fleeT = 5;
        else {
          e.aggro = true;
          // Reaction time: the player gets a moment before the first shot.
          e.attackT = human ? 0.7 + Math.random() * 0.8 : 0.4;
          if (!human) sfx.growl();
        }
      }
      if (e.aggro && (dist > (human ? 100 : 60) || fromHome > (human ? (post ? post.r + 60 : 80) : 150))) e.aggro = false;
      e.fleeT -= dt;

      let mx = 0;
      let mz = 0;
      let speed = 0;
      let face = e.yaw;
      const nx = dx / (dist || 1);
      const nz = dz / (dist || 1);
      if (cfg?.mode === "flee" && e.fleeT > 0) {
        mx = -nx;
        mz = -nz;
        speed = cfg.run;
        face = Math.atan2(mx, mz);
      } else if (e.aggro && cfg) {
        face = Math.atan2(dx, dz);
        if (dist > cfg.reach * 0.75) {
          mx = nx;
          mz = nz;
          speed = cfg.run;
        }
        e.attackT -= dt;
        if (dist < cfg.reach && e.attackT <= 0) {
          e.attackT = cfg.cooldown;
          player.damage(cfg.dmg + e.spawn.danger * 2);
        }
      } else if (e.aggro) {
        face = Math.atan2(dx, dz);
        e.strafeT -= dt;
        if (e.strafeT <= 0) {
          e.strafeT = 1.2 + Math.random() * 2;
          e.strafe = Math.random() < 0.25 ? 0 : -e.strafe || 1;
        }
        if (!e.hasLos || dist > (boss ? 34 : 26)) {
          mx = nx;
          mz = nz;
          speed = boss ? 2.6 : 3.6;
        } else if (dist < 8) {
          mx = -nx;
          mz = -nz;
          speed = 2.6;
        } else {
          mx = -nz * e.strafe;
          mz = nx * e.strafe;
          speed = boss ? 1.4 : 2.2;
        }
        e.attackT -= dt;
        if (e.hasLos && dist < 62 && e.attackT <= 0) {
          this.shoot(e, dist, eye);
          e.burst++;
          if (e.burst >= (boss ? 8 : 3)) {
            e.burst = 0;
            e.attackT = boss ? 1.6 : 1.1 + Math.random() * 1.1 - e.spawn.danger * 0.12;
          } else e.attackT = boss ? 0.1 : 0.15;
        }
      } else {
        e.wanderT -= dt;
        if (e.wanderT <= 0) {
          e.wanderT = 2 + Math.random() * 4;
          if (fromHome > (human ? 9 : 20)) e.wander.set(e.spawn.home.x - t.x, e.spawn.home.z - t.z).normalize();
          else if (Math.random() < 0.45) e.wander.set(0, 0);
          else {
            const a = Math.random() * Math.PI * 2;
            e.wander.set(Math.cos(a), Math.sin(a));
          }
        }
        mx = e.wander.x;
        mz = e.wander.y;
        speed = cfg ? cfg.walk : 1.3;
        if (mx || mz) face = Math.atan2(mx, mz);
      }

      this.ctrl.computeColliderMovement(
        e.collider,
        { x: mx * speed * dt, y: -9 * dt, z: mz * speed * dt },
        undefined,
        undefined,
        (c) => c.handle !== playerHandle,
      );
      const m = this.ctrl.computedMovement();
      const x = t.x + m.x;
      let y = t.y + m.y;
      const z = t.z + m.z;
      const ground = heightAt(x, z);
      if (y < ground - 2) y = ground + e.center + 0.3;
      e.collider.setTranslation({ x, y, z });
      e.group.position.set(x, y - e.center, z);

      let dy = face - e.yaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      e.yaw += dy * (1 - Math.exp(-9 * dt));
      e.group.rotation.y = e.yaw;

      const moved = Math.hypot(m.x, m.z) / Math.max(dt, 1e-4);
      e.walk += moved * dt * (human ? 2.6 : 3.2);
      const swing = Math.min(1, moved / 2) * (human ? 0.6 : 0.7);
      e.legs.forEach((leg, n) => {
        leg.rotation.x = Math.sin(e.walk + (n % 2 ? Math.PI : 0) + (n > 1 ? Math.PI : 0)) * swing;
      });
    }
  }
}
