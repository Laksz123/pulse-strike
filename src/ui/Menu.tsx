import { useEffect, useRef, useState } from "react";
import { MAX_SKILL, SKILLS, SKILL_ORDER, rankOf, skillLevel, skillProgress } from "../game/career";
import { ITEMS, armorProt, itemColor } from "../game/items";
import { levelOf, levelProgress, maxHpOf, useStore, type Tab } from "../store";
import { Icon } from "./Icon";
import { AGENT_BY_ID } from "../arena/agents";
import { ARENA_MODES } from "../arena/arena";
import { MAPS, type MapId } from "../arena/map";
import { RARITY, itemRarity } from "../arena/markers";
import { LobbyScene } from "../arena/lobby3d";
import { MISSION_BY_ID, PASS_FREE, PASS_PREMIUM, SEASON, passLevel, passProgress } from "../arena/pass";
import { mapThumb } from "../arena/render";
import { short } from "../solana/chain";
import { useWallet } from "../solana/wallet";
import { Arsenal } from "./Arsenal";
import { Cases } from "./Cases";
import { Gift } from "./Gift";
import { Inventory } from "./Inventory";
import { Market } from "./Market";
import { PassPage, RewardIcon } from "./Pass";
import { QuestsPage } from "./Quests";
import { Shop } from "./Shop";
import { TOUCH, goFullscreen } from "../device";
import { music, sfx } from "../game/audio";

type Mode = "shooter" | "world";
type Page = "play" | "shop" | "inventory" | "agents" | "cases" | "market" | "pass" | "quests" | "home" | "profile" | Tab;

const WORLD_PAGES: [Page, string][] = [["home", "База"], ["stash", "Склад"], ["craft", "Мастерская"], ["trade", "Торговец"], ["profile", "Профиль"]];

function Profile() {
  const s = useStore();
  const level = levelOf(s.xp);
  return (
    <main className="profile">
      <section className="profile-head">
        <div className="lvl big">{level}</div>
        <div>
          <div className="rank">{rankOf(level)}</div>
          <div className="sub">Здоровье {maxHpOf(s.skills)} · верстак {s.bench} ур. · карман на {s.pocket} слота · чертежей изучено {s.known.length}</div>
        </div>
        <div className="stat-row">
          <div><b>{s.stats.missions}</b>миссий</div>
          <div><b>{s.stats.deaths}</b>смертей</div>
          <div><b>{s.stats.kills}</b>убийств</div>
          <div><b>{s.stats.bosses}</b>боссов</div>
        </div>
      </section>
      <h3>Профессии</h3>
      <section className="skills">
        {SKILL_ORDER.map((id) => {
          const def = SKILLS[id];
          const lvl = skillLevel(s.skills[id]);
          return (
            <div key={id} className="skill">
              <div className="skill-head">
                <span className="skill-name">{def.name}</span>
                <span className="skill-lvl">{lvl}<i>/{MAX_SKILL}</i></span>
              </div>
              <div className="bar"><div style={{ width: `${skillProgress(s.skills[id]) * 100}%` }} /></div>
              <div className="skill-how">{def.how}</div>
              <ul>
                <li className={lvl >= 1 ? "on" : ""}>{def.per}</li>
                <li className={lvl >= 5 ? "on" : ""}>Ур. 5: {def.perk5}</li>
                <li className={lvl >= 10 ? "on" : ""}>Ур. 10: {def.perk10}</li>
              </ul>
            </div>
          );
        })}
      </section>
    </main>
  );
}

const TILES: { page: Page; name: string; icon: string; key: string }[] = [
  { page: "shop", name: "Магазин", icon: "/art/icon_market.png", key: "B" },
  { page: "inventory", name: "Инвентарь", icon: "/art/icon_inventory.png", key: "I" },
  { page: "agents", name: "Агенты", icon: "/art/icon_agents.png", key: "A" },
  { page: "cases", name: "Кейсы", icon: "/art/case.png", key: "C" },
  { page: "market", name: "Маркет", icon: "/art/icon_trade.png", key: "M" },
  { page: "pass", name: "Пропуск", icon: "/art/icon_pass.png", key: "P" },
  { page: "quests", name: "Задания", icon: "/art/icon_quests.png", key: "Q" },
];
const TITLES: Partial<Record<Page, string>> = { shop: "Магазин", inventory: "Инвентарь", agents: "Агенты", cases: "Кейсы", market: "Маркет", pass: "Боевой пропуск", quests: "Задания" };

