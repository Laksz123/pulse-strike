import { useEffect, useState } from "react";
import { ITEMS, armorProt, itemColor } from "../game/items";
import { RECIPE_BY_ID } from "../game/recipes";
import { AMMO_NAMES, WEAPON_BY_ID } from "../game/weapons";
import { maxHpOf, recipeName, useStore } from "../store";
import { Icon } from "./Icon";
import { Minimap } from "./Minimap";

/** Re-renders while a timestamped effect (hit marker, damage flash) is still fading. */
function useFlash(at: number, ms: number): boolean {
  const [, bump] = useState(0);
  useEffect(() => {
    if (!at) return;
    const t = setTimeout(() => bump((n) => n + 1), ms);
    return () => clearTimeout(t);
  }, [at, ms]);
  return at > 0 && performance.now() - at < ms;
}

function Reticle() {
  const ads = useStore((s) => s.ads);
  const hitAt = useStore((s) => s.hitAt);
  const killAt = useStore((s) => s.killAt);
  const hurtAt = useStore((s) => s.hurtAt);
  const hp = useStore((s) => s.hp);
  const hit = useFlash(hitAt, 140);
  const kill = useFlash(killAt, 320);
  const hurt = useFlash(hurtAt, 380);
  return (
    <>
      {!ads && <div className="crosshair" />}
      {hit && <div className={kill ? "hitmarker kill" : "hitmarker"} />}
      {hurt && <div className="hurt" />}
      <div className="vignette" style={{ opacity: hp < 40 ? (40 - hp) / 40 : 0 }} />
    </>
  );
}

const POINTS = ["С", "СВ", "В", "ЮВ", "Ю", "ЮЗ", "З", "СЗ"];

/** Heading, and the nearest monument: the only places where people shoot. */
function Compass() {
  const zone = useStore((s) => s.zone);
  const yaw = useStore((s) => s.yaw);
  const bearing = (((-yaw * 180) / Math.PI) % 360 + 360) % 360;
  return (
    <div className={zone?.inside ? "compass danger" : "compass"}>
      <b>{POINTS[Math.round(bearing / 45) % 8]}</b>
      {zone && (zone.inside ? <span>РТ «{zone.name}» · опасно</span> : <span>{zone.name} · {zone.dist} м</span>)}
    </div>
  );
}

function Feed() {
  const gains = useStore((s) => s.gains);
  const toasts = useStore((s) => s.toasts);
  return (
    <>
      <div className="gains">
        {gains.map((g) => (
          <div key={g.key} className="gain" style={{ color: g.color }}>+{g.n} {g.label}</div>
        ))}
      </div>
      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className="toast" style={{ color: t.color }}>{t.text}</div>
        ))}
      </div>
    </>
  );
}

function Action() {
  const prompt = useStore((s) => s.prompt);
  const channel = useStore((s) => s.channel);
  const node = useStore((s) => s.node);
  return (
    <>
      {node && (
        <div className="node">
          <div className="node-name">{node.name}{node.combo > 1 && <b> точно ×{node.combo}</b>}</div>
          <div className="bar"><div style={{ width: `${node.hp * 100}%` }} /></div>
          {node.hint && <div className="node-hint">{node.hint}</div>}
        </div>
      )}
      {channel ? (
        <div className="channel">
          <div className="channel-label">{channel.label}</div>
          <div className="bar"><div style={{ width: `${Math.min(100, channel.p * 100)}%` }} /></div>
        </div>
      ) : (
        prompt && <div className="prompt">{prompt}</div>
      )}
    </>
  );
}

/** The lockpicking dial: stop the needle inside the green arc, once per pin. */
function Lock() {
  const lock = useStore((s) => s.lock);
  if (!lock) return null;
  const R = 78;
  const pt = (a: number, r = R) => `${100 + Math.cos(a) * r} ${100 + Math.sin(a) * r}`;
  const a0 = lock.zoneA;
  const a1 = lock.zoneA + lock.zoneSize;
  const now = performance.now();
  const ok = now - lock.okAt < 220;
  const bad = now - lock.badAt < 300;
  return (
    <div className={`lock${bad ? " bad" : ""}${ok ? " ok" : ""}`}>
      <div className="lock-title">{lock.name}</div>
      <svg viewBox="0 0 200 200" width="230" height="230">
        <circle cx="100" cy="100" r={R} className="lock-ring" />
        <path d={`M ${pt(a0)} A ${R} ${R} 0 0 1 ${pt(a1)}`} className="lock-zone" />
        <line x1={100 + Math.cos(lock.angle) * 52} y1={100 + Math.sin(lock.angle) * 52} x2={100 + Math.cos(lock.angle) * 92} y2={100 + Math.sin(lock.angle) * 92} className="lock-needle" />
        <circle cx="100" cy="100" r="34" className="lock-core" />
        {Array.from({ length: lock.pins }, (_, i) => {
          const x = 100 + (i - (lock.pins - 1) / 2) * 11;
          return <rect key={i} x={x - 3.5} y={i < lock.done ? 88 : 96} width="7" height="14" className={i < lock.done ? "pin set" : "pin"} />;
        })}
      </svg>
      <div className="lock-info">Отмычек: <b>{lock.picks}</b> · штифты {lock.done}/{lock.pins}</div>
      <div className="lock-keys"><kbd>ЛКМ</kbd> или <kbd>F</kbd> — зафиксировать · <kbd>WASD</kbd> — бросить</div>
    </div>
  );
}

