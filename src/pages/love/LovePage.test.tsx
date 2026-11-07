import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import LovePage, { loveHeadline } from './LovePage';
import { BANNED_ON_BOARD } from '../lucky/words';
import type { AreaBoard } from '../../lib/areaApi';

function loveBoard(over: Partial<AreaBoard['tone']> = {}, ahead?: AreaBoard['ahead']): AreaBoard {
  return {
    asOf: '2026-11-05',
    tone: { tone: 'demanding', confidence: 'split', families: [{ family: 'main', vote: 'test' }, { family: 'transit', vote: 'test' }], date: '2027-03-03', ...over },
    supports: [{ text: 'Your partnerships has firm footing.', evidence: ['D1.h7 lord Ve in h7 (kendra)'] }],
    pressures: [{ text: 'A heavy influence presses on your partnerships.', until: '2027-03-01', evidence: ['D1.h7 aspected_by Sa'] }],
    ahead: ahead ?? [
      { subarea: 'health', label: 'A tense stretch: go gently', from: '2026-11-05', to: '2027-03-02', side: 'test', grade: 'moderate', systems: ['vimshottari'] },
      { subarea: 'friends', label: 'A good stretch', from: '2027-04-01', to: '2027-12-31', side: 'support', grade: 'moderate', systems: ['vimshottari'] },
    ],
    year: { year: 2026, note: "This year's chart asks for patience in love: go slowly with big decisions." },
    back: [],
    notes: [],
  };
}

let state: { status: number; body: any; ask: boolean; focus: string | null; board: AreaBoard };
let calls: Array<{ method: string; url: string; body?: any }>;

beforeEach(() => {
  localStorage.setItem('token', 't');
  calls = [];
  state = { status: 200, body: null, ask: true, focus: null, board: loveBoard() };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const method = (init.method ?? 'GET').toUpperCase();
      const body = init.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ method, url, body });
      if (url.endsWith('/api/area/love')) {
        if (state.status !== 200) return new Response(JSON.stringify(state.body ?? { error: 'x' }), { status: state.status });
        return new Response(JSON.stringify({ status: 'ok', built_at: '2026-11-05', cached: false, focus: state.focus, ask: state.ask, board: state.board, checks: {} }), { status: 200 });
      }
      if (url.endsWith('/api/profile/facts')) {
        state.ask = false;
        state.focus = 'health';
        return new Response(null, { status: 204 });
      }
      return new Response(null, { status: 204 });
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

const text = () => screen.getByTestId('love-page').textContent!.toLowerCase();

describe('Love board', () => {
  it('replaces the placeholder: a strained tone with its date and no verdict words', async () => {
    render(<LovePage />);
    const card = await screen.findByTestId('tone-card');
    expect(card).toHaveTextContent('A strained stretch in love. It eases from 3 Mar 2027.');
    expect(card).toHaveTextContent('Your chart is divided on this.');
    expect(text()).not.toContain('being built next');
    for (const w of [...BANNED_ON_BOARD, 'divorce', 'cheat', 'house', 'lord', 'aspected']) expect(text()).not.toContain(w);
  });
  it('the open headline suits the person: introductions only when meeting someone leads', () => {
    expect(loveHeadline(loveBoard({ tone: 'open', date: '2027-05-07' }), 'meet')).toBe('A warm opening for love. Say yes to introductions before 7 May 2027.');
    expect(loveHeadline(loveBoard({ tone: 'open', date: '2027-05-07' }), 'health')).toBe('A warm stretch for love. Make time for each other before 7 May 2027.');
    expect(loveHeadline(loveBoard({ tone: 'easing', date: '2027-03-03' }), null)).toBe('Things are softening. From 3 Mar 2027, a better time to talk.');
    expect(loveHeadline(loveBoard({ tone: 'steady', date: '2027-08-24' }), null)).toBe('A settled stretch in love. A new opening on 24 Aug 2027.');
    expect(loveHeadline(loveBoard({ tone: 'closing', date: '2026-10-12' }), null)).toBe('A good window for a decision closes 12 Oct 2026.');
  });
  it('asks the relationship question once and saves love.status', async () => {
    render(<LovePage />);
    const q = await screen.findByTestId('board-question');
    expect(q).toHaveTextContent('Right now are you…');
    fireEvent.click(within(q).getByRole('button', { name: 'Married' }));
    await waitFor(() => expect(screen.queryByTestId('board-question')).not.toBeInTheDocument());
    expect(calls.find((c) => c.method === 'PUT')!.body).toEqual({ facts: { 'love.status': 'married' } });
  });
  it('"Prefer not to say" is stored as declined (null) and not asked again', async () => {
    render(<LovePage />);
    fireEvent.click(within(await screen.findByTestId('board-question')).getByRole('button', { name: 'Prefer not to say' }));
    await waitFor(() => expect(screen.queryByTestId('board-question')).not.toBeInTheDocument());
    expect(calls.find((c) => c.method === 'PUT')!.body).toEqual({ facts: { 'love.status': null } });
  });
  it('Ahead by topic, pressures with their release, an empty Looking back says so', async () => {
    state.ask = false;
    render(<LovePage />);
    fireEvent.click(await screen.findByRole('tab', { name: 'Ahead' }));
    const chips = within(screen.getByRole('tablist', { name: 'Ahead by topic' })).getAllByRole('tab');
    expect(chips.map((c) => c.textContent)).toEqual(['How things are between you', 'Friendships']);
    fireEvent.click(screen.getByRole('tab', { name: 'What presses' }));
    expect(screen.getByTestId('presses')).toHaveTextContent('Eases by 1 Mar 2027');
    fireEvent.click(screen.getByRole('tab', { name: 'Looking back' }));
    expect(screen.getByTestId('back-empty')).toBeInTheDocument();
  });
  it('an empty Ahead says nothing large is moving', async () => {
    state.board = loveBoard({}, []);
    render(<LovePage />);
    fireEvent.click(await screen.findByRole('tab', { name: 'Ahead' }));
    expect(screen.getByTestId('ahead-empty')).toHaveTextContent('Nothing large is moving in love');
  });
  it('preparing, no kundli and off', async () => {
    state.status = 202;
    const a = render(<LovePage />);
    expect(await screen.findByTestId('board-preparing')).toBeInTheDocument();
    a.unmount();
    state.status = 404;
    state.body = { status: 'no_kundli' };
    const b = render(<LovePage />);
    expect(await screen.findByTestId('board-no-kundli')).toBeInTheDocument();
    b.unmount();
    state.body = {};
    render(<LovePage />);
    expect(await screen.findByText('The Love board is coming soon.')).toBeInTheDocument();
  });
});
