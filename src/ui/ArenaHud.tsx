import { useEffect, useState } from "react";
import { ARMOR_PRICE, TEAM_COLORS, type Arena } from "../arena/arena";
import { NADES, NADE_ORDER } from "../arena/grenades";
import { CAT_NAMES, CAT_ORDER, MARKERS, MARKER_BY_ID } from "../arena/markers";
import { agentIcon, markerIcon } from "../arena/render";
import { useArena } from "../arena/state";
import { levelOf, levelProgress, useStore } from "../store";
import { TOUCH } from "../device";
import { Radar } from "./Radar";
import { Touch, tapKey } from "./Touch";

const hex = (c: number) => `#${c.toString(16).padStart(6, "0")}`;
const clock = (t: number) => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
const MINE = hex(TEAM_COLORS[0]);
const THEIRS = hex(TEAM_COLORS[1]);

/** Re-renders while a timestamped effect is still fading. */
function useFlash(at: number, ms: number): boolean {
  const [, bump] = useState(0);
  useEffect(() => {
    if (!at) return;
    const t = setTimeout(() => bump((n) => n + 1), ms);
    return () => clearTimeout(t);
  }, [at, ms]);
  return at > 0 && performance.now() - at < ms;
}

/** Top of the screen: who is still standing on each side, the score and the clock. */
function Top() {
  const s = useArena();
  const [mine, theirs] = s.roster;
  const left = mine.filter((p) => p.alive).length;
  const right = theirs.filter((p) => p.alive).length;
  const planted = s.phase === "planted";
  return (
    <div className="a-top">
      <div className="a-side mine">
        <div className="a-pips">
          {mine.map((p, i) => <i key={i} className={`${p.alive ? "on" : ""}${p.you ? " you" : ""}`} style={{ background: p.alive ? MINE : undefined }} title={p.name} />)}
        </div>
        <div className="a-count" style={{ color: MINE }}><b>{left}</b><small>{s.teams ? "союзников" : "ты"}</small></div>
        <div className="a-pts" style={{ background: MINE }}>{s.score[0]}</div>
      </div>
      <div className={`a-clock${planted ? " bomb" : ""}${s.phase === "freeze" ? " freeze" : ""}`}>
        <b>{clock(s.time)}</b>
        <small>
          {s.phase === "freeze" ? "закупка" : planted ? "бомба заложена" : s.mode === "bomb" ? `раунд ${s.round} · ${s.attacking ? "атака" : "защита"}` : `${s.modeName} · до ${s.target}`}
        </small>
      </div>
      <div className="a-side theirs">
        <div className="a-pts" style={{ background: THEIRS }}>{s.score[1]}</div>
        <div className="a-count" style={{ color: THEIRS }}><b>{right}</b><small>{s.teams ? "противников" : "соперников"}</small></div>
        <div className="a-pips">
          {theirs.map((p, i) => <i key={i} className={p.alive ? "on" : ""} style={{ background: p.alive ? THEIRS : undefined }} title={p.name} />)}
        </div>
      </div>
    </div>
  );
}

function Reticle() {
  const hitAt = useArena((s) => s.hitAt);
  const headAt = useArena((s) => s.headAt);
  const killAt = useArena((s) => s.killAt);
  const scoped = useArena((s) => s.scoped);
  const charge = useArena((s) => s.charge);
  const dead = useArena((s) => s.dead);
  const hit = useFlash(hitAt, 180);
  const head = useFlash(headAt, 700);
  const kill = useFlash(killAt, 900);
  if (dead) return null;
  return (
    <>
      {scoped ? <div className="a-scope" /> : <div className="a-cross" />}
      {charge > 0.02 && <div className="a-charge" style={{ background: `conic-gradient(#fff ${charge * 360}deg, transparent 0)` }} />}
      {hit && <div className={kill ? "a-hit kill" : "a-hit"} />}
      {kill && <div className="a-killed">УБИЙСТВО{head && <small>в голову</small>}</div>}
    </>
  );
}

