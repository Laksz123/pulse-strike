/** Synthesised sound: no audio files to load. Every sound is filtered noise or a short tone. */

import type { WeaponClass } from "./weapons";

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;
let master: GainNode | null = null;
let musicBus: GainNode | null = null;
/** Where the sound being built right now goes: the master bus, or a panned branch of it. */
let out: AudioNode | null = null;
const level = { sound: 1, music: 0.6 };

function ac(): AudioContext | null {
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return null;
    }
    master = ctx.createGain();
    master.gain.value = 0.5 * level.sound;
    master.connect(ctx.destination);
    musicBus = ctx.createGain();
    musicBus.gain.value = 0.3 * level.music;
    musicBus.connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function burst(freq: number, dur: number, gain: number, q = 0.8, type: BiquadFilterType = "lowpass"): void {
  const c = ac();
  if (!c || !noise || !master) return;
  const src = c.createBufferSource();
  src.buffer = noise;
  src.playbackRate.value = 0.8 + Math.random() * 0.4;
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, c.currentTime);
  f.frequency.exponentialRampToValueAtTime(Math.max(80, freq * 0.25), c.currentTime + dur);
  f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
  src.connect(f).connect(g).connect(out ?? master);
  src.start(c.currentTime, Math.random() * 0.5, dur + 0.05);
}

