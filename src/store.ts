/**
 * One store for the profile (what the player owns) and the live HUD state.
 *
 * Risk model: the base (the menu) is safe. A mission takes gear out into the open world; finishing
 * the mission brings everything home, dying loses everything carried except the secure pocket, and
 * rolls resources, ammo and salt back to what they were at take-off.
 */

import { create } from "zustand";
import { setVolume, sfx } from "./game/audio";
import {
  CONTRACTS, CONTRACT_BY_ID, MAX_SKILL, SKILLS, repTier, skillLevel, type GameEvent, type SkillId,
} from "./game/career";
import {
  ARMOR_SLOTS, ITEMS, RES, isGun, itemColor, itemValue, newGun, newItem, type Item, type ResId,
} from "./game/items";
import { AGENTS, AGENT_BY_ID, AGENT_CHANCE, newAgent, rollAgent, type AgentItem } from "./arena/agents";
import { CASE_PACKS, dailyOffers } from "./arena/shop";
import type { MapId } from "./arena/map";
import { MARKERS, MARKER_BY_ID, PATTERNS, newMarker, rollCase, type MarkerItem } from "./arena/markers";
import {
  MISSION_BY_ID, PASS_FREE, PASS_PREMIUM, SEASON, dailyMissions, passLevel, rewardName, today, type PassEvent, type Reward,
} from "./arena/pass";
import type { Drop } from "./game/loot";
import { GUN_UPGRADE, OFFERS, RECIPE_BY_ID, type Recipe } from "./game/recipes";
import { AFFIXES, AMMO_NAMES, RARITIES, WEAPON_BY_ID, type AmmoType } from "./game/weapons";

const SAVE_KEY = "aralkum.profile.v3";
const SETTINGS_KEY = "aralkum.settings.v2";
export const BAG_SIZE = 24;
export const HOT_SIZE = 6;
export const STASH_SIZE = 60;
export const SECURE_SIZE = 6;

export type Cont = "bag" | "hot" | "armor" | "stash" | "secure";
export interface Ref {
  c: Cont;
  i: number;
}
type Grid = (Item | null)[];

export interface ActiveContract {
  id: string;
  progress: number;
}

export interface Stats {
  missions: number;
  deaths: number;
  kills: number;
  bosses: number;
}

export interface Profile {
  salt: number;
  xp: number;
  res: Record<ResId, number>;
  ammo: Record<AmmoType, number>;
  bag: Grid;
  hot: Grid;
  armor: Grid;
  stash: Grid;
  /** Items here survive death. Only the first `pocket` slots are usable. */
  secure: Grid;
  pocket: 2 | 4 | 6;
  /** Workbench level at the base. */
  bench: 1 | 2 | 3;
  /** Counters as of take-off: what death rolls back to. */
  banked: { res: Record<ResId, number>; ammo: Record<AmmoType, number>; salt: number };
  /** Profession experience. */
  skills: Record<SkillId, number>;
  /** Reputation with the trader. */
  rep: number;
  contracts: ActiveContract[];
  /** Blueprints studied. */
  known: string[];
  stats: Stats;
  /** The shooter: weapon skins owned, unopened cases, and which skin each weapon wears (weapon id to item uid). */
  markers: MarkerItem[];
  loadout: (string | null)[];
  cases: number;
  equipped: Record<string, string>;
  /** Agents owned and the one in use. */
  agents: AgentItem[];
  agent: string;
  /** The blade carried: an item's uid, or empty for the plain knife everyone has. */
  knife: string;
  /** Battle pass: experience this season, whether premium is bought (and the transaction that paid for it), rewards taken. */
  passXp: number;
  premium: boolean;
  premiumSig: string;
  claimed: string[];
  missions: Missions;
  /** Items put up for sale on the market: out of the inventory until sold or taken back. */
  listed: Listed[];
  /** Which of the day's shop offers have been bought. */
  shop: { day: string; bought: string[] };
}

export interface Missions {
  day: string;
  list: { id: string; n: number; claimed: boolean }[];
}

/** An item of the player's on the market. `sig` is the listing transaction. */
export interface Listed {
  sig: string;
  kind: "w" | "a";
  id: string;
  skin: number;
  serial: number;
  price: number;
}

/** What a case gave. */
export type CaseDrop = { kind: "w"; item: MarkerItem } | { kind: "a"; item: AgentItem };

export interface Settings {
  /** Chunky low-resolution rendering. Off by default: it blurs everything in the distance. */
  pixel: boolean;
  /** Mouse sensitivity multiplier. */
  sens: number;
  /** Volumes, 0..1. */
  sound: number;
  music: number;
}

export interface Toast {
  id: number;
  text: string;
  color: string;
}

/** "+12 Wood" lines: repeated gains of the same thing add up instead of stacking lines. */
export interface Gain {
  key: string;
  label: string;
  n: number;
  color: string;
  at: number;
}

export interface Job {
  id: number;
  recipe: string;
  t: number;
  blocked?: boolean;
}

export interface LockView {
  name: string;
  pins: number;
  done: number;
  /** Needle and sweet-spot angles, radians. */
  angle: number;
  zoneA: number;
  zoneSize: number;
  picks: number;
  okAt: number;
  badAt: number;
}

/** How a mission ended, for the debrief screen. */
export interface Summary {
  survived: boolean;
  minutes: number;
  kills: number;
  salt: number;
  res: Partial<Record<ResId, number>>;
  items: number;
  xp: number;
}

export type Screen = "menu" | "game" | "dead" | "summary" | "arena";
export type ArenaModeId = "bomb" | "tdm" | "ffa" | "range";
export type Tab = "craft" | "stash" | "trade";

