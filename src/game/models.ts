/**
 * Voxel models of every item. The same model is held in first person and rendered into its
 * inventory icon. Models are authored in "pixels" (1 px = 1.25 cm): -Z is forward, +Y is up and the
 * origin is where the right hand grips.
 */

import * as THREE from "three";
import { box, vox, type VoxPart } from "./build";
import { ITEMS, type ArmorSlot } from "./items";
import { RARITIES, WEAPON_BY_ID, type WeaponDef } from "./weapons";

export const PX = 0.0125;

const METAL = 0x5b6068;
const METAL_HI = 0x7d848c;
const DARK = 0x33363b;
const BLACK = 0x1d1f22;
const WOOD = 0x8a5a32;
const WOOD_HI = 0xa87444;
const WOOD_DK = 0x66401f;
const POLY = 0x4a4f44;
const STONE = 0x8f877a;
const STONE_HI = 0xb0a898;
const STONE_DK = 0x6f685d;
const IRON = 0xb9c0c8;
const IRON_DK = 0x858d96;
const STEEL = 0xe3e9f0;
const RUSTY = 0x7a5a48;
const CLOTH = 0xd9cdb4;
const BRASS = 0xc9a23f;
const COPPER = 0xb0683a;
const RED = 0xb3362a;

export interface Held {
  group: THREE.Group;
  /** Tip of the barrel; bullets and the flash start here. */
  muzzle: THREE.Object3D;
  /** Where the hands grip, in px. */
  right: [number, number, number];
  left: [number, number, number] | null;
  /** Shown only while a bolt is loaded. */
  bolt?: THREE.Object3D;
  cocked?: THREE.Object3D;
  slack?: THREE.Object3D;
}

function group(parts: VoxPart[]): THREE.Group {
  const g = new THREE.Group();
  vox(g, parts);
  return g;
}

function muzzleAt(g: THREE.Group, z: number, y = 4): THREE.Object3D {
  const m = new THREE.Object3D();
  m.position.set(0, y, z);
  g.add(m);
  return m;
}

// ---------------------------------------------------------------------------------------------
// Guns

interface LongSpec {
  /** Receiver length. */
  R: number;
  /** Barrel length and thickness. */
  B: number;
  bw?: number;
  /** Two barrels side by side. */
  double?: boolean;
  /** Handguard length and colour. */
  H?: number;
  hc?: number;
  /** Stock length; 0 = none. */
  S: number;
  sc?: number;
  metal?: number;
  mag?: VoxPart[];
  extra?: VoxPart[];
}

function longGun(spec: LongSpec, accent: number): Held {
  const { R, B } = spec;
  const metal = spec.metal ?? METAL;
  const bw = spec.bw ?? 2;
  const sc = spec.sc ?? POLY;
  const parts: VoxPart[] = [
    [-2, 0, -R, 4, 5, R + 4, metal],
    [-2, 5, -R, 4, 1, R + 4, METAL_HI],
    ...(spec.double
      ? ([[-bw - 0.1, 3 - (bw - 2) / 2, -R - B, bw, bw, B, BLACK], [0.1, 3 - (bw - 2) / 2, -R - B, bw, bw, B, BLACK]] as VoxPart[])
      : ([[-bw / 2, 3 - (bw - 2) / 2, -R - B, bw, bw, B, BLACK]] as VoxPart[])),
    [-1.5, -8, 0, 3, 8, 4, sc],
    [-1.5, -9, 1, 3, 2, 4, sc],
    [-1, -3, -6, 2, 1, 6, DARK],
    [-0.5, -2, -3, 1, 2, 1, BLACK],
    [-0.5, 5, -R - B + 1, 1, 3, 1, BLACK],
    [-1.5, 6, -3, 1, 1, 2, BLACK],
    [0.5, 6, -3, 1, 1, 2, BLACK],
    [-2.2, 2, -5, 4.4, 1, 3, accent],
  ];
  if (spec.H) parts.push([-2, 0, -R - spec.H, 4, 4, spec.H, spec.hc ?? POLY], [-2, 0, -R - spec.H, 4, 1, spec.H, WOOD_DK]);
  if (spec.S) {
    parts.push([-2, 0, 4, 4, 5, spec.S * 0.45, sc], [-2, -3, 4 + spec.S * 0.3, 4, 7, spec.S * 0.7, sc], [-2, -3, 4 + spec.S - 1, 4, 7, 1, BLACK]);
  }
  if (spec.mag) parts.push(...spec.mag);
  if (spec.extra) parts.push(...spec.extra);
  const g = group(parts);
  return { group: g, muzzle: muzzleAt(g, -R - B - 1), right: [0, -5, 2], left: [0, -1, -R - Math.max(4, (spec.H ?? 8) * 0.6)] };
}

