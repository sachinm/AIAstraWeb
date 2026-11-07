import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import YouPage, { youHeadline } from './YouPage';
import { BANNED_ON_BOARD } from '../lucky/words';
import type { AreaBoard } from '../../lib/areaApi';

function youBoard(over: Partial<AreaBoard['tone']> = {}): AreaBoard {
  return {
    asOf: '2026-11-05',
    tone: { tone: 'open', confidence: 'likely', families: [{ family: 'main', vote: 'support' }, { family: 'rasi', vote: 'support' }, { family: 'annual', vote: 'neutral' }], date: '2027-05-31', ...over },
    supports: [
      { text: 'Your sense of self has firm footing.', evidence: ['D1.h1 lord Ma in h10 (kendra)'] },
      { text: 'Something steady watches over your feelings.', evidence: ['D1.Mo aspected_by Ju'] },
    ],
    pressures: [
      { text: 'A heavy influence presses on your peace of mind.', until: '2031-03-01', evidence: ['D1.h4 occupant Sa'] },
      { text: 'Your ideas and learning takes more effort than it looks.', until: null, evidence: ['D1.h5 lord Su in h8 (dusthana)'] },
    ],
    ahead: [
      { subarea: 'growth', label: 'A clear stretch for a fresh start', from: '2026-11-05', to: '2027-05-31', side: 'support', grade: 'strong', systems: ['vimshottari', 'yogini'] },
      { subarea: 'mind', label: 'A slower stretch: give it room', from: '2027-06-01', to: '2028-10-31', side: 'test', grade: 'moderate', systems: ['vimshottari'] },
      { subarea: 'purpose', label: 'A good stretch to build', from: '2026-11-05', to: '2027-05-31', side: 'support', grade: 'moderate', systems: ['vimshottari'] },
    ],
    year: { year: 2026, note: "This year's chart backs you: a good year to begin something of your own." },
    back: [{ month: '2026-02', side: 'support', label: 'a lighter, stronger stretch for you began' }, { month: '2025-09', side: 'test', label: 'a heavier stretch for you began' }],
    notes: [],
    characterArc: {
      headline: 'How your character has grown over the last decade, where you stand today, and who you are becoming next',
      pastDecade: {
        stage: 'past_10y',
        label: 'Last 10 Years',
        windowLabel: '2016–2026',
        headline: 'Building grit and foundational craft',
        summary: 'Over the past decade you learned to stand on your own feet through steady discipline and hands-on skill.',
        anchorTrait: 'Self-reliant persistence',
        evidence: ['vimsottari:L1:2016..2026'],
      },
      presentNow: {
        stage: 'now',
        label: 'Who You Are Now',
        windowLabel: '2026',
        headline: 'Clear-headed focus and calm authority',
        summary: 'Today you balance high personal standards with a calmer inner center and clearer boundaries.',
        anchorTrait: 'Grounded discernment',
        evidence: ['D1.h1', 'D9.h1'],
      },
      nextDecade: {
        stage: 'next_10y',
        label: 'Next 10 Years',
        windowLabel: '2026–2036',
        headline: 'Stepping into mentorship and deeper peace',
        summary: 'Over the next ten years your focus shifts from proving yourself to guiding others and building lasting peace at home.',
        anchorTrait: 'Wise stewardship',
        evidence: ['vimsottari:L1:2026..2036', 'D9.AK'],
      },
    },
    personalityAndJoy: {
      headline: 'Warm emotional steadiness paired with quick, practical curiosity',
      personalitySummary: 'People experience you as observant, thoughtful, and quietly dependable—someone who listens first and speaks with clarity.',
      emotionalMindStyle: 'Your feelings settle best in calm, uncluttered spaces with people you trust deeply.',
      intellectualWitStyle: 'Your mind lights up when solving real problems, learning how systems work, and sharing dry, perceptive humor.',
      whatFeelsGood: [
        { title: 'Deep, unhurried conversations', whyItFits: 'One-on-one time with trusted friends recharges your heart faster than noisy crowds.', evidence: ['D1.Mo', 'D1.h4'] },
        { title: 'Hands-on building & learning', whyItFits: 'Mastering a practical craft, writing, or structured study gives your mind a clean sense of flow.', evidence: ['D1.Me', 'D1.h5'] },
      ],
      rechargeRule: 'Protect quiet evenings and unhurried morning routines to keep your mind bright.',
      evidence: ['D1.Mo', 'D9.Mo', 'D1.Me', 'D9.Me'],
    },
  };
}

let state: { status: number; body: any; checks: Record<string, string>; ask: boolean; focus: string | null };
let calls: Array<{ method: string; url: string; body?: any }>;