function Coins() {
  const salt = useStore((s) => s.salt);
  return <span className="ps-pill"><img src="/art/coin.png" alt="" /><b>{salt}</b></span>;
}

function WalletButton({ onClick }: { onClick(): void }) {
  const wallet = useWallet((w) => w.wallet);
  const balance = useWallet((w) => w.balance);
  return (
    <button className={wallet ? "ps-pill sol on" : "ps-pill sol"} onClick={onClick}>
      {wallet ? <b>{balance === null ? short(wallet.address) : `${balance.toFixed(3)} SOL`}</b> : <b>Кошелёк</b>}
    </button>
  );
}

/** Mode and map: opened from the match card. The side is chosen in the match itself. */
function MatchPicker({ thumbs, onClose }: { thumbs: Partial<Record<MapId, string>>; onClose(): void }) {
  const s = useStore();
  const mode = ARENA_MODES.find((m) => m.id === s.arenaMode) ?? ARENA_MODES[0];
  return (
    <div className="ps-modal" onClick={onClose}>
      <div className="ps-sheet" onClick={(e) => e.stopPropagation()}>
        <h2 className="toon">Выбор боя</h2>
        <h3>Режим</h3>
        <div className="pick-row">
          {ARENA_MODES.filter((m) => m.id !== "range").map((m) => (
            <button key={m.id} className={s.arenaMode === m.id ? "ps-pick on" : "ps-pick"} onClick={() => useStore.setState({ arenaMode: m.id })}>
              <b className="toon">{m.name}</b>
              <small>{m.hint}</small>
            </button>
          ))}
        </div>
        <div className="pick-row">
          {ARENA_MODES.filter((m) => m.id === "range").map((m) => (
            <button key={m.id} className={s.arenaMode === m.id ? "ps-pick on wide" : "ps-pick wide"} onClick={() => useStore.setState({ arenaMode: m.id })}>
              <b className="toon">{m.name}</b>
              <small>{m.hint}</small>
            </button>
          ))}
        </div>
        <h3>Карта</h3>
        <div className={mode.id === "range" ? "pick-row off" : "pick-row"}>
          {MAPS.map((m) => (
            <button key={m.id} className={s.arenaMap === m.id ? "ps-map on" : "ps-map"} onClick={() => useStore.setState({ arenaMap: m.id })} title={m.about}>
              {thumbs[m.id] ? <img src={thumbs[m.id]} alt="" draggable={false} /> : <div className="map-wait" />}
              <b className="toon">{m.name}</b>
              <small>{m.mood}</small>
            </button>
          ))}
        </div>
        <button className="ps-cta small" onClick={onClose}><b className="toon">Готово</b></button>
      </div>
    </div>
  );
}

