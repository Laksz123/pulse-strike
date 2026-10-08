import { useEffect, useMemo, useState } from "react";
import { AGENT_BY_ID } from "../arena/agents";
import { CASES, CASE_BY_ID, TIER_NAMES, caseArt, contents, dropName, dropRarity, dropWorth, rollFrom, type CaseDef, type Content, type Drop } from "../arena/cases";
import { MARKER_BY_ID, PATTERNS, RARITY } from "../arena/markers";
import { agentIcon, iconLater, iconReady } from "../arena/render";
import { sfx } from "../game/audio";
import { useStore, type CaseDrop } from "../store";
import { AgentCard, MarkerCard } from "./Arsenal";

const WIN_AT = 40;
const CARD = 148;
const BLANK = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
const sol = (n: number) => (n >= 0.1 ? n.toFixed(2) : n.toFixed(3)).replace(/0+$/, "").replace(/\.$/, "");

/** Which case to show when the page opens: set by whoever sends the player here for one in particular. */
let wanted: string | null = null;
export function showCase(id: string): void {
  wanted = id;
}

function Coin({ n }: { n: number }) {
  return <span className="cs-price"><img src="/art/coin.png" alt="" draggable={false} />{n}</span>;
}

/** One thing a case can give: its picture, rarity, chance and what it is worth. */
function DropCard({ c }: { c: Content }) {
  const d = c.drop;
  const rarity = RARITY[c.rarity];
  const [src, setSrc] = useState(() => (d.kind === "a" ? agentIcon(d.id) : iconReady(d.id, d.skin)));
  useEffect(() => {
    if (d.kind === "a") return setSrc(agentIcon(d.id));
    let on = true;
    setSrc(iconReady(d.id, d.skin));
    iconLater(d.id, d.skin, (url) => on && setSrc(url));
    return () => {
      on = false;
    };
  }, [d]);
  const name = d.kind === "a" ? AGENT_BY_ID[d.id].name : MARKER_BY_ID[d.id].name;
  const sub = d.kind === "a" ? "Агент" : c.blade ? "случайный скин" : PATTERNS[d.skin].name;
  return (
    <div className={`cs-drop${c.blade ? " blade" : ""}${d.kind === "a" ? " agent" : ""}`} style={{ ["--r" as string]: rarity.color }} title={dropName(d)}>
      <i className="cs-chance">{c.chance >= 1 ? c.chance.toFixed(1).replace(".0", "") : c.chance.toFixed(2)}%</i>
      {c.blade && <i className="cs-star">★</i>}
      <img className={src ? "" : "wait"} src={src ?? BLANK} alt="" draggable={false} />
      <b>{name}</b>
      <small>{sub}</small>
      <span className="cs-rar">{rarity.name}</span>
      <span className="cs-worth">≈ {sol(dropWorth(d))} SOL</span>
    </div>
  );
}

/** What is best about a case, in a few words. */
function promise(c: CaseDef): string {
  if (c.agents && c.agents.chance >= 20) return `агент · ${c.agents.chance}%`;
  if (c.knives) return `нож · ${c.knives.chance}%`;
  const top = Math.max(...contents(c).map((x) => x.rarity));
  return `до «${RARITY[top].name.toLowerCase()}»`;
}

function Grid({ onPick }: { onPick(id: string): void }) {
  const crates = useStore((s) => s.crates);
  const total = useStore((s) => s.cases);
  return (
    <main className="cs">
      <div className="cs-intro">
        <b>{total > 0 ? `У тебя кейсов: ${total}` : "Кейсов пока нет"}</b>
        <span>Нажми на кейс, чтобы посмотреть, что внутри, и открыть его. Кейсы дают за уровни, в боевом пропуске и продаются за монеты.</span>
      </div>
      <div className="cs-grid">
        {CASES.map((c) => {
          const own = crates[c.id] ?? 0;
          return (
            <button key={c.id} className={`cs-card t${c.tier}${own ? " own" : ""}`} style={{ ["--c" as string]: c.color }} onClick={() => { sfx.click(); onPick(c.id); }}>
              <i className="cs-tier">{TIER_NAMES[c.tier]}</i>
              {own > 0 && <i className="cs-own">×{own}</i>}
              <img src={caseArt(c.id)} alt="" draggable={false} />
              <b className="toon">{c.name}</b>
              <small>{promise(c)}</small>
              <Coin n={c.price} />
            </button>
          );
        })}
      </div>
    </main>
  );
}

const toDrop = (d: CaseDrop): Drop => (d.kind === "a" ? { kind: "a", id: d.item.id } : { kind: "w", id: d.item.id, skin: d.item.skin });

