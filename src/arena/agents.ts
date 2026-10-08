/**
 * Agents: the characters players fight as. An agent is a look only — every one moves, shoots and
 * takes damage the same. Like weapon skins, agents are items: they drop from cases, come from the
 * battle pass and are traded on the market.
 */

export interface AgentDef {
  id: string;
  name: string;
  rarity: number;
  about: string;
  /** Jacket, trousers, trim and skin colours. */
  suit: number;
  legs: number;
  trim: number;
  skin: number;
  /** Something on this agent glows in this colour. */
  glow?: number;
  /** Glove colour; dark by default. */
  glove?: number;
  /** Everyone owns this one. */
  free?: boolean;
  /** Battle pass only: never drops from a case. */
  pass?: boolean;
}

export const AGENTS: AgentDef[] = [
  { id: "byte", name: "Byte", rarity: 3, about: "Старый телевизор, который отрастил ноги и характер. Что у него на уме — видно по экрану.", suit: 0xffc21a, legs: 0x26305c, trim: 0x1b2244, skin: 0xf4efe2, glove: 0xf7f7f2, free: true },
  { id: "rookie", name: "Rookie", rarity: 0, about: "Шлем, разгрузка и желание всем что-то доказать.", suit: 0x5b6b4a, legs: 0x3d4636, trim: 0x2a2f2a, skin: 0xe2b48c, free: true },
  { id: "rush", name: "Rush", rarity: 0, about: "Курьер, который доставляет быстрее пули.", suit: 0xf2c230, legs: 0x2b3340, trim: 0x1d2229, skin: 0xc98f62, free: true },
  { id: "wrench", name: "Wrench", rarity: 1, about: "Чинит прототипы прямо под огнём. Маску не снимает.", suit: 0xe8742a, legs: 0x39414f, trim: 0x23272e, skin: 0xd9a57c, glow: 0xffb347 },
  { id: "scout", name: "Scout", rarity: 1, about: "Видит тебя раньше, чем ты его.", suit: 0x6f7f3a, legs: 0x5a4a32, trim: 0xb9a26a, skin: 0xb9825a },
  { id: "brass", name: "Brass", rarity: 2, about: "Тяжёлый скафандр, латунный шлем и ноль суеты.", suit: 0x2f6fb0, legs: 0x24507f, trim: 0xd9a441, skin: 0xe2b48c, glow: 0x7fe3ff },
  { id: "marshal", name: "Marshal", rarity: 2, about: "Шляпа, плащ и значок. Стреляет первым.", suit: 0x7a5230, legs: 0x2b2a3a, trim: 0xd9a441, skin: 0xc98f62 },
  { id: "neon", name: "Neon", rarity: 3, about: "Светится в темноте. Говорит, что так задумано.", suit: 0x1b1d2a, legs: 0x14151f, trim: 0xff2bd6, skin: 0xe8c3a0, glow: 0x18f0ff },
  { id: "titan", name: "Titan", rarity: 4, about: "Золотая силовая броня. Отступать не обучен.", suit: 0xb3202a, legs: 0x2a2c33, trim: 0xf2b824, skin: 0xb9825a, glow: 0x7fe3ff },
  { id: "hazard", name: "Hazard", rarity: 4, about: "Костюм химзащиты и два фильтра. Что внутри — не спрашивай.", suit: 0xf1f3f5, legs: 0xdfe4ea, trim: 0xff7a1a, skin: 0xe2b48c, glow: 0x7dff5a, pass: true },
  { id: "phantom", name: "Phantom", rarity: 5, about: "Никто не видел его лица. Только глаза.", suit: 0x1a1426, legs: 0x110d1a, trim: 0x7a3df0, skin: 0x1a1426, glow: 0xb48cff, pass: true },
];

export const AGENT_BY_ID: Record<string, AgentDef> = Object.fromEntries(AGENTS.map((a) => [a.id, a]));
export const DEFAULT_AGENT = "byte";
/** Sleeve and glove colours of each agent, for the arms seen in first person. */
export const ARM_COLORS: Record<string, [number, number]> = {
  byte: [0xffc21a, 0xf7f7f2], rookie: [0x7a9a4e, 0x3f4f2c], rush: [0xe5383b, 0x2a2d36], wrench: [0x3a4150, 0x8a5a2b], scout: [0xd2b272, 0xb9825a],
  brass: [0x2f5f9e, 0x8a3b24], marshal: [0x8a5a34, 0xc98a4a], neon: [0x1b1d2a, 0x2a2c3c], titan: [0xf2b824, 0x3a3d47], hazard: [0xf1f3f5, 0xffd21a], phantom: [0x211a33, 0x3a2c5a],
};

/** One agent a player owns. */
export interface AgentItem {
  uid: string;
  id: string;
  serial: number;
  starter?: boolean;
}

/** Coins the shop pays for an agent of this rarity. */
export const AGENT_VALUE = [60, 140, 360, 900, 2400, 7000];
/** Chance that a case holds an agent instead of a weapon skin, percent. */
export const AGENT_CHANCE = 8;
export const AGENT_ODDS = [0, 55, 30, 12, 3, 0];

let seq = 0;
export function newAgent(id: string, starter = false): AgentItem {
  return { uid: `a${Date.now().toString(36)}${(seq++).toString(36)}${Math.floor(Math.random() * 1e5).toString(36)}`, id, serial: 1 + Math.floor(Math.random() * 9999), starter: starter || undefined };
}

export function agentValue(item: AgentItem): number {
  return item.starter ? 0 : AGENT_VALUE[AGENT_BY_ID[item.id].rarity];
}

/** An agent out of a case. */
export function rollAgent(): AgentItem {
  let r = Math.random() * AGENT_ODDS.reduce((a, b) => a + b, 0);
  let rarity = 1;
  for (let i = 0; i < AGENT_ODDS.length; i++) {
    r -= AGENT_ODDS[i];
    if (r < 0) {
      rarity = i;
      break;
    }
  }
  const pool = AGENTS.filter((a) => a.rarity === rarity && !a.pass && !a.free);
  const pick = pool.length ? pool : AGENTS.filter((a) => !a.pass && !a.free);
  return newAgent(pick[Math.floor(Math.random() * pick.length)].id);
}