interface State extends Profile {
  settings: Settings;
  screen: Screen;
  hp: number;
  /** Rounds in the held gun. */
  mag: number;
  reloading: boolean;
  /** Selected hotbar slot. */
  active: number;
  prompt: string | null;
  /** Progress of a hold-to-do action, 0..1. */
  channel: { label: string; p: number } | null;
  /** The harvest node being worked on. */
  node: { name: string; hp: number; combo: number; hint: string | null } | null;
  lock: LockView | null;
  toasts: Toast[];
  gains: Gain[];
  /** Timestamps the HUD animates from. */
  hitAt: number;
  killAt: number;
  hurtAt: number;
  /** The nearest monument: its name, the distance to its edge and whether the player is inside. */
  zone: { name: string; dist: number; inside: boolean; tier: number } | null;
  px: number;
  pz: number;
  yaw: number;
  paused: boolean;
  panel: null | "inv" | "map";
  tab: Tab;
  queue: Job[];
  kills: number;
  ads: boolean;
  summary: Summary | null;
  arenaMode: ArenaModeId;
  arenaMap: MapId;
  /** Connected wallet address, if any. */
  wallet: string | null;

  /** Opens one case; returns what dropped, or null when there are none. */
  openCase(): CaseDrop | null;
  /** Buys a pack of cases from the shop. */
  buyCases(n: number): void;
  /** Buys one of today's offers. */
  buyOffer(key: string): void;
  /** Puts a skin on its weapon; calling it again takes it off. */
  equipSkin(uid: string): void;
  equipAgent(uid: string): void;
  addPassXp(n: number): void;
  claimPass(track: "free" | "premium", level: number): void;
  claimAllPass(): void;
  passEvent(e: PassEvent, n: number): void;
  claimMission(id: string): void;
  /** Hands the player a reward: from the pass, the market or a purchase. */
  grant(r: Reward, serial?: number): void;
  /** For testing and showing off: every weapon in every skin and every agent the player does not have yet. */
  unlockAll(quiet?: boolean): void;
  setScreen(s: Screen): void;
  setSettings(p: Partial<Settings>): void;
  toast(text: string, color?: string): void;
  gain(key: string, label: string, n: number, color: string): void;
  /** Hands out loot; returns what did not fit. */
  give(drops: Drop[]): Drop[];
  addItem(item: Item): Item | null;
  addXp(n: number): void;
  skillXp(id: SkillId, n: number): void;
  /** Something happened that contracts may count. */
  event(e: GameEvent, n?: number): void;
  claimContract(index: number): void;
  /** Study a blueprint. */
  learn(ref: Ref): void;
  move(from: Ref, to: Ref): void;
  /** Double-click: send the item where it most likely belongs. */
  quick(ref: Ref): void;
  discard(ref: Ref): void;
  consumeAt(ref: Ref, n?: number): void;
  countItem(id: string): number;
  consumeItem(id: string, n: number): boolean;
  setActive(i: number): void;
  craft(id: string): void;
  cancelJob(id: number): void;
  tickCraft(dt: number): void;
  upgradeGun(ref: Ref): void;
  sell(ref: Ref): void;
  buy(offerId: string): void;
  /** Home: everything owned right now is safe. */
  bank(): void;
  /** Death or abandoning a mission. */
  die(summary: Summary): void;
  /** A mission finished alive. */
  extract(summary: Summary): void;
  /** Start of a mission: hand out the free starter kit and remember what is at stake. */
  deploy(): void;
}

const emptyRes = (): Record<ResId, number> => ({ wood: 0, stone: 0, ore: 0, iron: 0, scrap: 0, cloth: 0, hide: 0, meat: 0, chem: 0, powder: 0, elec: 0, crystal: 0 });
const emptyAmmo = (): Record<AmmoType, number> => ({ bolt: 0, light: 0, medium: 0, shell: 0, heavy: 0 });
const emptySkills = (): Record<SkillId, number> => ({ lumber: 0, miner: 0, hunter: 0, thief: 0, gunner: 0, survivor: 0 });
const grid = (n: number): Grid => Array.from({ length: n }, () => null);

function pickContracts(rep: number, have: ActiveContract[]): ActiveContract[] {
  const out = [...have];
  const pool = CONTRACTS.filter((c) => c.minRep <= rep);
  while (out.length < 3) {
    const free = pool.filter((c) => !out.some((a) => a.id === c.id));
    if (!free.length) break;
    // Favour the hardest work the trader is willing to offer.
    const top = free.filter((c) => c.minRep >= Math.max(...free.map((f) => f.minRep)) - 150);
    out.push({ id: top[Math.floor(Math.random() * top.length)].id, progress: 0 });
  }
  return out;
}

function freshMissions(): Missions {
  const day = today();
  return { day, list: dailyMissions(day).map((id) => ({ id, n: 0, claimed: false })) };
}

function freshProfile(): Profile {
  const byte = newAgent("byte", true);
  return {
    markers: [], loadout: [null, null, null], cases: 2, equipped: {},
    agents: [byte, newAgent("rookie", true), newAgent("rush", true)], agent: byte.uid, knife: "",
    passXp: 0, premium: false, premiumSig: "", claimed: [], missions: freshMissions(), listed: [], shop: { day: today(), bought: [] },
    salt: 0, xp: 0, res: emptyRes(), ammo: emptyAmmo(),
    bag: grid(BAG_SIZE), hot: grid(HOT_SIZE), armor: grid(4), stash: grid(STASH_SIZE), secure: grid(SECURE_SIZE), pocket: 2,
    bench: 1, banked: { res: emptyRes(), ammo: emptyAmmo(), salt: 0 },
    skills: emptySkills(), rep: 0, contracts: pickContracts(0, []), known: [], stats: { missions: 0, deaths: 0, kills: 0, bosses: 0 },
  };
}

