import { useEffect, useRef, useState } from "react";
import type { Arena } from "../arena/arena";
import { useArena } from "../arena/state";
import { ui } from "../device";

/** How far the stick travels from where the thumb came down, in real pixels. */
const REACH = 58;

/** A key press, for everything the match already does from the keyboard. */
export function tapKey(code: string): void {
  window.dispatchEvent(new KeyboardEvent("keydown", { code }));
  setTimeout(() => window.dispatchEvent(new KeyboardEvent("keyup", { code })), 110);
}
const holdKey = (code: string, down: boolean) => window.dispatchEvent(new KeyboardEvent(down ? "keydown" : "keyup", { code }));

/**
 * The controls for a phone, the way mobile shooters lay them out: the left thumb moves on a stick
 * that appears wherever it comes down, the right thumb turns the view by dragging anywhere on its
 * side, and the buttons under it fire, aim, jump and reload. Dragging on the fire button turns
 * the view too, so aiming never has to stop to shoot.
 */
export function Touch({ arena }: { arena: React.RefObject<Arena | null> }) {
  const hint = useArena((s) => s.hint);
  const action = useArena((s) => s.action);
  const canBuy = useArena((s) => s.canBuy);
  const dead = useArena((s) => s.dead);
  const scoped = useArena((s) => s.scoped);
  const [stick, setStick] = useState<{ x: number; y: number; dx: number; dy: number } | null>(null);
  const move = useRef<{ id: number; x: number; y: number } | null>(null);
  const look = useRef(new Map<number, { x: number; y: number }>());

  // Letting go of everything when the controls leave the screen.
  useEffect(() => () => {
    arena.current?.touchStick(0, 0);
    arena.current?.touchFire(false);
  }, [arena]);

  /** Keeps a finger's moves coming to where it came down, even when it slides off. */
  const grab = (e: React.PointerEvent) => {
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // Not a real finger: nothing to hold on to.
    }
  };
  const down = (e: React.PointerEvent) => {
    grab(e);
    if (e.clientX < innerWidth * 0.42 && !move.current) {
      move.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
      setStick({ x: e.clientX / ui(), y: e.clientY / ui(), dx: 0, dy: 0 });
    } else look.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };
  const drag = (e: React.PointerEvent) => {
    const m = move.current;
    if (m && m.id === e.pointerId) {
      let dx = (e.clientX - m.x) / REACH;
      let dy = (e.clientY - m.y) / REACH;
      const len = Math.hypot(dx, dy);
      if (len > 1) {
        dx /= len;
        dy /= len;
      }
      arena.current?.touchStick(dx, dy);
      setStick((s) => s && { ...s, dx: (dx * REACH) / ui(), dy: (dy * REACH) / ui() });
      return;
    }
    const l = look.current.get(e.pointerId);
    if (!l) return;
    arena.current?.touchLook(e.clientX - l.x, e.clientY - l.y);
    l.x = e.clientX;
    l.y = e.clientY;
  };
  const up = (e: React.PointerEvent) => {
    if (move.current?.id === e.pointerId) {
      move.current = null;
      setStick(null);
      arena.current?.touchStick(0, 0);
    }
    look.current.delete(e.pointerId);
  };
  /** A button that is held: fire, use. Dragging on it turns the view. */
  const held = (on: (down: boolean) => void) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.stopPropagation();
      grab(e);
      look.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      on(true);
    },
    onPointerMove: drag,
    onPointerUp: (e: React.PointerEvent) => {
      look.current.delete(e.pointerId);
      on(false);
    },
    onPointerCancel: (e: React.PointerEvent) => {
      look.current.delete(e.pointerId);
      on(false);
    },
  });
  /** A button that is tapped. */
  const tap = (fn: () => void) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.stopPropagation();
      fn();
    },
  });
  const use = hint.includes("E —") || hint.includes("Удерживай E") || !!action;

  return (
    <div className="t-pad" onPointerDown={down} onPointerMove={drag} onPointerUp={up} onPointerCancel={up}>
      {stick ? (
        <div className="t-stick on" style={{ left: stick.x, top: stick.y }}>
          <i style={{ transform: `translate(${stick.dx}px, ${stick.dy}px)` }} />
        </div>
      ) : (
        !dead && <div className="t-stick"><i /></div>
      )}
      {!dead && (
        <>
          <button className="t-btn fire" {...held((d) => arena.current?.touchFire(d))} aria-label="Огонь">
            <svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="11" fill="none" stroke="currentColor" strokeWidth="4" /><path d="M24 4v10M24 34v10M4 24h10M34 24h10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" /></svg>
          </button>
          <button className={scoped ? "t-btn aim on" : "t-btn aim"} {...tap(() => arena.current?.touchAim())} aria-label="Прицел">
            <svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="15" fill="none" stroke="currentColor" strokeWidth="4" /><circle cx="24" cy="24" r="4" fill="currentColor" /></svg>
          </button>
          <button className="t-btn jump" {...tap(() => tapKey("Space"))} aria-label="Прыжок">
            <svg viewBox="0 0 48 48"><path d="M10 30 24 14l14 16M10 40l14-12 14 12" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <button className="t-btn reload" {...tap(() => tapKey("KeyR"))} aria-label="Перезарядка">
            <svg viewBox="0 0 48 48"><path d="M38 24a14 14 0 1 1-5-10.7" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" /><path d="M36 5v10H26" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          {use && <button className="t-btn use" {...held((d) => holdKey("KeyE", d))}>{action ? "держи" : hint.includes("подобрать") ? "взять" : "действие"}</button>}
        </>
      )}
      <div className="t-top">
        {canBuy && !dead && <button className="t-chip buy" {...tap(() => tapKey("KeyB"))}>Закупка</button>}
        <button className="t-chip" {...held((d) => useArena.setState({ showBoard: d }))}>Счёт</button>
        <button className="t-chip more" {...tap(() => arena.current?.pause())} aria-label="Пауза"><i /><i /><i /></button>
      </div>
    </div>
  );
}
