/**
 * The whole crafting tree. Progression in one line:
 * hands (stone tools, rags) → workbench 1 + furnace (iron, leather, first guns)
 * → workbench 2 (steel, plate, rifles) → workbench 3 (motor tools, kevlar, the best guns).
 * "Upgrade" recipes take the previous tier as an ingredient, so gear is improved, not replaced.
 */

import type { ResId } from "./items";
import type { AmmoType } from "./weapons";

export type RecipeCat = "tools" | "weapons" | "armor" | "meds" | "ammo" | "smelt" | "station";

export const CAT_NAMES: Record<RecipeCat, string> = {
  tools: "Инструменты",
  weapons: "Оружие",
  armor: "Броня",
  meds: "Медицина",
  ammo: "Патроны",
  smelt: "Печь",
  station: "База",
};
export const CAT_ORDER: RecipeCat[] = ["tools", "armor", "weapons", "ammo", "meds", "smelt", "station"];

export interface Recipe {
  id: string;
  cat: RecipeCat;
  /** Workbench level needed; 0 = craftable by hand anywhere. */
  bench: 0 | 1 | 2 | 3;
  /** Needs the furnace (camp only). */
  furnace?: boolean;
  /** Seconds to craft. */
  time: number;
  res?: Partial<Record<ResId, number>>;
  /** Gear consumed, by item id: this is what makes a recipe an upgrade. */
  items?: Record<string, number>;
  out: { item?: string; n?: number; res?: Partial<Record<ResId, number>>; ammo?: Partial<Record<AmmoType, number>>; bench?: 2 | 3; pocket?: 4 | 6 };
  /** Needs this blueprint studied first. */
  bp?: string;
  /** Shown instead of the output item's name. */
  name?: string;
}

const tool = (id: string, bench: Recipe["bench"], time: number, res: Recipe["res"], from?: string, bp?: string): Recipe => ({
  id, cat: "tools", bench, time, res, items: from ? { [from]: 1 } : undefined, out: { item: id }, bp,
});
const gun = (id: string, bench: Recipe["bench"], res: Recipe["res"]): Recipe => ({
  id, cat: "weapons", bench, time: 6 + bench * 3, res, out: { item: id }, bp: bench === 3 ? id : undefined,
});

const ARMOR_COST: Record<string, { bench: Recipe["bench"]; from?: string; res: Partial<Record<ResId, number>>[] }> = {
  // head, chest, legs, feet
  cloth: { bench: 0, res: [{ cloth: 3 }, { cloth: 5 }, { cloth: 4 }, { cloth: 2 }] },
  hide: { bench: 1, from: "cloth", res: [{ hide: 2 }, { hide: 4 }, { hide: 3 }, { hide: 2 }] },
  plate: { bench: 2, from: "hide", res: [{ iron: 4, scrap: 2 }, { iron: 8, scrap: 4 }, { iron: 6, scrap: 3 }, { iron: 4, scrap: 2 }] },
  kevlar: { bench: 3, from: "plate", res: [{ cloth: 6, elec: 2, crystal: 1 }, { cloth: 10, elec: 4, crystal: 2 }, { cloth: 8, elec: 3, crystal: 1 }, { cloth: 5, elec: 2, crystal: 1 }] },
};

const armor: Recipe[] = [];
for (const [key, cost] of Object.entries(ARMOR_COST)) {
  (["head", "chest", "legs", "feet"] as const).forEach((slot, i) => {
    armor.push({
      id: `${key}_${slot}`, cat: "armor", bench: cost.bench, time: 3 + cost.bench * 2, res: cost.res[i],
      items: cost.from ? { [`${cost.from}_${slot}`]: 1 } : undefined, out: { item: `${key}_${slot}` }, bp: key === "kevlar" ? "kevlar" : undefined,
    });
  });
}

