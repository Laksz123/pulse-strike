import { useEffect, useRef } from "react";
import { MAP_SPAN, TIER_COLORS, terrainCanvas } from "../game/mapimage";
import { MONUMENTS } from "../game/world";
import { useStore } from "../store";

const SIZE = 176;
const C = SIZE / 2;
/** Metres from the centre of the minimap to its rim. */
const RANGE = 130;

/** A round map in the corner that turns with the player: what is ahead is at the top. */
export function Minimap() {
  const ref = useRef<HTMLCanvasElement>(null);
  const px = useStore((s) => s.px);
  const pz = useStore((s) => s.pz);
  const yaw = useStore((s) => s.yaw);

  useEffect(() => {
    const ctx = ref.current!.getContext("2d")!;
    const k = C / RANGE;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.save();
    ctx.beginPath();
    ctx.arc(C, C, C - 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(C, C);
    ctx.rotate(yaw);
    ctx.scale(k, k);
    ctx.translate(-px, -pz);
    ctx.drawImage(terrainCanvas(), -MAP_SPAN, -MAP_SPAN, MAP_SPAN * 2, MAP_SPAN * 2);
    for (const m of MONUMENTS) {
      ctx.fillStyle = "rgba(214, 69, 61, 0.22)";
      ctx.beginPath();
      ctx.arc(m.x, m.z, m.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // Markers: monuments (pinned to the rim when far away) and north.
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    const mark = (wx: number, wz: number, draw: (x: number, y: number, far: boolean) => void) => {
      let x = (wx * cos - wz * sin) * k;
      let y = (wx * sin + wz * cos) * k;
      const d = Math.hypot(x, y);
      const far = d > C - 10;
      if (far) {
        x *= (C - 10) / d;
        y *= (C - 10) / d;
      }
      draw(C + x, C + y, far);
    };
    for (const m of MONUMENTS) {
      mark(m.x - px, m.z - pz, (x, y, far) => {
        const s = far ? 4 : 6;
        ctx.fillStyle = "#14110d";
        ctx.fillRect(x - s - 1.5, y - s - 1.5, s * 2 + 3, s * 2 + 3);
        ctx.fillStyle = TIER_COLORS[m.tier];
        ctx.fillRect(x - s, y - s, s * 2, s * 2);
      });
    }
    mark(0, -1e6, (x, y) => {
      ctx.fillStyle = "#14110d";
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#e9e1cf";
      ctx.font = "800 10px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("С", x, y + 3.5);
    });
    // The player.
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#14110d";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(C, C - 8);
    ctx.lineTo(C + 6, C + 6);
    ctx.lineTo(C, C + 2.5);
    ctx.lineTo(C - 6, C + 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }, [px, pz, yaw]);

  return <canvas className="minimap" ref={ref} width={SIZE} height={SIZE} />;
}
