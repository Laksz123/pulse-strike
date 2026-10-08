import { useEffect, useRef } from "react";
import { MISSION_BY_ID, PASS_FREE, PASS_PREMIUM, SEASON, passLevel, passProgress, rewardName, rewardRarity, type Reward } from "../arena/pass";
import { RARITY } from "../arena/markers";
import { agentIcon, markerIcon } from "../arena/render";
import { CLUSTER, explorer } from "../solana/chain";
import { buyPremium, useWallet } from "../solana/wallet";
import { useStore } from "../store";

function rewardArt(r: Reward): string {
  if (r.kind === "coins") return "/art/coin.png";
  if (r.kind === "case") return "/art/case.png";
  if (r.kind === "skin") return markerIcon(r.id, r.skin);
  return agentIcon(r.id);
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

function Tile({ r, track, level }: { r: Reward; track: "free" | "premium"; level: number }) {
  const reached = useStore((s) => passLevel(s.passXp) >= level);
  const premium = useStore((s) => s.premium);
  const taken = useStore((s) => s.claimed.includes(`${track === "free" ? "f" : "p"}${level}`));
  const claim = useStore((s) => s.claimPass);
  const locked = track === "premium" && !premium;
  const ready = reached && !taken && !locked;
  const rarity = RARITY[rewardRarity(r)];
  return (
    <button
      className={`p-tile ${track}${ready ? " ready" : ""}${taken ? " taken" : ""}${!reached ? " far" : ""}${locked ? " locked" : ""}`}
      style={{ borderBottomColor: rarity.color }} disabled={!ready} onClick={() => claim(track, level)} title={rewardName(r)}
    >
      <img src={rewardArt(r)} alt="" draggable={false} />
      <span>{r.kind === "coins" ? r.n : r.kind === "case" ? (r.n > 1 ? `×${r.n}` : "Кейс") : rewardName(r).replace("Агент ", "")}</span>
      {taken && <i className="p-check">✓</i>}
      {locked && <i className="p-lock">🔒</i>}
      {ready && <i className="p-take">Забрать</i>}
    </button>
  );
}

/** Buy the premium track with SOL. */
export function PremiumButton({ big = false }: { big?: boolean }) {
  const premium = useStore((s) => s.premium);
  const sig = useStore((s) => s.premiumSig);
  const wallet = useWallet((s) => s.wallet);
  const busy = useWallet((s) => s.busy);
  if (premium) {
    return sig
      ? <a className="p-owned" href={explorer(sig)} target="_blank" rel="noreferrer">Премиум активен · транзакция ↗</a>
      : <span className="p-owned">Премиум активен</span>;
  }
  return (
    <button className={big ? "btn sol big" : "btn sol"} disabled={!!busy} onClick={() => void buyPremium()} title={wallet ? "" : "Сначала подключи кошелёк в разделе «Маркет»"}>
      {busy ? busy : <>Купить премиум · <b>{SEASON.priceSol} SOL</b></>}
    </button>
  );
}

/** The pass along the bottom of the lobby: level, progress and both tracks of rewards. */
export function PassStrip({ onOpen, full = false }: { onOpen?(): void; full?: boolean }) {
  const xp = useStore((s) => s.passXp);
  const premium = useStore((s) => s.premium);
  const claimed = useStore((s) => s.claimed);
  const claimAll = useStore((s) => s.claimAllPass);
  const error = useWallet((s) => s.error);
  const level = passLevel(xp);
  const row = useRef<HTMLDivElement>(null);
  const waiting = Array.from({ length: level }, (_, i) => i + 1).filter((l) => !claimed.includes(`f${l}`) || (premium && !claimed.includes(`p${l}`))).length;

  // Keep the level being worked on in view.
  useEffect(() => {
    const el = row.current?.children[Math.max(0, Math.min(SEASON.levels - 1, level - 1))] as HTMLElement | undefined;
    if (el && row.current) row.current.scrollLeft = Math.max(0, el.offsetLeft - 120);
  }, [level]);

  return (
    <section className={full ? "pass full" : "pass"}>
      <div className="p-head">
        <div className="p-title">
          <b>БОЕВОЙ ПРОПУСК</b>
          <small>{SEASON.name}</small>
        </div>
        <div className="p-level"><b>{level}</b><small>/ {SEASON.levels}</small></div>
        <div className="p-xp">
          <div className="bar"><div style={{ width: `${passProgress(xp) * 100}%` }} /></div>
          <small>{level >= SEASON.levels ? "Пропуск пройден" : `${xp % SEASON.xpPerLevel} / ${SEASON.xpPerLevel} опыта до уровня ${level + 1}`}{premium ? " · премиум: +20% опыта" : ""}</small>
        </div>
        {waiting > 0 && <button className="btn small gold" onClick={claimAll}>Забрать всё · {waiting}</button>}
        <PremiumButton />
        {onOpen && <button className="btn small" onClick={onOpen}>Подробнее</button>}
      </div>
      {error && !full && <div className="p-error">{error}</div>}
      <div className="p-rows">
        <div className="p-labels"><span>Бесплатно</span><span className="prem">Премиум</span></div>
        <div className="p-track" ref={row}>
          {PASS_FREE.map((r, i) => (
            <div key={i} className={`p-col${i + 1 <= level ? " done" : ""}${i + 1 === level + 1 ? " next" : ""}`}>
              <Tile r={r} track="free" level={i + 1} />
              <div className="p-num">{i + 1}</div>
              <Tile r={PASS_PREMIUM[i]} track="premium" level={i + 1} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Missions() {
  const missions = useStore((s) => s.missions);
  const claim = useStore((s) => s.claimMission);
  return (
    <div className="missions">
      <div className="missions-title">Задания дня · опыт пропуска</div>
      {missions.list.map((m) => {
        const def = MISSION_BY_ID[m.id];
        const done = m.n >= def.need;
        return (
          <div key={m.id} className={`mission${m.claimed ? " claimed" : done ? " done" : ""}`}>
            <span>{def.text}</span>
            <div className="bar"><div style={{ width: `${(m.n / def.need) * 100}%` }} /></div>
            {m.claimed ? <i>✓</i> : done ? <button className="btn small gold" onClick={() => claim(m.id)}>+{def.xp}</button> : <small>{m.n}/{def.need} · +{def.xp}</small>}
          </div>
        );
      })}
    </div>
  );
}

/** The pass page: what it is worth, and the whole track. */
export function PassPage() {
  const premium = useStore((s) => s.premium);
  const error = useWallet((s) => s.error);
  const count = (list: Reward[], kind: Reward["kind"]) => list.filter((r) => r.kind === kind).reduce((n, r) => n + ("n" in r ? r.n : 1), 0);
  return (
    <main className="pass-page">
      <section className="p-about">
        <div className="p-card">
          <h3>Бесплатный</h3>
          <ul>
            <li><b>{count(PASS_FREE, "coins")}</b> монет</li>
            <li><b>{count(PASS_FREE, "case")}</b> кейсов</li>
            <li><b>{count(PASS_FREE, "skin")}</b> скина на оружие</li>
            <li><b>{count(PASS_FREE, "agent")}</b> агента</li>
          </ul>
          <p>Доступен всем. Опыт идёт за убийства, раунды, победы и задания дня.</p>
        </div>
        <div className={premium ? "p-card prem on" : "p-card prem"}>
          <h3>Премиум · {SEASON.priceSol} SOL</h3>
          <ul>
            <li><b>{count(PASS_PREMIUM, "coins")}</b> монет</li>
            <li><b>{count(PASS_PREMIUM, "case")}</b> кейсов</li>
            <li><b>{count(PASS_PREMIUM, "skin")}</b> скинов, из них 6 — Lava и Hologram, которых нет в кейсах</li>
            <li><b>{count(PASS_PREMIUM, "agent")}</b> агента, включая Hazard и Phantom — только здесь</li>
            <li><b>+20%</b> к опыту пропуска</li>
          </ul>
          <p>Покупается один раз на сезон переводом в сети Solana ({CLUSTER}). Уже пройденные уровни открываются сразу. Эксклюзивы можно продать на маркете за SOL.</p>
          <PremiumButton big />
          {error && <div className="p-error">{error}</div>}
        </div>
        <Missions />
      </section>
      <PassStrip full />
    </main>
  );
}
