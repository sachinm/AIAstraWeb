/**
 * The art pipeline end to end: encrypt like scripts/encrypt-overlay-art.mjs (AES-GCM, `iv ‖ ciphertext ‖ tag`), serve
 * index, key and bytes through a fake fetch, and check the browser side decrypts, caches and degrades. Browser APIs only
 * (Web Crypto, Uint8Array): a clean CI install has no Node types for the typecheck.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { decryptArt, getOverlayArt, loadKey, pickStyle, resetOverlayArtForTests } from './overlayArt';

const PLAIN: Uint8Array = new Uint8Array(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>'));

const random = (n: number): Uint8Array => crypto.getRandomValues(new Uint8Array(n));
const toBase64 = (b: Uint8Array): string => btoa(String.fromCharCode(...b));
const same = (a: Uint8Array, b: Uint8Array): boolean => a.length === b.length && a.every((x, i) => x === b[i]);

/** jsdom's Blob has no arrayBuffer(); read it the way a browser of that age would. */
function bytesOf(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(new Uint8Array(r.result as ArrayBuffer));
    r.onerror = () => reject(r.error);
    r.readAsArrayBuffer(blob);
  });
}

/** Web Crypto's AES-GCM output is `ciphertext ‖ tag`; the build prepends the 12-byte iv. */
async function encrypt(plain: Uint8Array, rawKey: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['encrypt']);
  const iv = random(12);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv, 0);
  out.set(ct, iv.length);
  return out;
}

const KEY = random(32);

const manifest = {
  v: 'v1',
  f: [
    { s: 's', t: 1, m: 'image/svg+xml', p: '/_a/0a1b2c3d4e5f60718293.png' },
    { s: 'n', t: 0, m: 'image/svg+xml', p: '/_a/9f8e7d6c5b4a39281706.png' },
  ],
};

let calls: string[] = [];
let keyStatus = 200;
let enc: Uint8Array = new Uint8Array();

function fakeFetch(url: string): Promise<Response> {
  calls.push(url);
  if (url.endsWith('/_a/i.json')) return Promise.resolve(new Response(JSON.stringify(manifest), { status: 200 }));
  if (url.endsWith('/api/assets/overlay-key'))
    return Promise.resolve(new Response(JSON.stringify({ key: toBase64(KEY), version: 'v1' }), { status: keyStatus }));
  if (url.endsWith('.png')) return Promise.resolve(new Response(enc.slice(), { status: 200 }));
  return Promise.resolve(new Response('', { status: 404 }));
}

beforeEach(async () => {
  resetOverlayArtForTests();
  calls = [];
  keyStatus = 200;
  enc = await encrypt(PLAIN, KEY);
  vi.stubGlobal('fetch', vi.fn(fakeFetch));
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
    const blob = await decryptArt(key!, enc.slice().buffer, 'image/svg+xml');
    expect(blob?.type).toBe('image/svg+xml');
    expect(same(await bytesOf(blob!), PLAIN)).toBe(true);
  });

  it('fetches index, key and bytes once, keeps only the ciphertext, and decrypts again from its cache', async () => {
    const a = await getOverlayArt('south', 'dark');
    expect(a).not.toBeNull();
    expect(same(await bytesOf(a!), PLAIN)).toBe(true);
    // names on the wire say nothing about the chart
    expect(calls.filter((u) => !u.includes('/api/') && /south|north|dark|light|overlay/.test(u))).toEqual([]);
    expect(calls.filter((u) => u.endsWith('.png'))).toEqual(['/_a/0a1b2c3d4e5f60718293.png']);
    const b = await getOverlayArt('south', 'dark');
    expect(same(await bytesOf(b!), PLAIN)).toBe(true);
    expect(calls.filter((u) => u.endsWith('.png')).length).toBe(1);
    expect(calls.filter((u) => u.endsWith('overlay-key')).length).toBe(1);
  });

  it('falls back to the theme when the style is missing', async () => {
    expect(await getOverlayArt('north', 'dark')).not.toBeNull(); // only the south board exists for dark
    expect(calls.filter((u) => u.endsWith('.png'))).toEqual(['/_a/0a1b2c3d4e5f60718293.png']);
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
    enc = await encrypt(PLAIN, random(32));
    expect(await getOverlayArt('south', 'dark')).toBeNull();
  });

  it('picks a chart style at random', () => {
    expect(pickStyle(() => 0.1)).toBe('south');
    expect(pickStyle(() => 0.9)).toBe('north');
  });
});
