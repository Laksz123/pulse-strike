/**
 * The cases: ten kinds, each with its own list of what can come out of it.
 *
 * Three are everyday cases — cheap, and nothing in them above a rare skin. The other seven are
 * where the good things are: epic, legendary and ultra skins, agents, and a small chance of a
 * blade. What a case holds is written out here item by item, so the game can show it before the
 * case is opened: rarity, chance and roughly what it goes for on the market.
 */

import { AGENT_BY_ID } from "./agents";
import { MARKER_BY_ID, PATTERNS, itemRarity } from "./markers";

/** Something a case can give: a weapon in a skin, or an agent. */
export type Drop = { kind: "w"; id: string; skin: number } | { kind: "a"; id: string };

export interface CaseDef {
  id: string;
  name: string;
  about: string;
  /** 0 everyday, 1 good, 2 the best. */
  tier: 0 | 1 | 2;
  /** Coins. */
  price: number;
  /** Its colour on the screen. */
  color: string;
  /** Weapon skins inside, as "weapon:pattern". */
  items: [string, number][];
  /** Chance of each rarity among those skins, 0..5; rarities with nothing in them are skipped. */
  odds: number[];
  /** Blades: the chance in percent of getting one instead of a skin, and which. */
  knives?: { chance: number; ids: string[] };
  /** Agents, the same way. */
  agents?: { chance: number; ids: string[] };
}

const list = (text: string): [string, number][] => text.split(" ").map((p) => [p.split(":")[0], Number(p.split(":")[1])]);

