import { useEffect, useRef, useState } from "react";
import { Arena } from "../arena/arena";
import { Game } from "../game/game";
import { RES, type ResId } from "../game/items";
import { useStore } from "../store";
import { ArenaHud } from "./ArenaHud";
import { Hud } from "./Hud";
import { Icon } from "./Icon";
import { Inventory } from "./Inventory";
import { MapView } from "./MapView";
import { Menu } from "./Menu";

function Pause({ game }: { game: React.RefObject<Game | null> }) {
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  return (
    <div className="overlay" onClick={() => game.current?.lock()}>
      <div className="pause" onClick={(e) => e.stopPropagation()}>
        <h2>Пауза</h2>
        <button className="btn primary" onClick={() => game.current?.lock()}>Продолжить</button>
        <button
          className="btn"
          onClick={() => {
            game.current?.lock();
            game.current?.startEvac();
          }}
        >
          Завершить миссию · H
        </button>
        <label className="setting">
          Чувствительность мыши <b>{settings.sens.toFixed(1)}</b>
          <input type="range" min="0.3" max="3" step="0.1" value={settings.sens} onChange={(e) => setSettings({ sens: Number(e.target.value) })} />
        </label>
        <label className="setting row">
          <input type="checkbox" checked={settings.pixel} onChange={(e) => setSettings({ pixel: e.target.checked })} />
          Пиксельная картинка (размывает даль)
        </label>
        <button className="btn danger" onClick={() => game.current?.abandon()}>Бросить миссию</button>
        <p className="hint">Завершение — 10 секунд стоя на месте вне РТ: всё при тебе уедет на базу. Бросить миссию — то же, что погибнуть.</p>
      </div>
    </div>
  );
}

/** The debrief after a mission: what came home, or what was lost. */
function Debrief() {
  const sum = useStore((s) => s.summary);
  const setScreen = useStore((s) => s.setScreen);
  if (!sum) return null;
  const res = Object.entries(sum.res) as [ResId, number][];
  return (
    <div className={sum.survived ? "overlay win" : "overlay dead"}>
      <div className="pause debrief">
        <h2>{sum.survived ? "Миссия завершена" : "Вы погибли"}</h2>
        <p className="hint">
          {sum.survived
            ? "Всё, что было при тебе, на базе. Разложи добычу на складе."
            : "Всё, что было при тебе, потеряно. Уцелели склад и защищённый карман."}
        </p>
        <div className="stat-row">
          <div><b>{sum.minutes}</b>мин</div>
          <div><b>{sum.kills}</b>убийств</div>
          <div><b>+{sum.xp}</b>опыта</div>
          {sum.survived && <div><b>{sum.items}</b>предметов</div>}
        </div>
        {(sum.salt > 0 || res.length > 0) && (
          <div className={sum.survived ? "haul" : "haul lost"}>
            <div className="haul-title">{sum.survived ? "Вынесено" : "Потеряно"}</div>
            {sum.salt > 0 && <span className="chip">◆ {sum.salt}</span>}
            {res.map(([k, n]) => (
              <span key={k} className="chip" title={RES[k].name}><Icon id={k} size={20} /> {n}</span>
            ))}
          </div>
        )}
        <button className="btn primary" onClick={() => setScreen("menu")}>На базу</button>
      </div>
    </div>
  );
}

/** One mission in the open world. Mounting it builds a fresh island; unmounting throws it away. */
function GameView() {
  const host = useRef<HTMLDivElement>(null);
  const game = useRef<Game | null>(null);
  const paused = useStore((s) => s.paused);
  const panel = useStore((s) => s.panel);
  const screen = useStore((s) => s.screen);

  useEffect(() => {
    let gone = false;
    void Game.create(host.current!).then((g) => {
      if (gone) return g.dispose();
      game.current = g;
      g.start();
      g.lock();
    });
    return () => {
      gone = true;
      game.current?.dispose();
      game.current = null;
    };
  }, []);

  return (
    <div className="game">
      <div className="canvas-host" ref={host} />
      <Hud />
      {panel === "map" && screen === "game" && (
        <div className="overlay clear">
          <MapView />
        </div>
      )}
      {panel === "inv" && screen === "game" && (
        <div className="overlay" onClick={() => game.current?.lock()}>
          <Inventory onClose={() => game.current?.lock()} />
        </div>
      )}
      {paused && panel !== "inv" && screen === "game" && <Pause game={game} />}
      {(screen === "dead" || screen === "summary") && <Debrief />}
    </div>
  );
}

/** One match. `round` changes to start a fresh one. */
function ArenaView({ onAgain }: { onAgain(): void }) {
  const host = useRef<HTMLDivElement>(null);
  const arena = useRef<Arena | null>(null);
  useEffect(() => {
    let gone = false;
    void Arena.create(host.current!, useStore.getState().arenaMode, useStore.getState().arenaMap).then((a) => {
      if (gone) return a.dispose();
      arena.current = a;
      a.start();
      a.lock();
    });
    return () => {
      gone = true;
      arena.current?.dispose();
      arena.current = null;
    };
  }, []);
  return (
    <div className="game arena">
      <div className="canvas-host" ref={host} />
      <ArenaHud arena={arena} onAgain={onAgain} />
    </div>
  );
}

export function App() {
  const screen = useStore((s) => s.screen);
  const [round, setRound] = useState(0);
  if (screen === "menu") return <Menu />;
  if (screen === "arena") return <ArenaView key={round} onAgain={() => setRound((n) => n + 1)} />;
  return <GameView />;
}
