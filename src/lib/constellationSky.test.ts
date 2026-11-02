import { describe, expect, it } from 'vitest';
import { CONSTELLATIONS, PLANETS, buildSky } from './constellationSky';

describe('the home page star map', () => {
  it('has the twelve signs and the nine grahas', () => {
    expect(CONSTELLATIONS).toHaveLength(12);
    expect(PLANETS).toHaveLength(9);
    expect(PLANETS.filter((p) => p.node).map((p) => p.id)).toEqual(['rahu', 'ketu']);
  });

  it('every figure line joins two stars that exist', () => {
    for (const c of CONSTELLATIONS) {
      for (const [a, b] of c.lines) {
        expect(a, c.id).toBeLessThan(c.stars.length);
        expect(b, c.id).toBeLessThan(c.stars.length);
        expect(a).not.toBe(b);
      }
    }
  });

  it('each sign has exactly one ruling planet, and every rule line has a target', () => {
    const rulers = new Map<string, string>();
    for (const p of PLANETS) for (const id of p.rules) rulers.set(id, p.id);
    for (const c of CONSTELLATIONS) expect(rulers.get(c.id), c.id).toBeDefined();
    expect(rulers.size).toBe(12);
  });

  it.each(['wide', 'tall'] as const)('%s layout keeps everything inside the picture and is the same each time', (layout) => {
    const sky = buildSky(layout);
    const inside = ({ x, y }: { x: number; y: number }) => x >= -40 && x <= sky.width + 40 && y >= -40 && y <= sky.height + 40;
    for (const c of sky.constellations) {
      expect(inside(c.centre), c.id).toBe(true);
      for (const s of c.stars) expect(inside(s), c.id).toBe(true);
    }
    for (const p of sky.planets) expect(inside(p.centre), p.id).toBe(true);
    expect(sky.lines.filter((l) => l.kind === 'belt')).toHaveLength(12);
    expect(sky.lines.filter((l) => l.kind === 'rule')).toHaveLength(12);
    expect(sky.orbits).toHaveLength(7);
    expect(buildSky(layout)).toEqual(sky);
  });

  it('keeps the planets apart from each other', () => {
    for (const layout of ['wide', 'tall'] as const) {
      const sky = buildSky(layout);
      const min = layout === 'wide' ? 70 : 40;
      for (const a of sky.planets) {
        for (const b of sky.planets) {
          if (a === b) continue;
          const d = Math.hypot(a.centre.x - b.centre.x, a.centre.y - b.centre.y);
          expect(d, `${layout} ${a.id} ${b.id}`).toBeGreaterThan(min);
        }
      }
    }
  });
});
