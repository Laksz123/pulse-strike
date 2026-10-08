/**
 * How a blade moves in the hand. Every motion is a short curve over 0..1: drawing it, two
 * slashes that mirror each other, a heavy strike, and looking it over — which each blade does
 * in its own way. The result is an offset from the resting pose of the hand.
 */

export type KnifeMove = "draw" | "slash" | "heavy" | "inspect";

export interface KnifePose {
  x: number;
  y: number;
  z: number;
  pitch: number;
  yaw: number;
  roll: number;
  /** Turn of the blade about its own handle. */
  spin: number;
}

/** Where each blade rests: how far it is tipped up, turned in, how high it is held, and how much of its flat is turned to the eye. Negative tilt is a reverse grip. */
export const HOLD: Record<string, { tilt: number; turn: number; y: number; z: number; flat: number }> = {
  k_combat: { tilt: 0.95, turn: 0.32, y: 0, z: 0, flat: 0.9 },
  k_kunai: { tilt: -0.5, turn: 0.5, y: 0.07, z: 0, flat: 0.5 },
  k_cleaver: { tilt: 0.85, turn: 0.3, y: -0.01, z: 0, flat: 1.1 },
  k_machete: { tilt: 1.0, turn: 0.28, y: -0.03, z: 0.04, flat: 0.9 },
  k_karambit: { tilt: -0.55, turn: 0.55, y: 0.08, z: 0, flat: 0.3 },
  k_butterfly: { tilt: 0.95, turn: 0.32, y: 0, z: 0, flat: 0.9 },
  k_tomahawk: { tilt: 1.1, turn: 0.3, y: -0.04, z: 0.04, flat: 1.1 },
  k_katana: { tilt: 1.05, turn: 0.26, y: -0.03, z: 0.07, flat: 0.85 },
  k_ripper: { tilt: 0.6, turn: 0.3, y: -0.04, z: 0.05, flat: 1.0 },
  k_saber: { tilt: 1.0, turn: 0.28, y: -0.04, z: 0.06, flat: 0 },
};

/** How each blade is shown off: end-over-end flips in the toss, turns about the handle, and a shake for the ones with a motor. */
const SHOW: Record<string, { flips: number; twirl: number; shake: number; slow?: boolean }> = {
  k_combat: { flips: 1, twirl: 0, shake: 0 },
  k_kunai: { flips: 4, twirl: 0, shake: 0 },
  k_cleaver: { flips: 2, twirl: 0, shake: 0 },
  k_machete: { flips: 0, twirl: 2, shake: 0 },
  k_karambit: { flips: 5, twirl: 0, shake: 0 },
  k_butterfly: { flips: 1, twirl: 1, shake: 0 },
  k_tomahawk: { flips: 2, twirl: 0, shake: 0 },
  k_katana: { flips: 0, twirl: 0, shake: 0, slow: true },
  k_ripper: { flips: 0, twirl: 0, shake: 1 },
  k_saber: { flips: 0, twirl: 1, shake: 0, slow: true },
};

/** How each blade comes out: turns about the handle, flips end over end, a pull from behind (a sheath), a jerk (a starter cord). */
const DRAW: Record<string, { spins: number; flips: number; pull?: number; jerk?: number; time: number }> = {
  k_combat: { spins: 1, flips: 0, time: 0.5 },
  k_kunai: { spins: 0, flips: 2, time: 0.55 },
  k_cleaver: { spins: 0, flips: 1, time: 0.6 },
  k_machete: { spins: 0.5, flips: 0, pull: 0.25, time: 0.6 },
  k_karambit: { spins: 0, flips: 3, time: 0.7 },
  k_butterfly: { spins: 1, flips: 0, time: 0.7 },
  k_tomahawk: { spins: 0, flips: 1, time: 0.65 },
  k_katana: { spins: 0, flips: 0, pull: 0.5, time: 0.8 },
  k_ripper: { spins: 0, flips: 0, jerk: 1, time: 0.8 },
  k_saber: { spins: 0.5, flips: 0, time: 0.7 },
};
export const drawTime = (id: string) => (DRAW[id] ?? DRAW.k_combat).time;

export const MOVE_TIME: Record<KnifeMove, number> = { draw: 0.5, slash: 0.4, heavy: 0.78, inspect: 3.0 };
/** The point in a strike, 0..1, where the blade connects. */
export const HIT_AT: Record<"slash" | "heavy", number> = { slash: 0.34, heavy: 0.5 };

const smooth = (k: number) => k * k * (3 - 2 * k);
const span = (u: number, a: number, b: number) => Math.max(0, Math.min(1, (u - a) / (b - a)));
const mix = (a: number, b: number, k: number) => a + (b - a) * k;

