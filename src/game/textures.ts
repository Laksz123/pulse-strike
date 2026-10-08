/** Pixel-art textures painted in code: 16×16 tiles, nearest-neighbour filtered. */

import * as THREE from "three";
import { mulberry32 } from "./noise";

type RGB = [number, number, number];
type Px = (x: number, y: number, c: RGB, alpha?: number) => void;
type Painter = (px: Px, rnd: () => number, size: number) => void;

interface Spec {
  base: RGB;
  /** Per-pixel brightness noise, 0..1. */
  jitter: number;
  paint?: Painter;
  size?: number;
}

const shade = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];

const SPECS: Record<string, Spec> = {
  // Neutral tiles are tinted by the material or vertex colour.
  sand: {
    base: [236, 232, 224], jitter: 0.1,
    paint: (px, rnd) => {
      for (let i = 0; i < 9; i++) px(Math.floor(rnd() * 16), Math.floor(rnd() * 16), [200, 190, 172]);
      for (let i = 0; i < 4; i++) px(Math.floor(rnd() * 16), Math.floor(rnd() * 16), [255, 252, 245]);
    },
  },
  noise: { base: [232, 232, 232], jitter: 0.14 },
  cloth: {
    base: [225, 225, 225], jitter: 0.08,
    paint: (px) => {
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if ((x + y) % 2 === 0) px(x, y, [190, 190, 190], 0.35);
    },
  },
  metal: {
    base: [205, 208, 212], jitter: 0.1,
    paint: (px, rnd) => {
      for (let i = 0; i < 5; i++) {
        const y = Math.floor(rnd() * 16);
        const x = Math.floor(rnd() * 12);
        for (let k = 0; k < 4; k++) px(x + k, y, [245, 247, 250], 0.6);
      }
      for (let x = 0; x < 16; x++) px(x, 15, [130, 132, 136], 0.5);
    },
  },
  rust: {
    base: [156, 98, 62], jitter: 0.2,
    paint: (px, rnd) => {
      for (let i = 0; i < 8; i++) {
        const cx = Math.floor(rnd() * 16);
        const cy = Math.floor(rnd() * 16);
        const c: RGB = rnd() < 0.5 ? [104, 62, 40] : [192, 128, 74];
        for (let k = 0; k < 6; k++) px((cx + Math.floor(rnd() * 4)) % 16, (cy + Math.floor(rnd() * 3)) % 16, c, 0.8);
      }
      // Streaks of rust running down from the seam.
      for (let x = 0; x < 16; x++) {
        px(x, 0, [92, 56, 38], 0.5);
        if (rnd() < 0.3) for (let y = 1; y < 3 + Math.floor(rnd() * 6); y++) px(x, y, [116, 68, 42], 0.6);
      }
      for (let x = 3; x < 16; x += 8) px(x, 1, [70, 44, 32]);
    },
  },
  hull: {
    base: [92, 62, 48], jitter: 0.2,
    paint: (px, rnd) => {
      for (let i = 0; i < 30; i++) px(Math.floor(rnd() * 16), Math.floor(rnd() * 16), rnd() < 0.5 ? [58, 40, 34] : [128, 80, 52], 0.8);
      for (let x = 0; x < 16; x++) px(x, 8, [50, 34, 28], 0.6);
    },
  },
  planks: {
    base: [196, 156, 108], jitter: 0.1,
    paint: (px, rnd) => {
      for (let y = 0; y < 16; y++) {
        for (const x of [0, 5, 11]) px(x, y, [128, 94, 60]);
        if (rnd() < 0.5) px(Math.floor(rnd() * 16), y, [168, 128, 84], 0.8);
      }
      for (const [x, y] of [[2, 3], [8, 11], [13, 6]]) px(x, y, [110, 78, 48]);
    },
  },
  bark: {
    base: [158, 128, 94], jitter: 0.16,
    paint: (px, rnd) => {
      for (let x = 0; x < 16; x++) {
        if (rnd() < 0.4) for (let y = 0; y < 16; y++) if (rnd() < 0.7) px(x, y, [118, 92, 66], 0.8);
      }
    },
  },
  leaves: {
    base: [132, 142, 84], jitter: 0.3,
    paint: (px, rnd) => {
      for (let i = 0; i < 40; i++) px(Math.floor(rnd() * 16), Math.floor(rnd() * 16), rnd() < 0.5 ? [92, 106, 60] : [172, 176, 108]);
    },
  },
  // Bright neutral leaves, tinted per tree species.
  foliage: {
    base: [222, 230, 212], jitter: 0.2,
    paint: (px, rnd) => {
      for (let i = 0; i < 46; i++) px(Math.floor(rnd() * 16), Math.floor(rnd() * 16), rnd() < 0.6 ? [150, 168, 140] : [255, 255, 245]);
    },
  },
  stone: {
    base: [140, 132, 120], jitter: 0.16,
    paint: (px, rnd) => {
      for (let i = 0; i < 4; i++) {
        let x = Math.floor(rnd() * 16);
        let y = Math.floor(rnd() * 16);
        for (let k = 0; k < 6; k++) {
          px(x, y, [92, 86, 78]);
          x = (x + (rnd() < 0.5 ? 1 : 0)) % 16;
          y = (y + 1) % 16;
        }
      }
      for (let i = 0; i < 10; i++) px(Math.floor(rnd() * 16), Math.floor(rnd() * 16), [176, 168, 154]);
    },
  },
  ore: {
    base: [140, 132, 120], jitter: 0.16,
    paint: (px, rnd) => {
      for (let i = 0; i < 9; i++) {
        const cx = Math.floor(rnd() * 15);
        const cy = Math.floor(rnd() * 15);
        px(cx, cy, [214, 120, 52]);
        px(cx + 1, cy, [176, 88, 40]);
        px(cx, cy + 1, [236, 156, 76]);
      }
    },
  },
  salt: {
    base: [236, 234, 226], jitter: 0.08,
    paint: (px, rnd) => {
      for (let i = 0; i < 12; i++) px(Math.floor(rnd() * 16), Math.floor(rnd() * 16), [190, 232, 244]);
    },
  },
  felt: {
    base: [226, 214, 188], jitter: 0.07,
    paint: (px) => {
      // A band of red ornament, as on a real yurt.
      for (let x = 0; x < 16; x++) {
        px(x, 3, [150, 52, 38]);
        px(x, 6, [150, 52, 38]);
        if (x % 4 < 2) px(x, 4, [196, 150, 60]);
        else px(x, 5, [196, 150, 60]);
      }
      for (let y = 8; y < 16; y++) px(0, y, [196, 184, 158], 0.7);
    },
  },
  crate: {
    base: [84, 100, 64], jitter: 0.1,
    paint: (px) => {
      for (let i = 0; i < 16; i++) {
        for (const e of [0, 15]) {
          px(i, e, [52, 64, 40]);
          px(e, i, [52, 64, 40]);
        }
      }
      for (let i = 4; i < 12; i++) px(i, 7, [214, 208, 180], 0.9);
      for (const [x, y] of [[5, 9], [7, 9], [8, 9], [10, 9], [6, 5], [9, 5]]) px(x, y, [214, 208, 180], 0.9);
    },
  },
  woodcrate: {
    base: [184, 142, 94], jitter: 0.1,
    paint: (px) => {
      for (let i = 0; i < 16; i++) {
        for (const e of [0, 1, 14, 15]) {
          px(i, e, [120, 86, 52]);
          px(e, i, [120, 86, 52]);
        }
        px(i, i, [140, 102, 64]);
      }
    },
  },
  barrel: {
    base: [222, 222, 222], jitter: 0.1,
    paint: (px, rnd) => {
      for (let x = 0; x < 16; x++) {
        for (const y of [2, 3, 12, 13]) px(x, y, [70, 70, 74]);
        if (rnd() < 0.3) px(x, 5 + Math.floor(rnd() * 6), [150, 110, 80], 0.8);
      }
    },
  },
  skin: { base: [202, 158, 116], jitter: 0.06 },
  fur: {
    base: [132, 120, 104], jitter: 0.22,
    paint: (px, rnd) => {
      for (let i = 0; i < 30; i++) px(Math.floor(rnd() * 16), Math.floor(rnd() * 16), [96, 86, 74], 0.8);
    },
  },
  cloud: { base: [255, 255, 255], jitter: 0.03 },
};

