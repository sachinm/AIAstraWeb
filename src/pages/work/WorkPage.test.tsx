import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import WorkPage, { headline } from './WorkPage';
import { BANNED_ON_BOARD } from '../lucky/words';
import type { CareerMap } from '../../lib/careerApi';

function map(over: Partial<CareerMap['present']> = {}): CareerMap {
  const w = (subarea: string, side: 'support' | 'test', from: string, to: string, band: 'possible' | 'moderate' | 'high' = 'moderate') => ({ subarea, side, from, to, peakMonth: from.slice(0, 7), band, score: 5, families: ['main', 'rasi'], drivers: ['Ju'], ...(side === 'test' ? { security: 'watch' as const } : {}) });
  return {
    asOf: '2026-11-05',
    month: '2026-11',
    present: { tone: 'demanding', confidence: 'likely', votes: [{ family: 'main', label: 'Main clock', vote: 'test', planet: 'Sa' }, { family: 'transit', label: 'Slow transits', vote: 'test', planet: 'Sa' }, { family: 'rasi', label: 'Sign clock', vote: 'neutral', planet: null }], available: 5, agree: 2, ease_date: '2026-12-10', window_end: null, next_window_start: null, security: 'watch', ...over },
    ahead: [w('job_security', 'test', '2026-11-01', '2026-12-09'), w('promotion', 'support', '2027-03-01', '2027-05-31', 'high'), w('job_change', 'support', '2027-03-01', '2027-05-31')],
    horizons: [
      { months: 1, best: null, hardest: w('job_security', 'test', '2026-11-01', '2026-12-09'), quiet: false },
      { months: 3, best: null, hardest: null, quiet: true },
      { months: 6, best: w('promotion', 'support', '2027-03-01', '2027-05-31', 'high'), hardest: null, quiet: false },
      { months: 12, best: w('promotion', 'support', '2027-03-01', '2027-05-31', 'high'), hardest: null, quiet: false },
    ],
    security: [],
    back: [{ month: '2026-03', side: 'test', band: 'moderate', label: 'a demanding stretch at work began' }, { month: '2025-12', side: 'support', band: 'high', label: 'a good stretch at work began' }],
    notes: [],
  };
}

let state: { work: string | null; checks: Record<string, string>; map: CareerMap; status: number };
let calls: Array<{ method: string; url: string; body?: any }>;

