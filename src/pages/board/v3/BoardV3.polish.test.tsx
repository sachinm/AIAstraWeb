/**
 * Board polish (TODOS 2026-11-18/19): one freshness state in the header, the reading line counts the lens on screen and
 * names the build's stage while nothing is being written, a Love/Work lens refresh sends its lens and says when the
 * reading is free, and a 409 not_ready says the board is catching up with a way to try again.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import BoardV3, { deckReadingLine } from './BoardV3';
import { boardV3Fixture } from './boardV3.fixture';
import { clearSelfV3Cached } from '../../../lib/selfV3Cache';
import type { BoardReadingView, BoardV3Response } from '../../../lib/selfV3Api';
import type { SelfV2BuildView } from '../../../lib/selfV2Api';

const plan = vi.hoisted(() => ({ setPlan: vi.fn(), refreshPlan: vi.fn(async () => {}) }));
vi.mock('../../../Auth/ProfileGate', () => ({ usePlan: () => ({ plan: null, setPlan: plan.setPlan, refreshPlan: plan.refreshPlan }) }));

type Call = { method: string; url: string; body?: Record<string, unknown> };
let calls: Call[];
let board: () => BoardV3Response;
let refreshAnswer: { status: number; body: unknown };

const reading = (over: Partial<BoardReadingView> = {}): BoardReadingView => ({
  enabled: true,
  stage: 'cards',
  clocks: [],
  done: 0,
  total: 19,
  capReached: false,
  preparing: false,
  ...over,
});
const build = (over: Partial<SelfV2BuildView> = {}): SelfV2BuildView => ({
  state: 'running',
  stage: 'oracle',
  step: 5,
  steps: 7,
  percent: 60,
  nextPercent: 80,
  stageExpectedMs: 20_000,
  startedAt: null,
  stageAt: null,
  ...over,
});

beforeEach(() => {
  clearSelfV3Cached();
  sessionStorage.clear();
  localStorage.setItem('token', 't');
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-19T12:00:00'));
  Object.defineProperty(window, 'innerWidth', { value: 1180, configurable: true, writable: true });
  Object.defineProperty(window, 'innerHeight', { value: 820, configurable: true, writable: true });
  calls = [];
  board = () => boardV3Fixture('love');
  refreshAnswer = { status: 200, body: { status: 'queued', board: 'love', lens: 'dating', first: true, charged: false, queued: ['dating_pulse'] } };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const method = (init.method ?? 'GET').toUpperCase();
      const body = init.body && typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
      const u = String(url);
      calls.push({ method, url: u, body });
      if (/\/api\/board\/(love|work)\/v3$/.test(u) && method === 'GET') return new Response(JSON.stringify(board()), { status: 200 });
      if (/\/api\/boards\/(love|work)\/refresh$/.test(u) && method === 'POST') return new Response(JSON.stringify(refreshAnswer.body), { status: refreshAnswer.status });
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

describe('deckReadingLine', () => {
  const card = (state: 'queued' | 'reading' | 'ready' | 'not_read') => ({ state, available: true });

  it('counts only the lens on screen: the cards being read and the ones read', () => {
    const deck = [card('ready'), card('queued'), card('reading'), card('not_read')];
    expect(deckReadingLine(reading({ done: 7, total: 19 }), build({ state: 'ready' }), deck, true)?.text).toBe('Writing your cards · 1 of 3');
  });

  it('names the build stage while the build runs and no card is being written', () => {
    const deck = [card('queued'), card('queued')];
    expect(deckReadingLine(reading(), build(), deck, true)).toEqual({ text: "Preparing today's reading · Putting it together", fromBuild: true });
    expect(deckReadingLine(reading(), build({ state: 'queued', stage: null }), deck, true)?.text).toBe("Preparing today's reading · Getting ready");
    // once a card is being written the counter takes over
    expect(deckReadingLine(reading(), build(), [card('reading'), card('queued')], true)?.text).toBe('Writing your cards · 0 of 2');
  });

  it('says nothing for a lens with nothing being read, even when another lens is', () => {
    expect(deckReadingLine(reading(), build({ state: 'ready' }), [card('ready')], true)).toBeNull();
  });

  it('Self keeps the server counts', () => {
    expect(deckReadingLine(reading({ done: 5, total: 8 }), build({ state: 'ready' }), [card('ready')], false)?.text).toBe('Writing your cards · 5 of 8');
    expect(deckReadingLine(reading({ stage: 'done' }), null, [], false)).toBeNull();
    expect(deckReadingLine(null, null, [], false)).toBeNull();
  });
});

describe('the Love board header', () => {
  it('a lens never read offers its free first reading and sends the lens', async () => {
    let asked = false;
    board = () => {
      const b = boardV3Fixture('love');
      b.reading = reading({ stage: 'idle' });
      b.refresh = { madeAt: null, validUntil: null, due: false };
      b.cards = b.cards.map((c) => (c.group === 'dating' ? { ...c, state: asked ? 'queued' : 'not_read' } : c));
      return b;
    };
    render(<BoardV3 board="love" />);
    const btn = await screen.findByTestId('fresh-button');
    expect(btn).toHaveAttribute('data-state', 'first');
    expect(btn).toHaveTextContent('Read these cards');
    expect(screen.getByTestId('fresh-line')).toHaveTextContent('Free: first reading');
    asked = true;
    fireEvent.click(btn);
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.url.endsWith('/api/boards/love/refresh'))).toBe(true));
    const post = calls.find((c) => c.method === 'POST')!;
    expect(post.body).toEqual({ lens: 'dating' });
    await waitFor(() => expect(screen.getByTestId('fresh-button')).toHaveAttribute('data-state', 'building'));
    expect(screen.getByTestId('fresh-line')).toHaveTextContent('Free: first reading');
  });

  it('a 409 not_ready says the board is catching up, with Try again', async () => {
    refreshAnswer = { status: 409, body: { error: 'not_ready', code: 'not_ready', lens: 'dating' } };
    board = () => {
      const b = boardV3Fixture('love');
      b.reading = reading({ stage: 'idle' });
      b.refresh = { madeAt: '2026-11-01T08:00:00Z', validUntil: '2026-11-18', due: true };
      return b;
    };
    render(<BoardV3 board="love" />);
    fireEvent.click(await screen.findByTestId('fresh-button'));
    fireEvent.click(await screen.findByTestId('fresh-confirm'));
    expect(await screen.findByTestId('fresh-catching-up')).toHaveTextContent('Your board is catching up. Try again in a few minutes.');
    const again = screen.getByTestId('fresh-button');
    expect(again).toHaveAttribute('data-state', 'catching_up');
    expect(screen.queryByText('That did not work. Try again')).toBeNull();
    expect(calls.find((c) => c.method === 'POST')!.body).toEqual({ lens: 'dating' });
    fireEvent.click(again);
    expect(await screen.findByTestId('fresh-sheet')).toBeInTheDocument();
  });

  it('a served reading shows one state: no failed-build line beside "Good until"', async () => {
    board = () => {
      const b = boardV3Fixture('love');
      b.reading = reading({ stage: 'done' });
      b.build = build({ state: 'failed', stage: null });
      b.refresh = { madeAt: '2026-11-18T08:00:00Z', validUntil: '2026-12-05', due: false };
      return b;
    };
    render(<BoardV3 board="love" />);
    const btn = await screen.findByTestId('fresh-button');
    expect(btn).toHaveTextContent('Good until 5 Dec 2026');
    expect(screen.getByTestId('fresh-line')).toHaveTextContent('Made 18 Nov 2026');
    expect(screen.queryByTestId('build-status')).toBeNull();
    expect(screen.getByTestId('self-v3-page')).not.toHaveTextContent('That did not work');
    expect(screen.getByTestId('self-v3-page')).not.toHaveTextContent('Fresh reading from');
  });

  it('while the day build runs, the header names its stage once and counts only the lens', async () => {
    board = () => {
      const b = boardV3Fixture('love');
      b.reading = reading({ done: 0, total: 19 });
      b.build = build({ stage: 'personalizer' });
      b.cards = b.cards.map((c) => (c.group === 'dating' ? { ...c, state: 'queued' } : c));
      return b;
    };
    render(<BoardV3 board="love" />);
    expect(await screen.findByTestId('self-reading-line')).toHaveTextContent("Preparing today's reading · Writing your cards for you");
    expect(screen.queryByTestId('build-status')).toBeNull();
    expect(screen.getByTestId('self-v3-page')).not.toHaveTextContent('of 19');
  });
});
