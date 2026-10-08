/**
 * The shop: what coins are for. Coins come from playing; they buy cases, and each day a handful
 * of skins and agents picked for that day. Nothing can be sold back for coins — an item's way
 * out of the inventory is the market, for SOL.
 */

import { AGENTS } from "./agents";
import { GUNS, PATTERNS, itemRarity } from "./markers";
import type { Reward } from "./pass";

/** Coin prices by rarity. Ultra items are never sold: they are found, earned or traded. */
export const SKIN_PRICE = [150, 300, 700, 1600, 4000, 0];
export const AGENT_PRICE = [0, 900, 1800, 3500, 8000, 0];

export const CASE_PACKS = [
  { n: 1, price: 250, tag: "" },
  { n: 5, price: 1100, tag: "−12%" },
  { n: 10, price: 2000, tag: "−20%" },
];

/** Coins for SOL: the one place real value comes into the economy. */
export const COIN_PACKS = [
  { id: "s", coins: 1000, sol: 0.01, tag: "" },
  { id: "m", coins: 5500, sol: 0.05, tag: "+10%" },
  { id: "l", coins: 12000, sol: 0.1, tag: "+20%" },
];

export interface Offer {
  key: string;
  reward: Reward;
  price: number;
  /** The price before the day's discount. */
  was?: number;
}

function seeded(text: string): () => number {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Six offers for a day, the same for everyone: four skins and two agents, one of them marked down. */
export function dailyOffers(day: string): Offer[] {
  const rnd = seeded(`shop:${day}`);
  const skins: { id: string; skin: number; rarity: number }[] = [];
  for (const d of GUNS) {
    PATTERNS.forEach((p, skin) => {
      const rarity = itemRarity({ id: d.id, skin });
      if (skin > 0 && !p.pass && rarity >= 1 && rarity <= 4) skins.push({ id: d.id, skin, rarity });
    });
  }
  const out: Offer[] = [];
  // Cheaper things turn up more often.
  const weight = [0, 5, 4, 3, 1.2];
  while (out.length < 4) {
    const pool = skins.filter((s) => !out.some((o) => o.reward.kind === "skin" && o.reward.id === s.id));
    let r = rnd() * pool.reduce((a, s) => a + weight[s.rarity], 0);
    const pick = pool.find((s) => (r -= weight[s.rarity]) < 0) ?? pool[0];
    out.push({ key: `w:${pick.id}:${pick.skin}`, reward: { kind: "skin", id: pick.id, skin: pick.skin }, price: SKIN_PRICE[pick.rarity] });
  }
  const agents = AGENTS.filter((a) => !a.free && !a.pass && AGENT_PRICE[a.rarity] > 0);
  for (let i = 0; i < 2 && agents.length; i++) {
    const a = agents.splice(Math.floor(rnd() * agents.length), 1)[0];
    out.push({ key: `a:${a.id}`, reward: { kind: "agent", id: a.id }, price: AGENT_PRICE[a.rarity] });
  }
  const deal = out[Math.floor(rnd() * out.length)];
  deal.was = deal.price;
  deal.price = Math.round((deal.price * 0.75) / 10) * 10;
  return out;
}

/** Seconds until the offers change (midnight UTC). */
export function untilRefresh(): number {
  const now = new Date();
  return Math.floor((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1) - now.getTime()) / 1000);
}
