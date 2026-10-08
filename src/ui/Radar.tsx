import { useEffect, useRef } from "react";
import { Arena, TEAM_COLORS } from "../arena/arena";

const SIZE = 196;
/** Metres from the middle of the radar to its rim. */
const REACH = 31;
/** Pixels per metre in the drawing of the map that is kept and turned. */
const PX = 5;
const CELL = 1.25;
const hex = (c: number) => `#${c.toString(16).padStart(6, "0")}`;
const MINE = hex(TEAM_COLORS[0]);
const THEIRS = hex(TEAM_COLORS[1]);

/** The floor plan: everywhere a body can stand, lighter where the ground is raised. */
function drawPlan(a: Arena): HTMLCanvasElement {
  const [hx, hz] = a.map.half;
  const plan = document.createElement("canvas");
  plan.width = hx * 2 * PX;
  plan.height = hz * 2 * PX;
  const c = plan.getContext("2d")!;
  const step = CELL * PX;
  for (let z = -hz + CELL / 2; z < hz; z += CELL) {
    for (let x = -hx + CELL / 2; x < hx; x += CELL) {
      if (!a.map.nav.free(x, z)) continue;
      const h = a.map.floorAt(x, z);
      c.fillStyle = h > 1.2 ? "rgba(226, 236, 255, 0.95)" : h > 0.2 ? "rgba(196, 210, 240, 0.92)" : "rgba(158, 176, 216, 0.88)";
      c.fillRect((x + hx) * PX - step / 2 - 0.5, (z + hz) * PX - step / 2 - 0.5, step + 1, step + 1);
    }
  }
  return plan;
}

/**
 * The radar, as in every tactical shooter: the map round the player, turned so that ahead is up.
 * Teammates are always on it; the other side only while one of ours can see them; the bomb when
 * it is lying on the ground or planted.
 */
export function Radar() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = canvas.height = SIZE * dpr;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    let plan: HTMLCanvasElement | null = null;
    let planOf: Arena | null = null;
    const R = SIZE / 2;
    const k = (R - 3) / REACH;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const a = Arena.current;
      if (!a) return;
      if (planOf !== a) {
        plan = drawPlan(a);
        planOf = a;
      }
      const v = a.radar();
      const [hx, hz] = a.map.half;
      const cos = Math.cos(v.me.yaw);
      const sin = Math.sin(v.me.yaw);
      /** Where a point of the world falls on the radar; `far` when it is past the rim. */
      const at = (x: number, z: number, keep: boolean) => {
        const dx = (x - v.me.x) * k;
        const dz = (z - v.me.z) * k;
        let sx = dx * cos - dz * sin;
        let sy = dx * sin + dz * cos;
        const d = Math.hypot(sx, sy);
        const far = d > R - 9;
        if (far && keep) {
          sx *= (R - 9) / d;
          sy *= (R - 9) / d;
        }
        return { x: R + sx, y: R + sy, far };
      };
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, SIZE, SIZE);
      ctx.save();
      ctx.beginPath();
      ctx.arc(R, R, R - 1, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = "rgba(11, 16, 34, 0.8)";
      ctx.fillRect(0, 0, SIZE, SIZE);
      ctx.translate(R, R);
      ctx.rotate(v.me.yaw);
      ctx.scale(k / PX, k / PX);
      ctx.globalAlpha = 0.62;
      if (plan) ctx.drawImage(plan, -(v.me.x + hx) * PX, -(v.me.z + hz) * PX);
      ctx.restore();
      ctx.save();
      ctx.beginPath();
      ctx.arc(R, R, R - 1, 0, Math.PI * 2);
      ctx.clip();
      ctx.lineJoin = "round";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      // The sites, by letter.
      ctx.font = "1000 17px Nunito, Rubik, sans-serif";
      for (const s of a.map.sites) {
        const p = at(s.x, s.z, false);
        if (p.far) continue;
        ctx.lineWidth = 4;
        ctx.strokeStyle = "#0b1022";
        ctx.strokeText(s.name, p.x, p.y);
        ctx.fillStyle = "#ffd21a";
        ctx.fillText(s.name, p.x, p.y);
      }
      const dot = (x: number, y: number, r: number, fill: string, alpha = 1) => {
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#0b1022";
        ctx.stroke();
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.globalAlpha = 1;
      };
      for (const d of v.dots) {
        const p = at(d.x, d.z, d.kind !== "enemy");
        if (p.far && d.kind === "enemy") continue;
        if (d.kind === "dead") {
          ctx.globalAlpha = d.alpha;
          ctx.lineWidth = 3;
          ctx.strokeStyle = MINE;
          ctx.beginPath();
          ctx.moveTo(p.x - 4, p.y - 4);
          ctx.lineTo(p.x + 4, p.y + 4);
          ctx.moveTo(p.x + 4, p.y - 4);
          ctx.lineTo(p.x - 4, p.y + 4);
          ctx.stroke();
          ctx.globalAlpha = 1;
          continue;
        }
        if (d.kind === "ally" && !p.far) {
          // Which way they are facing.
          const fx = Math.sin(d.yaw);
          const fz = Math.cos(d.yaw);
          const hx2 = fx * cos - fz * sin;
          const hy2 = fx * sin + fz * cos;
          ctx.lineWidth = 3;
          ctx.strokeStyle = MINE;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + hx2 * 10, p.y + hy2 * 10);
          ctx.stroke();
        }
        dot(p.x, p.y, p.far ? 3.5 : 5, d.kind === "ally" ? (d.bomb ? "#ffb21a" : MINE) : THEIRS, d.alpha);
      }
      if (v.bomb) {
        const p = at(v.bomb.x, v.bomb.z, true);
        const blink = v.bomb.planted ? 0.55 + 0.45 * Math.sin(now / 110) : 1;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(Math.PI / 4);
        ctx.globalAlpha = blink;
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#0b1022";
        ctx.strokeRect(-4.5, -4.5, 9, 9);
        ctx.fillStyle = v.bomb.planted ? "#ff4a3d" : "#ffb21a";
        ctx.fillRect(-4.5, -4.5, 9, 9);
        ctx.restore();
      }
      // The player: an arrow in the middle, always pointing ahead.
      if (v.me.alive) {
        ctx.beginPath();
        ctx.moveTo(R, R - 9);
        ctx.lineTo(R + 6.5, R + 7);
        ctx.lineTo(R, R + 3.5);
        ctx.lineTo(R - 6.5, R + 7);
        ctx.closePath();
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = "#0b1022";
        ctx.stroke();
        ctx.fillStyle = "#ffffff";
        ctx.fill();
      }
      ctx.restore();
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} className="a-radar" style={{ width: SIZE, height: SIZE }} />;
}