function pistol(def: WeaponDef, accent: number): Held {
  const grip = def.wood ? WOOD : POLY;
  const parts: VoxPart[] =
    def.id === "stepnyak"
      ? [
          [-1.5, 3, -19, 3, 3, 13, METAL], [-1.5, 6, -19, 3, 1, 13, METAL_HI], [-2, 1, -6, 4, 6, 8, METAL],
          [-3, 1.5, -6, 6, 5, 6, METAL_HI], [-3, 3, -6.2, 6, 1, 6.4, DARK], [-0.5, 7, 0, 1, 2, 2, DARK],
          [-2, -8, -1, 4, 9, 5, grip], [-2, -10, 0, 4, 2, 5, WOOD_DK], [-1, -2, -6, 2, 1, 5, DARK], [-0.5, 7, -18, 1, 1, 1, BLACK],
          [-1.6, 2, -12, 3.2, 1, 3, accent],
        ]
      : [
          [-2, 3, -14, 4, 3, 18, def.id === "gyurza" ? DARK : METAL], [-2, 6, -14, 4, 1, 18, METAL_HI], [-2, 0, -10, 4, 3, 13, DARK],
          [-2, -9, -1, 4, 9, 5, grip], [-2, -10, 0, 4, 2, 5, grip], [-1, -3, -7, 2, 1, 6, DARK], [-1, -3, -7, 2, 3, 1, DARK],
          [-0.5, 7, -13, 1, 1, 1, BLACK], [-1.5, 7, 2, 1, 1, 1, BLACK], [0.5, 7, 2, 1, 1, 1, BLACK], [-1, 3.5, -15, 2, 2, 1, BLACK],
          [-2.2, 4, -4, 4.4, 1, 3, accent],
        ];
  const g = group(parts);
  return { group: g, muzzle: muzzleAt(g, def.id === "stepnyak" ? -20 : -15, 4.5), right: [0, -5, 2], left: null };
}

function crossbow(accent: number): Held {
  const g = group([
    [-1.5, 0, -24, 3, 3, 36, WOOD], [-1.5, 3, -22, 3, 1, 26, WOOD_HI], [-1, 3.2, -22, 2, 0.6, 20, WOOD_DK],
    [-1.5, -7, 2, 3, 7, 4, WOOD_DK], [-1, -3, -4, 2, 1, 6, DARK], [-0.5, -2, -1, 1, 2, 1, BLACK],
    [-2, -1, 12, 4, 6, 8, WOOD], [-2, -2, 19, 4, 7, 1, BLACK],
    // Prod: the bow across the front.
    [-10, 1, -24, 20, 2, 2, DARK], [-13, 1, -22, 3, 2, 2, DARK], [10, 1, -22, 3, 2, 2, DARK],
    [-14, 1, -20, 2, 2, 2, IRON_DK], [12, 1, -20, 2, 2, 2, IRON_DK],
    [-1, -3, -27, 2, 4, 3, IRON_DK], [-2, 3, -4, 4, 2, 3, IRON_DK],
    [-1.7, 1, 6, 3.4, 1, 3, accent],
  ]);
  // The string: drawn back to the latch when cocked, straight between the tips when not.
  const cocked = new THREE.Group();
  for (const sx of [-1, 1]) {
    const s = box(cocked, 0.5, 0.5, 20.5, sx * 6.5, 3.6, -11.5, 0xe9e1cf);
    s.rotation.y = sx * -0.69;
  }
  const slack = new THREE.Group();
  box(slack, 26, 0.5, 0.5, 0, 3.6, -19.5, 0xe9e1cf);
  const bolt = group([
    [-0.5, 3.6, -26, 1, 1, 23, WOOD_HI], [-1, 3.1, -29, 2, 2, 3, IRON], [-0.5, 3.6, -30, 1, 1, 1, STEEL],
    [-1.5, 3.6, -6, 3, 1, 3, RED], [-0.5, 2.6, -6, 1, 3, 3, RED],
  ]);
  g.add(cocked, slack, bolt);
  return { group: g, muzzle: muzzleAt(g, -30, 4), right: [0, -4, 4], left: [0, -2, -14], bolt, cocked, slack };
}

