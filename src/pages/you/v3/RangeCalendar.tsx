/**
 * The Calendar tab of a card on tablet and desktop (server docs/dashboards/13 §4.3): a start-to-end bar for the whole
 * reading, then two or three months side by side with every window drawn as one unbroken band, a pager and Start ·
 * Today · End chips, and the windows and key dates listed under it.
 *
 * Date arithmetic only (UTC), on the windows and key dates the server sent. Nothing astrological is computed here.
 */
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { SelfV3CardView, SpanTone } from '../../../lib/selfV3Api';
import { calendarMonths, calendarWindows, windowForDay, VIEW_WORDS, type CalendarWindow } from './CardViews';
import { dayWords, keyDatesOf, todayIso, type PeriodView } from './cardModel';
import { label } from './faces/parts';
import { SPAN_TONE_DOT, SPAN_TONE_WORD } from './words';
import './rangeCalendar.css';

export const RANGE_WORDS = {
  start: 'Start',
  today: 'Today',
  end: 'End',
  jumps: 'Jump to',
  prev: (n: number) => (n === 1 ? 'Previous month' : `Previous ${n} months`),
  next: (n: number) => (n === 1 ? 'Next month' : `Next ${n} months`),
  bar: 'The whole reading, start to end',
  startsIn: (n: number) => (n === 1 ? 'starts tomorrow' : `starts in ${n} days`),
  ended: 'ended',
  dayOf: (d: number, of: number) => `day ${d} of ${of}`,
  days: (n: number) => (n === 1 ? '1 day' : `${n} days`),
  windowStart: 'window starts',
  windowEnd: 'window ends',
  showFrom: (w: string) => `Show the months from ${w}`,
} as const;

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DAY_MS = 86_400_000;

// ---------------------------------------------------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------------------------------------------------

export const isoDay = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/** months since year 0: "2026-11-18" → 2026 * 12 + 10 */
export const monthIndex = (day: string) => Number(day.slice(0, 4)) * 12 + Number(day.slice(5, 7)) - 1;

/** "2026-11" for a month index */
export const monthKey = (month: number) => `${Math.floor(month / 12)}-${String((month % 12) + 1).padStart(2, '0')}`;

const utc = (day: string) => Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)));

/** whole days from `a` to `b` (UTC); negative when `b` is before `a` */
export function daysBetween(a: string, b: string): number {
  return Math.round((utc(b) - utc(a)) / DAY_MS);
}

/** a window's length in days, both ends counted */
export const windowDays = (w: { from: string; to: string }) => daysBetween(w.from, w.to) + 1;

/** the day after `day` */
const nextDay = (day: string) => new Date(utc(day) + DAY_MS).toISOString().slice(0, 10);
const prevDay = (day: string) => new Date(utc(day) - DAY_MS).toISOString().slice(0, 10);

/** months shown side by side for the calendar's content width: 2 under 440 px, else 3 (3 before the first measure) */
export function monthsFor(width: number | null | undefined): number {
  if (width == null || !Number.isFinite(width) || width <= 0) return 3;
  return width < 440 ? 2 : 3;
}

/** lists sit in two columns from 640 px of content width */
export const wideLists = (width: number | null | undefined) => width != null && width >= 640;

const validDay = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);

/** every month that holds a dated day: any day of a window, or a key date */
export function datedMonths(windows: readonly CalendarWindow[], dates: readonly { date: string }[]): number[] {
  const set = new Set<number>();
  for (const w of windows) {
    if (!validDay(w.from) || !validDay(w.to)) continue;
    for (let m = monthIndex(w.from); m <= monthIndex(w.to); m++) set.add(m);
  }
  for (const k of dates) if (validDay(k.date.slice(0, 10))) set.add(monthIndex(k.date.slice(0, 10)));
  return [...set].sort((a, b) => a - b);
}

/** the first and last month the pager may show first, for `n` months shown */
export function pageLimits(range: { first: number; last: number }, n: number): { min: number; max: number } {
  return { min: range.first, max: Math.max(range.first, range.last - n + 1) };
}

/** keep a first-shown month inside the limits */
export function clampStart(month: number, range: { first: number; last: number }, n: number): number {
  const { min, max } = pageLimits(range, n);
  return Math.min(max, Math.max(min, month));
}

