/**
 * The three views of a card (server docs/dashboards/12 §2): three wide bars across the card's top, Read · Analysis ·
 * Calendar. Read replaces the old Read / Short switch (Short's sentence and step are the top of Read). Analysis says why
 * we think so: the chart details, which systems agree and which test the reading, and the ladder. Calendar puts the
 * card's dated windows and key dates on a month calendar, with the list under it.
 *
 * Nothing here computes anything astrological: it lays out what the server sent (rail, periods, key dates, spans and
 * their clocks, details, ladder) and does date arithmetic for the month grid. No internal id, clock key or evidence key
 * is shown, only the plain labels.
 */
import { useMemo, useState, type KeyboardEvent } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { CardOptions } from '../../../lib/cardOptions';
import type { SelfV2Area } from '../../../lib/selfV2Api';
import type { SelfV3CardView, SpanReading, SpanTone } from '../../../lib/selfV3Api';
import { ChartDetails } from '../v2/AreaCard';
import { dayWords, datesWords, keyDatesOf, planSteps, todayIso, type PeriodView } from './cardModel';
import { cardTitle } from './features';
import { label } from './faces/parts';
import { SPAN_TONE_DOT, SPAN_TONE_WORD, V3_WORDS } from './words';

export type CardViewId = 'read' | 'analysis' | 'calendar';
export const CARD_VIEWS: readonly CardViewId[] = ['read', 'analysis', 'calendar'];

export const VIEW_WORDS = {
  bars: 'Card views',
  read: 'Read',
  analysis: 'Analysis',
  calendar: 'Calendar',
  why: 'Why we think so',
  systems: 'How the systems read it',
  agree: (n: number, of: number) => `${n} of ${of} agree`,
  agreeing: 'Agreeing',
  testing: 'Testing it',
  ladder: 'The ladder',
  noAnalysis: 'Nothing more to show for this card yet.',
  windows: 'Windows',
  keyDates: 'Key dates',
  noDates: 'This card has no dates yet.',
  prevMonth: 'Previous month',
  nextMonth: 'Next month',
  today: 'today',
  backToCard: 'Back to card',
  conversation: 'Conversation about this card',
} as const;

const STEP_WORD: Record<string, string> = { best: 'Best', practical: 'Practical', drift: 'If it drifts', floor: 'The floor' };

