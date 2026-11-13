/**
 * Card options on the page (server docs/reading-engine/71 §4.3) and how Love and Work apply the chosen cards (§4.6).
 */
import { describe, expect, it } from 'vitest';
import { allowedSubareas, optionsForSubarea, VIEW_TIMEFRAME, type AreaCardsLayout, type AreaCatalogue } from './boardCardsApi';
import {
  COLD_BOARD_DEFAULTS,
  DEFAULT_CARD_OPTIONS,
  applyToAllCards,
  changedOnly,
  diffFromDefaults,
  effectiveCardOptions,
  effectiveOptions,
  optionsFor,
  sectionsFor,
  withCardOption,
  type BoardOptions,
} from './cardOptions';

describe('face, tools and board options', () => {
  it('the cold defaults are the server defaults', () => {
    expect(COLD_BOARD_DEFAULTS).toEqual({
      length: 'usual',
      view: 'year',
      words: 'plain',
      plan: 'with',
      face: 'read',
      tools: [],
      groupBy: 'quarters',
      groupsAs: 'swipe',
      start: 'short',
      confirm: true,
      motion: true,
    });
  });
  it('effective options: the card wins, then the board, then the defaults', () => {
    const defaults: BoardOptions = { ...COLD_BOARD_DEFAULTS, groupBy: 'months' };
    expect(effectiveCardOptions(undefined, undefined, defaults)).toEqual({ ...DEFAULT_CARD_OPTIONS, groupBy: 'months', tools: [] });
    const board = { face: 'light', groupBy: 'years', tools: ['table'] } as const;
    const out = effectiveCardOptions({ face: 'research', tools: [] }, { ...board, tools: ['table'] }, defaults);
    expect(out.face).toBe('research');
    expect(out.groupBy).toBe('years');
    expect(out.tools).toEqual([]);
    expect(effectiveCardOptions({ view: 'now' }, { ...board, tools: ['table'] }, defaults).tools).toEqual(['table']);
    expect(Object.keys(effectiveCardOptions(undefined, { confirm: false, motion: false }, defaults))).not.toContain('motion');
  });
  it('effective options never share the defaults\' tools array', () => {
    const out = effectiveCardOptions(undefined, undefined, COLD_BOARD_DEFAULTS);
    out.tools.push('plan');
    expect(COLD_BOARD_DEFAULTS.tools).toEqual([]);
    const legacy = effectiveOptions(undefined);
    legacy.tools.push('plan');
    expect(DEFAULT_CARD_OPTIONS.tools).toEqual([]);
  });
  it('diffFromDefaults keeps only the differing keys; tools compare as ordered lists', () => {
    const base = effectiveCardOptions(undefined, { tools: ['table', 'plan'] }, COLD_BOARD_DEFAULTS);
    expect(diffFromDefaults({}, base)).toEqual({});
    expect(diffFromDefaults({ tools: ['table', 'plan'], face: 'read' }, base)).toEqual({});
    expect(diffFromDefaults({ tools: ['plan', 'table'] }, base)).toEqual({ tools: ['plan', 'table'] });
    expect(diffFromDefaults({ tools: ['table'] }, base)).toEqual({ tools: ['table'] });
    expect(diffFromDefaults({ tools: [], face: 'light', start: 'short' }, COLD_BOARD_DEFAULTS)).toEqual({ face: 'light' });
  });
  it('changedOnly and withCardOption keep face, tools and grouping while a legacy key changes', () => {
    const next = withCardOption({ body: { face: 'light', tools: ['dates'], groupBy: 'weeks' } }, 'body', 'length', 'deep');
    expect(next).toEqual({ body: { face: 'light', tools: ['dates'], groupBy: 'weeks', length: 'deep' } });
    expect(changedOnly({ ...DEFAULT_CARD_OPTIONS, tools: ['info'] })).toEqual({ tools: ['info'] });
  });
  it('Apply to all cards drops every per-card choice', () => {
    expect(applyToAllCards({ a: { face: 'light' }, b: { view: 'now' } })).toEqual({});
  });
});

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
