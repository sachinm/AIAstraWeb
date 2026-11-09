// The house chart as one board (server docs/loading-overlay/01; Sachin 2026-11-09: "a board like a Monopoly board, the
// centre the same colour as the whole square"). A single raised square with a thick, rounded 3D edge, a soft shadow and
// a lit rim; its top face is one colour, centre included. The twelve houses are engraved into that face as grooves, with
// a small numeral 1..12 from the first house tucked into each so the house stays free for planets. No planet sits in a
// house. Plain JS so both the build script and the app use the one drawing: the app draws it at once inside the loading
// veil, the build encrypts the same picture (scripts/encrypt-overlay-art.mjs).

const S = 1000; // square canvas
const BOARD = 60; // board edge inset from the canvas
const FRAME = 46; // the board's border band, outside the chart
const RADIUS = 46; // the board's corner radius
const DEPTH = 26; // the board's thickness

const PALETTE = {
  dark: {
    faceTop: '#2a2361',
    faceBottom: '#1b1745',
    frameTop: '#3a2f7d',
    frameBottom: '#241d57',
    side: '#0f0c2a',
    sideLight: '#3b3380',
    rim: 'rgba(216,180,254,0.55)',
    sheen: 0.14,
    shadow: 'rgba(2,1,12,0.8)',
    groove: 'rgba(5,3,20,0.85)',
    grooveLight: 'rgba(196,181,253,0.45)',
    text: 'rgba(233,213,255,0.92)',
    textDeep: 'rgba(5,3,20,0.85)',
  },
  light: {
    faceTop: '#fdfcff',
    faceBottom: '#efeafd',
    frameTop: '#e9e2fc',
    frameBottom: '#d9cff8',
    side: '#b7a8ec',
    sideLight: '#ffffff',
    rim: 'rgba(124,58,237,0.35)',
    sheen: 0.7,
    shadow: 'rgba(76,29,149,0.32)',
    groove: 'rgba(76,29,149,0.55)',
    grooveLight: 'rgba(255,255,255,0.95)',
    text: 'rgba(76,29,149,0.85)',
    textDeep: 'rgba(255,255,255,0.95)',
  },
};

const FONT = "font-family=\"'Iowan Old Style','Palatino Linotype','Book Antiqua',Georgia,serif\"";

/** The chart's square on the board face. */
const A = BOARD + FRAME;
const B = S - BOARD - FRAME;

const centroid = (pts) => [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];

/** An engraved line: a dark cut with a lit lower lip. */
function groove(p, x1, y1, x2, y2) {
  const f = (n) => n.toFixed(1);
  return (
    `<line x1="${f(x1)}" y1="${f(y1 + 1.6)}" x2="${f(x2)}" y2="${f(y2 + 1.6)}" stroke="${p.grooveLight}" stroke-width="3" stroke-linecap="round"/>` +
    `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${p.groove}" stroke-width="4" stroke-linecap="round"/>`
  );
}

function numeral(p, x, y, n) {
  return (
    `<text x="${(x + 1).toFixed(1)}" y="${(y + 1.4).toFixed(1)}" text-anchor="middle" font-size="30" fill="${p.textDeep}" ${FONT}>${n}</text>` +
    `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" font-size="30" fill="${p.text}" ${FONT}>${n}</text>`
  );
}

function south(p) {
  const c = (B - A) / 4;
  const x = (i) => A + i * c;
  const y = (i) => A + i * c;
  const lines = [
    // the chart's own square
    [x(0), y(0), x(4), y(0)], [x(4), y(0), x(4), y(4)], [x(4), y(4), x(0), y(4)], [x(0), y(4), x(0), y(0)],
    // full lines between the outer ring and the centre
    [x(0), y(1), x(4), y(1)], [x(0), y(3), x(4), y(3)], [x(1), y(0), x(1), y(4)], [x(3), y(0), x(3), y(4)],
    // the short dividers in the ring only, never across the centre
    [x(2), y(0), x(2), y(1)], [x(2), y(3), x(2), y(4)], [x(0), y(2), x(1), y(2)], [x(3), y(2), x(4), y(2)],
  ];
  // the centre's four sides would be drawn twice by the full lines; that is fine, they are the same cut
  const order = [[1, 0], [2, 0], [3, 0], [3, 1], [3, 2], [3, 3], [2, 3], [1, 3], [0, 3], [0, 2], [0, 1], [0, 0]];
  // each numeral sits small in the top-left of its house, leaving the house free
  const numbers = order.map(([cx, cy], i) => numeral(p, x(cx) + 30, y(cy) + 40, i + 1)).join('');
  return lines.map((l) => groove(p, ...l)).join('') + numbers;
}

