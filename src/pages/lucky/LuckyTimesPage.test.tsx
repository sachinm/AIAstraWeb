import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import LuckyTimesPage from './LuckyTimesPage';
import { BANNED_ON_BOARD } from './words';
import * as events from '../../lib/events';

const CATALOG = [
  { area: 'work', label: 'Work', scenarios: [{ id: 'work.sign_contract', label: 'Sign a contract', ask: null }, { id: 'work.hard_talk_boss', label: 'A hard talk with the boss', ask: 'who' }] },
  { area: 'love', label: 'Love', scenarios: [{ id: 'love.first_date', label: 'A first date', ask: 'relationship' }] },
];

/** The window every layer shows; a test may swap it (the default is the older server's plain-key shape). */
let windowOverride: Record<string, unknown> | null = null;
let limbs: Record<string, unknown> = {};

function day(date: string, weekday: string, layers: Record<string, unknown> = {}) {
  return {
    ...limbs,
    date,
    weekday,
    sunrise: 400,
    sunset: 1020,
    personal: null,
    avoid: [{ kind: 'rahu_kalam', from: 788, to: 866 }],
    good: [{ kind: 'abhijit', from: 690, to: 732 }],
    layers,
  };
}

function rangeFor(picks: string[]) {
  const layer = { verdict: 'good', windows: [windowOverride ?? { from: 690, to: 731, score: 7, reasons: ['abhijit', 'hora:Jupiter', 'weekday:Thursday'] }], dayReasons: [] };
  const L = Object.fromEntries(picks.map((p) => [p, layer]));
  return {
    status: 'ok',
    place: 'sanjose',
    today: '2026-11-05',
    nowMin: 700,
    from: '2026-10-29',
    to: '2026-11-19',
    missing: [],
    now: { kind: 'good', what: 'abhijit', until: 731 },
    days: [day('2026-10-29', 'Thursday', L), day('2026-11-05', 'Thursday', L), day('2026-11-06', 'Friday', L), day('2026-11-12', 'Thursday', L)],
  };
}

let state: { place: string | null; picks: Array<{ scenario: string; shown: boolean; answers: Record<string, string> }> };
let calls: Array<{ method: string; url: string; body?: any }>;

beforeEach(() => {
  windowOverride = null;
  limbs = {};
  localStorage.setItem('token', 't');
  state = { place: null, picks: [] };
  calls = [];
  events._reset();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const method = (init.method ?? 'GET').toUpperCase();
      const body = init.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ method, url, body });
      const json = (s: number, j?: unknown) => new Response(j === undefined ? null : JSON.stringify(j), { status: s });
      if (url.endsWith('/api/lucky/setup')) return json(200, { place: state.place, places: [{ key: 'sanjose', name: 'San Jose, US' }, { key: 'pune', name: 'Pune, IN' }], scenarios: CATALOG, picks: state.picks });
      if (url.endsWith('/api/lucky/place')) {
        state.place = body.place;
        return json(204);
      }
      if (url.endsWith('/api/lucky/picks') && method === 'POST') {
        const p = { scenario: body.scenario, shown: true, answers: {} };
        state.picks.push(p);
        return json(201, { pick: p });
      }
      if (url.includes('/api/lucky/picks/') && method === 'PATCH') {
        const id = decodeURIComponent(url.split('/api/lucky/picks/')[1]!);
        const p = state.picks.find((x) => x.scenario === id)!;
        Object.assign(p, body.shown !== undefined ? { shown: body.shown } : {}, body.answers ? { answers: { ...p.answers, ...body.answers } } : {});
        return json(200, { pick: p });
      }
      if (url.includes('/api/lucky/picks/') && method === 'DELETE') {
        const id = decodeURIComponent(url.split('/api/lucky/picks/')[1]!);
        state.picks = state.picks.filter((x) => x.scenario !== id);
        return json(204);
      }
      if (url.includes('/api/lucky/range')) return json(200, rangeFor(state.picks.filter((p) => p.shown).map((p) => p.scenario)));
      if (url.endsWith('/api/analytics/events')) return json(204);
      return json(404, { error: 'not_found' });
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

function boardText(): string {
  const page = screen.getByTestId('lucky-page');
  const clone = page.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('[data-testid="why-sheet"]').forEach((n) => n.remove());
  return clone.textContent?.toLowerCase() ?? '';
}

