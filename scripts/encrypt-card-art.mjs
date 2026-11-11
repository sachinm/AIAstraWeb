// Encrypts the card photos for the build (server docs/reading-engine/71 §4.1; Sachin 2026-11-11: "encrypt these images
// and scramble their names and cache them in the client's browser"). Reads art/cards/<card id>.webp and writes one
// encrypted pack per board (self, love, work) to public/_a/<20 hex>.png, plus a compact index public/_a/c.json.
//
// A pack's plain bytes are `u32 index length ‖ index JSON ‖ image bytes…`, the index mapping card id → [offset, length];
// the whole pack is AES-256-GCM `iv(12) ‖ ciphertext ‖ tag(16)` under OVERLAY_ART_KEY, the same key the loading veil uses
// (served to signed-in sessions by GET /api/assets/overlay-key). So the wire carries three opaque files with keyed-hash
// names: no card id, board or image type is visible, and one request and one decrypt serve a whole board.
// Without the key it writes nothing and exits 0: the cards then show their drawn art.
import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = 'art/cards';
const OUT = 'public/_a';
const INDEX = join(OUT, 'c.json');

function keyFromDotEnv() {
  for (const f of ['.env.local', '.env']) {
    if (!existsSync(f)) continue;
    const m = /^OVERLAY_ART_KEY=\s*([0-9a-fA-F]{64})\s*$/m.exec(readFileSync(f, 'utf8'));
    if (m) return m[1];
  }
  return '';
}

/** the board a card or group banner belongs to, from its id */
export function boardOf(id) {
  const g = id.startsWith('group-') ? id.slice(6) : id;
  if (g.startsWith('love_') || ['bond', 'meeting', 'circle'].includes(g)) return 'love';
  if (g.startsWith('work_') || ['standing', 'money', 'growth'].includes(g)) return 'work';
  return 'self';
}

const raw = (process.env.OVERLAY_ART_KEY || keyFromDotEnv()).trim();
const files = existsSync(SRC) ? readdirSync(SRC).filter((f) => /^[a-z_-]+\.webp$/.test(f)).sort() : [];
rmSync(INDEX, { force: true });
if (!/^[0-9a-fA-F]{64}$/.test(raw) || files.length === 0) {
  console.log('[card-art] OVERLAY_ART_KEY unset or no photos; the cards show their drawn art');
  process.exit(0);
}
const key = Buffer.from(raw, 'hex');
mkdirSync(OUT, { recursive: true });

const packs = { self: [], love: [], work: [] };
for (const f of files) packs[boardOf(f.replace(/\.webp$/, ''))].push(f);

const index = { p: {} };
for (const [board, list] of Object.entries(packs)) {
  if (!list.length) continue;
  const parts = [];
  const map = {};
  let offset = 0;
  for (const f of list) {
    const data = readFileSync(join(SRC, f));
    map[f.replace(/\.webp$/, '')] = [offset, data.length];
    parts.push(data);
    offset += data.length;
  }
  const head = Buffer.from(JSON.stringify(map));
  const len = Buffer.alloc(4);
  len.writeUInt32BE(head.length);
  const plain = Buffer.concat([len, head, ...parts]);
  // the name names the key, the board and the bytes: a new photo or a rotated key is a new URL and a cache miss
  const name = createHash('sha256').update(key).update(board).update(plain).digest('hex').slice(0, 20);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const out = Buffer.concat([iv, cipher.update(plain), cipher.final(), cipher.getAuthTag()]);
  writeFileSync(join(OUT, `${name}.png`), out);
  // the index says only which opaque file serves which board, by a single letter
  index.p[board[0]] = `/_a/${name}.png`;
  console.log(`[card-art] ${board}: ${list.length} photos, ${Math.round(out.length / 1024)} KB encrypted`);
}
writeFileSync(INDEX, JSON.stringify(index));
