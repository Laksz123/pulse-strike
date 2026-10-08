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

/** What a finger is doing: pushing the stick, turning the view, or holding a button (which turns the view too). */
type Job = { kind: "stick" | "look" | "fire" | "use" | "board"; x: number; y: number };

/**
 * The controls for a phone, the way mobile shooters lay them out: the left thumb moves on a stick
 * that appears wherever it comes down, the right thumb turns the view by dragging anywhere on its
 * side, and the buttons under it fire, aim, jump and reload. Dragging on the fire button turns
 * the view too, so aiming never has to stop to shoot.
 *
 * Fingers are read from the browser's own touch events and every one of them is claimed, so the
 * browser never gets to select, zoom, scroll or open a menu under a held finger. After each event
 * the fingers we think are down are checked against the ones that really are: if the browser ever
 * swallows the end of a touch, the stick lets go by itself instead of staying stuck.
 */
export function Touch({ arena }: { arena: React.RefObject<Arena | null> }) {
  const hint = useArena((s) => s.hint);
  const action = useArena((s) => s.action);
  const canBuy = useArena((s) => s.canBuy);
  const dead = useArena((s) => s.dead);
  const scoped = useArena((s) => s.scoped);
  const [stick, setStick] = useState<{ x: number; y: number; dx: number; dy: number } | null>(null);
  const pad = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = pad.current!;
    const jobs = new Map<number, Job>();
    const a = () => arena.current;

    const start = (id: number, x: number, y: number, target: EventTarget | null) => {
      const act = (target as HTMLElement | null)?.closest?.<HTMLElement>("[data-act]")?.dataset.act;
      if (act === "aim") return a()?.touchAim();
      if (act === "jump") return tapKey("Space");
      if (act === "reload") return tapKey("KeyR");
      if (act === "buy") return tapKey("KeyB");
      if (act === "pause") return a()?.pause();
      if (act === "fire" || act === "use" || act === "board") {
        jobs.set(id, { kind: act, x, y });
        if (act === "fire") a()?.touchFire(true);
        else if (act === "use") holdKey("KeyE", true);
        else useArena.setState({ showBoard: true });
        return;
      }
      if (x < innerWidth * 0.42) {
        // One thumb, one stick: a new one on the left takes over from whatever was there.
        for (const [other, j] of jobs) if (j.kind === "stick") jobs.delete(other);
        jobs.set(id, { kind: "stick", x, y });
        a()?.touchStick(0, 0);
        setStick({ x: x / ui(), y: y / ui(), dx: 0, dy: 0 });
      } else jobs.set(id, { kind: "look", x, y });
    };

    const move = (id: number, x: number, y: number) => {
      const j = jobs.get(id);
      if (!j) return;
      if (j.kind === "stick") {
        let dx = (x - j.x) / REACH;
        let dy = (y - j.y) / REACH;
        const len = Math.hypot(dx, dy);
        if (len > 1) {
          dx /= len;
          dy /= len;
        }
        a()?.touchStick(dx, dy);
        setStick((s) => s && { ...s, dx: (dx * REACH) / ui(), dy: (dy * REACH) / ui() });
        return;
      }
      if (j.kind === "board") return;
      a()?.touchLook(x - j.x, y - j.y);
      j.x = x;
      j.y = y;
    };

    const end = (id: number) => {
      const j = jobs.get(id);
      if (!j) return;
      jobs.delete(id);
      if (j.kind === "stick") {
        a()?.touchStick(0, 0);
        setStick(null);
      } else if (j.kind === "fire") a()?.touchFire(false);
      else if (j.kind === "use") holdKey("KeyE", false);
      else if (j.kind === "board") useArena.setState({ showBoard: false });
    };

    const drop = () => {
      for (const id of [...jobs.keys()]) end(id);
    };

    // Real fingers.
    const onTouch = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();
      for (const t of Array.from(e.changedTouches)) {
        if (e.type === "touchstart") start(t.identifier, t.clientX, t.clientY, t.target);
        else if (e.type === "touchmove") move(t.identifier, t.clientX, t.clientY);
        else end(t.identifier);
      }
      // Whatever we still hold that is no longer on the glass has been lost along the way: let it go.
      const live = new Set(Array.from(e.touches, (t) => t.identifier));
      for (const id of [...jobs.keys()]) if (id >= 0 && !live.has(id)) end(id);
    };
    // A mouse, for trying the controls at a desk: it stands in as one finger.
    const MOUSE = -1;
    const onMouse = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      if (e.type === "pointerdown") start(MOUSE, e.clientX, e.clientY, e.target);
      else if (e.type === "pointermove") move(MOUSE, e.clientX, e.clientY);
      else end(MOUSE);
    };
    const hidden = () => {
      if (document.hidden) drop();
    };

    const opts = { passive: false } as const;
    for (const type of ["touchstart", "touchmove", "touchend", "touchcancel"] as const) el.addEventListener(type, onTouch, opts);
    el.addEventListener("pointerdown", onMouse);
    window.addEventListener("pointermove", onMouse);
    window.addEventListener("pointerup", onMouse);
    window.addEventListener("blur", drop);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      for (const type of ["touchstart", "touchmove", "touchend", "touchcancel"] as const) el.removeEventListener(type, onTouch);
      el.removeEventListener("pointerdown", onMouse);
      window.removeEventListener("pointermove", onMouse);
      window.removeEventListener("pointerup", onMouse);
      window.removeEventListener("blur", drop);
      document.removeEventListener("visibilitychange", hidden);
      // Letting go of everything when the controls leave the screen.
      drop();
      arena.current?.touchStick(0, 0);
      arena.current?.touchFire(false);
    };
  }, [arena]);

  const use = hint.includes("E —") || hint.includes("Удерживай E") || !!action;

  return (
    <div className="t-pad" ref={pad}>
      {stick ? (
        <div className="t-stick on" style={{ left: stick.x, top: stick.y }}>
          <i style={{ transform: `translate(${stick.dx}px, ${stick.dy}px)` }} />
        </div>
      ) : (
        !dead && <div className="t-stick"><i /></div>
      )}
      {!dead && (
        <>
          <button className="t-btn fire" data-act="fire" aria-label="Огонь">
            <svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="11" fill="none" stroke="currentColor" strokeWidth="4" /><path d="M24 4v10M24 34v10M4 24h10M34 24h10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" /></svg>
          </button>
          <button className={scoped ? "t-btn aim on" : "t-btn aim"} data-act="aim" aria-label="Прицел">
            <svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="15" fill="none" stroke="currentColor" strokeWidth="4" /><circle cx="24" cy="24" r="4" fill="currentColor" /></svg>
          </button>
          <button className="t-btn jump" data-act="jump" aria-label="Прыжок">
            <svg viewBox="0 0 48 48"><path d="M10 30 24 14l14 16M10 40l14-12 14 12" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <button className="t-btn reload" data-act="reload" aria-label="Перезарядка">
            <svg viewBox="0 0 48 48"><path d="M38 24a14 14 0 1 1-5-10.7" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" /><path d="M36 5v10H26" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          {use && <button className="t-btn use" data-act="use">{action ? "держи" : hint.includes("подобрать") ? "взять" : "действие"}</button>}
        </>
      )}
      <div className="t-top">
        {canBuy && !dead && <button className="t-chip buy" data-act="buy">Закупка</button>}
        <button className="t-chip" data-act="board">Счёт</button>
        <button className="t-chip more" data-act="pause" aria-label="Пауза"><i /><i /><i /></button>
      </div>
    </div>
  );
}