function gunModel(def: WeaponDef, rarity: number): Held {
  const accent = RARITIES[rarity].hex;
  const wood = def.wood ? WOOD : POLY;
  switch (def.id) {
    case "crossbow":
      return crossbow(accent);
    case "pm9":
    case "gyurza":
    case "stepnyak":
      return pistol(def, accent);
    case "kedr":
      return longGun({ R: 14, B: 6, S: 0, mag: [[-1.5, -13, -9, 3, 13, 4, BLACK]], extra: [[-0.5, 5, 4, 1, 1, 12, DARK], [-2, 3, 15, 4, 3, 1, DARK]] }, accent);
    case "shershen":
      return longGun({ R: 16, B: 5, bw: 3, S: 10, H: 8, mag: [[-2, -14, -11, 4, 14, 5, BLACK]], extra: [[-1.5, 6, -14, 3, 1, 12, BLACK]] }, accent);
    case "ak_rusty":
    case "akm_aral":
      return longGun(
        {
          R: 18, B: 22, H: 12, hc: WOOD, S: 18, sc: WOOD, metal: def.id === "ak_rusty" ? RUSTY : METAL,
          mag: [[-1.5, -9, -12, 3, 9, 5, def.id === "ak_rusty" ? RUSTY : DARK], [-1.5, -14, -14, 3, 6, 5, def.id === "ak_rusty" ? RUSTY : DARK]],
          extra: [[-1, 5, -30, 2, 2, 12, WOOD_HI], ...(def.id === "akm_aral" ? ([[-1.5, 2.5, -43, 3, 3, 3, BLACK]] as VoxPart[]) : [])],
        },
        accent,
      );
    case "val":
      return longGun({ R: 18, B: 20, bw: 4, S: 16, sc: DARK, H: 6, mag: [[-1.5, -10, -12, 3, 10, 5, POLY]], extra: [[-1, 6, -12, 2, 1, 8, BLACK]] }, accent);
    case "dvustvolka":
      return longGun({ R: 10, B: 30, bw: 2.4, double: true, H: 14, hc: WOOD, S: 18, sc: WOOD, extra: [[-0.5, 6, -6, 1, 1, 3, IRON_DK]] }, accent);
    case "pompa":
      return longGun({ R: 14, B: 26, bw: 3, S: 16, extra: [[-1, 0, -36, 2, 2, 22, DARK], [-2.5, -1, -30, 5, 4, 9, POLY], [-2.5, -1, -30, 5, 1, 9, BLACK]] }, accent);
    case "saiga":
      return longGun({ R: 18, B: 20, bw: 3, H: 12, S: 16, mag: [[-2, -13, -13, 4, 13, 8, BLACK]], extra: [[-2, 2, -40, 4, 4, 3, BLACK]] }, accent);
    case "mosinka":
      return longGun({ R: 14, B: 34, H: 28, hc: WOOD, S: 20, sc: WOOD, extra: [[2, 4, -3, 3, 1, 1, IRON_DK], [4, 3, -3, 2, 2, 2, IRON], [-1, 7, -12, 2, 2, 13, BLACK], [-1.5, 6.5, -13, 3, 3, 2, DARK], [-0.5, 6, -9, 1, 1, 1, DARK], [-0.5, 6, -2, 1, 1, 1, DARK]] }, accent);
    case "svd":
      return longGun({ R: 18, B: 30, H: 12, hc: WOOD, S: 18, sc: WOOD, mag: [[-1.5, -8, -12, 3, 8, 6, DARK]], extra: [[-1.5, 7, -16, 3, 3, 16, BLACK], [-2, 6.5, -18, 4, 4, 3, DARK], [-1, 7.5, -18.3, 2, 2, 0.5, 0x7fe3ff], [-0.5, 6, -12, 1, 1, 1, DARK], [-0.5, 6, -3, 1, 1, 1, DARK], [-1.5, 2.5, -51, 3, 3, 4, BLACK]] }, accent);
    case "rpk":
      return longGun({ R: 18, B: 28, bw: 2.6, H: 12, hc: WOOD, S: 18, sc: WOOD, mag: [[-4, -11, -14, 8, 9, 8, DARK], [-3, -12, -13, 6, 11, 6, BLACK]], extra: [[-1, 5, -30, 2, 2, 12, WOOD_HI], [-2, -1, -44, 1, 1, 12, DARK], [1, -1, -44, 1, 1, 12, DARK]] }, accent);
    default:
      return longGun({ R: 16, B: 16, S: 14, sc: wood }, accent);
  }
}

