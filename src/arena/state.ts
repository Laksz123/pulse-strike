/** Live state of a match: what the HUD shows. Nothing here is saved. */

import { create } from "zustand";

export interface FeedLine {
  id: number;
  killer: string;
  victim: string;
  weapon: string;
  head: boolean;
  /** 0 neutral, 1 the player did it, 2 it happened to the player. */
  tone: 0 | 1 | 2;
  killerColor: string;
  victimColor: string;
}

export interface BoardRow {
  name: string;
  team: number;
  color: string;
  agent: string;
  kills: number;
  deaths: number;
  money: number;
  alive: boolean;
  you: boolean;
}

export interface MatchResult {
  won: boolean;
  /** Free-for-all: the player's place. */
  place: number;
  kills: number;
  deaths: number;
  xp: number;
  coins: number;
  cases: number;
}

/** A point in the world shown on screen: a bomb site, the bomb. */
export interface Mark {
  label: string;
  /** Screen position, 0..1; `off` when it is behind the camera. */
  x: number;
  y: number;
  off: boolean;
  dist: number;
  tone: "site" | "bomb";
}

export type Phase = "freeze" | "live" | "planted" | "end";

export interface Banner {
  title: string;
  sub: string;
  /** 1 = good for the player, 2 = bad, 0 = neutral. */
  tone: 0 | 1 | 2;
}

interface ArenaState {
  mode: string;
  modeName: string;
  mapName: string;
  teams: boolean;
  /** Rounds won (bomb), kills (team fight); in free-for-all, [player's kills, the leader's kills]. */
  score: [number, number];
  target: number;
  /** Seconds on the clock. */
  time: number;
  phase: Phase;
  round: number;
  /** Bomb mode: the player's team is attacking. */
  attacking: boolean;
  /** Who is still standing: the player's team, then the other. */
  roster: [{ name: string; alive: boolean; you: boolean }[], { name: string; alive: boolean; you: boolean }[]];
  hp: number;
  armor: number;
  money: number;
  mag: number;
  magMax: number;
  reserve: number;
  reloading: boolean;
  slot: number;
  /** Primary and sidearm: weapon id and skin. */
  slots: ({ id: string; skin: number } | null)[];
  hasBomb: boolean;
  /** Planting or defusing: what and how far along, 0..1. */
  action: { label: string; progress: number } | null;
  /** What the player can do right now. */
  hint: string;
  canBuy: boolean;
  buyOpen: boolean;
  /** Seconds until respawn; 0 while alive. */
  respawn: number;
  dead: boolean;
  killedBy: string;
  spectating: string;
  scoped: boolean;
  /** Charge or spin-up, 0..1. */
  charge: number;
  feed: FeedLine[];
  board: BoardRow[];
  showBoard: boolean;
  hitAt: number;
  killAt: number;
  hurtAt: number;
  headAt: number;
  banner: Banner | null;
  marks: Mark[];
  /** Grenades in hand, by kind. */
  nades: Record<string, number>;
  /** On the firing range. */
  range: boolean;
  /** Paint in the eyes: when it hit, how badly (0..1) and what colour. */
  blind: { at: number; amount: number; color: string } | null;
  /** Damage just dealt, to float up from the crosshair. */
  dmg: { id: number; n: number; head: boolean; kill: boolean; x: number }[];
  result: MatchResult | null;
  paused: boolean;
  /** The team choice is open; `teamFirst` before the first round, when it cannot be dismissed. */
  teamPick: boolean;
  teamFirst: boolean;
}

export const useArena = create<ArenaState>(() => ({
  mode: "", modeName: "", mapName: "", teams: false, score: [0, 0], target: 0, time: 0, phase: "freeze", round: 1, attacking: true, roster: [[], []],
  hp: 100, armor: 0, money: 0, mag: 0, magMax: 0, reserve: 0, reloading: false, slot: 0, slots: [null, null], hasBomb: false, action: null, hint: "",
  canBuy: false, buyOpen: false, respawn: 0, dead: false, killedBy: "", spectating: "", scoped: false, charge: 0, feed: [], board: [], showBoard: false,
  hitAt: 0, killAt: 0, hurtAt: 0, headAt: 0, banner: null, marks: [], nades: {}, range: false, blind: null, dmg: [], result: null, paused: false,
  teamPick: false, teamFirst: false,
}));

let feedSeq = 0;
export function pushFeed(line: Omit<FeedLine, "id">): void {
  const id = ++feedSeq;
  useArena.setState((s) => ({ feed: [...s.feed.slice(-4), { ...line, id }] }));
  setTimeout(() => useArena.setState((s) => ({ feed: s.feed.filter((f) => f.id !== id) })), 5500);
}
