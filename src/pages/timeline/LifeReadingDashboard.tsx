import React, { useCallback, useEffect, useRef, useState } from 'react';
import { fetchLifeReading, lifeDate, type LifeAreaRow, type LifeGrade, type LifeReadingState, type LifeWindow } from '../../lib/lifeReadingApi';

/**
 * "Your life at a glance": Part 1 of the comprehensive life reading (server doc 34 §5 Part 1, contract doc 54 §4). The
 * rule for now, then one row per active life area with the five columns of doc 34 Part 1 in plain words. Desktop: a
 * table. Phone: one swipeable card per area inside its own scroller (the page itself never scrolls sideways). Chart terms
 * (planets, periods, systems) sit only inside "Chart details" (doc 45 §3.3, §3.4).
 */

const panelCls = 'rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md sm:p-6';
const PREPARING_POLL_MS = 20_000;
const PREPARING_POLLS = 9;

export const COLUMNS = ['Area', 'What is hard right now', 'Why', 'When it turns', 'What to do'] as const;

const GRADE: Record<LifeGrade, { label: string; cls: string }> = {
  strong: { label: 'Strong', cls: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200' },
  moderate: { label: 'Moderate', cls: 'border-amber-400/40 bg-amber-500/15 text-amber-200' },
  weak: { label: 'Weak', cls: 'border-white/20 bg-white/10 text-gray-300' },
};

const VERDICT: Record<LifeAreaRow['verdict'], string> = {
  promised: 'Well supported in your chart',
  partial: 'Mixed support in your chart',
  not_written: 'Not strongly shown in your chart',
};

export const GradeBadge: React.FC<{ grade: LifeGrade; basis: string }> = ({ grade, basis }) => (
  <span title={basis} data-testid={`grade-${grade}`} className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold ${GRADE[grade].cls}`}>
    {GRADE[grade].label}
  </span>
);

function periodWords(w: LifeWindow): string | null {
  const lords = [w.md, w.ad].filter(Boolean).join('–');
  return lords ? `${lords} period${w.systems.length ? ` · ${w.systems.join(', ')}` : ''}` : null;
}

const Improves: React.FC<{ area: LifeAreaRow }> = ({ area }) => {
  if (!area.improves.length) return <p className="text-xs text-gray-400">{area.basis}</p>;
  return (
    <ul className="space-y-2">
      {area.improves.map((w) => (
        <li key={`${w.from}-${w.to}`} className="space-y-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-white">
              {lifeDate(w.from)} – {lifeDate(w.to)}
            </span>
            <GradeBadge grade={w.grade} basis={w.basis} />
          </div>
          <div className="text-[11px] text-gray-400">{w.basis}</div>
        </li>
      ))}
    </ul>
  );
};

const ChartDetails: React.FC<{ area: LifeAreaRow }> = ({ area }) => {
  const periods = area.improves.map(periodWords).filter(Boolean) as string[];
  if (!area.cause.planets.length && !area.cause.dashas.length && !periods.length) return null;
  return (
    <details className="mt-2 text-[11px] text-indigo-200/90">
      <summary className="cursor-pointer text-gray-400">Chart details</summary>
      {area.cause.planets.length > 0 && <div className="mt-1">{area.cause.planets.join(', ')}</div>}
      {area.cause.dashas.map((d) => (
        <div key={d}>{d}</div>
      ))}
      {periods.map((p) => (
        <div key={p}>Turns in: {p}</div>
      ))}
    </details>
  );
};

const Solution: React.FC<{ area: LifeAreaRow }> = ({ area }) => (
  <ul className="list-disc space-y-1 pl-4 text-xs text-gray-200">
    {area.solution.map((s) => (
      <li key={s}>{s}</li>
    ))}
  </ul>
);

const AreaTitle: React.FC<{ area: LifeAreaRow }> = ({ area }) => (
  <div>
    <div className="font-semibold text-white">{area.label}</div>
    <div className="text-[11px] text-gray-400">{VERDICT[area.verdict]}</div>
  </div>
);

const DesktopTable: React.FC<{ areas: LifeAreaRow[] }> = ({ areas }) => (
  <div className="hidden md:block" data-testid="life-table">
    <table className="w-full table-fixed border-separate border-spacing-0 text-left text-sm">
      <thead>
        <tr>
          {COLUMNS.map((c, i) => (
            <th key={c} scope="col" className={`border-b border-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-400 ${i === 0 ? 'w-[14%]' : i === 4 ? 'w-[26%]' : 'w-[20%]'}`}>
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {areas.map((a) => (
          <tr key={a.id} data-testid={`life-row-${a.id}`} className="align-top">
            <td className="border-b border-white/5 px-3 py-3">
              <AreaTitle area={a} />
            </td>
            <td className="border-b border-white/5 px-3 py-3 text-gray-200">{a.issue}</td>
            <td className="border-b border-white/5 px-3 py-3 text-gray-200">
              {a.cause.text}
              <ChartDetails area={a} />
            </td>
            <td className="border-b border-white/5 px-3 py-3">
              <Improves area={a} />
            </td>
            <td className="border-b border-white/5 px-3 py-3">
              <Solution area={a} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const PhoneCards: React.FC<{ areas: LifeAreaRow[] }> = ({ areas }) => {
  const scroller = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const onScroll = () => {
    const el = scroller.current;
    const first = el?.firstElementChild as HTMLElement | null;
    if (!el || !first || !first.offsetWidth) return;
    setActive(Math.min(areas.length - 1, Math.round(el.scrollLeft / (first.offsetWidth + 12))));
  };
  const go = (i: number) => {
    setActive(i);
    const el = scroller.current;
    const card = el?.children[i] as HTMLElement | undefined;
    if (el && card && typeof el.scrollTo === 'function') el.scrollTo({ left: card.offsetLeft - el.offsetLeft, behavior: 'smooth' });
  };
  return (
    <div className="md:hidden" data-testid="life-cards">
      <div ref={scroller} onScroll={onScroll} className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2" aria-label="Life areas">
        {areas.map((a) => (
          <article key={a.id} data-testid={`life-card-${a.id}`} aria-label={a.label} className="w-[85%] shrink-0 snap-start space-y-3 rounded-xl border border-white/10 bg-black/25 p-4">
            <AreaTitle area={a} />
            <section>
              <h5 className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{COLUMNS[1]}</h5>
              <p className="mt-1 text-sm text-gray-200">{a.issue}</p>
            </section>
            <section>
              <h5 className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{COLUMNS[2]}</h5>
              <p className="mt-1 text-sm text-gray-200">{a.cause.text}</p>
              <ChartDetails area={a} />
            </section>
            <section>
              <h5 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">{COLUMNS[3]}</h5>
              <Improves area={a} />
            </section>
            <section>
              <h5 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">{COLUMNS[4]}</h5>
              <Solution area={a} />
            </section>
          </article>
        ))}
      </div>
      {areas.length > 1 && (
        <div className="mt-2 flex flex-wrap justify-center gap-1.5" role="tablist" aria-label="Choose an area">
          {areas.map((a, i) => (
            <button
              key={a.id}
              type="button"
              role="tab"
              aria-selected={active === i}
              aria-label={a.label}
              onClick={() => go(i)}
              className={`h-2 w-2 rounded-full ${active === i ? 'bg-white' : 'bg-white/30'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

type ViewState = { kind: 'loading' } | { kind: 'error' } | LifeReadingState;

const LifeReadingDashboard: React.FC = () => {
  const [state, setState] = useState<ViewState>({ kind: 'loading' });
  const polls = useRef(0);

  const load = useCallback(async () => {
    try {
      setState(await fetchLifeReading());
    } catch {
      setState({ kind: 'error' });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // while the chart is being prepared, look again every 20 s for three minutes
  useEffect(() => {
    if (state.kind !== 'preparing' || polls.current >= PREPARING_POLLS) return;
    const t = setTimeout(() => {
      polls.current += 1;
      void load();
    }, PREPARING_POLL_MS);
    return () => clearTimeout(t);
  }, [state, load]);

  if (state.kind === 'unavailable') return null;

  const header = (
    <div className="space-y-1">
      <h4 className="text-lg font-semibold text-white">Your life at a glance</h4>
      <p className="text-sm text-gray-300">What is hard right now in each part of your life, why, when it turns, and what to do.</p>
    </div>
  );

  if (state.kind === 'loading') {
    return (
      <section className={panelCls} aria-label="Your life at a glance" aria-busy="true">
        {header}
        <p className="mt-3 text-sm text-gray-400" data-testid="life-loading">
          Reading your chart…
        </p>
      </section>
    );
  }
  if (state.kind === 'preparing') {
    return (
      <section className={panelCls} aria-label="Your life at a glance">
        {header}
        <p className="mt-3 text-sm text-gray-300" data-testid="life-preparing">
          We are still preparing your chart. This usually takes a few minutes; this card fills in by itself.
        </p>
        <button type="button" onClick={() => void load()} className="mt-3 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-gray-200 hover:bg-white/10">
          Check again
        </button>
      </section>
    );
  }
  if (state.kind === 'no_kundli') {
    return (
      <section className={panelCls} aria-label="Your life at a glance">
        {header}
        <p className="mt-3 text-sm text-gray-300" data-testid="life-no-kundli">
          Add your birth date, time and place to your profile to see your life at a glance.
        </p>
      </section>
    );
  }
  if (state.kind === 'error') {
    return (
      <section className={panelCls} aria-label="Your life at a glance">
        {header}
        <p role="alert" className="mt-3 text-sm text-red-300">
          We could not load this right now.
        </p>
        <button
          type="button"
          onClick={() => {
            setState({ kind: 'loading' });
            void load();
          }}
          className="mt-3 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2 text-sm font-semibold text-white hover:from-purple-700 hover:to-pink-700"
        >
          Try again
        </button>
      </section>
    );
  }

  const { reading } = state;
  return (
    <section className={`${panelCls} space-y-4`} aria-label="Your life at a glance" data-testid="life-dashboard">
      {header}
      {reading.rule_now && (
        <div className="rounded-xl border border-amber-400/25 bg-amber-950/20 p-3.5" data-testid="life-rule-now">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-200">The rule for now</div>
          <p className="mt-1 text-sm text-gray-100">{reading.rule_now}</p>
        </div>
      )}
      {reading.areas.length === 0 ? (
        <p className="text-sm text-gray-300" data-testid="life-quiet">
          Nothing in your chart is pressing on any part of your life right now.
        </p>
      ) : (
        <>
          <DesktopTable areas={reading.areas} />
          <PhoneCards areas={reading.areas} />
        </>
      )}
    </section>
  );
};

export default LifeReadingDashboard;
