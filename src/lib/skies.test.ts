import { describe, expect, it } from 'vitest';
import { SKY_SCENES, pickCorners, shuffledRound, skySrc } from './skies';

describe('the home page scenes', () => {
  it('has the 27 nakshatras and 12 planets once each', () => {
    expect(SKY_SCENES).toHaveLength(39);
    expect(new Set(SKY_SCENES.map((s) => s.id)).size).toBe(39);
  });

  it('matches the list the images were made from, in the same order', async () => {
    const path = '../../scripts/skies/scenes.mjs';
    const { SCENES } = (await import(/* @vite-ignore */ path)) as { SCENES: { id: string; name: string; caption: string }[] };
    expect(SKY_SCENES.map((s) => [s.id, s.name, s.caption])).toEqual(SCENES.map((s) => [s.id, s.name, s.caption]));
  });

  it('labels every scene in Hindi and English, and every nakshatra with its sign', () => {
    for (const s of SKY_SCENES) {
      expect(s.nameHi, s.id).toMatch(/[ऀ-ॿ]/);
      expect(s.name, s.id).toMatch(/^[A-Za-z ]+$/);
      if (s.captionHi) {
        expect(s.signs.length, s.id).toBeGreaterThan(0);
        for (const sign of s.signs) {
          expect(sign.hi, s.id).toMatch(/[ऀ-ॿ]/);
          expect(sign.en, s.id).toMatch(/^[A-Za-z]+$/);
        }
      }
    }
    expect(SKY_SCENES.filter((s) => s.signs.length > 0)).toHaveLength(27);
    // a nakshatra spans 13 degrees 20 minutes, so nine of the twenty-seven cross from one sign into the next
    expect(SKY_SCENES.filter((s) => s.signs.length === 2)).toHaveLength(9);
  });

  it('has an image file for every scene', () => {
    for (const s of SKY_SCENES) expect(skySrc(s.id), s.id).toMatch(/\.webp$/);
  });

  it('plays every scene once a round, in random order, never repeating the one on screen', () => {
    for (let last = 0; last < SKY_SCENES.length; last++) {
      const round = shuffledRound(last);
      expect(round[0]).not.toBe(last);
      expect([...round].sort((a, b) => a - b)).toEqual(SKY_SCENES.map((_, i) => i));
    }
    const a = shuffledRound(0).join();
    const others = Array.from({ length: 5 }, () => shuffledRound(0).join());
    expect(others.some((o) => o !== a)).toBe(true);
  });

  it('never blooms and leaves through the same corner', () => {
    const values = [0, 0.1, 0.26, 0.4, 0.51, 0.74, 0.76, 0.99];
    for (const a of values) {
      for (const b of values) {
        const seq = [a, b];
        const { from, to } = pickCorners(() => seq.shift() as number);
        expect(from).not.toEqual(to);
      }
    }
  });
});