beforeEach(() => {
  localStorage.setItem('token', 't');
  calls = [];
  state = { status: 200, body: null, checks: {}, ask: true, focus: 'growth' };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const method = (init.method ?? 'GET').toUpperCase();
      const body = init.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ method, url, body });
      if (url.endsWith('/api/area/self')) {
        if (state.status !== 200) return new Response(JSON.stringify(state.body ?? { error: 'x' }), { status: state.status });
        return new Response(JSON.stringify({ status: 'ok', built_at: '2026-11-05', cached: true, focus: state.focus, ask: state.ask, board: youBoard(), checks: state.checks }), { status: 200 });
      }
      if (url.endsWith('/api/profile/facts')) {
        state.ask = false;
        return new Response(null, { status: 204 });
      }
      if (url.endsWith('/api/area/self/checks')) {
        state.checks[body.month] = body.answer;
        return new Response(null, { status: 204 });
      }
      return new Response(null, { status: 204 });
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  localStorage.clear();
});

const text = () => screen.getByTestId('you-page').textContent!.toLowerCase();

describe('You board', () => {
  it('shows loading first', () => {
    render(<YouPage />);
    expect(screen.getByTestId('board-loading')).toBeInTheDocument();
  });
  it('leads with the tone and a dated headline, with no chart terms on screen', async () => {
    render(<YouPage />);
    const card = await screen.findByTestId('tone-card');
    expect(card).toHaveAttribute('data-tone', 'open');
    expect(card).toHaveTextContent('A clear stretch for a fresh start. Begin before 31 May 2027.');
    expect(card).toHaveTextContent('Most of your chart points this way.');
    for (const w of [...BANNED_ON_BOARD, 'house', 'lord', 'kendra', 'dusthana', 'aspected', 'd1.']) expect(text()).not.toContain(w);
  });
  it('writes a headline for every tone', () => {
    expect(youHeadline(youBoard({ tone: 'demanding', date: '2027-01-18' }))).toBe('A heavy stretch for you. It lightens from 18 Jan 2027.');
    expect(youHeadline(youBoard({ tone: 'easing', date: '2027-01-18' }))).toBe("You're coming out of it. From 18 Jan 2027, a better time to start.");
    expect(youHeadline(youBoard({ tone: 'steady', date: '2027-08-24' }))).toBe('A steady stretch. Good for habits and rest until 24 Aug 2027.');
    expect(youHeadline(youBoard({ tone: 'closing', date: '2026-10-12' }))).toBe('A strong stretch for change closes 12 Oct 2026.');
    expect(youHeadline(youBoard({ tone: 'steady', date: null }))).toBe('A steady stretch. Good for habits and rest.');
  });
  it('asks once what the person is working on, saves it to the companion memory, and stops asking', async () => {
    render(<YouPage />);
    const q = await screen.findByTestId('board-question');
    expect(q).toHaveTextContent('What are you most working on for yourself?');
    fireEvent.click(within(q).getByRole('button', { name: 'Learning' }));
    await waitFor(() => expect(screen.queryByTestId('board-question')).not.toBeInTheDocument());
    expect(calls.find((c) => c.method === 'PUT' && c.url.endsWith('/api/profile/facts'))!.body).toEqual({ facts: { 'self.focus': 'learning' } });
  });
  it('splits into pages instead of a long scroll; supports and pressures with their release dates', async () => {
    render(<YouPage />);
    await screen.findByTestId('tone-card');
    expect(screen.getAllByRole('tab').slice(0, 5).map((t) => t.textContent)).toEqual(['Now', 'What holds you up', 'What presses', 'Ahead', 'Looking back']);
    expect(screen.getByTestId('year-card')).toHaveTextContent("This year's chart backs you");
    expect(screen.getByTestId('lead-card')).toHaveTextContent('Learning and growth');
    expect(screen.getByTestId('self-character-arc')).toHaveTextContent('Last 10 Years');
    expect(screen.getByTestId('self-character-arc')).toHaveTextContent('Who You Are Now');
    expect(screen.getByTestId('self-character-arc')).toHaveTextContent('Next 10 Years');
    expect(screen.getByTestId('self-personality-joy')).toHaveTextContent('Warm emotional steadiness');
    expect(screen.getByTestId('joy-item-0')).toHaveTextContent('Deep, unhurried conversations');
    fireEvent.click(screen.getByRole('tab', { name: 'What holds you up' }));
    expect(screen.getByTestId('holds')).toHaveTextContent('Your sense of self has firm footing.');
    fireEvent.click(screen.getByRole('tab', { name: 'What presses' }));
    const presses = screen.getByTestId('presses');
    expect(presses).toHaveTextContent('Eases by 1 Mar 2031');
    expect(presses).toHaveTextContent('A steady weight');
  });
  it('Ahead is one panel per topic: chips, a carousel on the phone and a tab panel on the desktop, the focus first', async () => {
    render(<YouPage />);
    fireEvent.click(await screen.findByRole('tab', { name: 'Ahead' }));
    const chips = within(screen.getByRole('tablist', { name: 'Ahead by topic' })).getAllByRole('tab');
    expect(chips.map((c) => c.textContent)).toEqual(['Learning and growth', 'Peace of mind', 'Purpose and belief']);
    expect(chips[0]).toHaveAttribute('aria-selected', 'true');
    expect(within(screen.getByTestId('ahead-carousel')).getAllByTestId(/^ahead-/)).toHaveLength(3);
    fireEvent.click(chips[1]!);
    expect(within(screen.getByTestId('ahead-tabpanel')).getByTestId('ahead-mind')).toHaveTextContent('A slower stretch: give it room');
    expect(within(screen.getByTestId('ahead-tabpanel')).getByTestId('ahead-mind')).toHaveTextContent('1 Jun 2027 – 31 Oct 2028');
  });
  it('Looking back asks about past moments and counts the confirmations', async () => {
    render(<YouPage />);
    fireEvent.click(await screen.findByRole('tab', { name: 'Looking back' }));
    const card = screen.getByTestId('back-2026-02');
    expect(card).toHaveTextContent('Around then, a lighter, stronger stretch for you began.');
    fireEvent.click(within(card).getByRole('button', { name: 'Yes' }));
    expect(await screen.findByTestId('confirmed-line')).toHaveTextContent('You confirmed 1 of 1.');
    expect(calls.some((c) => c.method === 'POST' && c.url.endsWith('/api/area/self/checks') && c.body.side === 'support')).toBe(true);
  });
  it('Why lists the signals in plain words', async () => {
    render(<YouPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Why we think so' }));
    const sheet = screen.getByTestId('why-sheet');
    expect(sheet).toHaveTextContent('2 of 3 independent signals have a view.');
    expect(sheet).toHaveTextContent('Your main timing clock points to a good stretch');
    expect(sheet).toHaveTextContent("This year's chart is quiet");
  });
  it('preparing: says the chart is being prepared and checks again by itself', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    state.status = 202;
    state.body = { status: 'preparing' };
    render(<YouPage />);
    expect(await screen.findByTestId('board-preparing')).toHaveTextContent('Your chart is still being prepared');
    state.status = 200;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(await screen.findByTestId('tone-card')).toBeInTheDocument();
  });
  it('no kundli, off, and an error with retry', async () => {
    state.status = 404;
    state.body = { status: 'no_kundli', error: 'no_kundli' };
    const a = render(<YouPage />);
    expect(await screen.findByTestId('board-no-kundli')).toHaveTextContent('Add your birth details');
    a.unmount();
    state.body = { error: 'not_found' };
    const b = render(<YouPage />);
    expect(await screen.findByText('The You board is coming soon.')).toBeInTheDocument();
    b.unmount();
    state.status = 500;
    render(<YouPage />);
    const err = await screen.findByTestId('board-error');
    state.status = 200;
    fireEvent.click(within(err).getByRole('button', { name: 'Retry' }));
    expect(await screen.findByTestId('tone-card')).toBeInTheDocument();
  });
  it('renders Master-Detail findings inspector, Focus/Timeframe dropdowns, Your questions tab, and top-right technique badges', async () => {
    render(<YouPage />);
    await screen.findByTestId('tone-card');
    expect(screen.getByTestId('question-technique-badge')).toHaveTextContent('self.focus');
    expect(screen.getAllByTestId('panel-technique-badge').length).toBeGreaterThanOrEqual(4);
    expect(screen.getByTestId('board-focus-dropdown')).toBeInTheDocument();
    expect(screen.getByTestId('board-timeframe-dropdown')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'What holds you up' }));
    const list = screen.getByTestId('findings-list-view');
    const detail = screen.getByTestId('finding-detail-panel');
    expect(list).toBeInTheDocument();
    expect(detail).toHaveTextContent('Your sense of self has firm footing.');
    fireEvent.click(screen.getByTestId('finding-item-1'));
    expect(detail).toHaveTextContent('Something steady watches over your feelings.');
    expect(screen.getByTestId('finding-detail-promise')).toBeInTheDocument();
    expect(screen.getByTestId('finding-detail-charter')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Your questions' }));
    expect(screen.getByTestId('questions-page')).toHaveTextContent('Fresh life chapter');
    expect(screen.getByTestId('questions-page')).toHaveTextContent('Vedic timing clocks align');
  });
});
