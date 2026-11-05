import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { _queued, _reset, flushEvents, restorePending, track } from './events';

let sent: Array<{ session: string; events: Array<{ event: string; target?: string }> }>;

beforeEach(() => {
  _reset();
  sent = [];
  localStorage.setItem('token', 't');
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) => {
      sent.push(JSON.parse(String(init.body)));
      return new Response(null, { status: 204 });
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  localStorage.clear();
});

describe('events', () => {
  it('queues and flushes with a session id', async () => {
    track('view_select', 'lucky', 'calendar');
    expect(_queued()).toHaveLength(1);
    await flushEvents();
    expect(sent[0]!.events[0]).toMatchObject({ event: 'view_select', target: 'calendar' });
    expect(sent[0]!.session).toBeTruthy();
  });
  it('flushes at 20 events without waiting', async () => {
    for (let i = 0; i < 20; i++) track('page_view', 'x');
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]!.events).toHaveLength(20);
  });
  it('flushes after 5 s', async () => {
    vi.useFakeTimers();
    track('page_view', 'x');
    expect(sent).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(5000);
    expect(sent).toHaveLength(1);
  });
  it('sends nothing when signed out', async () => {
    localStorage.clear();
    track('page_view', 'x');
    await flushEvents();
    expect(sent).toHaveLength(0);
  });
  it('cuts long targets', () => {
    track('page_view', 'x', 'y'.repeat(200));
    expect(_queued()[0]!.target).toHaveLength(80);
  });
  it('keeps unsent events across a page reload and sends them on the next load', async () => {
    track('scenario_add', 'lucky', 'work.sign_contract');
    window.dispatchEvent(new Event('pagehide'));
    expect(_queued()).toHaveLength(0);
    expect(sessionStorage.getItem('astra_events_pending')).toContain('scenario_add');
    restorePending();
    expect(_queued().map((e) => e.event)).toEqual(['scenario_add']);
    await flushEvents();
    expect(sent[0]!.events[0]!.event).toBe('scenario_add');
  });
});
