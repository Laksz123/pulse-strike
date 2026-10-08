import { useState } from "react";
import {
  ARMOR_SLOTS, ITEMS, RES, RES_ORDER, SLOT_NAMES, armorProt, isGun, itemColor, itemValue, type Item, type ResId,
} from "../game/items";
import { CAT_NAMES, CAT_ORDER, GUN_UPGRADE, OFFERS, RECIPES, RECIPE_BY_ID, type Recipe, type RecipeCat } from "../game/recipes";
import { AFFIX_BY_ID, AMMO_NAMES, AMMO_ORDER, CLASS_NAMES, RARITIES, WEAPON_BY_ID, dpsOf, statsOf } from "../game/weapons";
import { CONTRACT_BY_ID, REP_NAMES, REP_TIERS, repTier } from "../game/career";
import { atCamp, craftBlock, recipeName, useStore, type Ref, type Tab } from "../store";
import { iconUrl } from "../game/icons";
import { Icon } from "./Icon";

const same = (a: Ref | null, b: Ref) => !!a && a.c === b.c && a.i === b.i;

/**
 * Drag and drop built on plain mouse events: press a slot, move, release over another slot.
 * (The browser's native drag API is unreliable inside games and cannot be driven by tests.)
 */
const drag: { from: Ref | null; id: string | null; x: number; y: number; moved: boolean; ghost: HTMLImageElement | null } = {
  from: null, id: null, x: 0, y: 0, moved: false, ghost: null,
};

function slotAt(x: number, y: number): Ref | null {
  const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-slot]");
  if (!el) return null;
  const [c, i] = el.dataset.slot!.split(":");
  return { c: c as Ref["c"], i: Number(i) };
}

function onDragMove(e: MouseEvent): void {
  if (!drag.from) return;
  if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6) return;
  if (!drag.moved) {
    drag.moved = true;
    const ghost = document.createElement("img");
    ghost.className = "icon drag-ghost";
    ghost.src = iconUrl(drag.id!);
    document.body.appendChild(ghost);
    drag.ghost = ghost;
  }
  drag.ghost!.style.transform = `translate(${e.clientX - 24}px, ${e.clientY - 24}px)`;
}

function onDragEnd(e: MouseEvent): void {
  window.removeEventListener("mousemove", onDragMove);
  window.removeEventListener("mouseup", onDragEnd);
  drag.ghost?.remove();
  drag.ghost = null;
  const from = drag.from;
  drag.from = null;
  if (!from || !drag.moved) return;
  const to = slotAt(e.clientX, e.clientY);
  if (to) useStore.getState().move(from, to);
}

function Slot({ at, item, hint, selected, onSelect }: { at: Ref; item: Item | null; hint?: string; selected: boolean; onSelect(r: Ref | null): void }) {
  const quick = useStore((s) => s.quick);
  return (
    <div
      className={`slot${selected ? " sel" : ""}${item ? " full" : " empty"}`}
      style={item ? { borderColor: itemColor(item) } : undefined}
      data-slot={`${at.c}:${at.i}`}
      onMouseDown={(e) => {
        if (!item || e.button !== 0) return;
        e.preventDefault();
        Object.assign(drag, { from: at, id: item.id, x: e.clientX, y: e.clientY, moved: false });
        window.addEventListener("mousemove", onDragMove);
        window.addEventListener("mouseup", onDragEnd);
      }}
      onClick={() => onSelect(item ? at : null)}
      onDoubleClick={() => item && quick(at)}
      title={item ? ITEMS[item.id].name : hint}
    >
      {item ? <Icon id={item.id} /> : hint ? <span className="slot-hint">{hint}</span> : null}
      {item && item.n > 1 && <span className="count">{item.n}</span>}
      {at.c === "hot" && <span className="key">{at.i + 1}</span>}
    </div>
  );
}

function Cost({ res, items }: { res?: Partial<Record<ResId, number>>; items?: Record<string, number> }) {
  const have = useStore((s) => s.res);
  const count = useStore((s) => s.countItem);
  useStore((s) => s.bag);
  useStore((s) => s.hot);
  return (
    <div className="cost">
      {Object.entries(items ?? {}).map(([id, n]) => (
        <span key={id} className={count(id) >= n ? "chip" : "chip lack"} title={ITEMS[id].name}>
          <Icon id={id} size={20} /> {ITEMS[id].name}
        </span>
      ))}
      {Object.entries(res ?? {}).map(([k, n]) => (
        <span key={k} className={have[k as ResId] >= n ? "chip" : "chip lack"} title={RES[k as ResId].name}>
          <Icon id={k} size={20} /> {have[k as ResId]}/{n}
        </span>
      ))}
    </div>
  );
}

