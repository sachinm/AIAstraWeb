/**
 * Lucky times v1 (server docs/reading-engine/49). The person sets a place once, adds the plans they care about from a
 * list of confident scenarios, and sees each plan's good times as its own layer: Today, and a three-week calendar
 * (last week, this week, next week). No month view. No place text on the board. Traditional names only in Why.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  addLuckyPick,
  clock,
  fetchLuckyRange,
  fetchLuckySetup,
  patchLuckyPick,
  removeLuckyPick,
  setLuckyPlace,
  type LuckyDay,
  type LuckyRange,
  type LuckySetup,
  type LuckyWindow,
  type Pick,
  type ScenarioEntry,
} from '../../lib/luckyApi';
import { track } from '../../lib/events';
import BoardAsk from '../../components/BoardAsk';
import { ASK, AVOID_NAME, AVOID_PLAIN, GOOD_NAME, GOOD_PLAIN, LAYER_COLOURS, plainReasons, SHORT_DAY, SOURCE_LINE, whyLines } from './words';

const panel = 'rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md sm:p-5';
const chipBase = 'inline-flex min-h-[44px] items-center gap-2 rounded-full border px-4 text-sm transition-colors';
const SURFACE = 'lucky';

type View = 'today' | 'calendar';
type Week = 'last' | 'this' | 'next';

interface WhyState {
  title: string;
  when: string;
  lines: string[];
}

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const dayNum = (iso: string) => String(Number(iso.slice(8, 10)));
const prettyDay = (d: LuckyDay) => `${d.weekday ?? ''} ${dayNum(d.date)}`.trim();

export default function LuckyTimesPage() {
  const [setup, setSetup] = useState<LuckySetup | null | undefined>(undefined);
  const [range, setRange] = useState<LuckyRange | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>('today');
  const [week, setWeek] = useState<Week>('this');
  const [menuOpen, setMenuOpen] = useState(false);
  const [asking, setAsking] = useState<string | null>(null);
  const [why, setWhy] = useState<WhyState | null>(null);
  const [placeOpen, setPlaceOpen] = useState(false);

  const scenarios = useMemo(() => {
    const m = new Map<string, ScenarioEntry & { area: string }>();
    for (const g of setup?.scenarios ?? []) for (const s of g.scenarios) m.set(s.id, { ...s, area: g.area });
    return m;
  }, [setup]);
  const colourOf = useCallback((id: string) => LAYER_COLOURS[(setup?.picks.findIndex((p) => p.scenario === id) ?? 0) % LAYER_COLOURS.length]!, [setup]);

  const loadRange = useCallback(async () => {
    try {
      setRange(await fetchLuckyRange());
    } catch (e) {
      setError('We could not load your times. Try again in a moment.');
    }
  }, []);

  useEffect(() => {
    track('page_view', SURFACE);
    fetchLuckySetup()
      .then((s) => {
        setSetup(s);
        if (s && !s.place) setPlaceOpen(true);
      })
      .catch(() => setError('We could not load Lucky times. Try again in a moment.'));
  }, []);

  useEffect(() => {
    if (setup?.place) void loadRange();
  }, [setup?.place, loadRange]);

  const updatePick = (scenario: string, next: Partial<Pick> | null) =>
    setSetup((s) => {
      if (!s) return s;
      if (next === null) return { ...s, picks: s.picks.filter((p) => p.scenario !== scenario) };
      const exists = s.picks.some((p) => p.scenario === scenario);
      return {
        ...s,
        picks: exists ? s.picks.map((p) => (p.scenario === scenario ? { ...p, ...next } : p)) : [...s.picks, { scenario, shown: true, answers: {}, ...next }],
      };
    });

  const choosePlace = async (key: string) => {
    await setLuckyPlace(key);
    track('place_set', SURFACE, key);
    setPlaceOpen(false);
    setSetup((s) => (s ? { ...s, place: key } : s));
  };

  const add = async (id: string) => {
    setMenuOpen(false);
    const r = await addLuckyPick(id).catch(() => null);
    if (!r) return;
    track('scenario_add', SURFACE, id, { area: scenarios.get(id)?.area ?? '' });
    updatePick(id, r.pick);
    if (scenarios.get(id)?.ask) setAsking(id);
    void loadRange();
  };

  const answer = async (id: string, kind: string, value: string) => {
    await patchLuckyPick(id, { answers: { [kind]: value } }).catch(() => null);
    track('scenario_answer', SURFACE, id, { kind, value });
    updatePick(id, { answers: { ...(setup?.picks.find((p) => p.scenario === id)?.answers ?? {}), [kind]: value } });
    setAsking(null);
  };

  const toggle = async (p: Pick) => {
    const shown = !p.shown;
    updatePick(p.scenario, { shown });
    track('scenario_layer_toggle', SURFACE, p.scenario, { shown });
    await patchLuckyPick(p.scenario, { shown }).catch(() => null);
    void loadRange();
  };

  const remove = async (id: string) => {
    updatePick(id, null);
    track('scenario_remove', SURFACE, id);
    await removeLuckyPick(id).catch(() => null);
    void loadRange();
  };

  const openWhy = (title: string, when: string, lines: string[], target: string) => {
    track('why_open', SURFACE, target);
    setWhy({ title, when, lines });
  };

  if (setup === undefined) return <div className="p-6 text-white/70">Loading…</div>;
  if (setup === null) return <div className={`${panel} m-4 text-white/80`}>Lucky times is coming soon.</div>;

  const picks = setup.picks;
  const shownPicks = picks.filter((p) => p.shown && scenarios.has(p.scenario));
  const unpicked = setup.scenarios.map((g) => ({ ...g, scenarios: g.scenarios.filter((s) => !picks.some((p) => p.scenario === s.id)) })).filter((g) => g.scenarios.length);
  const today = range?.days.find((d) => d.date === range.today) ?? null;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-24 pt-4 text-white sm:px-6" data-testid="lucky-page">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-3xl font-bold text-transparent">Lucky times</h1>
        <div className="flex items-center gap-2">
        <BoardAsk category="lucky" />
        <button type="button" aria-label="Settings" onClick={() => setPlaceOpen(true)} className="min-h-[44px] min-w-[44px] rounded-full border border-white/10 bg-white/5 text-white/80">
          ⚙
        </button>
        </div>
      </div>

      {/* plans: chips with their layer colour, and Add */}
      <section aria-label="Your plans" className="mb-4">
        {picks.length === 0 ? (
          <div className={`${panel} flex flex-col items-start gap-3`}>
            <h2 className="text-xl font-semibold">What are you planning?</h2>
            <p className="text-white/70">Add the things you have coming up. We'll show the good times for each.</p>
            <AddButton open={menuOpen} setOpen={(o) => { setMenuOpen(o); if (o) track('add_menu_open', SURFACE); }} groups={unpicked} onPick={add} />
          </div>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-1" role="list">
            {picks.filter((p) => scenarios.has(p.scenario)).map((p) => (
              <div key={p.scenario} role="listitem" className={`${chipBase} shrink-0 ${p.shown ? 'border-white/40 bg-white/10' : 'border-white/10 bg-transparent text-white/50'}`}>
                <button type="button" aria-pressed={p.shown} onClick={() => void toggle(p)} className="flex min-h-[44px] items-center gap-2">
                  <span aria-hidden className="h-3 w-3 rounded-full" style={{ background: colourOf(p.scenario), opacity: p.shown ? 1 : 0.35 }} />
                  {scenarios.get(p.scenario)!.label}
                </button>
                <button type="button" aria-label={`Remove ${scenarios.get(p.scenario)!.label}`} onClick={() => void remove(p.scenario)} className="min-h-[44px] px-1 text-white/50 hover:text-white">
                  ×
                </button>
              </div>
            ))}
            <AddButton compact open={menuOpen} setOpen={(o) => { setMenuOpen(o); if (o) track('add_menu_open', SURFACE); }} groups={unpicked} onPick={add} />
          </div>
        )}
      </section>

      {asking && scenarios.get(asking)?.ask && (
        <AskCard scenario={scenarios.get(asking)!} onAnswer={(k, v) => void answer(asking, k, v)} />
      )}

      {picks.length > 0 && (
        <>
          <div role="tablist" aria-label="View" className="mb-4 inline-flex rounded-xl border border-white/10 bg-white/5 p-1">
            {(['today', 'calendar'] as View[]).map((v) => (
              <button
                key={v}
                role="tab"
                aria-selected={view === v}
                type="button"
                onClick={() => { setView(v); track('view_select', SURFACE, v); }}
                className={`min-h-[44px] rounded-lg px-5 text-sm ${view === v ? 'bg-white/15 text-white' : 'text-white/60'}`}
              >
                {v === 'today' ? 'Today' : 'Calendar'}
              </button>
            ))}
          </div>

          {error && <div className={`${panel} mb-4 text-amber-200`}>{error}</div>}
          {!range && !error && <div className="text-white/60">Getting your times…</div>}

          {range && view === 'today' && (
            <TodayView range={range} today={today} picks={shownPicks} labelOf={(id) => scenarios.get(id)?.label ?? id} colourOf={colourOf} openWhy={openWhy} />
          )}
          {range && view === 'calendar' && (
            <CalendarView range={range} week={week} setWeek={(w) => { setWeek(w); track('week_select', SURFACE, w); }} picks={shownPicks} labelOf={(id) => scenarios.get(id)?.label ?? id} colourOf={colourOf} openWhy={openWhy} />
          )}
        </>
      )}

      {placeOpen && <PlaceSheet places={setup.places} current={setup.place} onPick={(k) => void choosePlace(k)} onClose={setup.place ? () => setPlaceOpen(false) : undefined} />}
      {why && <WhySheet why={why} onClose={() => setWhy(null)} />}
    </div>
  );
}

