/**
 * The home page star map: the twelve zodiac constellations on a belt, the seven visible grahas on orbits inside it,
 * and Rahu and Ketu opposite each other on the belt. Art, not a chart: every position is fixed and nothing here is
 * astrology. The pairing of a planet to a sign is the traditional rulership, drawn as a line.
 */

export interface SkyPoint {
  x: number;
  y: number;
}

export interface SkyStar extends SkyPoint {
  /** 0.4 to 1.6, the dot's radius */
  size: number;
}

export interface SkyConstellation {
  id: string;
  /** English and Sanskrit */
  name: string;
  rashi: string;
  /** stars in the figure's own frame, each about -1..1 */
  stars: SkyPoint[];
  /** which stars join, as pairs of indexes */
  lines: [number, number][];
}

export interface SkyPlanet {
  id: string;
  name: string;
  colour: string;
  /** radius in px at the base scale */
  size: number;
  /** signs it rules, by constellation id */
  rules: string[];
  ring?: boolean;
  /** Rahu and Ketu, shown on the belt */
  node?: boolean;
}

export interface PlacedConstellation extends SkyConstellation {
  stars: SkyStar[];
  centre: SkyPoint;
  /** anchor for the label */
  label: SkyPoint;
}

export interface PlacedPlanet extends SkyPlanet {
  centre: SkyPoint;
  label: SkyPoint;
}

export interface SkyLine {
  from: SkyPoint;
  to: SkyPoint;
  kind: 'rule' | 'belt';
}

export interface SkyOrbit {
  rx: number;
  ry: number;
}

export interface Sky {
  width: number;
  height: number;
  centre: SkyPoint;
  belt: SkyOrbit;
  orbits: SkyOrbit[];
  constellations: PlacedConstellation[];
  planets: PlacedPlanet[];
  lines: SkyLine[];
  /** the loose background stars */
  field: SkyStar[];
}

export type SkyLayout = 'wide' | 'tall';

/** Simplified stick figures. The shapes echo the real constellations enough to be recognised. */
export const CONSTELLATIONS: SkyConstellation[] = [
  { id: 'aries', name: 'Aries', rashi: 'Mesha', stars: [[-1, 0.3], [-0.3, -0.2], [0.5, -0.5], [1, -0.2]].map(p), lines: [[0, 1], [1, 2], [2, 3]] },
  { id: 'taurus', name: 'Taurus', rashi: 'Vrishabha', stars: [[-1, -0.8], [-0.4, -0.2], [0, 0.2], [0.5, 0], [1, -0.6], [0.3, 0.8], [-0.2, 0.7]].map(p), lines: [[0, 1], [1, 2], [2, 3], [3, 4], [2, 6], [6, 5]] },
  { id: 'gemini', name: 'Gemini', rashi: 'Mithuna', stars: [[-0.6, -1], [-0.5, -0.2], [-0.6, 0.6], [-0.7, 1], [0.6, -1], [0.5, -0.2], [0.6, 0.6], [0.7, 1]].map(p), lines: [[0, 1], [1, 2], [2, 3], [4, 5], [5, 6], [6, 7], [1, 5]] },
  { id: 'cancer', name: 'Cancer', rashi: 'Karka', stars: [[0, -1], [0, -0.2], [-0.8, 0.6], [0.8, 0.5], [-0.4, 1]].map(p), lines: [[0, 1], [1, 2], [1, 3], [2, 4]] },
  { id: 'leo', name: 'Leo', rashi: 'Simha', stars: [[-1, 0.6], [-0.5, -0.1], [-0.3, -0.8], [0.2, -1], [0.5, -0.5], [0.3, 0.1], [1, 0.7], [0.9, 0.2]].map(p), lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 1], [5, 6], [6, 7], [7, 4]] },
  { id: 'virgo', name: 'Virgo', rashi: 'Kanya', stars: [[-1, -0.4], [-0.5, -0.1], [0, 0], [0.4, -0.6], [0.9, -0.9], [0.5, 0.6], [1, 0.9], [-0.3, 0.8]].map(p), lines: [[0, 1], [1, 2], [2, 3], [3, 4], [2, 5], [5, 6], [1, 7]] },
  { id: 'libra', name: 'Libra', rashi: 'Tula', stars: [[0, -1], [-0.8, -0.1], [0.8, -0.1], [-0.6, 0.9], [0.6, 0.9]].map(p), lines: [[0, 1], [0, 2], [1, 2], [1, 3], [2, 4]] },
  { id: 'scorpio', name: 'Scorpio', rashi: 'Vrishchika', stars: [[-1, -0.9], [-0.9, -0.3], [-0.6, 0.1], [-0.1, 0.3], [0.4, 0.7], [0.9, 0.9], [1, 0.3], [0.7, 0]].map(p), lines: [[0, 2], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7]] },
  { id: 'sagittarius', name: 'Sagittarius', rashi: 'Dhanu', stars: [[-1, 0.6], [-0.4, 0.2], [0.1, -0.1], [0.6, -0.6], [1, -1], [0.2, 0.7], [0.8, 0.5], [-0.5, -0.6]].map(p), lines: [[0, 1], [1, 2], [2, 3], [3, 4], [2, 5], [5, 6], [1, 7]] },
  { id: 'capricorn', name: 'Capricorn', rashi: 'Makara', stars: [[-1, -0.5], [-0.4, -0.1], [0.2, 0.2], [0.8, 0.5], [1, -0.3], [0.4, -0.6]].map(p), lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0]] },
  { id: 'aquarius', name: 'Aquarius', rashi: 'Kumbha', stars: [[-1, -0.3], [-0.5, -0.6], [0, -0.2], [0.5, -0.6], [1, -0.2], [0.2, 0.5], [0.4, 1]].map(p), lines: [[0, 1], [1, 2], [2, 3], [3, 4], [2, 5], [5, 6]] },
  { id: 'pisces', name: 'Pisces', rashi: 'Meena', stars: [[-1, 0.8], [-0.6, 0.3], [-0.2, 0], [0.4, -0.4], [1, -0.9], [0.8, -0.3], [-0.7, 1]].map(p), lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 3], [0, 6]] },
];