/**
 * The first month shown when the calendar opens, for `n` months side by side; null when nothing is dated.
 * With a window holding today that began no more than n − 2 months before today's month, open on that window's first
 * month (today stays on screen with at least one later month); else on today's month. Clamped to the dated range, and
 * never onto months with no date in them: then the first dated month on or after today, else the last.
 */
export function openingMonth(windows: readonly CalendarWindow[], dates: readonly { date: string }[], today: string, n: number): number | null {
  const range = calendarMonths(windows, dates, today);
  if (!range) return null;
  const t = monthIndex(today);
  const cur = windowForDay(windows, today);
  let start = cur && t - monthIndex(cur.from) <= n - 2 ? monthIndex(cur.from) : t;
  start = clampStart(start, range, n);
  const dated = datedMonths(windows, dates);
  const hasDate = (s: number) => dated.some((m) => m >= s && m <= s + n - 1);
  if (!hasDate(start)) {
    const target = dated.find((m) => m >= t) ?? dated[dated.length - 1] ?? range.last;
    start = clampStart(target, range, n);
    // the window can still miss when clamping pulls it back; start on the dated month itself then
    if (!hasDate(start)) start = target;
  }
  return start;
}

/** the first-shown month each chip jumps to, and whether it is offered */
export function jumpTargets(
  range: { first: number; last: number },
  n: number,
  shown: number,
  today: string,
  span: { from: string; to: string } | null,
): { start: { to: number; disabled: boolean }; today: { to: number; disabled: boolean }; end: { to: number; disabled: boolean } } {
  const t = monthIndex(today);
  const onScreen = (m: number) => m >= shown && m <= shown + n - 1;
  const inside = !!span && today >= span.from && today <= span.to;
  const endTo = pageLimits(range, n).max;
  return {
    start: { to: range.first, disabled: onScreen(range.first) },
    today: { to: clampStart(t, range, n), disabled: !inside || onScreen(t) },
    end: { to: endTo, disabled: onScreen(range.last) },
  };
}

/** the first and last dated day: windows and key dates together */
export function datedSpan(windows: readonly CalendarWindow[], dates: readonly { date: string }[]): { from: string; to: string } | null {
  const all = [...windows.flatMap((w) => [w.from, w.to]), ...dates.map((d) => d.date.slice(0, 10))].filter(validDay).sort();
  return all.length ? { from: all[0]!, to: all[all.length - 1]! } : null;
}

/** the bar's span: first window start to last window end */
export function barSpan(windows: readonly CalendarWindow[]): { from: string; to: string } | null {
  const ok = windows.filter((w) => validDay(w.from) && validDay(w.to) && w.from <= w.to);
  if (!ok.length) return null;
  return { from: ok.map((w) => w.from).sort()[0]!, to: ok.map((w) => w.to).sort()[ok.length - 1]! };
}

/** "11 Nov 2026 → 27 Dec 2027 · day 8 of 412" (or "starts in N days", or "ended") */
export function summaryLine(w: { from: string; to: string }, today: string): string {
  const total = windowDays(w);
  const head = `${dayWords(w.from)} → ${dayWords(w.to)}`;
  if (today < w.from) return `${head} · ${RANGE_WORDS.startsIn(daysBetween(today, w.from))}`;
  if (today > w.to) return `${head} · ${RANGE_WORDS.ended}`;
  return `${head} · ${RANGE_WORDS.dayOf(daysBetween(w.from, today) + 1, total)}`;
}

/** where a day sits on the bar, 0..100 (the day's start) */
export function barPercent(span: { from: string; to: string }, day: string): number {
  const total = daysBetween(span.from, span.to) + 1;
  return (Math.max(0, Math.min(total, daysBetween(span.from, day))) / total) * 100;
}

export interface BarTick {
  month: number;
  /** where the tick sits on the bar, 0..100 */
  left: number;
  /** null when thinned out */
  label: string | null;
  /** the label box's left edge in px from the tick (the box is BAR_LABEL_PX wide and always inside the bar) */
  offset: number;
  /** how the words sit in their box: against the bar's left edge, centred on the tick, or against the right edge */
  align: 'l' | 'c' | 'r';
  /** the tick at the bar's own start (the first day, not a month boundary) */
  start?: boolean;
}