function Feed() {
  const feed = useArena((s) => s.feed);
  return (
    <div className="a-feed">
      {feed.map((f) => (
        <div key={f.id} className={`a-feedline t${f.tone}`}>
          <b style={{ color: f.killerColor }}>{f.killer}</b>
          <span>{f.weapon}{f.head ? " ◎" : ""}</span>
          <b style={{ color: f.victimColor }}>{f.victim}</b>
        </div>
      ))}
    </div>
  );
}

/** Bottom left: health, armour and match money. */
function Vitals() {
  const hp = useArena((s) => s.hp);
  const armor = useArena((s) => s.armor);
  const money = useArena((s) => s.money);
  const canBuy = useArena((s) => s.canBuy);
  return (
    <div className="a-vitals">
      <div className="a-money">$ {money > 90000 ? "∞" : money}{canBuy && <kbd>B</kbd>}</div>
      <div className="a-bars">
        <div className={hp <= 30 ? "a-hp low" : "a-hp"}>
          <b>{hp}</b>
          <div className="a-bar"><div style={{ width: `${hp}%` }} /></div>
        </div>
        <div className="a-armor">
          <b>{armor}</b>
          <div className="a-bar"><div style={{ width: `${armor}%` }} /></div>
        </div>
      </div>
    </div>
  );
}

function Loadout() {
  const s = useArena();
  const cur = s.slots[s.slot];
  return (
    <div className="a-load">
      {cur && (
        <div className="a-ammo">
          <span>{MARKER_BY_ID[cur.id].name}</span>
          {MARKER_BY_ID[cur.id].melee ? (TOUCH ? null : <small><kbd>ЛКМ</kbd> взмах · <kbd>ПКМ</kbd> удар · <kbd>F</kbd> осмотреть</small>) : (
            <>
              <b>{s.reloading ? "··" : s.mag}</b>
              <small>{s.reloading ? "перезарядка" : `/ ${s.reserve > 9000 ? "∞" : s.reserve}`}</small>
            </>
          )}
        </div>
      )}
      <div className="a-slots">
        {s.slots.map((it, i) => (
          <div key={i} className={`a-slot${i === s.slot ? " on" : ""}${it ? "" : " empty"}`} onPointerDown={(e) => { e.stopPropagation(); if (it) tapKey(`Digit${i + 1}`); }}>
            {it && <img src={markerIcon(it.id, it.skin)} alt="" draggable={false} />}
            <span>{i + 1}</span>
          </div>
        ))}
        {NADE_ORDER.map((k) => (s.nades[k] ?? 0) > 0 && (
          <div key={k} className={`a-slot nade ${k}`} title={NADES[k].name} onPointerDown={(e) => { e.stopPropagation(); tapKey(`Digit${NADES[k].key}`); }}>
            <b>{NADES[k].name}</b>
            <span>{NADES[k].key}</span>
          </div>
        ))}
        {s.hasBomb && <div className="a-slot bomb" onPointerDown={(e) => { e.stopPropagation(); tapKey("KeyG"); }}><b>💣</b><span>G</span></div>}
      </div>
    </div>
  );
}

/** Paint in the eyes: blots all over the screen that run and fade. */
function Blind() {
  const blind = useArena((s) => s.blind);
  const [, bump] = useState(0);
  const ms = blind ? 1400 + blind.amount * 3200 : 0;
  useEffect(() => {
    if (!blind) return;
    const t = setTimeout(() => bump((n) => n + 1), ms + 50);
    return () => clearTimeout(t);
  }, [blind, ms]);
  if (!blind || performance.now() - blind.at > ms) return null;
  const n = Math.round(4 + blind.amount * 7);
  return (
    <div key={blind.at} className="a-blind" style={{ animationDuration: `${ms}ms`, ["--paint" as string]: blind.color, ["--wash" as string]: String(Math.min(0.95, blind.amount * 1.1)) }}>
      {Array.from({ length: n }, (_, i) => {
        const r = (k: number) => Math.abs(Math.sin(blind.at * 0.001 * (i + 1) * k));
        const size = 26 + r(4.1) * 34;
        return (
          <i
            key={i}
            style={{
              left: `${r(1.3) * 100}%`, top: `${r(2.7) * 92}%`, width: `${size}vmin`, height: `${size * (0.8 + r(3.3) * 0.3)}vmin`,
              transform: `translate(-50%, -50%) rotate(${r(5.3) * 50 - 25}deg)`, background: i % 3 === 2 ? "#ffd21a" : undefined,
              borderRadius: `${40 + r(6.1) * 22}% ${60 - r(6.1) * 22}% ${45 + r(7.7) * 20}% ${55 - r(7.7) * 20}% / ${48 + r(8.3) * 18}% ${44 + r(9.1) * 20}% ${56 - r(9.1) * 20}% ${52 - r(8.3) * 18}%`,
            }}
          />
        );
      })}
    </div>
  );
}

