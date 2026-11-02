import { describe, expect, it } from 'vitest';
import { SKY_HOLD_DEFAULT_SECONDS, skyHoldMs } from './skies';

describe('skyHoldMs', () => {
  it('defaults to two minutes when the variable is not set', () => {
    expect(SKY_HOLD_DEFAULT_SECONDS).toBe(120);
    expect(skyHoldMs(undefined)).toBe(120_000);
    expect(skyHoldMs('')).toBe(120_000);
  });

  it('reads the value in seconds', () => {
    expect(skyHoldMs('45')).toBe(45_000);
    expect(skyHoldMs('300')).toBe(300_000);
  });

  it('ignores nonsense and anything under 10 seconds', () => {
    expect(skyHoldMs('abc')).toBe(120_000);
    expect(skyHoldMs('3')).toBe(120_000);
    expect(skyHoldMs('-20')).toBe(120_000);
  });
});
