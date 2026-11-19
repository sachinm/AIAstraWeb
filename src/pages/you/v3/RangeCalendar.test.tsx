import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import RangeCalendar, { BAR_LABEL_PX, barTicks, dayBand, daysBetween, monthIndex, monthsFor, openingMonth, summaryLine, weekRows, wideLists, type BarTick } from './RangeCalendar';
import { selfV3Fixture } from './selfV3.fixture';
import type { CardPeriodView, KeyDate, SelfV3CardView } from '../../../lib/selfV3Api';
import type { CalendarWindow } from './CardViews';

const body = selfV3Fixture().cards.find((c) => c.id === 'body')!;

const period = (o: Partial<CardPeriodView> & Pick<CardPeriodView, 'from' | 'to'>, i = 0): CardPeriodView => ({
  id: `w${i}`,
  name: `Stretch ${i}`,
  label: `Stretch ${i}`,
  headline: '',
  text: [],
  tone: 'heavy',
  current: false,
  passed: false,
  span: null,
  ...o,
});

function cardWith(periods: CardPeriodView[], keyDates: KeyDate[] = []): SelfV3CardView {
  return { ...body, rail: [], periods, keyDates };
}

function mount(card: SelfV3CardView, flags: { showWindows?: boolean; showDates?: boolean } = {}) {
  return render(<RangeCalendar card={card} periods={[]} showWindows={flags.showWindows ?? true} showDates={flags.showDates ?? true} />);
}

const win = (key: string, from: string, to: string, tone: CalendarWindow['tone'] = 'heavy'): CalendarWindow => ({ key, from, to, label: key, tone, current: false });
const shownMonths = () => screen.getAllByTestId('calendar-month').map((m) => m.getAttribute('data-month'));
const day = (d: string) => screen.getAllByTestId('calendar-day').find((c) => c.getAttribute('data-day') === d)!;

const LONG = period({ from: '2026-11-11', to: '2027-12-27', current: true, label: 'A long heavy stretch' });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-18T12:00:00'));
});
afterEach(() => {
  vi.useRealTimers();
});

