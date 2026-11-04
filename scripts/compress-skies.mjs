/**
 * Turns the generated PNGs into 1920-wide WebP files for public/skies, using Playwright's Chromium canvas.
 *   node scripts/compress-skies.mjs <inDir> <outDir> [--force]
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { chromium } from 'playwright';

const WIDTH = 1920;
const QUALITY = 0.72;

const [inDir, outDir] = process.argv.slice(2);
const force = process.argv.includes('--force');
if (!inDir || !outDir) {
  console.error('usage: node scripts/compress-skies.mjs <inDir> <outDir>');
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
let total = 0;
for (const name of readdirSync(inDir).filter((f) => f.endsWith('.png'))) {
  const target = join(outDir, `${basename(name, '.png')}.webp`);
  if (existsSync(target) && !force) continue;
  // a fresh page each time: one long-lived page stalled part way through the set
  const page = await browser.newPage();
  page.setDefaultTimeout(60_000);
  const src = `data:image/png;base64,${readFileSync(join(inDir, name)).toString('base64')}`;
  const url = await page.evaluate(
    async ({ src, width, quality }) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      // the model sometimes adds cinema bars: find rows that are almost pure black at the top and bottom, and crop them
      const probe = document.createElement('canvas');
      probe.width = img.naturalWidth;
      probe.height = img.naturalHeight;
      const ctx = probe.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const isBar = (y) => {
        const d = ctx.getImageData(0, y, probe.width, 1).data;
        let sum = 0;
        for (let i = 0; i < d.length; i += 4) sum += d[i] + d[i + 1] + d[i + 2];
        return sum / (probe.width * 3) < 6;
      };
      const limit = Math.floor(probe.height * 0.25);
      let top = 0;
      while (top < limit && isBar(top)) top++;
      let bottom = 0;
      while (bottom < limit && isBar(probe.height - 1 - bottom)) bottom++;
      // a few rows further in, so no soft edge of the bar remains
      if (top) top += 6;
      if (bottom) bottom += 6;
      const h = probe.height - top - bottom;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = Math.round((h / probe.width) * width);
      const out = canvas.getContext('2d');
      out.drawImage(probe, 0, top, probe.width, h, 0, 0, canvas.width, canvas.height);
      // burned in, so a saved copy carries the name: one in the corner, one low in the centre that survives a phone crop
      out.fillStyle = 'rgba(255, 255, 255, 0.34)';
      out.shadowColor = 'rgba(0, 0, 0, 0.6)';
      out.shadowBlur = 4;
      out.font = '600 24px Georgia, serif';
      out.textAlign = 'right';
      out.fillText('AdAstra AI', canvas.width - 28, canvas.height - 26);
      out.textAlign = 'center';
      out.fillStyle = 'rgba(255, 255, 255, 0.24)';
      out.fillText('AdAstra AI', canvas.width / 2, Math.round(canvas.height * 0.78));
      return canvas.toDataURL('image/webp', quality);
    },
    { src, width: WIDTH, quality: QUALITY }
  );
  await page.close();
  const out = Buffer.from(url.split(',')[1], 'base64');
  writeFileSync(target, out);
  total += out.length;
  console.log(name, Math.round(out.length / 1024), 'KB');
}
await browser.close();
console.log('total', Math.round(total / 1024), 'KB');
