import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import SeasonsCard from './SeasonsCard';
import CompactCard from './CompactCard';
import { cardNow } from './boardOptions';
import { selfV3Fixture, selfV3OutlookCard } from './selfV3.fixture';
import { clearSelfV3Cached } from '../../../lib/selfV3Cache';
import type { SelfV3CardView } from '../../../lib/selfV3Api';
import type { CardChatFace, CardProps } from './CardFrame';

const fx = selfV3Fixture();

function mount(card: SelfV3CardView = selfV3OutlookCard(), extra: Partial<CardProps> = {}) {
  const onWhy = vi.fn();
  const r = render(<SeasonsCard shape="board" card={card} options={cardNow(fx.layout, card.id)} onOptions={() => {}} onWhy={onWhy} {...extra} />);
  return { onWhy, ...r };
}

/** a chat face like the board's: the thin input at the card's foot */
function chatFace(open = false): CardChatFace {
  return {
    open,
    onOpen: () => {},
    onClose: () => {},
    render: (_c, _p, opts) => (
      <div data-testid="card-chat" data-conversation={opts.conversation ? 'true' : 'false'}>
        <textarea data-testid="card-chat-textarea" />
      </div>
    ),
  };
}

beforeEach(() => {
  clearSelfV3Cached();
  sessionStorage.clear();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-13T12:00:00'));
});
afterEach(() => vi.useRealTimers());

describe('the board card (tablet and desktop, server docs/dashboards/13)', () => {
  it('has three tabs, Outlook · Astrology Reading · Calendar, and opens on Outlook', () => {
    mount();
    const tabs = within(screen.getByRole('tablist', { name: 'Card views' })).getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['Outlook', 'Astrology Reading', 'Calendar']);
    const card = screen.getByTestId('v3-card-body');
    expect(card).toHaveAttribute('data-shape', 'board');
    expect(card).toHaveAttribute('data-face', 'outlook');
    expect(screen.getByTestId('outlook-view')).toBeInTheDocument();
    expect(screen.getByTestId('card-line')).toHaveTextContent('Rest stays thin until 5 December');
  });

  it('arrow keys move between the three tabs', () => {
    mount();
    fireEvent.keyDown(screen.getByTestId('card-bars'), { key: 'ArrowRight' });
    expect(screen.getByTestId('v3-card-body')).toHaveAttribute('data-face', 'astrology');
    fireEvent.keyDown(screen.getByTestId('card-bars'), { key: 'ArrowLeft' });
    fireEvent.keyDown(screen.getByTestId('card-bars'), { key: 'ArrowLeft' });
    expect(screen.getByTestId('v3-card-body')).toHaveAttribute('data-face', 'calendar');
  });

  it('has no "i" button; the chat bubble stays', () => {
    mount(selfV3OutlookCard(), { chat: () => <button data-testid="card-chat-bubble">ask</button> });
    expect(screen.queryByTestId('card-why')).toBeNull();
    expect(screen.getByTestId('card-chat-bubble')).toBeInTheDocument();
  });

  it('drops the 72-character cap', () => {
    mount();
    const column = screen.getByTestId('card-body').querySelector('.self-v3-column')!;
    expect(column.className).not.toMatch(/max-w-\[72ch\]/);
  });

  it('"See the astrology reading" switches to the Astrology Reading tab, which follows the picked stretch', () => {
    mount();
    fireEvent.click(screen.getByTestId('period-2'));
    fireEvent.click(screen.getByTestId('outlook-see-astrology'));
    expect(screen.getByTestId('v3-card-body')).toHaveAttribute('data-face', 'astrology');
    expect(screen.getByTestId('astrology-shows')).toHaveTextContent('Jupiter aspects the sixth house');
    // the stretch picker stays over the Astrology tab
    expect(screen.getByTestId('period-0')).toBeInTheDocument();
  });

  it('the Calendar tab is the range calendar', () => {
    mount();
    fireEvent.click(screen.getByTestId('card-view-calendar'));
    expect(screen.getByTestId('v3-card-body')).toHaveAttribute('data-face', 'calendar');
    expect(screen.queryByTestId('calendar-view')).toBeNull();
  });

  it('uses the counted Why line when the card has no Why sentence', () => {
    mount(selfV3OutlookCard({ withWhy: false }));
    expect(screen.getByTestId('outlook-why-line')).toHaveTextContent('4 of 5 timing systems read this stretch as heavy');
  });

  it('renders when the server sends neither `chart` nor `why`', () => {
    const body = fx.cards.find((c) => c.id === 'body')!;
    mount(body);
    expect(screen.getByTestId('outlook-view')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('card-view-astrology'));
    expect(screen.getByTestId('astrology-view')).toBeInTheDocument();
    expect(screen.queryByTestId('astrology-gift')).toBeNull();
  });

  it('a v2-filled card shows its chart details on the Astrology tab', () => {
    mount(fx.cards.find((c) => c.id === 'stuck')!);
    fireEvent.click(screen.getByTestId('card-view-astrology'));
    expect(screen.getByTestId('astrology-details')).toHaveTextContent("the chart's own reasons");
  });
});

