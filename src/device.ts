/**
 * What kind of device this is, decided once when the page loads, and the one number that fits the
 * interface to a small screen.
 */

const query = new URLSearchParams(location.search);

/** Played with fingers: no keyboard, no mouse to capture. `?touch` forces it, for trying it on a desk. */
export const TOUCH = query.has("touch") || (matchMedia("(pointer: coarse)").matches && navigator.maxTouchPoints > 0);

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

/** Fills the screen and turns it sideways where the browser allows; where it does not, nothing happens. */
export function goFullscreen(): void {
  if (!TOUCH || document.fullscreenElement) return;
  const el = document.documentElement;
  void Promise.resolve(el.requestFullscreen?.())
    .then(() => (screen.orientation as unknown as { lock?(o: string): Promise<void> })?.lock?.("landscape"))
    .catch(() => {});
}
