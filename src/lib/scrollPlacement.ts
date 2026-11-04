/**
 * Where the home page's parchment scrolls rest: scattered over the screen rather than ringed round its edges, apart from one
 * another, clear of the header and footer bands, the scene's centre and its caption. Pure, so the layout rules are tested
 * without a browser.
 */

export interface Placement {
  /** the icon's middle, as a percentage of the page's width */
  x: number;
  /** the icon's middle, as a percentage of the page's height */
  y: number;
  /** which way the hover label opens: the half of the screen the icon is in */
  edge: 'left' | 'right';
}

/** The strip of page a scroll may rest in: below the header, above the footer. */
const X_RANGE: [number, number] = [6, 94];
const Y_RANGE: [number, number] = [14, 82];

/** Rectangles a scroll stays out of: [x0, x1, y0, y1]. */
const KEEP_OUT: ReadonlyArray<readonly [number, number, number, number]> = [[36, 64, 14, 82]];
/** The caption sits bottom right on a wide screen, and at the picture's lower right, near the top of the page, on an upright one. */
const CAPTION = [70, 100, 62, 100] as const;
const CAPTION_PORTRAIT = [66, 100, 12, 44] as const;
/** On an upright screen the picture fills the width, so only a narrow centre strip is kept clear. */
const KEEP_OUT_PORTRAIT: ReadonlyArray<readonly [number, number, number, number]> = [[30, 70, 30, 66]];

/** With no random source (the prerendered page), scrolls rest at these spots, so the first paint and the server's agree. */
const FIXED: ReadonlyArray<readonly [number, number]> = [
  [18, 22],
  [78, 20],
  [12, 50],
  [86, 44],
  [28, 74],
  [70, 70],
  [24, 36],
  [82, 76],
];

const inside = (x: number, y: number, r: readonly [number, number, number, number]) => x >= r[0] && x <= r[1] && y >= r[2] && y <= r[3];

/** Distance with the page's width counted for less, since a point's x percent spans more pixels than its y percent. */
const apart = (a: Placement, b: Placement) => Math.hypot((a.x - b.x) * 0.6, a.y - b.y);

const nearest = (x: number): 'left' | 'right' => (x < 50 ? 'left' : 'right');

/**
 * A spot for each of `count` scrolls, drawn at random one after another and kept well apart. If a draw keeps landing too close to
 * an earlier scroll the gap shrinks a little, so there is always an answer.
 */
export function placeScrolls(count: number, random?: () => number, portrait = false): Placement[] {
  if (!random) {
    return Array.from({ length: count }, (_, i) => {
      const [x, y] = FIXED[i % FIXED.length]!;
      return { x, y, edge: nearest(x) };
    });
  }
  const keepOut = portrait ? KEEP_OUT_PORTRAIT : KEEP_OUT;
  const caption = portrait ? CAPTION_PORTRAIT : CAPTION;
  const out: Placement[] = [];
  let gap = 20;
  while (out.length < count) {
    let placed = false;
    for (let tries = 0; tries < 60 && !placed; tries++) {
      // rounded first, so what is tested against the keep-out areas is what is placed
      const x = Math.round((X_RANGE[0] + random() * (X_RANGE[1] - X_RANGE[0])) * 10) / 10;
      const y = Math.round((Y_RANGE[0] + random() * (Y_RANGE[1] - Y_RANGE[0])) * 10) / 10;
      if (keepOut.some((r) => inside(x, y, r)) || inside(x, y, caption)) continue;
      const p: Placement = { x, y, edge: nearest(x) };
      if (out.every((q) => apart(p, q) >= gap)) {
        out.push(p);
        placed = true;
      }
    }
    if (!placed) gap *= 0.9;
  }
  return out;
}

/** Which side a scroll opens on: the half of the screen its icon is in, so it opens toward the middle. */
export function openSide(p: Placement): 'left' | 'right' {
  return p.x < 50 ? 'left' : 'right';
}
