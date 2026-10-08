/**
 * Everything a player can own. Gear (weapons, tools, armour, medicine, lockpicks) lives in inventory
 * slots; raw materials and ammo are plain counters so that farming never fights the backpack.
 */

import { AFFIXES, RARITIES, WEAPONS, WEAPON_BY_ID, gunValue } from "./weapons";

export type ResId = "wood" | "stone" | "ore" | "iron" | "scrap" | "cloth" | "hide" | "meat" | "chem" | "powder" | "elec" | "crystal";

export const RES_ORDER: ResId[] = ["wood", "stone", "ore", "iron", "scrap", "cloth", "hide", "meat", "chem", "powder", "elec", "crystal"];

export const RES: Record<ResId, { name: string; color: string; hint: string }> = {
  wood: { name: "Дерево", color: "#b98a52", hint: "Любые деревья. Рубится топором." },
  stone: { name: "Камень", color: "#a39a8b", hint: "Валуны. Добывается киркой." },
  ore: { name: "Железная руда", color: "#c9743f", hint: "Рыжие валуны, больше всего в нагорье. Плавится в печи." },
  iron: { name: "Железо", color: "#c5ccd3", hint: "Слитки из печи: руда или металлолом." },
  scrap: { name: "Металлолом", color: "#8d6b52", hint: "Кучи в РТ, бочки." },
  cloth: { name: "Ткань", color: "#d9cdb4", hint: "Волокнистые кусты с цветами, бандиты." },
  hide: { name: "Шкура", color: "#8a6b4d", hint: "Охота: олени, кабаны, волки, крокодилы." },
  meat: { name: "Мясо", color: "#c0564a", hint: "Охота. Жарится в еду, которая лечит." },
  chem: { name: "Химия", color: "#7cc46a", hint: "Бочки и ящики." },
  powder: { name: "Порох", color: "#5a5a5a", hint: "Крафтится из химии и дерева." },
  elec: { name: "Электроника", color: "#4fb6a8", hint: "Сундуки, военные ящики, металлолом." },
  crystal: { name: "Кристаллы", color: "#7fe3ff", hint: "Редкие жилы в нагорье и шахте. Нужна железная кирка." },
};

export type ArmorSlot = "head" | "chest" | "legs" | "feet";
export const ARMOR_SLOTS: ArmorSlot[] = ["head", "chest", "legs", "feet"];
export const SLOT_NAMES: Record<ArmorSlot, string> = { head: "Голова", chest: "Торс", legs: "Ноги", feet: "Обувь" };

export type ToolType = "rock" | "axe" | "pick";

export interface ToolDef {
  type: ToolType;
  tier: number;
  /** Node hit points removed per swing with the right tool for the job. */
  power: number;
  /** Seconds per swing. */
  interval: number;
  /** Damage to enemies per swing. */
  melee: number;
  /** Motor tools run continuously while the trigger is held. */
  motor?: boolean;
}

export interface ArmorDef {
  slot: ArmorSlot;
  tier: number;
  /** Share of incoming damage this piece absorbs. */
  prot: number;
}

export interface MedDef {
  heal: number;
  /** Seconds to apply. */
  time: number;
}

export type ItemKind = "weapon" | "tool" | "armor" | "med" | "misc";

export interface ItemDef {
  id: string;
  name: string;
  kind: ItemKind;
  /** Max stack size; 1 = every copy is its own item. */
  stack: number;
  /** Salt the trader pays. */
  value: number;
  desc: string;
  tool?: ToolDef;
  armor?: ArmorDef;
  med?: MedDef;
  /** A blueprint: studying it unlocks the recipes tagged with this id. */
  bp?: string;
}

/** One stack in an inventory slot. Guns carry their rarity and affixes. */
export interface Item {
  uid: string;
  id: string;
  n: number;
  rarity?: number;
  affixes?: string[];
  /** The free kit handed out on every spawn: worth nothing to the trader. */
  starter?: boolean;
}

const defs: ItemDef[] = [];

for (const w of WEAPONS) {
  defs.push({ id: w.id, name: w.name, kind: "weapon", stack: 1, value: 0, desc: "" });
}

const TOOLS: [string, string, ToolDef, number, string][] = [
  ["rock", "Рубило", { type: "rock", tier: 0, power: 1, interval: 0.85, melee: 14 }, 0, "Острый камень. Добывает всё, но медленно."],
  ["axe_stone", "Каменный топор", { type: "axe", tier: 1, power: 2, interval: 0.8, melee: 20 }, 15, "Рубит саксаул вдвое быстрее рубила."],
  ["axe_iron", "Железный топор", { type: "axe", tier: 2, power: 3.5, interval: 0.72, melee: 28 }, 60, "Дерево валится за три удара."],
  ["axe_steel", "Стальной топор", { type: "axe", tier: 3, power: 5.5, interval: 0.64, melee: 36 }, 160, "Заводская сталь с кораблей."],
  ["chainsaw", "Бензопила", { type: "axe", tier: 4, power: 1.5, interval: 0.12, melee: 9, motor: true }, 500, "Зажми и веди по стволу."],
  ["pick_stone", "Каменная кирка", { type: "pick", tier: 1, power: 2, interval: 0.8, melee: 18 }, 15, "Для камня, руды и металлолома."],
  ["pick_iron", "Железная кирка", { type: "pick", tier: 2, power: 3.5, interval: 0.72, melee: 26 }, 60, "Берёт кристаллы соли."],
  ["pick_steel", "Стальная кирка", { type: "pick", tier: 3, power: 5.5, interval: 0.64, melee: 34 }, 160, "Валун — за три удара."],
  ["jackhammer", "Отбойный молоток", { type: "pick", tier: 4, power: 1.5, interval: 0.12, melee: 9, motor: true }, 500, "Зажми и долби."],
];
for (const [id, name, tool, value, desc] of TOOLS) defs.push({ id, name, kind: "tool", stack: 1, value, desc, tool });

