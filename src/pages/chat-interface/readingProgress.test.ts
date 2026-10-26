import { describe, expect, it } from 'vitest';
import { applyReadingEvent, emptyProgress, MAX_THINKING_CHARS, visibleChips, type ReadingProgress } from './readingProgress';

describe('applyReadingEvent', () => {
  it('captures the understanding line and subjects from the intent event', () => {
    const p = applyReadingEvent(undefined, {
      type: 'intent',
      intent: { text: 'You are asking about career and work over the next year.', subjects: [{ label: 'career and work' }], horizonLabel: 'the next year' },
    });
    expect(p.understood).toMatch(/career and work/);
    expect(p.subjects).toEqual(['career and work']);
    expect(p.horizonLabel).toBe('the next year');
  });

  it('adds a pill on start and flips it on done with the elapsed time', () => {
    let p: ReadingProgress = emptyProgress();
    p = applyReadingEvent(p, { type: 'stage', name: 'transit', status: 'start' });
    expect(p.stages).toHaveLength(1);
    expect(p.stages[0]).toMatchObject({ label: 'Transits', status: 'start' });
    p = applyReadingEvent(p, { type: 'stage', name: 'transit', status: 'done', ms: 4200 });
    expect(p.stages).toHaveLength(1);
    expect(p.stages[0]).toMatchObject({ status: 'done', ms: 4200 });
  });

  it('does not mutate the previous state', () => {
    const a = emptyProgress();
    const b = applyReadingEvent(a, { type: 'stage', name: 'dasha', status: 'start' });
    expect(a.stages).toHaveLength(0);
    expect(b.stages).toHaveLength(1);
  });

  it('keeps per-subject analyst stages apart but shows one pill per analyst', () => {
    let p: ReadingProgress | undefined;
    p = applyReadingEvent(p, { type: 'stage', name: 'promise', status: 'start', subject: 'career_work' });
    p = applyReadingEvent(p, { type: 'stage', name: 'promise', status: 'start', subject: 'income_wealth' });
    p = applyReadingEvent(p, { type: 'stage', name: 'promise', status: 'done', subject: 'career_work', ms: 3000 });
    expect(p.stages).toHaveLength(2);
    const chips = visibleChips(p);
    expect(chips).toHaveLength(1);
    expect(chips[0]!.status).toBe('start');
    p = applyReadingEvent(p, { type: 'stage', name: 'promise', status: 'done', subject: 'income_wealth', ms: 3500 });
    expect(visibleChips(p)[0]!.status).toBe('done');
  });

  it('a failed analyst shows as failed even if another subject succeeded', () => {
    let p: ReadingProgress | undefined;
    p = applyReadingEvent(p, { type: 'stage', name: 'transit', status: 'done', subject: 'a' });
    p = applyReadingEvent(p, { type: 'stage', name: 'transit', status: 'failed', subject: 'b' });
    expect(visibleChips(p)[0]!.status).toBe('failed');
  });

  it('hides the instant understanding stage from the pills', () => {
    let p: ReadingProgress | undefined;
    p = applyReadingEvent(p, { type: 'stage', name: 'intake', status: 'done', ms: 1 });
    p = applyReadingEvent(p, { type: 'stage', name: 'prepare', status: 'done', ms: 12 });
    expect(visibleChips(p).map((c) => c.name)).toEqual(['prepare']);
  });

  it('ignores unknown events and records the number of windows', () => {
    const p = applyReadingEvent(undefined, { type: 'windows', windows: [{}, {}, {}] });
    expect(p.windowsCount).toBe(3);
    expect(applyReadingEvent(p, { type: 'info', reason: 'dossier_missing' })).toEqual(p);
  });
});

describe('thought events', () => {
  it('accumulates thought text in order without touching stages or the understanding line', () => {
    let p: ReadingProgress = emptyProgress();
    p = applyReadingEvent(p, { type: 'intent', intent: { text: 'About your career.' } });
    p = applyReadingEvent(p, { type: 'thought', delta: '**Checking** the 10th lord. ' });
    p = applyReadingEvent(p, { type: 'thought', delta: 'Weighing the dasha.' });
    expect(p.thinking).toBe('**Checking** the 10th lord. Weighing the dasha.');
    expect(p.understood).toBe('About your career.');
    expect(p.stages).toEqual([]);
  });

  it('ignores empty or non-string deltas', () => {
    let p: ReadingProgress = emptyProgress();
    p = applyReadingEvent(p, { type: 'thought', delta: '' });
    p = applyReadingEvent(p, { type: 'thought', delta: 42 as unknown as string });
    expect(p.thinking).toBeUndefined();
  });

  it('keeps at most MAX_THINKING_CHARS', () => {
    let p: ReadingProgress = emptyProgress();
    p = applyReadingEvent(p, { type: 'thought', delta: 'a'.repeat(MAX_THINKING_CHARS - 10) });
    p = applyReadingEvent(p, { type: 'thought', delta: 'b'.repeat(500) });
    expect(p.thinking!.length).toBe(MAX_THINKING_CHARS);
  });
});