/** the v2 Chart details body reads only `details` */
export function detailsArea(card: SelfV3CardView): SelfV2Area {
  return {
    id: 'diagnosis',
    group: 'you',
    title: cardTitle(card),
    status: card.status,
    card: card.v2?.card ?? null,
    floor: [],
    details: { ...(card.v2?.details ?? { evidence: [] }), certainty: card.v2?.details?.certainty as SelfV2Area['details']['certainty'] },
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// The bars
// ---------------------------------------------------------------------------------------------------------------------

export function CardViewBars({ cardId, view, onView, panelId, hasOwn = false, ownLabel }: { cardId: string; view: CardViewId | null; onView: (v: CardViewId) => void; panelId: string; hasOwn?: boolean; ownLabel?: string }) {
  const onKeys = (e: KeyboardEvent<HTMLDivElement>) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    e.stopPropagation();
    const at = CARD_VIEWS.indexOf(view ?? 'read');
    const next = CARD_VIEWS[(at + d + CARD_VIEWS.length) % CARD_VIEWS.length]!;
    onView(next);
    (e.currentTarget.querySelector(`[data-view="${next}"]`) as HTMLElement | null)?.focus();
  };
  return (
    <div className="flex min-w-0 shrink-0 items-center gap-2" data-testid={`card-bars-${cardId}`}>
      <div role="tablist" aria-label={VIEW_WORDS.bars} onKeyDown={onKeys} className="grid min-w-0 flex-1 grid-cols-3 gap-1 rounded-xl border border-white/10 bg-white/5 p-0.5" data-testid="card-bars">
        {CARD_VIEWS.map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            aria-controls={panelId}
            tabIndex={view === v || (view === null && v === 'read') ? 0 : -1}
            data-view={v}
            onClick={() => onView(v)}
            className={`self-v3-btn inline-flex min-h-[36px] items-center justify-center rounded-lg px-2 text-[13px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60 ${view === v ? 'self-v3-on' : 'text-white/70 hover:text-white'}`}
            data-testid={`card-view-${v}`}
          >
            {VIEW_WORDS[v]}
          </button>
        ))}
      </div>
      {hasOwn && <span className="h-2 w-2 shrink-0 rounded-full bg-teal-300" role="img" aria-label={ownLabel ?? V3_WORDS.ownSettings} title={ownLabel ?? V3_WORDS.ownSettings} data-testid="toolbar-own-dot" />}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------------------------------------------------

/** the span whose systems are shown: the period's own, else the first span that carries its clocks */
export function analysisSpan(card: SelfV3CardView, period: PeriodView | null): SpanReading | null {
  if (period?.span?.clocks?.length || period?.span?.agreement) return period.span;
  return (card.v3?.spans ?? []).find((s) => s.clocks?.length || s.agreement) ?? null;
}

export function AnalysisView({ card, period, options, why }: { card: SelfV3CardView; period: PeriodView | null; options: Pick<CardOptions, 'plan'>; why: boolean }) {
  const span = analysisSpan(card, period);
  const clocks = (span?.clocks ?? []).filter((c) => !!c.label?.trim());
  const agreeing = clocks.filter((c) => c.agrees);
  const testing = clocks.filter((c) => !c.agrees);
  const steps = planSteps(card, options);
  const details = detailsArea(card).details;
  const hasDetails = why && (!!details.headline || (details.paragraphs ?? []).some((p) => !!p?.trim()));
  if (!hasDetails && !clocks.length && !span?.agreement && !steps.length)
    return (
      <p className="text-center text-[15px] text-white/60" data-testid="analysis-empty">
        {VIEW_WORDS.noAnalysis}
      </p>
    );
  return (
    <div className="space-y-4" data-testid="analysis-view">
      {hasDetails && (
        <section data-testid="analysis-why">
          <h4 className={label}>{VIEW_WORDS.why}</h4>
          <div className="mt-1.5">
            <ChartDetails area={detailsArea(card)} showEvidence={false} />
          </div>
        </section>
      )}
      {(clocks.length > 0 || span?.agreement) && (
        <section data-testid="analysis-systems">
          <h4 className={label}>{VIEW_WORDS.systems}</h4>
          {span?.agreement && (
            <p className="mt-1 text-[15px] text-white/85" data-testid="analysis-agreement">
              {VIEW_WORDS.agree(span.agreement.agree, span.agreement.of)}
              {period?.label ? <span className="text-white/55"> · {period.label}</span> : null}
            </p>
          )}
          {agreeing.length > 0 && <SystemList title={VIEW_WORDS.agreeing} items={agreeing} testId="analysis-agreeing" />}
          {testing.length > 0 && <SystemList title={VIEW_WORDS.testing} items={testing} testId="analysis-testing" />}
        </section>
      )}
      {steps.length > 0 && (
        <section data-testid="analysis-ladder">
          <h4 className={label}>{VIEW_WORDS.ladder}</h4>
          <ol className="mt-1.5 grid gap-1.5">
            {steps.map((s) => (
              <li key={s.key} className="grid grid-cols-[88px_1fr] gap-2.5 rounded-xl bg-white/5 px-3 py-2 text-[15px]" data-testid={`ladder-${s.key}`}>
                <b className="self-center text-[13px] font-bold text-teal-200">{STEP_WORD[s.key] ?? s.key}</b>
                <span className="text-white/85">{s.text}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

function SystemList({ title, items, testId }: { title: string; items: Array<{ label: string; tone: SpanTone }>; testId: string }) {
  return (
    <div className="mt-2" data-testid={testId}>
      <p className="text-[13px] font-semibold text-white/60">{title}</p>
      <ul className="mt-1 flex flex-wrap gap-1.5">
        {items.map((c, i) => (
          <li key={`${c.label}-${i}`} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[13px] text-white/85" data-testid="analysis-system">
            <span className={`h-2 w-2 rounded-full ${SPAN_TONE_DOT[c.tone] ?? SPAN_TONE_DOT.none}`} aria-hidden="true" />
            {c.label}
            <span className="text-white/55">· {SPAN_TONE_WORD[c.tone] ?? ''}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Calendar
// ---------------------------------------------------------------------------------------------------------------------

/** one dated window on the calendar, from the rail (or, when the card has no rail, the server's periods) */
export interface CalendarWindow {
  key: string;
  from: string;
  to: string;
  label: string;
  tone: SpanTone | null;
  current: boolean;
}

/** the card's windows as stored: the rail's periods, else the server's named periods; nothing computed */
export function calendarWindows(card: SelfV3CardView, periods: readonly PeriodView[], today: string = todayIso()): CalendarWindow[] {
  const fromRail = periods.map((p) => ({ key: `r${p.index}`, from: p.item.from.slice(0, 10), to: p.item.to.slice(0, 10), label: p.label, tone: p.tone, current: p.current }));
  if (fromRail.length) return fromRail;
  return (card.periods ?? [])
    .filter((p) => !!p?.from && !!p?.to)
    .map((p) => ({ key: `p${p.id}`, from: p.from.slice(0, 10), to: p.to.slice(0, 10), label: p.label || `${p.name} · ${datesWords({ from: p.from, to: p.to } as PeriodView['item'], today)}`, tone: p.tone, current: !!p.current }))
    .sort((a, b) => a.from.localeCompare(b.from));
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const TONE_CELL: Record<SpanTone | 'none', string> = {
  heavy: 'bg-rose-400/30',
  mixed: 'bg-amber-300/25',
  light: 'bg-teal-300/25',
  none: 'bg-white/10',
};

const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const monthIndex = (day: string) => Number(day.slice(0, 4)) * 12 + Number(day.slice(5, 7)) - 1;

/** the narrowest window holding `day`, or null */
export function windowForDay(windows: readonly CalendarWindow[], day: string): CalendarWindow | null {
  let best: CalendarWindow | null = null;
  let bestLen = Infinity;
  for (const w of windows) {
    if (day < w.from || day > w.to) continue;
    const len = Date.parse(w.to) - Date.parse(w.from);
    // a window starting on the day wins a handoff day
    if (len < bestLen || (best && best.to === day && w.from === day)) {
      best = w;
      bestLen = len;
    }
  }
  return best;
}

/** the months the calendar can show: from the first date to the last (one month a page); opens on today's when inside */
export function calendarMonths(windows: readonly CalendarWindow[], dates: readonly { date: string }[], today: string): { first: number; last: number; open: number } | null {
  const all = [...windows.flatMap((w) => [w.from, w.to]), ...dates.map((d) => d.date.slice(0, 10))].filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  if (!all.length) return null;
  const first = monthIndex(all[0]!);
  const last = monthIndex(all[all.length - 1]!);
  const t = monthIndex(today);
  return { first, last, open: Math.max(first, Math.min(last, t)) };
}

export function CalendarView({ card, periods, showWindows, showDates }: { card: SelfV3CardView; periods: readonly PeriodView[]; showWindows: boolean; showDates: boolean }) {
  const today = todayIso();
  const windows = useMemo(() => (showWindows ? calendarWindows(card, periods, today) : []), [showWindows, card, periods, today]);
  const dates = useMemo(() => (showDates ? keyDatesOf(card, today) : []), [showDates, card, today]);
  const range = calendarMonths(windows, dates, today);
  const [shown, setShown] = useState<number | null>(null);
  if (!range)
    return (
      <p className="text-center text-[15px] text-white/60" data-testid="calendar-empty">
        {VIEW_WORDS.noDates}
      </p>
    );
  const month = shown ?? range.open;
  const y = Math.floor(month / 12);
  const m = month % 12;
  const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const lead = (new Date(Date.UTC(y, m, 1)).getUTCDay() + 6) % 7;
  const dateByDay = new Map<string, string[]>();
  for (const k of dates) dateByDay.set(k.date.slice(0, 10), [...(dateByDay.get(k.date.slice(0, 10)) ?? []), k.label]);

  return (
    <div className="space-y-4" data-testid="calendar-view">
      <section aria-label={`${MONTH_NAMES[m]} ${y}`} data-testid="calendar-month" data-month={iso(y, m, 1).slice(0, 7)}>
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => setShown(month - 1)} disabled={month <= range.first} aria-label={VIEW_WORDS.prevMonth} className="inline-flex h-10 w-10 items-center justify-center rounded-full text-white/75 hover:bg-white/10 disabled:opacity-30" data-testid="calendar-prev">
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <p className="text-[15px] font-semibold text-white" data-testid="calendar-title">
            {MONTH_NAMES[m]} {y}
          </p>
          <button type="button" onClick={() => setShown(month + 1)} disabled={month >= range.last} aria-label={VIEW_WORDS.nextMonth} className="inline-flex h-10 w-10 items-center justify-center rounded-full text-white/75 hover:bg-white/10 disabled:opacity-30" data-testid="calendar-next">
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1 text-center text-[12px] text-white/45" aria-hidden="true">
          {WEEKDAYS.map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
        <ol className="mt-1 grid grid-cols-7 gap-1">
          {Array.from({ length: lead }, (_, i) => (
            <li key={`lead-${i}`} aria-hidden="true" />
          ))}
          {Array.from({ length: days }, (_, i) => {
            const day = iso(y, m, i + 1);
            const w = windowForDay(windows, day);
            const marks = dateByDay.get(day) ?? [];
            const isToday = day === today;
            const words = [dayWords(day), w?.label, ...marks, isToday ? VIEW_WORDS.today : null].filter(Boolean).join(' · ');
            return (
              <li
                key={day}
                aria-label={words}
                title={words}
                className={`relative flex h-9 items-center justify-center rounded-md text-[13px] tabular-nums ${w ? TONE_CELL[w.tone ?? 'none'] : ''} ${isToday ? 'ring-1 ring-white/80' : ''} ${marks.length ? 'font-bold text-white' : 'text-white/80'}`}
                data-testid="calendar-day"
                data-day={day}
                data-window={w?.key ?? ''}
                data-key-date={marks.length ? 'true' : 'false'}
              >
                {i + 1}
                {marks.length > 0 && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-teal-200" aria-hidden="true" />}
              </li>
            );
          })}
        </ol>
      </section>

      {windows.length > 0 && (
        <section data-testid="calendar-windows">
          <h4 className={label}>{VIEW_WORDS.windows}</h4>
          <ul className="mt-1.5 grid gap-1">
            {windows.map((w) => (
              <li key={w.key} className={`flex items-center gap-2 text-[15px] ${w.to < today && !w.current ? 'text-white/45' : 'text-white/85'}`} data-testid="calendar-window">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${SPAN_TONE_DOT[w.tone ?? 'none']}`} aria-hidden="true" />
                <span>{w.label}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {dates.length > 0 && (
        <section data-testid="calendar-key-dates">
          <h4 className={label}>{VIEW_WORDS.keyDates}</h4>
          <ul className="mt-1.5 grid gap-1">
            {dates.map((k) => (
              <li key={`${k.date}-${k.label}`} className={`flex gap-2 text-[15px] ${k.passed ? 'text-white/45' : 'text-white/85'}`} data-testid="calendar-key-date">
                <b className="shrink-0 font-semibold">{dayWords(k.date, { short: true, today })}:</b>{' '}
                <span>{k.label}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
