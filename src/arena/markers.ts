/**
 * The weapons and their skins.
 * None of them is an ordinary rifle or pistol: each prototype fires its charge in its own way. As in
 * Counter-Strike, weapons are bought during a match with round money, and what a player owns is
 * skins: a weapon type in a pattern, with a serial number. Skins change looks only.
 */

export type FireMode = "semi" | "auto" | "burst" | "charge" | "spin" | "stream";
export type MarkerCat = "rifle" | "mini" | "sniper" | "contra" | "knife";

export const CAT_NAMES: Record<MarkerCat, string> = { rifle: "Штурмовые", mini: "Тяжёлые", sniper: "Снайперские", contra: "Экспериментальные", knife: "Ножи" };
export const CAT_ORDER: MarkerCat[] = ["rifle", "mini", "sniper", "contra"];

export interface MarkerDef {
  id: string;
  name: string;
  cat: MarkerCat;
  /** Sidearms go in the second slot; everything else is a primary. */
  side?: boolean;
  /** Price in round money. */
  price: number;
  /** One line that says what makes it special. */
  trick: string;
  mode: FireMode;
  /** Damage per charge to the body; players have 100 health. */
  dmg: number;
  /** Headshot multiplier. */
  head: number;
  /** Charges per minute at full speed. */
  rpm: number;
  /** Charge speed, m/s, and how strongly gravity pulls it (1 = normal). */
  speed: number;
  gravity: number;
  /** Max deviation from the aim, radians. */
  spread: number;
  pellets: number;
  mag: number;
  /** Spare magazines carried. */
  spare: number;
  reload: number;
  /** Charge radius, metres. */
  size: number;
  /** Camera kick per shot, radians. */
  kick: number;
  burst?: number;
  /** Times a charge bounces before it bursts. */
  bounces?: number;
  /** Bursts on impact: [radius, damage at the centre]. */
  splash?: [number, number];
  /** Sticks where it lands and bursts after this many seconds. */
  sticky?: number;
  /** Steers toward the nearest enemy; radians per second. */
  homing?: number;
  /** Splits into this many charges on impact. */
  cluster?: number;
  /** Pellets fly in a flat fan instead of a cone. */
  fan?: boolean;
  /** Scope: field of view while aiming. */
  zoom?: number;
  /** A blade, not a gun: damage of the heavy strike and reach in metres. `dmg` is the quick slash. */
  melee?: { heavy: number; range: number };
  /** How rare this type is, when its price does not say (blades cost nothing in a match). */
  rarity?: number;
}

export const RARITY = [
  { name: "Обычный", color: "#aab4be", hex: 0xaab4be },
  { name: "Необычный", color: "#4fc24a", hex: 0x4fc24a },
  { name: "Редкий", color: "#2f8cff", hex: 0x2f8cff },
  { name: "Эпический", color: "#a64dff", hex: 0xa64dff },
  { name: "Легендарный", color: "#ffb81a", hex: 0xffb81a },
  { name: "Ультра", color: "#ff3d6e", hex: 0xff3d6e },
];

const m = (d: MarkerDef): MarkerDef => d;