export function knifePose(id: string, move: KnifeMove | null, u: number, side: number, t: number): KnifePose {
  const p: KnifePose = { x: 0, y: 0, z: 0, pitch: 0, yaw: 0, roll: 0, spin: 0 };
  if (!move) return p;
  if (move === "draw") {
    // Up from below, each in its own way: a turn of the wrist, a flip, a pull from the sheath, a tug on the cord.
    const d = DRAW[id] ?? DRAW.k_combat;
    const k = 1 - (1 - u) ** 3;
    p.y = -0.32 * (1 - k) + (d.jerk ? Math.sin(u * Math.PI * 3) * 0.035 * (1 - u) : 0);
    p.pitch = -1.0 * (1 - k) * (d.pull ? 0.3 : 1) + d.flips * Math.PI * 2 * (1 - smooth(span(u, 0, 0.8)));
    p.spin = (1 - k) * Math.PI * 2 * d.spins;
    p.roll = 0.5 * (1 - k) + (d.jerk ? Math.sin(u * 60) * 0.03 * span(u, 0.4, 0.6) : 0);
    p.z = (d.pull ?? 0) * (1 - smooth(span(u, 0.1, 0.75)));
    p.x = (d.pull ?? 0) * 0.3 * (1 - smooth(span(u, 0.1, 0.75)));
    return p;
  }
  if (move === "slash" && side === 0) {
    // The third cut comes down from over the shoulder.
    const wind = smooth(span(u, 0, 0.24));
    const cut = smooth(span(u, 0.24, 0.5));
    const home = smooth(span(u, 0.5, 1));
    p.y = (mix(0, 0.13, wind) + mix(0, -0.34, cut)) * (1 - home);
    p.x = (mix(0, 0.05, wind) + mix(0, -0.2, cut)) * (1 - home);
    p.z = (mix(0, 0.06, wind) + mix(0, -0.2, cut)) * (1 - home);
    p.pitch = (mix(0, 0.7, wind) + mix(0, -1.9, cut)) * (1 - home);
    p.roll = (mix(0, -0.3, wind) + mix(0, 0.8, cut)) * (1 - home);
    return p;
  }
  if (move === "slash") {
    // Back a little, across the whole view, and home.
    const wind = smooth(span(u, 0, 0.2));
    const cut = smooth(span(u, 0.2, 0.48));
    const home = smooth(span(u, 0.48, 1));
    const arc = Math.sin(span(u, 0.2, 0.48) * Math.PI);
    p.x = side * (mix(0, 0.12, wind) + mix(0, -0.44, cut)) * (1 - home);
    p.yaw = side * (mix(0, -0.6, wind) + mix(0, 1.7, cut)) * (1 - home);
    p.roll = side * (mix(0, -0.55, wind) + mix(0, 1.5, cut)) * (1 - home);
    p.y = -0.06 * arc + 0.03 * wind * (1 - cut);
    p.z = -0.14 * arc + 0.03 * wind * (1 - cut);
    p.pitch = -0.55 * arc;
    return p;
  }
  if (move === "heavy") {
    // Raised over the shoulder, driven forward, held a beat.
    const raise = smooth(span(u, 0, 0.36));
    const drive = span(u, 0.36, 0.52) ** 2;
    const home = smooth(span(u, 0.72, 1));
    p.y = (mix(0, 0.15, raise) + mix(0, -0.27, drive)) * (1 - home);
    p.z = (mix(0, 0.1, raise) + mix(0, -0.42, drive)) * (1 - home);
    p.x = (mix(0, -0.07, raise) + mix(0, -0.05, drive)) * (1 - home);
    p.pitch = (mix(0, 0.8, raise) + mix(0, -1.85, drive)) * (1 - home);
    p.roll = 0.25 * raise * (1 - home);
    return p;
  }
  // Looking it over: to the middle, one flat, a toss, the other flat, and back.
  const show = SHOW[id] ?? SHOW.k_combat;
  const inK = smooth(span(u, 0, 0.14)) * (1 - smooth(span(u, 0.88, 1)));
  const a = smooth(span(u, 0.12, 0.26));
  const toss = span(u, show.slow ? 0.46 : 0.4, show.slow ? 0.56 : 0.62);
  const b = smooth(span(u, 0.62, 0.74));
  p.x = -0.15 * inK;
  p.y = 0.05 * inK + Math.sin(toss * Math.PI) * (show.flips ? 0.11 : 0.02) + Math.sin(t * 2.2) * 0.006 * inK;
  p.z = 0.1 * inK;
  p.yaw = 0.45 * inK;
  p.spin = (mix(0, 1.35, a) + mix(0, -2.7, b)) * (1 - smooth(span(u, 0.86, 1))) + show.twirl * Math.PI * 2 * smooth(toss);
  p.pitch = show.flips * Math.PI * 2 * smooth(toss) + Math.sin(t * 1.7) * 0.05 * inK;
  p.roll = Math.sin(t * 1.3) * 0.06 * inK + (show.shake ? Math.sin(t * 61) * 0.035 * span(u, 0.2, 0.3) * (1 - span(u, 0.76, 0.84)) : 0);
  return p;
}