const ARMOR_SETS: { key: string; tier: number; names: [string, string, string, string]; prot: [number, number, number, number]; value: number; desc: string }[] = [
  { key: "cloth", tier: 1, names: ["Повязка", "Рубаха", "Штаны", "Обмотки"], prot: [0.03, 0.06, 0.04, 0.02], value: 8, desc: "Тряпьё: лучше, чем ничего." },
  { key: "hide", tier: 2, names: ["Кожаный шлем", "Кожаная куртка", "Кожаные штаны", "Кожаные сапоги"], prot: [0.06, 0.1, 0.07, 0.04], value: 30, desc: "Волчья шкура держит укус и рикошет." },
  { key: "plate", tier: 3, names: ["Каска из жести", "Пластинчатый жилет", "Набедренники", "Кованые ботинки"], prot: [0.09, 0.16, 0.11, 0.06], value: 90, desc: "Корабельное железо на ремнях." },
  { key: "kevlar", tier: 4, names: ["Тактический шлем", "Бронежилет", "Тактические штаны", "Берцы"], prot: [0.13, 0.22, 0.15, 0.08], value: 260, desc: "Военное снаряжение: кевлар и керамика." },
];
export const ARMOR_SET_KEYS = ARMOR_SETS.map((s) => s.key);
for (const set of ARMOR_SETS) {
  ARMOR_SLOTS.forEach((slot, i) => {
    defs.push({
      id: `${set.key}_${slot}`, name: set.names[i], kind: "armor", stack: 1, value: set.value, desc: set.desc,
      armor: { slot, tier: set.tier, prot: set.prot[i] },
    });
  });
}

defs.push(
  { id: "bandage", name: "Бинт", kind: "med", stack: 5, value: 8, desc: "Зажми ЛКМ: +25 здоровья.", med: { heal: 25, time: 2.0 } },
  { id: "medkit", name: "Аптечка", kind: "med", stack: 3, value: 30, desc: "Зажми ЛКМ: +60 здоровья.", med: { heal: 60, time: 3.5 } },
  { id: "milkit", name: "Военная аптечка", kind: "med", stack: 2, value: 90, desc: "Зажми ЛКМ: полное здоровье. Только из военных ящиков.", med: { heal: 100, time: 2.5 } },
  { id: "lockpick", name: "Отмычка", kind: "misc", stack: 20, value: 4, desc: "Открывает сундуки и военные ящики. Ломается при ошибке." },
);

/** Blueprints gate the best gear: they are found in monuments, never crafted, and can be traded. */
export const BLUEPRINTS: Record<string, string> = {
  kevlar: "Кевларовая броня",
  chainsaw: "Бензопила",
  jackhammer: "Отбойный молоток",
  shershen: "Шершень",
  akm_aral: "АКМ-Арал",
  val: "Вал",
  saiga: "Сайга-А",
  svd: "СВД-Соль",
  rpk: "РПК",
};
for (const [bp, name] of Object.entries(BLUEPRINTS)) {
  defs.push({ id: `bp_${bp}`, name: `Чертёж: ${name}`, kind: "misc", stack: 1, value: 150, desc: "Изучи на базе, чтобы открыть рецепт. Можно продать или передать.", bp });
}
defs.push({ id: "cooked", name: "Жареное мясо", kind: "med", stack: 10, value: 6, desc: "Зажми ЛКМ: +18 здоровья.", med: { heal: 18, time: 1.4 } });

export const ITEMS: Record<string, ItemDef> = Object.fromEntries(defs.map((d) => [d.id, d]));

let uidSeq = 0;
export function newUid(): string {
  return `${Date.now().toString(36)}${(uidSeq++).toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function newItem(id: string, n = 1): Item {
  return { uid: newUid(), id, n };
}

export function newGun(id: string, rarity: number): Item {
  const pool = [...AFFIXES];
  const affixes: string[] = [];
  for (let i = 0; i < RARITIES[rarity].affixes && pool.length; i++) {
    affixes.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0].id);
  }
  return { uid: newUid(), id, n: 1, rarity, affixes };
}

export function isGun(item: Item): boolean {
  return !!WEAPON_BY_ID[item.id];
}

/** Colour of the item's frame in the UI. */
export function itemColor(item: Item): string {
  if (isGun(item)) return RARITIES[item.rarity ?? 0].color;
  const d = ITEMS[item.id];
  const tier = d?.tool?.tier ?? d?.armor?.tier ?? 0;
  return ["#b8c0c8", "#b8c0c8", "#5fbf5a", "#3d8bff", "#a64dff"][tier] ?? "#b8c0c8";
}

export function itemValue(item: Item): number {
  if (item.starter) return 0;
  if (isGun(item)) return gunValue(item);
  return (ITEMS[item.id]?.value ?? 0) * item.n;
}

export function armorProt(armor: (Item | null)[]): number {
  let p = 0;
  for (const a of armor) if (a) p += ITEMS[a.id]?.armor?.prot ?? 0;
  return Math.min(0.7, p);
}
