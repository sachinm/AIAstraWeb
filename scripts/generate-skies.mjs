/**
 * Makes the home page scenes with a Gemini image model.
 *   GEMINI_API_KEY=... node scripts/generate-skies.mjs <outDir> [id id ...]
 * Skips a scene whose file exists, so a rerun only makes what is missing. Delete a file to redo that scene.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { SCENES, STYLE } from './skies/scenes.mjs';

const MODEL = process.env.SKY_MODEL || 'gemini-3-pro-image';
const CONCURRENCY = 3;

const [outDir, ...only] = process.argv.slice(2);
const key = process.env.GEMINI_API_KEY;
if (!outDir || !key) {
  console.error('usage: GEMINI_API_KEY=... node scripts/generate-skies.mjs <outDir> [id ...]');
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });

async function one(scene) {
  const file = join(outDir, `${scene.id}.png`);
  if (existsSync(file)) return 'kept';
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${scene.prompt}\n\n${STYLE}` }] }],
      generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '16:9', imageSize: '2K' } },
    }),
  });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
  const body = await res.json();
  const part = body.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!part) throw new Error(`no image: ${body.candidates?.[0]?.finishReason ?? 'unknown'}`);
  writeFileSync(file, Buffer.from(part.inlineData.data, 'base64'));
  return 'made';
}

const queue = SCENES.filter((s) => !only.length || only.includes(s.id));
let failed = 0;
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    for (let s = queue.shift(); s; s = queue.shift()) {
      for (let attempt = 1; ; attempt++) {
        try {
          console.log(s.id, await one(s));
          break;
        } catch (err) {
          if (attempt >= 3) {
            failed++;
            console.log(s.id, 'FAILED', err.message);
            break;
          }
        }
      }
    }
  })
);
console.log(`done, ${failed} failed`);
process.exit(failed ? 1 : 0);
