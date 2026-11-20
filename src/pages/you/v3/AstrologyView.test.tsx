import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import AstrologyView, { certaintyWord, chartShows, storyParagraphs, systemRunning, withoutSpanIds } from './AstrologyView';
import { periodsOf } from './cardModel';
import { selfV3Fixture, selfV3OutlookCard, selfV3StoryCard } from './selfV3.fixture';

const TODAY = '2026-11-13';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(`${TODAY}T12:00:00`));
});
afterEach(() => vi.useRealTimers());

describe('Astrology Reading (plan revision 2 §6)', () => {
  it('shows the technical story as paragraphs with no headings, then the systems read, then the long reading', () => {
    render(<AstrologyView card={selfV3StoryCard()} />);
    const story = screen.getByTestId('astrology-story');
    expect(story.querySelectorAll('p')).toHaveLength(3);
    expect(story.querySelectorAll('h1, h2, h3, h4')).toHaveLength(0);
    expect(story.className).toMatch(/max-w-\[72ch\]/);
    expect(story).toHaveTextContent('Saturn runs the main period on the life-chapters clock');
    const systems = screen.getByTestId('astrology-systems');
    expect(systems).toHaveTextContent('AdAstra AI read');
    // the server shape: four systems, the label shown, the internal key never; what runs today with its end date
    const rows = within(systems).getAllByTestId('astrology-system');
    expect(rows).toHaveLength(4);
    expect(rows[0]).toHaveTextContent(/^Life chapters\s*· Saturn · until 27 Dec 2027$/);
    expect(rows[2]).toHaveTextContent(/^Birthday year\s*· Saturn$/);
    expect(rows[3]).toHaveTextContent(/^Short chapters$/);
    expect(systems).not.toHaveTextContent('vimshottari');
    expect(screen.queryByTestId('astrology-empty')).toBeNull();
    expect(screen.getByTestId('astrology-details')).toBeInTheDocument();
  });

  it('until the story is served it says so, and the long reading still shows under it', () => {
    const stuck = selfV3Fixture().cards.find((c) => c.id === 'stuck')!;
    render(<AstrologyView card={stuck} />);
    expect(screen.getByTestId('astrology-empty')).toHaveTextContent('The full astrology reading is being prepared for this card.');
    expect(screen.getByTestId('astrology-details')).toHaveTextContent("the chart's own reasons");
  });

  it('a card with neither shows only the waiting line; the Why switch off hides the long reading', () => {
    const mind = selfV3Fixture().cards.find((c) => c.id === 'mind')!;
    render(<AstrologyView card={{ ...mind, v2: null }} />);
    expect(screen.getByTestId('astrology-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('astrology-details')).toBeNull();
    const stuck = selfV3Fixture().cards.find((c) => c.id === 'stuck')!;
    render(<AstrologyView card={stuck} showDetails={false} />);
    expect(screen.queryByTestId('astrology-details')).toBeNull();
  });
});

describe('AdAstra AI read', () => {
  it('skips a system with no label and says "until" only with an end date', () => {
    expect(systemRunning({ running: { lord: 'Saturn', from: '2008-12-27', to: '2027-12-27' } })).toBe('Saturn · until 27 Dec 2027');
    expect(systemRunning({ running: { lord: 'Virgo', from: '2026-01-10', to: null } })).toBe('Virgo');
    expect(systemRunning({ running: null })).toBe('');
    const c = selfV3StoryCard();
    render(<AstrologyView card={{ ...c, v3: { ...c.v3!, systems: [{ system: 'x', label: '  ', running: null }] } }} />);
    expect(screen.queryByTestId('astrology-systems')).toBeNull();
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

  it('takes stored span ids out of served text', () => {
    expect(withoutSpanIds('Mixed periods (s1): the moon period lifts.')).toBe('Mixed periods: the moon period lifts.');
    expect(withoutSpanIds('In s2 the pace eases (span s3).')).toBe('In the pace eases.');
    expect(withoutSpanIds('Saturn crosses the ascendant.')).toBe('Saturn crosses the ascendant.');
    expect(withoutSpanIds(null)).toBe('');
    const card = selfV3OutlookCard();
    const withId = { ...card, v3: { ...card.v3!, chart: { ...card.v3!.chart!, spans: [{ span: 's2', shows: 'Mixed periods (s2): the moon lifts.' }] } } };
    expect(chartShows(withId, periodsOf(card, TODAY)[1]!)).toBe('Mixed periods: the moon lifts.');
  });

  it('splits a story on blank lines, joins wrapped lines, drops span ids', () => {
    expect(storyParagraphs('One line\nwrapped (s1).\n\n  Two.  \n\n\n')).toEqual(['One line wrapped.', 'Two.']);
    expect(storyParagraphs(null)).toEqual([]);
  });
});
