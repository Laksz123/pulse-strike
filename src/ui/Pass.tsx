import { useEffect, useRef } from "react";
import { CASE_BY_ID, caseArt } from "../arena/cases";
import { MISSION_BY_ID, PASS_FREE, PASS_PREMIUM, SEASON, passLevel, passProgress, rewardName, rewardRarity, seasonDaysLeft, type Reward } from "../arena/pass";
import { RARITY } from "../arena/markers";
import { agentIcon, markerIcon } from "../arena/render";
import { CLUSTER, explorer } from "../solana/chain";
import { buyPremium, useWallet } from "../solana/wallet";
import { sfx } from "../game/audio";
import { useStore } from "../store";

export function rewardArt(r: Reward): string {
  if (r.kind === "coins") return "/art/coin.png";
  if (r.kind === "case") return caseArt(r.id);
  if (r.kind === "skin") return markerIcon(r.id, r.skin);
  return agentIcon(r.id);
}

/** What goes under a reward's picture. */
function rewardLabel(r: Reward): string {
  if (r.kind === "coins") return String(r.n);
  if (r.kind === "case") return `${CASE_BY_ID[r.id]?.name ?? "Кейс"}${r.n > 1 ? ` ×${r.n}` : ""}`;
  return rewardName(r).replace("Агент ", "");
}

/** A small picture of a reward, for the lobby. */
export function RewardIcon({ r, premium = false }: { r: Reward; premium?: boolean }) {
  return (
    <span className={premium ? "p-mini prem" : "p-mini"} style={{ borderBottomColor: RARITY[rewardRarity(r)].color }} title={rewardName(r)}>
      <img src={rewardArt(r)} alt="" draggable={false} />
      {r.kind === "coins" && <i>{r.n}</i>}
    </span>
  );
}

/** One reward on the track: locked, on its way, ready to take, or taken. */
function Card({ r, track, level }: { r: Reward; track: "free" | "premium"; level: number }) {
  const reached = useStore((s) => passLevel(s.passXp) >= level);
  const premium = useStore((s) => s.premium);
  const taken = useStore((s) => s.claimed.includes(`${track === "free" ? "f" : "p"}${level}`));
  const claim = useStore((s) => s.claimPass);
  const locked = track === "premium" && !premium;
  const ready = reached && !taken && !locked;
  return (
    <button
      className={`bp-card ${track}${ready ? " ready" : ""}${taken ? " taken" : ""}${!reached ? " far" : ""}${locked ? " locked" : ""}`}
      style={{ ["--r" as string]: RARITY[rewardRarity(r)].color }} disabled={!ready} onClick={() => claim(track, level)} title={rewardName(r)}
    >
      <img src={rewardArt(r)} alt="" draggable={false} />
      <span>{rewardLabel(r)}</span>
      {taken && <i className="bp-check">✓</i>}
      {locked && !taken && (
        <i className="bp-lock">
          <svg viewBox="0 0 24 24" aria-hidden><path d="M7 10V7a5 5 0 0 1 10 0v3" fill="none" stroke="currentColor" strokeWidth="3" /><rect x="4.5" y="10" width="15" height="11" rx="3" fill="currentColor" /></svg>
        </i>
      )}
      {ready && <i className="bp-take">Забрать</i>}
    </button>
  );
}

/** Buy the premium track with SOL. */
export function PremiumButton() {
  const premium = useStore((s) => s.premium);
  const sig = useStore((s) => s.premiumSig);
  const wallet = useWallet((s) => s.wallet);
  const busy = useWallet((s) => s.busy);
  if (premium) {
    return sig
      ? <a className="bp-owned" href={explorer(sig)} target="_blank" rel="noreferrer">Премиум активен ↗</a>
      : <span className="bp-owned">Премиум активен</span>;
  }
  return (
    <button className="bp-buy" disabled={!!busy} onClick={() => void buyPremium()} title={wallet ? "" : "Сначала подключи кошелёк в разделе «Маркет»"}>
      {busy ? <b>{busy}</b> : <><b className="toon">Премиум</b><small>{SEASON.priceSol} SOL</small></>}
    </button>
  );
}

/**
 * The battle pass, laid out the way the big mobile games do it: one long road of levels that
 * scrolls sideways, premium rewards above it and free ones below, each with a state you can read
 * at a glance — locked, coming, ready to take, taken.
 */
