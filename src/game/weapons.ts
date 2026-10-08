/** Weapon definitions, rarities and random affixes. Pure data, shared by the game and the UI. */

export type AmmoType = "bolt" | "light" | "medium" | "shell" | "heavy";
export const AMMO_ORDER: AmmoType[] = ["bolt", "light", "medium", "shell", "heavy"];
export type WeaponClass = "crossbow" | "pistol" | "smg" | "rifle" | "shotgun" | "sniper" | "lmg";

export const AMMO_NAMES: Record<AmmoType, string> = {
  bolt: "Болты",
  light: "Лёгкие патроны",
  medium: "Средние патроны",
  shell: "Дробь",
  heavy: "Тяжёлые патроны",
};

export const CLASS_NAMES: Record<WeaponClass, string> = {
  crossbow: "Арбалет",
  pistol: "Пистолет",
  smg: "ПП",
  rifle: "Автомат",
  shotgun: "Дробовик",
  sniper: "Снайперская",
  lmg: "Пулемёт",
};

export interface WeaponDef {
  id: string;
  name: string;
  cls: WeaponClass;
  ammo: AmmoType;
  /** Damage per pellet before rarity. */
  dmg: number;
  pellets: number;
  /** Rounds per minute. */
  rpm: number;
  auto: boolean;
  mag: number;
  /** Reload time, seconds. */
  reload: number;
  /** Max deviation from the aim, radians. */
  spread: number;
  /** Effective range, metres. */
  range: number;
  /** Camera kick per shot, radians. */
  recoil: number;
  /** Loot tier: 0 never drops (starter), 1 barrels, 3 only military crates and bosses. */
  tier: 0 | 1 | 2 | 3;
  /** Wooden furniture on the model. */
  wood?: boolean;
  /** Fires a slow bolt that drops with gravity instead of an instant bullet. */
  projectile?: boolean;
}

export const WEAPONS: WeaponDef[] = [
  { id: "crossbow", name: "Арбалет", cls: "crossbow", ammo: "bolt", dmg: 46, pellets: 1, rpm: 60, auto: false, mag: 1, reload: 1.9, spread: 0.004, range: 70, recoil: 0.03, tier: 0, wood: true, projectile: true },
  { id: "pm9", name: "ПМ-9", cls: "pistol", ammo: "light", dmg: 18, pellets: 1, rpm: 300, auto: false, mag: 8, reload: 1.3, spread: 0.012, range: 60, recoil: 0.022, tier: 1 },
  { id: "gyurza", name: "Гюрза", cls: "pistol", ammo: "light", dmg: 22, pellets: 1, rpm: 380, auto: false, mag: 18, reload: 1.5, spread: 0.01, range: 70, recoil: 0.02, tier: 2 },
  { id: "stepnyak", name: "Револьвер «Степняк»", cls: "pistol", ammo: "heavy", dmg: 58, pellets: 1, rpm: 110, auto: false, mag: 6, reload: 2.4, spread: 0.006, range: 90, recoil: 0.06, tier: 2, wood: true },
  { id: "kedr", name: "Кедр", cls: "smg", ammo: "light", dmg: 13, pellets: 1, rpm: 850, auto: true, mag: 30, reload: 1.7, spread: 0.028, range: 50, recoil: 0.012, tier: 1 },
  { id: "shershen", name: "Шершень", cls: "smg", ammo: "light", dmg: 15, pellets: 1, rpm: 1000, auto: true, mag: 35, reload: 1.9, spread: 0.032, range: 55, recoil: 0.013, tier: 2 },
  { id: "ak_rusty", name: "АК-Ржавый", cls: "rifle", ammo: "medium", dmg: 24, pellets: 1, rpm: 560, auto: true, mag: 30, reload: 2.3, spread: 0.02, range: 110, recoil: 0.02, tier: 1, wood: true },
  { id: "akm_aral", name: "АКМ-Арал", cls: "rifle", ammo: "medium", dmg: 29, pellets: 1, rpm: 620, auto: true, mag: 30, reload: 2.1, spread: 0.015, range: 130, recoil: 0.019, tier: 2, wood: true },
  { id: "val", name: "Вал", cls: "rifle", ammo: "medium", dmg: 27, pellets: 1, rpm: 800, auto: true, mag: 20, reload: 2.0, spread: 0.012, range: 120, recoil: 0.014, tier: 3 },
  { id: "dvustvolka", name: "Двустволка", cls: "shotgun", ammo: "shell", dmg: 13, pellets: 9, rpm: 140, auto: false, mag: 2, reload: 2.2, spread: 0.075, range: 30, recoil: 0.08, tier: 1, wood: true },
  { id: "pompa", name: "Помпа", cls: "shotgun", ammo: "shell", dmg: 12, pellets: 8, rpm: 75, auto: false, mag: 6, reload: 3.0, spread: 0.06, range: 35, recoil: 0.07, tier: 2 },
  { id: "saiga", name: "Сайга-А", cls: "shotgun", ammo: "shell", dmg: 10, pellets: 8, rpm: 260, auto: true, mag: 8, reload: 2.6, spread: 0.07, range: 32, recoil: 0.055, tier: 3 },
  { id: "mosinka", name: "Мосинка", cls: "sniper", ammo: "heavy", dmg: 95, pellets: 1, rpm: 42, auto: false, mag: 5, reload: 3.2, spread: 0.002, range: 300, recoil: 0.09, tier: 1, wood: true },
  { id: "svd", name: "СВД-Соль", cls: "sniper", ammo: "heavy", dmg: 78, pellets: 1, rpm: 150, auto: false, mag: 10, reload: 2.8, spread: 0.003, range: 300, recoil: 0.07, tier: 3, wood: true },
  { id: "rpk", name: "РПК", cls: "lmg", ammo: "medium", dmg: 26, pellets: 1, rpm: 600, auto: true, mag: 75, reload: 4.2, spread: 0.024, range: 130, recoil: 0.017, tier: 3, wood: true },
];