function Vitals() {
  const hp = useStore((s) => s.hp);
  const armor = useStore((s) => s.armor);
  const max = useStore((s) => maxHpOf(s.skills));
  const prot = Math.round(armorProt(armor) * 100);
  return (
    <div className="vitals">
      <div className="health">
        <div className="bar"><div style={{ width: `${(hp / max) * 100}%`, background: hp < max * 0.35 ? "#d6453d" : "#e9e1cf" }} /></div>
        <span>{hp}</span>
      </div>
      <div className="armorline">Защита {prot}%</div>
    </div>
  );
}

function Hotbar() {
  const hot = useStore((s) => s.hot);
  const active = useStore((s) => s.active);
  const mag = useStore((s) => s.mag);
  const reloading = useStore((s) => s.reloading);
  const ammo = useStore((s) => s.ammo);
  const item = hot[active];
  const gun = item ? WEAPON_BY_ID[item.id] : undefined;
  return (
    <div className="hotwrap">
      {item && (
        <div className="held">
          <span style={{ color: itemColor(item) }}>{ITEMS[item.id].name}</span>
          {gun && (
            <span className="ammo">
              <b>{reloading ? "··" : mag}</b> / {ammo[gun.ammo]} <i>{reloading ? "перезарядка" : AMMO_NAMES[gun.ammo]}</i>
            </span>
          )}
        </div>
      )}
      <div className="hotbar">
        {hot.map((it, i) => (
          <div key={i} className={`slot${i === active ? " active" : ""}${it ? "" : " empty"}`} style={it ? { borderColor: itemColor(it) } : undefined}>
            {it && <Icon id={it.id} />}
            {it && it.n > 1 && <span className="count">{it.n}</span>}
            <span className="key">{i + 1}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CraftChip() {
  const job = useStore((s) => s.queue[0]);
  const n = useStore((s) => s.queue.length);
  if (!job) return null;
  const r = RECIPE_BY_ID[job.recipe];
  return (
    <div className="craftchip">
      <span>Крафт: {recipeName(r)}{n > 1 ? ` · ещё ${n - 1}` : ""}</span>
      <div className="bar"><div style={{ width: `${Math.min(100, (job.t / r.time) * 100)}%` }} /></div>
    </div>
  );
}

/** The next sensible step for the player: a one-line guide through the progression. */
function Objective() {
  const hot = useStore((s) => s.hot);
  const bag = useStore((s) => s.bag);
  const armor = useStore((s) => s.armor);
  const bench = useStore((s) => s.bench);
  const missions = useStore((s) => s.stats.missions);
  const carried = [...hot, ...bag].flatMap((it) => (it ? [it.id] : []));
  const has = (re: RegExp) => carried.some((id) => re.test(id));
  let text: string;
  if (!has(/^(axe_|pick_|chainsaw|jackhammer)/)) text = "Добудь рубилом дерево и камень, затем скрафти топор и кирку";
  else if (!armor.some((a) => !!a)) text = "Собери волокно — кусты с цветами — и сшей одежду";
  else if (missions === 0) text = "Набери добычи и заверши миссию (H): всё вынесенное останется на базе";
  else if (bench === 1) text = "Добудь руду в нагорье, переплавь на базе и улучши верстак";
  else if (bench === 2) text = "Чисти РТ: нужны электроника, кристаллы и чертежи";
  else text = "Убей Капитана на кладбище кораблей";
  return (
    <div className="objective">
      <div className="objective-title">Цель</div>
      {text}
      <div className="keyhint"><kbd>E</kbd> инвентарь · <kbd>M</kbd> карта · <kbd>F</kbd> действие · <kbd>H</kbd> эвакуация</div>
    </div>
  );
}

export function Hud() {
  return (
    <div className="hud">
      <Reticle />
      <Compass />
      <Feed />
      <Action />
      <Lock />
      <Vitals />
      <Hotbar />
      <CraftChip />
      <Objective />
      <Minimap />
    </div>
  );
}
