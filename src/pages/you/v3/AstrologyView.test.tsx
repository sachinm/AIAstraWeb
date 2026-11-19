import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AstrologyView, { certaintyWord, chartShows } from './AstrologyView';
import { periodsOf } from './cardModel';
import { selfV3Fixture, selfV3OutlookCard } from './selfV3.fixture';
import type { SelfV3CardView } from '../../../lib/selfV3Api';

const TODAY = '2026-11-13';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(`${TODAY}T12:00:00`));
});
afterEach(() => vi.useRealTimers());

function mount(card: SelfV3CardView, pick = 0, showDetails = true) {
  const periods = periodsOf(card, TODAY);
  render(<AstrologyView card={card} period={periods[pick] ?? null} showDetails={showDetails} />);
}

describe('Astrology Reading', () => {
  it('shows the gift, the knot, what the chart shows for the picked stretch, the certainty word and the clocks', () => {
    mount(selfV3OutlookCard());
    expect(screen.getByTestId('astrology-gift')).toHaveTextContent('The gift');
    expect(screen.getByTestId('astrology-gift')).toHaveTextContent('sixth lord sits strong');
    expect(screen.getByTestId('astrology-knot')).toHaveTextContent('The knot');
    expect(screen.getByTestId('astrology-knot')).toHaveTextContent('Saturn crosses the ascendant');
    expect(screen.getByTestId('astrology-shows')).toHaveTextContent('What the chart shows');
    expect(screen.getByTestId('astrology-shows')).toHaveTextContent('Saturn on the ascendant weighs on vitality');
    expect(screen.getByTestId('astrology-certainty')).toHaveTextContent('Likely');
    expect(screen.getByTestId('astrology-clocks')).toHaveTextContent('Which clocks agree');
    expect(screen.getAllByTestId('analysis-system')).toHaveLength(5);
  });

  it('follows the picked stretch by its span id', () => {
    mount(selfV3OutlookCard(), 2);
    expect(screen.getByTestId('astrology-shows')).toHaveTextContent('Jupiter aspects the sixth house');
  });

  it('on Self keeps the chart details body when the card has one', () => {
    const stuck = selfV3Fixture().cards.find((c) => c.id === 'stuck')!;
    mount(stuck);
    expect(screen.getByTestId('astrology-details')).toHaveTextContent("the chart's own reasons");
  });

  it('the Why switch off hides the chart details', () => {
    const stuck = selfV3Fixture().cards.find((c) => c.id === 'stuck')!;
    mount(stuck, 0, false);
    expect(screen.queryByTestId('astrology-details')).toBeNull();
    expect(screen.getByTestId('astrology-empty')).toHaveTextContent('Nothing more to show for this card yet.');
  });

  it('renders without `chart` (an older server): the clocks only', () => {
    mount(selfV3OutlookCard({ withChart: false }));
    expect(screen.queryByTestId('astrology-gift')).toBeNull();
    expect(screen.queryByTestId('astrology-shows')).toBeNull();
    expect(screen.getByTestId('astrology-clocks')).toBeInTheDocument();
  });

  it('a card with none of it says so', () => {
    const mind = selfV3Fixture().cards.find((c) => c.id === 'mind')!;
    mount({ ...mind, v2: null });
    expect(screen.getByTestId('astrology-empty')).toHaveTextContent('Nothing more to show for this card yet.');
  });
});

describe('helpers', () => {
  it('maps only the certainty words it knows', () => {
    expect(certaintyWord('likely')).toBe('Likely');
    expect(certaintyWord('STRONG')).toBe('Strong');
    expect(certaintyWord('toString')).toBeNull();
    expect(certaintyWord('very')).toBeNull();
    expect(certaintyWord(null)).toBeNull();
  });

  it('matches what the chart shows by span id, else nothing', () => {
    const card = selfV3OutlookCard();
    const periods = periodsOf(card, TODAY);
    expect(chartShows(card, periods[1]!)).toMatch(/moon period/);
    expect(chartShows(card, null)).toBeNull();
    expect(chartShows({ ...card, v3: { ...card.v3!, chart: undefined } }, periods[0]!)).toBeNull();
  });
});
