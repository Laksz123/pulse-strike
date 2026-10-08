/**
 * How a gun moves in the hands, beyond aiming and firing: being drawn, reloaded and looked over.
 *
 * Each is a curve over 0..1 that says where the weapon is relative to its resting pose, where the
 * supporting hand is — on the weapon, at the magazine, working the action, or away fetching a
 * fresh magazine — and how far the action is pulled. Weapons fall into a few families that
 * handle differently: a pair of pistols, a revolver, anything fed from a magazine, a pump, a
 * bolt, and the heavy ones loaded from the top.
 */

export type GunKind = "dual" | "revolver" | "mag" | "pump" | "bolt" | "heavy";

export const GUN_KIND: Record<string, GunKind> = {
  dvoyka: "dual", baraban: "revolver", zalp: "pump", dalnoboy: "bolt", raduga: "heavy", gidrant: "heavy", mortira: "heavy", sverhnova: "heavy",
};
export const kindOf = (id: string): GunKind => GUN_KIND[id] ?? "mag";

/** Seconds to bring each family up; it cannot fire until most of that has passed. */
export const DRAW_TIME: Record<GunKind, number> = { dual: 0.42, revolver: 0.55, mag: 0.56, pump: 0.72, bolt: 0.82, heavy: 0.78 };
export const INSPECT_TIME = 2.8;

export interface GunPose {
  x: number;
  y: number;
  z: number;
  pitch: number;
  yaw: number;
  roll: number;
  /** The supporting hand, as weights: at the magazine well, on the action, away out of sight. The rest is on the weapon. */
  well: number;
  action: number;
  away: number;
  /** The feed is in that hand rather than in the weapon. */
  mag: boolean;
  /** How far the hand has drawn back from where the feed seats: down for a magazine, up for a top loader. */
  pull: number;
  /** The action pulled, 0..1. */
  rack: number;
}

const smooth = (k: number) => k * k * (3 - 2 * k);
const span = (u: number, a: number, b: number) => Math.max(0, Math.min(1, (u - a) / (b - a)));
/** 0 up to `a`, 1 between `b` and `c`, 0 again after `d`. */
const hold = (u: number, a: number, b: number, c: number, d: number) => smooth(span(u, a, b)) * (1 - smooth(span(u, c, d)));
/** Past the mark and back: what makes a stop look like it has weight. */
const overshoot = (k: number) => 1 + 2.2 * (k - 1) ** 3 + 1.2 * (k - 1) ** 2;
const zero = (): GunPose => ({ x: 0, y: 0, z: 0, pitch: 0, yaw: 0, roll: 0, well: 0, action: 0, away: 0, mag: false, pull: 0, rack: 0 });

/** Up from below and across, settling a little past true; then the family's own habit. */
export function drawPose(kind: GunKind, u: number): GunPose {
  const p = zero();
  const rise = 1 - overshoot(span(u, 0, kind === "heavy" ? 0.7 : 0.55));
  p.y = -0.36 * rise;
  p.x = 0.05 * rise;
  p.pitch = 0.75 * rise;
  p.yaw = 0.95 * rise;
  p.roll = -0.6 * rise;
  // The other hand arrives after the weapon is up.
  p.away = 1 - smooth(span(u, 0.25, 0.55));
  if (kind === "dual") {
    p.yaw = 0;
    p.pitch = 1.3 * rise;
    p.roll = 0;
    p.rack = hold(u, 0.5, 0.66, 0.74, 0.92);
  } else if (kind === "revolver") {
    // Once round the finger on the way up.
    p.pitch += Math.PI * 2 * (1 - smooth(span(u, 0.05, 0.7)));
    p.away = 1;
  } else if (kind === "mag") {
    p.action = hold(u, 0.56, 0.68, 0.8, 0.94);
    p.rack = hold(u, 0.66, 0.76, 0.8, 0.9);
    p.roll += 0.14 * p.action;
  } else if (kind === "pump") {
    p.rack = hold(u, 0.58, 0.72, 0.76, 0.92);
    p.z = 0.02 * p.rack;
    p.pitch += 0.06 * p.rack;
  } else if (kind === "bolt") {
    p.rack = hold(u, 0.55, 0.68, 0.76, 0.92);
    p.roll += -0.16 * p.rack;
    p.pitch += 0.05 * p.rack;
  } else {
    // Heavy: it lands in the hands.
    p.y += -0.03 * Math.sin(span(u, 0.7, 1) * Math.PI);
    p.action = hold(u, 0.62, 0.74, 0.8, 0.95);
  }
  return p;
}

/** Moments in a reload, 0..1, when something clicks: out, in, and the action. */
export const RELOAD_CUES: Record<GunKind, { out: number[]; in: number[]; rack: number[] }> = {
  mag: { out: [0.2], in: [0.58], rack: [0.8] },
  bolt: { out: [0.2], in: [0.56], rack: [0.8] },
  pump: { out: [], in: [0.2, 0.36, 0.52, 0.68], rack: [0.84] },
  revolver: { out: [0.16], in: [0.56], rack: [0.82] },
  dual: { out: [0.22], in: [0.6], rack: [0.8] },
  heavy: { out: [0.22], in: [0.62], rack: [0.84] },
};

