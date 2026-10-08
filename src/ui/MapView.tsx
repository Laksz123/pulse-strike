import { useEffect, useRef } from "react";
import { MAP_SPAN, TIER_COLORS, terrainCanvas } from "../game/mapimage";
import { MONUMENTS } from "../game/world";
import { useStore } from "../store";

const SIZE = 660;
const at = (v: number) => (v / MAP_SPAN / 2 + 0.5) * SIZE;

/** The full map, drawn like a field chart: a lettered grid over the terrain. */
export function MapView() {
  const ref = useRef<HTMLCanvasElement>(null);
  const px = useStore((s) => s.px);
  const pz = useStore((s) => s.pz);
  const yaw = useStore((s) => s.yaw);

  useEffect(() => {
    const ctx = ref.current!.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(terrainCanvas(), 0, 0, SIZE, SIZE);
    // Grid: 100 m squares, letters across and numbers down.
    ctx.strokeStyle = "rgba(20, 17, 13, 0.22)";
    ctx.lineWidth = 1;
    ctx.font = "700 11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(20, 17, 13, 0.55)";
    ctx.textAlign = "left";
    let col = 0;
    for (let v = -600; v <= 600; v += 100, col++) {
      const p = Math.round(at(v)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, SIZE);
      ctx.moveTo(0, p);
      ctx.lineTo(SIZE, p);
      ctx.stroke();
      if (col < 12) {
        ctx.fillText(String.fromCharCode(65 + col), p + 4, 12);
        ctx.fillText(String(col + 1), 4, p + 14);
      }
    }
    ctx.textAlign = "center";
    ctx.font = "700 12px system-ui, sans-serif";
    for (const m of MONUMENTS) {
      const x = at(m.x);
      const y = at(m.z);
      ctx.fillStyle = "rgba(20, 17, 13, 0.25)";
      ctx.beginPath();
      ctx.arc(x, y, (m.r / MAP_SPAN / 2) * SIZE, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#14110d";
      ctx.fillRect(x - 8, y - 8, 16, 16);
      ctx.fillStyle = TIER_COLORS[m.tier];
      ctx.fillRect(x - 6, y - 6, 12, 12);
      const w = ctx.measureText(m.name).width + 10;
      ctx.fillStyle = "rgba(20, 17, 13, 0.78)";
      ctx.fillRect(x - w / 2, y + 12, w, 17);
      ctx.fillStyle = "#e9e1cf";
      ctx.fillText(m.name, x, y + 25);
    }
    // The player: an arrow pointing where they look.
    ctx.save();
    ctx.translate(at(px), at(pz));
    ctx.rotate(-yaw);
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#14110d";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(8, 9);
    ctx.lineTo(0, 4);
    ctx.lineTo(-8, 9);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }, [px, pz, yaw]);

  const col = String.fromCharCode(65 + Math.max(0, Math.min(11, Math.floor((px + 600) / 100))));
  const row = Math.max(1, Math.min(12, Math.floor((pz + 600) / 100) + 1));
  return (
    <div className="mapview">
      <div className="map-head">
        <h2>Остров</h2>
        <span>Ты в квадрате <b>{col}{row}</b></span>
        <span className="legend">
          РТ: <i style={{ background: TIER_COLORS[1] }} /> лёгкая <i style={{ background: TIER_COLORS[2] }} /> средняя <i style={{ background: TIER_COLORS[3] }} /> опасная
        </span>
        <span className="spacer" />
        <kbd>M</kbd> закрыть
      </div>
      <canvas ref={ref} width={SIZE} height={SIZE} />
      <div className="map-foot">Вне РТ вооружённых людей нет — только звери. Эвакуация (H) работает везде, кроме РТ.</div>
    </div>
  );
}