describe('Lucky times page', () => {
  it('asks for a place first, then shows only the Add prompt', async () => {
    render(<LuckyTimesPage />);
    expect(await screen.findByRole('dialog', { name: 'Where are you?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'San Jose' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByText('What are you planning?')).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Today' })).not.toBeInTheDocument();
    expect(calls.some((c) => c.method === 'PUT' && c.url.endsWith('/api/lucky/place'))).toBe(true);
  });

  it('the Add menu lists only the catalog, grouped by area; adding shows the chip and its layer', async () => {
    state.place = 'sanjose';
    render(<LuckyTimesPage />);
    fireEvent.click(await screen.findByRole('button', { name: /Add a plan/ }));
    const menu = screen.getByRole('menu', { name: 'Add a plan' });
    expect(within(menu).getAllByRole('menuitem')).toHaveLength(3);
    expect(within(menu).getByText('Work')).toBeInTheDocument();
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Sign a contract' }));
    expect(await screen.findByRole('button', { name: 'Sign a contract', pressed: true })).toBeInTheDocument();
    expect(await screen.findByTestId('today-work.sign_contract')).toHaveTextContent('11:30–12:11');
  });

  it('asks the one situation question before a scenario that needs it, and remembers it', async () => {
    state.place = 'sanjose';
    render(<LuckyTimesPage />);
    fireEvent.click(await screen.findByRole('button', { name: /Add a plan/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'A hard talk with the boss' }));
    const ask = await screen.findByTestId('ask-card');
    expect(ask).toHaveTextContent('Who is it with?');
    fireEvent.click(within(ask).getByRole('button', { name: 'My boss' }));
    await waitFor(() => expect(screen.queryByTestId('ask-card')).not.toBeInTheDocument());
    expect(state.picks[0]!.answers).toEqual({ who: 'boss' });
  });

  it('toggles a layer, removes a plan, and has no month view', async () => {
    state.place = 'sanjose';
    state.picks = [{ scenario: 'work.sign_contract', shown: true, answers: {} }, { scenario: 'love.first_date', shown: true, answers: { relationship: 'single' } }];
    render(<LuckyTimesPage />);
    fireEvent.click(await screen.findByRole('tab', { name: 'Calendar' }));
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Today', 'Calendar', 'Last week', 'This week', 'Next week']);
    expect(screen.queryByText(/month/i)).not.toBeInTheDocument();
    await screen.findByTestId('day-2026-11-05');
    expect(screen.getAllByRole('button', { name: /^Sign a contract \d/ }).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Sign a contract', pressed: true }));
    await waitFor(() => expect(screen.queryAllByRole('button', { name: /^Sign a contract \d/ })).toHaveLength(0));
    fireEvent.click(screen.getByRole('button', { name: 'Remove A first date' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'A first date', pressed: true })).not.toBeInTheDocument());
  });

  it('opens Why with the traditional names only there, and the board shows no banned words or place text', async () => {
    state.place = 'sanjose';
    state.picks = [{ scenario: 'work.sign_contract', shown: true, answers: {} }];
    render(<LuckyTimesPage />);
    const card = await screen.findByTestId('today-work.sign_contract');
    for (const w of BANNED_ON_BOARD) expect(boardText()).not.toContain(w);
    expect(boardText()).not.toContain('san jose');
    fireEvent.click(within(card).getByRole('button', { name: /11:30/ }));
    const sheet = await screen.findByTestId('why-sheet');
    expect(sheet).toHaveTextContent('Abhijit muhurta');
    expect(sheet).toHaveTextContent('Jupiter hora');
  });

  it('groups Why under "For everyone" and "For you", names the yoga and karana only there', async () => {
    const keys = ['abhijit', 'hora:Jupiter', 'yoga:Siddhi', 'karana:Taitila', 'personal:tara_good', 'personal:hora_benefic'];
    windowOverride = { from: 690, to: 731, score: 9, reasons: keys.map((key) => ({ key, scope: key.startsWith('personal:') ? 'personal' : 'general' })), reasonKeys: keys };
    limbs = { yoga: { name: 'Siddhi', endHour: 15.65 }, karana: { name: 'Taitila', endHour: 21 } };
    state.place = 'sanjose';
    state.picks = [{ scenario: 'work.sign_contract', shown: true, answers: {} }];
    render(<LuckyTimesPage />);
    const card = await screen.findByTestId('today-work.sign_contract');
    for (const w of [...BANNED_ON_BOARD, 'yoga', 'karana', 'siddhi', 'taitila', 'benefic']) expect(boardText()).not.toContain(w);
    expect(card).toHaveTextContent('an easy flow');
    fireEvent.click(within(card).getByRole('button', { name: /11:30/ }));
    const general = await screen.findByTestId('why-general');
    const personal = screen.getByTestId('why-personal');
    expect(general).toHaveTextContent('For everyone');
    expect(general).toHaveTextContent('Siddhi yoga, which the texts favour');
    expect(general).toHaveTextContent('Taitila karana, good for most acts');
    expect(general).toHaveTextContent('Yoga of the day: Siddhi, until 15:39');
    expect(general).not.toHaveTextContent('tara');
    expect(personal).toHaveTextContent('For you');
    expect(personal).toHaveTextContent('Your tara bala is good today');
    expect(personal).toHaveTextContent('The hora lord is a functional benefic in your chart');
    expect(personal).not.toHaveTextContent('Abhijit');
  });

  it('an older server (plain keys) still gets both groups, by the personal: prefix', async () => {
    windowOverride = { from: 690, to: 731, score: 7, reasons: ['abhijit', 'personal:moon_good'] };
    state.place = 'sanjose';
    state.picks = [{ scenario: 'work.sign_contract', shown: true, answers: {} }];
    render(<LuckyTimesPage />);
    const card = await screen.findByTestId('today-work.sign_contract');
    fireEvent.click(within(card).getByRole('button', { name: /11:30/ }));
    expect(await screen.findByTestId('why-general')).toHaveTextContent('Overlaps Abhijit muhurta');
    expect(screen.getByTestId('why-personal')).toHaveTextContent('Your chandra bala is good today');
  });

  it('logs what the person clicks', async () => {
    state.place = 'sanjose';
    render(<LuckyTimesPage />);
    fireEvent.click(await screen.findByRole('button', { name: /Add a plan/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sign a contract' }));
    await screen.findByTestId('today-work.sign_contract');
    fireEvent.click(screen.getByRole('tab', { name: 'Calendar' }));
    const names = events._queued().map((e) => e.event);
    expect(names).toEqual(expect.arrayContaining(['page_view', 'add_menu_open', 'scenario_add', 'view_select']));
    await act(async () => {
      await events.flushEvents();
    });
    expect(calls.some((c) => c.url.endsWith('/api/analytics/events') && c.body.events.length >= 4)).toBe(true);
  });
});