describe('the pinned "Is this right?"', () => {
  it('sits outside the scroll, between the view and the chat input', () => {
    mount(selfV3OutlookCard(), { chatFace: chatFace() });
    const footer = screen.getByTestId('card-footer');
    expect(footer).toHaveAttribute('data-pinned', 'true');
    expect(within(screen.getByTestId('card-body')).queryByTestId('card-footer')).toBeNull();
    const stage = screen.getByTestId('card-stage');
    const kids = Array.from(stage.children);
    expect(kids.indexOf(footer)).toBe(kids.indexOf(screen.getByTestId('card-body')) + 1);
    expect(stage.lastElementChild).toBe(screen.getByTestId('card-chat'));
    expect(screen.getByTestId('card-body').className).toMatch(/self-v3-scroll-pinned/);
  });

  it('shows on Outlook only', () => {
    mount();
    expect(screen.getByTestId('confirm-yes')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('card-view-astrology'));
    expect(screen.queryByTestId('card-footer')).toBeNull();
    fireEvent.click(screen.getByTestId('card-view-calendar'));
    expect(screen.queryByTestId('card-footer')).toBeNull();
    fireEvent.click(screen.getByTestId('card-view-outlook'));
    expect(screen.getByTestId('card-footer')).toBeInTheDocument();
  });

  it('is hidden while a conversation is open, and the chat input keeps its node', () => {
    const r = mount(selfV3OutlookCard(), { chatFace: chatFace(false) });
    const box = screen.getByTestId('card-chat-textarea');
    r.rerender(<SeasonsCard shape="board" card={selfV3OutlookCard()} options={cardNow(fx.layout, 'body')} onOptions={() => {}} chatFace={chatFace(true)} />);
    expect(screen.queryByTestId('card-footer')).toBeNull();
    expect(screen.getByTestId('card-chat-textarea')).toBe(box);
  });

  it('follows the gear and the feature switch', () => {
    mount(selfV3OutlookCard(), { confirmOn: false });
    expect(screen.queryByTestId('card-footer')).toBeNull();
  });

  it('is off when the feature is off', () => {
    mount(selfV3OutlookCard(), { allowed: { short: true, periods: true, keyDates: true, why: true, confirm: false } });
    expect(screen.queryByTestId('card-footer')).toBeNull();
  });
});

describe('the phone card is unchanged by default', () => {
  it('Read · Analysis · Calendar with the "i" button and no board shape', () => {
    render(<CompactCard card={fx.cards.find((c) => c.id === 'body')!} options={cardNow(fx.layout, 'body')} onOptions={() => {}} onWhy={() => {}} />);
    const tabs = within(screen.getByRole('tablist', { name: 'Card views' })).getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['Read', 'Analysis', 'Calendar']);
    expect(screen.getByTestId('card-why')).toBeInTheDocument();
    expect(screen.getByTestId('v3-card-body')).not.toHaveAttribute('data-shape');
    expect(within(screen.getByTestId('card-body')).getByTestId('card-footer')).toBeInTheDocument();
  });
});
