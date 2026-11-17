import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import SeasonsCard from './SeasonsCard';
import { cardNow } from './boardOptions';
import { selfV3Fixture } from './selfV3.fixture';
import { clearSelfV3Cached } from '../../../lib/selfV3Cache';
import type { CardOptions } from '../../../lib/cardOptions';
import type { RailItem, SelfV3CardView } from '../../../lib/selfV3Api';
import type { CardProps } from './CardFrame';

const fx = selfV3Fixture();
const body = fx.cards.find((c) => c.id === 'body')!;

function mount(card: SelfV3CardView = body, opts: Partial<CardOptions> = {}, extra: Partial<CardProps> = {}) {
  const onOptions = vi.fn();
  const onWhy = vi.fn();
  const r = render(<SeasonsCard card={card} options={{ ...cardNow(fx.layout, card.id), ...opts }} onOptions={onOptions} onWhy={onWhy} {...extra} />);
  return { onOptions, onWhy, ...r };
}

const rail = (over: Partial<RailItem>[]): RailItem[] =>
  over.map((o, i) => ({ from: '2026-01-01', to: '2026-02-01', label: '', tone: null, note: null, current: false, span: null, text: [`Text ${i}.`], ...o }));

beforeEach(() => {
  clearSelfV3Cached();
  sessionStorage.clear();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-13T12:00:00'));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('the header', () => {
  it('carries the card name large in the art with a one-line subtitle; no small caps label', () => {
    mount();
    const head = screen.getByTestId('card-header');
    expect(within(head).getByTestId('card-title')).toHaveTextContent('Body & energy');
    expect(within(head).getByTestId('card-title').className).not.toMatch(/uppercase/);
    expect(within(head).getByTestId('card-subtitle')).toHaveTextContent('How to pace yourself');
  });

  it('uses the server subtitle when sent', () => {
    mount({ ...body, subtitle: 'Your energy, month by month' });
    expect(screen.getByTestId('card-subtitle')).toHaveTextContent('Your energy, month by month');
  });

  it.each([
    ['What bothers you', 'What’s weighing on you'],
    ['Gifts & knots', 'Your strengths and sticking points'],
    ['In short', 'Your life right now'],
    ['Chapters', 'Your life phases: before, now, next'],
    ['This year', 'Your year'],
  ])('renames "%s" to "%s" until the server sends the new name', (old, now) => {
    mount({ ...body, title: old });
    expect(screen.getByTestId('card-title')).toHaveTextContent(now);
  });

  it('puts Why in the header and opens it for the period on screen', () => {
    const { onWhy } = mount();
    fireEvent.click(within(screen.getByTestId('card-header')).getByTestId('card-why'));
    expect(onWhy).toHaveBeenCalledWith(body, expect.objectContaining({ current: true }));
  });

  it('hides Why when the server has it off', () => {
    mount(body, {}, { allowed: { short: true, periods: true, keyDates: true, why: false, confirm: true } });
    expect(screen.queryByTestId('card-why')).toBeNull();
  });
});

describe('two faces only', () => {
  it('offers Read and Short and no tools', () => {
    mount();
    expect(screen.getByTestId('face-read')).toBeInTheDocument();
    expect(screen.getByTestId('face-short')).toBeInTheDocument();
    for (const gone of ['face-light', 'face-breakdown', 'face-research', 'tool-table', 'tool-calendar', 'tool-dates', 'tool-timeframe', 'tool-plan', 'tool-info']) {
      expect(screen.queryByTestId(gone)).toBeNull();
    }
    expect(screen.getAllByRole('radio')).toHaveLength(2);
  });

  it('Short is stored as the face the server already accepts, for this card only', () => {
    const { onOptions } = mount();
    fireEvent.click(screen.getByTestId('face-short'));
    expect(onOptions).toHaveBeenCalledWith({ face: 'light' });
  });

  it('a face from an older build reads as Read (breakdown, research) or Short (light)', () => {
    const { unmount } = mount(body, { face: 'research' });
    expect(screen.getByTestId('face-body-read')).toBeInTheDocument();
    unmount();
    mount(body, { face: 'light' });
    expect(screen.getByTestId('face-body-short')).toBeInTheDocument();
  });

  it('Read shows the text, one pattern line and What to do: one step and one thing to avoid', () => {
    mount();
    expect(screen.getByTestId('stretch-text')).toHaveTextContent('guard your evenings');
    expect(screen.getByTestId('section-pattern')).toHaveTextContent('You push through tiredness');
    expect(screen.getByTestId('todo-best')).toHaveTextContent('stop and write tomorrow’s first task');
    expect(screen.getByTestId('todo-avoid')).toHaveTextContent('working late');
    expect(screen.queryByText('Drift')).toBeNull();
    expect(screen.queryByText('Floor')).toBeNull();
  });

  it('Short is one sentence and the one step', () => {
    mount(body, { face: 'light' });
    expect(screen.getByTestId('short-sentence')).toHaveTextContent('This stretch asks you to guard your evenings and keep the body warm.');
    expect(screen.getByTestId('short-step')).toBeInTheDocument();
    expect(screen.queryByTestId('section-pattern')).toBeNull();
  });

  it('Read only, with no switch, when Short is off', () => {
    mount(body, { face: 'light' }, { allowed: { short: false, periods: true, keyDates: true, why: true, confirm: true } });
    expect(screen.queryByTestId('face-switch')).toBeNull();
    expect(screen.getByTestId('face-body-read')).toBeInTheDocument();
  });
});

