/**
 * "Your reading", the first tab of the You board (server docs/reading-engine/58 §4.3–§4.4): seven panels, each one
 * technique, read on the person's own clock. Plain words first; chart terms only behind "Chart details". On a phone the
 * panels are a swipe carousel with chips and dots, on a desktop a vertical tab list beside the panel (doc 45 rule 11).
 * The reading's `gaps` are staff-only and never rendered here.
 */
import { useEffect, useRef, useState } from 'react';
import { longDate } from '../../lib/careerApi';
import { track } from '../../lib/events';
import {
  fetchSelfReading,
  sendSelfConfirm,
  setSelfClock,
  type SelfAnswer,
  type SelfChapter,
  type SelfClaim,
  type SelfPanel,
  type SelfQuestion,
  type SelfReading as SelfReadingData,
  type SelfReadingState,
} from '../../lib/selfReadingApi';

const panelCls = 'glass glass-lift rounded-2xl p-4 sm:p-5';
const chip = 'inline-flex min-h-[44px] shrink-0 items-center rounded-full border px-4 text-sm';
const SURFACE = 'you';
const POLL_MS = 30_000;
const MAX_POLLS = 10;

export const SELF_WORDS = {
  loading: 'Reading your chart…',
  preparing: 'Your chart is still being prepared. This page will update by itself.',
  noKundli: 'Add your birth details in your profile to see your reading.',
  unavailable: 'Your reading is coming soon.',
  error: 'Your reading did not load.',
  failed: 'This part could not be read just now.',
  withheldPanel: 'Not enough in your chart to say this with confidence.',
  withheldClaim: 'You told us this did not fit.',
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

export default function SelfReading() {
  const [state, setState] = useState<SelfReadingState | null>(null);
  const polls = useRef(0);

  const load = () =>
    fetchSelfReading()
      .then(setState)
      .catch(() => setState({ kind: 'error' }));

  useEffect(() => {
    void load();
  }, []);
  // a chart still being prepared is checked again every 30 s, up to 10 times
  useEffect(() => {
    if (state?.kind !== 'preparing' || polls.current >= MAX_POLLS) return;
    const t = setTimeout(() => {
      polls.current += 1;
      void load();
    }, POLL_MS);
    return () => clearTimeout(t);
  }, [state]);

  const reload = () => {
    setState(null);
    void load();
  };

  if (!state)
    return (
      <div data-testid="self-reading-loading" aria-busy="true">
        <p className="mb-3 text-white/70">{SELF_WORDS.loading}</p>
        <div className="flex gap-2 overflow-hidden" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="h-11 w-28 shrink-0 animate-pulse rounded-full bg-white/10" />
          ))}
        </div>
        <div className="mt-3 h-40 animate-pulse rounded-2xl bg-white/5" aria-hidden="true" />
      </div>
    );
  if (state.kind === 'preparing') return <div className={`${panelCls} text-white/80`} data-testid="self-reading-preparing">{SELF_WORDS.preparing}</div>;
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

  return <ReadingBody reading={state.reading} reload={reload} />;
}

function ReadingBody({ reading, reload }: { reading: SelfReadingData; reload: () => void }) {
  const panels = reading.panels;
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
                  <PanelView panel={p} />
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
              <PanelView key={current.id} panel={current} />
            </div>
          </div>
        </>
      )}

      {reading.question && <QuestionCard question={reading.question} />}

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

function PanelView({ panel }: { panel: SelfPanel }) {
  const [details, setDetails] = useState(false);
  const body =
    panel.status === 'failed' ? (
      <p className="text-white/70" data-testid="self-panel-failed">
        {SELF_WORDS.failed}
      </p>
    ) : panel.status === 'withheld' ? (
      <p className="text-white/70" data-testid="self-panel-withheld">
        {SELF_WORDS.withheldPanel}
      </p>
    ) : (
      <>
        {panel.lead && <p className="mb-3 text-lg leading-snug">{panel.lead}</p>}
        {panel.chapters && panel.chapters.length > 0 && <Chapters chapters={panel.chapters} details={details} />}
        <div className="space-y-2">
          {panel.claims.map((c) => (
            <ClaimView key={c.id} claim={c} details={details} />
          ))}
        </div>
      </>
    );

  return (
    <section className={panelCls} data-testid={`self-panel-${panel.id}`} data-status={panel.status}>
      <h3 className="mb-2 text-xl font-semibold">{panel.title}</h3>
      {body}
      <button
        type="button"
        aria-expanded={details}
        onClick={() => {
          if (!details) track('why_open', SURFACE, `reading_${panel.id}`);
          setDetails((d) => !d);
        }}
        className="mt-3 min-h-[44px] text-sm text-purple-300 underline underline-offset-4"
      >
        Chart details
      </button>
      {details && (
        <p className="mt-1 font-mono text-[11px] text-white/50" data-testid="self-panel-technique">
          {panel.technique} · {panel.ms} ms · {panel.cached ? 'cached' : 'fresh'}
        </p>
      )}
    </section>
  );
}

function ClaimView({ claim, details }: { claim: SelfClaim; details: boolean }) {
  return (
    <div data-testid={`self-claim-${claim.id}`}>
      <p className={claim.withheld ? 'italic text-white/50' : 'text-white/85'}>{claim.withheld ? SELF_WORDS.withheldClaim : claim.text}</p>
      {details && <ChartDetail detail={claim.detail} evidence={claim.evidence} />}
    </div>
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
