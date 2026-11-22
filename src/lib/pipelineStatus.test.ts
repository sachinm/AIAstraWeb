/**
 * The reading gate's client side (server prep gate): the `pipeline` block, the 409 `preparing` refusal on every call
 * that starts a reading, and the 409 `building` answer that is no longer an error.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { onPipelineAnnounced, pipelineLocked, readPipeline, refusedPipeline, type PipelineView } from './pipelineStatus';
import { refreshBoard } from './boardRefresh';
import { patchSelfV3Layout, putSelfV3LayoutResult, readSelfV3Card, fetchSelfV3State } from './selfV3Api';
import { changeSelfV2Clock, fetchSelfV2 } from './selfV2Api';
import { clearSelfV3Cached, getSelfV3Cached } from './selfV3Cache';
import { selfV3Fixture } from '../pages/you/v3/selfV3.fixture';

const LOCKED: PipelineView = { stage: 'pulling', done: 1, total: 4, line: 'Getting your chart', locked: true, reason: 'chart' };
const refused = (status = 409, extra: Record<string, unknown> = {}) => new Response(JSON.stringify({ error: 'Still preparing', code: 'preparing', pipeline: LOCKED, ...extra }), { status });

let answer: () => Response;
let seen: PipelineView[];
let off: () => void;

beforeEach(() => {
  localStorage.setItem('token', 't');
  clearSelfV3Cached();
  seen = [];
  off = onPipelineAnnounced((p) => seen.push(p));
  answer = () => refused();
  vi.stubGlobal('fetch', vi.fn(async () => answer()));
});
afterEach(() => {
  off();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('the pipeline block', () => {
  it('reads a block, and treats absent or malformed as open', () => {
    expect(readPipeline(LOCKED)).toEqual(LOCKED);
    expect(readPipeline(undefined)).toBeNull();
    expect(readPipeline({ stage: 'ready' })).toBeNull();
    expect(pipelineLocked(readPipeline(undefined))).toBe(false);
    expect(readPipeline({ locked: true, stage: 'odd', done: -1, total: 'x' })).toEqual({ stage: 'preparing', done: 0, total: 0, line: '', locked: true, reason: null });
  });

  it('a refusal is only a 409 with code preparing; one with no block is still locked', () => {
    expect(refusedPipeline(409, { code: 'preparing', pipeline: LOCKED })).toEqual(LOCKED);
    expect(refusedPipeline(409, { code: 'preparing' })?.locked).toBe(true);
    expect(refusedPipeline(409, { code: 'not_due' })).toBeNull();
    expect(refusedPipeline(409, { error: 'stale_layout' })).toBeNull();
    expect(refusedPipeline(400, { code: 'preparing' })).toBeNull();
  });
});

describe('refreshBoard', () => {
  it('409 preparing is the locked state with its pipeline, announced, not an error', async () => {
    expect(await refreshBoard('self')).toEqual({ kind: 'preparing', pipeline: LOCKED });
    expect(seen).toEqual([LOCKED]);
  });

  it('409 building is "busy", not an error', async () => {
    answer = () => new Response(JSON.stringify({ error: 'A build is running', code: 'building' }), { status: 409 });
    expect(await refreshBoard('love')).toEqual({ kind: 'busy', pipeline: null });
    answer = () => new Response(JSON.stringify({ error: 'x', code: 'building', pipeline: LOCKED }), { status: 409 });
    expect(await refreshBoard('love')).toEqual({ kind: 'busy', pipeline: LOCKED });
  });

  it('other answers are unchanged', async () => {
    answer = () => new Response(JSON.stringify({ code: 'not_due', valid_until: '2026-12-05' }), { status: 409 });
    expect(await refreshBoard('self')).toEqual({ kind: 'not_due', validUntil: '2026-12-05' });
    answer = () => new Response(JSON.stringify({ error: 'boom' }), { status: 500 });
    expect(await refreshBoard('self')).toEqual({ kind: 'error' });
    expect(seen).toEqual([]);
  });
});

describe('the other starts', () => {
  it('a card read refused: preparing, announced', async () => {
    expect(await readSelfV3Card('body')).toEqual({ ok: false, status: 409, error: 'preparing' });
    expect(seen).toHaveLength(1);
    answer = () => new Response(JSON.stringify({ error: 'already_reading' }), { status: 409 });
    expect(await readSelfV3Card('body')).toEqual({ ok: false, status: 409, error: 'already_reading' });
  });

  it('a layout save refused is not a stale-layout conflict; one the server stored anyway is a save', async () => {
    expect(await patchSelfV3Layout({ kind: 'board', boardOptions: { motion: false } }, 3)).toEqual({ ok: false, error: 'preparing' });
    expect(await putSelfV3LayoutResult({ template: 'seasons', cards: ['body'], sections: {} }, 'love')).toEqual({ ok: false, error: 'preparing' });
    const layout = { template: 'seasons', cards: ['body', 'mind', 'stuck'], sections: {}, chosen: true, updatedAt: null };
    answer = () => refused(409, { layout });
    const r = await patchSelfV3Layout({ kind: 'deck', template: 'seasons', cards: ['body', 'mind', 'stuck'], sections: {} }, 3);
    expect(r).toEqual({ ok: true, layout, queued: [] });
    answer = () => new Response(JSON.stringify({ error: 'stale_layout' }), { status: 409 });
    expect(await patchSelfV3Layout({ kind: 'board', boardOptions: {} }, 3)).toEqual({ ok: false, error: 'conflict' });
  });

  it('a clock change refused: preparing, announced', async () => {
    expect(await changeSelfV2Clock('short')).toEqual({ ok: false, error: 'preparing' });
    expect(seen).toHaveLength(1);
  });
});

describe('the board GETs carry the block', () => {
  it('v3: on the board; a locked board is held without its tag', async () => {
    answer = () => new Response(JSON.stringify({ ...selfV3Fixture(), pipeline: LOCKED }), { status: 200, headers: { ETag: '"t1"' } });
    const { state } = await fetchSelfV3State();
    expect(state.kind === 'ok' && state.board.pipeline).toEqual(LOCKED);
    expect(getSelfV3Cached()?.etag).toBeNull();
    answer = () => new Response(JSON.stringify({ ...selfV3Fixture(), pipeline: { ...LOCKED, locked: false, stage: 'ready' } }), { status: 200, headers: { ETag: '"t2"' } });
    await fetchSelfV3State();
    expect(getSelfV3Cached()?.etag).toBe('"t2"');
  });

  it('v3 and v2: a preparing answer without a board keeps the block for its line', async () => {
    answer = () => new Response(JSON.stringify({ status: 'preparing', pipeline: LOCKED }), { status: 202 });
    expect((await fetchSelfV3State()).state).toEqual({ kind: 'preparing', pipeline: LOCKED });
    expect(await fetchSelfV2()).toEqual({ kind: 'preparing', pipeline: LOCKED });
    answer = () => new Response(JSON.stringify({ status: 'preparing' }), { status: 202 });
    expect(await fetchSelfV2()).toEqual({ kind: 'preparing' });
  });
});
