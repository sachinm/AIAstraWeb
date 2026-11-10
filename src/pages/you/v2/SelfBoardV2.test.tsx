import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import SelfBoardV2, { boardMode, V2_MAX_WAIT_MS, V2_POLL_MS } from './SelfBoardV2';
import { V2_AREAS, selfV2Fixture } from './selfV2.fixture';
import { V2_WORDS } from './words';
import type { SelfV2BuildView, SelfV2Response } from '../../../lib/selfV2Api';

const plan = vi.hoisted(() => ({ setPlan: vi.fn(), refreshPlan: vi.fn(async () => {}) }));
vi.mock('../../../Auth/ProfileGate', () => ({ usePlan: () => ({ plan: null, setPlan: plan.setPlan, refreshPlan: plan.refreshPlan }) }));

let srv: { status: number; board: () => SelfV2Response | null; clockStatus: number; clockBody: unknown; refreshStatus: number; refreshBody: unknown };
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
  srv = { status: 200, board: () => selfV2Fixture(), clockStatus: 202, clockBody: null, refreshStatus: 202, refreshBody: null };
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
      if (u.endsWith('/api/boards/self/refresh') && method === 'POST') {
        const usage = { ...selfV2Fixture().usage!, used: 4, remaining: 16 };
        return new Response(JSON.stringify(srv.refreshBody ?? { status: 'building', usage }), { status: srv.refreshStatus });
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
const refreshPosts = () => calls.filter((c) => c.method === 'POST' && c.url.endsWith('/api/boards/self/refresh')).length;
const due = (b: SelfV2Response) => {
  b.refresh = { madeAt: '2026-10-20T09:00:00Z', validUntil: '2026-11-08', due: true };
};
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

  it('the range line is the server rangeLabel; the inferred line only when the field is absent', async () => {
    srv.board = () =>
      selfV2Fixture((b) => {
        b.areas.find((a) => a.id === 'year')!.rangeLabel = 'This year: 9 Sep 2026 – 9 Sep 2027';
        b.areas.find((a) => a.id === 'mind')!.rangeLabel = '';
        delete b.areas.find((a) => a.id === 'chapter')!.rangeLabel;
      });
    render(<SelfBoardV2 />);
    await ready();
    expect(within(screen.getByTestId('area-card-year')).getByTestId('area-range')).toHaveTextContent('This year: 9 Sep 2026 – 9 Sep 2027');
    // the server knows no range: no line, not a guessed one
    expect(within(screen.getByTestId('area-card-mind')).queryByTestId('area-range')).toBeNull();
    // an older board without the field: the inferred line from the card's first date
    expect(within(screen.getByTestId('area-card-chapter')).getByTestId('area-range')).toHaveTextContent('5 May 2026 – 12 Dec 2026');
  });

  it('Chart details shows evidence keys only to a practitioner', async () => {
    srv.board = () => selfV2Fixture((b) => (b.profile.role = 'practitioner'));
    render(<SelfBoardV2 />);
    await ready();
    fireEvent.click(within(screen.getByTestId('area-card-stuck')).getByTestId('area-details-open'));
    expect(await screen.findByTestId('area-evidence')).toHaveTextContent('planet:D1.Sa');
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

  it('"Sub-chapter ends" is the server subChapterEnds; "Why we think so" lists the hero supporting areas', async () => {
    srv.board = () =>
      selfV2Fixture((b) => {
        b.subChapterEnds = '2027-03-15';
        b.hero!.supporting = ['diagnosis'];
      });
    render(<SelfBoardV2 />);
    await ready();
    expect(screen.getByTestId('hero-dates')).toHaveTextContent('Sub-chapter ends15 Mar 2027');
    fireEvent.click(screen.getByTestId('hero-why'));
    const why = await screen.findByTestId('why-list');
    expect(why).toHaveTextContent('In short: ideas outrun their footing');
    expect(why).not.toHaveTextContent('Where you get stuck');
    expect(why.querySelectorAll('li')).toHaveLength(1);
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

describe('Self board v2: Get a fresh reading (server docs/billing/03)', () => {
  it('not due: disabled "Fresh reading from" the day after Good until, with the Made · Good until line', async () => {
    srv.board = () => selfV2Fixture((b) => (b.refresh = { madeAt: '2026-11-01T09:00:00Z', validUntil: '2026-12-03', due: false }));
    render(<SelfBoardV2 />);
    await ready();
    const row = screen.getByTestId('self-board-row');
    const btn = within(row).getByTestId('fresh-button');
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('data-state', 'not_due');
    expect(btn).toHaveTextContent('Fresh reading from 4 Dec 2026');
    expect(within(row).getByTestId('fresh-line')).toHaveTextContent('Made 1 Nov 2026 · Good until 3 Dec 2026');
    fireEvent.click(btn);
    expect(screen.queryByTestId('fresh-sheet')).toBeNull();
  });

  it('due: an enabled "Get a fresh reading" with "Uses 1 of your 20 questions"', async () => {
    srv.board = () => selfV2Fixture(due);
    render(<SelfBoardV2 />);
    await ready();
    const btn = screen.getByTestId('fresh-button');
    expect(btn).toBeEnabled();
    expect(btn).toHaveAttribute('data-state', 'due');
    expect(btn).toHaveTextContent(/^Get a fresh reading$/);
    expect(screen.getByTestId('fresh-line')).toHaveTextContent(/^Uses 1 of your 20 questions$/);
  });

  it('loading the page (and reloading it) never posts a refresh, even when one is due', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    srv.board = () => selfV2Fixture(due);
    const first = render(<SelfBoardV2 />);
    await ready();
    first.unmount();
    render(<SelfBoardV2 />);
    await ready();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(V2_POLL_MS.pending * 3);
    });
    expect(gets()).toBe(2);
    expect(refreshPosts()).toBe(0);
  });

  it('the consent sheet: Not now posts nothing; confirm posts once, applies the usage, veils the cards and polls until the new board lands', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    srv.board = () => selfV2Fixture(due);
    render(<SelfBoardV2 />);
    await ready();
    fireEvent.click(screen.getByTestId('fresh-button'));
    const sheet = await screen.findByTestId('fresh-sheet');
    expect(within(sheet).getByText('Get a fresh reading?')).toBeInTheDocument();
    expect(within(sheet).getByTestId('fresh-sheet-body')).toHaveTextContent(
      "Your board will be read again from today's sky and your latest answers. This uses 1 of your 20 questions this month.",
    );
    expect(within(sheet).getByTestId('fresh-not-now')).toHaveTextContent('Not now');
    fireEvent.click(within(sheet).getByTestId('fresh-not-now'));
    expect(screen.queryByTestId('fresh-sheet')).toBeNull();
    expect(refreshPosts()).toBe(0);

    fireEvent.click(screen.getByTestId('fresh-button'));
    const confirm = within(await screen.findByTestId('fresh-sheet')).getByTestId('fresh-confirm');
    expect(confirm).toHaveTextContent('Get fresh reading · 1 question');
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    await waitFor(() => expect(screen.queryByTestId('fresh-sheet')).toBeNull());
    expect(refreshPosts()).toBe(1);
    expect(plan.setPlan).toHaveBeenCalledWith(expect.objectContaining({ used: 4 }));
    const btn = screen.getByTestId('fresh-button');
    expect(btn).toHaveAttribute('data-state', 'building');
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent('Making your fresh reading…');
    expect(screen.getByTestId('self-fresh-veil')).toBeInTheDocument();

    // the same board comes back while the build runs: still veiled, polled every 10 s
    const n = gets();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(V2_POLL_MS.pending);
    });
    await waitFor(() => expect(gets()).toBe(n + 1));
    expect(screen.getByTestId('self-fresh-veil')).toBeInTheDocument();
    // the new board lands: veil gone, the new dates shown, nothing posted again
    srv.board = () => selfV2Fixture((b) => {
      b.builtAt = '2026-11-09T10:30:00Z';
      b.refresh = { madeAt: '2026-11-09T10:30:00Z', validUntil: '2026-12-31', due: false };
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(V2_POLL_MS.pending);
    });
    await waitFor(() => expect(screen.queryByTestId('self-fresh-veil')).toBeNull());
    expect(screen.getByTestId('fresh-button')).toHaveTextContent('Fresh reading from 1 Jan 2027');
    expect(refreshPosts()).toBe(1);
  });

  it('a build that runs past six minutes says "Still working…" with Retry over the veil', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    srv.board = () => selfV2Fixture(due);
    render(<SelfBoardV2 />);
    await ready();
    fireEvent.click(screen.getByTestId('fresh-button'));
    fireEvent.click(within(await screen.findByTestId('fresh-sheet')).getByTestId('fresh-confirm'));
    expect(await screen.findByTestId('self-fresh-veil')).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(V2_MAX_WAIT_MS + V2_POLL_MS.pending);
    });
    const late = await screen.findByTestId('self-v2-late');
    expect(late).toHaveTextContent('Still working… Retry');
    expect(refreshPosts()).toBe(1);
  });

  it('a fresh build that fails: polling stops, the row says the question was given back, and Try again asks again', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    srv.board = () => selfV2Fixture(due);
    render(<SelfBoardV2 />);
    await ready();
    fireEvent.click(screen.getByTestId('fresh-button'));
    // the build runs: the server says building
    srv.board = () => selfV2Fixture((b) => (b.refresh = { madeAt: '2026-10-20T09:00:00Z', validUntil: '2026-11-08', due: true, building: true, failed: false }));
    fireEvent.click(within(await screen.findByTestId('fresh-sheet')).getByTestId('fresh-confirm'));
    expect(await screen.findByTestId('self-fresh-veil')).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(V2_POLL_MS.pending);
    });
    expect(screen.getByTestId('self-fresh-veil')).toBeInTheDocument();
    // the build failed: same builtAt, refresh.failed
    srv.board = () => selfV2Fixture((b) => (b.refresh = { madeAt: '2026-10-20T09:00:00Z', validUntil: '2026-11-08', due: true, building: false, failed: true }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(V2_POLL_MS.pending);
    });
    await waitFor(() => expect(screen.queryByTestId('self-fresh-veil')).toBeNull());
    expect(screen.getByTestId('fresh-build-failed')).toHaveTextContent('That did not work; your question was given back.');
    expect(plan.refreshPlan).toHaveBeenCalled();
    const n = gets();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(V2_POLL_MS.pending * 3);
    });
    expect(gets()).toBe(n);
    expect(screen.queryByTestId('self-v2-late')).toBeNull();
    // Try again opens the consent sheet; confirming posts again and veils the cards, though the board on screen still
    // carries the earlier failure
    const again = screen.getByTestId('fresh-button');
    expect(again).toHaveAttribute('data-state', 'build_failed');
    expect(again).toHaveTextContent('Try again');
    fireEvent.click(again);
    fireEvent.click(within(await screen.findByTestId('fresh-sheet')).getByTestId('fresh-confirm'));
    expect(await screen.findByTestId('self-fresh-veil')).toBeInTheDocument();
    expect(refreshPosts()).toBe(2);
    expect(screen.queryByTestId('fresh-build-failed')).toBeNull();
  });

  it('a board that says failed on load (no ask on this page) shows no failure line', async () => {
    srv.board = () => selfV2Fixture((b) => (b.refresh = { madeAt: '2026-10-20T09:00:00Z', validUntil: '2026-11-08', due: true, building: false, failed: true }));
    render(<SelfBoardV2 />);
    await ready();
    expect(screen.getByTestId('fresh-button')).toHaveTextContent(/^Get a fresh reading$/);
    expect(screen.queryByTestId('fresh-build-failed')).toBeNull();
  });

  it('402: "No questions left" with Upgrade to the plan page; the reading stays', async () => {
    srv.board = () => selfV2Fixture(due);
    srv.refreshStatus = 402;
    srv.refreshBody = { error: 'quota_exhausted', code: 'quota_exhausted', usage: { ...selfV2Fixture().usage!, used: 20, remaining: 0 } };
    render(<SelfBoardV2 />);
    await ready();
    fireEvent.click(screen.getByTestId('fresh-button'));
    fireEvent.click(within(await screen.findByTestId('fresh-sheet')).getByTestId('fresh-confirm'));
    const none = await screen.findByTestId('fresh-no-questions');
    expect(none).toHaveTextContent('No questions left · Upgrade');
    expect(within(none).getByTestId('fresh-upgrade')).toHaveAttribute('href', '/pricing');
    expect(screen.queryByTestId('fresh-button')).toBeNull();
    expect(screen.queryByTestId('self-fresh-veil')).toBeNull();
    expect(slides()).toHaveLength(12);
  });

  it('409 not_due: the dates are read again and shown, and nothing is veiled', async () => {
    srv.board = () => selfV2Fixture(due);
    srv.refreshStatus = 409;
    srv.refreshBody = { error: 'not_due', code: 'not_due', valid_until: '2026-11-20' };
    render(<SelfBoardV2 />);
    await ready();
    fireEvent.click(screen.getByTestId('fresh-button'));
    srv.board = () => selfV2Fixture((b) => (b.refresh = { madeAt: '2026-11-02T09:00:00Z', validUntil: '2026-11-20', due: false }));
    const n = gets();
    fireEvent.click(within(await screen.findByTestId('fresh-sheet')).getByTestId('fresh-confirm'));
    await waitFor(() => expect(gets()).toBe(n + 1));
    await waitFor(() => expect(screen.getByTestId('fresh-button')).toHaveTextContent('Fresh reading from 21 Nov 2026'));
    expect(screen.getByTestId('fresh-button')).toBeDisabled();
    expect(screen.getByTestId('fresh-line')).toHaveTextContent('Made 2 Nov 2026 · Good until 20 Nov 2026');
    expect(screen.queryByTestId('self-fresh-veil')).toBeNull();
  });

  it('a failed post says so in the sheet and counts nothing; nothing is shown before a reading was ever made', async () => {
    srv.board = () => selfV2Fixture(due);
    srv.refreshStatus = 500;
    srv.refreshBody = { error: 'refresh_failed' };
    const { unmount } = render(<SelfBoardV2 />);
    await ready();
    fireEvent.click(screen.getByTestId('fresh-button'));
    fireEvent.click(within(await screen.findByTestId('fresh-sheet')).getByTestId('fresh-confirm'));
    expect(await screen.findByTestId('fresh-sheet-error')).toHaveTextContent('That did not work. Try again');
    unmount();
    srv.board = () => selfV2Fixture((b) => (b.refresh = { madeAt: null, validUntil: null, due: false }));
    render(<SelfBoardV2 />);
    await ready();
    expect(screen.queryByTestId('fresh-reading')).toBeNull();
  });

  it('sits in the board row at 1180 and 1024, and in the Duo left pane beside the clock line', async () => {
    srv.board = () => selfV2Fixture(due);
    for (const [w, h] of [[1180, 820], [1024, 1366]] as const) {
      setViewport(w, h);
      const { unmount } = render(<SelfBoardV2 />);
      const row = await ready();
      expect(within(row).getByTestId('fresh-button')).toBeInTheDocument();
      expect(screen.getByTestId('self-v2-page')).toHaveClass('overflow-hidden');
      unmount();
    }
    setViewport(1350, 720);
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('horizontal-viewport-segments'), media: q, addEventListener: () => {}, removeEventListener: () => {} }));
    render(<SelfBoardV2 />);
    const left = await screen.findByTestId('self-duo-left');
    expect(within(left).getByTestId('fresh-button')).toHaveTextContent('Get a fresh reading');
  });

  describe('build progress (server docs/loading-overlay/05)', () => {
    const build = (over: Partial<SelfV2BuildView> = {}): SelfV2BuildView => ({
      state: 'running',
      stage: 'briefs',
      step: 2,
      steps: 7,
      percent: 5,
      nextPercent: 8,
      stageExpectedMs: 3000,
      startedAt: new Date(Date.now() - 4000).toISOString(),
      stageAt: new Date(Date.now()).toISOString(),
      ...over,
    });
    const building = (b: SelfV2Response, v: SelfV2BuildView) => {
      b.status = 'pending';
      b.areas[2]!.status = 'pending';
      b.build = v;
    };

    it('running: one veil with the progress over the deck (no veil per card) and the chip says the step', async () => {
      srv.board = () => selfV2Fixture((b) => building(b, build()));
      render(<SelfBoardV2 />);
      await ready();
      expect(screen.getByTestId('self-build-veil')).toBeInTheDocument();
      expect(screen.queryByTestId('area-veil-chapter')).toBeNull();
      expect(within(screen.getByTestId('area-card-chapter')).getByTestId('area-floor')).toBeInTheDocument();
      expect(screen.getByTestId('build-status')).toHaveAttribute('data-state', 'running');
      expect(screen.getByTestId('build-status-text')).toHaveTextContent('Making your reading · step 2 of 7');
      expect(screen.getByTestId('build-status-bar')).toHaveStyle({ width: '5%' });
    });

    it('queued: "Making your reading · getting ready"', async () => {
      srv.board = () => selfV2Fixture((b) => building(b, build({ state: 'queued', stage: null, step: 0, percent: 0, nextPercent: 5, stageAt: null })));
      render(<SelfBoardV2 />);
      await ready();
      expect(screen.getByTestId('build-status-text')).toHaveTextContent('Making your reading · getting ready');
    });

    it('the veil shows the bar after 5 s and polls every 2 s while running', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      srv.board = () => selfV2Fixture((b) => building(b, build({ stageExpectedMs: 20_000 })));
      render(<SelfBoardV2 />);
      await ready();
      expect(gets()).toBe(1);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(V2_POLL_MS.build);
      });
      await waitFor(() => expect(gets()).toBe(2));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(V2_POLL_MS.build);
      });
      await waitFor(() => expect(gets()).toBe(3));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2500);
      });
      const bar = await screen.findByTestId('veil-progress');
      const v = Number(bar.getAttribute('aria-valuenow'));
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThan(8);
      expect(screen.getByTestId('self-build-veil-progress-label')).toHaveTextContent('Sorting what matters now · Step 2 of 7');
    });

    it('failed: polling stops and the chip says so; Try again reads the board again', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      srv.board = () => selfV2Fixture((b) => building(b, build({ state: 'failed', stage: null, step: 0 })));
      render(<SelfBoardV2 />);
      await ready();
      expect(screen.getByTestId('build-status')).toHaveAttribute('data-state', 'failed');
      expect(screen.getByTestId('build-status-text')).toHaveTextContent('That did not work.');
      expect(screen.queryByTestId('self-build-veil')).toBeNull();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(V2_POLL_MS.pending * 3);
      });
      expect(gets()).toBe(1);
      srv.board = () => selfV2Fixture((b) => building(b, build({ state: 'queued', stage: null, step: 0, percent: 0 })));
      fireEvent.click(screen.getByTestId('build-status-retry'));
      await waitFor(() => expect(gets()).toBe(2));
      expect(await screen.findByTestId('build-status-text')).toHaveTextContent('Making your reading · getting ready');
    });

    it('a running build that turns failed stops the 2 s poll', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      srv.board = () => selfV2Fixture((b) => building(b, build()));
      render(<SelfBoardV2 />);
      await ready();
      srv.board = () => selfV2Fixture((b) => building(b, build({ state: 'failed', stage: null, step: 0 })));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(V2_POLL_MS.build);
      });
      await waitFor(() => expect(screen.getByTestId('build-status')).toHaveAttribute('data-state', 'failed'));
      const n = gets();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(V2_POLL_MS.pending * 3);
      });
      expect(gets()).toBe(n);
    });

    it('stuck: "This is taking longer than it should." with Try again', async () => {
      srv.board = () => selfV2Fixture((b) => building(b, build({ state: 'stuck' })));
      render(<SelfBoardV2 />);
      await ready();
      expect(screen.getByTestId('build-status-text')).toHaveTextContent('This is taking longer than it should.');
      fireEvent.click(screen.getByTestId('build-status-retry'));
      await waitFor(() => expect(gets()).toBe(2));
    });

    it('ready: no chip; the Made / Good until line stays', async () => {
      srv.board = () =>
        selfV2Fixture((b) => {
          b.build = build({ state: 'ready', stage: null, step: 0, percent: 100, nextPercent: 100, stageAt: null });
          b.refresh = { madeAt: '2026-11-10T09:00:00Z', validUntil: '2026-12-12', due: false };
        });
      render(<SelfBoardV2 />);
      await ready();
      expect(screen.queryByTestId('build-status')).toBeNull();
      expect(screen.getByTestId('fresh-line')).toHaveTextContent('Made 10 Nov 2026 · Good until 12 Dec 2026');
    });

    it('no build field (an older server): no chip, per-card veils, the 10 s poll as before', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      srv.board = () =>
        selfV2Fixture((b) => {
          b.status = 'pending';
          b.areas[2]!.status = 'pending';
        });
      render(<SelfBoardV2 />);
      await ready();
      expect(screen.queryByTestId('build-status')).toBeNull();
      expect(screen.queryByTestId('self-build-veil')).toBeNull();
      expect(screen.getByTestId('area-veil-chapter')).toBeInTheDocument();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(V2_POLL_MS.build * 2);
      });
      expect(gets()).toBe(1);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(V2_POLL_MS.pending);
      });
      await waitFor(() => expect(gets()).toBe(2));
    });
  });
});