function AddButton(props: { open: boolean; setOpen: (o: boolean) => void; groups: LuckySetup['scenarios']; onPick: (id: string) => void; compact?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!props.open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) props.setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [props]);
  if (props.groups.length === 0) return null;
  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={props.open}
        onClick={() => props.setOpen(!props.open)}
        className={`${chipBase} border-purple-400/60 bg-gradient-to-r from-purple-600 to-pink-600 font-medium text-white`}
      >
        + {props.compact ? 'Add' : 'Add a plan'}
      </button>
      {props.open && (
        <div role="menu" aria-label="Add a plan" className="absolute left-0 z-30 mt-2 max-h-[60vh] w-72 overflow-y-auto rounded-2xl border border-white/10 bg-[#141233] p-2 shadow-xl">
          {props.groups.map((g) => (
            <div key={g.area} className="mb-1">
              <div className="px-3 pb-1 pt-2 text-xs uppercase tracking-wide text-white/50">{g.label}</div>
              {g.scenarios.map((s) => (
                <button key={s.id} role="menuitem" type="button" onClick={() => props.onPick(s.id)} className="block min-h-[44px] w-full rounded-lg px-3 text-left text-white/90 hover:bg-white/10">
                  {s.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AskCard({ scenario, onAnswer }: { scenario: ScenarioEntry; onAnswer: (kind: string, value: string) => void }) {
  const q = ASK[scenario.ask!]!;
  return (
    <div className={`${panel} mb-4`} data-testid="ask-card">
      <div className="mb-3 font-medium">{q.question}</div>
      <div className="flex flex-wrap gap-2">
        {q.options.map((o) => (
          <button key={o.key} type="button" onClick={() => onAnswer(scenario.ask!, o.key)} className={`${chipBase} border-white/20 bg-white/5`}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function bestNext(range: LuckyRange, scenario: string): { day: LuckyDay; w: LuckyWindow } | null {
  for (const d of range.days) {
    if (d.date <= range.today) continue;
    const w = d.layers[scenario]?.windows[0];
    if (w) return { day: d, w };
  }
  return null;
}

function TodayView(props: { range: LuckyRange; today: LuckyDay | null; picks: Pick[]; labelOf: (id: string) => string; colourOf: (id: string) => string; openWhy: (t: string, w: string, l: string[], target: string) => void }) {
  const { range, today } = props;
  if (!today) return <div className={panel}>Today's times are being prepared.</div>;
  const now = range.now;
  const nowLine =
    now?.kind === 'avoid'
      ? `Better to wait until ${clock(now.until)}`
      : now?.kind === 'good'
        ? `${GOOD_PLAIN[now.what]} · until ${clock(now.until)}`
        : now?.next
          ? `A steady stretch · next good time ${clock(now.next.from)}`
          : 'A steady stretch';
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className={`${panel} lg:col-span-1`} data-testid="now-card">
        <div className="text-xs uppercase tracking-wide text-white/50">Right now</div>
        <div className="mt-1 text-lg font-semibold">{nowLine}</div>
        <div className="mt-4 text-xs uppercase tracking-wide text-white/50">Better to wait today</div>
        <ul className="mt-1 space-y-1">
          {today.avoid.filter((a) => a.from < 22 * 60).map((a, i) => (
            <li key={i}>
              <button type="button" onClick={() => props.openWhy(AVOID_PLAIN[a.kind] ?? 'A hold band', `${clock(a.from)}–${clock(a.to)}`, [`${AVOID_NAME[a.kind] ?? a.kind}: the texts advise against starting anything here.`], a.kind)} className="flex min-h-[44px] w-full items-center justify-between gap-2 rounded-lg px-2 text-left text-white/80 hover:bg-white/5">
                <span>{AVOID_PLAIN[a.kind] ?? 'A hold band'}</span>
                <span className="tabular-nums text-white/60">{clock(a.from)}–{clock(a.to)}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="grid gap-3 lg:col-span-2">
        {props.picks.length === 0 && <div className={panel}>All your plans are hidden. Tap a plan above to show it.</div>}
        {props.picks.map((p) => {
          const layer = today.layers[p.scenario];
          const next = bestNext(range, p.scenario);
          return (
            <div key={p.scenario} className={panel} data-testid={`today-${p.scenario}`}>
              <div className="mb-2 flex items-center gap-2">
                <span aria-hidden className="h-3 w-3 rounded-full" style={{ background: props.colourOf(p.scenario) }} />
                <h3 className="font-semibold">{props.labelOf(p.scenario)}</h3>
              </div>
              {layer?.windows.length ? (
                <ul className="space-y-1">
                  {layer.windows.map((w, i) => (
                    <li key={i}>
                      <button
                        type="button"
                        onClick={() => props.openWhy(props.labelOf(p.scenario), `Today ${clock(w.from)}–${clock(w.to)}`, whyLines(w.reasons), p.scenario)}
                        className="flex min-h-[44px] w-full flex-col items-start rounded-lg px-2 py-1 text-left hover:bg-white/5"
                      >
                        <span className="tabular-nums text-lg">{clock(w.from)}–{clock(w.to)}</span>
                        <span className="text-sm text-white/70">{plainReasons(w.reasons)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-white/80">
                  Not today.
                  {next ? (
                    <button type="button" onClick={() => props.openWhy(props.labelOf(p.scenario), `${prettyDay(next.day)} ${clock(next.w.from)}–${clock(next.w.to)}`, whyLines(next.w.reasons), p.scenario)} className="ml-1 min-h-[44px] underline decoration-white/30 underline-offset-4">
                      Next: {prettyDay(next.day)} {clock(next.w.from)}–{clock(next.w.to)}
                    </button>
                  ) : (
                    <span className="ml-1 text-white/60">Nothing strong in the next two weeks.</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const GRID_FROM = 6 * 60;
const GRID_TO = 22 * 60;

function CalendarView(props: { range: LuckyRange; week: Week; setWeek: (w: Week) => void; picks: Pick[]; labelOf: (id: string) => string; colourOf: (id: string) => string; openWhy: (t: string, w: string, l: string[], target: string) => void }) {
  const { range } = props;
  const span: Record<Week, [string, string]> = {
    last: [addDays(range.today, -7), addDays(range.today, -1)],
    this: [range.today, addDays(range.today, 6)],
    next: [addDays(range.today, 7), addDays(range.today, 14)],
  };
  const [from, to] = span[props.week];
  const days = range.days.filter((d) => d.date >= from && d.date <= to);
  const pct = (m: number) => `${((Math.min(Math.max(m, GRID_FROM), GRID_TO) - GRID_FROM) / (GRID_TO - GRID_FROM)) * 100}%`;
  const height = (a: number, b: number) => `${((Math.min(b, GRID_TO) - Math.max(a, GRID_FROM)) / (GRID_TO - GRID_FROM)) * 100}%`;
  return (
    <div>
      <div role="tablist" aria-label="Week" className="mb-3 flex gap-2 overflow-x-auto">
        {(['last', 'this', 'next'] as Week[]).map((w) => (
          <button key={w} role="tab" aria-selected={props.week === w} type="button" onClick={() => props.setWeek(w)} className={`${chipBase} shrink-0 ${props.week === w ? 'border-white/40 bg-white/15' : 'border-white/10 text-white/60'}`}>
            {w === 'last' ? 'Last week' : w === 'this' ? 'This week' : 'Next week'}
          </button>
        ))}
      </div>
      <div className={`${panel} overflow-x-auto`}>
        <div className="flex min-w-[340px]">
          <div className="relative w-8 shrink-0 text-[10px] text-white/40" style={{ height: 480 }}>
            {[6, 9, 12, 15, 18, 21].map((h) => (
              <div key={h} className="absolute -translate-y-1/2" style={{ top: pct(h * 60) }}>
                {String(h).padStart(2, '0')}
              </div>
            ))}
          </div>
          <div className="grid flex-1 gap-1" style={{ gridTemplateColumns: `repeat(${days.length || 1}, minmax(0, 1fr))` }}>
            {days.map((d) => (
              <div key={d.date} className="min-w-0">
                <div className={`mb-1 text-center text-xs ${d.date === range.today ? 'font-bold text-white' : 'text-white/60'}`}>
                  {SHORT_DAY[d.weekday ?? ''] ?? ''} {dayNum(d.date)}
                </div>
                <div className="relative rounded-md bg-white/[0.03]" style={{ height: 480 }} data-testid={`day-${d.date}`}>
                  {d.avoid.map((a, i) => (
                    <button
                      key={`a${i}`}
                      type="button"
                      aria-label={`${AVOID_PLAIN[a.kind] ?? 'Hold'} ${clock(a.from)} to ${clock(a.to)}`}
                      onClick={() => props.openWhy(AVOID_PLAIN[a.kind] ?? 'A hold band', `${prettyDay(d)} ${clock(a.from)}–${clock(a.to)}`, [`${AVOID_NAME[a.kind] ?? a.kind}: the texts advise against starting anything here.`], a.kind)}
                      className="absolute inset-x-0 rounded-sm border border-dashed border-amber-300/40"
                      style={{ top: pct(a.from), height: height(a.from, a.to), background: 'repeating-linear-gradient(135deg, rgba(251,191,36,0.18) 0 4px, transparent 4px 8px)' }}
                    />
                  ))}
                  {d.good.filter((g) => g.kind !== 'brahma').map((g, i) => (
                    <div key={`g${i}`} aria-hidden className="absolute inset-x-0 border-l-2 border-white/30" style={{ top: pct(g.from), height: height(g.from, g.to) }} title={GOOD_NAME[g.kind]} />
                  ))}
                  {props.picks.map((p, li) =>
                    (d.layers[p.scenario]?.windows ?? []).map((w, i) => (
                      <button
                        key={`${p.scenario}${i}`}
                        type="button"
                        aria-label={`${props.labelOf(p.scenario)} ${clock(w.from)} to ${clock(w.to)}`}
                        onClick={() => props.openWhy(props.labelOf(p.scenario), `${prettyDay(d)} ${clock(w.from)}–${clock(w.to)}`, whyLines(w.reasons), p.scenario)}
                        className="absolute rounded-sm"
                        style={{
                          top: pct(w.from),
                          height: height(w.from, w.to),
                          left: `${(li % 3) * 12}%`,
                          right: `${Math.max(0, 24 - (li % 3) * 12)}%`,
                          background: props.colourOf(p.scenario),
                          opacity: 0.85,
                        }}
                      />
                    )),
                  )}
                  {d.date === range.today && range.nowMin >= GRID_FROM && range.nowMin <= GRID_TO && (
                    <div aria-hidden className="absolute inset-x-0 h-0.5 bg-red-400" style={{ top: pct(range.nowMin) }} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-white/60">
          {props.picks.map((p) => (
            <span key={p.scenario} className="inline-flex items-center gap-1">
              <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: props.colourOf(p.scenario) }} />
              {props.labelOf(p.scenario)}
            </span>
          ))}
          <span className="inline-flex items-center gap-1">
            <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: 'repeating-linear-gradient(135deg, rgba(251,191,36,0.5) 0 2px, transparent 2px 4px)' }} />
            Better to wait
          </span>
        </div>
      </div>
    </div>
  );
}

function Sheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose?: () => void }) {
  useEffect(() => {
    if (!onClose) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="w-full max-w-md rounded-t-3xl border border-white/10 bg-[#141233] p-5 text-white sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          {onClose && (
            <button type="button" onClick={onClose} className="min-h-[44px] min-w-[44px] text-white/60" aria-label="Close">
              ✕
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

function PlaceSheet({ places, current, onPick, onClose }: { places: Array<{ key: string; name: string }>; current: string | null; onPick: (k: string) => void; onClose?: () => void }) {
  return (
    <Sheet title="Where are you?" onClose={onClose}>
      <p className="mb-3 text-sm text-white/60">Set once; your times follow it.</p>
      <div className="grid gap-2">
        {places.map((p) => (
          <button key={p.key} type="button" onClick={() => onPick(p.key)} className={`min-h-[48px] rounded-xl border px-4 text-left ${current === p.key ? 'border-purple-400 bg-white/10' : 'border-white/10 bg-white/5'}`}>
            {p.name.replace(/, (US|IN)$/, '')}
          </button>
        ))}
      </div>
    </Sheet>
  );
}

function WhySheet({ why, onClose }: { why: WhyState; onClose: () => void }) {
  return (
    <Sheet title={why.title} onClose={onClose}>
      <div data-testid="why-sheet">
        <div className="mb-3 tabular-nums text-white/80">{why.when}</div>
        <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-white/80">
          {why.lines.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
        <div className="text-xs text-white/40">{SOURCE_LINE}</div>
      </div>
    </Sheet>
  );
}
