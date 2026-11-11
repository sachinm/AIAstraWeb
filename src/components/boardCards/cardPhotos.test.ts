/**
 * Card photos end to end (server docs/reading-engine/71 §4.1): a pack built like scripts/encrypt-card-art.mjs
 * (`u32 len ‖ index ‖ images`, AES-GCM `iv ‖ ciphertext ‖ tag`) is fetched once, its ciphertext cached, decrypted in
 * memory and split into one URL per card. Without the key, or signed out, nothing shows and nothing throws.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetOverlayArtForTests } from '../../lib/overlayArt';
import { loadCardPhotos, resetCardPhotosForTests, unpack } from './cardPhotos';

const random = (n: number): Uint8Array => crypto.getRandomValues(new Uint8Array(n));
const toBase64 = (b: Uint8Array): string => btoa(String.fromCharCode(...b));
const KEY = random(32);
const PACK_PATH = '/_a/aaaaaaaaaaaaaaaaaaaa.png';

function pack(images: Record<string, Uint8Array>): Uint8Array {
  const map: Record<string, [number, number]> = {};
  let off = 0;
  for (const [id, b] of Object.entries(images)) {
    map[id] = [off, b.length];
    off += b.length;
  }
  const head = new TextEncoder().encode(JSON.stringify(map));
  const out = new Uint8Array(4 + head.length + off);
  new DataView(out.buffer).setUint32(0, head.length);
  out.set(head, 4);
  let at = 4 + head.length;
  for (const b of Object.values(images)) {
    out.set(b, at);
    at += b.length;
  }
  return out;
}

async function encrypt(plain: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', KEY, { name: 'AES-GCM' }, false, ['encrypt']);
  const iv = random(12);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain));
  const out = new Uint8Array(12 + ct.length);
  out.set(iv);
  out.set(ct, 12);
  return out;
}

let calls: string[] = [];
let enc = new Uint8Array();
let made: string[] = [];

beforeEach(async () => {
  resetOverlayArtForTests();
  resetCardPhotosForTests();
  calls = [];
  made = [];
  localStorage.setItem('token', 't');
  enc = await encrypt(pack({ body: new Uint8Array([1, 2, 3]), sleep: new Uint8Array([4, 5]) }));
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: (b: Blob) => (made.push(String(b.size)), `blob:${made.length}`), revokeObjectURL: () => {} }));
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      calls.push(url);
      if (url.endsWith('/_a/c.json')) return new Response(JSON.stringify({ p: { s: PACK_PATH } }), { status: 200, headers: { 'content-type': 'application/json' } });
      if (url.endsWith('/api/assets/overlay-key')) return new Response(JSON.stringify({ key: toBase64(KEY), version: 'v1' }), { status: 200 });
      if (url === PACK_PATH) return new Response(enc.slice(), { status: 200 });
      return new Response('', { status: 404 });
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('card photos', () => {
  it('unpacks one URL per card, each the size of its image', async () => {
    const urls = await unpack(new Blob([pack({ a: new Uint8Array(7), b: new Uint8Array(3) })]));
    expect(Object.keys(urls)).toEqual(['a', 'b']);
    expect(made).toEqual(['7', '3']);
  });

  it('one request for the index, the key and the board pack; a second board call reuses it', async () => {
    await loadCardPhotos('self');
    await loadCardPhotos('self');
    expect(calls.filter((c) => c === PACK_PATH)).toHaveLength(1);
    expect(made).toEqual(['3', '2']);
  });

  it('the wire never names a card: only the opaque pack path is fetched', async () => {
    await loadCardPhotos('self');
    for (const c of calls) expect(c).not.toMatch(/body|sleep|webp/);
  });

  it('a wrong key shows nothing and does not throw', async () => {
    enc = await encrypt(new Uint8Array([9]));
    enc[enc.length - 1] ^= 0xff;
    await expect(loadCardPhotos('self')).resolves.toBeUndefined();
    expect(made).toEqual([]);
  });

  it('signed out: no key, no pack request', async () => {
    localStorage.removeItem('token');
    await loadCardPhotos('love');
    expect(calls.some((c) => c.endsWith('.png'))).toBe(false);
  });
});
