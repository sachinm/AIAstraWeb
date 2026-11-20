import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import SeasonsCard from './SeasonsCard';
import CompactCard from './CompactCard';
import { cardNow } from './boardOptions';
import { GROWTH_LINE, PLAIN_STORY, STORY_TEXT, selfV3Fixture, selfV3OutlookCard, selfV3StoryCard } from './selfV3.fixture';
import type { OutlookSection } from './OutlookView';
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

  it('carries the "i" button beside the chat bubble; it opens the full reading', () => {
    const r = mount(selfV3OutlookCard(), { chat: () => <button data-testid="card-chat-bubble">ask</button> });
    expect(screen.getByTestId('card-chat-bubble')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('card-why'));
    expect(r.onWhy).toHaveBeenCalledTimes(1);
  });

  it('drops the 72-character cap', () => {
    mount();
    const column = screen.getByTestId('card-body').querySelector('.self-v3-column')!;
    expect(column.className).not.toMatch(/max-w-\[72ch\]/);
  });

  it('"See the astrology reading" switches to the Astrology Reading tab: its story, or the waiting line', () => {
    mount(selfV3StoryCard());
    fireEvent.click(screen.getByTestId('outlook-see-astrology'));
    expect(screen.getByTestId('v3-card-body')).toHaveAttribute('data-face', 'astrology');
    expect(screen.getByTestId('astrology-story')).toHaveTextContent('Saturn runs the main period');
    // the stretch picker stays over the Astrology tab
    expect(screen.getByTestId('period-0')).toBeInTheDocument();
    cleanup();
    mount();
    fireEvent.click(screen.getByTestId('card-view-astrology'));
    expect(screen.getByTestId('astrology-empty')).toHaveTextContent('The full astrology reading is being prepared for this card.');
    expect(screen.queryByTestId('astrology-shows')).toBeNull();
  });

  it('Outlook keeps its picked section per card across a tab switch; the chart section follows the picked stretch', () => {
    mount();
    fireEvent.click(screen.getByTestId('outlook-tool-chart'));
    fireEvent.click(screen.getByTestId('period-2'));
    expect(screen.getByTestId('astrology-shows')).toHaveTextContent('Jupiter aspects the sixth house');
    fireEvent.click(screen.getByTestId('card-view-calendar'));
    fireEvent.click(screen.getByTestId('card-view-outlook'));
    expect(screen.getByTestId('outlook-view')).toHaveAttribute('data-section', 'chart');
  });

  it('the Calendar tab is the range calendar', () => {
    mount();
    fireEvent.click(screen.getByTestId('card-view-calendar'));
    expect(screen.getByTestId('v3-card-body')).toHaveAttribute('data-face', 'calendar');
    expect(screen.queryByTestId('calendar-view')).toBeNull();
  });

  it('uses the counted Why line when the card has no Why sentence', () => {
    mount(selfV3OutlookCard({ withWhy: false }));
    expect(screen.getByTestId('outlook-why-line')).toHaveTextContent('On 4 of 5 timing views, AdAstra AI reads this stretch as heavy');
  });

  it('renders when the server sends neither `chart` nor `why`', () => {
    const body = fx.cards.find((c) => c.id === 'body')!;
    mount(body);
    expect(screen.getByTestId('outlook-view')).toBeInTheDocument();
    expect(screen.queryByTestId('outlook-tool-chart')).toBeNull();
    fireEvent.click(screen.getByTestId('card-view-astrology'));
    expect(screen.getByTestId('astrology-empty')).toBeInTheDocument();
  });

  /**
   * servedFieldsRendered: no served reading field is ever hidden on the board card. Every text of a card carrying all of
   * them is findable in some tab or Outlook section, clicking through the tabs and the toolbar.
   */
  it('servedFieldsRendered: every served reading field is findable in some tab or section', () => {
    const card = selfV3StoryCard();
    mount(card);
    const seen: string[] = [];
    const grab = () => seen.push(screen.getByTestId('v3-card-body').textContent ?? '');
    for (let p = 0; screen.queryByTestId(`period-${p}`); p++) {
      fireEvent.click(screen.getByTestId(`period-${p}`));
      fireEvent.click(screen.getByTestId('card-view-outlook'));
      grab();
      for (const id of ['overview', 'dates', 'systems', 'ladder', 'chart'] as OutlookSection[]) {
        const btn = screen.queryByTestId(`outlook-tool-${id}`);
        if (btn) {
          fireEvent.click(btn);
          grab();
        }
      }
      fireEvent.click(screen.getByTestId('card-view-astrology'));
      grab();
    }
    const all = seen.join('\n').replace(/\s+/g, ' ');
    const v3 = card.v3!;
    const details = card.v2?.details;
    const texts: Array<[string, string | null | undefined]> = [
      ['story', STORY_TEXT.split('\n\n')[1]],
      ['plain.story', PLAIN_STORY],
      ['growth', GROWTH_LINE],
      ['why', v3.why],
      ['gift', v3.chart?.gift],
      ['knot', v3.chart?.knot],
      ...v3.chart!.spans.map((x, i) => [`chart line ${i}`, x.shows] as [string, string]),
      ['ladder best', v3.ladder?.best],
      ['ladder floor', v3.ladder?.floor],
      ...(card.keyDates ?? []).map((k) => [`key date ${k.date}`, k.label] as [string, string]),
      ...(v3.systems ?? []).map((x) => [`system ${x.name}`, x.name] as [string, string]),
      ...v3.spans.flatMap((x) => (x.clocks ?? []).map((c) => [`clock ${c.label}`, c.label] as [string, string])),
      ['v2 details headline', details?.headline],
      ...(details?.paragraphs ?? []).map((t, i) => [`v2 details ${i}`, t] as [string, string]),
    ];
    const missing = texts.filter(([, t]) => !!t?.trim() && !all.includes(t.replace(/\s+/g, ' ').trim())).map(([k]) => k);
    expect(missing).toEqual([]);
    expect(texts.length).toBeGreaterThan(12);
  });

  it('a v2-filled card shows its long reading on the Astrology tab, under the waiting line', () => {
    mount(fx.cards.find((c) => c.id === 'stuck')!);
    fireEvent.click(screen.getByTestId('card-view-astrology'));
    expect(screen.getByTestId('astrology-empty')).toBeInTheDocument();
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