function fitGrid(g: unknown, n: number): Grid {
  const out = grid(n);
  if (Array.isArray(g)) g.slice(0, n).forEach((it, i) => (out[i] = it && ITEMS[(it as Item).id] ? (it as Item) : null));
  return out;
}

function load(): Profile {
  const fresh = freshProfile();
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return fresh;
    const p = JSON.parse(raw) as Partial<Profile>;
    const res = { ...fresh.res, ...p.res };
    const ammo = { ...fresh.ammo, ...p.ammo };
    const rep = p.rep ?? 0;
    return {
      salt: p.salt ?? 0, xp: p.xp ?? 0, res, ammo,
      bag: fitGrid(p.bag, BAG_SIZE), hot: fitGrid(p.hot, HOT_SIZE), armor: fitGrid(p.armor, 4), stash: fitGrid(p.stash, STASH_SIZE),
      secure: fitGrid(p.secure, SECURE_SIZE), pocket: p.pocket === 4 || p.pocket === 6 ? p.pocket : 2,
      bench: p.bench === 2 || p.bench === 3 ? p.bench : 1,
      // After a reload the player is home: whatever was saved is safe.
      banked: { res: { ...res }, ammo: { ...ammo }, salt: p.salt ?? 0 },
      skills: { ...fresh.skills, ...p.skills }, rep,
      contracts: pickContracts(rep, (p.contracts ?? []).filter((c) => CONTRACT_BY_ID[c.id])),
      known: p.known ?? [], stats: { ...fresh.stats, ...p.stats },
      ...loadMarkers(p, fresh),
    };
  } catch {
    return fresh;
  }
}

type Shooter = Pick<Profile, "markers" | "loadout" | "cases" | "equipped" | "agents" | "agent" | "knife" | "passXp" | "premium" | "premiumSig" | "claimed" | "missions" | "listed" | "shop">;

function loadMarkers(p: Partial<Profile>, fresh: Profile): Shooter {
  // Factory-finish starters from the paintball days are not items any more: every weapon has that look for free.
  const markers = (p.markers ?? []).filter((m) => MARKER_BY_ID[m.id] && PATTERNS[m.skin] && !m.starter);
  const equipped: Record<string, string> = {};
  for (const [id, uid] of Object.entries(p.equipped ?? {})) if (markers.some((m) => m.uid === uid && m.id === id)) equipped[id] = uid;
  let agents = (p.agents ?? []).filter((a) => AGENT_BY_ID[a.id]);
  if (!agents.some((a) => a.id === "rookie")) agents = [...fresh.agents, ...agents.filter((a) => !a.starter)];
  // Byte arrived later: profiles from before get it, and start out wearing it.
  const hadByte = agents.some((a) => a.id === "byte");
  if (!hadByte) agents = [fresh.agents[0], ...agents];
  const agent = hadByte && agents.some((a) => a.uid === p.agent) ? p.agent! : agents[0].uid;
  const missions = p.missions && p.missions.day === today() && p.missions.list?.every((m) => MISSION_BY_ID[m.id]) ? p.missions : fresh.missions;
  return {
    markers, loadout: [null, null, null], cases: p.cases ?? fresh.cases, equipped, agents, agent, knife: markers.some((m) => m.uid === p.knife) ? p.knife! : "",
    passXp: p.passXp ?? 0, premium: !!p.premium, premiumSig: p.premiumSig ?? "", claimed: p.claimed ?? [], missions, listed: p.listed ?? [],
    shop: p.shop?.day === today() ? p.shop : fresh.shop,
  };
}

function loadSettings(): Settings {
  try {
    const s = { pixel: false, sens: 1, sound: 1, music: 0.6, ...(JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") as Partial<Settings>) };
    setVolume(s.sound, s.music);
    return s;
  } catch {
    return { pixel: false, sens: 1, sound: 1, music: 0.6 };
  }
}

function profileOf(s: Profile): Profile {
  return {
    salt: s.salt, xp: s.xp, res: s.res, ammo: s.ammo, bag: s.bag, hot: s.hot, armor: s.armor, stash: s.stash, secure: s.secure,
    pocket: s.pocket, bench: s.bench, banked: s.banked, skills: s.skills, rep: s.rep, contracts: s.contracts, known: s.known, stats: s.stats,
    markers: s.markers, loadout: s.loadout, cases: s.cases, equipped: s.equipped, agents: s.agents, agent: s.agent, knife: s.knife,
    passXp: s.passXp, premium: s.premium, premiumSig: s.premiumSig, claimed: s.claimed, missions: s.missions, listed: s.listed, shop: s.shop,
  };
}

function save(p: Profile): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(profileOf(p)));
  } catch {
    // Private mode: the game still runs, it just does not persist.
  }
}

const hotbarable = (item: Item) => {
  const k = ITEMS[item.id].kind;
  return k === "weapon" || k === "tool" || k === "med";
};

export function accepts(ref: Ref, item: Item, pocket = SECURE_SIZE): boolean {
  if (ref.c === "armor") return ITEMS[item.id].armor?.slot === ARMOR_SLOTS[ref.i];
  if (ref.c === "hot") return hotbarable(item);
  if (ref.c === "stash") return !item.starter;
  if (ref.c === "secure") return ref.i < pocket && !item.starter;
  return true;
}