describe('pure helpers', () => {
  it('monthsFor: 2 under 440 px of content, 3 from 440 px, 3 before the first measure', () => {
    expect(monthsFor(null)).toBe(3);
    expect(monthsFor(undefined)).toBe(3);
    expect(monthsFor(0)).toBe(3);
    expect(monthsFor(300)).toBe(2);
    expect(monthsFor(439)).toBe(2);
    expect(monthsFor(440)).toBe(3);
    expect(monthsFor(460)).toBe(3);
    expect(monthsFor(900)).toBe(3);
    expect(wideLists(639)).toBe(false);
    expect(wideLists(640)).toBe(true);
    expect(wideLists(null)).toBe(false);
  });

  it('opening rule: a window that began this month opens on its month; one that began 10 months ago opens on today', () => {
    const today = '2026-11-18';
    expect(openingMonth([win('a', '2026-11-11', '2027-12-27')], [], today, 3)).toBe(monthIndex('2026-11-01'));
    expect(openingMonth([win('a', '2026-11-11', '2027-12-27')], [], today, 2)).toBe(monthIndex('2026-11-01'));
    // began last month: with 3 shown, Oct stays first (today and a later month still on screen); with 2, today's month
    expect(openingMonth([win('a', '2026-10-05', '2027-06-01')], [], today, 3)).toBe(monthIndex('2026-10-01'));
    expect(openingMonth([win('a', '2026-10-05', '2027-06-01')], [], today, 2)).toBe(monthIndex('2026-11-01'));
    expect(openingMonth([win('a', '2026-01-10', '2027-06-01')], [], today, 3)).toBe(monthIndex('2026-11-01'));
  });

  it('opening rule clamps to the dated months and never opens on months with no date', () => {
    const today = '2026-11-18';
    // all dates ahead of today: the first dated month
    expect(openingMonth([win('a', '2027-03-01', '2027-08-01')], [], today, 3)).toBe(monthIndex('2027-03-01'));
    // all dates behind today: the last page that holds the last date
    expect(openingMonth([win('a', '2025-01-01', '2026-02-10')], [], today, 3)).toBe(monthIndex('2025-12-01'));
    // ends next month: the start is pulled back so the shown range still ends on the last date
    expect(openingMonth([win('a', '2026-01-01', '2026-12-10')], [], today, 3)).toBe(monthIndex('2026-10-01'));
    // today in a gap between two windows months apart: the first dated month on or after today
    expect(openingMonth([win('a', '2026-01-01', '2026-02-01'), win('b', '2027-05-01', '2027-06-01')], [], today, 3)).toBe(monthIndex('2027-04-01'));
    // nothing dated
    expect(openingMonth([], [], today, 3)).toBeNull();
  });

  it('summary line: day N of total, starts in, ended', () => {
    const w = { from: '2026-11-11', to: '2027-12-27' };
    expect(daysBetween(w.from, w.to) + 1).toBe(412);
    expect(summaryLine(w, '2026-11-18')).toBe('11 Nov 2026 → 27 Dec 2027 · day 8 of 412');
    expect(summaryLine(w, '2026-11-06')).toBe('11 Nov 2026 → 27 Dec 2027 · starts in 5 days');
    expect(summaryLine(w, '2028-01-01')).toBe('11 Nov 2026 → 27 Dec 2027 · ended');
  });

  /** each label's box on a bar `w` px wide: [left, right] in px */
  const boxes = (ticks: BarTick[], w: number) =>
    ticks.filter((t) => t.label).map((t) => ({ label: t.label!, lo: (t.left / 100) * w + t.offset, hi: (t.left / 100) * w + t.offset + BAR_LABEL_PX }));
  const noOverlap = (bs: Array<{ lo: number; hi: number }>) => bs.every((b, i) => i === 0 || b.lo >= bs[i - 1]!.hi);

  it('bar ticks: the start is always labelled; labels fit the measured width, never overlap and stay inside the bar', () => {
    const span = { from: '2026-11-11', to: '2027-12-27' };
    for (const w of [300, 420, 520, 744, 1000, 1400]) {
      const ticks = barTicks(span, w);
      expect(ticks[0]).toMatchObject({ start: true, left: 0, label: 'Nov ’26', offset: 0, align: 'l' });
      // one tick per month boundary inside the bar, after the start
      expect(ticks.length).toBe(1 + 13);
      const bs = boxes(ticks, w);
      expect(noOverlap(bs), `${w}px: ${JSON.stringify(bs)}`).toBe(true);
      expect(bs.every((b) => b.lo >= -0.01 && b.hi <= w + 0.01), `${w}px inside`).toBe(true);
      // a wider bar never shows fewer labels
      if (w >= 744) expect(bs.length).toBeGreaterThanOrEqual(6);
    }
    // the 744 px card of 912 × 1368: "Dec" next to the start label gives way, and January carries its year
    const at744 = barTicks(span, 744).filter((t) => t.label).map((t) => t.label);
    expect(at744).toEqual(['Nov ’26', 'Jan ’27', 'Mar', 'May', 'Jul', 'Sep', 'Nov']);
    // a short span on a wide bar labels every month
    expect(barTicks({ from: '2026-11-11', to: '2027-03-01' }, 600).map((t) => t.label)).toEqual(['Nov ’26', 'Dec', 'Jan ’27', 'Feb', 'Mar']);
    // ten years on a narrow bar: a few labels, none touching
    const long = barTicks({ from: '2021-03-01', to: '2031-03-01' }, 480);
    expect(long.length).toBe(121);
    const lb = boxes(long, 480);
    expect(lb.length).toBeGreaterThan(1);
    expect(lb.length).toBeLessThanOrEqual(Math.floor(480 / BAR_LABEL_PX));
    expect(noOverlap(lb)).toBe(true);
    // before the first measure the bar assumes 480 px
    expect(barTicks(span, null)).toEqual(barTicks(span, 480));
  });

  it('weekRows: the week rows a month needs, Monday first', () => {
    expect(weekRows(monthIndex('2026-11-01'))).toBe(6); // Sunday the 1st
    expect(weekRows(monthIndex('2026-12-01'))).toBe(5);
    expect(weekRows(monthIndex('2027-02-01'))).toBe(4); // Monday the 1st, 28 days
  });

  it('dayBand: caps at the window ends, rounded where a band starts or stops', () => {
    const ws = [win('a', '2026-11-11', '2026-11-20')];
    expect(dayBand(ws, '2026-11-11')).toMatchObject({ cap: 'start', roundLeft: true, roundRight: false });
    expect(dayBand(ws, '2026-11-15')).toMatchObject({ cap: null, roundLeft: false, roundRight: false });
    expect(dayBand(ws, '2026-11-20')).toMatchObject({ cap: 'end', roundLeft: false, roundRight: true });
    expect(dayBand(ws, '2026-11-21')).toBeNull();
  });

  it('dayBand: windows that share a handoff day give the earlier band its end cap the day before', () => {
    const ws = [win('a', '2026-11-01', '2026-11-20'), win('b', '2026-11-20', '2026-12-31', 'light')];
    expect(dayBand(ws, '2026-11-19')).toMatchObject({ cap: 'end', roundRight: true });
    expect(dayBand(ws, '2026-11-19')!.window.key).toBe('a');
    expect(dayBand(ws, '2026-11-20')).toMatchObject({ cap: 'start', roundLeft: true });
    expect(dayBand(ws, '2026-11-20')!.window.key).toBe('b');
    // a nested window breaks the outer band without giving it a false end cap
    const nested = [win('outer', '2026-01-01', '2026-12-31'), win('inner', '2026-06-10', '2026-06-20')];
    expect(dayBand(nested, '2026-06-09')).toMatchObject({ cap: null, roundRight: true });
  });
});

