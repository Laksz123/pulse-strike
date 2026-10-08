import { useEffect, useState } from "react";
import { RARITY } from "../arena/markers";
import { CLUSTER, LIST_FEE_SOL, MARKET_FEE, TREASURY, onProgram, short, sol, type Listing } from "../solana/chain";
import { loadBook, unlist, useWallet } from "../solana/wallet";
import { useStore } from "../store";
import { BuySheet, SellSheet, ThingCard, WalletChip, thingRarity, thingValid } from "./Trade";

type Tab = "buy" | "sell" | "mine";
const fmt = (n: number) => Number(n.toFixed(4)).toString();

/** The market: items players sell each other for SOL. Three tabs: buy, sell, and what you have on sale. */
export function Market({ go }: { go?: (page: "inventory" | "cases" | "shop") => void }) {
  const s = useStore();
  const w = useWallet();
  const [tab, setTab] = useState<Tab>("buy");
  const [kind, setKind] = useState<"all" | "w" | "a">("all");
  const [rarity, setRarity] = useState(-1);
  const [sort, setSort] = useState<"new" | "cheap" | "dear">("new");
  const [buying, setBuying] = useState<Listing | null>(null);
  const [selling, setSelling] = useState<{ kind: "w" | "a"; uid: string } | null>(null);

  useEffect(() => {
    void loadBook();
  }, []);

  const mine = w.wallet?.address;
  let open = (w.book?.open ?? []).filter(thingValid).filter((l) => (kind === "all" || l.kind === kind) && (rarity < 0 || RARITY.indexOf(thingRarity(l)) === rarity));
  if (sort === "cheap") open = [...open].sort((a, b) => a.lamports - b.lamports);
  if (sort === "dear") open = [...open].sort((a, b) => b.lamports - a.lamports);
  const sellable = [
    ...s.markers.map((m) => ({ kind: "w" as const, uid: m.uid, id: m.id, skin: m.skin, serial: m.serial })),
    ...s.agents.filter((a) => !a.starter).map((a) => ({ kind: "a" as const, uid: a.uid, id: a.id, skin: 0, serial: a.serial })),
  ].sort((a, b) => RARITY.indexOf(thingRarity(b)) - RARITY.indexOf(thingRarity(a)));

  return (
    <main className="mkt">
      <div className="mkt-top">
        <div className="pg-seg">
          <button className={tab === "buy" ? "on" : ""} onClick={() => setTab("buy")}>Купить<i>{w.book ? open.length : "…"}</i></button>
          <button className={tab === "sell" ? "on" : ""} onClick={() => setTab("sell")}>Продать<i>{sellable.length}</i></button>
          <button className={tab === "mine" ? "on" : ""} onClick={() => setTab("mine")}>Мои лоты<i>{s.listed.length}</i></button>
        </div>
        <span className="spacer" />
        <WalletChip />
      </div>
      {w.error && <div className="t-error wide">{w.error}</div>}

      {tab === "buy" && (
        <>
          <div className="pg-chips">
            <button className={kind === "all" ? "on" : ""} onClick={() => setKind("all")}>Всё</button>
            <button className={kind === "w" ? "on" : ""} onClick={() => setKind("w")}>Скины</button>
            <button className={kind === "a" ? "on" : ""} onClick={() => setKind("a")}>Агенты</button>
            <i className="sep" />
            {RARITY.map((r, i) => <button key={i} className={rarity === i ? "on dot" : "dot"} style={{ ["--r" as string]: r.color }} onClick={() => setRarity(rarity === i ? -1 : i)} title={r.name}><i />{r.name}</button>)}
            <span className="spacer" />
            <button className="sort" onClick={() => setSort(sort === "new" ? "cheap" : sort === "cheap" ? "dear" : "new")}>{sort === "new" ? "Сначала новые" : sort === "cheap" ? "Сначала дешёвые" : "Сначала дорогие"} ⇅</button>
            <button className="sort" disabled={!!w.busy} onClick={() => void loadBook()}>↻ Обновить</button>
          </div>
          <div className="mkt-grid">
            {open.map((l) => (
              <div key={l.sig} className={l.seller === mine ? "lot mine" : "lot"} style={{ ["--r" as string]: thingRarity(l).color }}>
                <ThingCard t={l} tag={l.seller === mine ? "твой" : undefined} onClick={() => (l.seller === mine ? setTab("mine") : setBuying(l))} />
                <button className="lot-price" onClick={() => (l.seller === mine ? setTab("mine") : setBuying(l))}><b>{fmt(sol(l.lamports))}</b> SOL</button>
                <small>№ {String(l.serial).padStart(4, "0")} · {short(l.seller)}</small>
              </div>
            ))}
            {!open.length && (
              <div className="pg-empty wide">
                <img src="/art/icon_trade.png" alt="" />
                <b className="toon">{w.book ? "Лотов пока нет" : w.busy ? "Читаем маркет из сети…" : "Не удалось прочитать маркет"}</b>
                <p>Здесь появляется всё, что игроки выставили на продажу. Стань первым: выставь свой предмет, и он будет виден всем.</p>
                <div><button className="pg-btn" onClick={() => setTab("sell")}>Продать свой предмет</button></div>
              </div>
            )}
          </div>
        </>
      )}

      {tab === "sell" && (
        <>
          <div className="mkt-how">
            <div><i>1</i><span>Выбери предмет и назначь цену в SOL</span></div>
            <div><i>2</i><span>Лот записывается в сеть Solana и виден всем игрокам</span></div>
            <div><i>3</i><span>Покупатель платит тебе напрямую · комиссия {MARKET_FEE * 100}% · {onProgram() ? "залог за лот возвращается" : `сбор за лот ${LIST_FEE_SOL} SOL`}</span></div>
          </div>
          <div className="mkt-grid">
            {sellable.map((it) => (
              <div key={it.uid} className="lot" style={{ ["--r" as string]: thingRarity(it).color }}>
                <ThingCard t={it} onClick={() => setSelling({ kind: it.kind, uid: it.uid })} />
                <button className="lot-price sell" onClick={() => setSelling({ kind: it.kind, uid: it.uid })}>Продать</button>
                <small>№ {String(it.serial).padStart(4, "0")}</small>
              </div>
            ))}
            {!sellable.length && (
              <div className="pg-empty wide">
                <img src="/art/case.png" alt="" />
                <b className="toon">Продавать пока нечего</b>
                <p>Продать можно скины и агентов, кроме стартовых. Они выпадают из кейсов и приходят за боевой пропуск.</p>
                <div>
                  <button className="pg-btn" onClick={() => go?.("cases")}>Открыть кейсы</button>
                  <button className="pg-btn" onClick={() => go?.("shop")}>В магазин</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {tab === "mine" && (
        <div className="mkt-grid">
          {s.listed.filter(thingValid).map((l) => (
            <div key={l.sig} className="lot" style={{ ["--r" as string]: thingRarity(l).color }}>
              <ThingCard t={l} tag="на продаже" />
              <div className="lot-price static"><b>{fmt(l.price)}</b> SOL</div>
              <button className="pg-btn small" disabled={!!w.busy || !mine} onClick={() => void unlist(l.sig)}>{mine ? "Снять с продажи" : "Нужен кошелёк"}</button>
            </div>
          ))}
          {!s.listed.length && (
            <div className="pg-empty wide">
              <img src="/art/icon_trade.png" alt="" />
              <b className="toon">У тебя нет лотов</b>
              <p>Когда выставишь предмет, он появится здесь. Как только его купят — SOL придут на кошелёк, а лот исчезнет.</p>
              <div><button className="pg-btn" onClick={() => setTab("sell")}>Продать предмет</button></div>
            </div>
          )}
        </div>
      )}

      <p className="mkt-foot">
        Сеть Solana {CLUSTER} · казна площадки <a href={`https://explorer.solana.com/address/${TREASURY.toBase58()}?cluster=${CLUSTER}`} target="_blank" rel="noreferrer">{short(TREASURY.toBase58())} ↗</a>
      </p>
      {buying && <BuySheet l={buying} onClose={() => setBuying(null)} onInventory={() => go?.("inventory")} />}
      {selling && <SellSheet kind={selling.kind} uid={selling.uid} onClose={() => setSelling(null)} onMarket={() => { setSelling(null); setTab("mine"); }} />}
    </main>
  );
}
