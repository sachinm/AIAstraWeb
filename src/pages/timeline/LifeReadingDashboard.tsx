import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchLifeReading,
  lifeDate,
  type LifeAntardashaRow,
  type LifeAntardashaTone,
  type LifeAreaCharter,
  type LifeAreaRow,
  type LifeCharterRole,
  type LifeGrade,
  type LifeMahadashaCharter,
  type LifeReadingState,
  type LifeWindow,
} from '../../lib/lifeReadingApi';

/**
 * "Your life at a glance": Part 1 of the comprehensive life reading (server doc 34 §5 Part 1, contract doc 54 §4) and
 * Part 2: "Your long-term life charter" (Remaining Largest Mahadasha & Antardasha Life-Charter).
 * Desktop: a table. Phone: one swipeable card per area inside its own scroller (the page itself never scrolls sideways).
 * Chart terms (planets, periods, systems) sit only inside "Chart details" (doc 45 §3.3, §3.4).
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

const ROLE_BADGE: Record<LifeCharterRole, { label: string; cls: string }> = {
  anchor: { label: 'Core promise', cls: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200' },
  growth: { label: 'Growth area', cls: 'border-sky-400/40 bg-sky-500/15 text-sky-200' },
  guarded: { label: 'Guard carefully', cls: 'border-amber-400/40 bg-amber-500/15 text-amber-200' },
};

const TONE_BADGE: Record<LifeAntardashaTone, { label: string; cls: string }> = {
  breakthrough: { label: 'Breakthrough window', cls: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200' },
  build: { label: 'Building phase', cls: 'border-sky-400/40 bg-sky-500/15 text-sky-200' },
  steady_work: { label: 'Steady effort', cls: 'border-indigo-400/40 bg-indigo-500/15 text-indigo-200' },
  careful: { label: 'Careful step', cls: 'border-amber-400/40 bg-amber-500/15 text-amber-200' },
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

const AreaCharterCard: React.FC<{ ac: LifeAreaCharter }> = ({ ac }) => {
  const { evidence } = ac;
  const hasEvidence = evidence.houses.length > 0 || evidence.vargas.length > 0 || evidence.planets.length > 0 || evidence.yogas.length > 0;
  return (
    <article
      data-testid={`life-charter-area-${ac.id}`}
      className="space-y-2.5 rounded-xl border border-white/10 bg-black/25 p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-semibold text-white">{ac.label}</div>
          <div className="text-[11px] text-gray-400">{VERDICT[ac.verdict]}</div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold ${ROLE_BADGE[ac.role].cls}`}>
            {ROLE_BADGE[ac.role].label}
          </span>
          <GradeBadge grade={ac.grade} basis={ac.basis} />
        </div>
      </div>
      <p className="text-sm font-medium text-gray-100">{ac.theme}</p>
      <p className="text-xs text-gray-300">{ac.promise_note}</p>
      {(ac.peak_from && ac.peak_to) || (ac.watch_from && ac.watch_to) ? (
        <div className="grid gap-1.5 text-xs sm:grid-cols-2">
          {ac.peak_from && ac.peak_to && (
            <div className="rounded-lg border border-emerald-400/20 bg-emerald-950/20 px-2.5 py-1.5 text-emerald-100">
              <span className="font-semibold text-emerald-200">Best window: </span>
              {lifeDate(ac.peak_from)} – {lifeDate(ac.peak_to)}
            </div>
          )}
          {ac.watch_from && ac.watch_to && (
            <div className="rounded-lg border border-amber-400/20 bg-amber-950/20 px-2.5 py-1.5 text-amber-100">
              <span className="font-semibold text-amber-200">Watch window: </span>
              {lifeDate(ac.watch_from)} – {lifeDate(ac.watch_to)}
            </div>
          )}
        </div>
      ) : null}
      <p className="text-xs text-gray-200">{ac.guidance}</p>
      {hasEvidence && (
        <details className="mt-1 text-[11px] text-indigo-200/90">
          <summary className="cursor-pointer text-gray-400">Chart details</summary>
          {evidence.houses.length > 0 && <div className="mt-1">Houses: {evidence.houses.map((h) => `H${h}`).join(', ')}</div>}
          {evidence.vargas.length > 0 && <div>Charts: {evidence.vargas.join(', ')}</div>}
          {evidence.planets.length > 0 && <div>Planets: {evidence.planets.join(', ')}</div>}
          {evidence.yogas.length > 0 && <div>Yogas: {evidence.yogas.join(', ')}</div>}
        </details>
      )}
    </article>
  );
};

const AntardashaCard: React.FC<{ ad: LifeAntardashaRow; testId?: string }> = ({ ad, testId = 'life-charter-ad' }) => {
  const { evidence } = ad;
  return (
    <article
      data-testid={testId}
      className={`space-y-3 rounded-xl border p-4 ${
        ad.is_current ? 'border-purple-400/40 bg-purple-950/20' : 'border-white/10 bg-black/25'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-white">
            {lifeDate(ad.from)} – {lifeDate(ad.to)}
          </span>
          {ad.is_current && (
            <span className="inline-block rounded-full border border-purple-400/40 bg-purple-500/20 px-2 py-0.5 text-[11px] font-semibold text-purple-200">
              Current period
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold ${TONE_BADGE[ad.tone].cls}`}>
            {TONE_BADGE[ad.tone].label}
          </span>
          <GradeBadge grade={ad.grade} basis={ad.basis} />
        </div>
      </div>
      <p className="text-sm text-gray-100">{ad.headline}</p>
      {ad.areas.length > 0 && (
        <ul className="space-y-2 border-t border-white/10 pt-2.5">
          {ad.areas.map((n) => (
            <li key={n.id} className="space-y-0.5 text-xs">
              <div className="font-semibold text-white">{n.label}</div>
              <div className="text-gray-200">{n.summary}</div>
              <div className="text-gray-400">{n.timing}</div>
              <div className="text-indigo-200">{n.action}</div>
            </li>
          ))}
        </ul>
      )}
      <details className="text-[11px] text-indigo-200/90">
        <summary className="cursor-pointer text-gray-400">Chart details</summary>
        <div className="mt-1">
          Period: {evidence.md}–{evidence.ad}
        </div>
        {evidence.house_from_md !== null && <div>House from chapter lord: H{evidence.house_from_md}</div>}
        {evidence.fruition_class && <div>Fruition: {evidence.fruition_class}</div>}
        {evidence.links.length > 0 && <div>Links: {evidence.links.join(', ')}</div>}
        {evidence.systems.length > 0 && <div>Systems: {evidence.systems.join(', ')}</div>}
        {evidence.annual_years.length > 0 && <div>Annual charts: {evidence.annual_years.join(', ')}</div>}
        {evidence.transit_houses.length > 0 && <div>Transit houses: {evidence.transit_houses.map((h) => `H${h}`).join(', ')}</div>}
      </details>
    </article>
  );
};

const LifeCharterSection: React.FC<{ charter: LifeMahadashaCharter }> = ({ charter }) => {
  const { evidence } = charter;
  return (
    <div className="space-y-5 border-t border-white/10 pt-5" data-testid="life-charter">
      <div className="space-y-2 rounded-xl border border-white/10 bg-black/25 p-4" data-testid="life-charter-header">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-lg font-semibold text-white">Your long-term life charter</h4>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-block rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-xs text-gray-200">
              {lifeDate(charter.from)} – {lifeDate(charter.to)} · {charter.remaining_years} yrs
            </span>
            <span className="inline-block rounded-full border border-indigo-400/35 bg-indigo-500/15 px-2.5 py-0.5 text-xs font-semibold text-indigo-200">
              {charter.is_current ? 'Current major chapter' : 'Upcoming major chapter'}
            </span>
          </div>
        </div>
        <p className="text-sm font-medium text-gray-100">{charter.headline}</p>
        <p className="text-sm text-gray-300">{charter.charter_summary}</p>
        <details className="text-[11px] text-indigo-200/90">
          <summary className="cursor-pointer text-gray-400">Chart details</summary>
          <div className="mt-1">Mahadasha: {evidence.md}</div>
          {evidence.own_houses.length > 0 && <div>Houses owned: {evidence.own_houses.map((h) => `H${h}`).join(', ')}</div>}
          {evidence.placed_house !== null && <div>Placed house: H{evidence.placed_house}</div>}
          {evidence.dispositor && <div>Dispositor: {evidence.dispositor}</div>}
          {evidence.star_lord && <div>Star lord: {evidence.star_lord}</div>}
          {evidence.avastha && <div>Avastha: {evidence.avastha}</div>}
        </details>
      </div>

      {charter.area_charters.length > 0 && (
        <div className="space-y-3" data-testid="life-charter-areas">
          <h5 className="text-sm font-semibold uppercase tracking-wide text-gray-300">Charter by area</h5>
          <div className="grid gap-3 md:grid-cols-2">
            {charter.area_charters.map((ac) => (
              <AreaCharterCard key={ac.id} ac={ac} />
            ))}
          </div>
        </div>
      )}

      {charter.bridge && (
        <div className="space-y-3 rounded-xl border border-amber-400/20 bg-amber-950/15 p-4" data-testid="life-charter-bridge">
          <h5 className="text-sm font-semibold text-amber-200">
            Closing your current chapter ({lifeDate(charter.bridge.from)} – {lifeDate(charter.bridge.to)})
          </h5>
          <p className="text-xs text-gray-200">{charter.bridge.summary}</p>
          {charter.bridge.antardashas.length > 0 && (
            <div className="space-y-2.5">
              {charter.bridge.antardashas.map((ad) => (
                <AntardashaCard key={`${ad.from}-${ad.to}`} ad={ad} testId="life-charter-bridge-ad" />
              ))}
            </div>
          )}
        </div>
      )}

      {charter.antardashas.length > 0 && (
        <div className="space-y-3" data-testid="life-charter-timeline">
          <h5 className="text-sm font-semibold uppercase tracking-wide text-gray-300">Sub-periods across this chapter</h5>
          <div className="space-y-3">
            {charter.antardashas.map((ad) => (
              <AntardashaCard key={`${ad.from}-${ad.to}`} ad={ad} />
            ))}
          </div>
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
      {reading.charter && <LifeCharterSection charter={reading.charter} />}
    </section>
  );
};

export default LifeReadingDashboard;
