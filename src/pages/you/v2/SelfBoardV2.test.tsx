import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import SelfBoardV2, { boardMode, V2_MAX_WAIT_MS, V2_POLL_MS } from './SelfBoardV2';
import { V2_AREAS, selfV2Fixture } from './selfV2.fixture';
import { V2_WORDS } from './words';
import type { SelfV2Response } from '../../../lib/selfV2Api';

const plan = vi.hoisted(() => ({ setPlan: vi.fn(), refreshPlan: vi.fn(async () => {}) }));
vi.mock('../../../Auth/ProfileGate', () => ({ usePlan: () => ({ plan: null, setPlan: plan.setPlan, refreshPlan: plan.refreshPlan }) }));

let srv: { status: number; board: () => SelfV2Response | null; clockStatus: number; clockBody: unknown };
let calls: Array<{ method: string; url: string; body?: any; headers?: Record<string, string> }>;

function setViewport(w: number, h: number) {
  Object.defineProperty(window, 'innerWidth', { value: w, configurable: true, writable: true });
  Object.defineProperty(window, 'innerHeight', { value: h, configurable: true, writable: true });
}

beforeEach(() => {
  localStorage.setItem('token', 't');
  setViewport(1180, 820);
  calls = [];
  plan.setPlan.mockClear();
  plan.refreshPlan.mockClear();
  srv = { status: 200, board: () => selfV2Fixture(), clockStatus: 202, clockBody: null };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const method = (init.method ?? 'GET').toUpperCase();
      const body = init.body && typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
      calls.push({ method, url: String(url), body, headers: init.headers as Record<string, string> });
      const u = String(url);
      if (u.endsWith('/api/self/v2') && method === 'GET') {
        const b = srv.board();
        return new Response(JSON.stringify(b ?? { error: 'x' }), { status: srv.status });
      }
      if (u.endsWith('/api/self/v2/clock')) {
        const usage = { ...selfV2Fixture().usage!, used: 4, remaining: 16 };
        return new Response(JSON.stringify(srv.clockBody ?? { usage, status: 'building', alsoChanges: ['love', 'work'] }), { status: srv.clockStatus });
      }
      if (u.endsWith('/api/self/v2/confirm') || u.endsWith('/api/self/v2/mood')) return new Response(null, { status: 204 });
      if (u.endsWith('/api/profile/facts')) return new Response(JSON.stringify({ ok: true }), { status: 200 });
      return new Response(null, { status: 404 });
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  localStorage.clear();
});

const gets = () => calls.filter((c) => c.method === 'GET' && c.url.endsWith('/api/self/v2')).length;
const slides = () => within(screen.getByTestId('self-carousel-track')).getAllByRole('group');

async function ready() {
  return screen.findByTestId('self-board-row');
}

