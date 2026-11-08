import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import SelfReading, { clockLabel, SELF_WORDS } from './SelfReading';
import { selfReadingFixture } from './selfReading.fixture';
import { BANNED_ON_BOARD } from '../lucky/words';
import { longDate } from '../../lib/careerApi';
import type { SelfReading as SelfReadingData } from '../../lib/selfReadingApi';

const BANNED = [...BANNED_ON_BOARD, 'house', 'lord', 'dasha', 'mahadasha', 'antardasha', 'nakshatra', 'varga', 'd1.', 'd9.'];
const TITLES = ['Who you are', 'Your mind', "Your soul's aim", 'Gifts and knots', 'What you struggle with', 'Your chapters', 'This year'];

let srv: { status: number; body: unknown; clock: string; edit: (r: SelfReadingData) => void };
let calls: Array<{ method: string; url: string; body?: any }>;

beforeEach(() => {
  localStorage.setItem('token', 't');
  calls = [];
  srv = { status: 200, body: null, clock: 'dwisatpathi', edit: () => {} };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const method = (init.method ?? 'GET').toUpperCase();
      const body = init.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ method, url, body });
      if (url.endsWith('/api/self/reading') && method === 'GET') {
        if (srv.status !== 200) return new Response(JSON.stringify(srv.body ?? { error: 'x' }), { status: srv.status });
        const reading = selfReadingFixture(srv.clock);
        srv.edit(reading);
        return new Response(JSON.stringify({ status: 'ok', built_at: '2026-11-07', cached: true, reading }), { status: 200 });
      }
      if (url.endsWith('/api/self/reading/confirm')) return new Response(null, { status: 204 });
      if (url.endsWith('/api/self/clock')) {
        srv.clock = body.system ?? 'dwisatpathi';
        return new Response(JSON.stringify({ clock: srv.clock }), { status: 200 });
      }
      return new Response(null, { status: 404 });
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  localStorage.clear();
});

const gets = () => calls.filter((c) => c.method === 'GET' && c.url.endsWith('/api/self/reading')).length;

