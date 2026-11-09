// Encrypts the loading veil's illustrations for the build (server docs/loading-overlay/01 §4.2, §5). Reads
// art/overlay/<style>-<theme>.<svg|webp|png|jpg> and, when OVERLAY_ART_KEY (64 hex chars = 32 bytes) is set, writes
// public/_a/<20 hex>.png as AES-256-GCM `iv(12) ‖ ciphertext ‖ tag(16)` (the layout Web Crypto reads) plus a compact index
// public/_a/i.json. File names are keyed hashes, so nothing on the wire names a chart, a style or a theme (Sachin,
// 2026-11-09: "encrypted and cryptically named"). The suffix is .png only because the hosting rewrite serves files with
// image suffixes as they are and turns unknown ones (.bin) into the app page; the bytes are opaque ciphertext. Without the key it removes public/_a and exits 0: the veil then shows
// an empty glass slab where the chart goes. The same key is served to signed-in sessions by the API (GET /api/assets/overlay-key).
import { createHash, randomBytes, createCipheriv } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = 'art/overlay';
const OUT = 'public/_a';
const LEGACY_OUT = 'public/overlay';
const TYPES = { svg: 'image/svg+xml', webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' };

/** Local dev: the key may sit in .env.local (gitignored) instead of the shell; the build env (Amplify) sets it. */
function keyFromDotEnv() {
  for (const f of ['.env.local', '.env']) {
    if (!existsSync(f)) continue;
    const m = /^OVERLAY_ART_KEY=\s*([0-9a-fA-F]{64})\s*$/m.exec(readFileSync(f, 'utf8'));
    if (m) return m[1];
  }
  return '';
}

const raw = (process.env.OVERLAY_ART_KEY || keyFromDotEnv()).trim();
if (!/^[0-9a-fA-F]{64}$/.test(raw)) {
  rmSync(OUT, { recursive: true, force: true });
  console.log('[overlay-art] OVERLAY_ART_KEY unset or not 64 hex chars; no encrypted art in this build (lines only)');
  process.exit(0);
}
const key = Buffer.from(raw, 'hex');

const files = existsSync(SRC)
  ? readdirSync(SRC)
      .map((f) => {
        const m = /^(south|north)-(light|dark)\.(svg|webp|png|jpe?g)$/i.exec(f);
        return m ? { file: f, style: m[1].toLowerCase(), theme: m[2].toLowerCase(), type: TYPES[m[3].toLowerCase()] } : null;
      })
      .filter(Boolean)
      .sort((a, b) => a.file.localeCompare(b.file))
  : [];

if (files.length === 0) {
  rmSync(OUT, { recursive: true, force: true });
  console.log(`[overlay-art] no illustrations in ${SRC}; run scripts/draw-overlay-placeholders.mjs or add the images`);
  process.exit(0);
}

// the version names the key and the bytes, so a rotation or a new drawing is a new URL and a cache miss
const h = createHash('sha256').update(key);
const plain = files.map((f) => ({ ...f, data: readFileSync(join(SRC, f.file)) }));
for (const f of plain) h.update(f.file).update(f.data);
const version = h.digest('hex').slice(0, 8);

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
rmSync(LEGACY_OUT, { recursive: true, force: true });
// compact index: v version; f files with s style initial, t 1 for dark, m media type, p path
const manifest = { v: version, f: [] };
for (const f of plain) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(f.data), cipher.final()]);
  const tag = cipher.getAuthTag();
  const out = `${createHash('sha256').update(key).update(version).update(f.file).digest('hex').slice(0, 20)}.png`;
  const bytes = Buffer.concat([iv, ct, tag]);
  writeFileSync(join(OUT, out), bytes);
  manifest.f.push({ s: f.style[0], t: f.theme === 'dark' ? 1 : 0, m: f.type, p: `/_a/${out}` });
}
writeFileSync(join(OUT, 'i.json'), JSON.stringify(manifest));
console.log(`[overlay-art] wrote ${plain.length} encrypted illustrations, version ${version}`);
