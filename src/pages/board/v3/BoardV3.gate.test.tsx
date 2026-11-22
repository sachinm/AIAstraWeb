/**
 * The reading gate (server prep gate) on the v3 boards: while the board's `pipeline.locked`, every control that starts a
 * reading is disabled and says "Building your chart data" with the server's line, on desktop and phone, even before any
 * first reading; a 409 `preparing` is that state, never an error; the page polls every 5 s and, once the server
 * unlocks, the controls are back without anything being started. With no block or an open one, nothing changes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import BoardV3 from './BoardV3';
import { boardV3Fixture } from './boardV3.fixture';
import { PIPELINE_LOCKED, PIPELINE_OPEN, selfV3Fixture, selfV3Gated, selfV3Reading } from '../../you/v3/selfV3.fixture';
import { clearSelfV3Cached } from '../../../lib/selfV3Cache';
import { PIPELINE_POLL_MS, type PipelineView } from '../../../lib/pipelineStatus';
import { PIPELINE_WORDS } from '../../you/v2/words';
import type { SelfV3Response } from '../../../lib/selfV3Api';

const plan = vi.hoisted(() => ({ setPlan: vi.fn(), refreshPlan: vi.fn(async () => {}) }));
vi.mock('../../../Auth/ProfileGate', () => ({ usePlan: () => ({ plan: null, setPlan: plan.setPlan, refreshPlan: plan.refreshPlan }) }));

type Call = { method: string; url: string };
let calls: Call[];
let body: () => SelfV3Response;
let refresh: { status: number; body: unknown };
let read: { status: number; body: unknown };

const json = (b: unknown) => JSON.stringify(b);
const LINE = 'Preparing Love · 2 of 5';

function viewport(w: number, h: number) {
  Object.defineProperty(window, 'innerWidth', { value: w, configurable: true, writable: true });
  Object.defineProperty(window, 'innerHeight', { value: h, configurable: true, writable: true });
}

/** a reading that is due (the open control is the live button) */
function due(b: SelfV3Response): SelfV3Response {
  return { ...b, refresh: { madeAt: '2026-10-20T09:00:00Z', validUntil: '2026-11-08', due: true, building: false, failed: false } };
}

/** a new person: no reading has ever been made */
function neverRead(b: SelfV3Response): SelfV3Response {
  return { ...b, refresh: { madeAt: null, validUntil: null, due: false, building: false, failed: false } };
}

beforeEach(() => {
  clearSelfV3Cached();
  sessionStorage.clear();
  localStorage.setItem('token', 't');
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-18T12:00:00'));
  viewport(1180, 820);
  calls = [];
  body = () => selfV3Gated(PIPELINE_LOCKED, due(selfV3Fixture()));
  refresh = { status: 202, body: { status: 'building' } };
  read = { status: 202, body: { state: 'queued' } };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const method = (init.method ?? 'GET').toUpperCase();
      const u = String(url);
      calls.push({ method, url: u });
      if (/\/api\/(self\/v3|board\/(love|work)\/v3)$/.test(u) && method === 'GET') return new Response(json(body()), { status: 200 });
      if (/\/api\/boards\/[a-z]+\/refresh$/.test(u) && method === 'POST') return new Response(json(refresh.body), { status: refresh.status });
      if (/\/cards\/[^/]+\/read$/.test(u) && method === 'POST') return new Response(json(read.body), { status: read.status });
      return new Response(null, { status: 404 });
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  localStorage.clear();
});

const posts = () => calls.filter((c) => c.method === 'POST');
const gets = () => calls.filter((c) => c.method === 'GET').length;

function expectLocked(scope: HTMLElement, line = LINE) {
  const button = within(scope).getByTestId('fresh-button');
  expect(button).toBeDisabled();
  expect(button).toHaveAttribute('aria-disabled', 'true');
  expect(button).toHaveAttribute('data-state', 'locked');
  expect(button).toHaveTextContent(PIPELINE_WORDS.label);
  const status = within(scope).getByTestId('fresh-locked-line');
  expect(status).toHaveTextContent(line);
  expect(status).toHaveAttribute('aria-live', 'polite');
}

