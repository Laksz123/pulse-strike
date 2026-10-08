import { useEffect, useState } from "react";
import { AGENT_BY_ID } from "../arena/agents";
import { RARITY } from "../arena/markers";
import { SEASON, rewardName, rewardRarity, today, type Reward } from "../arena/pass";
import { agentIcon, markerIcon } from "../arena/render";
import { CASE_PACKS, COIN_PACKS, dailyOffers, untilRefresh, type Offer } from "../arena/shop";
import { buyCoins, useWallet } from "../solana/wallet";
import { useStore } from "../store";
import { useEscape } from "./Trade";

const art = (r: Reward) => (r.kind === "skin" ? markerIcon(r.id, r.skin) : r.kind === "agent" ? agentIcon(r.id) : "/art/case.png");
const PILE: Record<string, number> = { s: 1, m: 3, l: 5 };
const clock = (s: number) => `${Math.floor(s / 3600)} ч ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")} мин`;
const title = (r: Reward) => (r.kind === "agent" ? AGENT_BY_ID[r.id].name : rewardName(r));

function Price({ n, was }: { n: number; was?: number }) {
  return (
    <span className="s-price">
      {was && <s>{was}</s>}
      <img src="/art/coin.png" alt="" />
      <b>{n}</b>
    </span>
  );
}

type Ask = { key: string; name: string; sub: string; art: string; agent?: boolean; color: string; price: number; count?: number; buy(): void };

