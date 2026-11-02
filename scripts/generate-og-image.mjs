/**
 * Writes public/images/og-aiastra.png (1200x630), the Open Graph / Twitter / apple-touch image.
 * Run: node scripts/generate-og-image.mjs
 *
 * Renders an inline SVG in headless Chromium (Playwright is already a dev dependency), so no image library is needed.
 * The star and its gradient are copied from public/favicon.svg; change one, change the other.
 */
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'public/images/og-aiastra.png');

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#a78bfa"/>
      <stop offset="1" stop-color="#f472b6"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="#111827"/>
  <!-- the favicon's 64x64 star, scaled 6x -->
  <g transform="translate(120 123) scale(6)">
    <path fill="url(#g)" d="M32 8l5.8 15.9L54 30l-16.2 6.1L32 52l-5.8-15.9L10 30l16.2-6.1z"/>
  </g>
  <g font-family="Segoe UI, Helvetica, Arial, sans-serif" fill="#ffffff">
    <text x="540" y="290" font-size="112" font-weight="700">AI Astra</text>
    <text x="544" y="370" font-size="38" fill="#d1d5db">Vedic astrology readings</text>
    <text x="544" y="420" font-size="38" fill="#d1d5db">from your birth chart</text>
  </g>
  <rect x="544" y="460" width="160" height="6" rx="3" fill="url(#g)"/>
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