// ---------------------------------------------------------------------------------------------
// Tools

const HEAD: Record<number, [number, number, number]> = {
  1: [STONE, STONE_HI, CLOTH],
  2: [IRON_DK, IRON, WOOD_DK],
  3: [0x9aa4ae, STEEL, RED],
};

function handle(tier: number): VoxPart[] {
  const paint = tier === 3 ? RED : WOOD;
  return [[-1, -6, -1, 2, 32, 2, WOOD], [-1, -6, -1, 2, 5, 2, WOOD_DK], [0.6, -1, -1, 0.5, 26, 2, WOOD_HI], [-1.2, 14, -1.2, 2.4, 3, 2.4, paint]];
}

function toolModel(id: string): Held {
  const t = ITEMS[id].tool!;
  let parts: VoxPart[];
  let muzzleZ = -10;
  if (id === "rock") {
    parts = [
      [-4, -3, -5, 8, 9, 10, STONE], [-3, 6, -4, 6, 3, 7, STONE_HI], [-3, -5, -3, 6, 2, 6, STONE_DK], [-2, -1, -8, 5, 6, 3, STONE_HI],
      [-1, 0, -10, 3, 4, 2, 0xcfc8ba], [3.5, -1, -2, 1, 5, 5, STONE_DK], [-4.5, 0, -1, 1, 4, 4, STONE_DK],
    ];
  } else if (id === "chainsaw") {
    parts = [
      [-4, -2, -8, 8, 8, 14, 0xe07b28], [-4, 4, -8, 8, 2, 14, 0xf09a48], [-3, -3, -6, 6, 1, 10, DARK], [-1, 7, -7, 2, 2, 11, BLACK],
      [-1, 6, -7, 2, 2, 2, BLACK], [-1, 6, 2, 2, 2, 2, BLACK], [-1.5, -8, 3, 3, 7, 4, BLACK], [4, 0, -4, 2, 4, 5, DARK],
      [-0.5, 0, -34, 1, 5, 26, IRON], [-0.9, -0.6, -34, 1.8, 1, 26, BLACK], [-0.9, 4.6, -34, 1.8, 1, 26, BLACK], [-0.9, 0, -35, 1.8, 5, 1, BLACK],
    ];
    muzzleZ = -30;
  } else if (id === "jackhammer") {
    parts = [
      [-4, -2, -10, 8, 8, 16, 0xd9a520], [-4, 4, -10, 8, 2, 16, 0xf0c040], [-2.5, -0.5, -22, 5, 5, 12, IRON_DK], [-3, -1, -14, 6, 6, 2, BLACK],
      [-1, 1, -38, 2, 2, 16, STEEL], [-1.5, 0.5, -24, 3, 3, 2, DARK], [-8, 1, 4, 16, 2, 2, BLACK], [-8, 0, 3, 2, 4, 4, RED], [6, 0, 3, 2, 4, 4, RED],
      [-1.5, -8, 2, 3, 7, 4, BLACK], [2, 4, 2, 2, 2, 8, DARK],
    ];
    muzzleZ = -36;
  } else {
    const [dark, light, wrap] = HEAD[t.tier];
    parts = handle(t.tier);
    if (t.type === "axe") {
      parts.push(
        [-1, 18, -9, 2, 8, 8, dark], [-1, 17, -10, 2, 10, 2, light], [-1, 16, -11, 2, 12, 1, light], [-1.5, 19, -2, 3, 6, 4, wrap],
        [-1, 20, 1, 2, 4, 2, dark],
      );
    } else {
      parts.push(
        [-1, 22, -11, 2, 3, 22, dark], [-1, 20, -14, 2, 3, 4, light], [-1, 18, -15, 2, 3, 2, light], [-1, 20, 10, 2, 3, 4, light],
        [-1, 18, 13, 2, 3, 2, light], [-1.5, 21, -2, 3, 5, 4, wrap],
      );
    }
  }
  const g = group(parts);
  return { group: g, muzzle: muzzleAt(g, muzzleZ, 4), right: [0, t.motor ? -5 : -2, t.motor ? 4 : 0], left: t.motor ? [0, 6, -4] : null };
}

