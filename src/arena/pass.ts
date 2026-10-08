/**
 * The battle pass: thirty levels a season, two tracks of rewards.
 * The free track is for everyone. The premium track is bought once per season for SOL and pays
 * out more of everything, plus skins and agents that exist nowhere else — which is what makes
 * them worth something on the market.
 */

import { AGENT_BY_ID } from "./agents";
import { MARKER_BY_ID, PATTERNS } from "./markers";

export const SEASON = { id: "s1", name: "Сезон 1 · First Strike", levels: 30, xpPerLevel: 400, priceSol: 0.05, bonus: 1.2 };

export type Reward =
  | { kind: "coins"; n: number }
  | { kind: "case"; n: number }
  | { kind: "skin"; id: string; skin: number }
  | { kind: "agent"; id: string };

const c = (n: number): Reward => ({ kind: "coins", n });
const k = (n = 1): Reward => ({ kind: "case", n });
const s = (id: string, skin: number): Reward => ({ kind: "skin", id, skin });
const a = (id: string): Reward => ({ kind: "agent", id });

/** Rewards by level: index 0 is level 1. */
export const PASS_FREE: Reward[] = [
  c(100), c(100), s("sprinter", 1), c(150), k(), c(150), c(150), s("dvoyka", 2), c(200), k(),
  c(200), a("wrench"), c(200), c(250), k(), c(250), s("treshotka", 3), c(250), c(300), k(),
  c(300), s("zalp", 6), c(300), c(350), k(), c(350), a("scout"), c(400), c(400), s("dalnoboy", 8),
];

export const PASS_PREMIUM: Reward[] = [
  k(), c(300), c(300), k(), s("baraban", 11), c(300), k(), c(400), a("brass"), s("treshotka", 11),
  c(400), k(2), c(400), a("marshal"), s("impuls", 11), k(), c(500), s("ochered", 7), k(), s("dalnoboy", 11),
  c(500), k(2), a("hazard"), c(600), s("roy", 12), k(), c(600), s("k_karambit", 11), s("sverhnova", 12), a("phantom"),
];

/** Levels completed: a level's reward can be claimed once this reaches it. */
export function passLevel(xp: number): number {
  return Math.min(SEASON.levels, Math.floor(xp / SEASON.xpPerLevel));
}

/** Progress through the current level, 0..1. */
export function passProgress(xp: number): number {
  return passLevel(xp) >= SEASON.levels ? 1 : (xp % SEASON.xpPerLevel) / SEASON.xpPerLevel;
}

export function rewardName(r: Reward): string {
  if (r.kind === "coins") return `${r.n} монет`;
  if (r.kind === "case") return r.n > 1 ? `Кейсы ×${r.n}` : "Кейс";
  if (r.kind === "skin") return `${MARKER_BY_ID[r.id].name} | ${PATTERNS[r.skin].name}`;
  return `Агент ${AGENT_BY_ID[r.id].name}`;
}

export function rewardRarity(r: Reward): number {
  if (r.kind === "skin") return Math.max(PATTERNS[r.skin].rarity, 1);
  if (r.kind === "agent") return AGENT_BY_ID[r.id].rarity;
  return r.kind === "case" ? 2 : 0;
}

export type PassEvent = "kill" | "head" | "win" | "match" | "bomb";

export interface MissionDef {
  id: string;
  text: string;
  need: number;
  event: PassEvent;
  xp: number;
}

export const MISSIONS: MissionDef[] = [
  { id: "kills", text: "Сделай 15 убийств", need: 15, event: "kill", xp: 300 },
  { id: "heads", text: "5 убийств в голову", need: 5, event: "head", xp: 300 },
  { id: "wins", text: "Выиграй 2 матча", need: 2, event: "win", xp: 400 },
  { id: "bomb", text: "Заложи или обезвредь бомбу 2 раза", need: 2, event: "bomb", xp: 400 },
  { id: "matches", text: "Сыграй 3 матча", need: 3, event: "match", xp: 300 },
];

export const MISSION_BY_ID: Record<string, MissionDef> = Object.fromEntries(MISSIONS.map((m) => [m.id, m]));

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Three missions for a day: the same three for everyone. */
export function dailyMissions(day: string): string[] {
  let h = 0;
  for (const ch of day) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const ids = MISSIONS.map((m) => m.id);
  const out: string[] = [];
  while (out.length < 3) {
    const pick = ids.splice(h % ids.length, 1)[0];
    out.push(pick);
    h = Math.floor(h / 7) + 13;
  }
  return out;
}