describe('Self board v2', () => {
  it('titles the page Self beside the photo (Ganesh with "Add your photo" when there is none), never You', async () => {
    render(<SelfBoardV2 />);
    await ready();
    expect(screen.getByTestId('self-title')).toHaveTextContent(/^Self$/);
    expect(await screen.findByTestId('self-add-photo')).toHaveAccessibleName('Add your photo');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Self$/);
    expect(screen.queryByRole('heading', { name: /^You$/ })).toBeNull();
  });

  it('renders the twelve areas in the server order, as slides and as grouped chips', async () => {
    render(<SelfBoardV2 />);
    await ready();
    const titles = V2_AREAS.map((a) => a.title);
    expect(slides()).toHaveLength(12);
    expect(slides().map((s) => s.getAttribute('aria-label')!.replace(/^\d+ of 12: /, ''))).toEqual(titles);
    const chips = within(screen.getByTestId('self-chips')).getAllByRole('tab');
    expect(chips.map((c) => c.textContent)).toEqual(titles);
    expect(screen.getByTestId('self-chips-label-now')).toHaveTextContent('Now');
    expect(screen.getByTestId('self-chips-label-you')).toHaveTextContent('You');
    expect(screen.getByTestId('self-chips-label-time')).toHaveTextContent('Time');
    // the first card is the server's first
    expect(slides()[0]).toHaveAttribute('aria-current', 'true');
  });

  it('three cards across at tablet landscape with the rightmost dimmed as the peek', async () => {
    render(<SelfBoardV2 />);
    await ready();
    expect(screen.getByTestId('self-carousel')).toHaveAttribute('data-per-view', '3');
    expect(slides()[2]).toHaveAttribute('data-peek', 'true');
    expect(slides()[1]).toHaveAttribute('data-peek', 'false');
  });

  it('arrows and the left and right keys move one card at a time', async () => {
    render(<SelfBoardV2 />);
    await ready();
    const region = screen.getByTestId('self-carousel');
    fireEvent.click(screen.getByTestId('self-carousel-next'));
    expect(region).toHaveAttribute('data-index', '1');
    expect(slides()[1]).toHaveAttribute('aria-current', 'true');
    fireEvent.keyDown(region, { key: 'ArrowRight' });
    expect(region).toHaveAttribute('data-index', '2');
    fireEvent.keyDown(region, { key: 'ArrowLeft' });
    expect(region).toHaveAttribute('data-index', '1');
    fireEvent.click(screen.getByTestId('self-carousel-prev'));
    expect(region).toHaveAttribute('data-index', '0');
    expect(screen.getByTestId('self-carousel-prev')).toBeDisabled();
    // a chip jumps to its card
    fireEvent.click(screen.getByTestId('self-chips-year'));
    expect(region).toHaveAttribute('data-index', '11');
    expect(region).toHaveAttribute('aria-roledescription', 'carousel');
  });

  it('a card shows headline, body, patterns, ladder, dates and the certainty word; Chart details opens a sheet without ids', async () => {
    render(<SelfBoardV2 />);
    await ready();
    const c = screen.getByTestId('area-card-stuck');
    expect(within(c).getByTestId('area-range')).toHaveTextContent('True until 1 Jan 2027');
    expect(within(c).getByTestId('area-headline')).toHaveTextContent('Where you get stuck: ideas outrun their footing');
    expect(within(c).getByTestId('area-patterns').querySelectorAll('li')).toHaveLength(3);
    expect(within(c).getByTestId('area-ladder')).toHaveTextContent(/Best.*Practical.*Drift.*Floor/);
    expect(within(c).getByTestId('area-dates')).toHaveTextContent('5 May 2026 – 12 Dec 2026');
    expect(within(c).getByTestId('area-certainty')).toHaveTextContent('Strong');
    expect(within(screen.getByTestId('area-card-lagna')).getByTestId('area-range')).toHaveTextContent('Always');
    expect(within(screen.getByTestId('area-card-body')).getByTestId('area-body-note')).toHaveTextContent('Not medical advice.');
    fireEvent.click(within(c).getByTestId('area-details-open'));
    const sheet = await screen.findByTestId('details-sheet');
    expect(sheet).toHaveTextContent('Saturn transits the 2nd house');
    expect(sheet.textContent).not.toMatch(/claim:|planet:|\bms\b/);
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('details-sheet')).toBeNull());
  });

  it('withheld, pending and failed cards say so; pending sits under the veil with the sure lines', async () => {
    srv.board = () =>
      selfV2Fixture((b) => {
        b.status = 'ok';
        b.areas[1]!.status = 'withheld';
        b.areas[1]!.card = null;
        b.areas[2]!.status = 'pending';
        b.areas[2]!.card = null;
        b.areas[3]!.status = 'failed';
        b.areas[3]!.card = null;
      });
    render(<SelfBoardV2 />);
    await ready();
    expect(within(screen.getByTestId('area-card-stuck')).getByTestId('area-withheld')).toHaveTextContent(V2_WORDS.cardWithheld);
    const pending = screen.getByTestId('area-card-chapter');
    expect(within(pending).getByTestId('area-veil-chapter')).toBeInTheDocument();
    expect(within(pending).getByTestId('area-floor')).toHaveTextContent('Money and effort carry the weight this stretch.');
    const failed = screen.getByTestId('area-card-diagnosis');
    expect(within(failed).getByTestId('area-failed')).toHaveTextContent(V2_WORDS.cardFailed);
    expect(within(failed).getByTestId('area-floor')).toBeInTheDocument();
  });

  it('the hero: tone word, sentence, strip with today and the easing date, dated rows', async () => {
    render(<SelfBoardV2 />);
    await ready();
    expect(screen.getByTestId('hero-tone')).toHaveTextContent('Easing');
    expect(screen.getByTestId('hero-sentence')).toHaveTextContent('The heavy stretch since May is lifting.');
    expect(screen.getByTestId('hero-strip-today')).toBeInTheDocument();
    expect(screen.getByTestId('hero-dates')).toHaveTextContent('Pressure eases12 Dec 2026');
    expect(screen.getByTestId('hero-dates')).toHaveTextContent('Sub-chapter ends1 Jan 2027');
    fireEvent.click(screen.getByTestId('hero-why'));
    expect(await screen.findByTestId('why-list')).toHaveTextContent('Where you get stuck');
  });

  it('a withheld hero says only the tone-free line', async () => {
    srv.board = () => selfV2Fixture((b) => (b.hero!.withheld = true));
    render(<SelfBoardV2 />);
    await ready();
    expect(screen.getByTestId('hero')).toHaveTextContent(V2_WORDS.heroWithheld);
    expect(screen.queryByTestId('hero-tone')).toBeNull();
    expect(screen.queryByTestId('hero-question')).toBeNull();
  });

  it('the question posts the answer and says "Thanks, noted" without reloading', async () => {
    render(<SelfBoardV2 />);
    await ready();
    const q = screen.getByTestId('hero-question');
    expect(within(q).getByRole('button', { name: 'Rather not say' })).toBeInTheDocument();
    fireEvent.click(within(q).getByRole('button', { name: 'Partly' }));
    expect(await screen.findByTestId('hero-thanks')).toHaveTextContent('Thanks, noted');
    const post = calls.find((c) => c.url.endsWith('/api/self/v2/confirm'))!;
    expect(post.method).toBe('POST');
    expect(post.body).toEqual({ claimId: 'claim:self.now.work_heavy', answer: 'partly' });
    expect(gets()).toBe(1);
  });

  it('the mood tap posts the mood', async () => {
    render(<SelfBoardV2 />);
    await ready();
    fireEvent.click(within(screen.getByTestId('hero-mood')).getByRole('button', { name: 'Heavy' }));
    expect(await screen.findByTestId('hero-mood-thanks')).toBeInTheDocument();
    expect(calls.find((c) => c.url.endsWith('/api/self/v2/mood'))!.body).toEqual({ mood: 'heavy' });
  });

  it('with no hero question and a missing fact, asks the wizard question and saves it to the profile facts', async () => {
    srv.board = () =>
      selfV2Fixture((b) => {
        b.hero!.question = null;
        b.profile.missing = ['work.status'];
      });
    render(<SelfBoardV2 />);
    await ready();
    const q = screen.getByTestId('hero-profile-question');
    expect(q).toHaveTextContent('Do you have a job right now?');
    fireEvent.click(within(q).getByRole('button', { name: 'Between jobs' }));
    expect(await screen.findByTestId('hero-thanks')).toBeInTheDocument();
    const put = calls.find((c) => c.url.endsWith('/api/profile/facts'))!;
    expect(put.method).toBe('PUT');
    expect(put.body).toEqual({ facts: { 'work.status': 'between_jobs' } });
  });

  it('clock sheet: reason, cost, greyed clocks that do not apply, then PUT, the counter and the veil', async () => {
    render(<SelfBoardV2 />);
    await ready();
    expect(screen.getByTestId('self-clock-line')).toHaveTextContent('Read on your Kaala clock · Change · built 9 Nov 2026, next check 1 Jan 2027');
    fireEvent.click(screen.getByTestId('self-clock-change'));
    const sheet = await screen.findByTestId('clock-sheet');
    expect(within(sheet).getByText(V2_WORDS.clockTitle)).toBeInTheDocument();
    expect(within(sheet).getByTestId('clock-reason')).toHaveTextContent('the one your chart qualifies for');
    expect(within(sheet).getByTestId('clock-cost')).toHaveTextContent('Uses 1 of your 20 questions this month');
    expect(within(sheet).getByTestId('clock-also')).toHaveTextContent('Love and Work');
    const off = within(sheet).getByTestId('clock-option-dwisaptatisama');
    expect(off).toBeDisabled();
    expect(off).toHaveTextContent('Does not apply to your chart');
    fireEvent.click(off);
    expect(within(sheet).getByTestId('clock-confirm')).toBeDisabled();
    expect(within(sheet).getByTestId('clock-option-kaala')).toBeDisabled();
    fireEvent.click(within(sheet).getByTestId('clock-option-yogini'));
    const confirm = within(sheet).getByTestId('clock-confirm');
    expect(confirm).toHaveTextContent('Rebuild on Yogini · 1 question');
    srv.board = () => selfV2Fixture((b) => (b.status = 'pending'));
    fireEvent.click(confirm);
    await waitFor(() => expect(screen.queryByTestId('clock-sheet')).toBeNull());
    const put = calls.find((c) => c.url.endsWith('/api/self/v2/clock'))!;
    expect(put.method).toBe('PUT');
    expect(put.body).toEqual({ system: 'yogini' });
    expect(plan.setPlan).toHaveBeenCalledWith(expect.objectContaining({ used: 4 }));
    expect(await screen.findByTestId('self-rebuild-veil')).toBeInTheDocument();
  });

  it('clock sheet: a 400 shows the error in the sheet', async () => {
    srv.clockStatus = 400;
    srv.clockBody = { error: 'not_applicable' };
    render(<SelfBoardV2 />);
    await ready();
    fireEvent.click(screen.getByTestId('self-clock-change'));
    fireEvent.click(within(await screen.findByTestId('clock-sheet')).getByTestId('clock-option-vimshottari'));
    fireEvent.click(screen.getByTestId('clock-confirm'));
    expect(await screen.findByTestId('clock-error')).toHaveTextContent(V2_WORDS.clockErrors.not_applicable);
    expect(screen.getByTestId('clock-sheet')).toBeInTheDocument();
  });

  it('pending polls every 10 s, and after six minutes says "Still working…" with Retry', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    srv.board = () => selfV2Fixture((b) => (b.status = 'pending'));
    render(<SelfBoardV2 />);
    await ready();
    expect(gets()).toBe(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(V2_POLL_MS.pending);
    });
    await waitFor(() => expect(gets()).toBe(2));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(V2_MAX_WAIT_MS);
    });
    expect(await screen.findByTestId('self-v2-late')).toHaveTextContent('Still working…');
    const n = gets();
    srv.board = () => selfV2Fixture();
    fireEvent.click(within(screen.getByTestId('self-v2-late')).getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(gets()).toBe(n + 1));
    await waitFor(() => expect(screen.queryByTestId('self-v2-late')).toBeNull());
  });

  it('preparing polls every 30 s', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    srv.status = 202;
    srv.board = () => null;
    render(<SelfBoardV2 />);
    expect(await screen.findByTestId('self-v2-preparing')).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(V2_POLL_MS.pending);
    });
    expect(gets()).toBe(1);
    srv.status = 200;
    srv.board = () => selfV2Fixture();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(V2_POLL_MS.preparing);
    });
    expect(await screen.findByTestId('self-board-row')).toBeInTheDocument();
  });

  it('no kundli shows the empty state', async () => {
    srv.status = 404;
    srv.board = () => ({ status: 'no_kundli' }) as unknown as SelfV2Response;
    render(<SelfBoardV2 />);
    expect(await screen.findByTestId('board-no-kundli')).toHaveTextContent(V2_WORDS.noKundli);
  });

  it('sends the page header with every call', async () => {
    render(<SelfBoardV2 />);
    await ready();
    expect(calls[0]!.headers!['X-Astra-Page']).toBeDefined();
  });

  it('the words rule: no technique id, internal label, chart term or engine name on the card faces or the hero', async () => {
    render(<SelfBoardV2 />);
    await ready();
    const text = screen.getByTestId('self-v2-page').textContent ?? '';
    for (const re of [/\bself\.[a-z]/i, /consensus/i, /vimshottari/i, /dasha/i, /radha/i, /pyjhora/i, /\bhouse/i, /\blord/i, /\bclocks?\s+\d|\d+\s+clocks/i]) {
      expect(text, String(re)).not.toMatch(re);
    }
  });

  it('never scrolls the page: the board is a fixed-height grid with overflow hidden; card bodies scroll inside', async () => {
    render(<SelfBoardV2 />);
    await ready();
    const grid = screen.getByTestId('self-v2-page');
    expect(grid).toHaveAttribute('data-board-grid', 'true');
    for (const c of ['grid', 'h-full', 'min-h-0', 'overflow-hidden', 'grid-rows-[auto_auto_minmax(0,1fr)]']) expect(grid).toHaveClass(c);
    const bodies = screen.getAllByTestId('area-body');
    expect(bodies).toHaveLength(12);
    for (const b of bodies) {
      expect(b).toHaveClass('overflow-y-auto');
      expect(b).toHaveClass('min-h-0');
    }
  });

  it('two cards across with the question beside the sentence in portrait; four at 1440', async () => {
    setViewport(1024, 1366);
    const a = render(<SelfBoardV2 />);
    await ready();
    expect(screen.getByTestId('self-carousel')).toHaveAttribute('data-per-view', '2');
    expect(screen.getByTestId('hero')).toHaveAttribute('data-layout', 'portrait');
    a.unmount();
    setViewport(1500, 900);
    render(<SelfBoardV2 />);
    await ready();
    expect(screen.getByTestId('self-carousel')).toHaveAttribute('data-per-view', '4');
    expect(screen.getByTestId('hero-todo')).toBeInTheDocument();
  });

  it('chooses the two-fold layout from viewport segments, or a wide short touch screen', () => {
    expect(boardMode(1180, 820, true, false)).toBe('duo');
    expect(boardMode(1280, 720, false, true)).toBe('duo');
    expect(boardMode(1280, 720, false, false)).toBe('landscape');
    expect(boardMode(1180, 820, false, false)).toBe('landscape');
    expect(boardMode(1440, 900, false, false)).toBe('wide');
    expect(boardMode(1024, 1366, false, false)).toBe('portrait');
    expect(boardMode(390, 844, false, false)).toBe('phone');
  });

  it('on a two-fold: the left pane holds the hero and the area list, the right pane one card, Chart details over it', async () => {
    const mm = vi.fn((q: string) => ({ matches: q.includes('horizontal-viewport-segments'), media: q, addEventListener: () => {}, removeEventListener: () => {} }));
    vi.stubGlobal('matchMedia', mm);
    render(<SelfBoardV2 />);
    const left = await screen.findByTestId('self-duo-left');
    expect(within(left).getByTestId('hero')).toBeInTheDocument();
    expect(within(left).getByTestId('self-area-list')).toHaveTextContent('Where you get stuck');
    const right = screen.getByTestId('self-duo-right');
    expect(within(right).getByTestId('self-carousel')).toHaveAttribute('data-per-view', '1');
    fireEvent.click(within(left).getByRole('button', { name: 'This year' }));
    expect(within(right).getByTestId('self-carousel')).toHaveAttribute('data-index', '11');
    fireEvent.click(within(within(right).getByTestId('area-card-year')).getByTestId('area-details-open'));
    expect(within(right).getByTestId('details-sheet')).toBeInTheDocument();
  });
});
