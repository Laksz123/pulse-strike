import { useEffect, useRef, useState } from "react";
import { AGENTS, AGENT_BY_ID, type AgentItem } from "../arena/agents";
import { CAT_NAMES, CAT_ORDER, MARKERS, MARKER_BY_ID, PATTERNS, RARITY, itemRarity, markerBars, typeRarity, type MarkerCat, type MarkerItem } from "../arena/markers";
import { Turntable, agentIcon, iconLater, iconReady } from "../arena/render";
import { useStore } from "../store";
import { SellSheet } from "./Trade";

const MODES: Record<string, string> = { semi: "Одиночный", auto: "Автомат", burst: "Очередями", charge: "Заряд", spin: "Раскрутка", stream: "Струя" };
const BLANK = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
const serial = (n: number) => `№ ${String(n).padStart(4, "0")}`;
type Go = (page: "shop" | "cases" | "market" | "pass") => void;

/** A card for a weapon in a skin: the art on its rarity colour, the name on a plate below. */
export function MarkerCard({ id, skin, selected, locked, tag, onClick }: { id: string; skin: number; selected?: boolean; locked?: boolean; tag?: string; onClick?(): void }) {
  const rarity = RARITY[itemRarity({ id, skin })];
  // Pictures are drawn a few per frame: a card may wait a moment for its own.
  const [src, setSrc] = useState(() => iconReady(id, skin));
  useEffect(() => {
    let on = true;
    setSrc(iconReady(id, skin));
    iconLater(id, skin, (url) => on && setSrc(url));
    return () => {
      on = false;
    };
  }, [id, skin]);
  return (
    <button className={`m-card${selected ? " sel" : ""}${locked ? " locked" : ""}`} style={{ ["--r" as string]: rarity.color }} onClick={onClick}>
      <img className={src ? "" : "wait"} src={src ?? BLANK} alt="" draggable={false} />
      <span className="m-name">{MARKER_BY_ID[id].name}</span>
      <span className="m-sub">{PATTERNS[skin].name}</span>
      {tag && <i className="m-tag">{tag}</i>}
      {locked && <i className="m-lock">нет</i>}
    </button>
  );
}

export function AgentCard({ id, selected, locked, tag, onClick }: { id: string; selected?: boolean; locked?: boolean; tag?: string; onClick?(): void }) {
  const def = AGENT_BY_ID[id];
  const rarity = RARITY[def.rarity];
  return (
    <button className={`m-card agent${selected ? " sel" : ""}${locked ? " locked" : ""}`} style={{ ["--r" as string]: rarity.color }} onClick={onClick}>
      <img src={agentIcon(id)} alt="" draggable={false} />
      <span className="m-name">{def.name}</span>
      <span className="m-sub">Агент · {rarity.name}</span>
      {tag && <i className="m-tag">{tag}</i>}
      {locked && <i className="m-lock">нет</i>}
    </button>
  );
}

type Tab = "skins" | "agents" | "weapons";
type Pick = { kind: "skin"; item: MarkerItem } | { kind: "agent"; id: string; item: AgentItem | null } | { kind: "weapon"; id: string };

