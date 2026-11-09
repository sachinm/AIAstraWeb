/**
 * "Your reading", the first tab of the You board (server docs/reading-engine/58 §4.3–§4.4, card contract doc 62): each
 * panel is a card of one to three dated lines under a header range, read on the person's own clock. Plain words first;
 * chart terms, claim ids and vetoed claims only behind "Chart details". On a phone the panels are a swipe carousel with
 * chips and dots, on a desktop a vertical tab list beside the panel (doc 45 rule 11). The reading's `gaps`, `purview`
 * and `audit` are never rendered to the person; a purview entry shows only as "Adjusted by a whole-chart check" inside
 * the affected panel's Chart details. Panels render in the order the server sends them.
 */
import { useEffect, useRef, useState } from 'react';
import { longDate } from '../../lib/careerApi';
import { OracleVeil, OracleWaitLine } from './OracleWait';
import { renderInline } from './readingMarkdown';
import { track } from '../../lib/events';
import {
  fetchSelfReading,
  sendSelfConfirm,
  setSelfClock,
  type LineCertainty,
  type LineRange,
  type PreparingStage,
  type SelfAnswer,
  type SelfArea,
  type SelfPanelPlan,
  type SelfChapter,
  type SelfLine,
  type SelfPanel,
  type SelfQuestion,
  type SelfReading as SelfReadingData,
  type SelfReadingState,
} from '../../lib/selfReadingApi';

const panelCls = 'glass glass-lift rounded-2xl p-4 sm:p-5';
const chip = 'inline-flex min-h-[44px] shrink-0 items-center rounded-full border px-4 text-sm';
const SURFACE = 'you';
/** the chart (digest) is checked every 30 s; the synthesis being written in the background every 10 s (server doc 64 §4) */
export const POLL_MS: Record<PreparingStage, number> = { chart: 30_000, reading: 10_000 };
/** after this long waiting, the page says so and offers Retry instead of polling forever */
export const MAX_WAIT_MS = 6 * 60_000;

export const SELF_WORDS = {
  loading: 'Reading your chart…',
  preparing: 'Your chart is still being prepared. This page will update by itself.',
  writing: 'Your reading is being written. It usually takes a minute or two and will appear here by itself.',
  tookTooLong: 'Your reading is taking longer than usual.',
  planTitle: 'What to do with this',
  calendarTitle: 'Dates to mark',
  noKundli: 'Add your birth details in your profile to see your reading.',
  unavailable: 'Your reading is coming soon.',
  error: 'Your reading did not load.',
  failed: 'This part could not be read just now.',
  withheldPanel: 'Not enough in your chart to say this with confidence.',
  split: 'Your other clocks do not mark a turn here',
  thanks: 'Thanks, noted.',
} as const;

/** A clock label as shown to the person: the system's name, never the word "dasha". */
export function clockLabel(label: string): string {
  return label.replace(/\s*\b(maha)?dasha\b/gi, '').trim() || label;
}

