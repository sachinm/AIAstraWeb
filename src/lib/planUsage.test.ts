import { afterEach, describe, expect, it, vi } from 'vitest';
import { announceUsage, onUsage } from './planUsage';
import { fetchArea } from './areaApi';
import { fetchCareer } from './careerApi';

const USAGE = { code: 'free', desired_plan: 'free', desired_interval: null, is_paid: false, interval: null, used: 3, limit: 20, remaining: 17, window: 'month', resets_at: null, exempt: false };

afterEach(() => vi.unstubAllGlobals());

describe('a fresh board moves the question count (server docs/billing/02)', () => {
  it('passes on a plan status and ignores anything else', () => {
    const seen: unknown[] = [];
    const off = onUsage((u) => seen.push(u));
    announceUsage(USAGE);
    announceUsage(undefined);
    announceUsage({ nope: true });
    off();
    announceUsage(USAGE);
    expect(seen).toEqual([USAGE]);
  });

  it('the You/Love and Work clients announce the usage a board response carries', async () => {
    const seen: unknown[] = [];
    const off = onUsage((u) => seen.push(u));
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const body = String(url).includes('/career')
        ? { status: 'ok', map: { ahead: [] }, work: null, checks: {}, usage: { ...USAGE, used: 4 } }
        : { status: 'ok', board: { asOf: '2026-11-09' }, checks: {}, built_at: '2026-11-09', usage: USAGE };
      return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
    }));
    expect((await fetchArea('self')).kind).toBe('ok');
    expect((await fetchCareer()).kind).toBe('ok');
    off();
    expect(seen).toEqual([USAGE, { ...USAGE, used: 4 }]);
  });
});