function north(p) {
  const m = (A + B) / 2;
  const q1 = A + (B - A) / 4;
  const q3 = A + (3 * (B - A)) / 4;
  const TL = [A, A], TR = [B, A], BR = [B, B], BL = [A, B];
  const T = [m, A], R = [B, m], Bo = [m, B], L = [A, m], C = [m, m];
  const P1 = [q1, q1], P2 = [q3, q1], P3 = [q3, q3], P4 = [q1, q3];
  const lines = [
    [...TL, ...TR], [...TR, ...BR], [...BR, ...BL], [...BL, ...TL],
    [...TL, ...BR], [...TR, ...BL],
    [...T, ...R], [...R, ...Bo], [...Bo, ...L], [...L, ...T],
  ];
  const houses = [
    [T, P2, C, P1], [TL, T, P1], [TL, P1, L], [L, P1, C, P4], [L, P4, BL], [BL, P4, Bo],
    [Bo, P4, C, P3], [Bo, P3, BR], [BR, P3, R], [R, P3, C, P2], [R, P2, TR], [TR, P2, T],
  ];
  // each numeral sits small at the centre of its house
  const numbers = houses
    .map((h, i) => {
      const [cx, cy] = centroid(h);
      const nx = cx;
      const ny = cy + 10;
      return numeral(p, nx, ny, i + 1);
    })
    .join('');
  return lines.map((l) => groove(p, ...l)).join('') + numbers;
}

/** The board as an SVG string. */
export function chartSvg(style, theme) {
  const p = PALETTE[theme];
  const label = style === 'south' ? 'South' : 'North';
  const w = S - 2 * BOARD;
  const rect = (dy, fill, extra = '') => `<rect x="${BOARD}" y="${BOARD + dy}" width="${w}" height="${w}" rx="${RADIUS}" fill="${fill}" ${extra}/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S + DEPTH + 40}" width="${S}" height="${S + DEPTH + 40}" role="img" aria-label="An empty ${label} Indian house chart">
<title>Empty ${label} Indian chart</title>
<defs>
  <linearGradient id="face" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.faceTop}"/><stop offset="1" stop-color="${p.faceBottom}"/></linearGradient>
  <linearGradient id="frame" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.frameTop}"/><stop offset="1" stop-color="${p.frameBottom}"/></linearGradient>
  <linearGradient id="side" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${p.side}"/><stop offset="0.5" stop-color="${p.sideLight}" stop-opacity="0.35"/><stop offset="1" stop-color="${p.side}"/></linearGradient>
  <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="${p.sheen}"/><stop offset="0.45" stop-color="#ffffff" stop-opacity="0"/><stop offset="1" stop-color="#000000" stop-opacity="${theme === 'dark' ? 0.2 : 0.03}"/></linearGradient>
  <filter id="blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="22"/></filter>
</defs>
${rect(DEPTH + 26, p.shadow, 'filter="url(#blur)"')}
${rect(DEPTH, p.side)}
${rect(DEPTH, 'url(#side)')}
${rect(0, 'url(#frame)', `stroke="${p.rim}" stroke-width="2"`)}
<rect x="${A - 10}" y="${A - 10}" width="${B - A + 20}" height="${B - A + 20}" rx="16" fill="url(#face)"/>
<rect x="${A - 10}" y="${A - 10}" width="${B - A + 20}" height="${B - A + 20}" rx="16" fill="none" stroke="${p.groove}" stroke-width="2" opacity="0.5"/>
${rect(0, 'url(#sheen)')}
<rect x="${BOARD + 3}" y="${BOARD + 3}" width="${w - 6}" height="${w - 6}" rx="${RADIUS - 3}" fill="none" stroke="#ffffff" stroke-opacity="${theme === 'dark' ? 0.18 : 0.9}" stroke-width="2"/>
${style === 'south' ? south(p) : north(p)}
</svg>
`;
}
