import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LayoutSaver, type SaverDeps } from './layoutSaver';
import type { LayoutPatch, LayoutPatchResult, SelfBoardLayoutView } from '../../../lib/selfV3Api';

const base = (): SelfBoardLayoutView => ({ template: 'seasons', cards: ['body', 'mind', 'stuck'], sections: {}, chosen: true, updatedAt: null, options: {}, boardOptions: {}, version: 1 });

type Sent = { p: LayoutPatch; version: number | undefined };

function harness(over: Partial<SaverDeps> = {}) {
  let stored = base();
  const sent: Sent[] = [];
  const puts: unknown[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const apply = (p: LayoutPatch): SelfBoardLayoutView => {
    if (p.kind === 'card') {
      const options = { ...(stored.options ?? {}) };
      if (Object.keys(p.options).length) options[p.id] = p.options;
      else delete options[p.id];
      return { ...stored, options };
    }
    if (p.kind === 'board') return { ...stored, boardOptions: p.boardOptions };
    return { ...stored, template: p.template, cards: p.cards, sections: p.sections };
  };
  const deps: SaverDeps = {
    patch: vi.fn(async (p: LayoutPatch, version: number | undefined): Promise<LayoutPatchResult> => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      sent.push({ p, version });
      await Promise.resolve();
      inFlight -= 1;
      if (version !== stored.version) return { ok: false, error: 'conflict' };
      stored = { ...apply(p), version: (stored.version ?? 0) + 1 };
      return { ok: true, layout: stored, queued: [] };
    }),
    put: vi.fn(async (body) => {
      puts.push(body);
      stored = { ...stored, ...(body as object), version: (stored.version ?? 0) + 1 } as SelfBoardLayoutView;
      return { ok: true, layout: stored, queued: [] } as LayoutPatchResult;
    }),
    refetch: vi.fn(async () => stored),
    refresh: vi.fn(async () => false),
    onLayout: vi.fn(),
    onProblem: vi.fn(),
    onSaved: vi.fn(),
    delay: 400,
    ...over,
  };
  const saver = new LayoutSaver(base(), deps);
  return {
    saver,
    deps,
    sent,
    puts,
    get stored() {
      return stored;
    },
    set stored(l: SelfBoardLayoutView) {
      stored = l;
    },
    maxInFlight: () => maxInFlight,
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('the layout save queue', () => {
  it('rapid changes to one card send one PATCH, 400 ms after the last, with the version', async () => {
    const h = harness();
    h.saver.changeCard('body', { face: 'light' });
    await vi.advanceTimersByTimeAsync(200);
    h.saver.changeCard('body', { face: 'read' });
    h.saver.changeCard('body', { face: 'light' });
    await vi.advanceTimersByTimeAsync(399);
    expect(h.sent).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(h.sent).toEqual([{ p: { kind: 'card', id: 'body', options: { face: 'light' } }, version: 1 }]);
    expect(h.puts).toHaveLength(0);
  });

  it('changes to several cards send one small PATCH each, never the whole layout, one at a time', async () => {
    const h = harness();
    h.saver.changeCard('body', { face: 'light' });
    h.saver.changeCard('mind', { face: 'light' });
    h.saver.changeBoard({ confirm: false });
    await vi.advanceTimersByTimeAsync(400);
    expect(h.sent.map((s) => s.p.kind)).toEqual(['board', 'card', 'card']);
    expect(h.sent.map((s) => s.version)).toEqual([1, 2, 3]);
    expect(h.maxInFlight()).toBe(1);
    expect(h.stored.options).toEqual({ body: { face: 'light' }, mind: { face: 'light' } });
  });

  it('Edit then Done while a card change waits never writes an older copy over the newer one', async () => {
    const h = harness();
    h.saver.changeCard('body', { face: 'light' });
    const done = h.saver.saveDeck({ template: 'seasons', cards: ['mind', 'body', 'stuck'], sections: {} });
    await vi.advanceTimersByTimeAsync(0);
    expect(await done).toBe(true);
    expect(h.stored.cards).toEqual(['mind', 'body', 'stuck']);
    expect(h.stored.options).toEqual({ body: { face: 'light' } });
    const deck = h.sent.find((s) => s.p.kind === 'deck')!.p;
    expect(deck).not.toHaveProperty('options');
  });

  it('a 409 reads the layout again and reapplies the pending change once', async () => {
    const h = harness();
    h.stored = { ...h.stored, options: { mind: { face: 'light' } }, version: 5 };
    h.saver.changeCard('body', { face: 'light' });
    await vi.advanceTimersByTimeAsync(400);
    expect(h.deps.refetch).toHaveBeenCalledTimes(1);
    expect(h.sent.map((s) => s.version)).toEqual([1, 5]);
    expect(h.stored.options).toEqual({ mind: { face: 'light' }, body: { face: 'light' } });
    expect(h.deps.onProblem).not.toHaveBeenCalled();
  });

  it('a 401 refreshes the session quietly and retries once', async () => {
    let first = true;
    const h = harness({ refresh: vi.fn(async () => true) });
    const real = h.deps.patch;
    h.deps.patch = vi.fn(async (p, v) => {
      if (first) {
        first = false;
        return { ok: false, error: 'unauthorized' } as LayoutPatchResult;
      }
      return real(p, v);
    });
    h.saver.changeCard('body', { face: 'light' });
    await vi.advanceTimersByTimeAsync(400);
    expect(h.deps.refresh).toHaveBeenCalledTimes(1);
    expect(h.stored.options).toEqual({ body: { face: 'light' } });
    expect(h.deps.onProblem).not.toHaveBeenCalled();
  });

  it('a 401 that the refresh cannot fix says the session ended and keeps the unsaved choice', async () => {
    const h = harness();
    h.deps.patch = vi.fn(async () => ({ ok: false, error: 'unauthorized' }) as LayoutPatchResult);
    h.saver.changeCard('body', { face: 'light' });
    await vi.advanceTimersByTimeAsync(400);
    expect(h.deps.onProblem).toHaveBeenCalledWith('session');
    expect(h.saver.view().options).toEqual({ body: { face: 'light' } });
    expect(h.saver.busy()).toBe(true);
    // signed in again: the waiting change goes out and the problem clears
    h.deps.patch = vi.fn(async () => ({ ok: true, layout: { ...base(), options: { body: { face: 'light' } }, version: 2 }, queued: [] }) as LayoutPatchResult);
    await h.saver.flush();
    expect(h.deps.onSaved).toHaveBeenCalled();
    expect(h.saver.busy()).toBe(false);
  });

  it('a refusal drops that change and the card goes back to what is saved', async () => {
    const h = harness();
    h.deps.patch = vi.fn(async () => ({ ok: false, error: 'unknown_option' }) as LayoutPatchResult);
    h.saver.changeCard('body', { face: 'light' });
    expect(h.saver.view().options).toEqual({ body: { face: 'light' } });
    await vi.advanceTimersByTimeAsync(400);
    expect(h.deps.onProblem).toHaveBeenCalledWith('unknown_option');
    expect(h.saver.view().options).toEqual({});
  });

  it('a server without the PATCH routes gets one PUT of the latest layout, and only PUTs after that', async () => {
    const h = harness();
    h.deps.patch = vi.fn(async () => ({ ok: false, error: 'unsupported' }) as LayoutPatchResult);
    h.saver.changeCard('body', { face: 'light' });
    h.saver.changeCard('mind', { face: 'light' });
    await vi.advanceTimersByTimeAsync(400);
    expect(h.deps.patch).toHaveBeenCalledTimes(1);
    expect(h.puts).toHaveLength(1);
    expect(h.puts[0]).toMatchObject({ cards: ['body', 'mind', 'stuck'], options: { body: { face: 'light' }, mind: { face: 'light' } }, version: 1 });
    h.saver.changeCard('stuck', { face: 'light' });
    await vi.advanceTimersByTimeAsync(400);
    expect(h.deps.patch).toHaveBeenCalledTimes(1);
    expect(h.puts).toHaveLength(2);
  });

  it('a board read again does not overwrite a change on its way', async () => {
    const h = harness();
    h.saver.changeCard('body', { face: 'light' });
    h.saver.serverLayout({ ...base(), options: {} });
    expect(h.saver.view().options).toEqual({ body: { face: 'light' } });
  });
});
