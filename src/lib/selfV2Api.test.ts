import { afterEach, describe, expect, it, vi } from 'vitest';
import { changeSelfV2Clock, fetchSelfV2, selfV2Enabled, sendSelfV2Confirm, sendSelfV2Mood } from './selfV2Api';
import { selfV2Fixture } from '../pages/you/v2/selfV2.fixture';

function answer(status: number, body: unknown) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(body === null ? null : JSON.stringify(body), { status })));
}
afterEach(() => vi.unstubAllGlobals());

describe('selfV2Enabled', () => {
  it('is on with VITE_SELF_V2=1 or ?v2=1, off otherwise', () => {
    expect(selfV2Enabled('', '1')).toBe(true);
    expect(selfV2Enabled('?v2=1', undefined)).toBe(true);
    expect(selfV2Enabled('?x=2&v2=1', '0')).toBe(true);
    expect(selfV2Enabled('?v2=0', undefined)).toBe(false);
    expect(selfV2Enabled('', undefined)).toBe(false);
  });
});

describe('fetchSelfV2', () => {
  it('reads a board, pending or ok', async () => {
    answer(200, selfV2Fixture());
    const s = await fetchSelfV2();
    expect(s.kind).toBe('ok');
    // the final-integration fields come through as sent
    if (s.kind === 'ok') {
      expect(s.board.subChapterEnds).toBe('2027-01-01');
      expect(s.board.hero?.supporting).toEqual(['stuck', 'chapter']);
      expect(s.board.profile.role).toBe('public');
      expect(s.board.areas.find((a) => a.id === 'year')?.rangeLabel).toBe('This year: 9 Sep 2026 – 9 Sep 2027');
      expect(s.board.areas.find((a) => a.id === 'lagna')?.range).toBe('always');
    }
    answer(202, selfV2Fixture((b) => (b.status = 'pending')));
    const p = await fetchSelfV2();
    expect(p.kind === 'ok' && p.board.status).toBe('pending');
  });
  it('maps preparing, no_kundli, gateway waits and errors', async () => {
    answer(202, { status: 'preparing' });
    expect((await fetchSelfV2()).kind).toBe('preparing');
    answer(504, null);
    expect((await fetchSelfV2()).kind).toBe('preparing');
    answer(404, { status: 'no_kundli' });
    expect((await fetchSelfV2()).kind).toBe('no_kundli');
    answer(200, { status: 'no_kundli' });
    expect((await fetchSelfV2()).kind).toBe('no_kundli');
    answer(404, { error: 'not_found' });
    expect((await fetchSelfV2()).kind).toBe('unavailable');
    answer(500, { error: 'x' });
    expect((await fetchSelfV2()).kind).toBe('error');
  });
});

describe('the writes', () => {
  it('clock: 202 carries the usage; 400 names the error', async () => {
    answer(202, { usage: { used: 4 }, status: 'building', alsoChanges: ['love', 'work'] });
    expect(await changeSelfV2Clock('yogini')).toEqual({ ok: true, usage: { used: 4 }, alsoChanges: ['love', 'work'] });
    answer(400, { error: 'unknown_system' });
    expect(await changeSelfV2Clock('nope')).toEqual({ ok: false, error: 'unknown_system' });
    answer(500, null);
    expect(await changeSelfV2Clock('yogini')).toEqual({ ok: false, error: 'failed' });
  });
  it('confirm and mood are true on 204', async () => {
    answer(204, null);
    expect(await sendSelfV2Confirm('c1', 'yes')).toBe(true);
    expect(await sendSelfV2Mood('fine')).toBe(true);
    answer(500, null);
    expect(await sendSelfV2Confirm('c1', 'no')).toBe(false);
  });
});
