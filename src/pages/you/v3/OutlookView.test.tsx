import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import OutlookView, { barAt, stretchSpan, whyLine, type OutlookSection } from './OutlookView';
import { periodsOf, standingOf } from './cardModel';
import { selfV3Fixture, selfV3OutlookCard, selfV3StoryCard } from './selfV3.fixture';
import type { SelfV3CardView } from '../../../lib/selfV3Api';

const TODAY = '2026-11-13';

/** the card frame holds the picked section; this harness does the same */
function Harness(props: Parameters<typeof OutlookView>[0]) {
  const [section, setSection] = useState<OutlookSection>('overview');
  return <OutlookView {...props} section={section} onSection={setSection} />;
}

function mount(card: SelfV3CardView, pick = 0, extra: Partial<Parameters<typeof OutlookView>[0]> = {}) {
  const periods = periodsOf(card, TODAY);
  const onAstrology = vi.fn();
  render(
    <Harness card={card} period={periods[pick] ?? null} periods={periods} standing={standingOf(card)} options={{ plan: 'with' }} showWhy showDates onAstrology={onAstrology} {...extra} />,
  );
  return { onAstrology, periods };
}

const tool = (id: OutlookSection) => fireEvent.click(screen.getByTestId(`outlook-tool-${id}`));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(`${TODAY}T12:00:00`));
});
afterEach(() => vi.useRealTimers());