export const CASES: CaseDef[] = [
  {
    id: "starter", name: "Starter", tier: 0, price: 120, color: "#c9925a",
    about: "Картонная коробка для новичка: простые расцветки на базовое оружие.",
    items: list("dvoyka:1 dvoyka:2 baraban:1 sprinter:2 sprinter:1 zalp:2 treshotka:1 ochered:2 veer:1 rikoshet:2 baraban:3 sprinter:4 treshotka:5"),
    odds: [70, 25, 5],
  },
  {
    id: "street", name: "Street", tier: 0, price: 180, color: "#8fd44a",
    about: "Ящик с улицы: необычные скины, изредка редкий.",
    items: list("dvoyka:3 baraban:4 sprinter:3 zalp:4 treshotka:3 ochered:4 veer:3 rikoshet:4 zalp:5 sprinter:6 dvoyka:6 treshotka:6 baraban:5"),
    odds: [0, 72, 28],
  },
  {
    id: "supply", name: "Supply", tier: 0, price: 220, color: "#7f9a52",
    about: "Армейский ящик: штурмовое оружие в рабочих расцветках.",
    items: list("ochered:1 veer:2 rikoshet:1 ochered:3 veer:4 rikoshet:3 zalp:1 treshotka:2 sprinter:5 treshotka:4 zalp:6 veer:5 rikoshet:6"),
    odds: [12, 62, 26],
  },
  {
    id: "neon", name: "Neon", tier: 1, price: 450, color: "#ff4fa8",
    about: "Светится в темноте: эпические скины Neon и шанс на нож.",
    items: list("dvoyka:7 baraban:7 sprinter:7 zalp:7 treshotka:7 ochered:7 veer:7 rikoshet:7 gidrant:7 lipuchka:7 raduga:7 dalnoboy:7 mortira:6 gidrant:3 lipuchka:5 sprinter:5 zalp:6 treshotka:6 dvoyka:5 roy:7 sverhnova:7"),
    odds: [0, 0, 55, 36, 7, 2],
    knives: { chance: 2.5, ids: ["k_butterfly", "k_kunai"] },
    agents: { chance: 3, ids: ["neon"] },
  },
  {
    id: "sunset", name: "Sunset", tier: 1, price: 450, color: "#ffb03a",
    about: "Закатная коллекция: Sunset, Tiger и Cherry Wood, шанс на нож.",
    items: list("dvoyka:8 sprinter:8 zalp:8 treshotka:8 ochered:8 veer:8 rikoshet:8 gidrant:8 mortira:8 raduga:8 dvoyka:6 baraban:5 sprinter:6 zalp:5 treshotka:5 ochered:6 roy:8 sverhnova:8"),
    odds: [0, 0, 56, 35, 7, 2],
    knives: { chance: 2.5, ids: ["k_karambit", "k_machete"] },
  },
  {
    id: "agent", name: "Agent", tier: 1, price: 550, color: "#4aa8ff",
    about: "Шкафчик с формой: почти в каждом втором — агент.",
    items: list("dvoyka:3 baraban:4 sprinter:3 zalp:4 treshotka:5 ochered:6 veer:5 rikoshet:6 sprinter:8 treshotka:7"),
    odds: [0, 50, 36, 14],
    agents: { chance: 40, ids: ["wrench", "scout", "brass", "marshal", "neon", "titan"] },
  },
  {
    id: "blade", name: "Blade", tier: 1, price: 700, color: "#e0483c",
    about: "Оружейный футляр: нож в каждом восьмом, любой из десяти.",
    items: list("dvoyka:5 baraban:6 sprinter:5 zalp:6 treshotka:5 ochered:5 veer:6 rikoshet:5 sprinter:7 zalp:8 treshotka:8 dvoyka:7 ochered:9"),
    odds: [0, 0, 62, 30, 8],
    knives: { chance: 12, ids: ["k_combat", "k_kunai", "k_cleaver", "k_machete", "k_karambit", "k_butterfly", "k_tomahawk", "k_katana", "k_ripper", "k_saber"] },
  },
  {
    id: "gold", name: "Gold", tier: 2, price: 800, color: "#ffc93a",
    about: "Сундук с золотом: легендарные скины Gold выпадают часто.",
    items: list("dvoyka:9 baraban:9 sprinter:9 zalp:9 treshotka:9 ochered:9 dalnoboy:9 raduga:9 sprinter:7 zalp:8 treshotka:7 veer:8 rikoshet:7 gidrant:6 lipuchka:5 mortira:5 ochered:6 sverhnova:9"),
    odds: [0, 0, 48, 36, 13, 3],
    knives: { chance: 3, ids: ["k_cleaver", "k_tomahawk"] },
  },
  {
    id: "cosmos", name: "Cosmos", tier: 2, price: 1000, color: "#7c6bff",
    about: "Капсула из космоса: единственный кейс со скинами Cosmos.",
    items: list("sprinter:10 treshotka:10 dalnoboy:10 raduga:10 impuls:10 dvoyka:9 zalp:9 ochered:9 veer:9 baraban:7 sprinter:8 zalp:7 rikoshet:8 gidrant:8 lipuchka:7 mortira:6 gidrant:5 lipuchka:6"),
    odds: [0, 0, 42, 36, 16, 6],
    knives: { chance: 3, ids: ["k_katana", "k_ripper"] },
  },
  {
    id: "champion", name: "Champion", tier: 2, price: 1500, color: "#b06bff",
    about: "Лучший кейс игры: только эпические и выше, световой меч и редчайшие ножи.",
    items: list("sverhnova:10 roy:10 dalnoboy:10 ochered:10 zalp:10 sverhnova:9 raduga:9 impuls:9 roy:9 treshotka:9 sprinter:9 dalnoboy:8 raduga:7 impuls:8 mortira:8 lipuchka:8 gidrant:7 mortira:7"),
    odds: [0, 0, 0, 58, 30, 12],
    knives: { chance: 5, ids: ["k_saber", "k_katana", "k_karambit", "k_butterfly"] },
    agents: { chance: 3, ids: ["titan"] },
  },
];

export const CASE_BY_ID: Record<string, CaseDef> = Object.fromEntries(CASES.map((c) => [c.id, c]));
export const TIER_NAMES = ["Обычный", "Редкий", "Элитный"];
export const caseArt = (id: string) => `/art/case_${CASE_BY_ID[id] ? id : "starter"}.png`;

/** Roughly what a thing of each rarity goes for on the market, in SOL: a guide, not a quote. */
export const MARKET_SOL = [0.002, 0.005, 0.012, 0.03, 0.08, 0.25];