const SHORT_MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** the room one month label needs on the bar, px */
export const BAR_LABEL_PX = 56;
/** the width assumed before the first measure, px */
const BAR_FALLBACK_PX = 480;

/**
 * A tick at the bar's start and at the start of every month inside it. Labels are laid out on the bar's measured width
 * (`width` px): the start always carries its month and year; the others are thinned to every 1, 2, 3, 4, 6 or 12 months,
 * the smallest step whose labels (BAR_LABEL_PX each) all fit without touching. A label never crosses the bar's left or
 * right edge, and one that would touch its neighbour is dropped. January (or the first labelled tick) carries the year.
 */
export function barTicks(span: { from: string; to: string }, width: number | null | undefined): BarTick[] {
  const W = width != null && Number.isFinite(width) && width > 0 ? width : BAR_FALLBACK_PX;
  const L = Math.min(BAR_LABEL_PX, W);
  const first = monthIndex(span.from);
  const months: number[] = [];
  for (let m = first + 1; m <= monthIndex(span.to); m++) months.push(m);
  const name = (m: number, withYear: boolean) => (withYear ? `${SHORT_MONTH[m % 12]} ’${String(Math.floor(m / 12)).slice(2)}` : SHORT_MONTH[m % 12]!);
  const leftOf = (m: number) => barPercent(span, isoDay(Math.floor(m / 12), m % 12, 1));
  /** the label box for a tick at `pct`: centred on it, pushed inside the bar at either end */
  const box = (pct: number): { lo: number; align: BarTick['align'] } => {
    const x = (pct / 100) * W;
    if (x - L / 2 <= 0) return { lo: 0, align: 'l' };
    if (x + L / 2 >= W) return { lo: W - L, align: 'r' };
    return { lo: x - L / 2, align: 'c' };
  };
  const GAP = 4;
  const onFor = (step: number) => (m: number) => (step <= 12 ? (m % 12) % step === 0 : m % step === 0 && m % 12 === 0);
  /** the months that keep a label for `step`, and how many on-step labels were dropped after the first */
  const place = (step: number) => {
    const kept = new Map<number, { lo: number; align: BarTick['align'] }>();
    let right = L; // the start label holds [0, L]
    let dropped = 0;
    let seen = 0;
    for (const m of months.filter(onFor(step))) {
      const b = box(leftOf(m));
      seen++;
      if (b.lo < right + GAP) {
        // the first on-step label may give way to the start label; any later drop means the step is too small
        if (seen > 1) dropped++;
        continue;
      }
      kept.set(m, b);
      right = b.lo + L;
    }
    return { kept, dropped };
  };
  const steps = [1, 2, 3, 4, 6, 12, 24, 36, 60, 120];
  let chosen = place(120);
  for (const s of steps) {
    const p = place(s);
    if (p.dropped === 0) {
      chosen = p;
      break;
    }
  }
  const startTick: BarTick = { month: first, left: 0, label: name(first, true), offset: 0, align: 'l', start: true };
  return [
    startTick,
    ...months.map((m): BarTick => {
      const left = leftOf(m);
      const b = chosen.kept.get(m);
      if (!b) return { month: m, left, label: null, offset: 0, align: 'c' };
      const withYear = m % 12 === 0;
      return { month: m, left, label: name(m, withYear), offset: Math.round((b.lo - (left / 100) * W) * 10) / 10, align: b.align };
    }),
  ];
}

/** how a day sits in its band: tone, caps and whether the band continues from or to its neighbours */
export interface DayBand {
  window: CalendarWindow;
  cap: 'start' | 'end' | 'both' | null;
  roundLeft: boolean;
  roundRight: boolean;
}