export function reloadPose(kind: GunKind, u: number): GunPose {
  const p = zero();
  const out = hold(u, 0, 0.14, 0.84, 1);
  if (kind === "dual") {
    // Both down out of sight, muzzles up, and back.
    const down = hold(u, 0.05, 0.25, 0.6, 0.82);
    p.y = -0.3 * down;
    p.pitch = 0.9 * down + 0.15 * out;
    p.rack = hold(u, 0.72, 0.8, 0.84, 0.94);
    return p;
  }
  if (kind === "revolver") {
    // Muzzle up, cylinder out, emptied with a shake, loaded, flicked shut.
    p.pitch = 0.55 * out + Math.sin(span(u, 0.16, 0.3) * Math.PI * 2) * 0.12;
    p.roll = 0.3 * out - 0.5 * hold(u, 0.76, 0.82, 0.84, 0.92);
    p.y = 0.03 * out;
    p.rack = hold(u, 0.08, 0.18, 0.74, 0.84);
    p.away = hold(u, 0.2, 0.34, 0.4, 0.52);
    p.action = hold(u, 0.46, 0.56, 0.62, 0.74);
    p.mag = u > 0.36 && u < 0.58;
    p.y += 0.012 * hold(u, 0.55, 0.57, 0.58, 0.64);
    return p;
  }
  if (kind === "pump") {
    // Turned over, fed one at a time, racked.
    const over = hold(u, 0, 0.12, 0.72, 0.82);
    p.roll = -0.62 * over;
    p.pitch = 0.28 * out;
    p.yaw = 0.2 * over;
    p.x = -0.04 * over;
    p.y = 0.06 * over;
    for (const at of RELOAD_CUES.pump.in) {
      p.well = Math.max(p.well, hold(u, at - 0.1, at - 0.01, at + 0.02, at + 0.07));
      p.y += 0.012 * hold(u, at - 0.02, at, at + 0.01, at + 0.05);
    }
    p.mag = u > 0.08 && u < 0.7;
    p.rack = hold(u, 0.78, 0.84, 0.87, 0.96);
    p.z = 0.02 * p.rack;
    return p;
  }
  if (kind === "heavy") {
    // Swung across and tipped toward the eye; the cell on top lifted off, a full one dropped on, a slap to seat it.
    p.y = -0.03 * out;
    p.z = -0.07 * out;
    p.pitch = 0.04 * out;
    p.yaw = 0.62 * out;
    p.roll = 0.34 * out;
    p.x = -0.02 * out;
    p.action = Math.max(hold(u, 0.06, 0.2, 0.24, 0.34), hold(u, 0.42, 0.52, 0.66, 0.74), hold(u, 0.78, 0.84, 0.86, 0.94));
    p.pull = hold(u, 0.21, 0.27, 0.58, 0.62);
    p.away = hold(u, 0.24, 0.34, 0.42, 0.52);
    p.mag = u > 0.21 && u < 0.63;
    p.y += 0.02 * hold(u, 0.2, 0.23, 0.25, 0.32) - 0.03 * hold(u, 0.6, 0.62, 0.63, 0.7) - 0.03 * hold(u, 0.82, 0.84, 0.85, 0.9);
    p.roll += 0.05 * hold(u, 0.6, 0.62, 0.63, 0.72);
    return p;
  }
  // From a magazine: cant it, strip the old one, bring a new one up, seat it, work the action.
  // Brought up and across, so the work is done where it can be seen.
  // Rolled so the magazine points in toward the middle of the view, where the other hand comes from.
  p.roll = -0.62 * out;
  p.pitch = 0.3 * out;
  p.yaw = 0.24 * out;
  p.x = -0.05 * out;
  p.y = 0.07 * out;
  // The hand goes to the magazine, draws it straight down and takes it away; comes back under the
  // well with a full one, lines it up, and drives it home.
  p.well = Math.max(hold(u, 0.05, 0.18, 0.24, 0.34), hold(u, 0.4, 0.5, 0.6, 0.7));
  p.pull = hold(u, 0.2, 0.26, 0.54, 0.58);
  p.away = hold(u, 0.24, 0.34, 0.4, 0.5);
  p.mag = u > 0.19 && u < 0.59;
  p.action = hold(u, 0.66, 0.76, 0.82, 0.94);
  p.rack = hold(u, 0.74, 0.8, 0.82, 0.9);
  p.z = 0.012 * p.rack;
  // The weapon answers each of them: it sags as the weight leaves, jumps as it returns, jerks with the action.
  const gone = hold(u, 0.19, 0.22, 0.24, 0.34);
  const home = hold(u, 0.57, 0.585, 0.6, 0.68);
  const jerk = hold(u, 0.74, 0.79, 0.81, 0.9);
  p.y += 0.014 * gone + 0.02 * home - 0.012 * jerk;
  p.roll += 0.07 * gone - 0.08 * home - 0.12 * jerk;
  p.pitch += -0.05 * gone + 0.07 * home + 0.05 * jerk;
  p.yaw += Math.sin(u * 9) * 0.02 * out;
  if (kind === "bolt") p.roll += -0.2 * p.action;
  return p;
}

/** Turned to show one side, the action checked, the other side, and back. */
export function inspectPose(kind: GunKind, u: number, t: number): GunPose {
  const p = zero();
  const on = hold(u, 0, 0.1, 0.9, 1);
  const a = hold(u, 0.06, 0.2, 0.42, 0.54);
  const b = hold(u, 0.5, 0.64, 0.84, 0.94);
  p.x = -0.1 * a + 0.03 * b;
  p.y = 0.05 * on + Math.sin(t * 2) * 0.004 * on;
  p.z = 0.06 * on;
  p.yaw = 0.95 * a - 0.75 * b;
  p.roll = -0.3 * a + 0.55 * b + Math.sin(t * 1.4) * 0.03 * on;
  p.pitch = 0.1 * a + 0.22 * b;
  p.away = kind === "dual" ? 0 : hold(u, 0.04, 0.16, 0.82, 0.94);
  p.rack = hold(u, 0.4, 0.48, 0.52, 0.6);
  if (kind === "revolver") p.pitch += Math.PI * 2 * smooth(span(u, 0.44, 0.62));
  return p;
}
