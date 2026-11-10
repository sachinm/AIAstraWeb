/**
 * AreaCard (server 2026-11-09): the storyteller's illustration under the body, the `stale` status with its small line,
 * and a ladder that skips the steps the server dropped (left '').
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import AreaCard from './AreaCard';
import { selfV2Fixture } from './selfV2.fixture';
import { V2_WORDS } from './words';
import type { CardIllustration, SelfV2Area } from '../../../lib/selfV2Api';

const stuck = (edit?: (a: SelfV2Area) => void): SelfV2Area => {
  const a = structuredClone(selfV2Fixture().areas.find((x) => x.id === 'stuck')!);
  edit?.(a);
  return a;
};
const show = (area: SelfV2Area) => render(<AreaCard area={area} nextCheck={null} onDetails={vi.fn()} />);

describe('AreaCard: storyteller, stale, ladder', () => {
  it.each<[CardIllustration['kind'], string]>([
    ['analogy', 'Think of it this way'],
    ['example', 'For example'],
    ['modern', 'Like…'],
  ])('shows a %s illustration under the body as a quote block headed "%s"', (kind, heading) => {
    show(stuck((a) => (a.card!.illustration = { text: 'Like a phone on low battery: every app costs more.', kind, illustrates: 'stuck.p1' })));
    const block = screen.getByTestId('area-illustration');
    expect(block).toHaveAttribute('data-kind', kind);
    expect(within(block).getByText(heading)).toBeInTheDocument();
    expect(block.querySelector('blockquote')).toHaveTextContent('Like a phone on low battery: every app costs more.');
    // under the body, before the patterns
    const body = screen.getByTestId('area-body');
    const paras = [...body.querySelectorAll('p')];
    expect(paras.length).toBeGreaterThan(0);
    expect(paras[paras.length - 1]!.compareDocumentPosition(block) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(block.compareDocumentPosition(screen.getByTestId('area-patterns')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('no illustration, no block', () => {
    show(stuck());
    expect(screen.queryByTestId('area-illustration')).toBeNull();
  });

  it('a stale area shows its card with "From your last reading"', () => {
    show(stuck((a) => (a.status = 'stale')));
    const card = screen.getByTestId('area-card-stuck');
    expect(card).toHaveAttribute('data-status', 'stale');
    expect(within(card).getByTestId('area-stale')).toHaveTextContent(V2_WORDS.cardStale);
    expect(within(card).getByTestId('area-headline')).toHaveTextContent('Where you get stuck: ideas outrun their footing');
    expect(within(card).getByTestId('area-certainty')).toBeInTheDocument();
  });

  it('a fresh card has no stale line', () => {
    show(stuck());
    expect(screen.queryByTestId('area-stale')).toBeNull();
  });

  it('skips an empty ladder step, and draws no ladder when every step is empty', () => {
    const { unmount } = show(stuck((a) => (a.card!.ladder = { ...a.card!.ladder!, drift: '', floor: '  ' })));
    const ladder = screen.getByTestId('area-ladder');
    expect(ladder.querySelectorAll('li')).toHaveLength(2);
    expect(ladder).toHaveTextContent(/Best.*Practical/);
    expect(ladder).not.toHaveTextContent(/Drift|Floor/);
    unmount();
    show(stuck((a) => (a.card!.ladder = { best: '', practical: '', drift: '', floor: '' })));
    expect(screen.queryByTestId('area-ladder')).toBeNull();
  });
});
