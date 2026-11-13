/**
 * The Self board's cache (stale-while-revalidate, no reset on open). Three layers, none of them a source of truth: the
 * server's answer always replaces what is held here.
 *
 *  1. Memory: the last body and its ETag for this page load. Moving between boards and back draws the board at once.
 *  2. Disk: the same body in IndexedDB, encrypted with Web Crypto AES-GCM under a non-extractable key that lives in the
 *     same database, so a reload or a new tab draws the cards at once and refreshes them quietly. No reading text rests in
 *     the browser in plain form. A record older than 24 h is dropped, a record of another user or chart is replaced, and
 *     sign-out wipes the lot (`clearSelfV3Persisted`). Without IndexedDB or Web Crypto (private mode, tests) every disk
 *     call degrades silently to memory only; nothing here throws to a caller.
 *  3. Session: the active card and each card's selected period in sessionStorage, so a reload lands where the person was.
 *     sessionStorage is wiped by sign-out already (Auth/logout.ts clearAppStorage).
 */
import type { SelfV3Response } from './selfV3Api';

/** a disk record older than this is not used */
export const SELF_V3_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface SelfV3CacheEntry {
  data: SelfV3Response;
  etag: string | null;
}

export interface SelfV3Scope {
  userId: string;
  kundliId: string | null;
}

// ---------------------------------------------------------------------------------------------------------------------
// Memory
// ---------------------------------------------------------------------------------------------------------------------

let memory: SelfV3CacheEntry | null = null;

export function getSelfV3Cached(): SelfV3CacheEntry | null {
  return memory;
}

export function setSelfV3Cached(data: SelfV3Response, etag: string | null): void {
  memory = { data, etag };
}

export function clearSelfV3Cached(): void {
  memory = null;
}

/**
 * Which of two bodies the page should draw: the fresh one when there is one, else the cached one. A body whose ETag the
 * server confirmed (`notModified`) is the cached body itself, so the reference stays and nothing redraws.
 */
export function reconcile(cached: SelfV3Response | null | undefined, fresh: SelfV3Response | null | undefined): SelfV3Response | null {
  if (!fresh) return cached ?? null;
  if (!cached) return fresh;
  return fresh;
}

// ---------------------------------------------------------------------------------------------------------------------
// Disk (IndexedDB + AES-GCM)
// ---------------------------------------------------------------------------------------------------------------------

const DB_NAME = 'aiastra-selfv3';
const KEY_STORE = 'k';
const BOARD_STORE = 'b';
const KEY_ID = 'aes';
const IV_BYTES = 12;

/** the four calls the persistence needs; IndexedDB in a browser, a Map in tests */
export interface PersistBackend {
  get(store: string, key: string): Promise<unknown>;
  put(store: string, key: string, value: unknown): Promise<void>;
  del(store: string, key: string): Promise<void>;
  keys(store: string): Promise<string[]>;
  clear(): Promise<void>;
}

