import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TodayPage, { todayTitle } from './TodayPage';
import { BANNED_ON_BOARD } from '../lucky/words';

const CAREER = {
  status: 'ok',
  work: 'yes',
  checks: {},
  map: { asOf: '2026-11-05', month: '2026-11', present: { tone: 'open', confidence: 'confirmed', votes: [], available: 5, agree: 4, ease_date: null, window_end: '2027-05-07', next_window_start: null, security: 'clear' }, ahead: [], horizons: [], security: [], back: [], notes: [] },
};

beforeEach(() => {
  localStorage.setItem('token', 't');
  vi.stubEnv('VITE_AREA_ENABLED', '1');
  vi.stubEnv('VITE_LUCKY_ENABLED', '1');
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url.endsWith('/api/area/career')) return new Response(JSON.stringify(CAREER), { status: 200 });
      if (url.endsWith('/api/lucky/setup'))
        return new Response(JSON.stringify({ place: 'sanjose', places: [], scenarios: [{ area: 'work', label: 'Work', scenarios: [{ id: 'work.sign_contract', label: 'Sign a contract', ask: null }] }], picks: [{ scenario: 'work.sign_contract', shown: true, answers: {} }] }), { status: 200 });
      if (url.includes('/api/lucky/range'))
        return new Response(
          JSON.stringify({ status: 'ok', place: 'sanjose', today: '2026-11-05', nowMin: 700, from: '2026-10-29', to: '2026-11-19', missing: [], now: { kind: 'avoid', band: 'rahu_kalam', until: 866 }, days: [{ date: '2026-11-05', weekday: 'Thursday', sunrise: 400, sunset: 1020, personal: null, avoid: [], good: [], layers: { 'work.sign_contract': { verdict: 'good', windows: [{ from: 690, to: 731, score: 7, reasons: [] }], dayReasons: [] } } }] }),
          { status: 200 },
        );
      return new Response(null, { status: 204 });
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  localStorage.clear();
});

describe('Today', () => {
  it('leads with the running window, then one card per board, then today’s plans', async () => {
    render(<MemoryRouter><TodayPage /></MemoryRouter>);
    expect(await screen.findByText('Better to wait until 14:26 before starting anything new.')).toBeInTheDocument();
    expect(await screen.findByTestId('board-work')).toHaveTextContent('Open');
    expect(screen.getByTestId('board-work')).toHaveTextContent('A strong stretch at work. Ask before 7 May 2027.');
    expect(screen.getByTestId('board-love')).toHaveTextContent('Coming next');
    expect(await screen.findByTestId('today-lucky')).toHaveTextContent('Sign a contract11:30–12:11');
    const t = screen.getByTestId('today-page').textContent!.toLowerCase();
    for (const w of BANNED_ON_BOARD) expect(t).not.toContain(w);
    expect(t).not.toContain('san jose');
  });
  it('titles the day as a person says it', () => {
    expect(todayTitle(new Date('2026-11-05T12:00:00Z'))).toMatch(/Thursday,? 5 Nov/);
  });
});