function tone(freq: number, to: number, dur: number, gain: number, type: OscillatorType = "sine"): void {
  const c = ac();
  if (!c || !master) return;
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, c.currentTime);
  o.frequency.exponentialRampToValueAtTime(to, c.currentTime + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(gain, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
  o.connect(g).connect(out ?? master);
  o.start();
  o.stop(c.currentTime + dur + 0.02);
}

const SHOT: Record<WeaponClass, [number, number, number]> = {
  crossbow: [900, 0.12, 0.35],
  pistol: [2600, 0.16, 0.5],
  smg: [3200, 0.11, 0.4],
  rifle: [2200, 0.2, 0.55],
  shotgun: [1300, 0.36, 0.8],
  sniper: [1700, 0.5, 0.85],
  lmg: [1900, 0.22, 0.6],
};

/** Plays what `make` builds off to one side: -1 is hard left, 1 hard right. */
function panned(pan: number, make: () => void): void {
  const c = ac();
  if (!c || !master || Math.abs(pan) < 0.05) return make();
  const p = c.createStereoPanner();
  p.pan.value = Math.max(-1, Math.min(1, pan));
  p.connect(master);
  out = p;
  make();
  out = null;
  setTimeout(() => p.disconnect(), 2500);
}

/** Every weapon has its own voice, built from the same two things: shaped noise and a sliding tone. */
const GUNS: Record<string, (v: number) => void> = {
  dvoyka: (v) => (burst(3200, 0.06, 0.5 * v, 1.5, "bandpass"), tone(900, 260, 0.07, 0.25 * v, "square")),
  baraban: (v) => (burst(900, 0.28, 0.9 * v, 0.7), tone(220, 60, 0.22, 0.5 * v, "sawtooth"), burst(4000, 0.05, 0.4 * v, 1, "highpass")),
  sprinter: (v) => (burst(2400, 0.09, 0.6 * v, 1.2, "bandpass"), tone(700, 180, 0.09, 0.3 * v, "sawtooth")),
  zalp: (v) => (burst(700, 0.34, 1.0 * v, 0.6), burst(2600, 0.12, 0.5 * v, 1, "bandpass"), tone(160, 50, 0.25, 0.5 * v, "sine")),
  treshotka: (v) => (burst(2800, 0.05, 0.5 * v, 2, "bandpass"), tone(520, 200, 0.05, 0.25 * v, "square")),
  ochered: (v) => (burst(3000, 0.05, 0.5 * v, 2.2, "bandpass"), tone(1100, 400, 0.05, 0.22 * v, "triangle")),
  raduga: (v) => (burst(2200, 0.04, 0.42 * v, 2, "bandpass"), tone(300, 150, 0.04, 0.2 * v, "sawtooth")),
  gidrant: (v) => burst(5200, 0.08, 0.16 * v, 0.8, "highpass"),
  dalnoboy: (v) => (burst(1400, 0.5, 1.0 * v, 0.6), tone(1800, 90, 0.3, 0.4 * v, "sawtooth"), void setTimeout(() => burst(500, 0.6, 0.25 * v, 0.5), 90)),
  impuls: (v) => (tone(200, 1600, 0.08, 0.3 * v, "sawtooth"), burst(1800, 0.3, 0.7 * v, 0.8, "bandpass"), tone(120, 40, 0.4, 0.5 * v, "sine")),
  veer: (v) => (burst(1800, 0.18, 0.7 * v, 0.8, "bandpass"), tone(600, 300, 0.12, 0.25 * v, "square")),
  rikoshet: (v) => (tone(420, 980, 0.09, 0.4 * v, "sine"), tone(980, 620, 0.12, 0.25 * v, "triangle"), burst(2400, 0.04, 0.3 * v, 2, "bandpass")),
  mortira: (v) => (tone(180, 45, 0.3, 0.8 * v, "sine"), burst(500, 0.25, 0.6 * v, 0.7)),
  lipuchka: (v) => (tone(300, 90, 0.16, 0.6 * v, "sine"), burst(900, 0.1, 0.4 * v, 3, "bandpass")),
  roy: (v) => ([0, 40, 80].forEach((d, i) => setTimeout(() => tone(1400 + i * 260, 700, 0.09, 0.22 * v, "square"), d)), burst(3000, 0.05, 0.25 * v, 2, "bandpass")),
  sverhnova: (v) => (tone(90, 40, 0.7, 0.8 * v, "sine"), tone(1600, 200, 0.5, 0.25 * v, "sawtooth"), burst(700, 0.6, 0.5 * v, 0.5)),
};

/** Sounds that go on for as long as something is held: a charge building, barrels spinning, a stream. */
const loops = new Map<string, { gain: GainNode; osc?: OscillatorNode; filter?: BiquadFilterNode }>();
function loop(name: "charge" | "spin" | "stream" | "fire", amount: number): void {
  const c = ac();
  if (!c || !master || !noise) return;
  let l = loops.get(name);
  if (!l) {
    if (amount <= 0) return;
    const gain = c.createGain();
    gain.gain.value = 0;
    gain.connect(master);
    if (name === "charge") {
      const osc = c.createOscillator();
      osc.type = "sawtooth";
      const filter = c.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 1800;
      osc.connect(filter).connect(gain);
      osc.start();
      l = { gain, osc, filter };
    } else {
      const src = c.createBufferSource();
      src.buffer = noise;
      src.loop = true;
      const filter = c.createBiquadFilter();
      filter.type = name === "stream" ? "highpass" : "bandpass";
      filter.frequency.value = name === "stream" ? 3800 : name === "fire" ? 900 : 300;
      filter.Q.value = name === "spin" ? 3 : 0.7;
      src.connect(filter).connect(gain);
      src.start();
      l = { gain, filter };
    }
    loops.set(name, l);
  }
  const a = Math.max(0, Math.min(1, amount));
  const t = c.currentTime;
  l.gain.gain.setTargetAtTime(a * (name === "charge" ? 0.1 : name === "spin" ? 0.5 : name === "fire" ? 0.35 : 0.22), t, 0.04);
  if (l.osc) l.osc.frequency.setTargetAtTime(180 + a * 1000, t, 0.04);
  else if (name === "spin") l.filter!.frequency.setTargetAtTime(160 + a * 700, t, 0.05);
}

// ---------------------------------------------------------------------------------------------
// Music: a small sequencer. Four chords, a bass line, drums and a tune, all synthesised.

const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);
const CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
const BASS = [45, 41, 48, 43];
const TUNE: (number | 0)[][] = [
  [76, 0, 0, 81, 0, 79, 0, 76, 0, 0, 74, 0, 72, 0, 0, 0],
  [69, 0, 72, 0, 0, 77, 0, 76, 0, 0, 72, 0, 69, 0, 0, 0],
  [79, 0, 0, 76, 0, 72, 0, 0, 74, 0, 76, 0, 79, 0, 0, 0],
  [74, 0, 0, 71, 0, 74, 0, 79, 0, 0, 0, 71, 0, 74, 0, 0],
  [76, 0, 79, 81, 0, 0, 84, 0, 81, 0, 79, 0, 76, 0, 74, 0],
  [77, 0, 0, 76, 0, 72, 0, 69, 0, 0, 72, 0, 77, 0, 0, 0],
  [72, 0, 76, 0, 79, 0, 0, 84, 0, 0, 79, 0, 76, 0, 0, 0],
  [74, 0, 0, 79, 0, 0, 83, 0, 79, 0, 74, 0, 71, 0, 74, 0],
];
const STEP = 60 / 104 / 4;
let musicTimer: ReturnType<typeof setInterval> | null = null;
let nextStep = 0;
let stepAt = 0;
let echo: DelayNode | null = null;