beforeEach(() => {
  localStorage.setItem('token', 't');
  calls = [];
  state = { work: null, checks: {}, map: map(), status: 200 };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const method = (init.method ?? 'GET').toUpperCase();
      const body = init.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ method, url, body });
      if (url.endsWith('/api/area/career')) return new Response(state.status === 200 ? JSON.stringify({ status: 'ok', map: state.map, work: state.work, checks: state.checks }) : JSON.stringify({ error: 'x' }), { status: state.status });
      if (url.endsWith('/api/profile/work-status')) {
        state.work = body.value;
        return new Response(null, { status: 204 });
      }
      if (url.endsWith('/api/area/career/checks')) {
        state.checks[body.month] = body.answer;
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

const text = () => screen.getByTestId('work-page').textContent!.toLowerCase();

describe('Work board', () => {
  it('leads with the tone and a dated headline, never a weather or hospital word', async () => {
    render(<WorkPage />);
    const card = await screen.findByTestId('tone-card');
    expect(card).toHaveAttribute('data-tone', 'demanding');
    expect(card).toHaveTextContent('Demanding');
    expect(card).toHaveTextContent('It eases from 10 Dec 2026');
    expect(card).toHaveTextContent('Most of your chart points this way.');
    for (const w of [...BANNED_ON_BOARD, 'lobby', 'er ', 'season', 'clearing', 'late summer']) expect(text()).not.toContain(w);
  });
  it('writes a headline for every tone', () => {
    expect(headline(map({ tone: 'open', window_end: '2027-05-07', ease_date: null }))).toBe('A strong stretch at work. Ask before 7 May 2027.');
    expect(headline(map({ tone: 'closing', window_end: '2026-11-30', ease_date: null }))).toBe('Finish what you started before 30 Nov 2026.');
    expect(headline(map({ tone: 'steady', next_window_start: '2027-03-01', ease_date: null }))).toBe('A steady period at work. Build until 1 Mar 2027.');
    expect(headline(map({ tone: 'easing' }))).toBe('The pressure is lifting. From 10 Dec 2026, a better time to move.');
  });
  it('asks once whether the person has a job, and stops asking after the answer', async () => {
    render(<WorkPage />);
    const q = await screen.findByTestId('work-question');
    fireEvent.click(within(q).getByRole('button', { name: 'Between jobs' }));
    await waitFor(() => expect(screen.queryByTestId('work-question')).not.toBeInTheDocument());
    expect(calls.some((c) => c.method === 'PUT' && c.body?.value === 'between_jobs')).toBe(true);
  });
  it('splits into four pages instead of a long scroll', async () => {
    render(<WorkPage />);
    await screen.findByTestId('tone-card');
    expect(screen.getAllByRole('tab').slice(0, 4).map((t) => t.textContent)).toEqual(['Now', 'Looking back', 'Ahead', 'Your questions']);
    expect(screen.getByTestId('security-card')).toHaveTextContent('Keep an eye on things');
  });
  it('Looking back asks about past moments and counts the confirmations', async () => {
    state.work = 'yes';
    render(<WorkPage />);
    fireEvent.click(await screen.findByRole('tab', { name: 'Looking back' }));
    const card = screen.getByTestId('back-2026-03');
    expect(card).toHaveTextContent('Around then, a demanding stretch at work began.');
    fireEvent.click(within(card).getByRole('button', { name: 'Yes' }));
    expect(await screen.findByTestId('confirmed-line')).toHaveTextContent('You confirmed 1 of 1.');
  });
  it('Ahead shows one horizon at a time, and a quiet one says so', async () => {
    state.work = 'yes';
    render(<WorkPage />);
    fireEvent.click(await screen.findByRole('tab', { name: 'Ahead' }));
    expect(screen.getByTestId('rung-1')).toHaveTextContent('Job security: 1 Nov 2026 – 9 Dec 2026');
    fireEvent.click(screen.getByRole('tab', { name: '3 months' }));
    expect(screen.getByTestId('rung-3')).toHaveTextContent('Nothing large is moving.');
  });
  it('the questions page filters by sub-area', async () => {
    state.work = 'yes';
    render(<WorkPage />);
    fireEvent.click(await screen.findByRole('tab', { name: 'Your questions' }));
    fireEvent.click(screen.getByRole('button', { name: 'A promotion' }));
    expect(screen.getByText('A strong opening · 2 of 5 families agree')).toBeInTheDocument();
  });
  it('Why lists the families in plain words', async () => {
    render(<WorkPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Why we think so' }));
    const sheet = screen.getByTestId('why-sheet');
    expect(sheet).toHaveTextContent('2 of 5 independent timing families agree.');
    expect(sheet).toHaveTextContent('Main clock points to a harder stretch');
  });
  it('says the board is coming when the server does not serve it', async () => {
    state.status = 404;
    render(<WorkPage />);
    expect(await screen.findByText('The Work board is coming soon.')).toBeInTheDocument();
  });
  it('renders 3-decade Work evolution, Vocation Blueprint with 4 career choices, technique badges, and Master-Detail questions inspector', async () => {
    render(<WorkPage />);
    await screen.findByTestId('tone-card');
    expect(screen.getByTestId('question-technique-badge')).toHaveTextContent('work.status');
    expect(screen.getByTestId('work-character-arc')).toHaveTextContent('Your Standing Today');
    expect(screen.getByTestId('work-personality-vocation')).toHaveTextContent('Best-Fit Choices of Work & Vocation Domains');
    expect(screen.getByTestId('vocation-choice-0')).toBeInTheDocument();
    expect(screen.getByTestId('vocation-choice-3')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Your questions' }));
    fireEvent.click(screen.getByRole('button', { name: 'A promotion' }));
    expect(screen.getByTestId('findings-list-view')).toBeInTheDocument();
    expect(screen.getByTestId('finding-detail-panel')).toHaveTextContent('Main Period Clock (Vimshottari)');
  });
});