describe('the reading gate on the v3 board, desktop', () => {
  it('locked: the fresh-reading control is drawn, disabled, with "Building your chart data" and the server line', async () => {
    render(<BoardV3 board="self" />);
    const row = await screen.findByTestId('self-board-row');
    expectLocked(row);
    // not clickable: no sheet, nothing posted
    fireEvent.click(within(row).getByTestId('fresh-button'));
    expect(screen.queryByTestId('fresh-sheet')).toBeNull();
    expect(posts()).toHaveLength(0);
  });

  it('locked before any reading was ever made: the control is still drawn', async () => {
    body = () => selfV3Gated(PIPELINE_LOCKED, neverRead(selfV3Fixture()));
    render(<BoardV3 board="self" />);
    expectLocked(await screen.findByTestId('self-board-row'));
  });

  it('Love and Work too', async () => {
    body = () => selfV3Gated(PIPELINE_LOCKED, neverRead(boardV3Fixture('love')));
    render(<BoardV3 board="love" />);
    expectLocked(await screen.findByTestId('self-board-row'));
  });

  it('blocked: the retry sentence instead of a step line', async () => {
    body = () => selfV3Gated({ ...PIPELINE_LOCKED, stage: 'blocked', line: 'Some step failed' }, due(selfV3Fixture()));
    render(<BoardV3 board="self" />);
    const row = await screen.findByTestId('self-board-row');
    expect(within(row).getByTestId('fresh-locked-line')).toHaveTextContent(PIPELINE_WORDS.blocked);
    expect(within(row).getByTestId('fresh-button')).toBeDisabled();
  });

  it('a card\'s Try again is disabled while locked and posts nothing', async () => {
    body = () => {
      const b = selfV3Gated(PIPELINE_LOCKED, selfV3Reading());
      b.cards = b.cards.map((c) => (c.id === 'body' ? { ...c, state: 'failed' } : c));
      return b;
    };
    render(<BoardV3 board="self" />);
    const card = await screen.findByTestId('v3-card-body');
    const again = within(card).getByTestId('card-try-again');
    expect(again).toBeDisabled();
    expect(again).toHaveTextContent(PIPELINE_WORDS.label);
    expect(within(card).getByTestId('card-try-again-locked')).toHaveTextContent(LINE);
    fireEvent.click(again);
    expect(posts()).toHaveLength(0);
  });

  it('the clock sheet cannot start a rebuild while locked', async () => {
    render(<BoardV3 board="self" />);
    fireEvent.click(await screen.findByTestId('self-clock-change'));
    const sheet = await screen.findByTestId('clock-sheet');
    fireEvent.click(within(sheet).getByTestId('clock-option-short'));
    expect(within(sheet).getByTestId('clock-confirm')).toBeDisabled();
    expect(within(sheet).getByTestId('clock-locked')).toHaveTextContent(PIPELINE_WORDS.clock);
  });

  it('the picker still saves the pick while locked and says its reading waits', async () => {
    render(<BoardV3 board="self" />);
    fireEvent.click(await screen.findByTestId('self-v3-edit'));
    const picker = await screen.findByTestId('self-v3-picker');
    expect(within(picker).getByTestId('picker-done')).toBeEnabled();
    expect(picker).toHaveTextContent(PIPELINE_WORDS.pickerNote);
  });

  it('open (or no block at all): the control is the live one, exactly as before', async () => {
    for (const make of [() => selfV3Gated(PIPELINE_OPEN, due(selfV3Fixture())), () => due(selfV3Fixture())]) {
      body = make;
      clearSelfV3Cached();
      render(<BoardV3 board="self" />);
      const row = await screen.findByTestId('self-board-row');
      const button = within(row).getByTestId('fresh-button');
      expect(button).toBeEnabled();
      expect(button).toHaveAttribute('data-state', 'due');
      expect(within(row).queryByTestId('fresh-locked-line')).toBeNull();
      cleanup();
    }
    // never read and open: nothing is drawn, as before
    body = () => selfV3Gated(PIPELINE_OPEN, neverRead(selfV3Fixture()));
    clearSelfV3Cached();
    render(<BoardV3 board="self" />);
    await screen.findByTestId('self-board-row');
    expect(screen.queryByTestId('fresh-button')).toBeNull();
  });

  it('a 409 preparing from the refresh shows the locked control, not an error', async () => {
    body = () => selfV3Gated(PIPELINE_OPEN, due(selfV3Fixture()));
    const pipeline: PipelineView = { ...PIPELINE_LOCKED, line: 'Getting your chart', done: 0, total: 0 };
    refresh = { status: 409, body: { error: 'Your chart is still being prepared', code: 'preparing', pipeline } };
    render(<BoardV3 board="self" />);
    const row = await screen.findByTestId('self-board-row');
    fireEvent.click(within(row).getByTestId('fresh-button'));
    fireEvent.click(await screen.findByTestId('fresh-confirm'));
    await waitFor(() => expect(within(screen.getByTestId('self-board-row')).getByTestId('fresh-button')).toHaveAttribute('data-state', 'locked'));
    expect(screen.queryByTestId('fresh-sheet')).toBeNull();
    expect(screen.queryByTestId('fresh-sheet-error')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    // total 0: the server's line alone
    expect(screen.getByTestId('fresh-locked-line').textContent).toBe('Getting your chart');
  });

  it('a 409 building from the refresh is not an error', async () => {
    body = () => due(selfV3Fixture());
    refresh = { status: 409, body: { error: 'busy', code: 'building' } };
    render(<BoardV3 board="self" />);
    const row = await screen.findByTestId('self-board-row');
    fireEvent.click(within(row).getByTestId('fresh-button'));
    fireEvent.click(await screen.findByTestId('fresh-confirm'));
    await waitFor(() => expect(screen.queryByTestId('fresh-sheet')).toBeNull());
    expect(screen.queryByTestId('fresh-sheet-error')).toBeNull();
    expect(within(screen.getByTestId('self-board-row')).getByTestId('fresh-button')).not.toHaveTextContent('That did not work');
  });

  it('a card read refused with 409 preparing locks the board without an error', async () => {
    body = () => {
      const b = selfV3Reading();
      b.cards = b.cards.map((c) => (c.id === 'body' ? { ...c, state: 'failed' } : c));
      return due(b);
    };
    read = { status: 409, body: { error: 'preparing', code: 'preparing', pipeline: PIPELINE_LOCKED } };
    render(<BoardV3 board="self" />);
    fireEvent.click(within(await screen.findByTestId('v3-card-body')).getByTestId('card-try-again'));
    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('the reading gate on the v3 board, phone', () => {
  it('locked: the board sheet holds the disabled control with the server line', async () => {
    viewport(390, 844);
    body = () => selfV3Gated(PIPELINE_LOCKED, neverRead(selfV3Fixture()));
    render(<BoardV3 board="self" />);
    await screen.findByTestId('self-v3-carousel');
    // the header's dot says the reading needs a look
    expect(screen.getByTestId('self-phone-reading-dot')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('self-phone-reading'));
    expectLocked(await screen.findByTestId('self-reading-sheet'));
  });

  it('open: the board sheet holds the live control', async () => {
    viewport(390, 844);
    body = () => selfV3Gated(PIPELINE_OPEN, due(selfV3Fixture()));
    render(<BoardV3 board="self" />);
    await screen.findByTestId('self-v3-carousel');
    fireEvent.click(screen.getByTestId('self-phone-reading'));
    const sheet = await screen.findByTestId('self-reading-sheet');
    expect(within(sheet).getByTestId('fresh-button')).toBeEnabled();
    expect(within(sheet).getByTestId('fresh-button')).toHaveAttribute('data-state', 'due');
  });
});

describe('the reading gate polls', () => {
  it('reads the board every 5 s while locked, stops once open, and starts nothing', async () => {
    vi.useRealTimers();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-18T12:00:00'));
    let open = false;
    body = () => selfV3Gated(open ? PIPELINE_OPEN : PIPELINE_LOCKED, due(selfV3Fixture()));
    render(<BoardV3 board="self" />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(gets()).toBe(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PIPELINE_POLL_MS);
    });
    expect(gets()).toBe(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PIPELINE_POLL_MS);
    });
    expect(gets()).toBe(3);
    expect(screen.getByTestId('fresh-button')).toHaveAttribute('data-state', 'locked');
    open = true;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PIPELINE_POLL_MS);
    });
    expect(gets()).toBe(4);
    expect(screen.getByTestId('fresh-button')).toHaveAttribute('data-state', 'due');
    expect(screen.getByTestId('fresh-button')).toBeEnabled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PIPELINE_POLL_MS * 4);
    });
    expect(gets()).toBe(4);
    expect(posts()).toHaveLength(0);
  });
});