export function PassPage({ go }: { go?(page: "quests" | "market" | "cases"): void }) {
  const xp = useStore((s) => s.passXp);
  const premium = useStore((s) => s.premium);
  const claimed = useStore((s) => s.claimed);
  const claimAll = useStore((s) => s.claimAllPass);
  const missions = useStore((s) => s.missions);
  const error = useWallet((s) => s.error);
  const level = passLevel(xp);
  const row = useRef<HTMLDivElement>(null);
  const waiting = Array.from({ length: level }, (_, i) => i + 1).filter((l) => !claimed.includes(`f${l}`) || (premium && !claimed.includes(`p${l}`))).length;
  const questsReady = [...missions.list, ...missions.season].filter((m) => !m.claimed && m.n >= MISSION_BY_ID[m.id].need).length;
  const count = (list: Reward[], kind: Reward["kind"]) => list.filter((r) => r.kind === kind).reduce((n, r) => n + ("n" in r ? r.n : 1), 0);

  // Open on the level being worked on; a mouse wheel moves the road sideways.
  useEffect(() => {
    const el = row.current;
    if (!el) return;
    const col = el.children[Math.max(0, Math.min(SEASON.levels - 1, level - 1))] as HTMLElement | undefined;
    if (col) el.scrollLeft = Math.max(0, col.offsetLeft - 150);
    const wheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [level]);

  return (
    <main className="bp">
      <section className="bp-top">
        <div className="bp-season">
          <img src="/art/icon_pass.png" alt="" draggable={false} />
          <div>
            <small>Сезон 1 · осталось {seasonDaysLeft()} д</small>
            <b className="toon">First Strike</b>
          </div>
        </div>
        <div className="bp-level">
          <div className="bp-badge"><b className="toon">{level}</b><small>уровень</small></div>
          <div className="bp-xp">
            <div className="bp-bar"><div style={{ width: `${passProgress(xp) * 100}%` }} /></div>
            <span>{level >= SEASON.levels ? "Пропуск пройден" : `${xp % SEASON.xpPerLevel} / ${SEASON.xpPerLevel} опыта до уровня ${level + 1}`}{premium ? " · +20% с премиумом" : ""}</span>
          </div>
        </div>
        <div className="bp-actions">
          {waiting > 0 && <button className="bp-claim" onClick={() => { sfx.coins(); claimAll(); }}><b className="toon">Забрать всё</b><i>{waiting}</i></button>}
          <button className="bp-quests" onClick={() => go?.("quests")}>
            <img src="/art/icon_quests.png" alt="" draggable={false} />
            <b>Задания</b>
            {questsReady > 0 && <i>{questsReady}</i>}
          </button>
          <PremiumButton />
        </div>
      </section>
      {error && <div className="bp-error">{error}</div>}

      <section className="bp-road">
        <div className="bp-labels">
          <div className={premium ? "prem on" : "prem"}>
            <b>Премиум</b>
            <small>{premium ? "открыт" : `${SEASON.priceSol} SOL`}</small>
          </div>
          <div className="mid" />
          <div className="free"><b>Бесплатно</b><small>всем</small></div>
        </div>
        <div className="bp-track" ref={row}>
          {PASS_FREE.map((r, i) => (
            <div key={i} className={`bp-col${i + 1 <= level ? " done" : ""}${i + 1 === level + 1 ? " next" : ""}`}>
              <Card r={PASS_PREMIUM[i]} track="premium" level={i + 1} />
              <div className="bp-node"><b>{i + 1}</b></div>
              <Card r={r} track="free" level={i + 1} />
            </div>
          ))}
        </div>
      </section>

      <section className="bp-foot">
        <div className="bp-perk"><b>Как получать уровни</b><span>Опыт идёт за убийства, раунды и победы, а больше всего — за <button onClick={() => go?.("quests")}>задания</button>.</span></div>
        <div className="bp-perk prem">
          <b>Что даёт премиум</b>
          <span>
            {count(PASS_PREMIUM, "case")} кейсов, включая Gold, Cosmos и Champion · {count(PASS_PREMIUM, "skin")} скинов и {count(PASS_PREMIUM, "agent")} агента, которых нет в кейсах · {count(PASS_PREMIUM, "coins")} монет · +20% опыта.
            Покупается один раз на сезон переводом в сети Solana ({CLUSTER}); пройденные уровни открываются сразу.
          </span>
        </div>
      </section>
    </main>
  );
}
