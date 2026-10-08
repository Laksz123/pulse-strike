/**
 * What kind of device this is, decided once when the page loads, and the one number that fits the
 * interface to a small screen.
 */

const query = new URLSearchParams(location.search);

/** Played with fingers: no keyboard, no mouse to capture. `?touch` forces it, for trying it on a desk; `?mouse` forces the opposite. */
export const TOUCH = !query.has("mouse") && (query.has("touch") || (matchMedia("(pointer: coarse)").matches && navigator.maxTouchPoints > 0));

/** A phone's graphics chip: no shadows, fewer lamps, fewer pixels. */
export const LIGHT = TOUCH || query.has("light");

/** The interface is laid out for a screen at least this tall and this wide, and shrunk to fit anything smaller. */
const TALL = 620;
const WIDE = 1040;
let scale = 1;

/** How much the interface is shrunk: 1 on a desktop, about 0.6 on a phone held sideways. */
export const ui = () => scale;

export function fitUi(): void {
  const root = document.documentElement;
  const set = () => {
    scale = Math.max(0.36, Math.min(1, innerHeight / TALL, innerWidth / WIDE));
    root.style.setProperty("--ui", scale.toFixed(4));
    // The breakpoints of the layout, measured on the sheet it is laid out on rather than on the glass.
    for (const w of [900, 1100, 1150, 1180]) root.classList.toggle(`w${w}`, innerWidth / scale <= w);
    root.classList.toggle("h700", innerHeight / scale <= 700);
    root.classList.toggle("touch", TOUCH);
    root.classList.toggle("upright", TOUCH && innerHeight > innerWidth);
  };
  set();
  addEventListener("resize", set);
  addEventListener("orientationchange", () => setTimeout(set, 250));
}

/**
 * A phone browser wants to select, zoom, scroll and open menus under a held finger; a game wants
 * none of it. Everything of that kind is refused here, once, for the whole page.
 */
export function tame(): void {
  if (!TOUCH) return;
  const stop = (e: Event) => {
    if (e.cancelable) e.preventDefault();
  };
  const el = (t: EventTarget | null) => (t instanceof Element ? t : null);
  const field = (t: EventTarget | null) => !!el(t)?.closest("input, textarea, select");
  /** In the match itself, rather than on one of its sheets (pause, buying, sides, the result), which are ordinary pages. */
  const playing = (t: EventTarget | null) => {
    const e = el(t);
    return !!e?.closest(".game") && !e.closest(".overlay, .a-teams");
  };
  // Pinching, long-press menus, double taps and dragging pictures about.
  for (const type of ["gesturestart", "gesturechange", "gestureend", "contextmenu", "dblclick", "dragstart"]) document.addEventListener(type, stop, { passive: false });
  document.addEventListener("selectstart", (e) => {
    if (!field(e.target)) stop(e);
  });
  // Two fingers are two controls, never a pinch; and a finger on the match is never a scroll or a selection.
  const claim = (e: TouchEvent) => {
    if (e.touches.length > 1 || playing(e.target)) stop(e);
  };
  document.addEventListener(
    "touchstart",
    (e) => {
      if (!field(e.target)) getSelection()?.removeAllRanges();
      claim(e);
    },
    { passive: false },
  );
  document.addEventListener("touchmove", claim, { passive: false });
  // If the page is zoomed in anyway, put it back: stating the scale again makes the browser return to it.
  const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  visualViewport?.addEventListener("resize", () => {
    if (!meta || (visualViewport?.scale ?? 1) < 1.02) return;
    const content = meta.content;
    meta.content = `${content}, minimum-scale=1`;
    requestAnimationFrame(() => (meta.content = content));
  });
}

/** Fills the screen and turns it sideways where the browser allows; where it does not, nothing happens. */
export function goFullscreen(): void {
  if (!TOUCH || document.fullscreenElement) return;
  const el = document.documentElement;
  void Promise.resolve(el.requestFullscreen?.())
    .then(() => (screen.orientation as unknown as { lock?(o: string): Promise<void> })?.lock?.("landscape"))
    .catch(() => {});
}
