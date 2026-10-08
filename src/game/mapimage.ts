/** The island painted top-down, once, in the same colours as the 3D terrain. Both maps draw it. */

import * as THREE from "three";
import { groundColor, heightAt } from "./world";

/** Half the width of the mapped square, metres. */
export const MAP_SPAN = 660;
const SIZE = 330;
let canvas: HTMLCanvasElement | null = null;

export function terrainCanvas(): HTMLCanvasElement {
  if (canvas) return canvas;
  canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(SIZE, SIZE);
  const c = new THREE.Color();
  const deep = new THREE.Color(0x1f6f9a);
  const shallow = new THREE.Color(0x4fb4d8);
  for (let j = 0; j < SIZE; j++) {
    for (let i = 0; i < SIZE; i++) {
      const x = ((i + 0.5) / SIZE - 0.5) * 2 * MAP_SPAN;
      const z = ((j + 0.5) / SIZE - 0.5) * 2 * MAP_SPAN;
      const y = heightAt(x, z);
      if (y < 0) c.copy(shallow).lerp(deep, Math.min(1, -y / 4));
      else {
        groundColor(x, y, z, c);
        // Slopes facing the sun are lighter: cheap relief shading.
        const light = 1 + Math.max(-0.3, Math.min(0.3, (heightAt(x + 5, z + 4) - y) * 0.07));
        c.multiplyScalar(light);
        // A dark rim where land meets water makes the coastline read.
        if (y < 0.35) c.multiplyScalar(0.8);
      }
      c.convertLinearToSRGB();
      const k = (j * SIZE + i) * 4;
      img.data[k] = Math.min(255, c.r * 255);
      img.data[k + 1] = Math.min(255, c.g * 255);
      img.data[k + 2] = Math.min(255, c.b * 255);
      img.data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

export const TIER_COLORS = ["", "#5fbf5a", "#f0a35c", "#d6453d"];