export const MARKERS: MarkerDef[] = [
  m({ id: "dvoyka", name: "Twins", cat: "rifle", side: true, price: 0, trick: "Два пистолета стреляют по очереди — очень часто. Выдаются бесплатно.", mode: "semi", dmg: 18, head: 1.8, rpm: 560, speed: 150, gravity: 1, spread: 0.02, pellets: 1, mag: 24, spare: 4, reload: 1.7, size: 0.05, kick: 0.01 }),
  m({ id: "baraban", name: "Hammer", cat: "rifle", side: true, price: 600, trick: "Револьвер: шесть тяжёлых зарядов, в голову — наповал.", mode: "semi", dmg: 55, head: 2, rpm: 160, speed: 210, gravity: 0.6, spread: 0.003, pellets: 1, mag: 6, spare: 4, reload: 2.2, size: 0.065, kick: 0.045 }),
  m({ id: "sprinter", name: "Striker", cat: "rifle", price: 1200, trick: "Полуавтомат: заряд на каждое нажатие, точно и быстро.", mode: "semi", dmg: 27, head: 2, rpm: 420, speed: 180, gravity: 0.9, spread: 0.008, pellets: 1, mag: 20, spare: 4, reload: 1.5, size: 0.055, kick: 0.012 }),
  m({ id: "zalp", name: "Breaker", cat: "rifle", price: 1100, trick: "Помповый: семь зарядов разом. Вблизи сносит с ног.", mode: "semi", dmg: 15, head: 1.3, rpm: 75, speed: 130, gravity: 1.2, spread: 0.075, pellets: 7, mag: 6, spare: 4, reload: 2.2, size: 0.045, kick: 0.05 }),
  m({ id: "treshotka", name: "Rattler", cat: "rifle", price: 1500, trick: "Автомат: зажми и поливай.", mode: "auto", dmg: 15, head: 1.8, rpm: 600, speed: 165, gravity: 1, spread: 0.035, pellets: 1, mag: 45, spare: 3, reload: 2.1, size: 0.05, kick: 0.009 }),
  m({ id: "ochered", name: "Triad", cat: "rifle", price: 1800, trick: "Три заряда за нажатие, кучно на любой дистанции.", mode: "burst", burst: 3, dmg: 21, head: 2, rpm: 900, speed: 180, gravity: 0.9, spread: 0.012, pellets: 1, mag: 30, spare: 3, reload: 1.8, size: 0.055, kick: 0.01 }),
  m({ id: "raduga", name: "Cyclone", cat: "mini", price: 3200, trick: "Шестиствольный: раскручивается и не даёт высунуться.", mode: "spin", dmg: 11, head: 1.5, rpm: 1200, speed: 155, gravity: 1, spread: 0.05, pellets: 1, mag: 160, spare: 1, reload: 3.2, size: 0.05, kick: 0.006 }),
  m({ id: "gidrant", name: "Torrent", cat: "mini", price: 2100, trick: "Струя плазмы: бьёт дугой, пока жмёшь, и жжёт всё на пути.", mode: "stream", dmg: 5, head: 1, rpm: 1800, speed: 46, gravity: 0.7, spread: 0.03, pellets: 1, mag: 300, spare: 1, reload: 2.8, size: 0.045, kick: 0.002 }),
  m({ id: "dalnoboy", name: "Longshot", cat: "sniper", price: 3500, trick: "Прицел и почти прямой полёт через всю карту. В голову — наповал.", mode: "semi", dmg: 88, head: 2.5, rpm: 50, speed: 420, gravity: 0.3, spread: 0.001, pellets: 1, mag: 5, spare: 4, reload: 2.6, size: 0.06, kick: 0.06, zoom: 20 }),
  m({ id: "impuls", name: "Overload", cat: "sniper", price: 3000, trick: "Копит заряд, пока держишь: полный бьёт втрое сильнее и пробивает насквозь.", mode: "charge", dmg: 30, head: 1.6, rpm: 200, speed: 150, gravity: 0.5, spread: 0.004, pellets: 1, mag: 12, spare: 3, reload: 2.1, size: 0.06, kick: 0.03, zoom: 40 }),
  m({ id: "veer", name: "Sweeper", cat: "contra", price: 1700, trick: "Пять зарядов плоским веером: перекрывает коридор.", mode: "semi", dmg: 24, head: 1.3, rpm: 110, speed: 130, gravity: 1, spread: 0.2, pellets: 5, mag: 8, spare: 3, reload: 2.1, size: 0.055, kick: 0.035, fan: true }),
  m({ id: "rikoshet", name: "Ricochet", cat: "contra", price: 2000, trick: "Заряды трижды отскакивают: бей из-за угла.", mode: "semi", dmg: 34, head: 1.8, rpm: 300, speed: 110, gravity: 0.5, spread: 0.01, pellets: 1, mag: 16, spare: 3, reload: 1.8, size: 0.065, kick: 0.014, bounces: 3 }),
  m({ id: "mortira", name: "Mortar", cat: "contra", price: 2800, trick: "Навесом кидает бомбу: накрывает всех в радиусе четырёх метров.", mode: "semi", dmg: 40, head: 1, rpm: 55, speed: 34, gravity: 1, spread: 0.01, pellets: 1, mag: 4, spare: 2, reload: 2.6, size: 0.13, kick: 0.05, splash: [4, 100] }),
  m({ id: "lipuchka", name: "Leech", cat: "contra", price: 2600, trick: "Липкие мины: цепляются к стенам и людям, рвутся через секунду.", mode: "semi", dmg: 10, head: 1, rpm: 110, speed: 40, gravity: 1, spread: 0.01, pellets: 1, mag: 5, spare: 2, reload: 2.3, size: 0.1, kick: 0.03, sticky: 1.2, splash: [3.4, 90] }),
  m({ id: "roy", name: "Swarm", cat: "contra", price: 3600, trick: "Три заряда за выстрел сами находят цель.", mode: "semi", dmg: 17, head: 1.2, rpm: 200, speed: 44, gravity: 0, spread: 0.16, pellets: 3, mag: 18, spare: 2, reload: 2.3, size: 0.055, kick: 0.016, homing: 5 }),
  m({ id: "sverhnova", name: "Supernova", cat: "contra", price: 4000, trick: "Медленная сфера, которая лопается на четырнадцать осколков.", mode: "semi", dmg: 50, head: 1, rpm: 45, speed: 30, gravity: 0.15, spread: 0.004, pellets: 1, mag: 3, spare: 2, reload: 3.0, size: 0.2, kick: 0.06, cluster: 14, splash: [3, 60] }),
];

