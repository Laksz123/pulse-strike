import { useEffect, useState } from "react";
import { AGENT_BY_ID } from "../arena/agents";
import { MARKER_BY_ID, PATTERNS, RARITY, itemRarity } from "../arena/markers";
import { CLUSTER, LIST_FEE_SOL, MARKET_FEE, explorer, hasPhantom, onProgram, short, sol, type Listing } from "../solana/chain";
import { buy, connect, disconnect, faucet, loadBook, refreshBalance, sell, useWallet } from "../solana/wallet";
import { useStore } from "../store";
import { AgentCard, MarkerCard } from "./Arsenal";

export type Thing = { kind: "w" | "a"; id: string; skin: number };

export const thingName = (t: Thing) => (t.kind === "w" ? `${MARKER_BY_ID[t.id].name} | ${PATTERNS[t.skin].name}` : AGENT_BY_ID[t.id].name);
export const thingRarity = (t: Thing) => RARITY[t.kind === "w" ? itemRarity(t) : AGENT_BY_ID[t.id].rarity];
export const thingValid = (t: Thing) => (t.kind === "w" ? !!MARKER_BY_ID[t.id] && !!PATTERNS[t.skin] : !!AGENT_BY_ID[t.id]);
const fmt = (n: number) => Number(n.toFixed(4)).toString();

export function ThingCard({ t, tag, onClick, selected }: { t: Thing; tag?: string; onClick?(): void; selected?: boolean }) {
  return t.kind === "w" ? <MarkerCard id={t.id} skin={t.skin} tag={tag} onClick={onClick} selected={selected} /> : <AgentCard id={t.id} tag={tag} onClick={onClick} selected={selected} />;
}

/** The wallet in one line: who is connected and what they have; or two ways to connect. */
export function WalletChip() {
  const w = useWallet();
  const [phantom, setPhantom] = useState(hasPhantom());
  // Phantom injects itself a moment after the page loads.
  useEffect(() => {
    const t = setTimeout(() => setPhantom(hasPhantom()), 800);
    return () => clearTimeout(t);
  }, []);
  if (!w.wallet) {
    return (
      <div className="w-chip off">
        <span>Кошелёк не подключён · Solana {CLUSTER}</span>
        <button className="pg-btn sol" disabled={!phantom || !!w.busy} onClick={() => void connect("phantom")}>{phantom ? "Phantom" : "Phantom не найден"}</button>
        <button className="pg-btn" disabled={!!w.busy} onClick={() => void connect("burner")} title="Создаётся прямо здесь и хранится в этом браузере: чтобы попробовать без расширения">Тестовый кошелёк</button>
      </div>
    );
  }
  return (
    <div className="w-chip">
      <i className="w-dot" />
      <code title={w.wallet.address}>{short(w.wallet.address)}</code>
      <b>{w.balance === null ? "…" : fmt(w.balance)} SOL</b>
      <button className="pg-btn small" disabled={!!w.busy} onClick={() => void faucet()} title="Попросить тестовые SOL у крана devnet">+ SOL</button>
      <button className="pg-btn small" onClick={() => void refreshBalance()} title="Обновить баланс">↻</button>
      <button className="pg-btn small" onClick={() => void navigator.clipboard?.writeText(w.wallet!.address)} title="Скопировать адрес">⧉</button>
      <button className="pg-btn small" onClick={disconnect} title="Отключить">✕</button>
    </div>
  );
}

function Connect() {
  const w = useWallet();
  return (
    <div className="t-connect">
      <span>Чтобы торговать, нужен кошелёк Solana ({CLUSTER}).</span>
      <div>
        <button className="pg-btn sol" disabled={!hasPhantom() || !!w.busy} onClick={() => void connect("phantom")}>{hasPhantom() ? "Подключить Phantom" : "Phantom не найден"}</button>
        <button className="pg-btn" disabled={!!w.busy} onClick={() => void connect("burner")}>Тестовый кошелёк</button>
      </div>
    </div>
  );
}