/** The lobby: the agent in the middle, everything else around the edges, one big button to play. */
function Lobby({ go }: { go(p: Page): void }) {
  const s = useStore();
  const canvas = useRef<HTMLDivElement>(null);
  const scene = useRef<LobbyScene | null>(null);
  const [thumbs, setThumbs] = useState<Partial<Record<MapId, string>>>({});
  const [picker, setPicker] = useState(false);
  const [menu, setMenu] = useState(false);
  const agent = AGENT_BY_ID[s.agents.find((a) => a.uid === s.agent)?.id ?? "rookie"];
  const mode = ARENA_MODES.find((m) => m.id === s.arenaMode) ?? ARENA_MODES[0];
  const map = MAPS.find((m) => m.id === s.arenaMap) ?? MAPS[0];
  const level = levelOf(s.xp);
  const lo = (level - 1) * (level - 1) * 120;
  const hi = level * level * 120;
  const passLvl = passLevel(s.passXp);
  const toClaim = Array.from({ length: passLvl }, (_, i) => i + 1).filter((l) => !s.claimed.includes(`f${l}`) || (s.premium && !s.claimed.includes(`p${l}`))).length;
  const questsReady = [...s.missions.list, ...s.missions.season].filter((m) => !m.claimed && m.n >= MISSION_BY_ID[m.id].need).length;
  const dots: Partial<Record<Page, number | boolean>> = { cases: s.cases, pass: toClaim, quests: questsReady };
  const next = Math.min(SEASON.levels, passLvl + 1);

  // The agent holds the best-looking weapon the player has a skin on.
  const show = s.markers.filter((m) => s.equipped[m.id] === m.uid).sort((a, b) => itemRarity(b) - itemRarity(a))[0];
  const showId = show?.id ?? "sprinter";
  const showSkin = show?.skin ?? 0;
  useEffect(() => {
    scene.current = new LobbyScene(canvas.current!);
    return () => scene.current?.dispose();
  }, []);
  useEffect(() => scene.current?.setAgent(agent.id, { id: showId, skin: showSkin }), [agent.id, showId, showSkin]);
  useEffect(() => scene.current?.setMood(s.arenaMap), [s.arenaMap]);
  // Map pictures are rendered from the maps themselves, one after another.
  useEffect(() => {
    let gone = false;
    void (async () => {
      for (const m of MAPS) {
        const url = await mapThumb(m.id);
        if (gone) return;
        setThumbs((t) => ({ ...t, [m.id]: url }));
      }
    })();
    return () => {
      gone = true;
    };
  }, []);
  // Every button has a key.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || (e.target as HTMLElement).tagName === "INPUT") return;
      if (e.code === "Escape") return picker ? setPicker(false) : setMenu(false);
      if (picker) return;
      if (e.code === "Enter" || e.code === "Space") return s.setScreen("arena");
      const tile = TILES.find((t) => `Key${t.key}` === e.code);
      if (tile) go(tile.page);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [picker, go, s]);

  return (
    <div className="ps-lobby">
      <div ref={canvas} className="ps-scene" />
      <div className="ps-shade" />

      <div className="ps-profile">
        <div className="ps-shield"><b className="toon">{level}</b></div>
        <div className="ps-who">
          <b className="toon">PULSE STRIKE</b>
          <div className="ps-xp"><div style={{ width: `${levelProgress(s.xp) * 100}%` }} /><span>{s.xp - lo} / {hi - lo} XP</span></div>
        </div>
      </div>

      <div className="ps-wallet">
        <Coins />
        <WalletButton onClick={() => go("market")} />
        <button className="ps-burger" onClick={() => setMenu((m) => !m)} aria-label="Меню"><i /><i /><i /></button>
        {menu && (
          <div className="ps-drop">
            <label>
              Чувствительность мыши <b>{s.settings.sens.toFixed(1)}</b>
              <input type="range" min="0.3" max="3" step="0.1" value={s.settings.sens} onChange={(e) => s.setSettings({ sens: Number(e.target.value) })} />
            </label>
            <label>
              Звуки <b>{Math.round(s.settings.sound * 100)}%</b>
              <input type="range" min="0" max="1" step="0.05" value={s.settings.sound} onChange={(e) => s.setSettings({ sound: Number(e.target.value) })} />
            </label>
            <label>
              Музыка <b>{Math.round(s.settings.music * 100)}%</b>
              <input type="range" min="0" max="1" step="0.05" value={s.settings.music} onChange={(e) => s.setSettings({ music: Number(e.target.value) })} />
            </label>
            {import.meta.env.DEV && <button className="ps-drop-item" onClick={() => s.unlockAll()} title="Для проверки: все оружие во всех скинах, все ножи и все агенты"><img src="/art/case.png" alt="" />Выдать все скины</button>}
          </div>
        )}
      </div>

      <nav className="ps-tiles">
        {TILES.map((t) => (
          <button key={t.page} className="ps-tile" onClick={() => go(t.page)}>
            <kbd>{t.key}</kbd>
            {dots[t.page] ? <i className="ps-dot">{typeof dots[t.page] === "number" ? dots[t.page] : ""}</i> : null}
            <img src={t.icon} alt="" draggable={false} />
            <span className="toon">{t.name}</span>
          </button>
        ))}
      </nav>

      <button className="ps-match" onClick={() => setPicker(true)}>
        <div className="ps-match-top"><span>● Бой</span><span>изменить</span></div>
        <div className="ps-match-body">
          {thumbs[s.arenaMap] ? <img src={thumbs[s.arenaMap]} alt="" draggable={false} /> : <div className="map-wait" />}
          <b className="toon">{mode.name}</b>
          <small className="toon">{mode.id === "range" ? "тренировка" : map.name}</small>
        </div>
        <div className="ps-match-foot">
          <span>{mode.hint}</span>
          {mode.teams && <span>сторона: в матче</span>}
        </div>
      </button>

      <button className="ps-agent" onClick={() => go("agents")}>
        <small style={{ color: RARITY[agent.rarity].color }}>Агент · {RARITY[agent.rarity].name}</small>
        <b className="toon">{agent.name}</b>
      </button>

      <button className="ps-passbar" onClick={() => go("pass")}>
        <img className="ps-passbar-icon" src="/art/icon_pass.png" alt="" draggable={false} />
        <div className="ps-passbar-main">
          <div className="ps-passbar-title">
            <b className="toon">Боевой пропуск</b>
            <i>{passLvl} / {SEASON.levels}</i>
            {s.premium && <em>премиум</em>}
          </div>
          <div className="ps-xp gold"><div style={{ width: `${passProgress(s.passXp) * 100}%` }} /><span>{passLvl >= SEASON.levels ? "пройден" : `${s.passXp % SEASON.xpPerLevel} / ${SEASON.xpPerLevel}`}</span></div>
        </div>
        <div className="ps-passbar-next">
          <small>{toClaim > 0 ? "награды ждут" : `уровень ${next}`}</small>
          <div>
            <RewardIcon r={PASS_FREE[next - 1]} />
            <RewardIcon r={PASS_PREMIUM[next - 1]} premium />
          </div>
        </div>
        {toClaim > 0 && <span className="ps-claim toon">Забрать · {toClaim}</span>}
      </button>

      <button className="ps-cta" onClick={() => { goFullscreen(); s.setScreen("arena"); }}>
        <b className="toon">В бой</b>
        <small>{mode.id === "range" ? mode.name : `${mode.name} · ${map.name}`}</small>
      </button>

      {picker && <MatchPicker thumbs={thumbs} onClose={() => setPicker(false)} />}
    </div>
  );
}

