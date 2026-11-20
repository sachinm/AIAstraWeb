import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { refreshBoard } from './boardRefresh';

let last: { url: string; init: RequestInit } | null;
let answer: { status: number; body: unknown };

beforeEach(() => {
  last = null;
  localStorage.setItem('token', 't');
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      last = { url: String(url), init };
      return new Response(answer.body === undefined ? null : JSON.stringify(answer.body), { status: answer.status });
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('refreshBoard', () => {
  it('Love and Work send the lens on screen; Self sends no body', async () => {
    answer = { status: 200, body: { status: 'queued', lens: 'dating', first: true, charged: false, queued: [] } };
    const r = await refreshBoard('love', { lens: 'dating' });
    expect(last!.url).toMatch(/\/api\/boards\/love\/refresh$/);
    expect(JSON.parse(String(last!.init.body))).toEqual({ lens: 'dating' });
    expect(r).toEqual({ kind: 'made', usage: null, lens: 'dating', first: true, charged: false });

    answer = { status: 202, body: { status: 'building' } };
    expect(await refreshBoard('self', { lens: 'dating' })).toEqual({ kind: 'building', usage: null });
    expect(last!.init.body).toBeUndefined();
  });

  it('a repeat and a counted refresh say so', async () => {
    answer = { status: 200, body: { status: 'queued', lens: 'marriage', repeat: true, charged: false } };
    expect(await refreshBoard('love', { lens: 'marriage' })).toMatchObject({ kind: 'made', repeat: true, charged: false });
    answer = { status: 200, body: { status: 'queued', lens: 'business', charged: true } };
    expect(await refreshBoard('work', { lens: 'business' })).toMatchObject({ kind: 'made', charged: true });
  });

  it('409 not_ready is its own answer; 409 not_due keeps its date; other errors are errors', async () => {
    answer = { status: 409, body: { error: 'not_ready', code: 'not_ready', lens: 'dating' } };
    expect(await refreshBoard('love', { lens: 'dating' })).toEqual({ kind: 'not_ready' });
    answer = { status: 409, body: { error: 'not_due', code: 'not_due', valid_until: '2026-12-05' } };
    expect(await refreshBoard('love')).toEqual({ kind: 'not_due', validUntil: '2026-12-05' });
    // a build already running for the board: the page waits for it as for its own
    answer = { status: 409, body: { error: 'building', code: 'building' } };
    expect(await refreshBoard('self')).toEqual({ kind: 'building', usage: null });
    answer = { status: 400, body: { error: 'unknown_lens', code: 'unknown_lens' } };
    expect(await refreshBoard('love', { lens: 'nope' })).toEqual({ kind: 'error' });
  });
});
