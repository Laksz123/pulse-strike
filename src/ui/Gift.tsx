import { useEffect, useRef, useState } from "react";
import { WHEEL, prizeName, prizeRarity } from "../arena/gift";
import { RARITY } from "../arena/markers";
import type { Reward } from "../arena/pass";
import { sfx } from "../game/audio";
import { useStore } from "../store";
import { rewardArt } from "./Pass";

const SLICE = 360 / WHEEL.length;
const SPIN_MS = 5600;
/** What is written on a slice beside the picture: an amount, when there is one. */
const amount = (r: Reward) => (r.kind === "coins" ? String(r.n) : r.kind === "case" && r.n > 1 ? `×${r.n}` : "");
const color = (r: Reward) => RARITY[prizeRarity(r)].color;

/**
 * The welcome gift: the first time the game is opened, a wheel of prizes with one free spin.
 * The prize is decided and handed over the moment the wheel starts, so nothing is lost if the
 * page is closed while it turns; the spin only shows where it landed.
 */
export function Gift() {
  const spinGift = useStore((s) => s.spinGift);
  const [open, setOpen] = useState(() => !useStore.getState().gift);
  const [turn, setTurn] = useState(0);
  const [prize, setPrize] = useState<number | null>(null);
  const [landed, setLanded] = useState(false);
  const wheel = useRef<HTMLDivElement>(null);

  // A click for every slice that passes under the pointer.
  useEffect(() => {
    if (prize === null || landed) return;
    let raf = 0;
    let last = -1;
    const watch = () => {
      const m = wheel.current && getComputedStyle(wheel.current).transform.match(/matrix\(([^)]+)\)/);
      if (m) {
        const [a, b] = m[1].split(",").map(Number);
        const slice = Math.floor((((Math.atan2(b, a) * 180) / Math.PI + 360 + SLICE / 2) % 360) / SLICE);
        if (slice !== last && last >= 0) sfx.clack();
        last = slice;
      }
      raf = requestAnimationFrame(watch);
    };
    raf = requestAnimationFrame(watch);
    const done = setTimeout(() => {
      setLanded(true);
      if (prizeRarity(WHEEL[prize].reward) >= 3) sfx.rare();
      else sfx.coins();
    }, SPIN_MS + 250);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(done);
    };
  }, [prize, landed]);

  if (!open) return null;

  const spin = () => {
    if (prize !== null) return;
    const i = spinGift();
    if (i < 0) return setOpen(false);
    sfx.open();
    setPrize(i);
    // Six full turns, then on to the prize: its slice comes to rest under the pointer, a little off centre.
    setTurn(360 * 6 - i * SLICE + (Math.random() - 0.5) * (SLICE - 14));
  };

  const paint = `conic-gradient(from ${-SLICE / 2}deg, ${WHEEL.map((p, i) => `color-mix(in srgb, ${color(p.reward)} ${i % 2 ? 62 : 84}%, #101833) ${i * SLICE}deg ${(i + 1) * SLICE}deg`).join(", ")})`;
  const won = landed && prize !== null ? WHEEL[prize].reward : null;

  return (
    <div className="gw">
      <div className="gw-card">
        <div className="gw-rim">
          {Array.from({ length: 16 }, (_, i) => <i key={i} className={i % 2 ? "b" : ""} style={{ transform: `rotate(${i * 22.5}deg) translateY(-226px)` }} />)}
          <div className="gw-wheel" ref={wheel} style={{ background: paint, transform: `rotate(${turn}deg)`, transition: turn ? `transform ${SPIN_MS}ms cubic-bezier(0.1, 0.7, 0.1, 1)` : "none" }}>
            <div className="gw-lines" />
            {WHEEL.map((p, i) => (
              <div key={i} className={`gw-slice ${p.reward.kind}${won && i === prize ? " won" : ""}`} style={{ transform: `rotate(${i * SLICE}deg)` }}>
                <img src={rewardArt(p.reward)} alt="" draggable={false} />
                {amount(p.reward) && <b className="toon">{amount(p.reward)}</b>}
              </div>
            ))}
          </div>
          <div className="gw-hub"><b className="toon">PS</b></div>
          <div className="gw-pointer" />
        </div>

        {won ? (
          <div className="gw-side gw-won" style={{ ["--r" as string]: color(won) }}>
            <small>{RARITY[prizeRarity(won)].name}</small>
            <div className="gw-prize"><img src={rewardArt(won)} alt="" draggable={false} /></div>
            <h2 className="toon">{prizeName(won)}</h2>
            <p>{won.kind === "coins" ? "Монеты уже на счету." : won.kind === "case" ? "Кейс ждёт в разделе «Кейсы»." : "Уже в инвентаре — надень и в бой."}</p>
            <button className="gw-spin" onClick={() => { sfx.click(); setOpen(false); }}><b className="toon">Забрать</b></button>
          </div>
        ) : (
          <div className="gw-side">
            <small>Подарок за первый запуск</small>
            <h2 className="toon">Крути колесо!</h2>
            <p>Одно бесплатное вращение. Что выпадет — сразу твоё.</p>
            <ul className="gw-list">
              {WHEEL.map((p, i) => (
                <li key={i} style={{ ["--r" as string]: color(p.reward) }}>
                  <img src={rewardArt(p.reward)} alt="" draggable={false} />
                  <span>{prizeName(p.reward)}</span>
                  <i>{p.chance}%</i>
                </li>
              ))}
            </ul>
            <button className="gw-spin" disabled={prize !== null} onClick={spin}><b className="toon">{prize !== null ? "Крутим…" : "Крутить"}</b></button>
          </div>
        )}
      </div>
    </div>
  );
}
