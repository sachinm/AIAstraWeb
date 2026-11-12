/**
 * Writes public/images/og-aiastra.png (1200x630), the Open Graph / Twitter / apple-touch image.
 * Run: node scripts/generate-og-image.mjs
 *
 * Renders an inline SVG in headless Chromium (Playwright is already a dev dependency), so no image library is needed.
 * The logo is public/images/logo-512.png, the same picture as the favicon; change that file and run this again.
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'public/images/og-aiastra.png');
const logo = readFileSync(resolve(root, 'public/images/logo-512.png')).toString('base64');

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#a78bfa"/>
      <stop offset="1" stop-color="#f472b6"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="#111827"/>
  <image href="data:image/png;base64,${logo}" x="90" y="115" width="400" height="400"/>
  <g font-family="Segoe UI, Helvetica, Arial, sans-serif" fill="#ffffff">
    <text x="540" y="290" font-size="112" font-weight="700">AdAstra AI</text>
    <text x="544" y="375" font-size="38" fill="#d1d5db">Your Personal Vedic Astrologer</text>
  </g>
  <rect x="544" y="420" width="160" height="6" rx="3" fill="url(#g)"/>
</svg>`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.setContent(`<body style="margin:0">${svg}</body>`);
  mkdirSync(dirname(out), { recursive: true });
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 1200, height: 630 } });
} finally {
  await browser.close();
}
console.log(`wrote ${out}`);
