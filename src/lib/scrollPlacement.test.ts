import { describe, expect, it } from 'vitest';
import { openSide, placeScrolls, type Edge } from './scrollPlacement';

/** A repeatable stand-in for Math.random. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

describe('placing the scrolls', () => {
  it('uses all four edges before doubling up, two each for eight', () => {
    for (let seed = 1; seed < 50; seed++) {
      const counts: Record<Edge, number> = { top: 0, right: 0, bottom: 0, left: 0 };
      for (const p of placeScrolls(8, seeded(seed))) counts[p.edge]++;
      expect(Object.values(counts)).toEqual([2, 2, 2, 2]);
    }
  });

  it('keeps scrolls on one edge apart', () => {
    for (let seed = 1; seed < 200; seed++) {
      const placed = placeScrolls(8, seeded(seed));
      for (const edge of ['top', 'right', 'bottom', 'left'] as Edge[]) {
        const at = placed.filter((p) => p.edge === edge).map((p) => p.at).sort((a, b) => a - b);
        for (let i = 1; i < at.length; i++) expect(at[i]! - at[i - 1]!).toBeGreaterThanOrEqual(10);
      }
    }
  });

  it('leaves the bottom right corner to the scene caption', () => {
    for (let seed = 1; seed < 200; seed++) {
      for (const p of placeScrolls(8, seeded(seed))) {
        if (p.edge === 'bottom') expect(p.at).toBeLessThanOrEqual(58);
        if (p.edge === 'right') expect(p.at).toBeLessThanOrEqual(62);
      }
    }
  });

  it('on an upright screen, keeps the right edge clear of the caption near the top instead', () => {
    for (let seed = 1; seed < 200; seed++) {
      for (const p of placeScrolls(8, seeded(seed), true)) if (p.edge === 'right') expect(p.at).toBeGreaterThanOrEqual(42);
    }
  });

  it('deals the scrolls out differently on different visits', () => {
    const a = JSON.stringify(placeScrolls(8, seeded(3)));
    const b = JSON.stringify(placeScrolls(8, seeded(4)));
    expect(a).not.toBe(b);
  });

  it('is the same every time with no random source, for the prerendered page', () => {
    expect(placeScrolls(8)).toEqual(placeScrolls(8));
    expect(placeScrolls(8)[0]).toEqual({ edge: 'top', at: 31 });
  });
});

describe('which side a scroll opens on', () => {
  it('its own, or the nearer one from the top and bottom', () => {
    expect(openSide({ edge: 'left', at: 80 })).toBe('left');
    expect(openSide({ edge: 'right', at: 20 })).toBe('right');
    expect(openSide({ edge: 'top', at: 30 })).toBe('left');
    expect(openSide({ edge: 'bottom', at: 55 })).toBe('right');
  });
});