/** The classical order out from the Earth, then the two nodes on the belt. */
export const PLANETS: SkyPlanet[] = [
  { id: 'moon', name: 'Chandra', colour: '#dfe6f5', size: 7, rules: ['cancer'] },
  { id: 'mercury', name: 'Budha', colour: '#7fd6a8', size: 4.5, rules: ['gemini', 'virgo'] },
  { id: 'venus', name: 'Shukra', colour: '#f6f0dc', size: 6.5, rules: ['taurus', 'libra'] },
  { id: 'sun', name: 'Surya', colour: '#f6b85b', size: 11, rules: ['leo'] },
  { id: 'mars', name: 'Mangala', colour: '#e4634a', size: 5.5, rules: ['aries', 'scorpio'] },
  { id: 'jupiter', name: 'Guru', colour: '#e9c46a', size: 9.5, rules: ['sagittarius', 'pisces'] },
  { id: 'saturn', name: 'Shani', colour: '#9aa3c7', size: 8, rules: ['capricorn', 'aquarius'], ring: true },
  { id: 'rahu', name: 'Rahu', colour: '#8f7bd6', size: 6, rules: [], node: true },
  { id: 'ketu', name: 'Ketu', colour: '#b9a27a', size: 6, rules: [], node: true },
];

function p([x, y]: number[]): SkyPoint {
  return { x, y };
}

/** A small deterministic generator, so the field is the same in every build and test. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const onEllipse = (c: SkyPoint, o: SkyOrbit, angle: number): SkyPoint => ({ x: c.x + o.rx * Math.cos(angle), y: c.y + o.ry * Math.sin(angle) });

const round = (n: number): number => Math.round(n * 10) / 10;
const rp = (q: SkyPoint): SkyPoint => ({ x: round(q.x), y: round(q.y) });

export function buildSky(layout: SkyLayout): Sky {
  const wide = layout === 'wide';
  const width = wide ? 1440 : 430;
  const height = wide ? 820 : 900;
  const centre = { x: width / 2, y: wide ? 400 : 430 };
  const belt: SkyOrbit = wide ? { rx: 590, ry: 330 } : { rx: 196, ry: 380 };
  const figure = wide ? 34 : 15;
  const orbitCount = 7;
  // the orbits start half way out, so every planet can sit clear of the hero words in the middle
  const innerMost = 0.5;
  const orbits: SkyOrbit[] = Array.from({ length: orbitCount }, (_, i) => {
    const f = innerMost + ((0.84 - innerMost) * i) / (orbitCount - 1);
    return { rx: round(belt.rx * f), ry: round(belt.ry * f) };
  });

  // signs run anticlockwise from the left, as a chart wheel does, starting with Aries at 9 o'clock
  const constellations: PlacedConstellation[] = CONSTELLATIONS.map((c, i) => {
    const angle = Math.PI - (i * 2 * Math.PI) / 12;
    const at = onEllipse(centre, belt, angle);
    const stars: SkyStar[] = c.stars.map((s, j) => ({ x: round(at.x + s.x * figure), y: round(at.y + s.y * figure), size: j === 0 ? 1.6 : j % 3 === 0 ? 1.3 : 1 }));
    const out = { x: Math.cos(angle), y: Math.sin(angle) };
    const label = rp({ x: at.x + out.x * (figure + 26), y: at.y + out.y * (figure + 22) });
    return { ...c, stars, centre: rp(at), label };
  });

  // each planet on its own orbit, placed where the hero words are not: below them, or out in the left and right
  // lobes on a wide screen; in the band under the button, or above the title, on a phone. The nodes face each
  // other on the belt.
  const turns = wide ? [0.5, 0.78, 0.22, 1.0, 1.9, 1.15, 0.08] : [0.5, 0.62, 0.33, 0.5, 0.68, 0.3, 1.5];
  const angles = turns.map((t) => t * Math.PI);
  const planets: PlacedPlanet[] = PLANETS.map((pl, i) => {
    if (pl.node) {
      const angle = pl.id === 'rahu' ? Math.PI * 0.5 - Math.PI / 12 : Math.PI * 1.5 - Math.PI / 12;
      const at = onEllipse(centre, belt, angle);
      return { ...pl, centre: rp(at), label: rp({ x: at.x, y: at.y + (pl.id === 'rahu' ? 22 : -14) }) };
    }
    const at = onEllipse(centre, orbits[i], angles[i]);
    return { ...pl, centre: rp(at), label: rp({ x: at.x + pl.size + 6, y: at.y + 4 }) };
  });

  const byId = new Map(constellations.map((c) => [c.id, c]));
  const lines: SkyLine[] = [];
  for (let i = 0; i < constellations.length; i++) {
    lines.push({ from: constellations[i].centre, to: constellations[(i + 1) % constellations.length].centre, kind: 'belt' });
  }
  for (const pl of planets) {
    for (const id of pl.rules) {
      const c = byId.get(id);
      if (c) lines.push({ from: pl.centre, to: c.centre, kind: 'rule' });
    }
  }

  const next = rng(wide ? 11 : 23);
  const field: SkyStar[] = Array.from({ length: wide ? 110 : 70 }, () => ({
    x: round(next() * width),
    y: round(next() * height),
    size: round(0.4 + next() * 1.1),
  }));

  return { width, height, centre, belt, orbits, constellations, planets, lines, field };
}
