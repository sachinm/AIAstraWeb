import { describe, expect, it } from 'vitest';
import { LOADING_QUIPS, pickQuipStart } from './loadingQuips';

describe('loading quips', () => {
  it('has between 25 and 50 short, distinct lines', () => {
    expect(LOADING_QUIPS.length).toBeGreaterThanOrEqual(25);
    expect(LOADING_QUIPS.length).toBeLessThanOrEqual(50);
    expect(new Set(LOADING_QUIPS).size).toBe(LOADING_QUIPS.length);
    for (const q of LOADING_QUIPS) expect(q.length, q).toBeLessThanOrEqual(90);
  });

  it('never names the engine, a step count, a wait, or makes a prediction', () => {
    const banned = /radha|jhora|engine|loading|please wait|almost|nearly|step \d|\b\d+ of \d+\b|seconds?\b|minutes?\b|you will|you'll|will happen|is coming|expect to/i;
    for (const q of LOADING_QUIPS) expect(q, q).not.toMatch(banned);
  });

  it('picks a random start inside the list', () => {
    expect(pickQuipStart(() => 0)).toBe(0);
    expect(pickQuipStart(() => 0.999999)).toBe(LOADING_QUIPS.length - 1);
    expect(pickQuipStart(() => 0.5)).toBe(Math.floor(LOADING_QUIPS.length / 2));
  });
});
