/**
 * Today, the home of the boards (server docs/reading-engine/45 §4.1, Phase 0). One line for now, then one card per
 * board with its tone and next date. Work is live (career map Phase 1); You and Love say plainly that they come next.
 * Lucky times shows the running window and the person's plans for today. No place text, no explanations.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchCareer, type CareerState } from '../../lib/careerApi';
import { clock, fetchLuckyRange, fetchLuckySetup, type LuckyRange, type LuckySetup } from '../../lib/luckyApi';
import { track } from '../../lib/events';
import { headline, TONE_WORD } from '../work/WorkPage';
import { GOOD_PLAIN } from '../lucky/words';

const panel = 'rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md sm:p-5';
const SURFACE = 'today';

export function todayTitle(d: Date = new Date()): string {
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
}

export default function TodayPage() {
  const [career, setCareer] = useState<CareerState | null>(null);
  const [lucky, setLucky] = useState<{ setup: LuckySetup; range: LuckyRange | null } | null>(null);

  useEffect(() => {
    track('page_view', SURFACE);
    if (import.meta.env.VITE_AREA_ENABLED === '1') fetchCareer().then(setCareer).catch(() => setCareer({ kind: 'unavailable' }));
    if (import.meta.env.VITE_LUCKY_ENABLED === '1')
      fetchLuckySetup()
        .then(async (setup) => {
          if (!setup) return;
          const range = setup.place ? await fetchLuckyRange().catch(() => null) : null;
          setLucky({ setup, range });
        })
        .catch(() => undefined);
  }, []);

  const now = lucky?.range?.now;
  const line =
    now?.kind === 'avoid'
      ? `Better to wait until ${clock(now.until)} before starting anything new.`
      : now?.kind === 'good'
        ? `${GOOD_PLAIN[now.what]} now, until ${clock(now.until)}.`
        : career?.kind === 'ok'
          ? headline(career.map)
          : 'Here is where things stand today.';

  const labelOf = (id: string) => lucky?.setup.scenarios.flatMap((g) => g.scenarios).find((s) => s.id === id)?.label ?? id;
  const todayRow = lucky?.range?.days.find((d) => d.date === lucky.range!.today);
  const plans = (lucky?.setup.picks ?? []).filter((p) => p.shown);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-28 pt-4 text-white sm:px-6" data-testid="today-page">
      <div className="text-sm text-white/60">{todayTitle()}</div>
      <h1 className="mt-1 text-2xl font-semibold leading-snug" data-testid="today-line">{line}</h1>

      <div className="mt-5 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-3 sm:overflow-visible">
        <BoardCard to="/profile" title="You" tone={null} body="Who you are and the chapter you are in. Coming next." onOpen={() => track('board_open', SURFACE, 'you')} />
        <BoardCard to="/dashboard/love" title="Love" tone={null} body="Meeting, keeping and mending. Coming next." onOpen={() => track('board_open', SURFACE, 'love')} />
        <BoardCard
          to="/dashboard/work"
          title="Work"
          tone={career?.kind === 'ok' ? TONE_WORD[career.map.present.tone] : null}
          body={career?.kind === 'ok' ? headline(career.map) : career?.kind === 'not_ready' ? 'Your chart is being prepared.' : 'Your work map.'}
          onOpen={() => track('board_open', SURFACE, 'work')}
        />
      </div>

      {lucky && (
        <Link to="/dashboard/lucky" onClick={() => track('board_open', SURFACE, 'lucky')} className={`${panel} mt-4 block hover:bg-white/10`} data-testid="today-lucky">
          <div className="text-xs uppercase tracking-wide text-white/50">Lucky times today</div>
          {plans.length === 0 ? (
            <div className="mt-1 text-white/80">Add what you are planning to see its good times.</div>
          ) : (
            <ul className="mt-1 space-y-1">
              {plans.slice(0, 3).map((p) => {
                const w = todayRow?.layers[p.scenario]?.windows[0];
                return (
                  <li key={p.scenario} className="flex justify-between gap-3">
                    <span>{labelOf(p.scenario)}</span>
                    <span className="tabular-nums text-white/70">{w ? `${clock(w.from)}–${clock(w.to)}` : 'Not today'}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Link>
      )}
    </div>
  );
}

function BoardCard({ to, title, tone, body, onOpen }: { to: string; title: string; tone: string | null; body: string; onOpen: () => void }) {
  return (
    <Link to={to} onClick={onOpen} className={`${panel} block w-[85%] shrink-0 snap-start hover:bg-white/10 sm:w-auto`} data-testid={`board-${title.toLowerCase()}`}>
      <div className="flex items-center justify-between">
        <span className="text-lg font-semibold">{title}</span>
        {tone && <span className="text-xs uppercase tracking-wide text-white/60">{tone}</span>}
      </div>
      <div className="mt-2 text-sm text-white/75">{body}</div>
    </Link>
  );
}
