/**
 * Love: "Your cards" (server docs/reading-engine/71 §4.6). The button opens the shared picker with Love's art, Done
 * saves the cards and their options, and the chosen cards then lead the board: tapping one focuses the board on its
 * sub-areas with its View as the time frame.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import LovePage from './LovePage';
import type { AreaBoard } from '../../lib/areaApi';

const board: AreaBoard = {
  asOf: '2026-11-05',
  tone: { tone: 'open', confidence: 'likely', families: [{ family: 'main', vote: 'support' }], date: '2027-03-03' },
  supports: [],
  pressures: [],
  ahead: [{ subarea: 'meet', label: 'A warm opening', from: '2026-12-01', to: '2027-03-02', side: 'support', grade: 'moderate', systems: ['vimshottari'] }],
  year: { year: 2026, note: 'A warm year.' },
  back: [],
  notes: [],
} as unknown as AreaBoard;

const CATALOGUE = {
  groups: [
    { id: 'bond', title: 'You two' },
    { id: 'meeting', title: 'Meeting and waiting' },
    { id: 'circle', title: 'Family and friends' },
  ],
  cards: [
    { id: 'love_where', group: 'bond', title: 'Where love stands', description: 'Your bonds this year', suggested: true, available: true, unavailableReason: null, subareas: ['*'] },
    { id: 'love_meet', group: 'meeting', title: 'Meeting someone', description: 'When meeting is likely', suggested: true, available: true, unavailableReason: null, subareas: ['meet'] },
    { id: 'love_partner', group: 'meeting', title: 'The partner you draw', description: 'Who suits you', suggested: false, available: false, unavailableReason: 'Coming soon', subareas: [] },
    { id: 'love_friends', group: 'circle', title: 'Friendships', description: 'Friends who carry you', suggested: false, available: true, unavailableReason: null, subareas: ['friends'] },
  ],
};

let stored: { cards: string[]; options: Record<string, unknown> };
let calls: Array<{ method: string; url: string; body?: any }>;

const view = () => ({
  board: 'love',
  cards: stored.cards,
  options: stored.options,
  effective: Object.fromEntries(stored.cards.map((id) => [id, { options: { length: 'usual', view: 'year', words: 'plain', plan: 'with', ...(stored.options[id] as object) }, notes: [] }])),
  chosen: stored.cards.length > 0,
  updatedAt: null,
});

beforeEach(() => {
  localStorage.setItem('token', 't');
  calls = [];
  stored = { cards: [], options: {} };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const method = (init.method ?? 'GET').toUpperCase();
      const body = init.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ method, url, body });
      if (url.endsWith('/api/area/love')) return new Response(JSON.stringify({ status: 'ok', focus: 'meet', ask: false, board, checks: {} }), { status: 200 });
      if (url.endsWith('/api/board/love/v3/catalogue')) return new Response(JSON.stringify(CATALOGUE), { status: 200 });
      if (url.endsWith('/api/board/love/v3/layout') && method === 'GET') return new Response(JSON.stringify(view()), { status: 200 });
      if (url.endsWith('/api/board/love/v3/layout') && method === 'PUT') {
        stored = { cards: body.cards, options: body.options ?? {} };
        return new Response(JSON.stringify(view()), { status: 200 });
      }
      return new Response(null, { status: 204 });
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('Love board: Your cards', () => {
  it('nothing is forced on a first visit: the board shows as before and the button is there', async () => {
    render(<LovePage />);
    await screen.findByTestId('tone-card');
    expect(await screen.findByTestId('area-cards-open')).toHaveTextContent('Your cards');
    expect(screen.queryByTestId('area-card-chips')).toBeNull();
    expect(screen.queryByTestId('area-cards-sheet')).toBeNull();
  });

  it('opens the picker with Love art, saves the cards and their options, and the chips lead the board', async () => {
    render(<LovePage />);
    fireEvent.click(await screen.findByTestId('area-cards-open'));
    const sheet = await screen.findByTestId('area-cards-sheet');
    expect(within(sheet).getByTestId('card-art-love_meet')).toHaveAttribute('data-art-theme', 'meeting');
    expect(within(sheet).getByTestId('picker-tile-love_partner')).toBeDisabled();
    fireEvent.click(within(sheet).getByTestId('picker-tile-love_meet'));
    fireEvent.click(within(sheet).getByTestId('picker-tile-love_friends'));
    fireEvent.click(within(sheet).getByTestId('picker-options-love_meet'));
    fireEvent.click(within(sheet).getByTestId('opt-love_meet-view-now'));
    fireEvent.click(within(sheet).getByTestId('picker-done'));
    await waitFor(() => expect(screen.queryByTestId('area-cards-sheet')).toBeNull());
    const put = calls.find((c) => c.method === 'PUT');
    expect(put?.body).toEqual({ cards: ['love_meet', 'love_friends'], options: { love_meet: { view: 'now' } } });

    const chips = await screen.findByTestId('area-card-chips');
    expect(within(chips).getByTestId('area-card-chip-love_meet')).toHaveTextContent('Meeting someone');
    // the focus list keeps only the chosen cards' sub-areas
    const focus = screen.getByTestId('board-focus-dropdown') as HTMLSelectElement;
    expect([...focus.options].map((o) => o.value).sort()).toEqual(['all', 'friends', 'meet']);
    fireEvent.click(within(chips).getByTestId('area-card-chip-love_meet'));
    expect(focus.value).toBe('meet');
    expect((screen.getByTestId('board-timeframe-dropdown') as HTMLSelectElement).value).toBe('active_now');
    fireEvent.click(within(chips).getByTestId('area-card-chip-all'));
    expect(focus.value).toBe('all');
  });
});