/** What each hit took off, floating up beside the crosshair. */
function Damage() {
  const dmg = useArena((s) => s.dmg);
  return (
    <>
      {dmg.map((d) => (
        <b key={d.id} className={`a-dmg${d.head ? " head" : ""}${d.kill ? " kill" : ""}`} style={{ left: `calc(50% + ${24 + d.x * 46}px)`, top: `calc(50% - ${10 + d.x * 30}px)` }}>{d.n}</b>
      ))}
    </>
  );
}

function Marks() {
  const marks = useArena((s) => s.marks);
  return (
    <>
      {marks.map((m) => !m.off && (
        <div key={m.label} className={`a-mark ${m.tone}`} style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%` }}>
          <b><i>{m.label}</i></b>
          <small>{m.dist} м</small>
        </div>
      ))}
    </>
  );
}

function Prompt() {
  const hint = useArena((s) => s.hint);
  const action = useArena((s) => s.action);
  const banner = useArena((s) => s.banner);
  return (
    <>
      {banner && (
        <div className={`a-banner t${banner.tone}`}>
          <b>{banner.title}</b>
          <span>{banner.sub}</span>
        </div>
      )}
      {action ? (
        <div className="a-action">
          <span>{action.label}</span>
          <div className="a-bar"><div style={{ width: `${Math.min(1, action.progress) * 100}%` }} /></div>
        </div>
      ) : hint ? <div className="a-hint">{TOUCH ? hint.replace("Удерживай E — ", "Удерживай кнопку: ").replace("E — ", "").replace(" · G — бросить", "") : hint}</div> : null}
    </>
  );
}

function Xp() {
  const xp = useStore((s) => s.xp);
  const toasts = useStore((s) => s.toasts);
  return (
    <>
      <div className="a-xp">
        <span className="lvl">{levelOf(xp)}</span>
        <div className="xp"><div style={{ width: `${levelProgress(xp) * 100}%` }} /></div>
      </div>
      <div className="toasts">
        {toasts.map((t) => <div key={t.id} className="toast" style={{ color: t.color }}>{t.text}</div>)}
      </div>
    </>
  );
}

function Board() {
  const board = useArena((s) => s.board);
  const teams = useArena((s) => s.teams);
  const groups = teams ? [board.filter((r) => r.team === 0), board.filter((r) => r.team !== 0)] : [[...board].sort((a, b) => b.kills - a.kills)];
  return (
    <div className="a-board">
      {groups.map((rows, g) => (
        <div key={g} className="a-board-team">
          <div className="a-board-head" style={teams ? { color: g === 0 ? MINE : THEIRS } : undefined}>
            <span>{teams ? (g === 0 ? "Твоя команда" : "Противники") : "Игрок"}</span><span>У</span><span>С</span><span>$</span>
          </div>
          {rows.map((r, i) => (
            <div key={i} className={`a-row${r.you ? " you" : ""}${r.alive ? "" : " out"}`}>
              <span><img src={agentIcon(r.agent)} alt="" />{r.name}</span>
              <b>{r.kills}</b>
              <span>{r.deaths}</span>
              <span>{r.money}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** The shop between rounds: every weapon in the game, bought with match money. */
function Buy({ arena }: { arena: React.RefObject<Arena | null> }) {
  const money = useArena((s) => s.money);
  const armor = useArena((s) => s.armor);
  const slots = useArena((s) => s.slots);
  const time = useArena((s) => s.time);
  const phase = useArena((s) => s.phase);
  const canBuy = useArena((s) => s.canBuy);
  const range = useArena((s) => s.range);
  const nades = useArena((s) => s.nades);
  const markers = useStore((s) => s.markers);
  const equipped = useStore((s) => s.equipped);
  const [tip, setTip] = useState(MARKERS[2].id);
  const skinOf = (id: string) => markers.find((m) => m.uid === equipped[id])?.skin ?? 0;
  const has = (id: string) => slots.some((x) => x?.id === id);
  const def = MARKER_BY_ID[tip];
  return (
    <div className="overlay a-buy-wrap" style={{ pointerEvents: "auto" }} onClick={() => arena.current?.closeBuy()}>
      <div className="a-buy" onClick={(e) => e.stopPropagation()}>
        <div className="a-buy-head">
          <h2>Закупка</h2>
          <span className="a-buy-money">{range ? "всё бесплатно" : `$ ${money}`}</span>
          {phase === "freeze" && <span className="a-buy-time">до начала раунда {time} с</span>}
          {!canBuy && <span className="a-buy-time">время закупки вышло</span>}
          <span className="spacer" />
          <button className="btn small" onClick={() => arena.current?.closeBuy()}>{TOUCH ? "Готово" : "Готово · B"}</button>
        </div>
        <div className="a-buy-cols">
          {(["side", ...CAT_ORDER] as const).map((cat) => {
            const list = MARKERS.filter((d) => (cat === "side" ? d.side : !d.side && d.cat === cat));
            return (
              <div key={cat} className="a-buy-col">
                <h3>{cat === "side" ? "Пистолеты" : CAT_NAMES[cat]}</h3>
                {list.map((d) => (
                  <button
                    key={d.id} className={`a-buy-item${has(d.id) ? " own" : ""}${!range && money < d.price && !has(d.id) ? " poor" : ""}`}
                    onMouseEnter={() => setTip(d.id)} onClick={() => arena.current?.buy(d.id)}
                  >
                    <img src={markerIcon(d.id, skinOf(d.id))} alt="" draggable={false} />
                    <span>{d.name}</span>
                    <b>{has(d.id) ? "есть" : d.price && !range ? `$ ${d.price}` : "бесплатно"}</b>
                  </button>
                ))}
                {cat === "side" && !range && NADE_ORDER.map((k) => (
                  <button key={k} className={`a-buy-item nade ${k}${(nades[k] ?? 0) > 0 ? " own" : ""}${money < NADES[k].price && !(nades[k] ?? 0) ? " poor" : ""}`} onClick={() => arena.current?.buyNade(k)} title={NADES[k].about}>
                    <div className="a-buy-shield"><i /></div>
                    <span>{NADES[k].name} · {NADES[k].key}</span>
                    <b>{(nades[k] ?? 0) > 0 ? "есть" : `$ ${NADES[k].price}`}</b>
                  </button>
                ))}
                {cat === "side" && (
                  <button className={`a-buy-item armor${armor >= 100 ? " own" : ""}${money < ARMOR_PRICE && armor < 100 ? " poor" : ""}`} onClick={() => arena.current?.buyArmor()}>
                    <div className="a-buy-shield">🛡</div>
                    <span>Броня</span>
                    <b>{armor >= 100 ? "есть" : `$ ${ARMOR_PRICE}`}</b>
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <div className="a-buy-tip">
          <b>{def.name}</b>
          <span>{def.trick}</span>
          <small>урон {def.dmg}{def.pellets > 1 ? ` × ${def.pellets}` : ""} · в голову ×{def.head} · магазин {def.mag} · {def.rpm} выстр./мин</small>
        </div>
      </div>
    </div>
  );
}

/** The two sides to choose from: on entering a match, and again on M. */
function TeamPick({ arena }: { arena: React.RefObject<Arena | null> }) {
  const first = useArena((s) => s.teamFirst);
  const attacking = useArena((s) => s.attacking);
  const bomb = useArena((s) => s.mode) === "bomb";
  const modeName = useArena((s) => s.modeName);
  const mapName = useArena((s) => s.mapName);
  const here = (side: boolean) => !first && attacking === side;
  return (
    <div className={first ? "a-teams first" : "a-teams"} style={{ pointerEvents: "auto" }}>
      <small className="toon">{modeName} · {mapName}</small>
      <h2 className="toon">Выбери сторону</h2>
      <div className="a-teams-row">
        <button className={here(true) ? "a-team attack on" : "a-team attack"} onClick={() => arena.current?.chooseTeam("attack")}>
          <kbd>1</kbd>
          {here(true) && <i>вы здесь</i>}
          <svg viewBox="0 0 64 64" aria-hidden>
            <path d="M38 25 46 16" stroke="#0b1022" strokeWidth="7" strokeLinecap="round" />
            <circle cx="27" cy="38" r="19" fill="#0b1022" />
            <circle cx="20" cy="31" r="5" fill="#fff" opacity="0.35" />
            <path d="M49 13l4-7M51 16l8-2M47 11l-2-8" stroke="#ffd21a" strokeWidth="4.5" strokeLinecap="round" />
          </svg>
          <b className="toon">Атака</b>
          <span>{bomb ? "Заложить бомбу на A или B и не дать её обезвредить" : "Старт на западной стороне карты"}</span>
        </button>
        <button className={here(false) ? "a-team defend on" : "a-team defend"} onClick={() => arena.current?.chooseTeam("defend")}>
          <kbd>2</kbd>
          {here(false) && <i>вы здесь</i>}
          <svg viewBox="0 0 64 64" aria-hidden>
            <path d="M32 6 54 14v18c0 14-10 22-22 26C20 54 10 46 10 32V14Z" fill="#fff" stroke="#0b1022" strokeWidth="5" strokeLinejoin="round" />
            <path d="M32 15 45 20v12c0 9-6 14-13 17Z" fill="#2a6fe0" />
          </svg>
          <b className="toon">Защита</b>
          <span>{bomb ? "Не пустить атаку на точки или обезвредить бомбу" : "Старт на восточной стороне карты"}</span>
        </button>
      </div>
      <div className="a-teams-foot">
        <button className="a-team-auto" onClick={() => arena.current?.chooseTeam("auto")}><kbd>3</kbd>{first ? "Авто-выбор" : "Остаться"}</button>
        {!first && <span>{bomb ? "Смена стороны сработает со следующего раунда" : "Смена стороны сработает сразу"} · <kbd>M</kbd> или <kbd>Esc</kbd> — закрыть</span>}
      </div>
    </div>
  );
}

export function ArenaHud({ arena, onAgain }: { arena: React.RefObject<Arena | null>; onAgain(): void }) {
  const teamPick = useArena((s) => s.teamPick);
  const teamFirst = useArena((s) => s.teamFirst);
  const respawn = useArena((s) => s.respawn);
  const dead = useArena((s) => s.dead);
  const killedBy = useArena((s) => s.killedBy);
  const spectating = useArena((s) => s.spectating);
  const showBoard = useArena((s) => s.showBoard);
  const result = useArena((s) => s.result);
  const paused = useArena((s) => s.paused);
  const buyOpen = useArena((s) => s.buyOpen);
  const teams = useArena((s) => s.teams);
  const mapName = useArena((s) => s.mapName);
  const modeName = useArena((s) => s.modeName);
  const score = useArena((s) => s.score);
  const mode = useArena((s) => s.mode);
  const hurtAt = useArena((s) => s.hurtAt);
  const hp = useArena((s) => s.hp);
  const range = useArena((s) => s.range);
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const setScreen = useStore((s) => s.setScreen);
  const hurt = useFlash(hurtAt, 450);
  // Before a side is chosen there is no match yet: only the choice, over the map.
  if (teamPick && teamFirst) {
    return (
      <div className="hud a-hud">
        <TeamPick arena={arena} />
      </div>
    );
  }
  return (
    <div className="hud a-hud">
      {TOUCH && !result && !paused && !buyOpen && !teamPick && <Touch arena={arena} />}
      {!range && <Radar />}
      {teamPick && !result && <TeamPick arena={arena} />}
      <Marks />
      <Reticle />
      <Damage />
      <Blind />
      {range ? <div className="a-range"><b>Полигон</b>{!TOUCH && <span><kbd>B</kbd> любое оружие · <kbd>3</kbd> нож · <kbd>4</kbd> Клякса · <kbd>5</kbd> Пена · <kbd>6</kbd> Лава · <kbd>Esc</kbd> выход</span>}</div> : <Top />}
      <Feed />
      <Vitals />
      <Loadout />
      <Xp />
      <Prompt />
      {(hurt || (hp <= 30 && !dead)) && <div className={hurt ? "a-hurt on" : "a-hurt"} />}
      {dead && !result && (
        <div className="a-dead">
          <small>тебя убил</small>
          <b>{killedBy}</b>
          <span>{respawn > 0 ? `Возврат через ${respawn.toFixed(1)} с` : spectating ? `Наблюдение: ${spectating}` : "Ждём конца раунда"}</span>
        </div>
      )}
      {showBoard && !result && <Board />}
      {buyOpen && !result && <Buy arena={arena} />}
      {paused && !result && !buyOpen && (
        <div className="overlay" style={{ pointerEvents: "auto" }} onClick={() => arena.current?.lock()}>
          <div className="pause" onClick={(e) => e.stopPropagation()}>
            <h2>Пауза</h2>
            <p className="hint">{modeName} · {mapName}</p>
            <button className="btn primary" onClick={() => arena.current?.lock()}>Продолжить</button>
            {TOUCH ? (
              <>
                <label className="setting">
                  Скорость поворота <b>{settings.touchSens.toFixed(1)}</b>
                  <input type="range" min="0.3" max="3" step="0.1" value={settings.touchSens} onChange={(e) => setSettings({ touchSens: Number(e.target.value) })} />
                </label>
                <label className="setting row">
                  <input type="checkbox" checked={settings.autoFire} onChange={(e) => setSettings({ autoFire: e.target.checked })} />
                  Автоогонь: стреляет сам, когда прицел на противнике
                </label>
              </>
            ) : (
              <label className="setting">
                Чувствительность мыши <b>{settings.sens.toFixed(1)}</b>
                <input type="range" min="0.3" max="3" step="0.1" value={settings.sens} onChange={(e) => setSettings({ sens: Number(e.target.value) })} />
              </label>
            )}
            {teams && !range && (
              <button className="btn" onClick={() => { arena.current?.lock(); arena.current?.openTeams(); }}>Сменить сторону</button>
            )}
            <label className="setting">
              Звуки <b>{Math.round(settings.sound * 100)}%</b>
              <input type="range" min="0" max="1" step="0.05" value={settings.sound} onChange={(e) => setSettings({ sound: Number(e.target.value) })} />
            </label>
            <button className="btn danger" onClick={() => arena.current?.leave()}>Выйти в главное меню</button>
            <p className="hint" hidden={TOUCH}>
              <kbd>ЛКМ</kbd> огонь · <kbd>ПКМ</kbd> прицел · <kbd>R</kbd> перезарядка · <kbd>1</kbd> <kbd>2</kbd> <kbd>Q</kbd> оружие · <kbd>3</kbd> нож · <kbd>F</kbd> осмотреть<br />
              <kbd>B</kbd> закупка · <kbd>4</kbd> <kbd>5</kbd> <kbd>6</kbd> гранаты · <kbd>E</kbd> заложить / обезвредить / подобрать · <kbd>G</kbd> бросить бомбу · <kbd>M</kbd> сменить сторону · <kbd>Tab</kbd> таблица
            </p>
          </div>
        </div>
      )}
      {result && (
        <div className={result.won ? "overlay win" : "overlay"} style={{ pointerEvents: "auto" }}>
          <div className="pause debrief">
            <h2>{teams ? (result.won ? "Победа" : score[0] === score[1] ? "Ничья" : "Поражение") : `Место: ${result.place}`}</h2>
            {mode !== "ffa" && <p className="a-final"><b style={{ color: MINE }}>{score[0]}</b> : <b style={{ color: THEIRS }}>{score[1]}</b></p>}
            <div className="stat-row">
              <div><b>{result.kills}</b>убийств</div>
              <div><b>{result.deaths}</b>смертей</div>
              <div><b>+{result.xp}</b>опыта</div>
              <div><b>+{result.coins}</b>монет</div>
              {result.cases > 0 && <div className="gold"><b>+{result.cases}</b>кейсов</div>}
            </div>
            <Board />
            <div className="actions">
              <button className="btn primary" onClick={onAgain}>Ещё матч</button>
              <button className="btn" onClick={() => setScreen("menu")}>В меню{result.cases > 0 ? " · открыть кейсы" : ""}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