export function Menu() {
  const s = useStore();
  const [mode, setMode] = useState<Mode>("shooter");
  const [page, setPage] = useState<Page>("play");
  const level = levelOf(s.xp);
  const tick = s.tickCraft;

  // The workbench keeps working while the player is at the base.
  useEffect(() => {
    const t = setInterval(() => tick(0.1), 100);
    return () => clearInterval(t);
  }, [tick]);
  // The lobby tune plays in the menus; the first click starts it, since a page may not play uninvited.
  useEffect(() => {
    const start = (e: Event) => {
      music.play(true);
      const el = (e.target as HTMLElement).closest?.("button");
      if (el && e.type === "pointerdown") (el.classList.contains("ps-back") ? sfx.back : sfx.click)();
    };
    window.addEventListener("pointerdown", start);
    window.addEventListener("keydown", start);
    music.play(true);
    return () => {
      window.removeEventListener("pointerdown", start);
      window.removeEventListener("keydown", start);
      music.play(false);
    };
  }, []);
  // Escape goes back to the lobby from any page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape" && mode === "shooter" && page !== "play") setPage("play");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, page]);

  const open = (p: Page) => {
    setPage(p);
    if (p === "stash" || p === "craft" || p === "trade") useStore.setState({ tab: p });
  };
  const switchMode = (m: Mode) => {
    setMode(m);
    setPage(m === "shooter" ? "play" : "home");
  };
  const carried = [...s.hot, ...s.bag].filter((it) => !!it).length;
  const ready = s.contracts.filter((c) => c.progress > 0).length;

  if (mode === "shooter") {
    if (page === "play") return <div className="menu paint ps home"><Lobby go={open} /><Gift /></div>;
    return (
      <div className="menu paint ps" data-page={page}>
        <div className="menu-sky" />
        <header className="ps-head">
          <button className="ps-back" onClick={() => open("play")}><b className="toon">←</b><kbd>Esc</kbd></button>
          <h1 className="toon">{TITLES[page]}</h1>
          <div className="spacer" />
          <Coins />
          <WalletButton onClick={() => open("market")} />
        </header>
        {page === "shop" ? <Shop go={open} />
          : page === "inventory" ? <Arsenal key="skins" go={open} />
          : page === "agents" ? <Arsenal key="agents" start="agents" go={open} />
          : page === "cases" ? <Cases />
          : page === "market" ? <Market go={open} />
          : page === "quests" ? <QuestsPage go={open} />
          : <PassPage go={open} />}
      </div>
    );
  }

  return (
    <div className="menu">
      <div className="menu-sky" />
      <div className="menu-dunes" />
      <header className="topbar">
        <div className="brand">SURVIVAL</div>
        <div className="switch">
          <button className="btn small" onClick={() => switchMode("shooter")}>← PULSE STRIKE</button>
        </div>
        <div className="level">
          <span className="lvl">{level}</span>
          <div>
            <div className="lvl-label">{rankOf(level)}</div>
            <div className="xp"><div style={{ width: `${levelProgress(s.xp) * 100}%` }} /></div>
          </div>
        </div>
        <div className="spacer" />
        <span className="pill coins"><img src="/art/coin.png" alt="" />{s.salt}</span>
      </header>

      <nav className="side">
        {WORLD_PAGES.map(([p, name]) => (
          <button key={p} className={page === p ? "btn nav on" : "btn nav"} onClick={() => open(p)}>
            {name}
            {p === "trade" && ready > 0 && <i>{ready}</i>}
          </button>
        ))}
      </nav>

      {page === "home" ? (
        <main className="home">
          <div className="hero">
            <p className="kicker">Остров</p>
            <h1>Открытый мир</h1>
            <p className="lead">
              Высадка в случайной точке джунглей. Добывай, охоться, чисти РТ — и заверши миссию, чтобы вынести добычу на базу.
              Погибнешь — потеряешь всё, что было при тебе, кроме защищённого кармана.
            </p>
            <div className="loadout">
              <div className="loadout-title">С собой · {carried} предм. · защита {Math.round(armorProt(s.armor) * 100)}%</div>
              <div className="loadout-row">
                {s.hot.map((it, i) => (
                  <div key={i} className={it ? "slot" : "slot empty"} style={it ? { borderColor: itemColor(it) } : undefined} title={it ? ITEMS[it.id].name : ""}>
                    {it && <Icon id={it.id} />}
                    <span className="key">{i + 1}</span>
                  </div>
                ))}
              </div>
              <div className="loadout-note">
                {carried === 0 ? "Пусто: на старте выдадут арбалет, 12 болтов и рубило." : "Всё, что берёшь с собой, рискуешь потерять. Лишнее оставь на складе."}
              </div>
            </div>
          </div>
          <div className="play">
            <button className="btn play-btn" onClick={() => s.setScreen("game")}>
              В ОТКРЫТЫЙ МИР
              <small>PvE · остров, 5 РТ, звери</small>
            </button>
            <div className="keys">
              <span><kbd>WASD</kbd> ходьба</span><span><kbd>Shift</kbd> бег</span><span><kbd>ЛКМ</kbd> удар / огонь</span>
              <span><kbd>ПКМ</kbd> прицел</span><span><kbd>E</kbd> инвентарь</span><span><kbd>F</kbd> действие</span>
              <span><kbd>1</kbd>–<kbd>6</kbd> слоты</span><span><kbd>M</kbd> карта</span><span><kbd>H</kbd> завершить миссию</span>
              <span><kbd>Esc</kbd> пауза</span>
            </div>
          </div>
        </main>
      ) : page === "profile" ? (
        <Profile />
      ) : (
        <main className="stash">
          <Inventory />
        </main>
      )}
    </div>
  );
}
