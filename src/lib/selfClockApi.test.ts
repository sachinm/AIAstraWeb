import { afterEach, describe, expect, it, vi } from 'vitest';
import { changeSelfV2Clock } from './selfClockApi';

function answer(status: number, body: unknown) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(body === null ? null : JSON.stringify(body), { status })));
}
afterEach(() => vi.unstubAllGlobals());

describe('the clock switch (PUT /api/self/v2/clock)', () => {
  it('clock: 202 carries the usage; 400 names the error', async () => {
    answer(202, { usage: { used: 4 }, status: 'building', alsoChanges: ['love', 'work'] });
    expect(await changeSelfV2Clock('yogini')).toEqual({ ok: true, usage: { used: 4 }, alsoChanges: ['love', 'work'] });
    answer(400, { error: 'unknown_system' });
    expect(await changeSelfV2Clock('nope')).toEqual({ ok: false, error: 'unknown_system' });
    answer(500, null);
    expect(await changeSelfV2Clock('yogini')).toEqual({ ok: false, error: 'failed' });
  });
  it('goes to the clock route with PUT', async () => {
    answer(202, { usage: null, alsoChanges: [] });
    await changeSelfV2Clock('yogini');
    const [url, init] = (fetch as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0]!;
    expect(String(url)).toMatch(/\/api\/self\/v2\/clock$/);
    expect(init.method).toBe('PUT');
    expect(JSON.parse(String(init.body))).toEqual({ system: 'yogini' });
  });
});
