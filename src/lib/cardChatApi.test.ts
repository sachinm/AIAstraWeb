import { describe, expect, it } from 'vitest';
import { cardAskFields, costLineFor, newTurnId, normaliseOpen, problemOf, toWireCard } from './cardChatApi';

describe('card chat shapes', () => {
  it('the ask-stream fields carry the card and the turnId; a card with no period sends no dates', () => {
    expect(cardAskFields({ board: 'love', cardId: 'dating_pulse', from: '2026-11-01', to: '2027-01-31' }, 'u-1')).toEqual({
      card: { board: 'love', cardId: 'dating_pulse', from: '2026-11-01', to: '2027-01-31' },
      turnId: 'u-1',
    });
    expect(toWireCard({ board: 'work', cardId: 'job_pulse', from: null, to: null })).toEqual({ board: 'work', cardId: 'job_pulse' });
  });

  it('a turnId is a v4 uuid, new each time', () => {
    const a = newTurnId();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(newTurnId()).not.toBe(a);
  });

  it('reads the plan shape (preamble object, cost) and the brief shape (string preamble, costLine)', () => {
    const plan = normaliseOpen({
      card: { board: 'self', id: 'body', title: 'Body & energy' },
      period: { from: '2026-11-01', to: '2027-06-03', label: 'Heavy stretch' },
      preamble: { headline: 'H', lines: ['a', '', 3, 'b'] },
      cost: { uses: 1, remaining: 1 },
      thread: { chatId: 'c', messages: [{ question: 'q', answer: 'a', at: 'x', periodLabel: 'p' }, { question: '', answer: '' }] },
    });
    expect(plan).toEqual({
      title: 'Body & energy',
      periodLabel: 'Heavy stretch',
      preamble: { headline: 'H', lines: ['a', 'b'], keyDates: [], confirm: null },
      costLine: 'Uses 1 of your 1 question',
      chatId: 'c',
      thread: [{ question: 'q', answer: 'a', periodLabel: 'p' }],
    });
    const brief = normaliseOpen({ preamble: 'First\n\nSecond', period: null, costLine: 'Uses 1 of your 4 questions', thread: null });
    expect(brief.preamble).toEqual({ headline: 'First', lines: ['Second'], keyDates: [], confirm: null });
    expect(brief.costLine).toBe('Uses 1 of your 4 questions');
    expect(brief.chatId).toBeNull();
    expect(normaliseOpen({ cost: { uses: 1, remaining: null } }).costLine).toBeNull();
    expect(costLineFor(1, 9)).toBe('Uses 1 of your 9 questions');
  });

  it('reads the server f09ad68 open: cost.line, key dates and the confirm claim', () => {
    const o = normaliseOpen({
      card: { board: 'love', id: 'dating_pulse', title: 'Where Dating Stands', subtitle: 'Now' },
      period: null,
      preamble: { headline: 'H', lines: [], keyDates: [{ date: '2027-03-01', label: 'A turn' }, { date: 'soon', label: 'x' }, { date: '2027-04-01' }], confirm: 'You met someone this autumn.' },
      cost: { uses: 1, remaining: 4, limit: 10, line: 'Uses 1 of your 4 questions this month' },
      thread: { chatId: null, messages: [] },
    });
    expect(o.preamble.keyDates).toEqual([{ date: '2027-03-01', label: 'A turn' }]);
    expect(o.preamble.confirm).toBe('You met someone this autumn.');
    expect(o.costLine).toBe('Uses 1 of your 4 questions this month');
    // a null line is the server hiding it (Unlimited or exempt)
    expect(normaliseOpen({ cost: { uses: 1, remaining: 4, limit: null, line: null } }).costLine).toBeNull();
  });

  it('maps on the server\'s error string first, the status only when there is none', () => {
    expect(problemOf(400, 'unknown_card')).toBe('off');
    expect(problemOf(404, 'card_not_on_board')).toBe('off');
    expect(problemOf(404, 'board_off')).toBe('off');
    expect(problemOf(400, 'bad_period')).toBe('period');
    expect(problemOf(409, 'card_not_ready')).toBe('not_ready');
    expect(problemOf(503, 'timeout')).toBe('timeout');
    expect(problemOf(409, 'turn_in_flight')).toBe('busy');
    expect(problemOf(429, 'rate_limited')).toBe('rate_limited');
    expect(problemOf(402, 'quota_exhausted')).toBe('quota');
    expect(problemOf(0, 'spend_cap')).toBe('spend_cap');
    for (const c of ['bad_card', 'bad_turn_id', 'card_with_focus']) expect(problemOf(400, c)).toBe('failed');
    expect(problemOf(404, 'no_kundli')).toBe('no_kundli');
    expect(problemOf(402)).toBe('quota');
    expect(problemOf(429)).toBe('rate_limited');
    expect(problemOf(500, 'boom')).toBe('failed');
  });
});