export function dayBand(windows: readonly CalendarWindow[], day: string): DayBand | null {
  const w = windowForDay(windows, day);
  if (!w) return null;
  const before = windowForDay(windows, prevDay(day));
  const after = windowForDay(windows, nextDay(day));
  const isStart = day === w.from;
  // windows that touch share a day, which goes to the one starting on it: the earlier band then ends the day before
  const isEnd = day === w.to || (!!after && after.key !== w.key && after.from === w.to && nextDay(day) === w.to);
  return {
    window: w,
    cap: isStart && isEnd ? 'both' : isStart ? 'start' : isEnd ? 'end' : null,
    roundLeft: isStart || before?.key !== w.key,
    roundRight: isEnd || after?.key !== w.key,
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// The view
// ---------------------------------------------------------------------------------------------------------------------

const toneOf = (w: { tone: SpanTone | null } | null | undefined): SpanTone | 'none' => w?.tone ?? 'none';

function useContentWidth<T extends HTMLElement>(): [RefObject<T>, number | null] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState<number | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setWidth(Math.round(w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

function SpanBar({ windows, dates, today, width, onPick }: { windows: CalendarWindow[]; dates: Array<{ date: string; label: string }>; today: string; width: number | null; onPick: (w: CalendarWindow) => void }) {
  const span = barSpan(windows);
  if (!span) return null;
  const ticks = barTicks(span, width);
  const segs = windows
    .filter((w) => validDay(w.from) && validDay(w.to) && w.from <= w.to)
    .slice()
    .sort((a, b) => windowDays(b) - windowDays(a));
  const total = daysBetween(span.from, span.to) + 1;
  const todayIn = today >= span.from && today <= span.to;
  const summaryWindow = windowForDay(windows, today) ?? windows[0]!;
  return (
    <section aria-label={RANGE_WORDS.bar}>
      <div className="rc-bar" data-testid="range-bar">
        <div className="rc-bar-track">
          {segs.map((w) => (
            <button
              key={w.key}
              type="button"
              className={`rc-bar-seg rc-tone-${toneOf(w)}`}
              style={{ left: `${barPercent(span, w.from)}%`, width: `${(windowDays(w) / total) * 100}%` }}
              onClick={() => onPick(w)}
              aria-label={`${RANGE_WORDS.showFrom(dayWords(w.from))}: ${w.label}${w.tone ? ` · ${SPAN_TONE_WORD[w.tone]}` : ''}`}
              title={`${w.label} · ${dayWords(w.from)} → ${dayWords(w.to)}`}
              data-testid="range-bar-segment"
              data-window={w.key}
            />
          ))}
          {dates
            .filter((k) => k.date.slice(0, 10) >= span.from && k.date.slice(0, 10) <= span.to)
            .map((k) => (
              <span key={`${k.date}-${k.label}`} className="rc-bar-key" style={{ left: `${barPercent(span, k.date.slice(0, 10)) + 50 / total}%` }} title={`${dayWords(k.date)}: ${k.label}`} aria-hidden="true" data-testid="range-bar-key-date" />
            ))}
          {todayIn && (
            // a full-height line with a dot on top; held 4 px inside either end so the dot never leaves the bar
            <span className="rc-bar-today" style={{ ['--rc-at' as string]: `${barPercent(span, today) + 50 / total}%` }} title={VIEW_WORDS.today} aria-hidden="true" data-testid="range-bar-today">
              <span className="rc-bar-today-dot" />
            </span>
          )}
        </div>
        {todayIn && (
          <span className="rc-bar-today-label" style={{ ['--rc-at' as string]: `${barPercent(span, today) + 50 / total}%` }} aria-hidden="true" data-testid="range-bar-today-label">
            {VIEW_WORDS.today}
          </span>
        )}
        <div className="rc-bar-ticks" aria-hidden="true" data-testid="range-bar-ticks">
          {ticks.map((t) => (
            <span key={t.start ? 'start' : t.month} className={`rc-bar-tick${t.label ? ' rc-bar-tick-on' : ''}${t.start ? ' rc-bar-tick-start' : ''}`} style={{ left: `${t.left}%` }}>
              {t.label && (
                <span className={`rc-bar-tick-label rc-align-${t.align}`} style={{ left: `${t.offset}px`, width: `${BAR_LABEL_PX}px` }} data-testid="range-bar-label">
                  {t.label}
                </span>
              )}
            </span>
          ))}
        </div>
      </div>
      <p className="mt-1.5 text-[13px] tabular-nums text-white/75" data-testid="range-summary">
        {summaryLine(summaryWindow, today)}
      </p>
    </section>
  );
}

/** week rows a month needs (Monday first): 4 to 6 */
export function weekRows(month: number): number {
  const y = Math.floor(month / 12);
  const m = month % 12;
  const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const lead = (new Date(Date.UTC(y, m, 1)).getUTCDay() + 6) % 7;
  return Math.ceil((lead + days) / 7);
}

function Month({ month, windows, dateByDay, today, rows }: { month: number; windows: CalendarWindow[]; dateByDay: Map<string, string[]>; today: string; rows: number }) {
  const y = Math.floor(month / 12);
  const m = month % 12;
  const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const lead = (new Date(Date.UTC(y, m, 1)).getUTCDay() + 6) % 7;
  return (
    <section className="rc-month" aria-label={`${MONTH_NAMES[m]} ${y}`} data-testid="calendar-month" data-month={monthKey(month)}>
      <p className="rc-month-title text-white">
        {MONTH_NAMES[m]} {y}
      </p>
      <div className="rc-grid rc-weekdays text-white/45" aria-hidden="true">
        {WEEKDAYS.map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      {/* the months on screen share one row count, so their weeks line up; rows grow into spare height (CSS) */}
      <ol className="rc-grid rc-days" style={{ ['--rc-rows' as string]: rows }}>
        {Array.from({ length: lead }, (_, i) => (
          <li key={`lead-${i}`} aria-hidden="true" />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const day = isoDay(y, m, i + 1);
          const band = dayBand(windows, day);
          const w = band?.window ?? null;
          const marks = dateByDay.get(day) ?? [];
          const isToday = day === today;
          const capWord = band?.cap === 'start' ? RANGE_WORDS.windowStart : band?.cap === 'end' ? RANGE_WORDS.windowEnd : null;
          const words = [dayWords(day), w?.label, capWord, ...marks, isToday ? VIEW_WORDS.today : null].filter(Boolean).join(' · ');
          const cap = band?.cap === 'both' ? 'start' : band?.cap ?? undefined;
          return (
            <li
              key={day}
              aria-label={words}
              title={words}
              className={`rc-day${marks.length ? ' rc-day-key font-bold text-white' : ' text-white/80'}`}
              data-testid="calendar-day"
              data-day={day}
              data-window={w?.key ?? ''}
              data-key-date={marks.length ? 'true' : 'false'}
              data-cap={cap}
              data-today={isToday ? 'true' : undefined}
            >
              {band && (
                <span
                  className={`rc-band rc-tone-${toneOf(w)}${band.cap ? ' rc-band-solid' : ''}${band.roundLeft ? ' rc-round-l' : ''}${band.roundRight ? ' rc-round-r' : ''}`}
                  aria-hidden="true"
                />
              )}
              <span className="rc-num">
                {isToday && <span className="rc-today" aria-hidden="true" />}
                {i + 1}
              </span>
              {/* the window's first and last day say so, where the cell is wide enough (else the legend says it) */}
              {cap && (
                <span className="rc-cap-word" aria-hidden="true" data-testid="calendar-cap-word">
                  {cap === 'start' ? RANGE_WORDS.start : RANGE_WORDS.end}
                </span>
              )}
              {marks.length > 0 && <span className="rc-dot" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export default function RangeCalendar({ card, periods, showWindows, showDates }: { card: SelfV3CardView; periods: readonly PeriodView[]; showWindows: boolean; showDates: boolean }) {
  const today = todayIso();
  const windows = useMemo(() => (showWindows ? calendarWindows(card, periods, today) : []), [showWindows, card, periods, today]);
  const dates = useMemo(() => (showDates ? keyDatesOf(card, today) : []), [showDates, card, today]);
  const [rootRef, width] = useContentWidth<HTMLDivElement>();
  const n = monthsFor(width);
  const range = calendarMonths(windows, dates, today);
  const [picked, setPicked] = useState<number | null>(null);

  if (!range)
    return (
      <div ref={rootRef} data-testid="range-calendar">
        <p className="text-center text-[15px] text-white/60" data-testid="calendar-empty">
          {VIEW_WORDS.noDates}
        </p>
      </div>
    );

  const shown = clampStart(picked ?? openingMonth(windows, dates, today, n) ?? range.first, range, n);
  const limits = pageLimits(range, n);
  const jumps = jumpTargets(range, n, shown, today, datedSpan(windows, dates));
  const dateByDay = new Map<string, string[]>();
  for (const k of dates) dateByDay.set(k.date.slice(0, 10), [...(dateByDay.get(k.date.slice(0, 10)) ?? []), k.label]);
  const months = Array.from({ length: n }, (_, i) => shown + i);
  const rows = Math.max(...months.map(weekRows));
  // the window the legend names: the one holding today, else the first (the summary line's window)
  const legendWindow = windows.length ? (windowForDay(windows, today) ?? windows[0]!) : null;
  const chip = 'rounded-full border border-white/15 px-3 py-1 text-[13px] text-white/80 hover:bg-white/10 disabled:opacity-35 disabled:hover:bg-transparent';

  return (
    <div ref={rootRef} className="rc-root space-y-4" data-testid="range-calendar" data-months={n}>
      <SpanBar windows={windows} dates={dates} today={today} width={width} onPick={(w) => setPicked(clampStart(monthIndex(w.from), range, n))} />

      <div className="rc-months-block" style={{ ['--rc-rows' as string]: rows }}>
        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={() => setPicked(clampStart(shown - n, range, n))} disabled={shown <= limits.min} aria-label={RANGE_WORDS.prev(n)} className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white/75 hover:bg-white/10 disabled:opacity-30" data-testid="calendar-prev">
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <div className="flex flex-wrap items-center justify-center gap-1.5" role="group" aria-label={RANGE_WORDS.jumps}>
            <button type="button" className={chip} disabled={jumps.start.disabled} onClick={() => setPicked(jumps.start.to)} data-testid="calendar-jump-start">
              {RANGE_WORDS.start}
            </button>
            <button type="button" className={chip} disabled={jumps.today.disabled} onClick={() => setPicked(jumps.today.to)} data-testid="calendar-jump-today">
              {RANGE_WORDS.today}
            </button>
            <button type="button" className={chip} disabled={jumps.end.disabled} onClick={() => setPicked(jumps.end.to)} data-testid="calendar-jump-end">
              {RANGE_WORDS.end}
            </button>
          </div>
          <button type="button" onClick={() => setPicked(clampStart(shown + n, range, n))} disabled={shown >= limits.max} aria-label={RANGE_WORDS.next(n)} className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white/75 hover:bg-white/10 disabled:opacity-30" data-testid="calendar-next">
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="rc-months mt-2" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
          {months.map((mo) => (
            <Month key={mo} month={mo} windows={windows} dateByDay={dateByDay} today={today} rows={rows} />
          ))}
        </div>
        <p className="rc-legend" data-testid="calendar-legend">
          {legendWindow && (
            <>
              <span className="rc-legend-item">
                <span className={`rc-legend-cap rc-band-solid rc-tone-${toneOf(legendWindow)}`} aria-hidden="true" />
                {RANGE_WORDS.start} {dayWords(legendWindow.from)}
              </span>
              <span aria-hidden="true">·</span>
              <span className="rc-legend-item">
                <span className={`rc-legend-cap rc-band-solid rc-tone-${toneOf(legendWindow)}`} aria-hidden="true" />
                {RANGE_WORDS.end} {dayWords(legendWindow.to)}
              </span>
              <span aria-hidden="true">·</span>
            </>
          )}
          <span className="rc-legend-item">
            <span className="rc-legend-today" aria-hidden="true" />
            {VIEW_WORDS.today}
          </span>
        </p>
      </div>

      <div className={wideLists(width) ? 'grid grid-cols-2 gap-6' : 'space-y-4'} data-testid="calendar-lists">
        {windows.length > 0 && (
          <section data-testid="calendar-windows">
            <h4 className={label}>{VIEW_WORDS.windows}</h4>
            <ul className="mt-1.5 grid gap-1.5">
              {windows.map((w) => (
                <li key={w.key} className={`flex items-start gap-2 text-[14px] ${w.to < today && !w.current ? 'text-white/45' : 'text-white/85'}`} data-testid="calendar-window" data-window={w.key}>
                  <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${SPAN_TONE_DOT[toneOf(w)]}`} aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block">{w.label}</span>
                    <span className="block text-[13px] tabular-nums text-white/60">
                      {dayWords(w.from, { short: true, today })} → {dayWords(w.to, { short: true, today })} · {RANGE_WORDS.days(windowDays(w))}
                    </span>
                  </span>
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
                <li key={`${k.date}-${k.label}`} className={`flex gap-2 text-[14px] ${k.passed ? 'text-white/45' : 'text-white/85'}`} data-testid="calendar-key-date">
                  <b className="shrink-0 font-semibold">{dayWords(k.date, { short: true, today })}:</b> <span>{k.label}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