export function dropRarity(d: Drop): number {
  return d.kind === "a" ? AGENT_BY_ID[d.id]?.rarity ?? 1 : itemRarity({ id: d.id, skin: d.skin });
}

export function dropName(d: Drop): string {
  if (d.kind === "a") return `Агент ${AGENT_BY_ID[d.id].name}`;
  const def = MARKER_BY_ID[d.id];
  return def.melee && d.skin === 0 ? def.name : `${def.name} | ${PATTERNS[d.skin].name}`;
}

/** A blade is worth more than a skin of the same rarity. */
export function dropWorth(d: Drop): number {
  const blade = d.kind === "w" && !!MARKER_BY_ID[d.id]?.melee;
  return MARKET_SOL[dropRarity(d)] * (blade ? 2.5 : d.kind === "a" ? 1.4 : 1);
}

export interface Content {
  drop: Drop;
  rarity: number;
  /** Percent. */
  chance: number;
  /** A blade: it comes in a skin of its own. */
  blade: boolean;
}

/** The skins of a case sorted into rarities, keeping only the rarities its odds allow. */
function byRarity(c: CaseDef): { rarity: number; share: number; items: [string, number][] }[] {
  const groups = c.odds.map((share, rarity) => ({ rarity, share, items: c.items.filter(([id, skin]) => itemRarity({ id, skin }) === rarity) })).filter((g) => g.share > 0 && g.items.length);
  const total = groups.reduce((n, g) => n + g.share, 0);
  return groups.map((g) => ({ ...g, share: g.share / total }));
}

/** Everything a case can give, best first, each with its chance. */
export function contents(c: CaseDef): Content[] {
  const knife = c.knives?.chance ?? 0;
  const agent = c.agents?.chance ?? 0;
  const rest = 100 - knife - agent;
  const out: Content[] = [];
  for (const id of c.knives?.ids ?? []) out.push({ drop: { kind: "w", id, skin: 0 }, rarity: dropRarity({ kind: "w", id, skin: 0 }), chance: knife / c.knives!.ids.length, blade: true });
  for (const id of c.agents?.ids ?? []) out.push({ drop: { kind: "a", id }, rarity: AGENT_BY_ID[id].rarity, chance: agent / c.agents!.ids.length, blade: false });
  for (const g of byRarity(c)) for (const [id, skin] of g.items) out.push({ drop: { kind: "w", id, skin }, rarity: g.rarity, chance: (rest * g.share) / g.items.length, blade: false });
  return out.sort((a, b) => Number(b.blade) - Number(a.blade) || b.rarity - a.rarity || a.chance - b.chance);
}

const any = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

/** Opens a case: what came out. A blade comes in a random skin, rarer ones less often. */
export function rollFrom(c: CaseDef): Drop {
  const r = Math.random() * 100;
  if (c.knives && r < c.knives.chance) {
    const odds = [40, 26, 16, 10, 6, 2];
    let pick = Math.random() * 100;
    const rarity = odds.findIndex((o) => (pick -= o) < 0);
    const skins = PATTERNS.map((p, i) => ({ p, i })).filter((x) => !x.p.pass && x.p.rarity === Math.max(0, rarity));
    return { kind: "w", id: any(c.knives.ids), skin: skins.length ? any(skins).i : 0 };
  }
  if (c.agents && r < (c.knives?.chance ?? 0) + c.agents.chance) return { kind: "a", id: any(c.agents.ids) };
  const groups = byRarity(c);
  let pick = Math.random();
  const g = groups.find((x) => (pick -= x.share) < 0) ?? groups[0];
  const [id, skin] = any(g.items);
  return { kind: "w", id, skin };
}

/** The case that comes with reaching a level: an everyday one, and every fifth level a good one. */
export function levelCase(level: number): string {
  if (level % 5 === 0) return ["neon", "sunset", "agent"][Math.floor(level / 5) % 3];
  return ["starter", "street", "supply"][level % 3];
}
