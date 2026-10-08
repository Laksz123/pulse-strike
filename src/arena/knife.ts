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
  /** A turn of the wrist about the handle: the hand goes with it. */
  spin: number;
  /** What the blade does by itself, in the fingers or out of them: end over end, about its ring, about its handle. */
  flip: number;
  ring: number;
  twirl: number;
  /** How high it has been thrown above the hand, metres. */
  toss: number;
  /** The hand: how far the fingers have let go, and the one finger that keeps hold through a ring. */
  open: number;
  hook: number;
}

/** Blades with a ring: where it is on the blade. They are spun on a finger instead of thrown. */
export const RING: Record<string, [number, number, number]> = { k_karambit: [0, -0.004, 0.092], k_kunai: [0, 0, 0.083] };
/** Where the rest balance, along the handle: the point they turn about in the air. */
export const BALANCE: Record<string, number> = { k_combat: -0.05, k_cleaver: -0.09, k_tomahawk: -0.13, k_butterfly: -0.04, k_machete: -0.12, k_katana: -0.16, k_saber: -0.14, k_ripper: -0.1 };

/**
 * How each blade is held. The arm comes first: a forearm that enters from the lower right, turned
 * out by `sup` (0 is palm down, a quarter turn is thumb up) with the wrist bent toward the little
 * finger by `dev`. The blade then lies in that hand — out of the thumb side, or out of the bottom
 * of the fist for a reverse grip (`rev`) — rolled about its handle by `roll` so its flat shows.
 * `at` is the point on the handle the hand closes on; `y` and `z` nudge the whole thing in view.
 */
export interface Hold {
  rev?: boolean;
  sup: number;
  dev: number;
  roll: number;
  at: number;
  y: number;
  z: number;
  x?: number;
  /** Which way the forearm points, when not the usual. */
  arm?: [number, number, number];
}
// Every blade sits where a blade sits in Counter-Strike: the fist low in the right-hand corner, the
// point short of the crosshair and to the right of it, nothing across the middle of the picture.
// Long blades stand up along the right side instead of reaching over the view.
const SHORT = { arm: [-0.32, 0.08, -0.94] as [number, number, number], sup: 1.01, dev: 0.57, roll: -1.2, x: 0.1, y: -0.075, z: -0.14 };
const LONG = { arm: [-0.55, -0.1, -0.83] as [number, number, number], sup: 1.75, dev: 0.63, roll: -0.4, x: 0.12, y: -0.09, z: -0.14 };
const REV = { rev: true, arm: [-0.15, 0.7, -0.7] as [number, number, number], sup: 2.08, dev: -0.16, roll: 0.2, x: 0.09, y: 0, z: -0.14 };
export const HOLD: Record<string, Hold> = {
  k_combat: { ...SHORT, at: 0.012 },
  k_kunai: { ...REV, at: 0.022 },
  k_cleaver: { ...SHORT, at: 0.012 },
  k_machete: { ...LONG, at: 0.012 },
  k_karambit: { ...REV, at: 0.03 },
  k_butterfly: { ...SHORT, at: 0.02 },
  k_tomahawk: { ...SHORT, sup: 1.15, roll: -1.1, y: -0.08, at: 0.03 },
  k_katana: { ...LONG, sup: 1.86, dev: 0.62, roll: -0.3, at: 0.02 },
  k_ripper: { ...LONG, at: 0.02 },
  k_saber: { ...LONG, sup: 1.86, dev: 0.62, roll: -0.3, at: 0.02 },
};

