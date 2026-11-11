/**
 * The card photos (server docs/reading-engine/71 §4.1; Sachin 2026-11-11). They never travel or rest as plain images:
 * the build packs each board's photos into one AES-GCM file with a keyed-hash name (scripts/encrypt-card-art.mjs), the
 * browser keeps only that ciphertext (IndexedDB, through the loading veil's cache), and a signed-in session decrypts it
 * in memory with the art key (GET /api/assets/overlay-key), once per board per page load.
 *
 * Cost: one request per board the first time, none after (cached ciphertext); one decrypt per board per page; each
 * photo is then a slice of the decrypted buffer behind an object URL, decoded by the browser like any small image.
 * Until the photos are ready, or when any step is missing, a card shows its drawn art. Nothing here throws.
 */
import { useEffect, useSyncExternalStore } from 'react';
import { cacheGet, cachePut, decryptArt, loadKey } from '../../lib/overlayArt';
import type { BoardKind } from './cardArtRegistry';

const INDEX_URL = '/_a/c.json';
const TIMEOUT_MS = 12_000;

const urls = new Map<string, string>();
const listeners = new Set<() => void>();
const loading = new Map<BoardKind, Promise<void>>();
let indexPromise: Promise<Record<string, string> | null> | null = null;

function emit() {
  for (const l of listeners) l();
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: c.signal });
  } finally {
    clearTimeout(t);
  }
}

function loadIndex(): Promise<Record<string, string> | null> {
  if (!indexPromise) {
    indexPromise = (async () => {
      try {
        const r = await fetchWithTimeout(INDEX_URL, { cache: 'no-cache' });
        if (!r.ok || !(r.headers.get('content-type') ?? '').includes('json')) return null;
        const j = (await r.json()) as { p?: Record<string, string> };
        return j && j.p && typeof j.p === 'object' ? j.p : null;
      } catch {
        return null;
      }
    })();
  }
  return indexPromise;
}

/** `u32 index length ‖ index JSON ‖ image bytes…` → one object URL per card id, sliced without copying */
export async function unpack(plain: Blob): Promise<Record<string, string>> {
  const buf =
    typeof plain.arrayBuffer === 'function'
      ? await plain.arrayBuffer()
      : await new Promise<ArrayBuffer>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result as ArrayBuffer);
          r.onerror = () => reject(r.error);
          r.readAsArrayBuffer(plain);
        });
  const len = new DataView(buf).getUint32(0);
  const map = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, len))) as Record<string, [number, number]>;
  const base = 4 + len;
  const out: Record<string, string> = {};
  for (const [id, [off, n]] of Object.entries(map)) out[id] = URL.createObjectURL(new Blob([new Uint8Array(buf, base + off, n)], { type: 'image/webp' }));
  return out;
}

/** Loads a board's photos once per page; later calls share the same promise. */
export function loadCardPhotos(board: BoardKind): Promise<void> {
  let p = loading.get(board);
  if (!p) {
    p = (async () => {
      try {
        const index = await loadIndex();
        const path = index?.[board[0]!];
        if (!path) return;
        const key = await loadKey();
        if (!key) return;
        const id = `cards:${path}`;
        let cipher = await cacheGet(id);
        let fresh = false;
        if (!cipher) {
          const r = await fetchWithTimeout(path, { cache: 'force-cache' });
          if (!r.ok) return;
          cipher = await r.arrayBuffer();
          fresh = true;
        }
        const plain = await decryptArt(key, cipher, 'application/octet-stream');
        if (!plain) return;
        if (fresh) void cachePut(id, cipher);
        for (const [k, v] of Object.entries(await unpack(plain))) urls.set(k, v);
        emit();
      } catch {
        /* the drawn art stays */
      }
    })();
    loading.set(board, p);
  }
  return p;
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** The card's photo URL once its board's pack is decrypted, else null (the drawn art shows). */
export function useCardPhoto(id: string): string | null {
  return useSyncExternalStore(subscribe, () => urls.get(id) ?? null, () => null);
}

/** Start loading a board's photos when a picker or the chips for it mount. */
export function useLoadCardPhotos(board: BoardKind): void {
  useEffect(() => {
    void loadCardPhotos(board);
  }, [board]);
}

/** Tests */
export function resetCardPhotosForTests(): void {
  for (const u of urls.values()) URL.revokeObjectURL?.(u);
  urls.clear();
  loading.clear();
  indexPromise = null;
}
