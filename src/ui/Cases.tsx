import { useMemo, useState } from "react";
import { AGENT_BY_ID, AGENT_CHANCE, rollAgent } from "../arena/agents";
import { CASE_ODDS, CASE_PRICE, KNIFE_CHANCE, PATTERN_ODDS, RARITY, itemName, itemRarity, rollCase } from "../arena/markers";
import { sfx } from "../game/audio";
import { levelOf, levelProgress, useStore, type CaseDrop } from "../store";
import { AgentCard, MarkerCard } from "./Arsenal";

const WIN_AT = 40;
const CARD = 148;
const roll = (): CaseDrop => (Math.random() * 100 < AGENT_CHANCE ? { kind: "a", item: rollAgent() } : { kind: "w", item: rollCase() });
const rarityOf = (d: CaseDrop) => (d.kind === "w" ? itemRarity(d.item) : AGENT_BY_ID[d.item.id].rarity);

/** Cases: one free for every level, more for coins and from the pass. A spinning strip stops on what you got. */
export function Cases() {
  const s = useStore();
  const [strip, setStrip] = useState<CaseDrop[]>([]);
  const [spin, setSpin] = useState(0);
  const [won, setWon] = useState<CaseDrop | null>(null);
  const [busy, setBusy] = useState(false);
  const filler = useMemo(() => Array.from({ length: 9 }, roll), []);

  const open = () => {
    if (busy) return;
    const drop = s.openCase();
    if (!drop) return;
    const items = Array.from({ length: WIN_AT + 6 }, roll);
    items[WIN_AT] = drop;
    setWon(null);
    setBusy(true);
    setStrip(items);
    setSpin(0);
    sfx.open();
    // Let the strip render at its start position, then send it sliding.
    requestAnimationFrame(() => requestAnimationFrame(() => setSpin(WIN_AT * CARD + (Math.random() - 0.5) * (CARD - 30))));
    setTimeout(() => {
      setWon(drop);
      setBusy(false);
      if (rarityOf(drop) >= 3) sfx.rare();
      else sfx.pickup();
    }, 5400);
  };

  const shown = strip.length ? strip : filler;
  const wonRarity = won ? RARITY[rarityOf(won)] : null;
  return (
    <main className="cases">
      <section className="case-top">
        <img className={busy ? "case-art shake" : "case-art"} src="/art/case.png" alt="" />
        <div>
          <h2>Кейсы</h2>
          <p className="hint">Кейс за каждый новый уровень и за уровни боевого пропуска. Внутри — скин на оружие или агент. Всё, что выпало, твоё: надень или выставь на маркет за SOL.</p>
        </div>
        <div className="case-count"><b>{s.cases}</b>кейсов</div>
        <div className="case-level">
          <span>Уровень {levelOf(s.xp)}</span>
          <div className="bar"><div style={{ width: `${levelProgress(s.xp) * 100}%` }} /></div>
          <small>до следующего кейса</small>
        </div>
      </section>

      <section className={won ? `roulette done r${rarityOf(won)}` : "roulette"}>
        <div className="roulette-mark" />
        <div
          className="roulette-track"
          // Before the first spin the strip sits centred on its sample cards.
          style={{ transform: `translateX(calc(50% - ${CARD / 2}px - ${strip.length ? spin : 4 * CARD}px))`, transition: spin ? "transform 5.2s cubic-bezier(0.08, 0.62, 0.12, 1)" : "none" }}
        >
          {shown.map((d, i) => {
            const sel = !!won && i === WIN_AT && strip.length > 0;
            return d.kind === "w" ? <MarkerCard key={i} id={d.item.id} skin={d.item.skin} selected={sel} /> : <AgentCard key={i} id={d.item.id} selected={sel} />;
          })}
        </div>
      </section>

      <section className="case-actions">
        {won && wonRarity ? (
          <div className="case-won" style={{ borderColor: wonRarity.color }}>
            <small style={{ color: wonRarity.color }}>{wonRarity.name}</small>
            <b>{won.kind === "w" ? itemName(won.item) : `Агент ${AGENT_BY_ID[won.item.id].name}`}</b>
            <span>№ {String(won.item.serial).padStart(4, "0")} · уже в инвентаре · можно выставить на маркет за SOL</span>
          </div>
        ) : (
          <div className="case-won idle">{busy ? "Крутим…" : "Открой кейс — и лента покажет, что выпало"}</div>
        )}
        <button className="btn play-btn" disabled={busy || s.cases <= 0} onClick={open}>
          ОТКРЫТЬ КЕЙС
          <small>{s.cases > 0 ? `осталось ${s.cases}` : "кейсов нет: играй или купи"}</small>
        </button>
        <button className="btn buy" disabled={s.salt < CASE_PRICE} onClick={() => s.buyCases(1)}>Купить кейс · <img src="/art/coin.png" alt="" /> {CASE_PRICE}</button>
      </section>

      <section className="odds">
        <h3>Шансы</h3>
        <div className="odds-row">
          <span>Оружие</span>
          {CASE_ODDS.map((p, i) => <i key={i} style={{ color: RARITY[i].color }}>{RARITY[i].name} {p}%</i>)}
        </div>
        <div className="odds-row">
          <span>Скин</span>
          {PATTERN_ODDS.map((p, i) => <i key={i} style={{ color: RARITY[i].color }}>{RARITY[i].name} {p}%</i>)}
        </div>
        <div className="odds-row">
          <span>Нож</span>
          <i style={{ color: RARITY[5].color }}>★ вместо скина — {KNIFE_CHANCE}% кейсов</i>
        </div>
        <div className="odds-row">
          <span>Агент</span>
          <i>вместо скина — {AGENT_CHANCE}% кейсов</i>
        </div>
      </section>
    </main>
  );
}