/** "A", "A and B", "A, B and C" */
function joinAnd(xs: string[]): string {
  if (xs.length <= 1) return xs[0] ?? '';
  return `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
}

/** "Confirmed by Vimshottari and Chara" from the clocks that agree; null when none do. */
export function confirmedLine(ch: SelfChapter): string | null {
  const labels = ch.confirmations.filter((c) => c.agrees).map((c) => clockLabel(c.label));
  return labels.length ? `Confirmed by ${joinAnd(labels)}` : null;
}

const range = (from: string, to: string) => `${longDate(from)} – ${longDate(to)}`;

/** The card's header range in words (doc 62): "Always", "This year: 9 Sep 2026 – 9 Sep 2027", "True until 1 Jan 2027". */
export function headerWords(panelId: string, r: LineRange, today: string): string {
  if (r === 'always') return 'Always';
  if (panelId === 'year') return `This year: ${range(r.from, r.to)}`;
  if (r.from <= today) return `True until ${longDate(r.to)}`;
  return `True from ${longDate(r.from)} to ${longDate(r.to)}`;
}

/** A line's own range in words, shown only when it differs from the card's header. */
export function rangeWords(r: LineRange): string {
  return r === 'always' ? 'Always' : range(r.from, r.to);
}

export function sameRange(a: LineRange, b: LineRange): boolean {
  if (a === 'always' || b === 'always') return a === b;
  return a.from === b.from && a.to === b.to;
}

const CERTAINTY_WORD: Record<Exclude<LineCertainty, 'fact'>, string> = { strong: 'Strong', moderate: 'Likely', possible: 'Possible' };

/** The certainty word, on timing (dated) lines only and never for a fact. */
export function certaintyWord(line: SelfLine): string | null {
  if (line.range === 'always' || line.certainty === 'fact') return null;
  return CERTAINTY_WORD[line.certainty] ?? null;
}

/** Purview texts that touch this panel (by panel id, or a line or claim id under it), for Chart details only. */
function adjustedFor(panelId: string, purview: SelfReadingData['purview'] | undefined): string[] {
  return (purview ?? []).filter((p) => p.affects.some((a) => a === panelId || a.startsWith(`${panelId}.`))).map((p) => p.text);
}

function Skeleton({ words, testId, stage }: { words: string; testId: string; stage?: PreparingStage }) {
  return (
    <div data-testid={testId} data-stage={stage} aria-busy="true" role="status">
      <p className="mb-3 text-white/70">{words}</p>
      <div className="flex gap-2 overflow-hidden" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="h-11 w-28 shrink-0 animate-pulse rounded-full bg-white/10" />
        ))}
      </div>
      <div className="mt-3 h-40 animate-pulse rounded-2xl bg-white/5" aria-hidden="true" />
    </div>
  );
}

export default function SelfReading() {
  const [state, setState] = useState<SelfReadingState | null>(null);
  const [waited, setWaited] = useState(0);
  const startedAt = useRef<number>(Date.now());

  const load = () =>
    fetchSelfReading()
      .then(setState)
      .catch(() => setState({ kind: 'error' }));

  useEffect(() => {
    void load();
  }, []);
  // something is still being built: the chart is checked every 30 s, the synthesis every 10 s, for up to six minutes;
  // after that the page says so and offers Retry (the build goes on behind it)
  // the code panels are shown while the Oracle's synthesis is written (oracle pending): checked every 10 s the same way
  const oraclePending = state?.kind === 'ok' && state.reading.oracle?.status === 'pending';
  useEffect(() => {
    if (state?.kind !== 'preparing' && !oraclePending) return;
    const elapsed = Date.now() - startedAt.current;
    if (elapsed >= MAX_WAIT_MS) return;
    const t = setTimeout(() => {
      setWaited(Date.now() - startedAt.current);
      void load();
    }, state?.kind === 'preparing' ? POLL_MS[state.stage] : POLL_MS.reading);
    return () => clearTimeout(t);
  }, [state]);

  const reload = () => {
    startedAt.current = Date.now();
    setWaited(0);
    setState(null);
    void load();
  };

  if (!state) return <Skeleton words={SELF_WORDS.loading} testId="self-reading-loading" />;
  if (state.kind === 'preparing') {
    if (waited >= MAX_WAIT_MS)
      return (
        <div role="alert" className={`${panelCls} text-white/80`} data-testid="self-reading-error">
          <p>{SELF_WORDS.tookTooLong}</p>
          <button type="button" onClick={reload} className={`${chip} mt-3 border-white/20 bg-white/5`}>
            Retry
          </button>
        </div>
      );
    if (state.stage === 'reading') return <Skeleton words={SELF_WORDS.writing} testId="self-reading-preparing" stage="reading" />;
    return <div className={`${panelCls} text-white/80`} data-testid="self-reading-preparing" data-stage="chart">{SELF_WORDS.preparing}</div>;
  }
  if (state.kind === 'no_kundli') return <div className={`${panelCls} text-white/80`} data-testid="self-reading-no-kundli">{SELF_WORDS.noKundli}</div>;
  if (state.kind === 'unavailable') return <div className={`${panelCls} text-white/80`} data-testid="self-reading-unavailable">{SELF_WORDS.unavailable}</div>;
  if (state.kind === 'error')
    return (
      <div role="alert" className={`${panelCls} text-white/80`} data-testid="self-reading-error">
        <p>{SELF_WORDS.error}</p>
        <button type="button" onClick={reload} className={`${chip} mt-3 border-white/20 bg-white/5`}>
          Retry
        </button>
      </div>
    );

  // past six minutes with the synthesis still pending, the panels stay and the veils lift; the note says so
  return <ReadingBody reading={state.reading} reload={reload} waiting={oraclePending && waited < MAX_WAIT_MS} gaveUp={oraclePending && waited >= MAX_WAIT_MS} />;
}

function ReadingBody({ reading, reload, waiting = false, gaveUp = false }: { reading: SelfReadingData; reload: () => void; waiting?: boolean; gaveUp?: boolean }) {
  const panels = reading.panels;
  const offsetOf = (id: string) => Math.max(0, panels.findIndex((p) => p.id === id));
  const [sel, setSel] = useState<string | null>(panels[0]?.id ?? null);
  const [sheet, setSheet] = useState(false);
  const rail = useRef<HTMLDivElement | null>(null);

  const pick = (id: string) => {
    setSel(id);
    track('chip_select', SURFACE, `reading_${id}`);
    const el = rail.current?.querySelector<HTMLElement>(`[data-slide="${id}"]`);
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
  };
  const onScroll = () => {
    const r = rail.current;
    if (!r || !r.clientWidth) return;
    const i = Math.round(r.scrollLeft / r.clientWidth);
    if (panels[i] && panels[i]!.id !== sel) setSel(panels[i]!.id);
  };
  const chooseClock = async (system: string | null) => {
    track('chip_select', SURFACE, `clock_${system ?? 'chart'}`);
    setSheet(false);
    await setSelfClock(system);
    reload();
  };
  const current = panels.find((p) => p.id === sel) ?? panels[0] ?? null;

  return (
    <div className="space-y-4" data-testid="self-reading">
      <p className="text-sm text-white/70" data-testid="self-clock-line">
        <span data-testid="self-clock-label">Read on your {clockLabel(reading.clock.label)} clock</span> ·{' '}
        <button type="button" onClick={() => setSheet(true)} className="min-h-[44px] text-purple-300 underline underline-offset-4">
          Change
        </button>
      </p>

      {waiting && <OracleWaitLine testId="self-oracle-waiting" />}
      {gaveUp && (
        <p role="status" className="text-sm text-white/60" data-testid="self-oracle-late">
          {SELF_WORDS.tookTooLong}{' '}
          <button type="button" onClick={reload} className="min-h-[44px] text-purple-300 underline underline-offset-4">
            Check again
          </button>
        </p>
      )}

      {current && (
        <>
          {/* phone and tablet: chips, a swipeable carousel and dots */}
          <div className="lg:hidden">
            <div role="tablist" aria-label="Your reading" className="mb-3 flex gap-2 overflow-x-auto" data-testid="self-chips">
              {panels.map((p) => (
                <button key={p.id} role="tab" type="button" aria-selected={sel === p.id} onClick={() => pick(p.id)} className={`${chip} ${sel === p.id ? 'border-white/40 bg-white/15' : 'border-white/10 text-white/60'}`}>
                  {p.title}
                </button>
              ))}
            </div>
            <div ref={rail} onScroll={onScroll} className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2" data-testid="self-carousel">
              {panels.map((p) => (
                <div key={p.id} data-slide={p.id} className="w-full shrink-0 snap-start">
                  <OracleVeil waiting={waiting} offset={offsetOf(p.id)} panelId={`m-${p.id}`}>
                    <PanelView panel={p} today={reading.asOf} adjusted={adjustedFor(p.id, reading.purview)} />
                  </OracleVeil>
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-center gap-1.5" aria-hidden="true">
              {panels.map((p) => (
                <span key={p.id} className={`h-1.5 w-1.5 rounded-full ${sel === p.id ? 'bg-white' : 'bg-white/30'}`} />
              ))}
            </div>
          </div>

          {/* desktop: a vertical tab list on the left, the panel on the right */}
          <div className="hidden gap-4 lg:grid lg:grid-cols-12">
            <div role="tablist" aria-orientation="vertical" aria-label="Your reading" className="glass flex flex-col gap-1 self-start rounded-xl p-1 lg:col-span-3" data-testid="self-tabs">
              {panels.map((p) => (
                <button key={p.id} role="tab" type="button" aria-selected={sel === p.id} onClick={() => pick(p.id)} className={`min-h-[44px] rounded-lg px-4 text-left text-sm ${sel === p.id ? 'bg-white/15 text-white' : 'text-white/60'}`}>
                  {p.title}
                </button>
              ))}
            </div>
            <div role="tabpanel" className="lg:col-span-9" data-testid="self-tabpanel">
              <OracleVeil waiting={waiting} offset={offsetOf(current.id)} panelId={current.id}>
                <PanelView key={current.id} panel={current} today={reading.asOf} adjusted={adjustedFor(current.id, reading.purview)} />
              </OracleVeil>
            </div>
          </div>
        </>
      )}

      {reading.question && <QuestionCard question={reading.question} />}

      {reading.builtLine && (
        <p className="text-center text-xs text-white/50" data-testid="self-built-line">
          {reading.builtLine}
        </p>
      )}

      {sheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" role="dialog" aria-modal="true" aria-label="Choose your clock" onClick={() => setSheet(false)}>
          <div className="w-full max-w-md rounded-t-3xl border border-white/10 bg-[#141233] p-5 sm:rounded-3xl" onClick={(e) => e.stopPropagation()} data-testid="self-clock-sheet">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Choose your clock</h2>
              <button type="button" aria-label="Close" onClick={() => setSheet(false)} className="min-h-[44px] min-w-[44px] text-white/60">
                ✕
              </button>
            </div>
            <ul className="space-y-2">
              {reading.clock.choices.map((c) => (
                <li key={c.system}>
                  <button
                    type="button"
                    aria-pressed={c.system === reading.clock.system}
                    onClick={() => void chooseClock(c.system)}
                    className={`min-h-[44px] w-full rounded-xl border px-4 text-left text-sm ${c.system === reading.clock.system ? 'border-white/40 bg-white/15' : 'border-white/10 text-white/80'}`}
                  >
                    {clockLabel(c.label)}
                  </button>
                </li>
              ))}
              {reading.clock.reason === 'preferred' && (
                <li>
                  <button type="button" onClick={() => void chooseClock(null)} className="min-h-[44px] w-full rounded-xl border border-white/10 px-4 text-left text-sm text-white/60">
                    Let your chart choose
                  </button>
                </li>
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function PanelView({ panel, today, adjusted }: { panel: SelfPanel; today: string; adjusted: string[] }) {
  const [details, setDetails] = useState(false);
  const lines = panel.lines ?? [];
  const title = <h3 className="mb-2 text-xl font-semibold">{panel.title}</h3>;

  if (panel.status === 'failed')
    return (
      <section className={panelCls} data-testid={`self-panel-${panel.id}`} data-status={panel.status}>
        {title}
        <p className="text-white/70" data-testid="self-panel-failed">
          {SELF_WORDS.failed}
        </p>
      </section>
    );
  // a panel with no grounded line shows its title and the plain withheld sentence, nothing else (doc 62)
  if (lines.length === 0)
    return (
      <section className={panelCls} data-testid={`self-panel-${panel.id}`} data-status={panel.status}>
        {title}
        <p className="text-white/70" data-testid="self-panel-withheld">
          {SELF_WORDS.withheldPanel}
        </p>
      </section>
    );

  const vetoed = panel.vetoed ?? [];
  // the Oracle's area is the card when it is there (server doc 65); the code lines are then the audit layer under Chart details
  const area = panel.areaStatus === 'ok' ? panel.area : undefined;
  const codeLines = area ? lines.filter((l) => !/\.ai\.\d+$/.test(l.id)) : lines;
  return (
    <section className={panelCls} data-testid={`self-panel-${panel.id}`} data-status={panel.status} data-card={area ? 'oracle' : 'code'}>
      {title}
      <p className="-mt-1 mb-2 text-sm text-white/60" data-testid="self-panel-range">
        {area ? areaHeaderWords(area, today) : headerWords(panel.id, panel.headerRange, today)}
      </p>
      {panel.note && (
        <p className="mb-3 text-sm italic text-white/60" data-testid="self-panel-note">
          {panel.note}
        </p>
      )}
      {area ? (
        <AreaView area={area} panelId={panel.id} />
      ) : (
        <ul className="mb-3 space-y-3" data-testid="self-lines">
          {lines.map((l) => (
            <LineView key={l.id} line={l} header={panel.headerRange} details={details} />
          ))}
        </ul>
      )}
      {panel.chapters && panel.chapters.length > 0 && <Chapters chapters={panel.chapters} details={details} />}
      {!area && panel.plan && <PlanView plan={panel.plan} />}
      <button
        type="button"
        aria-expanded={details}
        onClick={() => {
          if (!details) track('why_open', SURFACE, `reading_${panel.id}`);
          setDetails((d) => !d);
        }}
        className="mt-1 min-h-[44px] text-sm text-purple-300 underline underline-offset-4"
      >
        Chart details
      </button>
      {details && (
        <div className="mt-1 space-y-1" data-testid="self-panel-details">
          {area && codeLines.length > 0 && (
            <ul className="mb-2 space-y-2 rounded-lg border border-white/10 bg-white/5 p-2" data-testid="self-panel-code-lines">
              {codeLines.map((l) => (
                <LineView key={l.id} line={l} header={panel.headerRange} details />
              ))}
            </ul>
          )}
          {area && area.evidence.length > 0 && (
            <p className="font-mono text-[11px] text-white/45" data-testid="self-area-evidence">
              {area.evidence.join(' · ')}
            </p>
          )}
          {adjusted.map((t, i) => (
            <p key={i} className="text-xs text-white/60" data-testid="self-panel-adjusted">
              Adjusted by a whole-chart check: {t}
            </p>
          ))}
          {vetoed.length > 0 && (
            <ul className="rounded-lg border border-white/10 bg-white/5 p-2 text-xs text-white/60" data-testid="self-panel-vetoed">
              {vetoed.map((v) => (
                <li key={v.claimId}>
                  <span className="line-through">{v.text}</span>{' '}
                  <span className="font-mono text-[11px] text-white/45">
                    {v.claimId} · {v.rule}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="font-mono text-[11px] text-white/50" data-testid="self-panel-technique">
            {panel.technique} · {panel.ms} ms · {panel.cached ? 'cached' : 'fresh'}
          </p>
        </div>
      )}
    </section>
  );
}

/** The Oracle's plan for a panel: what it means now, dated steps, and dates to mark (dates outside a stored window are faded). */
function PlanView({ plan }: { plan: SelfPanelPlan }) {
  const steps = plan.steps ?? [];
  const calendar = plan.calendar ?? [];
  if (!plan.summary && steps.length === 0 && calendar.length === 0) return null;
  return (
    <div className="mb-3 rounded-xl border border-white/10 bg-white/5 p-3" data-testid="self-panel-plan">
      <div className="text-xs uppercase tracking-wide text-white/55">{SELF_WORDS.planTitle}</div>
      {plan.summary && <p className="mt-1 text-base text-white/90" data-testid="self-plan-summary">{plan.summary}</p>}
      {steps.length > 0 && (
        <ul className="mt-2 space-y-1.5" data-testid="self-plan-steps">
          {steps.map((s, i) => (
            <li key={i} className="text-sm text-white/85">
              <span className="text-white/55">{rangeWords(s.range)} · </span>
              {s.text}
            </li>
          ))}
        </ul>
      )}
      {calendar.length > 0 && (
        <div className="mt-2" data-testid="self-plan-calendar">
          <div className="text-xs uppercase tracking-wide text-white/55">{SELF_WORDS.calendarTitle}</div>
          <ul className="mt-1 space-y-1">
            {calendar.map((c, i) => (
              <li key={i} className={`text-sm ${c.inWindow === false ? 'text-white/45' : 'text-white/85'}`}>
                <span className="text-white/55">{c.from === c.to ? longDate(c.from) : range(c.from, c.to)} · </span>
                {c.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const AREA_CERTAINTY_WORD: Record<SelfArea['certainty'], string> = { strong: 'Strong', likely: 'Likely', possible: 'Possible' };

/** The card's header for an area: "True until 16 Feb 2028 · Strong", or "Always" for a lifelong area. */
export function areaHeaderWords(area: SelfArea, today: string): string {
  const word = AREA_CERTAINTY_WORD[area.certainty];
  if (area.validUntil === 'always') return 'Always';
  return area.validUntil > today ? `True until ${longDate(area.validUntil)} · ${word}` : word;
}

/** One area of the Oracle's reading as the card (server doc 65): headline, prose, the dates it names, what to do. */
function AreaView({ area, panelId }: { area: SelfArea; panelId: string }) {
  return (
    <div className="mb-3" data-testid={`self-area-${panelId}`}>
      <p className="mb-3 text-lg font-medium leading-snug text-white" data-testid="self-area-headline">
        {area.headline}
      </p>
      <div className="space-y-3" data-testid="self-area-prose">
        {area.paragraphs.map((p, i) => (
          <p key={i} className="leading-relaxed text-white/85">
            {renderInline(p)}
          </p>
        ))}
      </div>
      {area.dates.length > 0 && (
        <div className="mt-4" data-testid="self-area-dates">
          <div className="text-xs uppercase tracking-wide text-white/55">{SELF_WORDS.calendarTitle}</div>
          <table className="mt-1 w-full text-left text-sm">
            <tbody>
              {area.dates.map((d, i) => {
                const now = d.from <= todayIso() && todayIso() <= d.to;
                return (
                  <tr key={i} className={`border-t border-white/10 align-top ${now ? 'text-white' : 'text-white/80'}`} data-now={now ? 'true' : undefined}>
                    <td className="whitespace-nowrap py-1.5 pr-3 text-white/65">{d.from === d.to ? longDate(d.from) : range(d.from, d.to)}</td>
                    <td className="py-1.5">
                      {d.label}
                      {now && <span className="ml-2 rounded-full bg-purple-500/30 px-2 py-0.5 text-[11px] text-purple-100">now</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {area.actions.length > 0 && (
        <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3" data-testid="self-area-actions">
          <div className="text-xs uppercase tracking-wide text-white/55">{SELF_WORDS.planTitle}</div>
          <ul className="mt-1 space-y-1.5">
            {area.actions.map((x, i) => (
              <li key={i} className="text-sm text-white/85">
                <span className="text-white/55">{x.from === x.to ? longDate(x.from) : range(x.from, x.to)} · </span>
                {x.text}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const todayIso = () => new Date().toISOString().slice(0, 10);

function LineView({ line, header, details }: { line: SelfLine; header: LineRange; details: boolean }) {
  const own = sameRange(line.range, header) ? null : rangeWords(line.range);
  const word = certaintyWord(line);
  return (
    <li data-testid={`self-line-${line.id}`}>
      <p className="text-lg leading-snug text-white/90">{line.text}</p>
      {(own || word) && (
        <p className="mt-0.5 text-xs text-white/55">
          {own && <span data-testid="self-line-range">{own}</span>}
          {own && word && ' · '}
          {word && <span data-testid="self-line-certainty">{word}</span>}
        </p>
      )}
      {details && <ChartDetail detail={line.detail} evidence={line.claimIds} />}
    </li>
  );
}

function ChartDetail({ detail, evidence, extra }: { detail: string; evidence: string[]; extra?: string }) {
  return (
    <div className="mt-1 rounded-lg border border-white/10 bg-white/5 p-2 text-xs text-white/60" data-testid="self-chart-detail">
      {detail && <p>{detail}</p>}
      {extra && <p className="mt-1">{extra}</p>}
      {evidence.length > 0 && <p className="mt-1 font-mono text-[11px] text-white/45">{evidence.join(' · ')}</p>}
    </div>
  );
}

const CHAPTER_ORDER: Record<SelfChapter['kind'], number> = { previous: 0, running: 1, next: 2 };
const CHAPTER_HEADING: Record<SelfChapter['kind'], string> = { previous: 'Your last chapter', running: 'Your chapter now', next: 'Your next chapter' };

function Chapters({ chapters, details }: { chapters: SelfChapter[]; details: boolean }) {
  const sorted = [...chapters].sort((a, b) => CHAPTER_ORDER[a.kind] - CHAPTER_ORDER[b.kind]);
  return (
    <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-stretch" data-testid="self-chapters">
      {sorted.map((ch) => {
        const confirmed = confirmedLine(ch);
        const running = ch.kind === 'running';
        return (
          <article
            key={ch.kind}
            data-testid={`chapter-${ch.kind}`}
            className={`rounded-xl border p-3 ${running ? 'border-white/30 bg-white/10 lg:flex-[2]' : 'border-white/10 bg-white/5 text-white/80 lg:flex-1'}`}
          >
            <div className="text-xs uppercase tracking-wide text-white/55">{CHAPTER_HEADING[ch.kind]}</div>
            <div className={`mt-1 font-medium ${running ? 'text-base' : 'text-sm'}`} data-testid={`chapter-dates-${ch.kind}`}>
              {range(ch.from, ch.to)}
            </div>
            <p className={`mt-1 ${running ? 'text-base' : 'text-sm'}`}>{ch.text ?? SELF_WORDS.split}</p>
            {ch.certainty === 'likely' && ch.text && <p className="mt-1 text-xs text-white/55">Likely</p>}
            {confirmed && (
              <p className="mt-1 text-xs text-purple-200" data-testid={`chapter-confirmed-${ch.kind}`}>
                {confirmed}
              </p>
            )}
            {running && ch.sub && (
              <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-2" data-testid="chapter-sub">
                <div className="text-xs text-white/60">Within it, now: {range(ch.sub.from, ch.sub.to)}</div>
                <p className="mt-1 text-sm">{ch.sub.text}</p>
              </div>
            )}
            {running && ch.nextSub && (
              <p className="mt-2 text-xs text-white/60" data-testid="chapter-next-sub">
                Then: {range(ch.nextSub.from, ch.nextSub.to)}
              </p>
            )}
            {details && (
              <ChartDetail
                detail={[`${ch.lordLabel}: ${ch.detail}`, ch.sub ? `${ch.sub.lordLabel}: ${ch.sub.detail}` : '', ch.nextSub ? `then ${ch.nextSub.lordLabel}` : ''].filter(Boolean).join(' · ')}
                extra={
                  ch.confirmations.length
                    ? ch.confirmations.map((c) => `${c.label} ${c.agrees ? 'agrees' : 'does not agree'}${c.boundary ? ` (${c.boundary})` : ''}`).join(' · ')
                    : undefined
                }
                evidence={ch.evidence}
              />
            )}
          </article>
        );
      })}
    </div>
  );
}

function QuestionCard({ question }: { question: SelfQuestion }) {
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const answer = async (value: SelfAnswer) => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    track('question_answer', SURFACE, question.claimId, { value });
    const ok = await sendSelfConfirm(question.claimId, value);
    setBusy(false);
    if (ok) setDone(true);
    else setFailed(true);
  };
  if (done)
    return (
      <p className="text-sm text-white/70" data-testid="self-question-thanks">
        {SELF_WORDS.thanks}
      </p>
    );
  return (
    <div className={panelCls} data-testid="self-question">
      <p className="mb-3 font-medium">{question.text}</p>
      <div className="flex flex-wrap gap-2">
        {question.options.map((o) => (
          <button key={o.value} type="button" disabled={busy} onClick={() => void answer(o.value)} className={`${chip} min-w-[44px] border-white/20 bg-white/5`}>
            {o.label}
          </button>
        ))}
      </div>
      {failed && <p className="mt-2 text-xs text-white/60">That did not save. Try again.</p>}
    </div>
  );
}