export const RECIPES: Recipe[] = [
  // Tools: stone by hand, then each tier upgrades the previous one.
  tool("axe_stone", 0, 3, { wood: 3, stone: 2 }),
  tool("pick_stone", 0, 3, { wood: 3, stone: 3 }),
  tool("axe_iron", 1, 5, { iron: 4, wood: 2 }, "axe_stone"),
  tool("pick_iron", 1, 5, { iron: 5, wood: 2 }, "pick_stone"),
  tool("axe_steel", 2, 8, { iron: 6, scrap: 6, elec: 1 }, "axe_iron"),
  tool("pick_steel", 2, 8, { iron: 7, scrap: 6, elec: 1 }, "pick_iron"),
  tool("chainsaw", 3, 12, { iron: 10, elec: 8, crystal: 2 }, "axe_steel", "chainsaw"),
  tool("jackhammer", 3, 12, { iron: 12, elec: 8, crystal: 2 }, "pick_steel", "jackhammer"),
  { id: "lockpick", cat: "tools", bench: 0, time: 2, res: { scrap: 2 }, out: { item: "lockpick", n: 2 } },

  ...armor,

  gun("pm9", 1, { iron: 6, scrap: 4 }),
  gun("dvustvolka", 1, { iron: 8, wood: 6 }),
  gun("kedr", 1, { iron: 10, scrap: 6, elec: 1 }),
  gun("ak_rusty", 2, { iron: 14, wood: 8, scrap: 6, elec: 2 }),
  gun("mosinka", 2, { iron: 12, wood: 10 }),
  gun("gyurza", 2, { iron: 10, scrap: 6, elec: 2 }),
  gun("stepnyak", 2, { iron: 12, wood: 3, scrap: 4 }),
  gun("pompa", 2, { iron: 14, scrap: 8, elec: 1 }),
  gun("shershen", 3, { iron: 14, scrap: 8, elec: 4, crystal: 1 }),
  gun("akm_aral", 3, { iron: 18, wood: 8, elec: 4, crystal: 2 }),
  gun("val", 3, { iron: 20, elec: 6, crystal: 3 }),
  gun("saiga", 3, { iron: 20, scrap: 10, elec: 5, crystal: 3 }),
  gun("svd", 3, { iron: 22, wood: 8, elec: 6, crystal: 4 }),
  gun("rpk", 3, { iron: 26, wood: 10, elec: 6, crystal: 4 }),

  { id: "bolt", cat: "ammo", bench: 0, time: 2, res: { wood: 2, stone: 1 }, out: { ammo: { bolt: 5 } } },
  { id: "powder", cat: "ammo", bench: 1, time: 2, res: { chem: 2, wood: 2 }, out: { res: { powder: 5 } }, name: "Порох ×5" },
  { id: "ammo_light", cat: "ammo", bench: 1, time: 2, res: { iron: 1, powder: 2 }, out: { ammo: { light: 12 } } },
  { id: "ammo_shell", cat: "ammo", bench: 1, time: 2, res: { iron: 1, powder: 3 }, out: { ammo: { shell: 6 } } },
  { id: "ammo_medium", cat: "ammo", bench: 2, time: 3, res: { iron: 2, powder: 3 }, out: { ammo: { medium: 10 } } },
  { id: "ammo_heavy", cat: "ammo", bench: 2, time: 3, res: { iron: 2, powder: 4 }, out: { ammo: { heavy: 5 } } },

  { id: "bandage", cat: "meds", bench: 0, time: 2, res: { cloth: 2 }, out: { item: "bandage" } },
  { id: "cooked", cat: "meds", bench: 0, time: 2, res: { meat: 1, wood: 1 }, out: { item: "cooked" } },
  { id: "medkit", cat: "meds", bench: 1, time: 4, res: { cloth: 3, chem: 2 }, out: { item: "medkit" } },

  { id: "smelt_ore", cat: "smelt", bench: 0, furnace: true, time: 2, res: { ore: 2, wood: 1 }, out: { res: { iron: 1 } }, name: "Железо из руды" },
  { id: "smelt_ore5", cat: "smelt", bench: 0, furnace: true, time: 8, res: { ore: 10, wood: 5 }, out: { res: { iron: 5 } }, name: "Железо из руды ×5" },
  { id: "smelt_scrap", cat: "smelt", bench: 0, furnace: true, time: 2, res: { scrap: 3, wood: 1 }, out: { res: { iron: 1 } }, name: "Железо из металлолома" },

  { id: "bench2", cat: "station", bench: 1, time: 10, res: { wood: 30, stone: 20, iron: 15, scrap: 10 }, out: { bench: 2 }, name: "Верстак 2 уровня" },
  { id: "bench3", cat: "station", bench: 2, time: 20, res: { iron: 40, scrap: 30, elec: 10, crystal: 3 }, out: { bench: 3 }, name: "Верстак 3 уровня" },
  { id: "pocket4", cat: "station", bench: 1, time: 8, res: { cloth: 20, hide: 10 }, out: { pocket: 4 }, name: "Защищённый карман: 4 слота" },
  { id: "pocket6", cat: "station", bench: 2, time: 14, res: { hide: 30, elec: 8, crystal: 2 }, out: { pocket: 6 }, name: "Защищённый карман: 6 слотов" },
];

export const RECIPE_BY_ID: Record<string, Recipe> = Object.fromEntries(RECIPES.map((r) => [r.id, r]));

/** Cost of raising a gun's rarity by one step at the workbench. Index = current rarity; legendary only drops. */
export const GUN_UPGRADE: { bench: 1 | 2 | 3; res: Partial<Record<ResId, number>> }[] = [
  { bench: 1, res: { iron: 4, scrap: 3 } },
  { bench: 2, res: { iron: 8, elec: 3 } },
  { bench: 3, res: { elec: 6, crystal: 5 } },
];

export interface Offer {
  id: string;
  name: string;
  price: number;
  /** Reputation with the trader needed to see the offer. */
  rep: number;
  item?: string;
  n?: number;
  ammo?: Partial<Record<AmmoType, number>>;
}

/** What the camp trader sells for salt. */
export const OFFERS: Offer[] = [
  { id: "t_bolt", name: "Болты ×10", price: 15, rep: 0, ammo: { bolt: 10 } },
  { id: "t_bandage", name: "Бинт", price: 25, rep: 0, item: "bandage" },
  { id: "t_lockpick", name: "Отмычки ×3", price: 45, rep: 0, item: "lockpick", n: 3 },
  { id: "t_light", name: "Лёгкие патроны ×20", price: 40, rep: 0, ammo: { light: 20 } },
  { id: "t_shell", name: "Дробь ×8", price: 45, rep: 100, ammo: { shell: 8 } },
  { id: "t_medkit", name: "Аптечка", price: 80, rep: 100, item: "medkit" },
  { id: "t_medium", name: "Средние патроны ×20", price: 70, rep: 250, ammo: { medium: 20 } },
  { id: "t_heavy", name: "Тяжёлые патроны ×10", price: 70, rep: 250, ammo: { heavy: 10 } },
  { id: "t_milkit", name: "Военная аптечка", price: 220, rep: 450, item: "milkit" },
  { id: "t_bp_kevlar", name: "Чертёж: Кевларовая броня", price: 1500, rep: 450, item: "bp_kevlar" },
];