const cache = new Map<string, THREE.CanvasTexture>();

export function tex(name: string): THREE.CanvasTexture {
  let t = cache.get(name);
  if (t) return t;
  const spec = SPECS[name] ?? SPECS.noise;
  const size = spec.size ?? 16;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  let seed = 7;
  for (let i = 0; i < name.length; i++) seed = (seed * 31 + name.charCodeAt(i)) | 0;
  const rnd = mulberry32(seed);
  const img = ctx.createImageData(size, size);
  const put: Px = (x, y, c, alpha = 1) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    for (let k = 0; k < 3; k++) img.data[i + k] = Math.max(0, Math.min(255, img.data[i + k] * (1 - alpha) + c[k] * alpha));
    img.data[i + 3] = 255;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) put(x, y, shade(spec.base, 1 + (rnd() - 0.5) * 2 * spec.jitter));
  }
  spec.paint?.(put, rnd, size);
  ctx.putImageData(img, 0, 0);
  t = new THREE.CanvasTexture(canvas);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestMipmapLinearFilter;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  cache.set(name, t);
  return t;
}

/** A small picture drawn by hand, for sprites: the harvest weak-point marker and the like. */
export function sprite(name: string, rows: string[], palette: Record<string, string>): THREE.CanvasTexture {
  let t = cache.get(name);
  if (t) return t;
  const canvas = document.createElement("canvas");
  canvas.width = rows[0].length;
  canvas.height = rows.length;
  const ctx = canvas.getContext("2d")!;
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const c = palette[ch];
      if (!c) return;
      ctx.fillStyle = c;
      ctx.fillRect(x, y, 1, 1);
    });
  });
  t = new THREE.CanvasTexture(canvas);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  cache.set(name, t);
  return t;
}