// ---------------------------------------------------------------------------------------------
// Medicine and small things

function miscModel(id: string): Held {
  const parts: Record<string, VoxPart[]> = {
    bandage: [[-4, -3, -4, 8, 7, 8, 0xeee6d6], [-4.2, -1, -4.2, 8.4, 2, 8.4, 0xd8cfbb], [-1.5, -2.5, -4.6, 3, 6, 0.6, 0xc9bfa8], [3, -3, -2, 4, 1, 4, 0xeee6d6], [-1, -0.5, -4.5, 2, 1, 0.6, RED]],
    medkit: [[-6, -4, -5, 12, 9, 10, 0xc0392b], [-6, 3, -5, 12, 2, 10, 0xd95445], [-1, -2, -5.4, 2, 6, 0.6, 0xf5f0e6], [-3, 0, -5.4, 6, 2, 0.6, 0xf5f0e6], [-2, 5, -1, 4, 2, 2, BLACK], [-6.3, -1, -2, 0.6, 2, 4, IRON]],
    milkit: [[-6, -4, -5, 12, 9, 10, 0x4b5a3a], [-6, 3, -5, 12, 2, 10, 0x5d6f48], [-1, -2, -5.4, 2, 6, 0.6, RED], [-3, 0, -5.4, 6, 2, 0.6, RED], [-2, 5, -1, 4, 2, 2, BLACK], [3, 5, -4, 2, 2, 8, 0xe9e1cf], [3.5, 5.5, -8, 1, 1, 4, STEEL], [2.5, 4.5, 3, 3, 3, 1, 0xe07b28]],
    cooked: [[-4, -2, -3, 8, 4, 7, 0x8a4a2e], [-3, 2, -2, 6, 1, 5, 0xa85f3a], [-1, -1, 4, 2, 2, 6, 0xeee6d6], [-1.5, -1.5, 9, 3, 3, 2, 0xf7f3ea], [-4.2, 0, -1, 8.4, 0.6, 1, 0x4a2a1c], [-4.2, 0, 2, 8.4, 0.6, 1, 0x4a2a1c]],
    bp: [[-7, -4, -1, 14, 10, 1, 0x2f6fa8], [-7, 5, -1.5, 14, 2, 2, 0xe9e1cf], [-7, -5, -1.5, 14, 2, 2, 0xe9e1cf], [-5, 2, -1.2, 6, 1, 0.4, 0xe9e1cf], [-5, 0, -1.2, 10, 0.6, 0.4, 0xbfe0ff], [-5, -2, -1.2, 4, 3, 0.4, 0xbfe0ff], [2, -2, -1.2, 3, 1, 0.4, 0xe9e1cf]],
    lockpick: [[-0.5, 0, -12, 1, 1, 15, IRON], [-0.5, 1, -12, 1, 2, 1, STEEL], [-1, -0.5, 3, 2, 2, 7, BLACK], [-1.2, -0.7, 5, 2.4, 2.4, 1, RED], [2, 0, -9, 1, 1, 12, IRON_DK], [2, -1, -9, 1, 1, 2, IRON_DK]],
  };
  const g = group(parts[id] ?? (id.startsWith("bp_") ? parts.bp : parts.bandage));
  return { group: g, muzzle: muzzleAt(g, -6), right: [0, -4, 2], left: null };
}

