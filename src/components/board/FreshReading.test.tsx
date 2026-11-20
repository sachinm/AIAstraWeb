import { describe, expect, it } from 'vitest';
import { freshnessState } from './FreshReading';
import { clockCounts, costLine } from './ClockSheet';
import { V2_WORDS } from './words';
import type { PlanStatus } from '../../lib/billing';

const good = { madeAt: '2026-11-18T08:00:00Z', validUntil: '2026-12-05', due: false };

describe('freshnessState: one state from the served fields', () => {
  it('picks what is happening now first, then the last answer, then the dates', () => {
    expect(freshnessState({ refresh: good, building: true, buildFailed: true })).toBe('building');
    expect(freshnessState({ refresh: good, building: false, noQuestions: true })).toBe('no_questions');
    expect(freshnessState({ refresh: good, building: false, buildFailed: true })).toBe('given_back');
    expect(freshnessState({ refresh: good, building: false, catchingUp: true })).toBe('catching_up');
    expect(freshnessState({ refresh: { ...good, due: true }, building: false })).toBe('due');
    expect(freshnessState({ refresh: good, building: false })).toBe('good');
    expect(freshnessState({ refresh: { ...good, validUntil: null }, building: false })).toBe('made');
    expect(freshnessState({ refresh: { madeAt: null, validUntil: null, due: false }, building: false })).toBe('none');
    expect(freshnessState({ refresh: undefined, building: false })).toBe('none');
  });

  it('a lens never read offers its first reading; one already read does not', () => {
    expect(freshnessState({ refresh: { madeAt: null, validUntil: null, due: false }, building: false, firstRead: true })).toBe('first');
    expect(freshnessState({ refresh: good, building: false, firstRead: true })).toBe('good');
  });

  it('the not-due words never put a start date after the made date', () => {
    expect(V2_WORDS.fresh.goodUntil('2026-12-05')).toBe('Good until 5 Dec 2026');
    expect(V2_WORDS.fresh.madeOn(good.madeAt)).toBe('Made 18 Nov 2026');
    expect(V2_WORDS.fresh.nextFrom('2026-12-05')).toBe('A fresh reading can be asked for from 6 Dec 2026');
  });
});

describe('the clock switch cost', () => {
  const plan = (over: Partial<PlanStatus>): PlanStatus =>
    ({ code: 'free', desired_plan: null, desired_interval: null, is_paid: false, interval: null, used: 3, limit: 20, remaining: 17, window: 'month', resets_at: null, exempt: false, ...over }) as PlanStatus;

  it('never says free when the plan is not known, and says how many are left', () => {
    expect(costLine(null)).toBe('Uses 1 question.');
    expect(costLine(plan({}))).toBe('Uses 1 of your 20 questions this month (17 left)');
    expect(costLine(plan({ exempt: true, limit: null, remaining: null }))).toBe('Included in your plan; no question is counted.');
  });

  it('the confirm button names the question only when one is counted', () => {
    expect(V2_WORDS.rebuildOn('Yogini', clockCounts(plan({})))).toBe('Rebuild on Yogini · 1 question');
    expect(V2_WORDS.rebuildOn('Yogini', clockCounts(null))).toBe('Rebuild on Yogini · 1 question');
    expect(V2_WORDS.rebuildOn('Yogini', clockCounts(plan({ exempt: true, limit: null })))).toBe('Rebuild on Yogini');
  });
});
