/**
 * The art pipeline end to end in Node: encrypt like scripts/encrypt-overlay-art.mjs, serve manifest, key and bytes
 * through a fake fetch, and check the browser side decrypts, caches and degrades.
 */
import { createCipheriv, randomBytes, webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { decryptArt, getOverlayArt, loadKey, pickStyle, resetOverlayArtForTests } from './overlayArt';

const KEY = randomBytes(32);

/** jsdom's Blob has no arrayBuffer(); read it the way a browser of that age would. */
function bytesOf(blob: Blob): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(Buffer.from(r.result as ArrayBuffer));
    r.onerror = () => reject(r.error);
    r.readAsArrayBuffer(blob);
  });
}
const PLAIN = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');

function encrypt(plain: Buffer, key: Buffer): Buffer {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([c.update(plain), c.final()]);
  return Buffer.concat([iv, ct, c.getAuthTag()]);
}

const manifest = {
  v: 'v1',
  f: [
    { s: 's', t: 1, m: 'image/svg+xml', p: '/_a/0a1b2c3d4e5f60718293.bin' },
    { s: 'n', t: 0, m: 'image/svg+xml', p: '/_a/9f8e7d6c5b4a39281706.bin' },
  ],
};

let calls: string[] = [];
let keyStatus = 200;
let enc = encrypt(PLAIN, KEY);

function fakeFetch(url: string): Promise<Response> {
  calls.push(url);
  if (url.endsWith('/_a/i.json')) return Promise.resolve(new Response(JSON.stringify(manifest), { status: 200 }));
  if (url.endsWith('/api/assets/overlay-key'))
    return Promise.resolve(new Response(JSON.stringify({ key: KEY.toString('base64'), version: 'v1' }), { status: keyStatus }));
  if (url.endsWith('.bin')) return Promise.resolve(new Response(new Uint8Array(enc), { status: 200 }));
  return Promise.resolve(new Response('', { status: 404 }));
}

beforeEach(() => {
  resetOverlayArtForTests();
  calls = [];
  keyStatus = 200;
  enc = encrypt(PLAIN, KEY);
  vi.stubGlobal('fetch', vi.fn(fakeFetch));
  if (!globalThis.crypto?.subtle) vi.stubGlobal('crypto', webcrypto);
  localStorage.setItem('token', 'jwt');
});
afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('overlay art', () => {
  it('decrypts the build layout iv ‖ ciphertext ‖ tag', async () => {
    const key = await loadKey();
    expect(key).not.toBeNull();
    const blob = await decryptArt(key!, enc.buffer.slice(enc.byteOffset, enc.byteOffset + enc.byteLength) as ArrayBuffer, 'image/svg+xml');
    expect(blob?.type).toBe('image/svg+xml');
    expect((await bytesOf(blob!)).equals(PLAIN)).toBe(true);
  });

  it('fetches manifest, key and bytes once, keeps only the ciphertext, and decrypts again from its cache', async () => {
    const a = await getOverlayArt('south', 'dark');
    expect(a).not.toBeNull();
    expect((await bytesOf(a!)).equals(PLAIN)).toBe(true);
    // names on the wire say nothing about the chart
    expect(calls.filter((u) => !u.includes('/api/') && /south|north|dark|light|overlay/.test(u))).toEqual([]);
    expect(calls.filter((u) => u.endsWith('.bin'))).toEqual(['/_a/0a1b2c3d4e5f60718293.bin']);
    const b = await getOverlayArt('south', 'dark');
    expect((await bytesOf(b!)).equals(PLAIN)).toBe(true);
    expect(calls.filter((u) => u.endsWith('.bin')).length).toBe(1);
    expect(calls.filter((u) => u.endsWith('overlay-key')).length).toBe(1);
  });

  it('falls back to the theme when the style is missing, and to null when the theme is', async () => {
    expect(await getOverlayArt('north', 'dark')).not.toBeNull(); // only south-dark exists for dark
    expect(calls.filter((u) => u.endsWith('.bin'))).toEqual(['/_a/0a1b2c3d4e5f60718293.bin']);
  });

  it('is null, never a throw, when signed out, when the key is not configured, or when the tag is wrong', async () => {
    localStorage.removeItem('token');
    expect(await getOverlayArt('south', 'dark')).toBeNull();
    expect(calls.some((u) => u.endsWith('overlay-key'))).toBe(false);

    resetOverlayArtForTests();
    localStorage.setItem('token', 'jwt');
    keyStatus = 404;
    expect(await getOverlayArt('south', 'dark')).toBeNull();

    resetOverlayArtForTests();
    keyStatus = 200;
    enc = encrypt(PLAIN, randomBytes(32));
    expect(await getOverlayArt('south', 'dark')).toBeNull();
  });

  it('picks a chart style at random', () => {
    expect(pickStyle(() => 0.1)).toBe('south');
    expect(pickStyle(() => 0.9)).toBe('north');
  });
});
