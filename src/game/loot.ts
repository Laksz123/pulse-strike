/** Loot tables: what a container or a dead enemy gives. */

import { ARMOR_SLOTS, BLUEPRINTS, newGun, newItem, type Item, type ResId } from "./items";
import { WEAPONS, type AmmoType } from "./weapons";

export type ContainerKind = "barrel" | "chest" | "military";

export const CONTAINER_NAMES: Record<ContainerKind, string> = {
  barrel: "Бочка",
  chest: "Корабельный сундук",
  military: "Военный ящик",
};

export type Drop =
  | { kind: "item"; item: Item }
  | { kind: "res"; res: ResId; n: number }
  | { kind: "ammo"; ammo: AmmoType; n: number }
  | { kind: "salt"; n: number };

interface Table {
  /** Chance that the container holds a gun at all. */
  weapon: number;
  /** Rarity weights, index = rarity. */
  rarity: number[];
  /** Highest weapon tier that can drop. */
  tier: 1 | 2 | 3;
  salt: [number, number];
}

/** Epic / legendary odds: barrel 2 % / 0.1 %, chest 8 % / 0.5 %, military 20 % / 3 %. */
const TABLES: Record<ContainerKind, Table> = {
  barrel: { weapon: 0.12, rarity: [62, 27.9, 8, 2, 0.1], tier: 1, salt: [5, 25] },
  chest: { weapon: 0.7, rarity: [35, 34.5, 22, 8, 0.5], tier: 2, salt: [30, 90] },
  military: { weapon: 1, rarity: [0, 37, 40, 20, 3], tier: 3, salt: [80, 220] },
};

const rnd = Math.random;
const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
const res = (r: ResId, a: number, b: number): Drop => ({ kind: "res", res: r, n: int(a, b) });
const item = (id: string, n = 1): Drop => ({ kind: "item", item: newItem(id, n) });

function weighted(weights: number[]): number {
  let r = rnd() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r < 0) return i;
  }
  return 0;
}

export function rollGun(maxTier: number, rarityWeights: number[]): Item {
  const pool = WEAPONS.filter((w) => w.tier >= 1 && w.tier <= maxTier);
  // Higher tiers are rarer inside the pool.
  const def = pool[weighted(pool.map((w) => 1 / w.tier))];
  return newGun(def.id, weighted(rarityWeights));
}

const AMMO_ROLL: { ammo: AmmoType; n: [number, number]; w: number }[] = [
  { ammo: "bolt", n: [4, 8], w: 3 },
  { ammo: "light", n: [12, 30], w: 4 },
  { ammo: "medium", n: [10, 25], w: 3 },
  { ammo: "shell", n: [4, 10], w: 2 },
  { ammo: "heavy", n: [3, 8], w: 1.5 },
];

function rollAmmo(): Drop {
  const a = AMMO_ROLL[weighted(AMMO_ROLL.map((x) => x.w))];
  return { kind: "ammo", ammo: a.ammo, n: int(a.n[0], a.n[1]) };
}

function armorPiece(set: string): Drop {
  return item(`${set}_${ARMOR_SLOTS[int(0, 3)]}`);
}

export function rollBlueprint(): Drop {
  const ids = Object.keys(BLUEPRINTS);
  return item(`bp_${ids[int(0, ids.length - 1)]}`);
}

/** `relic`: the temple reliquary, which always holds a blueprint. */
export function rollContainer(kind: ContainerKind, relic = false): Drop[] {
  const t = TABLES[kind];
  const out: Drop[] = [{ kind: "salt", n: int(t.salt[0], t.salt[1]) }, rollAmmo()];
  if (rnd() < t.weapon) out.push({ kind: "item", item: rollGun(t.tier, t.rarity) });
  if (kind === "barrel") {
    out.push(res("scrap", 1, 3));
    if (rnd() < 0.5) out.push(res("chem", 1, 3));
    if (rnd() < 0.3) out.push(res("cloth", 1, 2));
    if (rnd() < 0.12) out.push(res("elec", 1, 1));
    if (rnd() < 0.2) out.push(item("bandage"));
    if (rnd() < 0.25) out.push(item("lockpick", int(1, 2)));
  } else if (kind === "chest") {
    out.push(rollAmmo(), res("scrap", 3, 6), res("chem", 2, 4));
    if (rnd() < 0.7) out.push(res("elec", 1, 3));
    if (rnd() < 0.6) out.push(item(rnd() < 0.3 ? "medkit" : "bandage", int(1, 2)));
    if (rnd() < 0.35) out.push(armorPiece(rnd() < 0.6 ? "hide" : "plate"));
    if (rnd() < 0.08) out.push(res("crystal", 1, 1));
  } else {
    out.push(rollAmmo(), rollAmmo(), res("elec", 3, 6), res("crystal", 1, 3), item("milkit"));
    if (rnd() < 0.6) out.push(armorPiece(rnd() < 0.55 ? "plate" : "kevlar"));
    if (rnd() < 0.5) out.push(item("medkit", int(1, 2)));
    if (relic || rnd() < 0.25) out.push(rollBlueprint());
  }
  return out;
}

export type Species = "human" | "boss" | "wolf" | "deer" | "boar" | "croc" | "panther";

export function rollEnemy(type: Species, danger: number, elite = false, hunter = 0): Drop[] {
  // A seasoned hunter skins more cleanly.
  const extraHide = hunter >= 5 ? 1 : 0;
  const extraMeat = hunter >= 10 ? 1 : 0;
  if (type === "wolf") return [res("hide", 1 + extraHide, 2 + extraHide), res("meat", 1 + extraMeat, 1 + extraMeat)];
  if (type === "deer") return [res("hide", 1 + extraHide, 2 + extraHide), res("meat", 2 + extraMeat, 3 + extraMeat)];
  if (type === "boar") return [res("hide", 1 + extraHide, 1 + extraHide), res("meat", 3 + extraMeat, 4 + extraMeat)];
  if (type === "croc") return [res("hide", 3 + extraHide, 4 + extraHide), res("meat", 2 + extraMeat, 2 + extraMeat)];
  if (type === "panther") return [res("hide", 3 + extraHide, 3 + extraHide), res("meat", 2 + extraMeat, 2 + extraMeat), { kind: "salt", n: int(60, 120) }];
  if (type === "boss") {
    return [
      { kind: "salt", n: int(350, 500) },
      { kind: "item", item: rollGun(3, [0, 0, 30, 55, 15]) },
      res("crystal", 3, 5), res("elec", 4, 6), item("milkit"), armorPiece("kevlar"), rollAmmo(), rollAmmo(), rollBlueprint(),
    ];
  }
  const out: Drop[] = [{ kind: "salt", n: int(4, 14) * danger }];
  if (rnd() < 0.8) out.push(rollAmmo());
  if (rnd() < 0.6) out.push(res("cloth", 1, 2));
  if (rnd() < 0.2) out.push(item("bandage"));
  if (rnd() < 0.15) out.push(item("lockpick"));
  if (rnd() < 0.06 + danger * 0.03) out.push({ kind: "item", item: rollGun(Math.min(3, danger), [65, 27, 7, 1, 0]) });
  if (elite) {
    out.push({ kind: "salt", n: int(60, 120) }, rollAmmo(), res("elec", 1, 3), item("medkit"));
    out.push({ kind: "item", item: rollGun(Math.min(3, danger + 1), [20, 40, 30, 9, 1]) });
    if (rnd() < 0.15 + danger * 0.05) out.push(rollBlueprint());
  }
  return out;
}