/** Escape closes the sheet on top, and only that: the page underneath stays where it is. */
export function useEscape(onClose: () => void): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Escape") return;
      e.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);
}

const QUICK = [0.01, 0.05, 0.1, 0.25, 0.5, 1];

/** Put an item up for sale: pick a price, see exactly what you will get, confirm. */
export function SellSheet({ kind, uid, onClose, onMarket }: { kind: "w" | "a"; uid: string; onClose(): void; onMarket?(): void }) {
  const s = useStore();
  const w = useWallet();
  const [price, setPrice] = useState(0.05);
  const [sent, setSent] = useState<Thing | null>(null);
  useEscape(onClose);
  const weapon = kind === "w" ? s.markers.find((m) => m.uid === uid) : undefined;
  const agent = kind === "a" ? s.agents.find((a) => a.uid === uid) : undefined;
  const live: Thing | null = weapon ? { kind, id: weapon.id, skin: weapon.skin } : agent ? { kind, id: agent.id, skin: 0 } : null;
  const serial = weapon?.serial ?? agent?.serial ?? 0;
  const t = sent ?? live;

  useEffect(() => {
    if (!useWallet.getState().book) void loadBook();
  }, []);
  if (!t) return null;
  const same = (w.book?.open ?? []).filter((l) => l.kind === t.kind && l.id === t.id && l.skin === t.skin).map((l) => sol(l.lamports));
  const floor = same.length ? Math.min(...same) : null;
  const ok = price >= 0.001;
  const step = (d: number) => setPrice((p) => Math.max(0.001, Number((p + d).toFixed(4))));

  return (
    <div className="ps-modal" onClick={onClose}>
      <div className="ps-sheet trade" onClick={(e) => e.stopPropagation()}>
        {sent ? (
          <div className="t-done">
            <i>✓</i>
            <h2 className="toon">Лот выставлен</h2>
            <p>{thingName(t)} теперь на маркете за <b>{fmt(price)} SOL</b>. Когда его купят, SOL придут на твой кошелёк сами.</p>
            {w.lastSig && <a href={explorer(w.lastSig)} target="_blank" rel="noreferrer">Транзакция в сети ↗</a>}
            <div className="t-actions">
              {onMarket && <button className="pg-btn" onClick={onMarket}>К моим лотам</button>}
              <button className="pg-cta" onClick={onClose}><b className="toon">Готово</b></button>
            </div>
          </div>
        ) : (
          <>
            <div className="t-head">
              <h2 className="toon">Продать на маркете</h2>
              <button className="pg-x" onClick={onClose}>✕</button>
            </div>
            <div className="t-body">
              <div className="t-item">
                <ThingCard t={t} />
                <small style={{ color: thingRarity(t).color }}>{thingRarity(t).name}</small>
                <span>серийный № {String(serial).padStart(4, "0")}</span>
              </div>
              <div className="t-form">
                <label>Цена</label>
                <div className="t-price">
                  <button onClick={() => step(-0.01)}>−</button>
                  <input type="number" min="0.001" step="0.01" value={price} onChange={(e) => setPrice(Math.max(0, Number(e.target.value)))} />
                  <span>SOL</span>
                  <button onClick={() => step(0.01)}>+</button>
                </div>
                <div className="t-quick">
                  {QUICK.map((q) => <button key={q} className={price === q ? "on" : ""} onClick={() => setPrice(q)}>{q}</button>)}
                </div>
                <div className="t-floor">
                  {floor === null
                    ? "Таких на маркете сейчас нет: цену задаёшь ты."
                    : <>Самый дешёвый такой же сейчас — <b>{fmt(floor)} SOL</b>. <button onClick={() => setPrice(Math.max(0.001, Number((floor * 0.95).toFixed(4))))}>Поставить на 5% дешевле</button></>}
                </div>
                <div className="t-rows">
                  <div><span>Покупатель заплатит</span><b>{fmt(price)} SOL</b></div>
                  <div><span>Комиссия площадки {MARKET_FEE * 100}%</span><b>− {fmt(price * MARKET_FEE)} SOL</b></div>
                  <div className="total"><span>Ты получишь</span><b>{fmt(price * (1 - MARKET_FEE))} SOL</b></div>
                  <div className="dim"><span>{onProgram() ? "Залог за лот, вернётся" : "Сбор за выставление, сразу"}</span><b>{onProgram() ? "≈ 0.002" : LIST_FEE_SOL} SOL</b></div>
                </div>
                {!w.wallet && <Connect />}
                {w.error && <div className="t-error">{w.error}</div>}
                <button
                  className="pg-cta sol" disabled={!w.wallet || !!w.busy || !ok}
                  onClick={async () => {
                    if (await sell(kind, uid, price)) setSent(t);
                  }}
                >
                  <b className="toon">{w.busy || `Выставить за ${fmt(price)} SOL`}</b>
                </button>
                <p className="t-note">Пока лот на продаже, предмет лежит на маркете, а не в инвентаре. Снять лот можно в любой момент.</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Buy someone's lot: what it is, who sells it, where the money goes. */
export function BuySheet({ l, onClose, onInventory }: { l: Listing; onClose(): void; onInventory?(): void }) {
  const w = useWallet();
  const [done, setDone] = useState(false);
  useEscape(onClose);
  const t: Thing = { kind: l.kind, id: l.id, skin: l.skin };
  const price = sol(l.lamports);
  const short_ = w.balance !== null && w.balance < price + 0.001;
  return (
    <div className="ps-modal" onClick={onClose}>
      <div className="ps-sheet trade" onClick={(e) => e.stopPropagation()}>
        {done ? (
          <div className="t-done">
            <i>✓</i>
            <h2 className="toon">Куплено</h2>
            <p>{thingName(t)} уже в инвентаре.</p>
            {w.lastSig && <a href={explorer(w.lastSig)} target="_blank" rel="noreferrer">Транзакция в сети ↗</a>}
            <div className="t-actions">
              {onInventory && <button className="pg-btn" onClick={onInventory}>В инвентарь</button>}
              <button className="pg-cta" onClick={onClose}><b className="toon">Готово</b></button>
            </div>
          </div>
        ) : (
          <>
            <div className="t-head">
              <h2 className="toon">Купить лот</h2>
              <button className="pg-x" onClick={onClose}>✕</button>
            </div>
            <div className="t-body">
              <div className="t-item">
                <ThingCard t={t} />
                <small style={{ color: thingRarity(t).color }}>{thingRarity(t).name}</small>
                <span>серийный № {String(l.serial).padStart(4, "0")}</span>
              </div>
              <div className="t-form">
                <div className="t-rows">
                  <div><span>Продавец</span><b>{short(l.seller)}</b></div>
                  <div><span>Продавцу</span><b>{fmt(price * (1 - MARKET_FEE))} SOL</b></div>
                  <div><span>Комиссия площадки {MARKET_FEE * 100}%</span><b>{fmt(price * MARKET_FEE)} SOL</b></div>
                  <div className="total"><span>Ты заплатишь</span><b>{fmt(price)} SOL</b></div>
                  {w.wallet && <div className="dim"><span>На кошельке</span><b>{w.balance === null ? "…" : `${fmt(w.balance)} SOL`}</b></div>}
                </div>
                <a className="t-link" href={explorer(l.sig)} target="_blank" rel="noreferrer">Посмотреть лот в сети ↗</a>
                {!w.wallet && <Connect />}
                {short_ && <div className="t-error">На кошельке не хватает SOL.</div>}
                {w.error && <div className="t-error">{w.error}</div>}
                <button
                  className="pg-cta sol" disabled={!w.wallet || !!w.busy || short_}
                  onClick={async () => {
                    if (await buy(l)) setDone(true);
                  }}
                >
                  <b className="toon">{w.busy || `Купить за ${fmt(price)} SOL`}</b>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
