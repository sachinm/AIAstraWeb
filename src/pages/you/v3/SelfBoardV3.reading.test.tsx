/**
 * Doc 70 Phase 3 on the Self board v3: a reading per card. Per-card states, the board's reading line, the clock
 * agreement per span, the clocks in Chart details and the 2 s polling while a card is queued or reading.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import SelfBoardV3, { READING_POLL_MS, readingLine } from './SelfBoardV3';
import { selfV3Fixture, selfV3Reading } from './selfV3.fixture';
import { V3_WORDS } from './words';
import { clearSelfV3Cached } from '../../../lib/selfV3Cache';
import type { CardReadState, SelfCardId, SelfV3Response } from '../../../lib/selfV3Api';

const plan = vi.hoisted(() => ({ setPlan: vi.fn(), refreshPlan: vi.fn(async () => {}) }));
vi.mock('../../../Auth/ProfileGate', () => ({ usePlan: () => ({ plan: null, setPlan: plan.setPlan, refreshPlan: plan.refreshPlan }) }));

type Call = { method: string; url: string };
let calls: Call[];
let v3Body: () => SelfV3Response;
let readStatus: number;
let readBody: unknown;

const json = (b: unknown) => JSON.stringify(b);

beforeEach(() => {
  clearSelfV3Cached();
  sessionStorage.clear();
  localStorage.setItem('token', 't');
  Object.defineProperty(window, 'innerWidth', { value: 1180, configurable: true, writable: true });
  Object.defineProperty(window, 'innerHeight', { value: 820, configurable: true, writable: true });
  calls = [];
  v3Body = () => selfV3Reading();
  readStatus = 202;
  readBody = { state: 'queued' };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const method = (init.method ?? 'GET').toUpperCase();
      const u = String(url);
      calls.push({ method, url: u });
      if (u.endsWith('/api/self/v3') && method === 'GET') return new Response(json(v3Body()), { status: 200 });
      if (/\/api\/self\/v3\/cards\/[^/]+\/read$/.test(u) && method === 'POST') return new Response(json(readBody), { status: readStatus });
      if (u.endsWith('/api/self/v3/layout') && method === 'PUT') {
        const body = JSON.parse(String(init.body));
        return new Response(json({ ...body, chosen: true, updatedAt: '2026-11-10T09:00:00Z' }), { status: 200 });
      }
      return new Response(null, { status: 404 });
    }),
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  localStorage.clear();
});

const gets = () => calls.filter((c) => c.method === 'GET' && c.url.endsWith('/api/self/v3')).length;

function withState(b: SelfV3Response, states: Partial<Record<SelfCardId, CardReadState>>): SelfV3Response {
  for (const c of b.cards) if (states[c.id]) c.state = states[c.id]!;
  return b;
}

describe('Self board v3, doc 70: per-card states', () => {
  it('a failed card says so; Try again posts the card and reads the board again', async () => {
    let n = 0;
    v3Body = () => (++n === 1 ? withState(selfV3Reading(), { body: 'failed' }) : withState(selfV3Reading(), { body: 'queued' }));
    render(<SelfBoardV3 />);
    const c = await screen.findByTestId('v3-card-body');
    expect(within(c).getByTestId('card-read-failed')).toHaveTextContent('This one did not come through');
    expect(within(c).queryByRole('alert')).toBeNull();
    fireEvent.click(within(c).getByTestId('card-try-again'));
    await waitFor(() => expect(calls.some((x) => x.method === 'POST' && x.url.endsWith('/api/self/v3/cards/body/read'))).toBe(true));
    await waitFor(() => expect(gets()).toBe(2));
    const post = calls.findIndex((x) => x.method === 'POST');
    const second = calls.findIndex((x, i) => i > post && x.method === 'GET' && x.url.endsWith('/api/self/v3'));
    expect(second).toBeGreaterThan(post);
    expect(await within(screen.getByTestId('v3-card-body')).findByTestId('card-reading-line')).toHaveTextContent('In the queue');
  });

  it('a reading card shows the quiet skeleton and "Reading your chart"; a queued one "In the queue"', async () => {
    v3Body = () => withState(selfV3Reading(), { body: 'reading', mind: 'queued' });
    render(<SelfBoardV3 />);
    const body = await screen.findByTestId('v3-card-body');
    expect(within(body).getByTestId('card-reading')).toHaveAttribute('data-state', 'reading');
    expect(within(body).getByTestId('card-reading-line')).toHaveTextContent(V3_WORDS.cardReading);
    expect(within(body).queryByTestId('card-line')).toBeNull();
    expect(within(screen.getByTestId('v3-card-mind')).getByTestId('card-reading-line')).toHaveTextContent('In the queue');
    // a ready card shows as today
    expect(within(screen.getByTestId('v3-card-stuck')).getByTestId('card-line')).toBeInTheDocument();
  });

  it('at the spend cap an unread card just says "Not read yet", no error', async () => {
    v3Body = () => withState(selfV3Reading({ capReached: true, stage: 'idle' }), { stuck: 'not_read' });
    render(<SelfBoardV3 />);
    const c = await screen.findByTestId('v3-card-stuck');
    expect(within(c).getByTestId('card-not-read')).toHaveTextContent('Not read yet');
    expect(within(c).queryByRole('alert')).toBeNull();
    expect(within(c).queryByTestId('card-try-again')).toBeNull();
  });

  it('with the per-card reading off the card states are not shown', async () => {
    v3Body = () => withState(selfV3Fixture(), { stuck: 'not_read' });
    render(<SelfBoardV3 />);
    const c = await screen.findByTestId('v3-card-stuck');
    expect(within(c).queryByTestId('card-not-read')).toBeNull();
    expect(within(c).getByTestId('card-line')).toBeInTheDocument();
    expect(screen.queryByTestId('self-reading-line')).toBeNull();
  });
});

describe('Self board v3, doc 70: the board reading line', () => {
  it('words for each stage, the chart being prepared, and nothing for idle or done', () => {
    const r = selfV3Reading().reading!;
    expect(readingLine({ ...r, stage: 'clocks' })).toBe('Reading your chart');
    expect(readingLine({ ...r, stage: 'ledger' })).toBe('Putting your reading together');
    expect(readingLine({ ...r, stage: 'cards', done: 3, total: 6 })).toBe('Writing your cards · 3 of 6');
    expect(readingLine({ ...r, stage: 'clocks', preparing: true })).toBe('Your chart is still being prepared. Back in a few minutes.');
    expect(readingLine({ ...r, stage: 'idle' })).toBeNull();
    expect(readingLine({ ...r, stage: 'done' })).toBeNull();
    expect(readingLine({ ...r, enabled: false })).toBeNull();
    expect(readingLine(null)).toBeNull();
  });

  it('the header shows the stage line', async () => {
    render(<SelfBoardV3 />);
    expect(await screen.findByTestId('self-reading-line')).toHaveTextContent('Writing your cards · 5 of 8');
  });

  it('under five cards the header asks for five, and the picker says so too', async () => {
    v3Body = () => {
      const b = selfV3Reading({ stage: 'idle' });
      b.layout.cards = ['body', 'mind', 'stuck', 'year'];
      return b;
    };
    render(<SelfBoardV3 />);
    expect(await screen.findByTestId('self-reading-line')).toHaveTextContent('Add at least five cards to start your reading.');
    fireEvent.click(screen.getByTestId('self-v3-chip-add'));
    expect(await screen.findByTestId('picker-note')).toHaveTextContent(V3_WORDS.addFive);
  });
});

describe('Self board v3, doc 75: no method on screen', () => {
  it('no card says how many clocks agree, on any period, and a split period shows no tone name', async () => {
    render(<SelfBoardV3 />);
    const c = await screen.findByTestId('v3-card-body');
    expect(c).not.toHaveTextContent(/clocks? agree|clocks are split|Checked on/);
    fireEvent.click(within(c).getByTestId('period-1'));
    expect(c).not.toHaveTextContent(/clocks? agree|clocks are split/);
    expect(within(c).getByTestId('period-1')).not.toHaveTextContent(/stretch ·/);
  });

  it('Why lists no clocks and no agreement', async () => {
    render(<SelfBoardV3 />);
    const c = await screen.findByTestId('v3-card-body');
    fireEvent.click(within(c).getByTestId('card-why'));
    const sheet = await screen.findByTestId('details-sheet');
    expect(screen.queryByTestId('details-clocks')).toBeNull();
    expect(sheet).not.toHaveTextContent(/Agrees|Differs|clocks/);
  });
});

describe('Self board v3, doc 70: polling', () => {
  it('reads the board every 2 s while a card is queued or reading, and stops when none is', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    let n = 0;
    v3Body = () => (++n <= 2 ? withState(selfV3Reading(), { body: 'reading', mind: 'queued' }) : selfV3Reading({ stage: 'done', done: 8 }));
    const view = render(<SelfBoardV3 />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(gets()).toBe(1);
    expect(screen.getByTestId('v3-card-body')).toHaveAttribute('data-state', 'reading');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(READING_POLL_MS);
    });
    expect(gets()).toBe(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(READING_POLL_MS);
    });
    expect(gets()).toBe(3);
    expect(screen.getByTestId('v3-card-body')).toHaveAttribute('data-state', 'ready');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(READING_POLL_MS * 5);
    });
    expect(gets()).toBe(3);
    view.unmount();
  });

  it('stops polling on unmount', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    v3Body = () => withState(selfV3Reading(), { body: 'queued' });
    const view = render(<SelfBoardV3 />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(gets()).toBe(1);
    view.unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(READING_POLL_MS * 3);
    });
    expect(gets()).toBe(1);
  });
});
