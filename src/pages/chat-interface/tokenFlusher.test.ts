import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTokenDeltaFlusher } from './tokenFlusher';

describe('createTokenDeltaFlusher', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('coalesces 50 rapid token deltas inside a 50ms window into <= 2 state flushes', () => {
    const flushes: string[] = [];
    let t = 0;
    const flusher = createTokenDeltaFlusher({
      intervalMs: 50,
      now: () => t,
      onFlush: (chunk) => flushes.push(chunk),
    });

    for (let i = 0; i < 50; i += 1) {
      t = Math.min(40, i);
      flusher.push(`w${i} `);
    }

    t = 60;
    vi.advanceTimersByTime(60);
    flusher.flushSync();

    expect(flushes.length).toBeLessThanOrEqual(2);
    expect(flushes.join('')).toBe(Array.from({ length: 50 }, (_, i) => `w${i} `).join(''));
    expect(flusher.pendingLength()).toBe(0);
    flusher.dispose();
  });

  it('flushSync emits buffered deltas immediately and clears pending queue', () => {
    const flushes: string[] = [];
    let t = 0;
    const flusher = createTokenDeltaFlusher({
      intervalMs: 50,
      now: () => t,
      onFlush: (chunk) => flushes.push(chunk),
    });

    flusher.push('first');
    vi.advanceTimersByTime(20);
    expect(flushes).toEqual(['first']);

    t = 25;
    flusher.push(' second');
    flusher.push(' third');
    expect(flusher.pendingLength()).toBe(' second third'.length);
    expect(flushes).toEqual(['first']);

    flusher.flushSync();
    expect(flushes).toEqual(['first', ' second third']);
    expect(flusher.pendingLength()).toBe(0);
    flusher.dispose();
  });

  it('dispose cancels scheduled flushes and drops unsent deltas', () => {
    const flushes: string[] = [];
    let t = 0;
    const flusher = createTokenDeltaFlusher({
      intervalMs: 50,
      now: () => t,
      onFlush: (chunk) => flushes.push(chunk),
    });

    flusher.push('alpha');
    vi.advanceTimersByTime(20);
    expect(flushes).toEqual(['alpha']);

    t = 25;
    flusher.push(' beta');
    expect(flusher.pendingLength()).toBe(' beta'.length);

    flusher.dispose();
    expect(flusher.pendingLength()).toBe(0);
    t = 150;
    vi.advanceTimersByTime(150);
    expect(flushes).toEqual(['alpha']);
  });
});