/** Blades. Everyone carries the plain one; the rest are the rarest things a case can hold. */
const k = (id: string, name: string, rarity: number, trick: string, dmg: number, heavy: number, range: number, rpm: number): MarkerDef => ({
  id, name, cat: "knife", price: 0, trick, mode: "semi", dmg, head: 1, rpm, speed: 0, gravity: 0, spread: 0, pellets: 1, mag: 1, spare: 0, reload: 0, size: 0, kick: 0, rarity, melee: { heavy, range },
});

export const KNIVES: MarkerDef[] = [
  k("k_combat", "Combat Knife", 0, "Простой боевой нож. Есть у каждого.", 40, 75, 2.1, 140),
  k("k_kunai", "Kunai", 2, "Лёгкий клинок с кольцом: режет чаще всех.", 34, 70, 2.0, 175),
  k("k_cleaver", "Cleaver", 3, "Тесак мясника: медленный взмах, тяжёлый удар.", 50, 95, 2.1, 110),
  k("k_machete", "Machete", 3, "Длинное лезвие: достаёт дальше остальных.", 44, 80, 2.6, 125),
  k("k_karambit", "Karambit", 4, "Коготь на кольце. Крутится на пальце, когда его рассматривают.", 40, 80, 2.0, 150),
  k("k_butterfly", "Butterfly", 4, "Нож-бабочка: раскрывается и складывается на лету.", 38, 78, 2.0, 160),
  k("k_tomahawk", "Tomahawk", 4, "Боевой топор с шипом на обухе.", 48, 100, 2.2, 105),
  k("k_katana", "Katana", 5, "Длинный изогнутый клинок. Один сильный удар — и всё.", 46, 110, 2.8, 115),
  k("k_ripper", "Ripper", 5, "Цепная пила на рукояти: зубья бегут, пока режешь.", 30, 90, 2.3, 230),
  k("k_saber", "Pulse Blade", 5, "Клинок из света. Гудит, гаснет и зажигается.", 45, 100, 2.6, 135),
];
MARKERS.push(...KNIVES);
/** Everything that shoots. */
export const GUNS: MarkerDef[] = MARKERS.filter((d) => !d.melee);
export const DEFAULT_KNIFE = "k_combat";
/** Chance that a case holds a blade, percent, and how the rarities split when it does. */
export const KNIFE_CHANCE = 3;
const KNIFE_ODDS = [0, 0, 40, 30, 22, 8];

export const MARKER_BY_ID: Record<string, MarkerDef> = Object.fromEntries(MARKERS.map((d) => [d.id, d]));
/** What everyone spawns with. */
export const DEFAULT_SIDE = "dvoyka";

export interface Pattern {
  name: string;
  rarity: number;
  /** Accent colour, body colour, detail colour. */
  a: number;
  b: number;
  c: number;
  /** Texture painted over the body: /art/pat_<tex>.jpg. */
  tex?: string;
  /** The body glows. */
  glow?: boolean;
  /** The body is metal, not plastic. */
  metal?: boolean;
  /** Only from the battle pass: never drops from a case. */
  pass?: boolean;
}

/** Skins. Cosmetic only — and what makes two copies of a weapon different items on the market. */
export const PATTERNS: Pattern[] = [
  { name: "Factory", rarity: 0, a: 0xff7a1a, b: 0x3d4766, c: 0xcfd6e0 },
  { name: "Marine", rarity: 0, a: 0xffd21a, b: 0x1fa8ff, c: 0x18d6c8, tex: "sea" },
  { name: "Strawberry", rarity: 0, a: 0xf5f5f7, b: 0xff4d8d, c: 0xd91a4d, tex: "strawberry" },
  { name: "Whiteout", rarity: 1, a: 0x3a3f47, b: 0xf2f4f7, c: 0xaab4c0, tex: "whiteout" },
  { name: "Lime", rarity: 1, a: 0xb6ff2e, b: 0x2b2f36, c: 0x5a6068, tex: "lime" },
  { name: "Cherry Wood", rarity: 2, a: 0xd9a441, b: 0x8a3b24, c: 0x3a2018, tex: "wood" },
  { name: "Tiger", rarity: 2, a: 0x16171a, b: 0xff8a1a, c: 0xf5f0e6, tex: "tiger" },
  { name: "Neon", rarity: 3, a: 0xff2bd6, b: 0x16171a, c: 0x18f0ff, tex: "neon", glow: true },
  { name: "Sunset", rarity: 3, a: 0xffd21a, b: 0xff5fa2, c: 0x7a3df0, tex: "sunset" },
  { name: "Gold", rarity: 4, a: 0x1b1c20, b: 0xf2b824, c: 0xfff3c2, tex: "gold", metal: true },
  { name: "Cosmos", rarity: 5, a: 0x2be0ff, b: 0x3a2a8a, c: 0xff5fd0, tex: "cosmos", glow: true },
  { name: "Lava", rarity: 4, a: 0xffb81a, b: 0x1b1210, c: 0xff5a1a, tex: "lava", glow: true, pass: true },
  { name: "Hologram", rarity: 5, a: 0xffffff, b: 0xb48cff, c: 0x35e0d0, tex: "holo", metal: true, pass: true },
];