/** Puts `item` into the grids in order (stacks first, then empty slots). Mutates; returns the rest. */
function place(grids: Grid[], item: Item): Item | null {
  const stack = ITEMS[item.id].stack;
  let n = item.n;
  if (stack > 1) {
    for (const g of grids) {
      for (let i = 0; i < g.length && n > 0; i++) {
        const s = g[i];
        if (s && s.id === item.id && s.n < stack) {
          const mv = Math.min(stack - s.n, n);
          g[i] = { ...s, n: s.n + mv };
          n -= mv;
        }
      }
    }
  }
  let first = true;
  for (const g of grids) {
    for (let i = 0; i < g.length && n > 0; i++) {
      if (g[i]) continue;
      const mv = Math.min(stack, n);
      g[i] = first ? { ...item, n: mv } : { ...newItem(item.id, mv) };
      first = false;
      n -= mv;
    }
  }
  return n > 0 ? { ...item, n } : null;
}

/** Where a picked-up item goes: usable things try the hotbar first. */
function carriedGrids(hot: Grid, bag: Grid, item: Item): Grid[] {
  return hotbarable(item) ? [hot, bag] : [bag];
}

/** At the base: the workbench, the furnace, the stash and the trader are at hand. */
export function atCamp(s: { screen: Screen }): boolean {
  return s.screen === "menu";
}

/** Why a recipe cannot be crafted right now, or null when it can. */
export function craftBlock(s: State, r: Recipe): string | null {
  if (r.out.bench && (s.bench >= r.out.bench || s.queue.some((j) => j.recipe === r.id))) return "Уже построено";
  if (r.out.pocket && (s.pocket >= r.out.pocket || s.queue.some((j) => j.recipe === r.id))) return "Уже построено";
  if (r.out.pocket === 6 && s.pocket < 4) return "Сначала 4 слота";
  if (r.bp && !s.known.includes(r.bp)) return "Нужен чертёж";
  if ((r.bench > 0 || r.furnace) && !atCamp(s)) return "Только на базе";
  if (r.bench > s.bench) return `Нужен верстак ${r.bench} ур.`;
  for (const [k, n] of Object.entries(r.res ?? {})) if (s.res[k as ResId] < n) return `Не хватает: ${RES[k as ResId].name}`;
  for (const [id, n] of Object.entries(r.items ?? {})) if (s.countItem(id) < n) return `Нужно: ${ITEMS[id].name}`;
  return null;
}

export function recipeName(r: Recipe): string {
  if (r.name) return r.name;
  if (r.out.item) return ITEMS[r.out.item].name + ((r.out.n ?? 1) > 1 ? ` ×${r.out.n}` : "");
  const ammo = Object.entries(r.out.ammo ?? {})[0];
  if (ammo) return `${AMMO_NAMES[ammo[0] as AmmoType]} ×${ammo[1]}`;
  return r.id;
}

/** Skill level helper for the game code. */
export function skillOf(id: SkillId): number {
  return skillLevel(useStore.getState().skills[id]);
}

export function maxHpOf(skills: Record<SkillId, number>): number {
  return 100 + skillLevel(skills.survivor) * 3;
}

const initial = load();
let toastSeq = 0;
let jobSeq = 0;

type Grids = Record<Cont, Grid>;
const gridsOf = (s: State): Grids => ({ bag: [...s.bag], hot: [...s.hot], armor: [...s.armor], stash: [...s.stash], secure: [...s.secure] });

