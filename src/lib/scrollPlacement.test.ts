import { describe, expect, it } from 'vitest';
import { openSide, placeScrolls } from './scrollPlacement';

/** A repeatable stand-in for Math.random. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

describe('placing the scrolls', () => {
  it('gives each of the eight scrolls a spot, below the header and above the footer', () => {
    for (let seed = 1; seed < 100; seed++) {
      const placed = placeScrolls(8, seeded(seed));
      expect(placed).toHaveLength(8);
      for (const p of placed) {
        expect(p.y).toBeGreaterThanOrEqual(14);
        expect(p.y).toBeLessThanOrEqual(82);
        expect(p.x).toBeGreaterThanOrEqual(6);
        expect(p.x).toBeLessThanOrEqual(94);
      }
    }
  });

  it('does not ring the edges: across visits scrolls land well inside the page', () => {
    let inner = 0;
    let total = 0;
    for (let seed = 1; seed < 100; seed++) {
      for (const p of placeScrolls(8, seeded(seed))) {
        total++;
        if (p.x > 15 && p.x < 85 && p.y > 24 && p.y < 72) inner++;
      }
    }
    expect(inner / total).toBeGreaterThan(0.25);
  });

  it('keeps scrolls apart', () => {
    for (let seed = 1; seed < 200; seed++) {
      const placed = placeScrolls(8, seeded(seed));
      for (let i = 0; i < placed.length; i++) {
        for (let j = i + 1; j < placed.length; j++) {
          const d = Math.hypot((placed[i]!.x - placed[j]!.x) * 0.6, placed[i]!.y - placed[j]!.y);
          expect(d).toBeGreaterThanOrEqual(8);
        }
      }
    }
  });

  it('keeps the middle of the scene and the caption clear', () => {
    for (let seed = 1; seed < 200; seed++) {
      for (const p of placeScrolls(8, seeded(seed))) {
        expect(p.x < 36 || p.x > 64).toBe(true);
        expect(p.x >= 70 && p.y >= 62).toBe(false);
      }
    }
  });

  it('on an upright screen, keeps the caption near the top right clear instead', () => {
    for (let seed = 1; seed < 200; seed++) {
      for (const p of placeScrolls(8, seeded(seed), true)) expect(p.x >= 66 && p.y >= 12 && p.y <= 44).toBe(false);
    }
  });

  it('deals the scrolls out differently on different visits', () => {
    expect(JSON.stringify(placeScrolls(8, seeded(3)))).not.toBe(JSON.stringify(placeScrolls(8, seeded(4))));
  });

  it('is the same every time with no random source, for the prerendered page', () => {
    expect(placeScrolls(8)).toEqual(placeScrolls(8));
    expect(placeScrolls(8)[0]).toEqual({ x: 18, y: 22, edge: 'left' });
  });
});

describe('which side a scroll opens on', () => {
  it('the half of the screen its icon is in', () => {
    expect(openSide({ x: 20, y: 50, edge: 'left' })).toBe('left');
    expect(openSide({ x: 80, y: 20, edge: 'right' })).toBe('right');
  });
});
