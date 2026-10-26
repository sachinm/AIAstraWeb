import { describe, expect, it } from 'vitest';
import { applyReadingEvent, emptyProgress, formatSeconds, MAX_THINKING_CHARS, nextPartsOf, panelStages, stageCounts, stageReason, visibleChips, type ReadingProgress } from './readingProgress';

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

describe('next parts', () => {
  it('keeps the parts still to come, in order, from a next event', () => {
    const p = applyReadingEvent(emptyProgress(), {
      type: 'next',
      parts: [
        { id: 'income_wealth', label: 'Money and finances' },
        { id: 'career_work', label: 'Career and work' },
      ],
    });
    expect(p.next).toEqual([
      { id: 'income_wealth', label: 'Money and finances' },
      { id: 'career_work', label: 'Career and work' },
    ]);
  });

  it('drops malformed parts and ignores an empty list', () => {
    expect(nextPartsOf({ parts: [{ id: 'x', label: 'X' }, { id: 3 }, null, 'y'] })).toEqual([{ id: 'x', label: 'X' }]);
    expect(nextPartsOf({ parts: 'nope' })).toEqual([]);
    expect(applyReadingEvent(emptyProgress(), { type: 'next', parts: [] }).next).toBeUndefined();
  });
});

describe('stage states for the progress panel', () => {
  it('keeps the server skipped status instead of showing it as still running', () => {
    const p = applyReadingEvent(undefined, { type: 'stage', name: 'nakshatra', status: 'skipped', ms: 18000 }, 50_000);
    expect(p.stages[0]).toMatchObject({ status: 'skipped', ms: 18000, startedAt: 32_000, endedAt: 50_000 });
    expect(stageReason(visibleChips(p)[0]!)).toMatch(/^Skipped/);
  });

  it('records start time, cache hits, server reasons and the transit-unavailable note', () => {
    let p = applyReadingEvent(undefined, { type: 'stage', name: 'promise', status: 'start' }, 1000);
    p = applyReadingEvent(p, { type: 'stage', name: 'promise', status: 'done', ms: 5, cached: true }, 1005);
    expect(p.stages[0]).toMatchObject({ startedAt: 1000, endedAt: 1005, cached: true });
    expect(stageReason(p.stages[0]!)).toBe('Reused from an earlier reading');
    p = applyReadingEvent(p, { type: 'stage', name: 'prepare', status: 'done', ms: 10, detail: { transits: 'unavailable' } }, 1010);
    expect(stageReason(visibleChips(p).find((c) => c.name === 'prepare')!)).toBe('Transit data unavailable');
    p = applyReadingEvent(p, { type: 'stage', name: 'dasha', status: 'skipped', reason: 'timeout' }, 1020);
    expect(stageReason(visibleChips(p).find((c) => c.name === 'dasha')!)).toBe('Skipped (timed out) — optional check');
  });

  it('failed reads as a capped reading, after a retry unless the server says there was none', () => {
    const chip = { key: 'dasha', name: 'dasha', label: 'Dasha', status: 'failed' as const };
    expect(stageReason(chip)).toBe('Did not finish after a retry — reading confidence capped');
    expect(stageReason({ ...chip, reason: 'timeout' })).toBe('Timed out after a retry — reading confidence capped');
    expect(stageReason({ ...chip, retried: false })).toBe('Did not finish — reading confidence capped');
  });

  it('a running subject outranks a skipped one; failed outranks all', () => {
    let p: ReadingProgress | undefined;
    p = applyReadingEvent(p, { type: 'stage', name: 'transit', status: 'skipped', subject: 'a' });
    p = applyReadingEvent(p, { type: 'stage', name: 'transit', status: 'start', subject: 'b' });
    expect(visibleChips(p)[0]!.status).toBe('start');
    p = applyReadingEvent(p, { type: 'stage', name: 'transit', status: 'failed', subject: 'c' });
    expect(visibleChips(p)[0]!.status).toBe('failed');
  });

  it('adds waiting rows for Cross-check and Writing, and counts finished stages', () => {
    let p = applyReadingEvent(undefined, { type: 'stage', name: 'prepare', status: 'done', ms: 1 });
    expect(panelStages(p).map((s) => `${s.name}:${s.status}`)).toEqual(['prepare:done', 'synthesize:waiting']);
    p = applyReadingEvent(p, { type: 'stage', name: 'dasha', status: 'start' });
    const stages = panelStages(p);
    expect(stages.map((s) => s.name)).toEqual(['prepare', 'dasha', 'reconcile', 'synthesize']);
    expect(stageCounts(stages)).toEqual({ finished: 1, total: 4 });
    expect(panelStages(undefined)).toEqual([]);
  });

  it('formats times for people', () => {
    expect(formatSeconds(4200)).toBe('4.2 s');
    expect(formatSeconds(34_400)).toBe('34 s');
    expect(formatSeconds(65_000)).toBe('1 m 05 s');
  });
});