export const useStore = create<State>((set, get) => ({
  ...initial,
  settings: loadSettings(),
  screen: "menu",
  hp: 100,
  mag: 0,
  reloading: false,
  active: 0,
  prompt: null,
  channel: null,
  node: null,
  lock: null,
  toasts: [],
  gains: [],
  hitAt: 0,
  killAt: 0,
  hurtAt: 0,
  zone: null,
  px: 0,
  pz: 0,
  yaw: 0,
  paused: false,
  panel: null,
  tab: "craft",
  queue: [],
  kills: 0,
  ads: false,
  summary: null,
  arenaMode: "bomb",
  arenaMap: "oasis",
  wallet: null,

  openCase: () => {
    const s = get();
    if (s.cases <= 0) return null;
    if (Math.random() * 100 < AGENT_CHANCE) {
      const item = rollAgent();
      set({ cases: s.cases - 1, agents: [...s.agents, item] });
      return { kind: "a", item };
    }
    const item = rollCase();
    set({ cases: s.cases - 1, markers: [...s.markers, item] });
    return { kind: "w", item };
  },

  buyCases: (n) => {
    const s = get();
    const pack = CASE_PACKS.find((p) => p.n === n);
    if (!pack) return;
    if (s.salt < pack.price) {
      sfx.deny();
      return s.toast("Не хватает монет", "#f0a35c");
    }
    set({ salt: s.salt - pack.price, cases: s.cases + pack.n });
    sfx.coins();
  },

  buyOffer: (key) => {
    const s = get();
    const day = today();
    const bought = s.shop.day === day ? s.shop.bought : [];
    const offer = dailyOffers(day).find((o) => o.key === key);
    if (!offer || bought.includes(key)) return;
    if (s.salt < offer.price) {
      sfx.deny();
      return s.toast("Не хватает монет", "#f0a35c");
    }
    set({ salt: s.salt - offer.price, shop: { day, bought: [...bought, key] } });
    get().grant(offer.reward);
    s.toast(`Куплено: ${rewardName(offer.reward)}`, "#ffd24a");
    sfx.coins();
  },

  equipSkin: (uid) => {
    const s = get();
    const item = s.markers.find((m) => m.uid === uid);
    if (!item) return;
    sfx.pickup();
    // A blade is carried one at a time; a gun skin goes on its own gun.
    if (MARKER_BY_ID[item.id].melee) return set({ knife: s.knife === uid ? "" : uid });
    const equipped = { ...s.equipped };
    if (equipped[item.id] === uid) delete equipped[item.id];
    else equipped[item.id] = uid;
    set({ equipped });
  },

  equipAgent: (uid) => {
    if (get().agents.some((a) => a.uid === uid)) set({ agent: uid });
    sfx.pickup();
  },

  addPassXp: (n) => {
    const s = get();
    const add = Math.round(n * (s.premium ? SEASON.bonus : 1));
    const gained = passLevel(s.passXp + add) - passLevel(s.passXp);
    set({ passXp: s.passXp + add });
    if (gained > 0) s.toast(`Боевой пропуск: уровень ${passLevel(s.passXp + add)}`, "#ffb81a");
  },

  grant: (r, serial) => {
    const s = get();
    if (r.kind === "coins") set({ salt: s.salt + r.n });
    else if (r.kind === "case") set({ cases: s.cases + r.n });
    else if (r.kind === "skin") {
      const item = newMarker(r.id, r.skin);
      if (serial) item.serial = serial;
      set({ markers: [...s.markers, item] });
    } else {
      const item = newAgent(r.id);
      if (serial) item.serial = serial;
      set({ agents: [...s.agents, item] });
    }
  },

  unlockAll: (quiet = false) => {
    const s = get();
    const markers = [...s.markers];
    for (const d of MARKERS) {
      PATTERNS.forEach((_, skin) => {
        if (!markers.some((m) => m.id === d.id && m.skin === skin)) markers.push(newMarker(d.id, skin));
      });
    }
    const agents = [...s.agents];
    for (const a of AGENTS) if (!agents.some((x) => x.id === a.id)) agents.push(newAgent(a.id));
    const added = markers.length - s.markers.length + agents.length - s.agents.length;
    if (added) set({ markers, agents });
    if (quiet) return;
    s.toast(added ? `Выдано предметов: ${added}` : "У тебя уже всё есть", "#ffd24a");
    sfx.rare();
  },

  claimPass: (track, level) => {
    const s = get();
    const key = `${track === "free" ? "f" : "p"}${level}`;
    if (level < 1 || level > SEASON.levels || level > passLevel(s.passXp) || s.claimed.includes(key)) return;
    if (track === "premium" && !s.premium) return;
    const r = (track === "free" ? PASS_FREE : PASS_PREMIUM)[level - 1];
    set({ claimed: [...s.claimed, key] });
    get().grant(r);
    s.toast(`Получено: ${rewardName(r)}`, "#ffd24a");
    (r.kind === "skin" || r.kind === "agent" ? sfx.rare : sfx.pickup)();
  },

  claimAllPass: () => {
    const s = get();
    for (let level = 1; level <= passLevel(s.passXp); level++) {
      get().claimPass("free", level);
      if (get().premium) get().claimPass("premium", level);
    }
  },

  passEvent: (e, n) => {
    const s = get();
    const base = s.missions.day === today() ? s.missions : freshMissions();
    const list = base.list.map((m) => (MISSION_BY_ID[m.id].event === e ? { ...m, n: Math.min(MISSION_BY_ID[m.id].need, m.n + n) } : m));
    set({ missions: { day: base.day, list } });
  },

  claimMission: (id) => {
    const s = get();
    const m = s.missions.list.find((x) => x.id === id);
    const def = MISSION_BY_ID[id];
    if (!m || !def || m.claimed || m.n < def.need) return;
    set({ missions: { day: s.missions.day, list: s.missions.list.map((x) => (x.id === id ? { ...x, claimed: true } : x)) } });
    get().addPassXp(def.xp);
    sfx.pickup();
  },

  setScreen: (screen) => set({ screen, panel: null, lock: null, channel: null, node: null, prompt: null }),

  setSettings: (p) => {
    const settings = { ...get().settings, ...p };
    set({ settings });
    setVolume(settings.sound, settings.music);
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // Not persisted in private mode.
    }
  },

  toast: (text, color = "#e9e1cf") => {
    const id = ++toastSeq;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, text, color }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3600);
  },

  gain: (key, label, n, color) => {
    const now = performance.now();
    set((s) => {
      const old = s.gains.find((g) => g.key === key);
      const rest = s.gains.filter((g) => g.key !== key && now - g.at < 3500);
      return { gains: [...rest.slice(-6), { key, label, n: (old && now - old.at < 3500 ? old.n : 0) + n, color, at: now }] };
    });
    setTimeout(() => set((s) => ({ gains: s.gains.filter((g) => performance.now() - g.at < 3400) })), 3600);
  },

  give: (drops) => {
    const s = get();
    const hot = [...s.hot];
    const bag = [...s.bag];
    const res = { ...s.res };
    const ammo = { ...s.ammo };
    let salt = s.salt;
    const left: Drop[] = [];
    for (const d of drops) {
      if (d.kind === "salt") {
        salt += d.n;
        s.gain("salt", "Соль", d.n, "#e9e1cf");
      } else if (d.kind === "res") {
        res[d.res] += d.n;
        s.gain(d.res, RES[d.res].name, d.n, RES[d.res].color);
      } else if (d.kind === "ammo") {
        ammo[d.ammo] += d.n;
        s.gain(d.ammo, AMMO_NAMES[d.ammo], d.n, "#cdbb8f");
      } else {
        const rest = place(carriedGrids(hot, bag, d.item), d.item);
        const got = d.item.n - (rest?.n ?? 0);
        if (got > 0) {
          const gunTag = isGun(d.item) ? `${RARITIES[d.item.rarity ?? 0].name}: ` : "";
          s.gain(`i:${d.item.id}:${d.item.rarity ?? 0}`, gunTag + ITEMS[d.item.id].name, got, itemColor(d.item));
        }
        if (rest) left.push({ kind: "item", item: rest });
      }
    }
    set({ hot, bag, res, ammo, salt });
    return left;
  },

  addItem: (item) => {
    const s = get();
    const hot = [...s.hot];
    const bag = [...s.bag];
    const rest = place(carriedGrids(hot, bag, item), item);
    set({ hot, bag });
    return rest;
  },

  addXp: (n) => {
    const s = get();
    const gained = levelOf(s.xp + n) - levelOf(s.xp);
    // Every new level is a case.
    set({ xp: s.xp + n, cases: s.cases + Math.max(0, gained) });
    if (gained > 0) {
      s.toast(`Уровень ${levelOf(s.xp + n)}! Кейс ждёт в меню`, "#ffd24a");
      sfx.rare();
    }
  },

  skillXp: (id, n) => {
    const s = get();
    const before = skillLevel(s.skills[id]);
    const skills = { ...s.skills, [id]: s.skills[id] + n };
    set({ skills });
    const after = skillLevel(skills[id]);
    if (after > before) {
      const perk = after === 5 ? SKILLS[id].perk5 : after === MAX_SKILL ? SKILLS[id].perk10 : SKILLS[id].per;
      s.toast(`${SKILLS[id].name}: уровень ${after} · ${perk}`, "#ffd24a");
      sfx.rare();
    }
  },

  event: (e, n = 1) => {
    const s = get();
    let changed = false;
    const contracts = s.contracts.map((c) => {
      const def = CONTRACT_BY_ID[c.id];
      if (def.event !== e || c.progress >= def.n) return c;
      changed = true;
      const progress = Math.min(def.n, c.progress + n);
      if (progress >= def.n) s.toast(`Контракт выполнен: ${def.text}`, "#5fbf5a");
      return { ...c, progress };
    });
    if (changed) set({ contracts });
  },

  claimContract: (index) => {
    const s = get();
    const c = s.contracts[index];
    if (!c || !atCamp(s)) return;
    const def = CONTRACT_BY_ID[c.id];
    const res = { ...s.res };
    if (def.res) {
      if (res[def.res] < def.n) return s.toast(`Не хватает: ${RES[def.res].name}`, "#f0a35c");
      res[def.res] -= def.n;
    } else if (c.progress < def.n) return;
    const rep = s.rep + def.rep;
    const before = repTier(s.rep);
    set({ res, salt: s.salt + def.salt, rep, contracts: pickContracts(rep, s.contracts.filter((_, i) => i !== index)) });
    s.gain("salt", "Соль", def.salt, "#e9e1cf");
    s.addXp(def.rep * 2);
    if (repTier(rep) > before) s.toast("Торговец доверяет тебе больше: новые товары и контракты", "#ffd24a");
    sfx.pickup();
  },

  learn: (ref) => {
    const s = get();
    const item = s[ref.c][ref.i];
    const bp = item ? ITEMS[item.id].bp : undefined;
    if (!item || !bp) return;
    if (s.known.includes(bp)) return s.toast("Этот чертёж уже изучен: продай или обменяй его", "#f0a35c");
    const g = [...s[ref.c]];
    g[ref.i] = null;
    set({ known: [...s.known, bp], [ref.c]: g } as Pick<State, Cont | "known">);
    s.toast(`Изучено: ${ITEMS[item.id].name.replace("Чертёж: ", "")}`, "#5fbf5a");
    sfx.rare();
  },

  move: (from, to) => {
    const s = get();
    if (from.c === to.c && from.i === to.i) return;
    if ((from.c === "stash" || to.c === "stash") && !atCamp(s)) return;
    const g = gridsOf(s);
    const a = g[from.c][from.i];
    const b = g[to.c][to.i];
    if (!a || !accepts(to, a, s.pocket) || (b && !accepts(from, b, s.pocket))) return;
    const stack = ITEMS[a.id].stack;
    if (b && b.id === a.id && stack > 1 && b.n < stack) {
      const mv = Math.min(stack - b.n, a.n);
      g[to.c][to.i] = { ...b, n: b.n + mv };
      g[from.c][from.i] = a.n - mv > 0 ? { ...a, n: a.n - mv } : null;
    } else {
      g[to.c][to.i] = a;
      g[from.c][from.i] = b;
    }
    set(g);
  },

  quick: (ref) => {
    const s = get();
    const item = s[ref.c][ref.i];
    if (!item) return;
    const g = gridsOf(s);
    const send = (grids: Grid[]) => {
      g[ref.c][ref.i] = null;
      const rest = place(grids, item);
      if (rest) g[ref.c][ref.i] = rest;
      set(g);
    };
    if (ref.c === "stash") {
      if (atCamp(s)) send(carriedGrids(g.hot, g.bag, item));
      return;
    }
    if (s.tab === "stash" && atCamp(s) && accepts({ c: "stash", i: 0 }, item)) return send([g.stash]);
    const slot = ITEMS[item.id].armor?.slot;
    if (slot && ref.c !== "armor") return s.move(ref, { c: "armor", i: ARMOR_SLOTS.indexOf(slot) });
    if (ref.c === "bag" && hotbarable(item)) return send([g.hot]);
    send([g.bag]);
  },

  discard: (ref) => {
    const s = get();
    const g = [...s[ref.c]];
    g[ref.i] = null;
    set({ [ref.c]: g } as Pick<State, Cont>);
  },

  consumeAt: (ref, n = 1) => {
    const s = get();
    const g = [...s[ref.c]];
    const item = g[ref.i];
    if (!item) return;
    g[ref.i] = item.n - n > 0 ? { ...item, n: item.n - n } : null;
    set({ [ref.c]: g } as Pick<State, Cont>);
  },

  countItem: (id) => {
    const s = get();
    let n = 0;
    for (const it of [...s.bag, ...s.hot, ...s.secure]) if (it && it.id === id) n += it.n;
    return n;
  },

  consumeItem: (id, n) => {
    const s = get();
    if (s.countItem(id) < n) return false;
    const bag = [...s.bag];
    const hot = [...s.hot];
    const secure = [...s.secure];
    for (const g of [bag, hot, secure]) {
      for (let i = 0; i < g.length && n > 0; i++) {
        const it = g[i];
        if (!it || it.id !== id) continue;
        const take = Math.min(it.n, n);
        g[i] = it.n - take > 0 ? { ...it, n: it.n - take } : null;
        n -= take;
      }
    }
    set({ bag, hot, secure });
    return true;
  },

  setActive: (active) => set({ active }),

  craft: (id) => {
    const s = get();
    const r = RECIPE_BY_ID[id];
    const why = craftBlock(s, r);
    if (why) return s.toast(why, "#f0a35c");
    if (s.queue.length >= 8) return s.toast("Очередь крафта заполнена", "#f0a35c");
    for (const [iid, n] of Object.entries(r.items ?? {})) s.consumeItem(iid, n);
    const res = { ...get().res };
    for (const [k, n] of Object.entries(r.res ?? {})) res[k as ResId] -= n;
    set({ res, queue: [...get().queue, { id: ++jobSeq, recipe: id, t: 0 }] });
  },

  cancelJob: (id) => {
    const s = get();
    const job = s.queue.find((j) => j.id === id);
    if (!job) return;
    const r = RECIPE_BY_ID[job.recipe];
    const res = { ...s.res };
    for (const [k, n] of Object.entries(r.res ?? {})) res[k as ResId] += n;
    set({ res, queue: s.queue.filter((j) => j.id !== id) });
    for (const [iid, n] of Object.entries(r.items ?? {})) get().addItem(newItem(iid, n));
  },

  tickCraft: (dt) => {
    const s = get();
    if (!s.queue.length) return;
    const queue = [...s.queue];
    const job = { ...queue[0], t: queue[0].t + dt };
    const r = RECIPE_BY_ID[job.recipe];
    queue[0] = job;
    if (job.t < r.time) return set({ queue });
    const out = r.out;
    if (out.item) {
      const item = WEAPON_BY_ID[out.item] ? newGun(out.item, 0) : newItem(out.item, out.n ?? 1);
      const hot = [...s.hot];
      const bag = [...s.bag];
      if (place(carriedGrids(hot, bag, item), item)) {
        if (!job.blocked) s.toast("Рюкзак полон: освободи место для крафта", "#f0a35c");
        job.blocked = true;
        job.t = r.time;
        return set({ queue });
      }
      set({ hot, bag });
      s.gain(`i:${item.id}:0`, ITEMS[item.id].name, item.n, itemColor(item));
    }
    const res = { ...s.res };
    for (const [k, n] of Object.entries(out.res ?? {})) {
      res[k as ResId] += n;
      s.gain(k, RES[k as ResId].name, n, RES[k as ResId].color);
    }
    const ammo = { ...s.ammo };
    for (const [k, n] of Object.entries(out.ammo ?? {})) {
      ammo[k as AmmoType] += n;
      s.gain(k, AMMO_NAMES[k as AmmoType], n, "#cdbb8f");
    }
    queue.shift();
    set({ res, ammo, queue, ...(out.bench ? { bench: out.bench } : {}), ...(out.pocket ? { pocket: out.pocket } : {}) });
    if (out.bench) s.toast(`Верстак улучшен до ${out.bench} уровня`, "#5fbf5a");
    if (out.pocket) s.toast(`Защищённый карман: ${out.pocket} слота`, "#5fbf5a");
    sfx.pickup();
  },

  upgradeGun: (ref) => {
    const s = get();
    const item = s[ref.c][ref.i];
    if (!item || !isGun(item)) return;
    const rarity = item.rarity ?? 0;
    const cost = GUN_UPGRADE[rarity];
    if (!cost) return s.toast("Легендарное оружие нельзя создать — только выбить", "#f0a35c");
    if (!atCamp(s)) return s.toast("Улучшать можно только на базе", "#f0a35c");
    if (s.bench < cost.bench) return s.toast(`Нужен верстак ${cost.bench} ур.`, "#f0a35c");
    for (const [k, n] of Object.entries(cost.res)) if (s.res[k as ResId] < n) return s.toast(`Не хватает: ${RES[k as ResId].name}`, "#f0a35c");
    const res = { ...s.res };
    for (const [k, n] of Object.entries(cost.res)) res[k as ResId] -= n;
    const affixes = [...(item.affixes ?? [])];
    const pool = AFFIXES.filter((a) => !affixes.includes(a.id));
    while (affixes.length < RARITIES[rarity + 1].affixes && pool.length) {
      affixes.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0].id);
    }
    const g = [...s[ref.c]];
    g[ref.i] = { ...item, rarity: rarity + 1, affixes, starter: undefined };
    set({ res, [ref.c]: g } as Pick<State, Cont | "res">);
    sfx.rare();
    s.toast(`${ITEMS[item.id].name}: ${RARITIES[rarity + 1].name}`, RARITIES[rarity + 1].color);
  },

  sell: (ref) => {
    const s = get();
    const item = s[ref.c][ref.i];
    if (!item || !atCamp(s)) return;
    const value = itemValue(item);
    if (value <= 0) return s.toast("Торговцу это не нужно", "#f0a35c");
    const g = [...s[ref.c]];
    g[ref.i] = null;
    set({ salt: s.salt + value, [ref.c]: g } as Pick<State, Cont | "salt">);
    s.gain("salt", "Соль", value, "#e9e1cf");
    sfx.pickup();
  },

  buy: (offerId) => {
    const s = get();
    const offer = OFFERS.find((o) => o.id === offerId);
    if (!offer || !atCamp(s) || s.rep < offer.rep) return;
    if (s.salt < offer.price) return s.toast("Не хватает соли", "#f0a35c");
    if (offer.item) {
      const item = newItem(offer.item, offer.n ?? 1);
      const hot = [...s.hot];
      const bag = [...s.bag];
      if (place(carriedGrids(hot, bag, item), item)) return s.toast("Рюкзак полон", "#f0a35c");
      set({ hot, bag });
    }
    const ammo = { ...s.ammo };
    for (const [k, n] of Object.entries(offer.ammo ?? {})) ammo[k as AmmoType] += n;
    set({ ammo, salt: s.salt - offer.price });
    sfx.pickup();
  },

  bank: () => {
    const s = get();
    const banked = { res: { ...s.res }, ammo: { ...s.ammo }, salt: s.salt };
    set({ banked });
    save({ ...profileOf(s), banked });
  },

  die: (summary) => {
    const s = get();
    const res = { ...s.res };
    const ammo = { ...s.ammo };
    // Roll the counters back to take-off; what was spent in the field stays spent.
    for (const k of Object.keys(res) as ResId[]) res[k] = Math.min(res[k], s.banked.res[k]);
    for (const k of Object.keys(ammo) as AmmoType[]) ammo[k] = Math.min(ammo[k], s.banked.ammo[k]);
    set({
      hot: grid(HOT_SIZE), bag: grid(BAG_SIZE), armor: grid(4), res, ammo, salt: Math.min(s.salt, s.banked.salt),
      stats: { ...s.stats, deaths: s.stats.deaths + 1 }, summary: { ...summary, survived: false }, queue: [],
    });
    get().bank();
  },

  extract: (summary) => {
    const s = get();
    set({ stats: { ...s.stats, missions: s.stats.missions + 1 }, summary: { ...summary, survived: true } });
    get().skillXp("survivor", 40);
    get().event("extract");
    get().addXp(60);
    get().bank();
  },

  deploy: () => {
    const s = get();
    const hot = [...s.hot];
    const bag = [...s.bag];
    const ammo = { ...s.ammo };
    const carried = () => [...hot, ...bag].filter((it): it is Item => !!it);
    if (!carried().some(isGun)) place([hot, bag], { ...newGun("crossbow", 0), starter: true });
    if (!carried().some((it) => ITEMS[it.id].tool)) place([hot, bag], { ...newItem("rock"), starter: true });
    if (carried().some((it) => it.id === "crossbow") && ammo.bolt < 12) ammo.bolt = 12;
    const gun = hot.findIndex((it) => it && isGun(it));
    set({
      hot, bag, ammo, hp: maxHpOf(s.skills), active: gun === -1 ? 0 : gun, kills: 0, panel: null, lock: null, channel: null, node: null,
      prompt: null, zone: null, gains: [], toasts: [], summary: null,
    });
    get().bank();
  },
}));

