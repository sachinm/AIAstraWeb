/**
 * The board chat bubble (Sachin, 2026-11-09): it opens the Ask conversation as a dialog over the board, never in place
 * of it, and X, Esc, the backdrop and the browser Back button all close it with the board, its tab and its card as they
 * were and focus back on the bubble.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactElement } from 'react';

vi.mock('../pages/chat-interface/ChatSection', () => ({
  default: (p: { category: string }) => <div data-testid="chat-stub">{p.category}</div>,
}));

import LovePage from '../pages/love/LovePage';
import WorkPage from '../pages/work/WorkPage';
import YouPage from '../pages/you/YouPage';
import type { AreaBoard } from '../lib/areaApi';
import type { CareerMap } from '../lib/careerApi';
import { selfReadingFixture } from '../pages/you/selfReading.fixture';

function areaBoard(): AreaBoard {
  return {
    asOf: '2026-11-05',
    tone: { tone: 'demanding', confidence: 'split', families: [{ family: 'main', vote: 'test' }, { family: 'transit', vote: 'test' }], date: '2027-03-03' },
    supports: [{ text: 'Firm footing.', evidence: ['D1.h7 lord Ve in h7 (kendra)'] }],
    pressures: [{ text: 'A heavy influence.', until: '2027-03-01', evidence: ['D1.h7 aspected_by Sa'] }],
    ahead: [
      { subarea: 'health', label: 'A tense stretch: go gently', from: '2026-11-05', to: '2027-03-02', side: 'test', grade: 'moderate', systems: ['vimshottari'] },
      { subarea: 'friends', label: 'A good stretch', from: '2027-04-01', to: '2027-12-31', side: 'support', grade: 'moderate', systems: ['vimshottari'] },
    ],
    year: { year: 2026, note: 'A note for the year.' },
    back: [],
    notes: [],
  } as AreaBoard;
}

function careerMap(): CareerMap {
  const w = (subarea: string, side: 'support' | 'test', from: string, to: string) => ({ subarea, side, from, to, peakMonth: from.slice(0, 7), band: 'moderate' as const, score: 5, families: ['main', 'rasi'], drivers: ['Ju'] });
  return {
    asOf: '2026-11-05',
    month: '2026-11',
    present: { tone: 'demanding', confidence: 'likely', votes: [{ family: 'main', label: 'Main clock', vote: 'test', planet: 'Sa' }], available: 5, agree: 2, ease_date: '2026-12-10', window_end: null, next_window_start: null, security: 'watch' },
    ahead: [w('promotion', 'support', '2027-03-01', '2027-05-31')],
    horizons: [
      { months: 1, best: null, hardest: null, quiet: true },
      { months: 3, best: null, hardest: null, quiet: true },
      { months: 6, best: w('promotion', 'support', '2027-03-01', '2027-05-31'), hardest: null, quiet: false },
      { months: 12, best: w('promotion', 'support', '2027-03-01', '2027-05-31'), hardest: null, quiet: false },
    ],
    security: [],
    back: [],
    notes: [],
  } as unknown as CareerMap;
}

beforeEach(() => {
  localStorage.setItem('token', 't');
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const method = (init.method ?? 'GET').toUpperCase();
      const ok = (b: unknown) => new Response(JSON.stringify(b), { status: 200 });
      if (url.endsWith('/api/area/love')) return ok({ status: 'ok', built_at: '2026-11-05', cached: false, focus: null, ask: false, board: areaBoard(), checks: {} });
      if (url.endsWith('/api/area/self')) return ok({ status: 'ok', built_at: '2026-11-05', cached: true, focus: null, ask: false, board: areaBoard(), checks: {} });
      if (url.endsWith('/api/self/reading') && method === 'GET') return ok({ status: 'ok', built_at: '2026-11-07', cached: true, reading: selfReadingFixture() });
      if (url.endsWith('/api/area/career')) return ok({ status: 'ok', map: careerMap(), work: 'employed', checks: {} });
      return new Response(null, { status: 204 });
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

type Board = {
  name: string;
  page: () => ReactElement;
  testId: string;
  bubble: string;
  tablist: string;
  /** the inner tablist (a carousel or rung) on the Ahead page */
  inner: string;
};

const BOARDS: Board[] = [
  { name: 'Love', page: () => <LovePage />, testId: 'love-page', bubble: 'Ask about Love', tablist: 'Love pages', inner: 'Ahead by topic' },
  { name: 'You', page: () => <YouPage />, testId: 'you-page', bubble: 'Ask about You', tablist: 'You pages', inner: 'Ahead by topic' },
  { name: 'Work', page: () => <WorkPage />, testId: 'work-page', bubble: 'Ask about Work', tablist: 'Work pages', inner: 'How far ahead' },
];

/** moves the board off its defaults: the Ahead tab and the last card/rung inside it */
async function move(b: Board) {
  fireEvent.click(within(screen.getByRole('tablist', { name: b.tablist })).getByRole('tab', { name: 'Ahead' }));
  const inner = await screen.findByRole('tablist', { name: b.inner });
  const tabs = within(inner).getAllByRole('tab');
  fireEvent.click(tabs[tabs.length - 1]!);
}

function expectMoved(b: Board) {
  expect(within(screen.getByRole('tablist', { name: b.tablist })).getByRole('tab', { name: 'Ahead' })).toHaveAttribute('aria-selected', 'true');
  const tabs = within(screen.getByRole('tablist', { name: b.inner })).getAllByRole('tab');
  expect(tabs[tabs.length - 1]).toHaveAttribute('aria-selected', 'true');
}

const CLOSERS: Array<[string, () => void]> = [
  ['the X button', () => fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }))],
  ['Esc', () => fireEvent.keyDown(window, { key: 'Escape' })],
  ['the backdrop', () => fireEvent.click(screen.getByTestId('ask-backdrop'))],
  ['the browser Back button', () => act(() => window.history.back())],
];

describe.each(BOARDS)('$name board chat bubble', (b) => {
  it.each(CLOSERS)('opens a dialog over the board, and %s closes it with the board unchanged', async (_how, closeIt) => {
    render(b.page());
    const board = await screen.findByTestId(b.testId);
    await screen.findByRole('tablist', { name: b.tablist });
    await move(b);
    expectMoved(b);

    const bubble = screen.getByRole('button', { name: b.bubble });
    fireEvent.click(bubble);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    // a layer over the whole page, not inside the board's container
    expect(board.contains(dialog)).toBe(false);
    expect(dialog.parentElement!.parentElement).toBe(document.body);
    expect(screen.getByTestId(b.testId)).toBe(board);
    expect(within(dialog).getByRole('button', { name: 'Close' })).toHaveFocus();
    expect(document.body.style.overflow).toBe('hidden');
    expect(window.history.state).toHaveProperty('__boardAsk');

    closeIt();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    // the same board element (never remounted), same tab, same card, focus back on the bubble, scroll unlocked
    expect(screen.getByTestId(b.testId)).toBe(board);
    expectMoved(b);
    expect(screen.getByRole('button', { name: b.bubble })).toHaveFocus();
    expect(document.body.style.overflow).toBe('');
    // the pushed entry is popped, so a later Back leaves the board as it normally would
    await waitFor(() => expect((window.history.state ?? {}) as object).not.toHaveProperty('__boardAsk'));
  });
});