/** One case: what is in it on the right, the case and its buttons on the left, and the strip that spins when it is opened. */
function View({ id, onBack }: { id: string; onBack(): void }) {
  const c = CASE_BY_ID[id];
  const own = useStore((s) => s.crates[id] ?? 0);
  const coins = useStore((s) => s.salt);
  const openCase = useStore((s) => s.openCase);
  const buyCase = useStore((s) => s.buyCase);
  const inside = useMemo(() => contents(c), [c]);
  const [strip, setStrip] = useState<Drop[]>([]);
  const [spin, setSpin] = useState(0);
  const [won, setWon] = useState<CaseDrop | null>(null);
  const [busy, setBusy] = useState(false);
  const shares = useMemo(() => {
    const by = new Map<number, number>();
    for (const x of inside) by.set(x.blade ? 6 : x.rarity, (by.get(x.blade ? 6 : x.rarity) ?? 0) + x.chance);
    return [...by.entries()].sort((a, b) => a[0] - b[0]);
  }, [inside]);

  const open = () => {
    if (busy) return;
    // With none in hand, the button buys one and opens it.
    if (own <= 0 && !buyCase(id)) return;
    const drop = openCase(id);
    if (!drop) return;
    const items = Array.from({ length: WIN_AT + 6 }, () => rollFrom(c));
    items[WIN_AT] = toDrop(drop);
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
      if (dropRarity(toDrop(drop)) >= 3) sfx.rare();
      else sfx.pickup();
    }, 5400);
  };

  const wonDrop = won ? toDrop(won) : null;
  const wonRarity = wonDrop ? RARITY[dropRarity(wonDrop)] : null;
  const rolling = strip.length > 0;
  return (
    <main className="cs view" style={{ ["--c" as string]: c.color }}>
      <section className="cs-side">
        <button className="cs-back" onClick={() => { sfx.back(); onBack(); }}>← Все кейсы</button>
        <div className="cs-hero">
          <img className={busy ? "shake" : ""} src={caseArt(id)} alt="" draggable={false} />
        </div>
        <div className="cs-title">
          <i className={`cs-tier t${c.tier}`}>{TIER_NAMES[c.tier]}</i>
          <b className="toon">{c.name}</b>
        </div>
        <p>{c.about}</p>
        <div className="cs-bar" title="Шансы по редкости">
          {shares.map(([r, p]) => <i key={r} style={{ flex: p, background: r === 6 ? "#ffd21a" : RARITY[r].color }} />)}
        </div>
        <div className="cs-legend">
          {shares.map(([r, p]) => <span key={r} style={{ color: r === 6 ? "#ffd21a" : RARITY[r].color }}>{r === 6 ? "★ Нож" : RARITY[r].name} {p >= 10 ? Math.round(p) : p.toFixed(1)}%</span>)}
        </div>
        <button className="cs-open" disabled={busy || (own <= 0 && coins < c.price)} onClick={open}>
          <b className="toon">{own > 0 ? "Открыть" : "Купить и открыть"}</b>
          <small>{own > 0 ? `у тебя ×${own}` : coins < c.price ? `не хватает монет: нужно ${c.price}` : <><img src="/art/coin.png" alt="" /> {c.price}</>}</small>
        </button>
        <button className="cs-buy" disabled={busy || coins < c.price} onClick={() => buyCase(id)}>Купить ещё · <img src="/art/coin.png" alt="" /> {c.price}</button>
      </section>

      <section className="cs-inside">
        <div className="cs-head">
          <h2 className="toon">Содержимое</h2>
          <span>{inside.length} предметов · цена — оценка на маркете</span>
        </div>
        <div className="cs-drops">
          {inside.map((x, i) => <DropCard key={i} c={x} />)}
        </div>
      </section>

      {rolling && (
        <div className={won ? `cs-roll done r${dropRarity(wonDrop!)}` : "cs-roll"}>
          <div className="roulette">
            <div className="roulette-mark" />
            <div className="roulette-track" style={{ transform: `translateX(calc(50% - ${CARD / 2}px - ${spin}px))`, transition: spin ? "transform 5.2s cubic-bezier(0.08, 0.62, 0.12, 1)" : "none" }}>
              {strip.map((d, i) => {
                const sel = !!won && i === WIN_AT;
                return d.kind === "w" ? <MarkerCard key={i} id={d.id} skin={d.skin} selected={sel} /> : <AgentCard key={i} id={d.id} selected={sel} />;
              })}
            </div>
          </div>
          {won && wonDrop && wonRarity ? (
            <div className="cs-won" style={{ ["--r" as string]: wonRarity.color }}>
              <small>{wonRarity.name}</small>
              <b className="toon">{dropName(wonDrop)}</b>
              <span>№ {String(won.item.serial).padStart(4, "0")} · уже в инвентаре · на маркете ≈ {sol(dropWorth(wonDrop))} SOL</span>
              <div className="cs-won-actions">
                <button className="cs-open small" disabled={own <= 0 && coins < c.price} onClick={open}>
                  <b className="toon">{own > 0 ? `Открыть ещё · ×${own}` : `Ещё один · ${c.price}`}</b>
                </button>
                <button className="cs-buy" onClick={() => { setStrip([]); setWon(null); }}>Забрать</button>
              </div>
            </div>
          ) : (
            <div className="cs-won idle">Крутим…</div>
          )}
        </div>
      )}
    </main>
  );
}

/** The cases: ten kinds on one screen; inside each, what it holds and the button that opens it. */
export function Cases() {
  const [id, setId] = useState<string | null>(() => {
    const first = wanted && CASE_BY_ID[wanted] ? wanted : null;
    wanted = null;
    return first;
  });
  return id ? <View key={id} id={id} onBack={() => setId(null)} /> : <Grid onPick={setId} />;
}