function recipeIcon(r: Recipe): string {
  if (r.out.item) return r.out.item;
  const res = Object.keys(r.out.res ?? {})[0];
  if (res) return res;
  const ammo = Object.keys(r.out.ammo ?? {})[0];
  return ammo ?? "scrap";
}

function CraftTab() {
  const s = useStore();
  const [cat, setCat] = useState<RecipeCat | "all">("all");
  const home = atCamp(s);
  const list = RECIPES.filter((r) => cat === "all" || r.cat === cat);
  return (
    <>
      <div className="station">
        {home ? (
          <>Ты на базе: верстак <b>{s.bench} ур.</b> и печь под рукой.</>
        ) : (
          <>В поле — только ручной крафт. Верстак и печь ждут на базе: заверши миссию (H).</>
        )}
      </div>
      {s.queue.length > 0 && (
        <div className="queue">
          {s.queue.map((j, i) => {
            const r = RECIPE_BY_ID[j.recipe];
            return (
              <div key={j.id} className="job" title="Отменить и вернуть ресурсы" onClick={() => s.cancelJob(j.id)}>
                <Icon id={recipeIcon(r)} size={28} />
                {i === 0 && <div className="bar"><div style={{ width: `${Math.min(100, (j.t / r.time) * 100)}%` }} /></div>}
              </div>
            );
          })}
        </div>
      )}
      <div className="cats">
        <button className={cat === "all" ? "btn small on" : "btn small"} onClick={() => setCat("all")}>Все</button>
        {CAT_ORDER.map((c) => (
          <button key={c} className={cat === c ? "btn small on" : "btn small"} onClick={() => setCat(c)}>{CAT_NAMES[c]}</button>
        ))}
      </div>
      <div className="recipes">
        {list.map((r) => {
          const why = craftBlock(s, r);
          const built = why === "Уже построено";
          return (
            <div key={r.id} className={why ? "recipe off" : "recipe"}>
              <Icon id={recipeIcon(r)} size={36} />
              <div className="recipe-body">
                <div className="recipe-name">
                  {recipeName(r)}
                  {r.items && <span className="tag">улучшение</span>}
                  {r.bench > 0 && <span className="tag">верстак {r.bench}</span>}
                  {r.furnace && <span className="tag">печь</span>}
                  {r.bp && <span className={s.known.includes(r.bp) ? "tag ok" : "tag warn"}>чертёж{s.known.includes(r.bp) ? " ✓" : ""}</span>}
                </div>
                <Cost res={r.res} items={r.items} />
              </div>
              <button className="btn small" disabled={!!why} title={why ?? `${r.time} с`} onClick={() => s.craft(r.id)}>
                {built ? "Готово" : why ? why : `Создать · ${r.time}с`}
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}

function StashTab({ sel, onSelect }: { sel: Ref | null; onSelect(r: Ref | null): void }) {
  const stash = useStore((s) => s.stash);
  return (
    <>
      <div className="station">Склад базы. То, что лежит здесь, не теряется при гибели. Двойной клик перекладывает.</div>
      <div className="grid stash-grid">
        {stash.map((it, i) => (
          <Slot key={i} at={{ c: "stash", i }} item={it} selected={same(sel, { c: "stash", i })} onSelect={onSelect} />
        ))}
      </div>
    </>
  );
}

function TradeTab() {
  const s = useStore();
  const tier = repTier(s.rep);
  const next = REP_TIERS[tier + 1];
  return (
    <>
      <div className="station">
        Репутация: <b>{REP_NAMES[tier]}</b> · {s.rep}{next ? ` / ${next}` : ""}. Контракты поднимают её и открывают товары.
      </div>
      <h3>Контракты</h3>
      <div className="recipes contracts">
        {s.contracts.map((c, i) => {
          const def = CONTRACT_BY_ID[c.id];
          const have = def.res ? Math.min(def.n, s.res[def.res]) : c.progress;
          const done = have >= def.n;
          return (
            <div key={c.id} className={done ? "recipe done" : "recipe"}>
              {def.res ? <Icon id={def.res} size={36} /> : <span className="contract-mark">!</span>}
              <div className="recipe-body">
                <div className="recipe-name">{def.text}</div>
                <div className="contract-row">
                  <div className="bar"><div style={{ width: `${(have / def.n) * 100}%` }} /></div>
                  <span>{have}/{def.n} · ◆ {def.salt} · репутация +{def.rep}</span>
                </div>
              </div>
              <button className="btn small" disabled={!done} onClick={() => s.claimContract(i)}>{def.res ? "Сдать" : "Забрать"}</button>
            </div>
          );
        })}
      </div>
      <h3>Товары</h3>
      <div className="recipes">
        {OFFERS.map((o) => {
          const locked = s.rep < o.rep;
          return (
            <div key={o.id} className={locked || s.salt < o.price ? "recipe off" : "recipe"}>
              <Icon id={o.item ?? Object.keys(o.ammo ?? {})[0]} size={36} />
              <div className="recipe-body">
                <div className="recipe-name">{o.name}</div>
              </div>
              <button className="btn small" disabled={locked || s.salt < o.price} onClick={() => s.buy(o.id)}>
                {locked ? `Репутация ${o.rep}` : `◆ ${o.price}`}
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}

function Details({ at, onSelect }: { at: Ref; onSelect(r: Ref | null): void }) {
  const s = useStore();
  const item = s[at.c][at.i];
  if (!item) return null;
  const def = ITEMS[item.id];
  const gun = WEAPON_BY_ID[item.id];
  const home = atCamp(s);
  const value = itemValue(item);
  const up = gun ? GUN_UPGRADE[item.rarity ?? 0] : undefined;
  const st = gun ? statsOf(item) : null;
  return (
    <div className="details" style={{ borderColor: itemColor(item) }}>
      <div className="details-head">
        <Icon id={item.id} size={56} />
        <div>
          <div className="title" style={{ color: itemColor(item) }}>{def.name}{item.n > 1 ? ` ×${item.n}` : ""}</div>
          <div className="sub">
            {gun ? `${RARITIES[item.rarity ?? 0].name} · ${CLASS_NAMES[gun.cls]} · ${AMMO_NAMES[gun.ammo]}` : def.desc}
            {item.starter && " · стартовый набор"}
          </div>
        </div>
      </div>
      {st && (
        <div className="stats">
          <span>Урон <b>{Math.round(st.dmg)}{st.pellets > 1 ? `×${st.pellets}` : ""}</b></span>
          <span>Темп <b>{Math.round(st.rpm)}</b></span>
          <span>Магазин <b>{st.mag}</b></span>
          <span>DPS <b>{dpsOf(item)}</b></span>
          {(item.affixes ?? []).map((a) => <span key={a} className="affix">{AFFIX_BY_ID[a]?.name}</span>)}
        </div>
      )}
      {def.tool && (
        <div className="stats">
          <span>Сила <b>{def.tool.power}</b></span>
          <span>Удар <b>{def.tool.interval}с</b></span>
          <span>Урон <b>{def.tool.melee}</b></span>
        </div>
      )}
      {def.armor && <div className="stats"><span>Защита <b>+{Math.round(def.armor.prot * 100)}%</b></span><span>{SLOT_NAMES[def.armor.slot]}</span></div>}
      <div className="actions">
        <button className="btn small" onClick={() => s.quick(at)}>
          {at.c === "stash" ? "Взять" : s.tab === "stash" && home ? "На склад" : def.armor ? (at.c === "armor" ? "Снять" : "Надеть") : at.c === "bag" && def.kind !== "misc" ? "В быстрый слот" : "В рюкзак"}
        </button>
        {def.bp && home && <button className="btn small primary" onClick={() => { s.learn(at); onSelect(null); }}>Изучить</button>}
        {home && value > 0 && <button className="btn small" onClick={() => { s.sell(at); onSelect(null); }}>Продать ◆{value}</button>}
        {gun && up && home && isGun(item) && (
          <button className="btn small" onClick={() => s.upgradeGun(at)} title={`Нужен верстак ${up.bench} ур.`}>
            Улучшить до «{RARITIES[(item.rarity ?? 0) + 1].name}»
          </button>
        )}
        <button className="btn small danger" onClick={() => { s.discard(at); onSelect(null); }}>Выбросить</button>
      </div>
      {gun && up && home && <Cost res={up.res} />}
    </div>
  );
}

/** Backpack, hotbar, armour and the context panel: crafting, the camp stash or the trader. */
export function Inventory({ onClose, fixedTab }: { onClose?: () => void; fixedTab?: Tab }) {
  const s = useStore();
  const [sel, setSel] = useState<Ref | null>(null);
  const home = atCamp(s);
  const tab: Tab = fixedTab ?? (home ? s.tab : "craft");
  const setTab = (t: Tab) => useStore.setState({ tab: t });
  const prot = Math.round(armorProt(s.armor) * 100);
  return (
    <div className="inventory" onClick={(e) => e.stopPropagation()}>
      <section className="inv-char">
        <h3>Снаряжение</h3>
        <div className="armor">
          {ARMOR_SLOTS.map((slot, i) => (
            <div key={slot} className="armor-row">
              <Slot at={{ c: "armor", i }} item={s.armor[i]} hint={SLOT_NAMES[slot]} selected={same(sel, { c: "armor", i })} onSelect={setSel} />
              <div>
                <div className="armor-name">{s.armor[i] ? ITEMS[s.armor[i]!.id].name : SLOT_NAMES[slot]}</div>
                <div className="armor-sub">{s.armor[i] ? `+${Math.round((ITEMS[s.armor[i]!.id].armor?.prot ?? 0) * 100)}% защиты` : "пусто"}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="protline">Защита <b>{prot}%</b> · Соль <b>◆ {s.salt}</b></div>
        <h3>Ресурсы</h3>
        <div className="reslist">
          {RES_ORDER.map((r) => (
            <div key={r} className={s.res[r] ? "resrow" : "resrow zero"} title={RES[r].hint}>
              <Icon id={r} size={22} /> <span>{RES[r].name}</span> <b>{s.res[r]}</b>
            </div>
          ))}
          {AMMO_ORDER.map((a) => (
            <div key={a} className={s.ammo[a] ? "resrow" : "resrow zero"}>
              <Icon id={a} size={22} /> <span>{AMMO_NAMES[a]}</span> <b>{s.ammo[a]}</b>
            </div>
          ))}
        </div>
      </section>

      <section className="inv-bag">
        <h3>Рюкзак</h3>
        <div className="grid bag-grid">
          {s.bag.map((it, i) => (
            <Slot key={i} at={{ c: "bag", i }} item={it} selected={same(sel, { c: "bag", i })} onSelect={setSel} />
          ))}
        </div>
        <h3>Быстрый доступ</h3>
        <div className="grid hot-grid">
          {s.hot.map((it, i) => (
            <Slot key={i} at={{ c: "hot", i }} item={it} selected={same(sel, { c: "hot", i })} onSelect={setSel} />
          ))}
        </div>
        <h3>Защищённый карман <i>не теряется при гибели</i></h3>
        <div className="grid hot-grid">
          {s.secure.slice(0, s.pocket).map((it, i) => (
            <Slot key={i} at={{ c: "secure", i }} item={it} selected={same(sel, { c: "secure", i })} onSelect={setSel} />
          ))}
          {Array.from({ length: 6 - s.pocket }, (_, i) => <div key={`l${i}`} className="slot locked" title="Расширяется на базе" />)}
        </div>
        {sel ? <Details at={sel} onSelect={setSel} /> : <div className="details hint">Перетаскивай предметы между слотами. Клик — подробности, двойной клик — быстро переложить.</div>}
      </section>

      <section className="inv-side">
        <div className="tabs">
          {!fixedTab && (
            <>
              <button className={tab === "craft" ? "btn small on" : "btn small"} onClick={() => setTab("craft")}>Крафт</button>
              <button className={tab === "stash" ? "btn small on" : "btn small"} disabled={!home} onClick={() => setTab("stash")}>Склад</button>
              <button className={tab === "trade" ? "btn small on" : "btn small"} disabled={!home} onClick={() => setTab("trade")}>Торговец</button>
            </>
          )}
          <span className="spacer" />
          {onClose && <button className="btn small" onClick={onClose}>Закрыть · E</button>}
        </div>
        {tab === "craft" ? <CraftTab /> : tab === "stash" ? <StashTab sel={sel} onSelect={setSel} /> : <TradeTab />}
      </section>
    </div>
  );
}