let backendOverride: PersistBackend | null | undefined;

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        for (const s of [KEY_STORE, BOARD_STORE]) if (!req.result.objectStoreNames.contains(s)) req.result.createObjectStore(s);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function request<T>(make: () => IDBRequest<T>): Promise<T | undefined> {
  return new Promise((resolve) => {
    try {
      const req = make();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

const idbBackend: PersistBackend = {
  async get(store, key) {
    const db = await openDb();
    if (!db) return undefined;
    try {
      return await request(() => db.transaction(store, 'readonly').objectStore(store).get(key));
    } finally {
      db.close();
    }
  },
  async put(store, key, value) {
    const db = await openDb();
    if (!db) return;
    try {
      await new Promise<void>((resolve) => {
        try {
          const tx = db.transaction(store, 'readwrite');
          tx.objectStore(store).put(value, key);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
          tx.onabort = () => resolve();
        } catch {
          resolve();
        }
      });
    } finally {
      db.close();
    }
  },
  async del(store, key) {
    const db = await openDb();
    if (!db) return;
    try {
      await request(() => db.transaction(store, 'readwrite').objectStore(store).delete(key));
    } finally {
      db.close();
    }
  },
  async keys(store) {
    const db = await openDb();
    if (!db) return [];
    try {
      const all = await request(() => db.transaction(store, 'readonly').objectStore(store).getAllKeys());
      return (all ?? []).map(String);
    } finally {
      db.close();
    }
  },
  async clear() {
    const db = await openDb();
    if (!db) return;
    try {
      for (const s of [KEY_STORE, BOARD_STORE]) await request(() => db.transaction(s, 'readwrite').objectStore(s).clear());
    } finally {
      db.close();
    }
  },
};

function backend(): PersistBackend | null {
  if (backendOverride !== undefined) return backendOverride;
  return typeof indexedDB === 'undefined' ? null : idbBackend;
}

function subtle(): SubtleCrypto | null {
  try {
    return globalThis.crypto?.subtle ?? null;
  } catch {
    return null;
  }
}

/** The one AES-GCM key, non-extractable, created on first use and kept in the same database. */
async function getKey(b: PersistBackend, s: SubtleCrypto, create: boolean): Promise<CryptoKey | null> {
  const held = await b.get(KEY_STORE, KEY_ID);
  if (held && typeof held === 'object' && 'type' in (held as object)) return held as CryptoKey;
  if (!create) return null;
  const key = await s.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  await b.put(KEY_STORE, KEY_ID, key);
  // another tab may have won the race; use what is stored so both tabs read each other's records
  const stored = await b.get(KEY_STORE, KEY_ID);
  return stored && typeof stored === 'object' && 'type' in (stored as object) ? (stored as CryptoKey) : key;
}

function recordId(scope: SelfV3Scope): string {
  return `${scope.userId}|${scope.kundliId ?? '-'}`;
}

interface DiskRecord {
  at: number;
  /** `iv(12) ‖ ciphertext ‖ tag(16)` of the JSON `{ data, etag }` */
  blob: ArrayBuffer;
}

/** The last board for this person and chart, or null (nothing stored, too old, other person, or no disk). */
export async function readSelfV3Persisted(scope: SelfV3Scope): Promise<SelfV3CacheEntry | null> {
  try {
    const b = backend();
    const s = subtle();
    if (!b || !s || !scope.userId) return null;
    const id = recordId(scope);
    const rec = (await b.get(BOARD_STORE, id)) as DiskRecord | undefined;
    if (!rec || typeof rec.at !== 'number' || !(rec.blob instanceof ArrayBuffer)) return null;
    if (Date.now() - rec.at > SELF_V3_MAX_AGE_MS || rec.blob.byteLength <= IV_BYTES + 16) {
      await b.del(BOARD_STORE, id);
      return null;
    }
    const key = await getKey(b, s, false);
    if (!key) return null;
    const iv = new Uint8Array(rec.blob, 0, IV_BYTES);
    const plain = await s.decrypt({ name: 'AES-GCM', iv }, key, new Uint8Array(rec.blob, IV_BYTES));
    const parsed = JSON.parse(new TextDecoder().decode(plain)) as Partial<SelfV3CacheEntry> | null;
    if (!parsed || typeof parsed !== 'object' || !parsed.data || typeof parsed.data !== 'object') return null;
    return { data: parsed.data, etag: typeof parsed.etag === 'string' ? parsed.etag : null };
  } catch {
    return null;
  }
}

/** Encrypt and store the board; any record of another person or chart goes. Silent when there is no disk. */
export async function writeSelfV3Persisted(scope: SelfV3Scope, data: SelfV3Response, etag: string | null): Promise<void> {
  try {
    const b = backend();
    const s = subtle();
    if (!b || !s || !scope.userId) return;
    const key = await getKey(b, s, true);
    if (!key) return;
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const ct = new Uint8Array(await s.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify({ data, etag }))));
    const blob = new Uint8Array(IV_BYTES + ct.length);
    blob.set(iv, 0);
    blob.set(ct, IV_BYTES);
    const id = recordId(scope);
    for (const other of await b.keys(BOARD_STORE)) if (other !== id) await b.del(BOARD_STORE, other);
    await b.put(BOARD_STORE, id, { at: Date.now(), blob: blob.buffer } satisfies DiskRecord);
  } catch {
    /* memory only */
  }
}

/** Sign-out: forget the board in memory and wipe the encrypted copy and its key. */
export async function clearSelfV3Persisted(): Promise<void> {
  clearSelfV3Cached();
  try {
    const b = backend();
    if (b) await b.clear();
  } catch {
    /* nothing was stored */
  }
}

/** Tests only: swap IndexedDB for another backend (`null`: no disk at all, `undefined`: the real one). */
export function setPersistBackendForTests(next: PersistBackend | null | undefined): void {
  backendOverride = next;
}

// ---------------------------------------------------------------------------------------------------------------------
// Session memory: where the person was (sessionStorage, wiped on sign-out)
// ---------------------------------------------------------------------------------------------------------------------

const ACTIVE_CARD_KEY = 'aa.selfv3.card';
const PERIOD_KEY_PREFIX = 'aa.selfv3.period.';

function session(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

export function getActiveCard(): string | null {
  try {
    return session()?.getItem(ACTIVE_CARD_KEY) || null;
  } catch {
    return null;
  }
}

export function setActiveCard(id: string): void {
  try {
    session()?.setItem(ACTIVE_CARD_KEY, id);
  } catch {
    /* storage unavailable */
  }
}

export function getActivePeriod(cardId: string): number | null {
  try {
    const raw = session()?.getItem(PERIOD_KEY_PREFIX + cardId);
    if (raw == null) return null;
    const n = Number(raw);
    return Number.isInteger(n) && n >= 0 ? n : null;
  } catch {
    return null;
  }
}

export function setActivePeriod(cardId: string, index: number): void {
  try {
    if (Number.isInteger(index) && index >= 0) session()?.setItem(PERIOD_KEY_PREFIX + cardId, String(index));
  } catch {
    /* storage unavailable */
  }
}
