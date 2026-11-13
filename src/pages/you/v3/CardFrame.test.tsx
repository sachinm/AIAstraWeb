import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import SeasonsCard from './SeasonsCard';
import { cardNow } from './boardOptions';
import { selfV3Fixture } from './selfV3.fixture';
import { clearSelfV3Cached } from '../../../lib/selfV3Cache';
import type { CardOptions } from '../../../lib/cardOptions';

const fx = selfV3Fixture();
const card = fx.cards.find((c) => c.id === 'body')!;

function mount(opts: Partial<CardOptions> = {}, extra: Partial<React.ComponentProps<typeof SeasonsCard>> = {}) {
  const onOptions = vi.fn();
  const onDetails = vi.fn();
  render(<SeasonsCard card={card} options={{ ...cardNow(fx.layout, 'body'), ...opts }} onOptions={onOptions} onDetails={onDetails} {...extra} />);
  return { onOptions, onDetails };
}

function pointer(coarse: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((q: string) => ({ matches: coarse && q.includes('pointer: coarse'), media: q, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {} })),
  );
}

beforeEach(() => {
  clearSelfV3Cached();
  sessionStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

describe('the card on the page', () => {
  it('the reading takes the whole card: no right-hand rail', () => {
    mount();
    expect(screen.queryByTestId('self-v3-right')).toBeNull();
    expect(screen.getByTestId('period-strip-body')).toBeInTheDocument();
  });

  it('starts short with a teaser; "full" starts expanded', () => {
    mount({ start: 'short' });
    expect(screen.getByTestId('show-more-toggle')).toHaveTextContent('Show more: 2 more paragraphs, 2 dated windows and 4 steps to take');
    expect(screen.queryByTestId('stretch-step')).toBeNull();
  });

  it('start "full" opens with everything shown', () => {
    mount({ start: 'full' });
    expect(screen.getByTestId('show-more-toggle')).toHaveTextContent('Show less');
    expect(screen.getByTestId('stretch-step')).toBeInTheDocument();
    expect(screen.getByTestId('section-windows')).toBeInTheDocument();
  });

  it('Show more reveals the rest, Show less folds it, and the choice is remembered for the session', () => {
    mount();
    fireEvent.click(screen.getByTestId('show-more-toggle'));
    expect(screen.getByTestId('stretch-step')).toBeInTheDocument();
    expect(sessionStorage.getItem('astra.selfv3.more.body.0')).toBe('1');
    fireEvent.click(screen.getByTestId('show-more-toggle'));
    expect(screen.queryByTestId('stretch-step')).toBeNull();
  });

  it('every face keeps the card title, the Chart details link and Is this right? (on)', () => {
    for (const face of ['read', 'light', 'breakdown', 'research'] as const) {
      const { unmount } = render(<SeasonsCard card={card} options={{ ...cardNow(fx.layout, 'body'), face }} confirmOn onOptions={() => {}} onDetails={() => {}} />);
      expect(screen.getByTestId('card-details-open')).toBeInTheDocument();
      expect(screen.getByTestId('toolbar-details')).toBeInTheDocument();
      expect(screen.getByTestId('section-confirm')).toBeInTheDocument();
      unmount();
    }
  });

  it('"Is this right?" follows the board setting', () => {
    mount({}, { confirmOn: false });
    expect(screen.queryByTestId('section-confirm')).toBeNull();
    expect(screen.getByTestId('card-details-open')).toBeInTheDocument();
  });

  it('Chart details opens for the period on screen', () => {
    const { onDetails } = mount();
    fireEvent.click(screen.getByTestId('card-details-open'));
    expect(onDetails).toHaveBeenCalledWith(card, expect.objectContaining({ span: 's1' }), expect.stringContaining('now'));
  });

  it('turning a face on asks the board to save it for this card only', () => {
    const { onOptions } = mount();
    fireEvent.click(screen.getByTestId('face-breakdown'));
    expect(onOptions).toHaveBeenCalledWith({ face: 'breakdown' });
    fireEvent.click(screen.getByTestId('tool-plan'));
    expect(onOptions).toHaveBeenLastCalledWith({ tools: ['plan'] });
  });

  it('the Breakdown face shows the sections by name, each with its own words', () => {
    mount({ face: 'breakdown' });
    expect(screen.getByTestId('block-asks')).toHaveTextContent('guard your evenings');
    expect(screen.getByTestId('block-trap')).toHaveTextContent('working late');
  });

  it('the Light face is a sentence and one step', () => {
    mount({ face: 'light' });
    expect(screen.getByTestId('light-sentence')).toHaveTextContent('This stretch asks you to guard your evenings and keep the body warm.');
  });
});

describe('By timeframe: swipe or accordion by the pointer', () => {
  const grouped = { tools: ['timeframe'] as CardOptions['tools'], groupsAs: 'accordion' as const, groupBy: 'years' as const };

  it('a mouse gets the accordion when that is the choice', () => {
    pointer(false);
    mount(grouped);
    const panel = screen.getByTestId('tool-timeframe-panel');
    expect(panel).toHaveAttribute('data-groups-as', 'accordion');
    expect(within(panel).getByTestId('timeframe-accordion')).toBeInTheDocument();
    expect(within(panel).queryByTestId('timeframe-swipe')).toBeNull();
  });

  it('a finger always swipes, even when the board says accordion', () => {
    pointer(true);
    mount(grouped);
    const panel = screen.getByTestId('tool-timeframe-panel');
    expect(panel).toHaveAttribute('data-groups-as', 'swipe');
    expect(within(panel).getByTestId('timeframe-swipe')).toBeInTheDocument();
    expect(within(panel).queryByTestId('timeframe-accordion')).toBeNull();
  });

  it('swipe is the default for everyone', () => {
    pointer(false);
    mount({ tools: ['timeframe'], groupsAs: 'swipe' });
    expect(screen.getByTestId('timeframe-swipe')).toBeInTheDocument();
  });

  it('the accordion opens and closes by tap; grouping follows the choice', () => {
    pointer(false);
    const { onOptions } = mount(grouped);
    const first = screen.getByTestId('group-2026');
    const head = within(first).getAllByRole('button')[0]!;
    expect(head).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(head);
    expect(head).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(screen.getByTestId('group-by-months'));
    expect(onOptions).toHaveBeenCalledWith({ groupBy: 'months' });
  });
});
