/**
 * The phone card's Analysis tab on a card with no v2 details (every Love and Work card): "Why we think so" comes from
 * the chart reading the server sends (server docs/dashboards/13 §4.1), so the tab is never blank where a reading exists.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AnalysisView } from './CardViews';
import { periodsOf } from './cardModel';
import { selfV3OutlookCard } from './selfV3.fixture';
import type { SelfV3CardView } from '../../../lib/selfV3Api';

const TODAY = '2026-11-13';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(`${TODAY}T12:00:00`));
});
afterEach(() => vi.useRealTimers());

function mount(card: SelfV3CardView, why = true) {
  const periods = periodsOf(card, TODAY);
  render(<AnalysisView card={card} period={periods.find((p) => p.current) ?? periods[0] ?? null} options={{ plan: 'with' }} why={why} />);
}

/** a Love or Work card: no v2 block at all */
const boardCard = (): SelfV3CardView => ({ ...selfV3OutlookCard(), v2: null });

describe('Analysis on a card with no v2 details', () => {
  it('says why from the chart reading: what the chart shows, the gift and the knot', () => {
    mount(boardCard());
    const why = screen.getByTestId('analysis-chart');
    expect(why).toHaveTextContent('Why we think so');
    expect(why).toHaveTextContent('sixth lord sits strong');
    expect(why).toHaveTextContent('Saturn crosses the ascendant');
    expect(why.querySelectorAll('p').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByTestId('analysis-why')).toBeNull();
  });

  it('shows nothing of the chart reading when Why is not allowed', () => {
    mount(boardCard(), false);
    expect(screen.queryByTestId('analysis-chart')).toBeNull();
  });

  it('a card with neither details nor a chart reading keeps today’s view', () => {
    mount({ ...selfV3OutlookCard({ withChart: false }), v2: null });
    expect(screen.queryByTestId('analysis-chart')).toBeNull();
    expect(screen.queryByTestId('analysis-why')).toBeNull();
  });
});
