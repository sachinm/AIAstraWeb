// Draws the four placeholder illustrations for the loading veil (server docs/loading-overlay/01 §7 step 3) into
// art/overlay/: an empty South or North Indian house chart, houses numbered 1..12 from the first house, with the nine
// grahas and twelve rashis lined up beside the board like chess pieces and the 27 nakshatras named along the bottom.
// No planet sits in a house. These stand in until the Nano Banana illustrations replace them (03-image-prompts.md);
// the encrypt step (encrypt-overlay-art.mjs) treats both the same.
import { mkdirSync, writeFileSync } from 'node:fs';

const W = 1400;
const H = 900;

const PALETTE = {
  dark: { line: 'rgba(216,180,254,0.95)', soft: 'rgba(216,180,254,0.45)', text: 'rgba(237,233,254,0.95)', glyph: 'rgba(253,230,138,0.95)' },
  light: { line: 'rgba(76,29,149,0.9)', soft: 'rgba(76,29,149,0.4)', text: 'rgba(49,46,129,0.95)', glyph: 'rgba(180,83,9,0.95)' },
};

const GRAHAS = ['☉', '☽', '♂', '☿', '♃', '♀', '♄', '☊', '☋'];
const RASHIS = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'];
const NAKSHATRAS = [
  'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra', 'Punarvasu', 'Pushya', 'Ashlesha',
  'Magha', 'Purva Phalguni', 'Uttara Phalguni', 'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha',
  'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha', 'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati',
];

const FONT = "font-family=\"'Iowan Old Style','Palatino Linotype','Book Antiqua',Georgia,serif\"";

function pieces(p) {
  // the grahas down the left, the rashis down the right, like two ranks beside a board
  const left = GRAHAS.map((g, i) => `<text x="150" y="${250 + i * 48}" text-anchor="middle" font-size="40" fill="${p.glyph}" ${FONT}>${g}</text>`).join('');
  const right = RASHIS.map((r, i) => `<text x="1250" y="${215 + i * 42}" text-anchor="middle" font-size="34" fill="${p.text}" ${FONT}>${r}</text>`).join('');
  const row1 = NAKSHATRAS.slice(0, 14).join('  ·  ');
  const row2 = NAKSHATRAS.slice(14).join('  ·  ');
  const bottom =
    `<text x="700" y="828" text-anchor="middle" font-size="19" fill="${p.soft}" ${FONT}>${row1}</text>` +
    `<text x="700" y="860" text-anchor="middle" font-size="19" fill="${p.soft}" ${FONT}>${row2}</text>`;
  return left + right + bottom;
}

function south(p) {
  // a 4×4 grid, the middle 2×2 open; houses run clockwise from the top row's second cell
  const x0 = 400;
  const y0 = 170;
  const cell = 150;
  const lines = [];
  for (let i = 0; i <= 4; i++) {
    lines.push(`<line x1="${x0}" y1="${y0 + i * cell}" x2="${x0 + 4 * cell}" y2="${y0 + i * cell}" />`);
    lines.push(`<line x1="${x0 + i * cell}" y1="${y0}" x2="${x0 + i * cell}" y2="${y0 + 4 * cell}" />`);
  }
  // hide the inner cross so the centre is one open square
  const inner = `<rect x="${x0 + cell + 2}" y="${y0 + cell + 2}" width="${2 * cell - 4}" height="${2 * cell - 4}" fill="transparent" stroke="none" />`;
  const order = [
    [1, 0], [2, 0], [3, 0], [3, 1], [3, 2], [3, 3], [2, 3], [1, 3], [0, 3], [0, 2], [0, 1], [0, 0],
  ];
  const numbers = order
    .map(([cx, cy], i) => `<text x="${x0 + cx * cell + cell / 2}" y="${y0 + cy * cell + cell / 2 + 12}" text-anchor="middle" font-size="36" fill="${p.text}" ${FONT}>${i + 1}</text>`)
    .join('');
  return `<g stroke="${p.line}" stroke-width="3" fill="none">${lines.join('')}</g>` +
    `<rect x="${x0 + cell + 1.5}" y="${y0 + cell + 1.5}" width="${2 * cell - 3}" height="${2 * cell - 3}" fill="none" stroke="${p.line}" stroke-width="3" />` +
    `<g>${inner}</g>` + numbers;
}

function north(p) {
  // a square, its two diagonals, and the diamond joining the midpoints; the first house is the top diamond
  const x0 = 400;
  const y0 = 170;
  const s = 600;
  const cx = x0 + s / 2;
  const cy = y0 + s / 2;
  const shape =
    `<rect x="${x0}" y="${y0}" width="${s}" height="${s}" />` +
    `<line x1="${x0}" y1="${y0}" x2="${x0 + s}" y2="${y0 + s}" />` +
    `<line x1="${x0 + s}" y1="${y0}" x2="${x0}" y2="${y0 + s}" />` +
    `<polygon points="${cx},${y0} ${x0 + s},${cy} ${cx},${y0 + s} ${x0},${cy}" />`;
  const q = s / 4;
  const spots = [
    [cx, cy - q], // 1
    [cx - q, y0 + q * 0.45], // 2
    [x0 + q * 0.45, cy - q], // 3
    [cx - q, cy], // 4
    [x0 + q * 0.45, cy + q], // 5
    [cx - q, y0 + s - q * 0.45], // 6
    [cx, cy + q], // 7
    [cx + q, y0 + s - q * 0.45], // 8
    [x0 + s - q * 0.45, cy + q], // 9
    [cx + q, cy], // 10
    [x0 + s - q * 0.45, cy - q], // 11
    [cx + q, y0 + q * 0.45], // 12
  ];
  const numbers = spots
    .map(([x, y], i) => `<text x="${x}" y="${y + 12}" text-anchor="middle" font-size="36" fill="${p.text}" ${FONT}>${i + 1}</text>`)
    .join('');
  return `<g stroke="${p.line}" stroke-width="3" fill="none">${shape}</g>` + numbers;
}

function svg(style, theme) {
  const p = PALETTE[theme];
  const board = style === 'south' ? south(p) : north(p);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="An empty ${style === 'south' ? 'South' : 'North'} Indian house chart">
<title>Empty ${style === 'south' ? 'South' : 'North'} Indian chart</title>
${board}
${pieces(p)}
</svg>
`;
}

mkdirSync('art/overlay', { recursive: true });
for (const style of ['south', 'north']) {
  for (const theme of ['light', 'dark']) {
    const file = `art/overlay/${style}-${theme}.svg`;
    writeFileSync(file, svg(style, theme));
    console.log(`[overlay-art] wrote ${file}`);
  }
}