describe('Outlook, in the plan\'s order', () => {
  it('opens on Why we think so and What to do; the toolbar shows one section at a time', () => {
    mount(selfV3OutlookCard());
    const view = screen.getByTestId('outlook-view');
    const order = Array.from(view.querySelectorAll('[data-testid]'))
      .map((e) => e.getAttribute('data-testid'))
      .filter((t) => ['outlook-why', 'section-todo', 'outlook-text', 'section-pattern', 'key-dates', 'analysis-systems', 'analysis-ladder'].includes(t!));
    expect(order).toEqual(['outlook-why', 'section-todo', 'outlook-text', 'section-pattern']);
    expect(screen.getByTestId('todo-best')).toHaveTextContent('stop and write tomorrow');
    expect(screen.getByTestId('todo-avoid')).toHaveTextContent('working late');
    expect(screen.getByTestId('stretch-text')).toHaveTextContent('guard your evenings');
    tool('dates');
    expect(screen.getAllByTestId('key-date')).toHaveLength(2);
    expect(screen.queryByTestId('outlook-why')).toBeNull();
    tool('systems');
    expect(screen.getByTestId('analysis-agreement')).toHaveTextContent('4 of 5 agree');
    expect(screen.queryByTestId('key-dates')).toBeNull();
    tool('ladder');
    expect(screen.getByTestId('analysis-ladder')).toBeInTheDocument();
  });

  it('the toolbar: five short sections in order, each a named, pressed-state button; arrows move along it', () => {
    mount(selfV3StoryCard());
    const bar = screen.getByRole('toolbar', { name: 'Sections of this card' });
    const buttons = within(bar).getAllByRole('button');
    expect(buttons.map((b) => b.getAttribute('data-testid'))).toEqual([
      'outlook-tool-overview',
      'outlook-tool-dates',
      'outlook-tool-systems',
      'outlook-tool-ladder',
      'outlook-tool-chart',
    ]);
    expect(buttons[0]).toHaveAttribute('aria-label', 'Why we think so, What to do');
    expect(buttons[0]).toHaveAttribute('title', 'Why we think so, What to do');
    expect(buttons[0]).toHaveAttribute('aria-pressed', 'true');
    fireEvent.keyDown(bar, { key: 'ArrowRight' });
    expect(screen.getByTestId('outlook-tool-dates')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('outlook-tool-dates')).toHaveFocus();
    fireEvent.keyDown(bar, { key: 'ArrowLeft' });
    fireEvent.keyDown(bar, { key: 'ArrowLeft' });
    expect(screen.getByTestId('outlook-tool-chart')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('astrology-gift')).toBeInTheDocument();
  });

  it('the gift and the knot: with how sure and what the chart shows for the stretch, span ids taken out', () => {
    const card = selfV3OutlookCard();
    mount({ ...card, v3: { ...card.v3!, chart: { ...card.v3!.chart!, spans: card.v3!.chart!.spans.map((x) => ({ ...x, shows: `${x.shows.replace(':', ' (' + x.span + '):')}` })) } } }, 1);
    tool('chart');
    expect(screen.getByTestId('astrology-gift')).toHaveTextContent('sixth lord sits strong');
    expect(screen.getByTestId('astrology-knot')).toHaveTextContent('Saturn crosses the ascendant');
    expect(screen.getByTestId('astrology-certainty')).toHaveTextContent('Likely');
    expect(screen.getByTestId('astrology-shows')).toHaveTextContent('Mixed periods: the moon period lifts');
    expect(screen.getByTestId('outlook-view')).not.toHaveTextContent(/\(s\d\)/);
  });

  it('the plain story sits above the toolbar; the stretch\'s growth line is with What to do', () => {
    mount(selfV3StoryCard());
    const open = screen.getByTestId('outlook-plain-story');
    expect(open).toHaveTextContent('You are rebuilding, not running down.');
    expect(open.compareDocumentPosition(screen.getByTestId('outlook-tools')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByTestId('outlook-growth')).toHaveTextContent('It teaches you to keep a pace you can hold.');
  });

  it('the technical story and the long reading are not on Outlook (they are the Astrology tab and the "i" sheet)', () => {
    mount(selfV3StoryCard());
    expect(screen.queryByTestId('outlook-tool-full')).toBeNull();
    expect(screen.queryByTestId('astrology-details')).toBeNull();
    expect(screen.getByTestId('outlook-view')).not.toHaveTextContent('life-chapters clock');
  });

  it('shows the card\'s own Why sentence and a link to the astrology reading', () => {
    const { onAstrology } = mount(selfV3OutlookCard());
    expect(screen.getByTestId('outlook-why-line')).toHaveTextContent('You have run on short sleep since May');
    fireEvent.click(screen.getByTestId('outlook-see-astrology'));
    expect(onAstrology).toHaveBeenCalledTimes(1);
  });

  it('without a Why sentence, counts the timing systems for the stretch on screen', () => {
    mount(selfV3OutlookCard({ withWhy: false }));
    expect(screen.getByTestId('outlook-why-line')).toHaveTextContent('On 4 of 5 timing views, AdAstra AI reads this stretch as heavy');
  });

  it('a split stretch gets no tone word in its counted line', () => {
    mount(selfV3OutlookCard({ withWhy: false }), 1);
    expect(screen.getByTestId('outlook-why-line')).toHaveTextContent('On 2 of 5 timing views, AdAstra AI finds this stretch split');
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
    tool('dates');
    const bar = screen.getByTestId('outlook-stretch-bar');
    expect(bar).toHaveAttribute('data-from', '2026-11-09');
    expect(bar).toHaveAttribute('data-to', '2026-12-05');
    expect(within(bar).getByTestId('outlook-bar-from')).toHaveTextContent('9 Nov 2026');
    expect(within(bar).getByTestId('outlook-bar-to')).toHaveTextContent('5 Dec 2026');
    expect(within(bar).getByTestId('outlook-bar-today')).toBeInTheDocument();
  });

  it('a stretch ahead has no today mark', () => {
    mount(selfV3OutlookCard(), 2);
    tool('dates');
    expect(screen.queryByTestId('outlook-bar-today')).toBeNull();
  });

  it('the feature switches hide Why and Key dates', () => {
    mount(selfV3OutlookCard(), 0, { showWhy: false, showDates: false });
    expect(screen.queryByTestId('outlook-why')).toBeNull();
    expect(screen.queryByTestId('key-dates')).toBeNull();
  });

  it('a card with nothing to say says so', () => {
    const body = selfV3Fixture().cards.find((c) => c.id === 'body')!;
    const card: SelfV3CardView = { ...body, rail: [], keyDates: [], v2: null, v3: { ...body.v3!, spans: [], ladder: null, pattern: null, agreement: null, why: null, chart: null } };
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
