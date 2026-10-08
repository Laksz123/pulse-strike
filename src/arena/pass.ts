/**
 * The battle pass: thirty levels a season, two tracks of rewards.
 * The free track is for everyone. The premium track is bought once per season for SOL and pays
 * out more of everything, plus skins and agents that exist nowhere else — which is what makes
 * them worth something on the market.
 */

import { AGENT_BY_ID } from "./agents";
import { CASE_BY_ID } from "./cases";
import { MARKER_BY_ID, PATTERNS } from "./markers";

export const SEASON = { id: "s1", name: "Сезон 1 · First Strike", levels: 30, xpPerLevel: 400, priceSol: 0.05, bonus: 1.2, ends: "2026-11-08" };

export type Reward =
  | { kind: "coins"; n: number }
  | { kind: "case"; id: string; n: number }
  | { kind: "skin"; id: string; skin: number }
  | { kind: "agent"; id: string };

const c = (n: number): Reward => ({ kind: "coins", n });
const k = (id: string, n = 1): Reward => ({ kind: "case", id, n });
const s = (id: string, skin: number): Reward => ({ kind: "skin", id, skin });
const a = (id: string): Reward => ({ kind: "agent", id });

/** Rewards by level: index 0 is level 1. */
export const PASS_FREE: Reward[] = [
  c(100), k("starter"), s("sprinter", 1), c(150), k("street"), c(150), k("starter"), s("dvoyka", 2), c(200), k("supply"),
  c(200), a("wrench"), k("street"), c(250), k("neon"), c(250), s("treshotka", 3), k("supply"), c(300), k("sunset"),
  c(300), s("zalp", 6), k("starter", 2), c(350), k("agent"), c(350), a("scout"), c(400), k("blade"), s("dalnoboy", 8),
];

export const PASS_PREMIUM: Reward[] = [
  k("neon"), c(300), k("sunset"), c(300), s("baraban", 11), k("agent"), c(400), k("blade"), a("brass"), s("treshotka", 11),
  k("gold"), c(400), k("neon", 2), a("marshal"), s("impuls", 11), k("cosmos"), c(500), s("ochered", 7), k("gold"), s("dalnoboy", 11),
  k("blade", 2), c(500), a("hazard"), k("cosmos"), s("roy", 12), k("champion"), c(600), s("k_karambit", 11), s("sverhnova", 12), a("phantom"),
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
  if (r.kind === "case") return `Кейс ${CASE_BY_ID[r.id]?.name ?? ""}${r.n > 1 ? ` ×${r.n}` : ""}`;
  if (r.kind === "skin") return `${MARKER_BY_ID[r.id].name} | ${PATTERNS[r.skin].name}`;
  return `Агент ${AGENT_BY_ID[r.id].name}`;
}

export function rewardRarity(r: Reward): number {
  if (r.kind === "skin") return Math.max(PATTERNS[r.skin].rarity, 1);
  if (r.kind === "agent") return AGENT_BY_ID[r.id].rarity;
  return r.kind === "case" ? [1, 3, 4][CASE_BY_ID[r.id]?.tier ?? 0] : 0;
}

/** Whole days left in the season. */
export function seasonDaysLeft(): number {
  return Math.max(0, Math.ceil((Date.parse(`${SEASON.ends}T00:00:00Z`) - Date.now()) / 86400000));
}

export type PassEvent = "kill" | "head" | "win" | "match" | "bomb";

export interface MissionDef {
  id: string;
  text: string;
  need: number;
  event: PassEvent;
  xp: number;
}

/** The pool the day's three are drawn from. */
export const MISSIONS: MissionDef[] = [
  { id: "kills", text: "Сделай 15 убийств", need: 15, event: "kill", xp: 300 },
  { id: "kills2", text: "Сделай 30 убийств", need: 30, event: "kill", xp: 500 },
  { id: "heads", text: "5 убийств в голову", need: 5, event: "head", xp: 300 },
  { id: "heads2", text: "10 убийств в голову", need: 10, event: "head", xp: 500 },
  { id: "wins", text: "Выиграй 2 матча", need: 2, event: "win", xp: 400 },
  { id: "win1", text: "Выиграй матч", need: 1, event: "win", xp: 250 },
  { id: "bomb", text: "Заложи или обезвредь бомбу 2 раза", need: 2, event: "bomb", xp: 400 },
  { id: "matches", text: "Сыграй 3 матча", need: 3, event: "match", xp: 300 },
  { id: "matches2", text: "Сыграй 5 матчей", need: 5, event: "match", xp: 450 },
];

/** The long ones: they last the whole season and pay several levels each. */
export const SEASON_MISSIONS: MissionDef[] = [
  { id: "s_kills", text: "Сделай 150 убийств", need: 150, event: "kill", xp: 1600 },
  { id: "s_heads", text: "50 убийств в голову", need: 50, event: "head", xp: 1600 },
  { id: "s_wins", text: "Выиграй 15 матчей", need: 15, event: "win", xp: 2000 },
  { id: "s_bomb", text: "Заложи или обезвредь бомбу 20 раз", need: 20, event: "bomb", xp: 1600 },
  { id: "s_matches", text: "Сыграй 30 матчей", need: 30, event: "match", xp: 1200 },
];

export const MISSION_BY_ID: Record<string, MissionDef> = Object.fromEntries([...MISSIONS, ...SEASON_MISSIONS].map((m) => [m.id, m]));

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Three missions for a day, the same three for everyone, each about something different. */
export function dailyMissions(day: string): string[] {
  let h = 0;
  for (const ch of day) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  let pool = [...MISSIONS];
  const out: string[] = [];
  while (out.length < 3 && pool.length) {
    const pick = pool[h % pool.length];
    out.push(pick.id);
    pool = pool.filter((m) => m.event !== pick.event);
    h = Math.floor(h / 7) + 13;
  }
  return out;
}