/** The inventory: what the player owns on the left, the chosen thing on a stage on the right. */
export function Arsenal({ start = "skins", go }: { start?: Tab; go?: Go }) {
  const s = useStore();
  const [tab, setTab] = useState<Tab>(start);
  const [cat, setCat] = useState<MarkerCat | "all" | "side">("all");
  const wearing = (m: MarkerItem) => (MARKER_BY_ID[m.id].melee ? s.knife === m.uid : s.equipped[m.id] === m.uid);
  const [sort, setSort] = useState<"rare" | "new">("rare");
  const [selling, setSelling] = useState<{ kind: "w" | "a"; uid: string } | null>(null);
  const [pick, setPick] = useState<Pick>(() => {
    if (start === "agents" || !s.markers.length) return { kind: "agent", id: s.agents.find((a) => a.uid === s.agent)?.id ?? "byte", item: s.agents.find((a) => a.uid === s.agent) ?? null };
    return { kind: "skin", item: [...s.markers].sort((a, b) => itemRarity(b) - itemRarity(a))[0] };
  });
  const canvas = useRef<HTMLDivElement>(null);
  const table = useRef<Turntable | null>(null);

  useEffect(() => {
    table.current = new Turntable(canvas.current!);
    return () => table.current?.dispose();
  }, []);
  const shownId = pick.kind === "skin" ? pick.item.id : pick.id;
  const shownSkin = pick.kind === "skin" ? pick.item.skin : pick.kind === "weapon" ? (s.markers.find((m) => m.uid === s.equipped[pick.id])?.skin ?? 0) : 0;
  useEffect(() => {
    if (pick.kind === "agent") table.current?.showAgent(shownId);
    else table.current?.show(shownId, shownSkin);
  }, [pick.kind, shownId, shownSkin]);

  const inCat = (id: string) => cat === "all" || (cat === "side" ? !!MARKER_BY_ID[id].side : !MARKER_BY_ID[id].side && MARKER_BY_ID[id].cat === cat);
  const skins = s.markers.filter((m) => inCat(m.id));
  if (sort === "rare") skins.sort((a, b) => itemRarity(b) - itemRarity(a));
  else skins.reverse();
  // The selection may have been listed since it was made.
  const skinItem = pick.kind === "skin" && s.markers.some((m) => m.uid === pick.item.uid) ? pick.item : null;
  const agentItem = pick.kind === "agent" && pick.item && s.agents.some((a) => a.uid === pick.item!.uid) ? pick.item : null;
  const weapon = pick.kind === "agent" ? null : MARKER_BY_ID[shownId];
  const agent = pick.kind === "agent" ? AGENT_BY_ID[pick.id] : null;
  const bars = weapon ? markerBars(weapon) : null;
  const rarity = RARITY[pick.kind === "skin" ? itemRarity(pick.item) : agent ? agent.rarity : typeRarity(weapon!)];
  const worn = skinItem ? wearing(skinItem) : agentItem ? s.agent === agentItem.uid : false;

  return (
    <main className="inv">
      <section className="inv-list">
        <div className="pg-seg">
          <button className={tab === "skins" ? "on" : ""} onClick={() => setTab("skins")}>Скины<i>{s.markers.length}</i></button>
          <button className={tab === "agents" ? "on" : ""} onClick={() => setTab("agents")}>Агенты<i>{s.agents.length}/{AGENTS.length}</i></button>
          <button className={tab === "weapons" ? "on" : ""} onClick={() => setTab("weapons")}>Оружие<i>{MARKERS.length}</i></button>
        </div>
        {tab !== "agents" && (
          <div className="pg-chips">
            <button className={cat === "all" ? "on" : ""} onClick={() => setCat("all")}>Все</button>
            <button className={cat === "side" ? "on" : ""} onClick={() => setCat("side")}>Пистолеты</button>
            {CAT_ORDER.map((c) => <button key={c} className={cat === c ? "on" : ""} onClick={() => setCat(c)}>{CAT_NAMES[c]}</button>)}
            <button className={cat === "knife" ? "on knife" : "knife"} onClick={() => setCat("knife")}>★ Ножи</button>
            <span className="spacer" />
            {tab === "skins" && <button className="sort" onClick={() => setSort(sort === "rare" ? "new" : "rare")}>{sort === "rare" ? "Сначала редкие" : "Сначала новые"} ⇅</button>}
          </div>
        )}
        <div className="m-grid">
          {tab === "skins" && skins.map((m) => (
            <MarkerCard key={m.uid} id={m.id} skin={m.skin} selected={skinItem?.uid === m.uid} tag={wearing(m) ? (MARKER_BY_ID[m.id].melee ? "в руке" : "надет") : undefined} onClick={() => setPick({ kind: "skin", item: m })} />
          ))}
          {tab === "skins" && !skins.length && (
            <div className="pg-empty">
              <img src="/art/case.png" alt="" />
              <b className="toon">{s.markers.length ? "В этом разделе пусто" : "Скинов пока нет"}</b>
              <p>Скины выпадают из кейсов, приходят за боевой пропуск и продаются в магазине. Без скина оружие выглядит как Factory.</p>
              <div>
                <button className="pg-btn" onClick={() => go?.("cases")}>Открыть кейсы</button>
                <button className="pg-btn" onClick={() => go?.("shop")}>В магазин</button>
              </div>
            </div>
          )}
          {tab === "agents" && AGENTS.map((a) => {
            const owned = s.agents.find((x) => x.id === a.id) ?? null;
            return (
              <AgentCard
                key={a.id} id={a.id} locked={!owned} selected={pick.kind === "agent" && pick.id === a.id}
                tag={owned && s.agent === owned.uid ? "в бою" : undefined} onClick={() => setPick({ kind: "agent", id: a.id, item: owned })}
              />
            );
          })}
          {tab === "weapons" && MARKERS.filter((d) => inCat(d.id)).map((d) => (
            <MarkerCard key={d.id} id={d.id} skin={s.markers.find((m) => m.uid === s.equipped[d.id])?.skin ?? 0} selected={pick.kind === "weapon" && pick.id === d.id} tag={d.melee ? "нож" : d.price ? `$ ${d.price}` : "даром"} onClick={() => setPick({ kind: "weapon", id: d.id })} />
          ))}
        </div>
      </section>

      <section className="inv-view" style={{ ["--r" as string]: rarity.color }}>
        <div className="stage">
          <div className="stage-rays" />
          <div ref={canvas} className="turntable" />
          <span className="stage-rarity">{rarity.name}</span>
          {worn && <span className="stage-worn">{agent ? "в бою" : "надет"}</span>}
          <span className="stage-hint">потяни, чтобы повернуть</span>
        </div>
        <div className="inv-info">
          <div className="inv-title">
            <h2 className="toon">{weapon ? weapon.name : agent!.name}</h2>
            {skinItem && <b className="inv-skin">{PATTERNS[skinItem.skin].name}</b>}
          </div>
          <div className="inv-tags">
            {weapon && <span>{weapon.side ? "Пистолет" : CAT_NAMES[weapon.cat]}</span>}
            {weapon && !weapon.melee && <span>{MODES[weapon.mode]}</span>}
            {weapon && !weapon.melee && <span>в матче $ {weapon.price}</span>}
            {weapon?.melee && <span>взмах {weapon.dmg} · удар {weapon.melee.heavy} · в спину больнее</span>}
            {agent && <span>Агент</span>}
            {agent?.pass && <span>Только пропуск</span>}
            {(skinItem || agentItem) && <span>серийный {serial((skinItem ?? agentItem)!.serial)}</span>}
          </div>
          <p className="inv-about">{weapon ? weapon.trick : agent!.about}</p>
          {weapon && bars && (
            <div className="inv-bars">
              {([["Урон", bars.dmg, `${weapon.dmg}${weapon.pellets > 1 ? ` × ${weapon.pellets}` : ""}`], ["Темп", bars.rate, `${weapon.rpm}/мин`], ["Точность", bars.aim, ""], ["Магазин", bars.mag, `${weapon.mag}`]] as [string, number, string][]).map(([name, v, text]) => (
                <div key={name}>
                  <span>{name}</span>
                  <div className="bar"><div style={{ width: `${v * 100}%` }} /></div>
                  <small>{text}</small>
                </div>
              ))}
            </div>
          )}
          {agent && <p className="inv-note">Агент меняет только внешний вид: здоровье, скорость и хитбокс у всех одинаковые.</p>}
          {skinItem ? (
            <div className="inv-actions">
              <button className={worn ? "pg-cta off" : "pg-cta"} onClick={() => s.equipSkin(skinItem.uid)}><b className="toon">{worn ? "Снять" : "Надеть"}</b></button>
              <button className="pg-cta sol" onClick={() => setSelling({ kind: "w", uid: skinItem.uid })}><b className="toon">Продать за SOL</b></button>
            </div>
          ) : agentItem ? (
            <div className="inv-actions">
              <button className={worn ? "pg-cta off" : "pg-cta"} disabled={worn} onClick={() => s.equipAgent(agentItem.uid)}><b className="toon">{worn ? "Выбран" : "Выбрать"}</b></button>
              {!agentItem.starter && <button className="pg-cta sol" onClick={() => setSelling({ kind: "a", uid: agentItem.uid })}><b className="toon">Продать за SOL</b></button>}
            </div>
          ) : (
            <div className="inv-get">
              <span>{agent ? (agent.pass ? "Выдаётся в премиум-пропуске или покупается у игроков." : "Выпадает из кейсов, бывает в магазине, продаётся на маркете.") : weapon?.melee ? "Ножи — самое редкое, что бывает в кейсах: 3 кейса из 100. Ещё их продают игроки на маркете." : "Оружие покупается в матче. Скины на него — в кейсах, магазине и на маркете."}</span>
              <div>
                {agent?.pass ? <button className="pg-btn" onClick={() => go?.("pass")}>Пропуск</button> : <button className="pg-btn" onClick={() => go?.("shop")}>Магазин</button>}
                <button className="pg-btn" onClick={() => go?.("market")}>Маркет</button>
              </div>
            </div>
          )}
        </div>
      </section>
      {selling && <SellSheet kind={selling.kind} uid={selling.uid} onClose={() => setSelling(null)} onMarket={() => go?.("market")} />}
    </main>
  );
}
