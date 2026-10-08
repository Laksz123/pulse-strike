/**
 * Career: what a player becomes by playing. Six professions level up by doing their job, the
 * trader's contracts give each mission a purpose, and ranks sum it all up.
 */

import type { ResId } from "./items";

export type SkillId = "lumber" | "miner" | "hunter" | "thief" | "gunner" | "survivor";
export const SKILL_ORDER: SkillId[] = ["lumber", "miner", "hunter", "thief", "gunner", "survivor"];
export const MAX_SKILL = 10;

export interface SkillDef {
  name: string;
  /** How it is earned. */
  how: string;
  /** Bonus that grows every level. */
  per: string;
  /** Perks at levels 5 and 10. */
  perk5: string;
  perk10: string;
}

export const SKILLS: Record<SkillId, SkillDef> = {
  lumber: { name: "Лесоруб", how: "Рубка деревьев", per: "+6% дерева за уровень", perk5: "Топор бьёт на 15% быстрее", perk10: "Каждое дерево даёт ещё и ткань" },
  miner: { name: "Шахтёр", how: "Камень, руда, металлолом", per: "+6% добычи за уровень", perk5: "Кирка бьёт на 15% быстрее", perk10: "+25% кристаллов" },
  hunter: { name: "Охотник", how: "Охота на зверей", per: "+8% урона по зверям за уровень", perk5: "+1 шкура с каждого зверя", perk10: "+1 мясо, звери замечают позже" },
  thief: { name: "Взломщик", how: "Замки и ящики", per: "Зелёная зона шире на 4% за уровень", perk5: "Стрелка замка на 15% медленнее", perk10: "30% шанс не сломать отмычку" },
  gunner: { name: "Стрелок", how: "Бои с людьми", per: "−2% перезарядки и −3% отдачи за уровень", perk5: "+10% урона в голову", perk10: "+10% урона по людям" },
  survivor: { name: "Выживальщик", how: "Завершённые миссии", per: "+3 здоровья за уровень", perk5: "Лечение на 25% быстрее", perk10: "Самолечение вне боя" },
};

export function skillLevel(xp: number): number {
  return Math.min(MAX_SKILL, Math.floor(Math.sqrt(xp / 30)));
}

/** Progress to the next level, 0..1. */
export function skillProgress(xp: number): number {
  const l = skillLevel(xp);
  if (l >= MAX_SKILL) return 1;
  return (xp - l * l * 30) / ((l + 1) * (l + 1) * 30 - l * l * 30);
}

export const RANKS = ["Новичок", "Собиратель", "Следопыт", "Охотник", "Сталкер", "Ветеран", "Легенда острова"];

export function rankOf(level: number): string {
  return RANKS[Math.min(RANKS.length - 1, Math.floor((level - 1) / 3))];
}

/** Things that happen in a mission and can count toward a contract. */
export type GameEvent =
  | "kill:animal" | "kill:human" | "kill:elite" | "kill:boss" | "kill:panther"
  | "open:barrel" | "open:chest" | "open:military" | "extract";

export interface ContractDef {
  id: string;
  text: string;
  /** Either hand over resources or do something `n` times. */
  res?: ResId;
  event?: GameEvent;
  n: number;
  salt: number;
  rep: number;
  /** Reputation needed before the trader offers it. */
  minRep: number;
}

export const CONTRACTS: ContractDef[] = [
  { id: "wood30", text: "Принеси 30 дерева", res: "wood", n: 30, salt: 60, rep: 20, minRep: 0 },
  { id: "stone20", text: "Принеси 20 камня", res: "stone", n: 20, salt: 60, rep: 20, minRep: 0 },
  { id: "hide6", text: "Принеси 6 шкур", res: "hide", n: 6, salt: 90, rep: 25, minRep: 0 },
  { id: "animals5", text: "Убей 5 зверей", event: "kill:animal", n: 5, salt: 80, rep: 25, minRep: 0 },
  { id: "barrels6", text: "Обыщи 6 бочек", event: "open:barrel", n: 6, salt: 70, rep: 20, minRep: 0 },
  { id: "extract2", text: "Заверши 2 миссии живым", event: "extract", n: 2, salt: 100, rep: 30, minRep: 0 },
  { id: "iron15", text: "Принеси 15 железа", res: "iron", n: 15, salt: 180, rep: 40, minRep: 100 },
  { id: "meat10", text: "Принеси 10 мяса", res: "meat", n: 10, salt: 140, rep: 35, minRep: 100 },
  { id: "humans8", text: "Убей 8 врагов в РТ", event: "kill:human", n: 8, salt: 220, rep: 45, minRep: 100 },
  { id: "chests3", text: "Взломай 3 сундука", event: "open:chest", n: 3, salt: 200, rep: 45, minRep: 100 },
  { id: "elite1", text: "Убей главаря любой РТ", event: "kill:elite", n: 1, salt: 350, rep: 70, minRep: 250 },
  { id: "crystal4", text: "Принеси 4 кристалла", res: "crystal", n: 4, salt: 400, rep: 70, minRep: 250 },
  { id: "panther1", text: "Убей пантеру", event: "kill:panther", n: 1, salt: 300, rep: 60, minRep: 250 },
  { id: "military1", text: "Взломай военный ящик", event: "open:military", n: 1, salt: 320, rep: 60, minRep: 250 },
  { id: "boss1", text: "Убей Капитана на кладбище кораблей", event: "kill:boss", n: 1, salt: 1200, rep: 200, minRep: 450 },
];

export const CONTRACT_BY_ID: Record<string, ContractDef> = Object.fromEntries(CONTRACTS.map((c) => [c.id, c]));

export const REP_TIERS = [0, 100, 250, 450];
export const REP_NAMES = ["Чужак", "Знакомый", "Свой", "Партнёр"];

export function repTier(rep: number): number {
  let t = 0;
  for (let i = 0; i < REP_TIERS.length; i++) if (rep >= REP_TIERS[i]) t = i;
  return t;
}
