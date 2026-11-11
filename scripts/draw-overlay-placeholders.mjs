// Draws the loading veil's four chart illustrations (server docs/loading-overlay/01 §7 step 3; Sachin 2026-11-09: "the
// house chart should be 3D", "3D glassmorphism, rounded curved 3D borders") into art/overlay/. Each of the twelve houses
// is its own raised glass tile: rounded corners, an extruded side, a soft shadow, a rim and a top-left sheen, with the
// house numeral embossed on it, 1..12 from the first house. No planet sits in a house. The background is transparent so
// the chart floats on the veil's own glass. The grahas and rashis are drawn by the veil as 3D tiles beside the chart
// (src/components/LoadingVeil.tsx). Every numeral is exact because it is code, not a model's guess.
import { mkdirSync, writeFileSync } from 'node:fs';
import { chartSvg } from '../src/lib/chartBoard.js';

mkdirSync('art/overlay', { recursive: true });
for (const style of ['south', 'north']) {
  for (const theme of ['light', 'dark']) {
    const file = `art/overlay/${style}-${theme}.svg`;
    writeFileSync(file, chartSvg(style, theme));
    console.log(`[overlay-art] wrote ${file}`);
  }
}