// The base is safe: while in the menu, every change to what the player owns is saved.
let bankTimer: ReturnType<typeof setTimeout> | null = null;
useStore.subscribe((s, prev) => {
  if (!atCamp(s)) return;
  const changed =
    s.bag !== prev.bag || s.hot !== prev.hot || s.armor !== prev.armor || s.stash !== prev.stash || s.secure !== prev.secure ||
    s.res !== prev.res || s.ammo !== prev.ammo || s.salt !== prev.salt || s.bench !== prev.bench || s.pocket !== prev.pocket ||
    s.xp !== prev.xp || s.skills !== prev.skills || s.rep !== prev.rep || s.contracts !== prev.contracts || s.known !== prev.known ||
    s.markers !== prev.markers || s.cases !== prev.cases || s.equipped !== prev.equipped || s.knife !== prev.knife || s.agents !== prev.agents || s.agent !== prev.agent ||
    s.passXp !== prev.passXp || s.premium !== prev.premium || s.claimed !== prev.claimed || s.missions !== prev.missions || s.listed !== prev.listed ||
    s.shop !== prev.shop ||
    s.screen !== prev.screen;
  if (!changed || bankTimer) return;
  bankTimer = setTimeout(() => {
    bankTimer = null;
    const now = useStore.getState();
    if (atCamp(now)) now.bank();
  }, 250);
});

export function levelOf(xp: number): number {
  return Math.floor(Math.sqrt(xp / 120)) + 1;
}

/** Progress to the next level, 0..1. */
export function levelProgress(xp: number): number {
  const l = levelOf(xp);
  const a = (l - 1) * (l - 1) * 120;
  const b = l * l * 120;
  return (xp - a) / (b - a);
}