export const WEAPON_BY_ID: Record<string, WeaponDef> = Object.fromEntries(WEAPONS.map((w) => [w.id, w]));

export interface RarityDef {
  name: string;
  color: string;
  hex: number;
  /** Damage multiplier. */
  mult: number;
  /** Number of random affixes. */
  affixes: number;
  /** Sell price multiplier (salt). */
  value: number;
}

/** 0 common, 1 uncommon, 2 rare, 3 epic, 4 legendary. Epic and legendary can be minted on Solana. */
export const RARITIES: RarityDef[] = [
  { name: "Обычное", color: "#b8c0c8", hex: 0xb8c0c8, mult: 1.0, affixes: 0, value: 1 },
  { name: "Необычное", color: "#5fbf5a", hex: 0x5fbf5a, mult: 1.1, affixes: 0, value: 2.5 },
  { name: "Редкое", color: "#3d8bff", hex: 0x3d8bff, mult: 1.2, affixes: 1, value: 6 },
  { name: "Эпическое", color: "#a64dff", hex: 0xa64dff, mult: 1.35, affixes: 2, value: 20 },
  { name: "Легендарное", color: "#ffc21a", hex: 0xffc21a, mult: 1.5, affixes: 3, value: 80 },
];

export type AffixStat = "dmg" | "rpm" | "mag" | "reload" | "spread" | "recoil" | "head";

export interface AffixDef {
  id: string;
  name: string;
  stat: AffixStat;
  /** Relative change: +0.15 = +15 %. Negative is better for reload, spread and recoil. */
  value: number;
}

export const AFFIXES: AffixDef[] = [
  { id: "dmg1", name: "+12% урон", stat: "dmg", value: 0.12 },
  { id: "rpm1", name: "+15% скорострельность", stat: "rpm", value: 0.15 },
  { id: "mag1", name: "+30% магазин", stat: "mag", value: 0.3 },
  { id: "rel1", name: "−25% перезарядка", stat: "reload", value: -0.25 },
  { id: "spr1", name: "−35% разброс", stat: "spread", value: -0.35 },
  { id: "rec1", name: "−40% отдача", stat: "recoil", value: -0.4 },
  { id: "head1", name: "+50% урон в голову", stat: "head", value: 0.5 },
];

export const AFFIX_BY_ID: Record<string, AffixDef> = Object.fromEntries(AFFIXES.map((a) => [a.id, a]));

/** The part of an inventory item that decides how a gun shoots. */
export interface GunLike {
  id: string;
  rarity?: number;
  affixes?: string[];
}

export interface WeaponStats {
  dmg: number;
  pellets: number;
  rpm: number;
  mag: number;
  reload: number;
  spread: number;
  recoil: number;
  range: number;
  /** Headshot multiplier. */
  head: number;
}

export function statsOf(gun: GunLike): WeaponStats {
  const d = WEAPON_BY_ID[gun.id];
  const s: WeaponStats = {
    dmg: d.dmg * RARITIES[gun.rarity ?? 0].mult,
    pellets: d.pellets,
    rpm: d.rpm,
    mag: d.mag,
    reload: d.reload,
    spread: d.spread,
    recoil: d.recoil,
    range: d.range,
    head: d.cls === "sniper" ? 2.5 : 2,
  };
  for (const id of gun.affixes ?? []) {
    const a = AFFIX_BY_ID[id];
    if (!a) continue;
    if (a.stat === "head") s.head += a.value;
    else if (a.stat === "mag") s.mag = Math.max(1, Math.round(s.mag * (1 + a.value)));
    else s[a.stat] *= 1 + a.value;
  }
  return s;
}

/** Damage per second against a body, ignoring reloads: one number to compare guns in the UI. */
export function dpsOf(gun: GunLike): number {
  const s = statsOf(gun);
  return Math.round((s.dmg * s.pellets * s.rpm) / 60);
}

/** Salt a trader pays for the gun. */
export function gunValue(gun: GunLike): number {
  const d = WEAPON_BY_ID[gun.id];
  return Math.round(40 * Math.max(1, d.tier) * RARITIES[gun.rarity ?? 0].value);
}