function voice(freq: number, at: number, dur: number, gain: number, type: OscillatorType, cutoff: number, wet = false): void {
  const c = ctx!;
  const o = c.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  const f = c.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.setValueAtTime(cutoff, at);
  f.frequency.exponentialRampToValueAtTime(Math.max(200, cutoff * 0.3), at + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(f).connect(g).connect(musicBus!);
  if (wet && echo) g.connect(echo);
  o.start(at);
  o.stop(at + dur + 0.05);
}

function drum(kind: "kick" | "clap" | "hat", at: number, gain: number): void {
  const c = ctx!;
  if (kind === "kick") {
    const o = c.createOscillator();
    o.frequency.setValueAtTime(150, at);
    o.frequency.exponentialRampToValueAtTime(42, at + 0.14);
    const g = c.createGain();
    g.gain.setValueAtTime(gain, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.2);
    o.connect(g).connect(musicBus!);
    o.start(at);
    o.stop(at + 0.22);
    return;
  }
  const src = c.createBufferSource();
  src.buffer = noise;
  const f = c.createBiquadFilter();
  f.type = kind === "hat" ? "highpass" : "bandpass";
  f.frequency.value = kind === "hat" ? 7500 : 1700;
  const g = c.createGain();
  const dur = kind === "hat" ? 0.04 : 0.13;
  g.gain.setValueAtTime(gain, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(f).connect(g).connect(musicBus!);
  src.start(at, Math.random() * 0.5, dur + 0.02);
}

function schedule(step: number, at: number): void {
  const bar = Math.floor(step / 16) % 8;
  const s = step % 16;
  const chord = bar % 4;
  if (s === 0 || s === 6 || s === 10) drum("kick", at, 0.9);
  if (s === 4 || s === 12) drum("clap", at, 0.45);
  if (s % 2 === 0) drum("hat", at, s % 4 === 2 ? 0.2 : 0.1);
  if ([0, 3, 6, 8, 11, 14].includes(s)) voice(midi(BASS[chord] - (s === 11 ? 0 : 12) + (s === 14 ? 7 : 0)), at, 0.2, 0.5, "sawtooth", 700);
  if (s === 0) for (const n of CHORDS[chord]) voice(midi(n), at, STEP * 15, 0.09, "triangle", 1400);
  if (s % 4 === 2) voice(midi(CHORDS[chord][(s >> 2) % 3] + 12), at, 0.16, 0.07, "square", 1800, true);
  const note = TUNE[bar][s];
  if (note) voice(midi(note), at, 0.3, 0.2, "square", 2600, true);
}

export const music = {
  /** Starts the lobby tune, or stops it. Needs a click first: browsers do not let a page play uninvited. */
  play(on: boolean): void {
    if (!on) {
      if (musicTimer) clearInterval(musicTimer);
      musicTimer = null;
      return;
    }
    const c = ac();
    if (!c || !musicBus || musicTimer) return;
    if (!echo) {
      echo = c.createDelay(1);
      echo.delayTime.value = STEP * 3;
      const fb = c.createGain();
      fb.gain.value = 0.32;
      const wet = c.createGain();
      wet.gain.value = 0.35;
      echo.connect(fb).connect(echo);
      echo.connect(wet).connect(musicBus);
    }
    nextStep = 0;
    stepAt = c.currentTime + 0.08;
    musicTimer = setInterval(() => {
      while (stepAt < c.currentTime + 0.2) {
        schedule(nextStep++, stepAt);
        stepAt += STEP;
      }
    }, 40);
  },
};

/** Volumes, 0..1, from the settings. */
export function setVolume(sound: number, musicLevel: number): void {
  level.sound = sound;
  level.music = musicLevel;
  if (master) master.gain.value = 0.5 * sound;
  if (musicBus) musicBus.gain.value = 0.3 * musicLevel;
}

export const sfx = {
  /** Call from a user gesture so the browser lets audio start. */
  unlock: () => void ac(),
  shot(cls: WeaponClass, volume = 1): void {
    const [f, d, g] = SHOT[cls];
    burst(f, d, g * volume);
    if (cls === "crossbow") tone(320, 140, 0.16, 0.3 * volume, "triangle");
    else tone(160, 50, d * 0.7, 0.35 * volume, "triangle");
  },
  /** A precise hit on a harvest weak point. */
  ding: (combo = 0) => tone(880 + combo * 110, 1320 + combo * 110, 0.12, 0.22, "triangle"),
  thud: () => burst(300, 0.1, 0.4),
  swing: () => burst(1400, 0.09, 0.12, 1, "bandpass"),
  motor: () => {
    burst(700, 0.1, 0.22, 3, "bandpass");
    tone(90, 70, 0.1, 0.18, "sawtooth");
  },
  pin: (n = 0) => tone(1100 + n * 160, 1500 + n * 160, 0.07, 0.25, "square"),
  snap: () => {
    burst(3200, 0.07, 0.5, 2, "highpass");
    tone(400, 120, 0.12, 0.25, "square");
  },
  heal: () => {
    tone(520, 780, 0.18, 0.16, "sine");
    setTimeout(() => tone(780, 1040, 0.2, 0.14, "sine"), 120);
  },
  fall: () => burst(240, 0.5, 0.6),
  empty: () => tone(900, 700, 0.04, 0.15, "square"),
  reload: () => {
    burst(1800, 0.06, 0.25, 4, "bandpass");
    setTimeout(() => burst(2400, 0.07, 0.3, 4, "bandpass"), 320);
  },
  hit: () => tone(1500, 1100, 0.05, 0.16, "square"),
  kill: () => {
    tone(700, 1400, 0.12, 0.2, "triangle");
  },
  hurt: () => burst(500, 0.18, 0.5),
  pickup: () => {
    tone(620, 930, 0.09, 0.16, "triangle");
    setTimeout(() => tone(930, 1240, 0.1, 0.14, "triangle"), 70);
  },
  /** A paintball marker firing: a short pneumatic pop. */
  paint: (volume = 1, pitch = 1) => {
    burst(1500 * pitch, 0.07, 0.4 * volume, 2.5, "bandpass");
    tone(520 * pitch, 180, 0.07, 0.22 * volume, "triangle");
  },
  splat: (volume = 1) => burst(700, 0.09, 0.3 * volume, 1.2),
  tagged: () => {
    tone(300, 90, 0.35, 0.3, "sawtooth");
    burst(500, 0.25, 0.4);
  },
  streak: () => {
    [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, f * 1.02, 0.14, 0.18, "square"), i * 80));
  },
  open: () => {
    tone(300, 460, 0.12, 0.2, "triangle");
    burst(1200, 0.12, 0.25, 2, "bandpass");
  },
  rare: () => {
    [660, 880, 1100, 1320].forEach((f, i) => setTimeout(() => tone(f, f * 1.01, 0.22, 0.16, "triangle"), i * 90));
  },
  /** An energy weapon firing: a zap over a thump. `heavy` 0..1 makes it bigger and lower. */
  zap: (volume = 1, pitch = 1, heavy = 0) => {
    tone(1800 * pitch, 240 * pitch, 0.09 + heavy * 0.16, 0.2 * volume, "sawtooth");
    burst(2600 * pitch, 0.06 + heavy * 0.2, (0.3 + heavy * 0.4) * volume, 1.5, "bandpass");
    if (heavy > 0.4) tone(160, 50, 0.3, 0.3 * volume, "sine");
  },
  beep: (pitch = 1) => tone(1900 * pitch, 1900 * pitch, 0.07, 0.16, "square"),
  boom: () => {
    burst(300, 1.6, 1.4, 0.6);
    tone(120, 30, 1.2, 0.7, "sine");
    setTimeout(() => burst(900, 0.8, 0.6, 0.8), 60);
  },
  planted: () => {
    [880, 660].forEach((f, i) => setTimeout(() => tone(f, f, 0.18, 0.2, "square"), i * 160));
  },
  defused: () => {
    [660, 880, 1320].forEach((f, i) => setTimeout(() => tone(f, f, 0.16, 0.18, "triangle"), i * 110));
  },
  win: () => {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, f * 1.01, 0.22, 0.17, "triangle"), i * 110));
  },
  lose: () => {
    [440, 370, 311].forEach((f, i) => setTimeout(() => tone(f, f * 0.98, 0.26, 0.16, "sawtooth"), i * 150));
  },
  buy: () => {
    burst(2400, 0.05, 0.25, 4, "bandpass");
    setTimeout(() => tone(880, 1320, 0.08, 0.14, "triangle"), 60);
  },
  /** A weapon firing, by its id; `pan` puts it to one side. */
  gun: (id: string, volume = 1, pan = 0) => panned(pan, () => (GUNS[id] ?? GUNS.sprinter)(volume)),
  loop,
  /** Every loop off: the match is over. */
  hush: () => {
    for (const name of loops.keys()) loop(name as "charge", 0);
  },
  /** A footstep: a thud and a scuff. */
  foot: (volume = 1, pan = 0) =>
    panned(pan, () => {
      tone(95 + Math.random() * 30, 55, 0.07, 0.5 * volume, "sine");
      burst(900 + Math.random() * 500, 0.05, 0.16 * volume, 1.2, "bandpass");
    }),
  land: () => (tone(110, 45, 0.14, 0.7, "sine"), burst(600, 0.1, 0.3, 1)),
  /** A reload you can hear: the magazine out, the next one home, the action worked. */
  magOut: () => (burst(1500, 0.05, 0.3, 3, "bandpass"), tone(420, 300, 0.05, 0.12, "square")),
  magIn: () => (burst(900, 0.06, 0.45, 2, "bandpass"), tone(260, 180, 0.06, 0.2, "square"), void setTimeout(() => burst(3000, 0.03, 0.2, 4, "bandpass"), 45)),
  rack: () => (burst(2600, 0.05, 0.35, 4, "bandpass"), void setTimeout(() => burst(1900, 0.06, 0.4, 3, "bandpass"), 90)),
  swap: () => (burst(2000, 0.04, 0.2, 3, "bandpass"), void setTimeout(() => burst(3200, 0.03, 0.16, 4, "bandpass"), 70)),
  headshot: () => (tone(1900, 2500, 0.08, 0.22, "square"), void setTimeout(() => tone(2500, 3100, 0.1, 0.18, "square"), 60)),
  click: () => tone(880, 660, 0.04, 0.12, "triangle"),
  back: () => tone(520, 390, 0.05, 0.12, "triangle"),
  coins: () => [1320, 1760, 2100].forEach((f, i) => setTimeout(() => tone(f, f * 1.01, 0.09, 0.12, "triangle"), i * 55)),
  deny: () => (tone(220, 160, 0.12, 0.18, "square"), void setTimeout(() => tone(180, 130, 0.14, 0.18, "square"), 110)),
  tick: () => tone(1500, 1200, 0.02, 0.08, "square"),
  throw: () => burst(1200, 0.16, 0.3, 0.8, "bandpass"),
  /** A blade through the air, into someone, off a wall, and turned over in the hand. */
  slash: (heavy = false) => burst(heavy ? 900 : 1700, heavy ? 0.24 : 0.14, heavy ? 0.5 : 0.36, 0.9, "bandpass"),
  stab: () => (burst(500, 0.12, 0.8, 0.8), tone(260, 80, 0.12, 0.45, "sawtooth"), burst(3200, 0.05, 0.3, 2, "bandpass")),
  clank: () => (tone(2400, 1500, 0.09, 0.25, "square"), tone(3700, 2900, 0.14, 0.14, "triangle"), burst(4200, 0.05, 0.25, 3, "bandpass")),
  flick: () => (tone(3000, 4200, 0.05, 0.08, "triangle"), burst(5200, 0.04, 0.1, 3, "bandpass")),
  bounce: (volume = 1) => (tone(900, 500, 0.04, 0.18 * volume, "triangle"), burst(2500, 0.03, 0.12 * volume, 3, "bandpass")),
  /** Grenades going off: a wet pop, a hiss of foam, a whoosh of fire. */
  splatBang: (volume = 1) => (burst(1200, 0.25, 0.9 * volume, 0.7), tone(700, 120, 0.2, 0.4 * volume, "sawtooth"), tone(2600, 2600, 0.9, 0.05 * volume, "sine")),
  foam: (volume = 1) => (burst(5200, 1.4, 0.3 * volume, 0.6, "highpass"), tone(300, 520, 0.4, 0.1 * volume, "sine")),
  ignite: (volume = 1) => (burst(500, 0.6, 0.7 * volume, 0.5), tone(140, 60, 0.4, 0.4 * volume, "sawtooth")),
  target: (pitch = 1) => tone(1400 * pitch, 1400 * pitch, 0.12, 0.16, "triangle"),
  chop: () => burst(900, 0.12, 0.5, 2, "bandpass"),
  step: () => burst(420, 0.07, 0.07),
  growl: () => tone(110, 70, 0.35, 0.3, "sawtooth"),
};
