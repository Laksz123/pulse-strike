import { useEffect, useState } from "react";
import { MISSION_BY_ID, PASS_FREE, PASS_PREMIUM, SEASON, passLevel, passProgress, seasonDaysLeft, type PassEvent } from "../arena/pass";
import { untilRefresh } from "../arena/shop";
import { sfx } from "../game/audio";
import { useStore, type Missions } from "../store";
import { RewardIcon } from "./Pass";

/** A picture for each kind of thing a mission asks for. */
function EventIcon({ e }: { e: PassEvent }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 48 48" aria-hidden>
      {e === "kill" && <><circle cx="24" cy="24" r="12" {...p} /><path d="M24 5v9M24 34v9M5 24h9M34 24h9" {...p} /></>}
      {e === "head" && <><circle cx="24" cy="24" r="16" {...p} /><circle cx="24" cy="24" r="7" {...p} /><circle cx="24" cy="24" r="2.5" fill="currentColor" /></>}
      {e === "win" && <><path d="M15 8h18v10a9 9 0 0 1-18 0Z" {...p} /><path d="M15 11H8c0 6 3 9 8 10M33 11h7c0 6-3 9-8 10M24 27v8M16 40h16" {...p} /></>}
      {e === "bomb" && <><circle cx="21" cy="29" r="13" fill="currentColor" /><path d="M30 19l6-6" {...p} /><path d="M38 9l2-4M41 12l4-1" {...p} strokeWidth={3} /></>}
      {e === "match" && <><path d="M12 6v36" {...p} /><path d="M12 9h24l-5 8 5 8H12" {...p} fill="currentColor" /></>}
    </svg>
  );
}

const clock = (sec: number) => `${Math.floor(sec / 3600)} ч ${Math.floor((sec % 3600) / 60)} мин`;

function Quest({ m }: { m: Missions["list"][number] }) {
  const claim = useStore((s) => s.claimMission);
  const def = MISSION_BY_ID[m.id];
  const done = m.n >= def.need;
  return (
    <div className={`qs-card ${def.event}${m.claimed ? " claimed" : done ? " ready" : ""}`}>
      <div className="qs-icon"><EventIcon e={def.event} /></div>
      <div className="qs-body">
        <b>{def.text}</b>
        <div className="qs-bar"><div style={{ width: `${Math.min(1, m.n / def.need) * 100}%` }} /><span>{Math.min(m.n, def.need)} / {def.need}</span></div>
      </div>
      {m.claimed ? (
        <div className="qs-reward got"><i>✓</i><span>получено</span></div>
      ) : done ? (
        <button className="qs-take" onClick={() => { sfx.coins(); claim(m.id); }}><b className="toon">Забрать</b><small>+{def.xp} опыта</small></button>
      ) : (
        <div className="qs-reward"><img src="/art/icon_pass.png" alt="" draggable={false} /><b>+{def.xp}</b><span>опыта</span></div>
      )}
    </div>
  );
}

/**
 * Missions on a page of their own: the day's three and the season's long ones, each a card that
 * says what to do, how far along it is and what it pays — and turns into a button when it is done.
 * Beside them, where that experience goes: the pass, its next rewards and the way to it.
 */
export function QuestsPage({ go }: { go?(page: "pass"): void }) {
  const missions = useStore((s) => s.missions);
  const claim = useStore((s) => s.claimMission);
  const xp = useStore((s) => s.passXp);
  const [left, setLeft] = useState(untilRefresh());
  useEffect(() => {
    const t = setInterval(() => setLeft(untilRefresh()), 30000);
    return () => clearInterval(t);
  }, []);
  const level = passLevel(xp);
  const next = Math.min(SEASON.levels, level + 1);
  const ready = [...missions.list, ...missions.season].filter((m) => !m.claimed && m.n >= MISSION_BY_ID[m.id].need);
  const dailyLeft = missions.list.filter((m) => !m.claimed).length;
  return (
    <main className="qs">
      <section className="qs-main">
        <div className="qs-head">
          <h2 className="toon">Ежедневные</h2>
          <i>{missions.list.length - dailyLeft} / {missions.list.length}</i>
          <span>новые через {clock(left)}</span>
        </div>
        <div className="qs-list">{missions.list.map((m) => <Quest key={m.id} m={m} />)}</div>
        <div className="qs-head">
          <h2 className="toon">Сезонные</h2>
          <i>{missions.season.filter((m) => m.claimed).length} / {missions.season.length}</i>
          <span>до конца сезона {seasonDaysLeft()} д</span>
        </div>
        <div className="qs-list">{missions.season.map((m) => <Quest key={m.id} m={m} />)}</div>
      </section>

      <aside className="qs-side">
        <div className="qs-pass">
          <div className="qs-pass-top">
            <img src="/art/icon_pass.png" alt="" draggable={false} />
            <div><small>Боевой пропуск</small><b className="toon">Уровень {level}</b></div>
          </div>
          <div className="bp-bar"><div style={{ width: `${passProgress(xp) * 100}%` }} /></div>
          <span className="qs-xp">{level >= SEASON.levels ? "Пропуск пройден" : `${xp % SEASON.xpPerLevel} / ${SEASON.xpPerLevel} опыта до уровня ${next}`}</span>
          <div className="qs-next">
            <small>Награды за уровень {next}</small>
            <div><RewardIcon r={PASS_FREE[next - 1]} /><RewardIcon r={PASS_PREMIUM[next - 1]} premium /></div>
          </div>
          <button className="qs-open" onClick={() => go?.("pass")}>Открыть пропуск</button>
        </div>
        {ready.length > 1 && (
          <button className="qs-all" onClick={() => { sfx.coins(); for (const m of ready) claim(m.id); }}>
            <b className="toon">Забрать всё</b><small>+{ready.reduce((n, m) => n + MISSION_BY_ID[m.id].xp, 0)} опыта</small>
          </button>
        )}
        <ol className="qs-how">
          <li><b>1</b>Играй матчи — задания считаются сами.</li>
          <li><b>2</b>Готовое задание загорается: нажми «Забрать».</li>
          <li><b>3</b>Опыт поднимает уровень пропуска, а за уровни дают кейсы, скины и монеты.</li>
        </ol>
      </aside>
    </main>
  );
}