/** The first-person model of an item in the hotbar. */
export function heldModel(id: string, rarity = 0): Held {
  const w = WEAPON_BY_ID[id];
  const held = w ? gunModel(w, rarity) : ITEMS[id]?.tool ? toolModel(id) : miscModel(id);
  held.group.traverse((o) => {
    o.castShadow = false;
    o.receiveShadow = false;
  });
  return held;
}

// ---------------------------------------------------------------------------------------------
// Icon-only models: armour, resources, ammo

const ARMOR_PALETTE: Record<string, [number, number, number]> = {
  cloth: [0xcdbf9f, 0xa8997a, 0x8a7c62],
  hide: [0x8a5f3c, 0x6b4627, 0x4f331c],
  plate: [0x9aa2aa, 0x6a727a, 0x7a4a2e],
  kevlar: [0x56683f, 0x36422a, 0x1d1f22],
};

function armorModel(set: string, slot: ArmorSlot): THREE.Group {
  const [a, b, c] = ARMOR_PALETTE[set] ?? ARMOR_PALETTE.cloth;
  const heavy = set === "plate" || set === "kevlar";
  const parts: Record<ArmorSlot, VoxPart[]> = {
    head: [
      [-5, 0, -5, 10, 7, 10, a], [-4, 7, -4, 8, 2, 8, a], [-5.3, 1, -5.3, 10.6, 2, 10.6, b], [-3, 0, -5.5, 6, 3, 1, c],
      ...(heavy ? ([[-5.5, 0, -2, 1, 5, 4, b], [4.5, 0, -2, 1, 5, 4, b], [-2, 9, -2, 4, 1, 4, b]] as VoxPart[]) : ([[3, -4, 4, 2, 5, 1, a]] as VoxPart[])),
    ],
    chest: [
      [-6, 0, -3, 12, 14, 6, a], [-9, 9, -3, 3, 5, 6, a], [6, 9, -3, 3, 5, 6, a], [-6, 5, -3.3, 12, 2, 6.6, b], [-2, 12, -3.3, 4, 2, 6.6, c],
      ...(heavy ? ([[-5, 8, -3.6, 4, 4, 1, b], [1, 8, -3.6, 4, 4, 1, b], [-5, 1, -3.6, 10, 3, 1, b]] as VoxPart[]) : ([[-4, 1, -3.3, 3, 3, 1, b]] as VoxPart[])),
    ],
    legs: [
      [-6, 12, -3, 12, 4, 6, a], [-6, 0, -3, 5, 12, 6, a], [1, 0, -3, 5, 12, 6, a], [-6, 14, -3.3, 12, 1, 6.6, c],
      ...(heavy ? ([[-6.3, 5, -3.5, 5.6, 3, 2, b], [0.7, 5, -3.5, 5.6, 3, 2, b]] as VoxPart[]) : ([[-5, 2, -3.3, 3, 2, 1, b]] as VoxPart[])),
    ],
    feet: [
      [-6, 0, -3, 5, 7, 7, a], [-6, 0, -7, 5, 3, 4, a], [1, 0, -3, 5, 7, 7, a], [1, 0, -7, 5, 3, 4, a], [-6.2, 0, -7.2, 5.4, 1, 11.4, c],
      [0.8, 0, -7.2, 5.4, 1, 11.4, c], [-6, 5, -3.2, 5, 1, 7.4, b], [1, 5, -3.2, 5, 1, 7.4, b],
    ],
  };
  return group(parts[slot]);
}

