/**
 * Card options on the page (server docs/reading-engine/71 §4.3) and how Love and Work apply the chosen cards (§4.6).
 */
import { describe, expect, it } from 'vitest';
import { allowedSubareas, optionsForSubarea, VIEW_TIMEFRAME, type AreaCardsLayout, type AreaCatalogue } from './boardCardsApi';
import { DEFAULT_CARD_OPTIONS, changedOnly, optionsFor, sectionsFor, withCardOption } from './cardOptions';

describe('card options', () => {
  it('sections mirror the server rule', () => {
    expect(sectionsFor(undefined)).toEqual(['line', 'year', 'stretch', 'confirm']);
    expect(sectionsFor({ length: 'glance' })).toEqual(['line', 'year']);
    expect(sectionsFor({ length: 'deep' })).toEqual(['line', 'year', 'stretch', 'confirm', 'pattern', 'ladder']);
    expect(sectionsFor({ length: 'deep', plan: 'without', words: 'terms' })).toEqual(['line', 'year', 'stretch', 'confirm', 'pattern', 'details']);
  });
  it('only changed keys are kept, and a card back on defaults leaves the map', () => {
    expect(changedOnly({ ...DEFAULT_CARD_OPTIONS, view: 'now' })).toEqual({ view: 'now' });
    const one = withCardOption({}, 'body', 'length', 'deep');
    expect(one).toEqual({ body: { length: 'deep' } });
    expect(withCardOption(one, 'body', 'length', 'usual')).toEqual({});
  });
  it('options follow the cards on the board', () => {
    expect(optionsFor({ a: { view: 'now' }, b: { plan: 'without' } }, ['b'])).toEqual({ b: { plan: 'without' } });
  });
});

const CAT: AreaCatalogue = {
  groups: [{ id: 'bond', title: 'You two' }],
  cards: [
    { id: 'love_where', group: 'bond', title: 'Where love stands', description: '', suggested: true, available: true, unavailableReason: null, subareas: ['*'] },
    { id: 'love_meet', group: 'meeting', title: 'Meeting someone', description: '', suggested: true, available: true, unavailableReason: null, subareas: ['meet'] },
    { id: 'love_between', group: 'bond', title: 'Between you', description: '', suggested: true, available: true, unavailableReason: null, subareas: ['health', 'romance'] },
  ],
};
const layout = (cards: string[], options: AreaCardsLayout['options'] = {}): AreaCardsLayout => ({ board: 'love', cards, options, effective: {}, chosen: cards.length > 0, updatedAt: null });

describe('Love and Work: the chosen cards over today\'s board', () => {
  it('nothing chosen, or a card that covers everything: every sub-area', () => {
    expect(allowedSubareas(null, CAT)).toBeNull();
    expect(allowedSubareas(layout(['love_where', 'love_meet']), CAT)).toBeNull();
  });
  it('specific cards: only their sub-areas', () => {
    expect([...allowedSubareas(layout(['love_meet', 'love_between']), CAT)!].sort()).toEqual(['health', 'meet', 'romance']);
  });
  it("a finding takes its card's options, else the covering card's", () => {
    const l = layout(['love_where', 'love_meet'], { love_meet: { length: 'glance' }, love_where: { words: 'terms' } });
    expect(optionsForSubarea('meet', l, CAT)).toMatchObject({ length: 'glance', words: 'plain' });
    expect(optionsForSubarea('friends', l, CAT)).toMatchObject({ words: 'terms' });
    expect(optionsForSubarea('meet', null, CAT)).toBeNull();
  });
  it('a View is a time filter', () => {
    expect(VIEW_TIMEFRAME).toEqual({ now: 'active_now', year: 'next_12m', arc: 'next_3y' });
  });
});