/** "Are you sure?" with the thing in front of you: every purchase for coins goes through this. */
function Confirm({ ask, onClose }: { ask: Ask; onClose(): void }) {
  const salt = useStore((s) => s.salt);
  const [done, setDone] = useState(false);
  useEscape(onClose);
  const poor = salt < ask.price;
  return (
    <div className="ps-modal" onClick={onClose}>
      <div className={done ? "ps-sheet buy done" : "ps-sheet buy"} style={{ ["--r" as string]: ask.color }} onClick={(e) => e.stopPropagation()}>
        <div className="b-stage">
          <div className="stage-rays" />
          <img className={ask.agent ? "agent" : ""} src={ask.art} alt="" draggable={false} />
          {ask.count && ask.count > 1 && <i className="b-count">×{ask.count}</i>}
        </div>
        <small style={{ color: ask.color }}>{ask.sub}</small>
        <h2 className="toon">{done ? "Куплено!" : ask.name}</h2>
        {done ? (
          <button className="pg-cta" onClick={onClose}><b className="toon">Отлично</b></button>
        ) : (
          <>
            <div className="b-wallet">У тебя <img src="/art/coin.png" alt="" /><b>{salt}</b>{poor ? <em> · не хватает {ask.price - salt}</em> : <> → останется <b>{salt - ask.price}</b></>}</div>
            <div className="b-actions">
              <button className="pg-btn" onClick={onClose}>Отмена</button>
              <button
                className="pg-cta green" disabled={poor}
                onClick={() => {
                  ask.buy();
                  setDone(true);
                }}
              >
                <b className="toon">Купить</b>
                <Price n={ask.price} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** The shop: today's offers, cases by the pack and coins for SOL. Everything here costs coins; nothing is sold back. */
export function Shop({ go }: { go?: (page: "pass" | "market" | "cases") => void }) {
  const s = useStore();
  const w = useWallet();
  const [left, setLeft] = useState(untilRefresh());
  const [ask, setAsk] = useState<Ask | null>(null);
  const day = today();
  const offers = dailyOffers(day);
  const bought = s.shop.day === day ? s.shop.bought : [];
  const deal = offers.find((o) => o.was) ?? offers[0];

  useEffect(() => {
    const t = setInterval(() => setLeft(untilRefresh()), 30000);
    return () => clearInterval(t);
  }, []);

  const owned = (r: Reward) => (r.kind === "agent" ? s.agents.some((a) => a.id === r.id) : r.kind === "skin" ? s.markers.some((m) => m.id === r.id && m.skin === r.skin) : false);
  const askOffer = (o: Offer) =>
    setAsk({
      key: o.key, name: title(o.reward), sub: `${o.reward.kind === "agent" ? "Агент" : "Скин"} · ${RARITY[rewardRarity(o.reward)].name}`, art: art(o.reward),
      agent: o.reward.kind === "agent", color: RARITY[rewardRarity(o.reward)].color, price: o.price, buy: () => s.buyOffer(o.key),
    });

  return (
    <main className="shop">
      <section className="s-hero">
        <button className="s-feature f-deal" style={{ ["--r" as string]: RARITY[rewardRarity(deal.reward)].color }} disabled={bought.includes(deal.key)} onClick={() => askOffer(deal)}>
          <div className="stage-rays" />
          <i className="s-ribbon big">Сделка дня −25%</i>
          <img className={deal.reward.kind === "agent" ? "agent" : ""} src={art(deal.reward)} alt="" draggable={false} />
          <div className="s-feature-text">
            <small>{deal.reward.kind === "agent" ? "Агент" : "Скин"} · {RARITY[rewardRarity(deal.reward)].name}</small>
            <b className="toon">{title(deal.reward)}</b>
            {bought.includes(deal.key) ? <span className="s-price done">Куплено</span> : <Price n={deal.price} was={deal.was} />}
          </div>
        </button>
        <button className="s-feature f-pass" onClick={() => go?.("pass")}>
          <img src="/art/icon_pass.png" alt="" draggable={false} />
          <div className="s-feature-text">
            <small>{SEASON.name}</small>
            <b className="toon">{s.premium ? "Премиум активен" : "Премиум-пропуск"}</b>
            <span className="s-price sol"><b>{s.premium ? "Смотреть награды" : `${SEASON.priceSol} SOL`}</b></span>
          </div>
        </button>
        <button className="s-feature f-trade" onClick={() => go?.("market")}>
          <img src="/art/icon_trade.png" alt="" draggable={false} />
          <div className="s-feature-text">
            <small>Игроки продают игрокам</small>
            <b className="toon">Маркет за SOL</b>
            <span className="s-price sol"><b>Открыть</b></span>
          </div>
        </button>
      </section>

      <section>
        <div className="s-head">
          <h2 className="toon">Предложения дня</h2>
          <span className="s-timer">⏱ новые через {clock(left)}</span>
        </div>
        <div className="s-row">
          {offers.map((o) => {
            const done = bought.includes(o.key);
            const rarity = RARITY[rewardRarity(o.reward)];
            return (
              <button key={o.key} className={`s-card${done ? " done" : ""}${o.was ? " deal" : ""}`} style={{ ["--r" as string]: rarity.color }} disabled={done} onClick={() => askOffer(o)}>
                {o.was && <i className="s-ribbon">−25%</i>}
                <small>{o.reward.kind === "agent" ? "Агент" : "Скин"} · {rarity.name}</small>
                <img className={o.reward.kind === "agent" ? "agent" : ""} src={art(o.reward)} alt="" draggable={false} />
                <b>{title(o.reward)}</b>
                {done ? <span className="s-price done">Куплено</span> : <Price n={o.price} was={o.was} />}
                {!done && owned(o.reward) && <em>уже есть такой</em>}
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <div className="s-head"><h2 className="toon">Кейсы</h2><span className="s-timer">внутри скин или агент · <button className="s-link" onClick={() => go?.("cases")}>шансы и открытие</button></span></div>
        <div className="s-row">
          {CASE_PACKS.map((p) => (
            <button
              key={p.n} className="s-card case" style={{ ["--r" as string]: "#2f9bff" }}
              onClick={() => setAsk({ key: `c${p.n}`, name: p.n === 1 ? "Кейс" : `Набор из ${p.n} кейсов`, sub: "Кейсы", art: "/art/case.png", color: "#2f9bff", price: p.price, count: p.n, buy: () => s.buyCases(p.n) })}
            >
              {p.tag && <i className="s-ribbon">{p.tag}</i>}
              <small>{p.n === 1 ? "Один кейс" : `Набор из ${p.n}`}</small>
              <div className="s-stack">
                {Array.from({ length: Math.min(3, p.n) }, (_, i) => <img key={i} src="/art/case.png" alt="" draggable={false} style={{ transform: `translate(${(i - (Math.min(3, p.n) - 1) / 2) * 34}px, ${Math.abs(i - 1) * 8}px) rotate(${(i - 1) * 8}deg)` }} />)}
              </div>
              <b>Кейс ×{p.n}</b>
              <Price n={p.price} />
            </button>
          ))}
        </div>
      </section>

      <section>
        <div className="s-head"><h2 className="toon">Монеты</h2><span className="s-timer">за SOL · Solana devnet{w.wallet ? "" : " · нужен кошелёк — подключается в маркете"}</span></div>
        <div className="s-row">
          {COIN_PACKS.map((p) => (
            <button key={p.id} className="s-card coins" style={{ ["--r" as string]: "#ffd21a" }} disabled={!!w.busy} onClick={() => void buyCoins(p.id)}>
              {p.tag && <i className="s-ribbon">{p.tag}</i>}
              <small>Монеты</small>
              <div className="s-stack">
                {Array.from({ length: PILE[p.id] }, (_, i) => <img key={i} src="/art/coin.png" alt="" draggable={false} style={{ transform: `translate(${(i - (PILE[p.id] - 1) / 2) * 22}px, ${(i % 2) * 10}px)`, width: 70, height: 70 }} />)}
              </div>
              <b>{p.coins.toLocaleString("ru")}</b>
              <span className="s-price sol"><b>{p.sol} SOL</b></span>
            </button>
          ))}
        </div>
        {w.error && <div className="t-error wide">{w.error}</div>}
      </section>
      {ask && <Confirm ask={ask} onClose={() => setAsk(null)} />}
    </main>
  );
}