describe('Your reading', () => {
  it('shows "Reading your chart…" while loading', () => {
    render(<SelfReading />);
    expect(screen.getByTestId('self-reading-loading')).toHaveTextContent(SELF_WORDS.loading);
  });

  it('preparing: says so and polls every 30 s until the reading is ready', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    srv.status = 202;
    srv.body = { status: 'preparing' };
    render(<SelfReading />);
    expect(await screen.findByTestId('self-reading-preparing')).toHaveTextContent('Your chart is still being prepared. This page will update by itself.');
    expect(gets()).toBe(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    await waitFor(() => expect(gets()).toBe(2));
    expect(screen.getByTestId('self-reading-preparing')).toBeInTheDocument();
    srv.status = 200;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(await screen.findByTestId('self-reading')).toBeInTheDocument();
    expect(gets()).toBe(3);
  });

  it('no kundli and off', async () => {
    srv.status = 404;
    srv.body = { status: 'no_kundli' };
    const a = render(<SelfReading />);
    expect(await screen.findByTestId('self-reading-no-kundli')).toBeInTheDocument();
    a.unmount();
    srv.body = { error: 'not_found' };
    render(<SelfReading />);
    expect(await screen.findByTestId('self-reading-unavailable')).toBeInTheDocument();
  });

  it('renders the clock line, every panel title, chips and the desktop tab list, and never the gaps', async () => {
    render(<SelfReading />);
    const root = await screen.findByTestId('self-reading');
    expect(screen.getByTestId('self-clock-line')).toHaveTextContent('Read on your Dwisaptati Sama clock · Change');
    expect(within(screen.getByTestId('self-chips')).getAllByRole('tab').map((t) => t.textContent)).toEqual(TITLES);
    expect(within(screen.getByTestId('self-tabs')).getAllByRole('tab').map((t) => t.textContent)).toEqual(TITLES);
    const carousel = screen.getByTestId('self-carousel');
    for (const t of TITLES) expect(within(carousel).getByRole('heading', { name: t })).toBeInTheDocument();
    // desktop shows the first panel, and a tab switches it
    expect(within(screen.getByTestId('self-tabpanel')).getByRole('heading')).toHaveTextContent('Who you are');
    fireEvent.click(within(screen.getByTestId('self-tabs')).getByRole('tab', { name: 'Your mind' }));
    expect(within(screen.getByTestId('self-tabpanel')).getByRole('heading')).toHaveTextContent('Your mind');
    expect(root.textContent).not.toContain('STAFF-GAP');
    expect(root.textContent).not.toContain('varsha_missing_point');
  });

  it('a withheld claim says the person told us it did not fit', async () => {
    render(<SelfReading />);
    const panel = within(await screen.findByTestId('self-carousel')).getByTestId('self-panel-lagna');
    expect(within(panel).getByTestId('self-claim-lagna.occupant')).toHaveTextContent('You told us this did not fit.');
    expect(panel).not.toHaveTextContent('People notice you before you speak.');
    expect(panel).toHaveTextContent('Your sense of self grows through your work and public role.');
  });

  it('chapters: previous, running, next in order, dates, sub-chapter, split text and the confirmation line', async () => {
    render(<SelfReading />);
    const ch = within(await screen.findByTestId('self-carousel')).getByTestId('self-chapters');
    const cards = within(ch).getAllByRole('article');
    expect(cards.map((c) => c.getAttribute('data-testid'))).toEqual(['chapter-previous', 'chapter-running', 'chapter-next']);
    const running = within(ch).getByTestId('chapter-running');
    expect(within(running).getByTestId('chapter-dates-running')).toHaveTextContent('16 Feb 2019 – 16 Feb 2028');
    expect(running).toHaveTextContent('A chapter of ambition and reaching past where you started.');
    expect(within(running).getByTestId('chapter-confirmed-running')).toHaveTextContent('Confirmed by Vimshottari and Chara');
    expect(within(running).getByTestId('chapter-sub')).toHaveTextContent('2 Mar 2026 – 14 May 2027');
    expect(within(running).getByTestId('chapter-sub')).toHaveTextContent('Now the focus turns to partners and comfort.');
    expect(within(running).getByTestId('chapter-next-sub')).toHaveTextContent(`Then: ${longDate('2027-05-14')} – ${longDate('2027-09-20')}`);
    const prev = within(ch).getByTestId('chapter-previous');
    expect(prev).toHaveTextContent('16 Feb 2010 – 16 Feb 2019');
    expect(within(prev).getByTestId('chapter-confirmed-previous')).toHaveTextContent('Confirmed by Vimshottari');
    const next = within(ch).getByTestId('chapter-next');
    expect(next).toHaveTextContent('Your other clocks do not mark a turn here');
    expect(within(next).queryByTestId('chapter-confirmed-next')).not.toBeInTheDocument();
  });

  it('Chart details is off by default and reveals the detail, evidence and technique id', async () => {
    render(<SelfReading />);
    const tp = await screen.findByTestId('self-tabpanel');
    expect(within(tp).queryByTestId('self-chart-detail')).not.toBeInTheDocument();
    expect(tp).not.toHaveTextContent('self.reading.lagna');
    const toggle = within(tp).getByRole('button', { name: 'Chart details' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(tp).toHaveTextContent('Lagna Leo; lagna lord Su in D1.h10, dignity friendly.');
    expect(tp).toHaveTextContent('planet:D1.Su');
    // the withheld claim keeps its detail under Chart details
    expect(tp).toHaveTextContent('Ma occupies D1.h1 in Leo.');
    expect(within(tp).getByTestId('self-panel-technique')).toHaveTextContent('self.reading.lagna · 0 ms · cached');
    fireEvent.click(toggle);
    expect(within(tp).queryByTestId('self-chart-detail')).not.toBeInTheDocument();
  });

  it('the question posts the answer, says thanks and hides', async () => {
    render(<SelfReading />);
    const q = await screen.findByTestId('self-question');
    expect(q).toHaveTextContent('Do you feel most yourself when you are leading at work?');
    expect(within(q).getAllByRole('button').map((b) => b.textContent)).toEqual(['Yes', 'Partly', 'No', 'Skip']);
    fireEvent.click(within(q).getByRole('button', { name: 'Partly' }));
    expect(await screen.findByTestId('self-question-thanks')).toHaveTextContent('Thanks, noted.');
    expect(screen.queryByTestId('self-question')).not.toBeInTheDocument();
    const post = calls.find((c) => c.method === 'POST' && c.url.endsWith('/api/self/reading/confirm'))!;
    expect(post.body).toEqual({ claimId: 'lagna.lord_house', answer: 'partly' });
  });

  it('changing the clock calls PUT then reloads the reading', async () => {
    render(<SelfReading />);
    await screen.findByTestId('self-reading');
    expect(gets()).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: 'Change' }));
    const sheet = screen.getByTestId('self-clock-sheet');
    expect(within(sheet).getAllByRole('button', { pressed: true }).map((b) => b.textContent)).toEqual(['Dwisaptati Sama']);
    fireEvent.click(within(sheet).getByRole('button', { name: 'Vimshottari' }));
    await waitFor(() => expect(screen.getByTestId('self-clock-line')).toHaveTextContent('Read on your Vimshottari clock'));
    const put = calls.findIndex((c) => c.method === 'PUT' && c.url.endsWith('/api/self/clock'));
    expect(calls[put]!.body).toEqual({ system: 'vimshottari' });
    expect(gets()).toBe(2);
    expect(calls.slice(put + 1).some((c) => c.method === 'GET' && c.url.endsWith('/api/self/reading'))).toBe(true);
    expect(screen.queryByTestId('self-clock-sheet')).not.toBeInTheDocument();
  });

  it('no banned or chart word in the reading text with Chart details closed (clock and confirmation lines name only clocks)', async () => {
    render(<SelfReading />);
    const root = await screen.findByTestId('self-reading');
    const exempt = [screen.getByTestId('self-clock-label'), ...screen.getAllByTestId(/^chapter-confirmed-/)];
    let body = root.textContent!;
    for (const e of exempt) body = body.split(e.textContent!).join(' ');
    for (const w of BANNED) expect(body.toLowerCase(), w).not.toContain(w);
    for (const e of exempt) for (const w of BANNED_ON_BOARD) expect(e.textContent!.toLowerCase(), w).not.toContain(w);
  });

  it('a clock label never shows the word dasha', () => {
    expect(clockLabel('Vimshottari Dasha')).toBe('Vimshottari');
    expect(clockLabel('Chara dasha')).toBe('Chara');
    expect(clockLabel('Dwisaptati Sama')).toBe('Dwisaptati Sama');
  });

  it('a failed panel and a withheld panel say so in plain words', async () => {
    srv.edit = (r) => {
      r.panels.find((p) => p.id === 'mind')!.status = 'failed';
      r.panels.find((p) => p.id === 'year')!.status = 'withheld';
    };
    render(<SelfReading />);
    const carousel = await screen.findByTestId('self-carousel');
    const mind = within(carousel).getByTestId('self-panel-mind');
    expect(mind).toHaveTextContent('This part could not be read just now.');
    expect(mind).not.toHaveTextContent('You need quiet to think clearly.');
    expect(within(carousel).getByTestId('self-panel-year')).toHaveTextContent('Not enough in your chart to say this with confidence.');
  });
});
