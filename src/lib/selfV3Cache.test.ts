/**
 * The Self board cache: memory, the encrypted disk copy (through an in-memory backend, since jsdom has no IndexedDB),
 * session memory, and how fetchSelfV3 uses the held ETag (200, 304, 503 retry, abort, optimistic saves).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SELF_V3_MAX_AGE_MS,
  clearSelfV3Cached,
  clearSelfV3Persisted,
  getActiveCard,
  getActivePeriod,
  getSelfV3Cached,
  readSelfV3Persisted,
  reconcile,
  setActiveCard,
  setActivePeriod,
  setPersistBackendForTests,
  setSelfV3Cached,
  writeSelfV3Persisted,
  type PersistBackend,
} from './selfV3Cache';
import { fetchSelfV3, putSelfV3Layout, saveLayoutOptimistic, SelfV3FetchError, type SelfBoardLayoutView, type SelfV3Response } from './selfV3Api';
import { COLD_BOARD_DEFAULTS } from './cardOptions';

const board = (marker = 'a'): SelfV3Response =>
  ({
    status: 'ok',
    builtAt: marker,
    readVersion: 'v3',
    clock: 'vimshottari',
    profile: {},
    refresh: {},
    build: {},
    quality: null,
    layout: { template: 'seasons', cards: ['body', 'mind', 'mood'], sections: {}, chosen: true, updatedAt: null, options: {}, boardOptions: {}, boardDefaults: COLD_BOARD_DEFAULTS },
    cards: [],
    reading: null,
  }) as unknown as SelfV3Response;

function mapBackend(): PersistBackend & { stores: Map<string, Map<string, unknown>> } {
  const stores = new Map<string, Map<string, unknown>>();
  const of = (s: string) => {
    if (!stores.has(s)) stores.set(s, new Map());
    return stores.get(s)!;
  };
  return {
    stores,
    get: async (s, k) => of(s).get(k),
    put: async (s, k, v) => void of(s).set(k, v),
    del: async (s, k) => void of(s).delete(k),
    keys: async (s) => [...of(s).keys()],
    clear: async () => stores.clear(),
  };
}

const SCOPE = { userId: 'u1', kundliId: 'k1' };

beforeEach(() => {
  clearSelfV3Cached();
  sessionStorage.clear();
  setPersistBackendForTests(undefined);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  setPersistBackendForTests(undefined);
});

describe('memory cache', () => {
  it('holds the last body and tag, and forgets on clear', () => {
    expect(getSelfV3Cached()).toBeNull();
    const b = board();
    setSelfV3Cached(b, '"t1"');
    expect(getSelfV3Cached()).toEqual({ data: b, etag: '"t1"' });
    clearSelfV3Cached();
    expect(getSelfV3Cached()).toBeNull();
  });
  it('reconcile prefers the fresh body, else the cached one', () => {
    const a = board('a');
    const b = board('b');
    expect(reconcile(a, b)).toBe(b);
    expect(reconcile(a, null)).toBe(a);
    expect(reconcile(null, b)).toBe(b);
    expect(reconcile(null, null)).toBeNull();
  });
});

describe('disk cache', () => {
  it('round-trips encrypted, and the stored bytes hold no plain text', async () => {
    const be = mapBackend();
    setPersistBackendForTests(be);
    await writeSelfV3Persisted(SCOPE, board('secret-marker'), '"t9"');
    const raw = be.stores.get('b')!.get('u1|k1') as { blob: ArrayBuffer };
    expect(new TextDecoder().decode(new Uint8Array(raw.blob))).not.toContain('secret-marker');
    const key = be.stores.get('k')!.get('aes') as CryptoKey;
    expect(key.extractable).toBe(false);
    const got = await readSelfV3Persisted(SCOPE);
    expect(got?.etag).toBe('"t9"');
    expect(got?.data.builtAt).toBe('secret-marker');
  });
  it('another user or chart reads nothing, and writing replaces the other record', async () => {
    const be = mapBackend();
    setPersistBackendForTests(be);
    await writeSelfV3Persisted(SCOPE, board(), null);
    expect(await readSelfV3Persisted({ userId: 'u2', kundliId: 'k1' })).toBeNull();
    await writeSelfV3Persisted({ userId: 'u2', kundliId: null }, board('two'), null);
    expect([...be.stores.get('b')!.keys()]).toEqual(['u2|-']);
    expect(await readSelfV3Persisted(SCOPE)).toBeNull();
  });
  it('a record older than 24 hours is dropped', async () => {
    const be = mapBackend();
    setPersistBackendForTests(be);
    await writeSelfV3Persisted(SCOPE, board(), null);
    const rec = be.stores.get('b')!.get('u1|k1') as { at: number };
    rec.at = Date.now() - SELF_V3_MAX_AGE_MS - 1000;
    expect(await readSelfV3Persisted(SCOPE)).toBeNull();
    expect(be.stores.get('b')!.size).toBe(0);
  });
  it('sign-out wipes the disk copy, its key and the memory copy', async () => {
    const be = mapBackend();
    setPersistBackendForTests(be);
    setSelfV3Cached(board(), '"x"');
    await writeSelfV3Persisted(SCOPE, board(), null);
    await clearSelfV3Persisted();
    expect(getSelfV3Cached()).toBeNull();
    expect(be.stores.size).toBe(0);
    expect(await readSelfV3Persisted(SCOPE)).toBeNull();
  });
  it('degrades silently with no disk', async () => {
    setPersistBackendForTests(null);
    await expect(writeSelfV3Persisted(SCOPE, board(), null)).resolves.toBeUndefined();
    await expect(readSelfV3Persisted(SCOPE)).resolves.toBeNull();
    await expect(clearSelfV3Persisted()).resolves.toBeUndefined();
  });
  it('degrades silently with the real backend when jsdom has no IndexedDB', async () => {
    await expect(writeSelfV3Persisted(SCOPE, board(), null)).resolves.toBeUndefined();
    await expect(readSelfV3Persisted(SCOPE)).resolves.toBeNull();
  });
  it('a corrupt record reads as nothing', async () => {
    const be = mapBackend();
    setPersistBackendForTests(be);
    await writeSelfV3Persisted(SCOPE, board(), null);
    const rec = be.stores.get('b')!.get('u1|k1') as { blob: ArrayBuffer };
    new Uint8Array(rec.blob)[20] ^= 0xff;
    expect(await readSelfV3Persisted(SCOPE)).toBeNull();
  });
});

describe('session memory', () => {
  it('remembers the active card and each card\'s period', () => {
    expect(getActiveCard()).toBeNull();
    expect(getActivePeriod('body')).toBeNull();
    setActiveCard('mind');
    setActivePeriod('mind', 2);
    setActivePeriod('body', 0);
    expect(getActiveCard()).toBe('mind');
    expect(getActivePeriod('mind')).toBe(2);
    expect(getActivePeriod('body')).toBe(0);
    setActivePeriod('mind', -1);
    expect(getActivePeriod('mind')).toBe(2);
  });
  it('ignores a damaged period value', () => {
    sessionStorage.setItem('aa.selfv3.period.body', 'x');
    expect(getActivePeriod('body')).toBeNull();
  });
});

function reply(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(body === null ? null : JSON.stringify(body), { status, headers });
}

describe('fetchSelfV3', () => {
  it('stores body and tag on a 200, then sends If-None-Match and returns the cached body on a 304', async () => {
    const first = board('a');
    const fetchMock = vi.fn().mockResolvedValueOnce(reply(200, first, { ETag: '"v1"' })).mockResolvedValueOnce(new Response(null, { status: 304 }));
    vi.stubGlobal('fetch', fetchMock);
    const a = await fetchSelfV3();
    expect(a.notModified).toBe(false);
    expect(a.data.builtAt).toBe('a');
    expect(getSelfV3Cached()?.etag).toBe('"v1"');
    expect((fetchMock.mock.calls[0]![1] as RequestInit).headers).not.toHaveProperty('If-None-Match');

    const b = await fetchSelfV3();
    expect(b.notModified).toBe(true);
    expect(b.data).toBe(getSelfV3Cached()!.data);
    expect((fetchMock.mock.calls[1]![1] as RequestInit).headers).toMatchObject({ 'If-None-Match': '"v1"' });
  });
  it('a changed board replaces the cache with its new tag', async () => {
    setSelfV3Cached(board('a'), '"v1"');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(200, board('b'), { ETag: '"v2"' })));
    const r = await fetchSelfV3();
    expect(r.notModified).toBe(false);
    expect(getSelfV3Cached()).toMatchObject({ etag: '"v2"' });
    expect(getSelfV3Cached()!.data.builtAt).toBe('b');
  });
  it('a 304 with nothing held asks again without a tag', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(null, { status: 304 })).mockResolvedValueOnce(reply(200, board('a'), { ETag: '"v1"' }));
    vi.stubGlobal('fetch', fetchMock);
    clearSelfV3Cached();
    const r = await fetchSelfV3();
    expect(r.notModified).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('retries once after a 503 Retry-After, then shows preparing', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(reply(503, { error: 'timeout' }, { 'Retry-After': '0' }))
      .mockResolvedValueOnce(reply(200, board('a'), { ETag: '"v1"' }));
    vi.stubGlobal('fetch', fetchMock);
    expect((await fetchSelfV3()).data.builtAt).toBe('a');
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const again = vi.fn().mockResolvedValue(reply(503, { error: 'timeout' }, { 'Retry-After': '0' }));
    vi.stubGlobal('fetch', again);
    await expect(fetchSelfV3()).rejects.toMatchObject({ state: { kind: 'preparing' } });
    expect(again).toHaveBeenCalledTimes(2);
  });
  it('does not hold a pending board', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(200, { ...board('a'), status: 'pending' }, { ETag: '"p"' })));
    await fetchSelfV3();
    expect(getSelfV3Cached()).toBeNull();
  });
  it('rejects with the page state when there is no board', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(404, { error: 'no_kundli' })));
    await expect(fetchSelfV3()).rejects.toBeInstanceOf(SelfV3FetchError);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(404, null)));
    await expect(fetchSelfV3()).rejects.toMatchObject({ state: { kind: 'v2' } });
  });
  it('an aborted request rejects with AbortError', async () => {
    const c = new AbortController();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => {
        c.abort();
        return Promise.reject(Object.assign(new Error('x'), { name: 'AbortError' }));
      }),
    );
    await expect(fetchSelfV3({ signal: c.signal })).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('optimistic saves', () => {
  const current = board().layout as SelfBoardLayoutView;

  it('shows the patch at once and resolves with the server layout', async () => {
    const saved = { ...current, options: { body: { face: 'light' as const } }, updatedAt: 'now' };
    const send = vi.fn().mockResolvedValue(saved);
    const { optimistic, done } = saveLayoutOptimistic({ current, patch: { options: { body: { face: 'light' } } }, send });
    expect(optimistic.options).toEqual({ body: { face: 'light' } });
    expect(optimistic.cards).toEqual(current.cards);
    expect(send).toHaveBeenCalledWith({ template: 'seasons', cards: current.cards, sections: {}, options: { body: { face: 'light' } }, boardOptions: {} });
    await expect(done).resolves.toBe(saved);
  });
  it('board options replace the stored ones, and cards that left lose their options', async () => {
    const withOpts: SelfBoardLayoutView = { ...current, options: { body: { view: 'now' }, mood: { plan: 'without' } } };
    const send = vi.fn().mockResolvedValue(withOpts);
    const { optimistic } = saveLayoutOptimistic({ current: withOpts, patch: { cards: ['body', 'mind'], boardOptions: { motion: false } }, send });
    expect(optimistic.cards).toEqual(['body', 'mind']);
    expect(optimistic.options).toEqual({ body: { view: 'now' } });
    expect(optimistic.boardOptions).toEqual({ motion: false });
  });
  it('rejects when the save fails so the caller can roll back', async () => {
    const send = vi.fn().mockRejectedValue(new Error('nope'));
    const { optimistic, done } = saveLayoutOptimistic({ current, patch: { boardOptions: { confirm: false } }, send });
    expect(optimistic.boardOptions).toEqual({ confirm: false });
    await expect(done).rejects.toThrow('nope');
    expect(current.boardOptions).toEqual({});
  });
  it('putSelfV3Layout rejects with the server code and updates the cached layout on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(reply(400, { error: 'unknown_option', detail: 'x' })));
    await expect(putSelfV3Layout({ template: 'seasons', cards: ['body', 'mind', 'mood'] })).rejects.toMatchObject({ code: 'unknown_option' });

    setSelfV3Cached(board('a'), '"v1"');
    const saved = { ...current, boardOptions: { motion: false }, updatedAt: 'later' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(reply(200, saved)));
    await putSelfV3Layout({ template: 'seasons', cards: ['body', 'mind', 'mood'], boardOptions: { motion: false } });
    expect(getSelfV3Cached()?.etag).toBeNull();
    expect(getSelfV3Cached()?.data.layout.boardOptions).toEqual({ motion: false });
  });
});
