import { describe, expect, it } from 'vitest';
import { chartSvg } from './chartBoard.js';

describe('the 12-house board', () => {
  for (const style of ['south', 'north'] as const) {
    for (const theme of ['light', 'dark'] as const) {
      it(`${style} ${theme}: houses 1 to 12, each once, and no planet in any house`, () => {
        const svg = chartSvg(style, theme);
        const numerals = [...svg.matchAll(/fill="[^"]*"[^>]*>(\d+)<\/text>/g)].map((m) => Number(m[1]));
        // each numeral is drawn twice (an embossed shadow and the face), so twelve pairs
        expect(numerals.sort((a, b) => a - b)).toEqual(Array.from({ length: 12 }, (_, i) => [i + 1, i + 1]).flat());
        expect(svg).not.toMatch(/[☉☽♂☿♃♀♄☊☋]/);
      });
    }
  }
});
