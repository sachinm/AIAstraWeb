/**
 * The loading veil's illustrations (server docs/loading-overlay/01 §4.3). Four drawings of an empty house chart
 * (South or North Indian, light or dark) ship on the web origin as AES-GCM ciphertext made at build time
 * (scripts/encrypt-overlay-art.mjs). A signed-in session fetches the key once from the API, decrypts in the browser
 * with Web Crypto in memory on every show. IndexedDB keeps only the ciphertext, so nothing readable is stored in the
 * browser; the files on the wire carry keyed-hash names under /_a/ (Sachin, 2026-11-09).
 *
 * Every step degrades to `null`: the veil then shows its lines alone. Nothing here throws to a caller.
 */
import { buildApiHeaders } from './apiHeaders';

export type ArtStyle = 'south' | 'north';
export type ArtTheme = 'light' | 'dark';

export interface ArtManifest {
  version: string;
  files: Array<{ name: string; style: ArtStyle; theme: ArtTheme; path: string; type: string; bytes: number }>;
}

interface KeyResponse {
  key: string;
  version: string;
}

const MANIFEST_URL = '/_a/i.json';
const KEY_TIMEOUT_MS = 8_000;
const ART_TIMEOUT_MS = 10_000;
const DB_NAME = 'aiastra-overlay';
const STORE = 'art';
const IV_BYTES = 12;

/** Memoised per page load; a failure is remembered too, so one broken step costs one request, not one per veil. */
let manifestPromise: Promise<ArtManifest | null> | null = null;
let keyPromise: Promise<CryptoKey | null> | null = null;
/** For a browser without IndexedDB (private mode, tests): the ciphertext for this page only. */
const memoryCache = new Map<string, ArrayBuffer>();

function apiBase(): string {
  const base = (import.meta.env.VITE_API_BASE || import.meta.env.VITE_GRAPHQL_BASE || '') as string;
  return base.replace(/\/+$/, '');
}

function token(): string | null {
  try {
    return typeof window === 'undefined' ? null : localStorage.getItem('token');
  } catch {
    return null;
  }
}

function subtle(): SubtleCrypto | null {
  try {
    return globalThis.crypto?.subtle ?? null;
  } catch {
    return null;
  }
}

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

export async function loadManifest(): Promise<ArtManifest | null> {
  if (!manifestPromise) {
    manifestPromise = (async () => {
      try {
        const res = await fetchWithTimeout(MANIFEST_URL, { cache: 'default' }, KEY_TIMEOUT_MS);
        if (!res.ok) return null;
        // the compact index the build writes: v version; f files with s style initial, t 1 for dark, m type, p path
        const raw = (await res.json()) as { v?: unknown; f?: Array<{ s: string; t: number; m: string; p: string }> };
        if (!raw || typeof raw.v !== 'string' || !Array.isArray(raw.f)) return null;
        return {
          version: raw.v,
          files: raw.f.map((e) => ({
            name: e.p,
            style: e.s === 'n' ? 'north' : 'south',
            theme: e.t === 1 ? 'dark' : 'light',
            path: e.p,
            type: e.m,
            bytes: 0,
          })),
        };
      } catch {
        return null;
      }
    })();
  }
  return manifestPromise;
}

/** The art key for this session, imported for AES-GCM decrypt only. Null when signed out or not configured. */
export async function loadKey(): Promise<CryptoKey | null> {
  if (!keyPromise) {
    keyPromise = (async () => {
      const s = subtle();
      const jwt = token();
      if (!s || !jwt) return null;
      try {
        const headers = await buildApiHeaders({ token: jwt, method: 'GET' });
        delete headers['Content-Type'];
        const res = await fetchWithTimeout(`${apiBase()}/api/assets/overlay-key`, { headers, cache: 'no-store' }, KEY_TIMEOUT_MS);
        if (!res.ok) return null;
        const body = (await res.json()) as KeyResponse;
        const raw = Uint8Array.from(atob(body.key), (c) => c.charCodeAt(0));
        if (raw.byteLength !== 32) return null;
        return await s.importKey('raw', raw, { name: 'AES-GCM' }, false, ['decrypt']);
      } catch {
        return null;
      }
    })();
  }
  return keyPromise;
}

/** `iv(12) ‖ ciphertext ‖ tag(16)`, the layout Web Crypto produces and consumes. */
export async function decryptArt(key: CryptoKey, payload: ArrayBuffer, type: string): Promise<Blob | null> {
  const s = subtle();
  if (!s || payload.byteLength <= IV_BYTES + 16) return null;
  try {
    const iv = new Uint8Array(payload, 0, IV_BYTES);
    const body = new Uint8Array(payload, IV_BYTES);
    const plain = await s.decrypt({ name: 'AES-GCM', iv }, key, body);
    return new Blob([plain], { type });
  } catch {
    return null;
  }
}

// ---- IndexedDB (one store of Blobs; a Map when it is missing) ----------------------------------------------------

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function cacheGet(id: string): Promise<ArrayBuffer | null> {
  if (memoryCache.has(id)) return memoryCache.get(id)!;
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(id);
      req.onsuccess = () => resolve(req.result instanceof ArrayBuffer ? req.result : null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function cachePut(id: string, cipher: ArrayBuffer): Promise<void> {
  memoryCache.set(id, cipher);
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(cipher, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

// ---- public -------------------------------------------------------------------------------------------------------

export function pickStyle(random: () => number = Math.random): ArtStyle {
  return random() < 0.5 ? 'south' : 'north';
}

/**
 * The plain image for a style and theme as a Blob, from the cache or the wire, or null when any step is unavailable.
 * The caller makes (and revokes) an object URL.
 */
export async function getOverlayArt(style: ArtStyle, theme: ArtTheme): Promise<Blob | null> {
  try {
    const manifest = await loadManifest();
    if (!manifest) return null;
    const file = manifest.files.find((f) => f.style === style && f.theme === theme) ?? manifest.files.find((f) => f.theme === theme);
    if (!file) return null;
    const key = await loadKey();
    if (!key) return null;
    const id = `${file.name}@${manifest.version}`;
    let cipher = await cacheGet(id);
    if (!cipher) {
      const res = await fetchWithTimeout(file.path, { cache: 'force-cache' }, ART_TIMEOUT_MS);
      if (!res.ok) return null;
      cipher = await res.arrayBuffer();
      const blob = await decryptArt(key, cipher, file.type);
      if (!blob) return null;
      void cachePut(id, cipher);
      return blob;
    }
    return await decryptArt(key, cipher, file.type);
  } catch {
    return null;
  }
}

/** Tests: forget the memoised manifest, key and in-memory blobs. */
export function resetOverlayArtForTests(): void {
  manifestPromise = null;
  keyPromise = null;
  memoryCache.clear();
}