describe('RangeCalendar', () => {
  it('opens on Nov 2026 with Nov, Dec, Jan side by side and one unbroken band from 11 Nov', () => {
    mount(cardWith([LONG]));
    expect(screen.getByTestId('range-calendar')).toHaveAttribute('data-months', '3');
    expect(shownMonths()).toEqual(['2026-11', '2026-12', '2027-01']);
    const days = screen.getAllByTestId('calendar-day');
    const inBand = days.filter((d) => d.getAttribute('data-day')! >= '2026-11-11');
    expect(inBand.length).toBe(20 + 31 + 31);
    expect(inBand.every((d) => d.getAttribute('data-window') === 'pw0')).toBe(true);
    expect(days.filter((d) => d.getAttribute('data-day')! < '2026-11-11').every((d) => d.getAttribute('data-window') === '')).toBe(true);
    expect(day('2026-11-11')).toHaveAttribute('data-cap', 'start');
    expect(day('2026-11-12')).not.toHaveAttribute('data-cap');
    expect(day('2026-11-11')).toHaveAttribute('aria-label', expect.stringContaining('A long heavy stretch'));
    expect(day('2026-11-18')).toHaveAttribute('aria-label', expect.stringContaining('today'));
    expect(screen.getByTestId('range-summary')).toHaveTextContent('11 Nov 2026 → 27 Dec 2027 · day 8 of 412');
  });

  it('the End chip lands on Dec 2027 with its end cap; Start comes back; Today is offered only when off screen', () => {
    mount(cardWith([LONG]));
    expect(screen.getByTestId('calendar-jump-start')).toBeDisabled();
    expect(screen.getByTestId('calendar-jump-today')).toBeDisabled();
    fireEvent.click(screen.getByTestId('calendar-jump-end'));
    expect(shownMonths()).toEqual(['2027-10', '2027-11', '2027-12']);
    expect(day('2027-12-27')).toHaveAttribute('data-cap', 'end');
    expect(day('2027-12-28')).toHaveAttribute('data-window', '');
    expect(screen.getByTestId('calendar-jump-end')).toBeDisabled();
    expect(screen.getByTestId('calendar-next')).toBeDisabled();
    expect(screen.getByTestId('calendar-jump-today')).not.toBeDisabled();
    fireEvent.click(screen.getByTestId('calendar-jump-today'));
    expect(shownMonths()[0]).toBe('2026-11');
    fireEvent.click(screen.getByTestId('calendar-jump-end'));
    fireEvent.click(screen.getByTestId('calendar-jump-start'));
    expect(shownMonths()).toEqual(['2026-11', '2026-12', '2027-01']);
  });

  it('the pager steps by the months shown and stops at the first and last limits', () => {
    mount(cardWith([LONG]));
    expect(screen.getByTestId('calendar-prev')).toBeDisabled();
    fireEvent.click(screen.getByTestId('calendar-next'));
    expect(shownMonths()).toEqual(['2027-02', '2027-03', '2027-04']);
    fireEvent.click(screen.getByTestId('calendar-next'));
    fireEvent.click(screen.getByTestId('calendar-next'));
    expect(shownMonths()).toEqual(['2027-08', '2027-09', '2027-10']);
    fireEvent.click(screen.getByTestId('calendar-next'));
    // the last page is clamped so it ends on the last dated month
    expect(shownMonths()).toEqual(['2027-10', '2027-11', '2027-12']);
    expect(screen.getByTestId('calendar-next')).toBeDisabled();
    fireEvent.click(screen.getByTestId('calendar-prev'));
    expect(shownMonths()).toEqual(['2027-07', '2027-08', '2027-09']);
  });

  it('a window that began ten months ago opens on today\'s month', () => {
    mount(cardWith([period({ from: '2026-01-05', to: '2027-06-30', current: true })]));
    expect(shownMonths()).toEqual(['2026-11', '2026-12', '2027-01']);
    expect(screen.getByTestId('calendar-prev')).not.toBeDisabled();
  });

  it('a span bar segment per window moves the months to that window', () => {
    mount(cardWith([period({ from: '2026-11-11', to: '2027-02-10', tone: 'heavy' }, 0), period({ from: '2027-02-11', to: '2027-09-30', tone: 'light' }, 1)]));
    const segs = within(screen.getByTestId('range-bar')).getAllByTestId('range-bar-segment');
    expect(segs).toHaveLength(2);
    expect(screen.getByTestId('range-bar-today')).toBeInTheDocument();
    fireEvent.click(segs.find((s) => s.getAttribute('data-window') === 'pw1')!);
    expect(shownMonths()).toEqual(['2027-02', '2027-03', '2027-04']);
    expect(day('2027-02-10')).toHaveAttribute('data-cap', 'end');
    expect(day('2027-02-11')).toHaveAttribute('data-cap', 'start');
    expect(day('2027-02-11')).toHaveAttribute('data-window', 'pw1');
  });

  it('key dates carry a dot and a bold number, and are listed with passed ones dimmed', () => {
    mount(cardWith([LONG], [{ date: '2026-11-02', label: 'an old turn' }, { date: '2026-12-04', label: 'a heavy pressure lifts' }]));
    const marked = screen.getAllByTestId('calendar-day').filter((d) => d.getAttribute('data-key-date') === 'true');
    expect(marked.map((d) => d.getAttribute('data-day'))).toEqual(['2026-11-02', '2026-12-04']);
    expect(day('2026-12-04')).toHaveAttribute('aria-label', expect.stringContaining('a heavy pressure lifts'));
    expect(day('2026-12-04').className).toMatch(/font-bold/);
    expect(day('2026-12-04').querySelector('.rc-dot')).not.toBeNull();
    const list = screen.getAllByTestId('calendar-key-date');
    expect(list[0]).toHaveTextContent('2 Nov: an old turn');
    expect(list[0]!.className).toMatch(/text-white\/45/);
    expect(list[1]!.className).toMatch(/text-white\/85/);
    expect(within(screen.getByTestId('range-bar')).getAllByTestId('range-bar-key-date')).toHaveLength(1);
  });

  it('lists each window with both dates and its length in days', () => {
    mount(cardWith([LONG]));
    expect(screen.getByTestId('calendar-window')).toHaveTextContent('A long heavy stretch');
    expect(screen.getByTestId('calendar-window')).toHaveTextContent('11 Nov → 27 Dec 2027 · 412 days');
  });

  it('shows the plain empty line when nothing is dated (or the switches hide everything)', () => {
    const { unmount } = mount(cardWith([]));
    expect(screen.getByTestId('calendar-empty')).toHaveTextContent('This card has no dates yet.');
    expect(screen.queryByTestId('range-bar')).toBeNull();
    unmount();
    mount(cardWith([LONG], [{ date: '2026-12-04', label: 'x' }]), { showWindows: false, showDates: false });
    expect(screen.getByTestId('calendar-empty')).toBeInTheDocument();
  });

  it("the window's first and last day carry the words Start and End, and the legend names both with today", () => {
    mount(cardWith([LONG]));
    expect(day('2026-11-11')).toHaveAttribute('data-cap', 'start');
    expect(within(day('2026-11-11')).getByTestId('calendar-cap-word')).toHaveTextContent('Start');
    expect(within(day('2026-11-12')).queryByTestId('calendar-cap-word')).toBeNull();
    const legend = screen.getByTestId('calendar-legend');
    expect(legend).toHaveTextContent('Start 11 Nov 2026');
    expect(legend).toHaveTextContent('End 27 Dec 2027');
    expect(legend).toHaveTextContent('today');
    expect(legend.querySelectorAll('.rc-legend-cap.rc-tone-heavy')).toHaveLength(2);
    fireEvent.click(screen.getByTestId('calendar-jump-end'));
    expect(within(day('2027-12-27')).getByTestId('calendar-cap-word')).toHaveTextContent('End');
  });

  it('today on the bar is a line with a dot and a word; the months on screen share one row count', () => {
    mount(cardWith([LONG]));
    const marker = screen.getByTestId('range-bar-today');
    expect(marker.querySelector('.rc-bar-today-dot')).not.toBeNull();
    expect(marker.style.getPropertyValue('--rc-at')).toMatch(/%$/);
    expect(screen.getByTestId('range-bar-today-label')).toHaveTextContent('today');
    // Nov 2026 needs six week rows: Dec and Jan are drawn on six too, so their weeks line up
    const rows = screen.getAllByTestId('calendar-month').map((m) => (m.querySelector('ol') as HTMLElement).style.getPropertyValue('--rc-rows'));
    expect(rows).toEqual(['6', '6', '6']);
    // the bar's start carries its month and year
    expect(within(screen.getByTestId('range-bar')).getAllByTestId('range-bar-label')[0]).toHaveTextContent('Nov ’26');
  });

  it('no today marker when today is outside the bar', () => {
    mount(cardWith([period({ from: '2027-01-05', to: '2027-06-30' })]));
    expect(screen.queryByTestId('range-bar-today')).toBeNull();
    expect(screen.queryByTestId('range-bar-today-label')).toBeNull();
  });

  it('never names the engine', () => {
    const { container } = mount(cardWith([LONG], [{ date: '2026-12-04', label: 'x' }]));
    expect(container.textContent).not.toMatch(/radha|pyjhora/i);
  });
});
