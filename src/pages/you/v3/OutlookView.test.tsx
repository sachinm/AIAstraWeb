import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import OutlookView, { barAt, stretchSpan, whyLine } from './OutlookView';
import { periodsOf, standingOf } from './cardModel';
import { selfV3Fixture, selfV3OutlookCard } from './selfV3.fixture';
import type { SelfV3CardView } from '../../../lib/selfV3Api';

const TODAY = '2026-11-13';

function mount(card: SelfV3CardView, pick = 0, extra: Partial<Parameters<typeof OutlookView>[0]> = {}) {
  const periods = periodsOf(card, TODAY);
  const onAstrology = vi.fn();
  render(
    <OutlookView card={card} period={periods[pick] ?? null} periods={periods} standing={standingOf(card)} options={{ plan: 'with' }} showWhy showDates onAstrology={onAstrology} {...extra} />,
  );
  return { onAstrology, periods };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(`${TODAY}T12:00:00`));
});
afterEach(() => vi.useRealTimers());

describe('Outlook, in the plan\'s order', () => {
  it('Why, What to do, the stretch text, the ladder and the pattern, then Key dates and the systems', () => {
    mount(selfV3OutlookCard());
    const view = screen.getByTestId('outlook-view');
    const order = Array.from(view.querySelectorAll('[data-testid]'))
      .map((e) => e.getAttribute('data-testid'))
      .filter((t) => ['outlook-why', 'section-todo', 'outlook-text', 'analysis-ladder', 'section-pattern', 'key-dates', 'analysis-systems'].includes(t!));
    expect(order).toEqual(['outlook-why', 'section-todo', 'outlook-text', 'analysis-ladder', 'section-pattern', 'key-dates', 'analysis-systems']);
    expect(screen.getByTestId('todo-best')).toHaveTextContent('stop and write tomorrow');
    expect(screen.getByTestId('todo-avoid')).toHaveTextContent('working late');
    expect(screen.getByTestId('stretch-text')).toHaveTextContent('guard your evenings');
    expect(screen.getAllByTestId('key-date')).toHaveLength(2);
    expect(screen.getByTestId('analysis-agreement')).toHaveTextContent('4 of 5 agree');
  });

  it('shows the card\'s own Why sentence and a link to the astrology reading', () => {
    const { onAstrology } = mount(selfV3OutlookCard());
    expect(screen.getByTestId('outlook-why-line')).toHaveTextContent('You have run on short sleep since May');
    fireEvent.click(screen.getByTestId('outlook-see-astrology'));
    expect(onAstrology).toHaveBeenCalledTimes(1);
  });

  it('without a Why sentence, counts the timing systems for the stretch on screen', () => {
    mount(selfV3OutlookCard({ withWhy: false }));
    expect(screen.getByTestId('outlook-why-line')).toHaveTextContent('4 of 5 timing systems read this stretch as heavy');
  });

  it('a split stretch gets no tone word in its counted line', () => {
    mount(selfV3OutlookCard({ withWhy: false }), 1);
    expect(screen.getByTestId('outlook-why-line')).toHaveTextContent('2 of 5 timing systems agree on this stretch');
    expect(screen.getByTestId('outlook-why-line')).not.toHaveTextContent(/mixed|heavy|light/);
  });

  it('no Why sentence and no counts: the section is left out', () => {
    const mind = selfV3Fixture().cards.find((c) => c.id === 'mind')!;
    const card = { ...mind, v3: { ...mind.v3!, agreement: null } };
    mount(card);
    expect(screen.queryByTestId('outlook-why')).toBeNull();
    expect(whyLine(card, null)).toBeNull();
  });

  it('never uses chart language: the chart text stays on the Astrology tab', () => {
    mount(selfV3OutlookCard());
    expect(screen.getByTestId('outlook-view')).not.toHaveTextContent(/Saturn|Jupiter|ascendant|sixth lord|house/);
  });

  it('Key dates carry a start-to-end bar of the stretch with today marked', () => {
    mount(selfV3OutlookCard());
    const bar = screen.getByTestId('outlook-stretch-bar');
    expect(bar).toHaveAttribute('data-from', '2026-11-09');
    expect(bar).toHaveAttribute('data-to', '2026-12-05');
    expect(within(bar).getByTestId('outlook-bar-from')).toHaveTextContent('9 Nov 2026');
    expect(within(bar).getByTestId('outlook-bar-to')).toHaveTextContent('5 Dec 2026');
    expect(within(bar).getByTestId('outlook-bar-today')).toBeInTheDocument();
  });

  it('a stretch ahead has no today mark', () => {
    mount(selfV3OutlookCard(), 2);
    expect(screen.queryByTestId('outlook-bar-today')).toBeNull();
  });

  it('the feature switches hide Why and Key dates', () => {
    mount(selfV3OutlookCard(), 0, { showWhy: false, showDates: false });
    expect(screen.queryByTestId('outlook-why')).toBeNull();
    expect(screen.queryByTestId('key-dates')).toBeNull();
  });

  it('a card with nothing to say says so', () => {
    const body = selfV3Fixture().cards.find((c) => c.id === 'body')!;
    const card: SelfV3CardView = { ...body, rail: [], v3: { ...body.v3!, spans: [], ladder: null, pattern: null, agreement: null } };
    render(<OutlookView card={card} period={null} periods={[]} standing={[]} options={{ plan: 'with' }} showWhy showDates />);
    expect(screen.getByTestId('outlook-empty')).toBeInTheDocument();
  });
});

describe('the bar\'s date arithmetic', () => {
  it('places a day on the stretch, or nowhere when outside it', () => {
    const span = { from: '2026-11-01', to: '2026-11-11' };
    expect(barAt(span, '2026-11-01')).toBe(0);
    expect(barAt(span, '2026-11-06')).toBe(50);
    expect(barAt(span, '2026-11-11')).toBe(100);
    expect(barAt(span, '2026-11-12')).toBeNull();
  });

  it('without a picked stretch spans the first to the last period', () => {
    const periods = periodsOf(selfV3OutlookCard(), TODAY);
    expect(stretchSpan(null, periods)).toEqual({ from: '2026-11-09', to: '2027-10-04' });
    expect(stretchSpan(null, [])).toBeNull();
  });
});
