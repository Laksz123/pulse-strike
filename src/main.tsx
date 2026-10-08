import { createRoot } from "react-dom/client";
import { MARKERS, PATTERNS } from "./arena/markers";
import { preloadPatterns } from "./arena/models";
import { markerIcon } from "./arena/render";
import { App } from "./ui/App";
import "./styles.css";
import { useStore } from "./store";
import { fitUi } from "./device";

fitUi();

// Handy in the console while developing.
if (import.meta.env.DEV) {
  (window as unknown as { __store?: typeof useStore }).__store = useStore;
  // On the development server the profile owns everything, in whatever browser it is opened: every skin, blade and agent.
  useStore.getState().unlockAll(true);
}

// Icons are rendered from the 3D models, so the pattern textures must be in before the first one.
/** Development aid: /?gallery=<pattern>&from=<n>&n=<count> shows marker models big, to check them at a glance. */
function Gallery({ skin }: { skin: number }) {
  const q = new URLSearchParams(location.search);
  const from = Number(q.get("from") ?? 0);
  const n = Number(q.get("n") ?? 4);
  return (
    <div style={{ position: "fixed", inset: 0, display: "grid", gridTemplateColumns: `repeat(${q.get("cols") ?? 1}, 1fr)`, alignContent: "start", gap: 4, padding: 4, background: "#dfe6ee", overflow: "auto" }}>
      {MARKERS.slice(from, from + n).map((d, i) => (
        <div key={d.id} style={{ background: "#fff", borderRadius: 8, color: "#14213d", fontWeight: 700, fontSize: 12, textAlign: "center" }}>
          <img src={markerIcon(d.id, skin < 0 ? (from + i) % PATTERNS.length : skin)} style={{ width: "100%", display: "block" }} alt="" />
          {d.name}
        </div>
      ))}
    </div>
  );
}

const gallery = new URLSearchParams(location.search).get("gallery");
// Hot reload re-runs this file: keep one React root.
const holder = window as unknown as { __root?: ReturnType<typeof createRoot> };
void preloadPatterns().then(() => {
  holder.__root ??= createRoot(document.getElementById("root")!);
  holder.__root.render(import.meta.env.DEV && gallery !== null ? <Gallery skin={Number(gallery || 0)} /> : <App />);
});
