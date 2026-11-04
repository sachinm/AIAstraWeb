/**
 * Where the home page's parchment scrolls rest: two or so on each edge, spread out so none overlap, and clear of the scene's
 * caption in the bottom right corner. Pure, so the layout rules are tested without a browser.
 */

export type Edge = 'top' | 'right' | 'bottom' | 'left';

export interface Placement {
  edge: Edge;
  /** along the edge, as a percentage: left to right for top and bottom, top to bottom for the sides */
  at: number;
}

/** The stretch of each edge a scroll may use. The scene caption sits bottom right on a wide screen. */
const RANGE: Record<Edge, [number, number]> = {
  top: [12, 88],
  right: [10, 62],
  bottom: [8, 58],
  left: [10, 88],
};
/** On an upright screen the caption sits at the picture's lower right, near the top of the page, and the bottom is free. */
const RANGE_PORTRAIT: Record<Edge, [number, number]> = {
  top: [12, 88],
  right: [42, 90],
  bottom: [10, 90],
  left: [10, 88],
};

const EDGES: Edge[] = ['top', 'right', 'bottom', 'left'];

/** Fisher-Yates, with the random source passed in so tests can fix it. */
function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * A placement for each of `count` scrolls. Every edge is used before any edge gets a second, and scrolls on the same edge each get
 * their own share of it. With `random` left out, every scroll sits at the middle of its share, which is what the prerendered page
 * shows before the browser deals them out.
 */
export function placeScrolls(count: number, random?: () => number, portrait = false): Placement[] {
  const range = portrait ? RANGE_PORTRAIT : RANGE;
  const edges = random ? shuffled(EDGES, random) : EDGES;
  const order = random ? shuffled([...Array(count).keys()], random) : [...Array(count).keys()];
  const byEdge: Record<Edge, number[]> = { top: [], right: [], bottom: [], left: [] };
  order.forEach((item, n) => byEdge[edges[n % edges.length]!].push(item));

  const out: Placement[] = new Array(count);
  for (const edge of EDGES) {
    const items = byEdge[edge];
    const [from, to] = range[edge];
    const share = (to - from) / Math.max(items.length, 1);
    items.forEach((item, k) => {
      // the middle half of its share, so neighbours always keep a gap
      const jitter = random ? (random() - 0.5) * share * 0.5 : 0;
      out[item] = { edge, at: Math.round((from + share * (k + 0.5) + jitter) * 10) / 10 };
    });
  }
  return out;
}

/** Which side a scroll opens on: its own for the side edges, the nearer one for the top and bottom. */
export function openSide(p: Placement): 'left' | 'right' {
  if (p.edge === 'left' || p.edge === 'right') return p.edge;
  return p.at < 50 ? 'left' : 'right';
}