/** One skin a player owns: a weapon type in a pattern, with a serial number. */
export interface MarkerItem {
  uid: string;
  id: string;
  skin: number;
  serial: number;
  /** A free default skin: cannot be sold. */
  starter?: boolean;
}

/** Drop odds by rarity, in percent, for the weapon type's skin tier and for the pattern. Shown to the player. */
export const CASE_ODDS = [52, 26, 13, 6, 2.6, 0.4];
export const PATTERN_ODDS = [58, 22, 13, 5.2, 1.5, 0.3];
/** Coins the shop pays for an item of this rarity. */
export const MARKER_VALUE = [30, 70, 180, 500, 1500, 5000];
export const CASE_PRICE = 250;

/** How rare a weapon's skins are, from its price: an expensive weapon's skins are scarcer. */
export function typeRarity(d: MarkerDef): number {
  if (d.rarity !== undefined) return d.rarity;
  return d.price < 700 ? 0 : d.price < 1600 ? 0 : d.price < 2100 ? 1 : d.price < 3000 ? 2 : d.price < 3600 ? 3 : d.price < 4000 ? 4 : 5;
}

export function itemRarity(item: { id: string; skin: number }): number {
  return Math.max(typeRarity(MARKER_BY_ID[item.id] ?? MARKERS[0]), PATTERNS[item.skin]?.rarity ?? 0);
}

export function itemValue(item: MarkerItem): number {
  if (item.starter) return 0;
  const lo = Math.min(typeRarity(MARKER_BY_ID[item.id]), PATTERNS[item.skin].rarity);
  return MARKER_VALUE[itemRarity(item)] + Math.round(MARKER_VALUE[lo] * 0.5);
}

export function itemName(item: { id: string; skin: number }): string {
  return `${MARKER_BY_ID[item.id].name} | ${PATTERNS[item.skin].name}`;
}

let seq = 0;
export function newMarker(id: string, skin = 0, starter = false): MarkerItem {
  return {
    uid: `m${Date.now().toString(36)}${(seq++).toString(36)}${Math.floor(Math.random() * 1e5).toString(36)}`,
    id, skin, serial: 1 + Math.floor(Math.random() * 9999), starter: starter || undefined,
  };
}

function weighted(odds: number[]): number {
  let r = Math.random() * odds.reduce((a, b) => a + b, 0);
  for (let i = 0; i < odds.length; i++) {
    r -= odds[i];
    if (r < 0) return i;
  }
  return 0;
}

const any = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

export function rollCase(): MarkerItem {
  if (Math.random() * 100 < KNIFE_CHANCE) {
    const tier = weighted(KNIFE_ODDS);
    const blades = KNIVES.filter((d) => d.rarity === tier);
    const skins = PATTERNS.map((p, i) => ({ p, i })).filter((x) => !x.p.pass && x.p.rarity === weighted(PATTERN_ODDS));
    return newMarker(any(blades.length ? blades : KNIVES.slice(1)).id, skins.length ? any(skins).i : 0);
  }
  const tier = weighted(CASE_ODDS);
  const types = GUNS.filter((d) => typeRarity(d) === tier);
  const rarity = weighted(PATTERN_ODDS);
  const skins = PATTERNS.map((p, i) => ({ p, i })).filter((x) => x.p.rarity === rarity && !x.p.pass);
  return newMarker(any(types.length ? types : GUNS).id, any(skins.length ? skins : [{ p: PATTERNS[1], i: 1 }]).i);
}

/** 0..1 bars for the inventory screen. */
export function markerBars(d: MarkerDef): { dmg: number; rate: number; aim: number; mag: number } {
  const hit = d.dmg * d.pellets + (d.splash ? d.splash[1] : 0) + (d.mode === "charge" ? 90 : 0);
  return {
    dmg: Math.min(1, hit / 130),
    rate: Math.min(1, (d.rpm * (d.burst ?? 1)) / 1500),
    aim: Math.max(0.05, 1 - d.spread / 0.08),
    mag: Math.min(1, d.mag / 120),
  };
}