/** How each blade is shown off: end-over-end flips in the toss, turns about the handle, and a shake for the ones with a motor. */
const SHOW: Record<string, { flips: number; twirl: number; shake: number; slow?: boolean }> = {
  k_combat: { flips: 2, twirl: 0, shake: 0 },
  k_kunai: { flips: 5, twirl: 0, shake: 0 },
  k_cleaver: { flips: 2, twirl: 0, shake: 0 },
  k_machete: { flips: 0, twirl: 2, shake: 0 },
  k_karambit: { flips: 6, twirl: 0, shake: 0 },
  k_butterfly: { flips: 1, twirl: 0, shake: 0 },
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
  const p: KnifePose = { x: 0, y: 0, z: 0, pitch: 0, yaw: 0, roll: 0, spin: 0, flip: 0, ring: 0, twirl: 0, toss: 0, open: 0, hook: 0 };
  const ringed = !!RING[id];
  if (!move) return p;
  if (move === "draw") {
    // Up from below, each in its own way: a turn of the wrist, a flip, a pull from the sheath, a tug on the cord.
    const d = DRAW[id] ?? DRAW.k_combat;
    const k = 1 - (1 - u) ** 3;
    p.y = -0.32 * (1 - k) + (d.jerk ? Math.sin(u * Math.PI * 3) * 0.035 * (1 - u) : 0);
    p.pitch = -1.0 * (1 - k) * (d.pull ? 0.3 : 1);
    // The hand comes up and the blade arrives in it still turning: round a finger, end over end, or about its handle.
    const turning = 1 - smooth(span(u, 0, 0.82));
    const loose = Math.sin(span(u, 0, 0.86) * Math.PI) ** 0.6;
    if (ringed) {
      p.ring = -d.flips * Math.PI * 2 * turning;
      p.open = 0.5 * loose;
      p.hook = 0.85 * loose;
    } else if (d.flips) {
      p.flip = -d.flips * Math.PI * 2 * turning;
      p.toss = Math.sin(span(u, 0, 0.82) * Math.PI) * 0.07;
      p.open = loose;
    }
    p.twirl = turning * Math.PI * 2 * d.spins;
    if (d.spins && !d.flips) p.open = 0.45 * loose;
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
  // Looked over, it comes up out of its corner toward the middle and nearer the eye.
  p.x = -0.19 * inK;
  p.y = (RING[id] ? 0.03 : 0.11) * inK + Math.sin(toss * Math.PI) * (show.flips && !RING[id] ? 0.03 : 0.01) + Math.sin(t * 2.2) * 0.006 * inK;
  p.z = 0.13 * inK;
  p.yaw = 0.3 * inK;
  p.spin = (mix(0, 1.35, a) + mix(0, -2.7, b)) * (1 - smooth(span(u, 0.86, 1)));
  p.pitch = Math.sin(t * 1.7) * 0.05 * inK;
  // The trick in the middle belongs to the blade, not the arm: the hand opens and stays where it is.
  const air = Math.sin(toss * Math.PI);
  const loose = Math.min(1, air * 2.2);
  p.twirl = show.twirl * Math.PI * 2 * smooth(toss);
  if (ringed) {
    // Round the finger: fast at first, then slowing until the handle drops back into the palm.
    p.ring = -show.flips * Math.PI * 2 * (1 - (1 - toss) ** 2.2);
    p.open = 0.5 * loose;
    p.hook = 0.85 * loose;
    p.pitch += 0.18 * air;
    // The wrist comes back level for it and the hand drops a little, so the blade goes round in full view.
    p.spin *= 1 - loose;
    p.y -= 0.06 * loose;
  } else if (show.flips) {
    p.flip = -show.flips * Math.PI * 2 * smooth(toss);
    p.toss = air * 0.1;
    p.open = 0.8 * loose;
    // The hand gives it a lift and comes down to meet it.
    p.pitch += 0.3 * Math.sin(toss * Math.PI * 2) * (toss < 0.5 ? 1 : 0.5);
  } else if (show.twirl) p.open = 0.45 * loose;
  p.roll = Math.sin(t * 1.3) * 0.06 * inK + (show.shake ? Math.sin(t * 61) * 0.035 * span(u, 0.2, 0.3) * (1 - span(u, 0.76, 0.84)) : 0);
  return p;
}
