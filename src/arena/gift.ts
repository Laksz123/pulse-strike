/**
 * The welcome wheel: one free spin the first time the game is opened. Eight prizes, and what each
 * is worth decides how often it comes up — coins and cases most of the time, a blade now and then,
 * and Byte, who cannot be had any other way, once in a long while.
 */

import { dropName, dropRarity } from "./cases";
import { rewardName, rewardRarity, type Reward } from "./pass";

export interface Prize {
  reward: Reward;
  /** Chance in percent; the eight add up to a hundred. */
  chance: number;
}

/** In the order they sit on the wheel, clockwise from the top. */
export const WHEEL: Prize[] = [
  { reward: { kind: "agent", id: "byte" }, chance: 3 },
  { reward: { kind: "coins", n: 300 }, chance: 24 },
  { reward: { kind: "skin", id: "sprinter", skin: 6 }, chance: 15 },
  { reward: { kind: "case", id: "neon", n: 1 }, chance: 12 },
  { reward: { kind: "skin", id: "k_karambit", skin: 0 }, chance: 4 },
  { reward: { kind: "coins", n: 700 }, chance: 14 },
  { reward: { kind: "case", id: "street", n: 2 }, chance: 18 },
  { reward: { kind: "skin", id: "treshotka", skin: 7 }, chance: 10 },
];

/** Which prize the wheel stops on. */
export function spinWheel(): number {
  let r = Math.random() * WHEEL.reduce((n, p) => n + p.chance, 0);
  return Math.max(0, WHEEL.findIndex((p) => (r -= p.chance) < 0));
}

export function prizeName(r: Reward): string {
  return r.kind === "skin" ? dropName({ kind: "w", id: r.id, skin: r.skin }) : rewardName(r);
}

export function prizeRarity(r: Reward): number {
  return r.kind === "skin" ? dropRarity({ kind: "w", id: r.id, skin: r.skin }) : rewardRarity(r);
}