describe('named, ordered periods', () => {
  it('labels each chip with a name and dates', () => {
    mount();
    expect(screen.getByTestId('period-0')).toHaveTextContent('Heavy stretch · to 5 Dec 2026');
    expect(screen.getByTestId('period-2')).toHaveTextContent('Lighter stretch · from 1 Mar 2027');
  });

  it('picking a chip swaps the headline and the text', () => {
    mount();
    const before = screen.getByTestId('card-line').textContent;
    fireEvent.click(screen.getByTestId('period-1'));
    expect(screen.getByTestId('card-line').textContent).not.toBe(before);
    expect(screen.getByTestId('card-line')).toHaveTextContent('Energy comes back in waves');
    expect(screen.getByTestId('stretch-text')).toHaveTextContent('Energy comes back in waves');
  });

  it('a server headline for the period wins', () => {
    mount({ ...body, rail: body.rail.map((r, i) => (i === 2 ? { ...r, headline: 'A season to build strength.', name: 'Next: build' } : r)) });
    fireEvent.click(screen.getByTestId('period-2'));
    expect(screen.getByTestId('card-line')).toHaveTextContent('A season to build strength.');
    expect(screen.getByTestId('period-2')).toHaveTextContent('Next: build · from 1 Mar 2027');
  });

  it('orders by start, merges periods ending the same day, greys the past and offers only periods with text', () => {
    const card: SelfV3CardView = {
      ...body,
      v3: null,
      rail: rail([
        { from: '2027-01-01', to: '2028-02-16', name: 'Next: new phase' },
        { from: '2026-05-01', to: '2027-01-01', name: 'Venus stretch', current: true },
        { from: '2026-10-01', to: '2027-01-01', name: 'Short stretch', text: null },
        { from: '2025-01-01', to: '2026-05-01', name: 'Behind you' },
        { from: '2028-02-16', to: '2037-02-15', name: 'Long arc', text: null },
      ]),
    };
    mount(card);
    const chips = within(screen.getByRole('tablist')).getAllByRole('tab');
    expect(chips.map((c) => c.textContent)).toEqual(['Behind you · 1 Jan 2025 – 1 May 2026passed', 'Venus stretch · to 1 Jan 2027', 'Next: new phase · from 1 Jan 2027']);
    expect(chips[0]).toHaveAttribute('data-past', 'true');
    expect(chips[1]).toHaveAttribute('aria-selected', 'true');
    expect(chips[1]).toHaveAttribute('aria-controls', 'card-body-body');
    expect(screen.getByTestId('card-body')).toHaveAttribute('role', 'tabpanel');
  });

  it('a card with one period of its own shows no chips', () => {
    mount({ ...body, v3: null, rail: rail([{ from: '2026-01-01', to: '2027-01-01', current: true }, { from: '2027-01-01', to: '2028-01-01', text: null }]) });
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.getByTestId('stretch-text')).toHaveTextContent('Text 0.');
  });

  it('no chips when the server has periods off', () => {
    mount(body, {}, { allowed: { short: true, periods: false, keyDates: true, why: true, confirm: true } });
    expect(screen.queryByRole('tablist')).toBeNull();
  });
});

describe('key dates, confirm, stale guard, scroll and lock', () => {
  it('lists key dates in plain words with the passed ones marked', () => {
    mount({ ...body, keyDates: [{ date: '2026-12-05', label: 'a heavy pressure lifts' }, { date: '2026-11-11', label: 'the sharpest mental stress clears' }] });
    const items = within(screen.getByTestId('key-dates')).getAllByTestId('key-date');
    expect(items[0]).toHaveTextContent('11 Nov: the sharpest mental stress clears(passed)');
    expect(items[0]).toHaveAttribute('data-passed', 'true');
    expect(items[1]).toHaveTextContent('5 Dec: a heavy pressure lifts');
    expect(screen.queryByText(/calendar/i)).toBeNull();
  });

  it('no Key dates section when the card has none', () => {
    mount();
    expect(screen.queryByTestId('key-dates')).toBeNull();
  });

  it('"Is this right?" answers Yes / Not really / Not sure and sends yes / no / skip', async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetch);
    mount(body, {}, { confirmOn: true });
    expect(screen.getByTestId('confirm-yes')).toHaveTextContent('Yes');
    expect(screen.getByTestId('confirm-no')).toHaveTextContent('Not really');
    expect(screen.getByTestId('confirm-skip')).toHaveTextContent('Not sure');
    fireEvent.click(screen.getByTestId('confirm-skip'));
    await screen.findByTestId('section-confirm-done');
    const sent = JSON.parse((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(sent).toEqual({ claimId: 'body.c1', answer: 'skip' });
  });

  it('"Is this right?" follows the board setting', () => {
    mount(body, {}, { confirmOn: false });
    expect(screen.queryByTestId('section-confirm')).toBeNull();
  });

  it('shows the stale-dates note with Refresh when the server flags passed dates', () => {
    const onRefresh = vi.fn();
    mount({ ...body, datesPassed: true }, {}, { onRefresh });
    expect(screen.getByTestId('card-dates-passed')).toHaveTextContent('Some dates here have passed. Refresh to update.');
    fireEvent.click(screen.getByTestId('card-refresh'));
    expect(onRefresh).toHaveBeenCalled();
  });

  it('keeps the headline outside the scrolling body', () => {
    mount();
    const scroll = screen.getByTestId('card-body');
    expect(scroll.className).toMatch(/overflow-y-auto/);
    expect(scroll).not.toContainElement(screen.getByTestId('card-line'));
  });

  it('a locked card shows a lock and "Part of Plus" and none of its content', () => {
    mount(body, {}, { lockedPlan: 'plus' });
    expect(screen.getByTestId('card-locked')).toHaveTextContent('Part of Plus');
    expect(screen.queryByTestId('card-line')).toBeNull();
    expect(screen.queryByTestId('stretch-text')).toBeNull();
    expect(screen.queryByTestId('card-why')).toBeNull();
  });
});