const cartridge = (x: number, z: number, h: number, w: number, tip: number): VoxPart[] => [
  [x, 0, z, w, h, w, BRASS], [x, 0, z, w, 1, w, 0xa07f2c], [x + 0.25, h, z + 0.25, w - 0.5, tip, w - 0.5, COPPER],
];

const ICON_PARTS: Record<string, VoxPart[]> = {
  wood: [[-3, 0, -8, 6, 6, 16, 0x7b6650], [-2, 1, -8.3, 4, 4, 16.6, 0xc9a26b], [-1, 6, -6, 6, 5, 14, 0x6e5a45], [0, 7, -6.3, 4, 3, 14.6, 0xc9a26b], [-3, 2, -3, 6.2, 1, 1, 0x5a4836]],
  stone: [[-6, 0, -5, 12, 7, 10, STONE], [-4, 7, -3, 7, 3, 6, STONE_HI], [3, 0, -6, 4, 4, 4, STONE_DK], [-7, 0, 1, 3, 3, 4, STONE_DK]],
  ore: [[-6, 0, -5, 12, 7, 10, STONE], [-4, 7, -3, 7, 3, 6, STONE_HI], [-6.3, 3, -2, 1, 2, 3, 0xd6783a], [2, 7.2, -4, 3, 1, 2, 0xe89a4c], [-2, 2, -5.3, 3, 3, 1, 0xd6783a], [4, 1, -5.3, 2, 2, 1, 0xb85c28], [-5, 9, -1, 2, 1.3, 2, 0xe89a4c]],
  iron: [[-7, 0, -3, 14, 3, 6, IRON_DK], [-6, 3, -2.5, 12, 2, 5, IRON], [-5, 5, -6, 14, 3, 6, IRON_DK], [-4, 8, -5.5, 12, 2, 5, STEEL]],
  scrap: [[-6, 0, -6, 12, 2, 12, 0x7a4a2e], [-3, 2, -3, 6, 2, 6, 0x94603a], [-1, 4, -1, 2, 2, 2, DARK], [4, 2, -7, 2, 2, 12, IRON_DK], [-7, 2, 2, 8, 1, 3, 0x5d4a3a], [-5, 2, -6, 3, 4, 1, 0x8b5a3c]],
  cloth: [[-6, 0, -5, 12, 3, 10, 0xd9cdb4], [-5, 3, -4, 10, 2, 8, 0xeee6d6], [-6.2, 1, -1, 12.4, 1, 2, 0xa33b2e], [-4, 5, -3, 8, 1, 6, 0xd9cdb4]],
  hide: [[-7, 0, -6, 14, 1, 12, 0x8a6b4d], [-5, 1, -4, 10, 0.6, 8, 0xa98862], [-9, 0, -8, 3, 1, 3, 0x8a6b4d], [6, 0, -8, 3, 1, 3, 0x8a6b4d], [-9, 0, 5, 3, 1, 3, 0x8a6b4d], [6, 0, 5, 3, 1, 3, 0x8a6b4d], [-2, 0, 6, 4, 1, 4, 0x6b5139]],
  meat: [[-5, 0, -4, 10, 4, 8, 0xc0564a], [-4, 4, -3, 8, 1, 6, 0xd97a6c], [-5.2, 1, -1, 10.4, 1, 2, 0xf2d9c9], [3, 0, -6, 3, 3, 3, 0xeee6d6], [4, 1, -7.5, 2, 2, 2, 0xf7f3ea]],
  chem: [[-3, 0, -3, 6, 7, 6, 0x7cc46a], [-3, 4, -3, 6, 1, 6, 0xa6e092], [-1, 7, -1, 2, 3, 2, 0xcfe8d0], [-1.5, 10, -1.5, 3, 1, 3, 0x8a5a32], [3, 0, 0, 4, 5, 4, 0x4f9e6e], [4, 5, 1, 2, 2, 2, 0xcfe8d0]],
  powder: [[-5, 0, -4, 10, 8, 8, 0x5a5a5a], [-4, 8, -3, 8, 1, 6, 0x6e6e6e], [-2, 9, -2, 4, 2, 4, 0x4a4a4a], [-3, 2, -4.3, 6, 3, 1, 0xd9cdb4], [-5.2, 5, -4.2, 10.4, 1, 8.4, 0x8a5a32]],
  elec: [[-7, 0, -5, 14, 1, 10, 0x2f7d5b], [-4, 1, -2, 4, 1, 4, BLACK], [2, 1, -3, 3, 2, 2, 0xd9b44a], [2, 1, 1, 2, 3, 2, 0x3d8bff], [-6, 1, -4, 1, 1, 8, 0xd9b44a], [-2, 1, 3, 6, 1, 1, IRON], [5, 1, -4, 1, 2, 1, RED]],
  crystal: [[-5, 0, -4, 10, 2, 8, STONE_DK], [-2, 2, -2, 4, 11, 4, 0x7fe3ff], [-1, 13, -1, 2, 2, 2, 0xc9f5ff], [2, 2, 0, 3, 7, 3, 0x56c6e8], [-5, 2, 1, 3, 5, 3, 0x9eeaff], [1, 2, -4, 2, 4, 2, 0x56c6e8]],
  bolt: [[-0.5, 0, -11, 1, 1, 20, WOOD_HI], [-1, -0.5, -14, 2, 2, 3, IRON], [-1.5, 0, 6, 3, 1, 3, RED], [2, 0, -9, 1, 1, 20, WOOD_HI], [1.5, -0.5, -12, 2, 2, 3, IRON], [1, 0, 8, 3, 1, 3, RED], [-3, 0, -8, 1, 1, 20, WOOD], [-3.5, -0.5, -11, 2, 2, 3, IRON]],
  light: [...cartridge(-4, -1, 5, 2, 2), ...cartridge(-1, -1, 5, 2, 2), ...cartridge(2, -1, 5, 2, 2), ...cartridge(-2.5, 2, 5, 2, 2), ...cartridge(0.5, 2, 5, 2, 2)],
  medium: [...cartridge(-4, -1, 8, 2, 3), ...cartridge(-1, -1, 8, 2, 3), ...cartridge(2, -1, 8, 2, 3), ...cartridge(-2.5, 2, 8, 2, 3)],
  shell: [[-5, 0, -1.5, 3, 6, 3, RED], [-5, 0, -1.5, 3, 2, 3, BRASS], [-1.5, 0, -1.5, 3, 6, 3, RED], [-1.5, 0, -1.5, 3, 2, 3, BRASS], [2, 0, -1.5, 3, 6, 3, RED], [2, 0, -1.5, 3, 2, 3, BRASS]],
  heavy: [...cartridge(-4, -1.5, 11, 3, 4), ...cartridge(0, -1.5, 11, 3, 4), ...cartridge(-2, 2.5, 11, 3, 4)],
  salt: [[-5, 0, -5, 10, 3, 10, 0xe9e3d3], [-3, 3, -3, 6, 3, 6, 0xf7f3ea], [-1, 6, -1, 2, 2, 2, 0xffffff], [3, 3, 2, 2, 2, 2, 0xcfe9f2]],
};

/** A model to draw as an icon: any item, resource or ammo id. */
export function iconModel(id: string): THREE.Group {
  const def = ITEMS[id];
  if (def?.armor) return armorModel(id.split("_")[0], def.armor.slot);
  if (def) return heldModel(id).group;
  return group(ICON_PARTS[id] ?? ICON_PARTS.stone);
}

/** Arm colours by chest armour: sleeve, cuff. */
export function sleeveColors(chestId: string | null): [number, number] {
  const p = chestId ? ARMOR_PALETTE[chestId.split("_")[0]] : null;
  return p ? [p[0], p[1]] : [0x9a8a6a, 0x7d6f55];
}

export const SKIN = 0xc49a6c;
