import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import SelfBoardV3, { perViewFor } from './SelfBoardV3';
import { SUGGESTED_IDS, selfV3Fixture, selfV3Unchosen } from './selfV3.fixture';
import { selfV2Fixture } from '../v2/selfV2.fixture';
import { V3_WORDS } from './words';
import { clearSelfV3Cached } from '../../../lib/selfV3Cache';
import { cardSections, type SelfBoardLayoutView, type SelfV3Response } from '../../../lib/selfV3Api';

const plan = vi.hoisted(() => ({ setPlan: vi.fn(), refreshPlan: vi.fn(async () => {}) }));
vi.mock('../../../Auth/ProfileGate', () => ({ usePlan: () => ({ plan: null, setPlan: plan.setPlan, refreshPlan: plan.refreshPlan }) }));

type Call = { method: string; url: string; body?: Record<string, unknown> };
let srv: {
  v3Status: number;
  v3Body: () => string | null;
  layoutStatus: number;
  layoutBody: ((b: Record<string, unknown>) => unknown) | null;
  /** the PATCH routes are live (doc 75); off: 404, as on an older server */
  patchLive: boolean;
  /** answers for the next PATCHes, in order, before the normal one */
  patchQueue: number[];
  refreshOk: boolean;
  stored: SelfBoardLayoutView;
};
let calls: Call[];

const json = (b: unknown) => JSON.stringify(b);

function applyPatch(url: string, body: Record<string, unknown>): SelfBoardLayoutView {
  const l = srv.stored;
  const card = url.match(/\/layout\/cards\/([^/]+)$/)?.[1];
  if (card) {
    const options = { ...(l.options ?? {}) } as Record<string, unknown>;
    const o = body.options as Record<string, unknown>;
    if (Object.keys(o).length) options[card] = o;
    else delete options[card];
    return { ...l, options: options as SelfBoardLayoutView['options'] };
  }
  if (url.endsWith('/layout/board')) return { ...l, boardOptions: body.boardOptions as SelfBoardLayoutView['boardOptions'] };
  return { ...l, template: body.template as SelfBoardLayoutView['template'], cards: body.cards as SelfBoardLayoutView['cards'], sections: body.sections as SelfBoardLayoutView['sections'] };
}

beforeEach(() => {
  // the board paints from the cache and remembers its card and periods: every test starts cold
  clearSelfV3Cached();
  sessionStorage.clear();
  localStorage.setItem('token', 't');
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-13T12:00:00'));
  Object.defineProperty(window, 'innerWidth', { value: 1180, configurable: true, writable: true });
  Object.defineProperty(window, 'innerHeight', { value: 820, configurable: true, writable: true });
  calls = [];
  srv = { v3Status: 200, v3Body: () => json(selfV3Fixture()), layoutStatus: 200, layoutBody: null, patchLive: false, patchQueue: [], refreshOk: false, stored: { ...selfV3Fixture().layout, version: 1 } };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const method = (init.method ?? 'GET').toUpperCase();
      const body = init.body && typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
      calls.push({ method, url: String(url), body });
      const u = String(url);
      if (u.endsWith('/api/self/v3') && method === 'GET') return new Response(srv.v3Body(), { status: srv.v3Status });
      if (u.endsWith('/api/self/v3/layout') && method === 'PUT') {
        const out = srv.layoutBody ? srv.layoutBody(body) : { ...body, chosen: true, updatedAt: '2026-11-09T09:00:00Z' };
        return new Response(json(out), { status: srv.layoutStatus });
      }
      if (u.includes('/api/self/v3/layout/') && method === 'PATCH') {
        if (!srv.patchLive) return new Response(null, { status: 404 });
        const forced = srv.patchQueue.shift();
        if (forced) return new Response(json({ error: forced === 409 ? 'stale_layout' : 'unauthorized' }), { status: forced });
        if (body.version !== srv.stored.version) return new Response(json({ error: 'stale_layout' }), { status: 409 });
        srv.stored = { ...applyPatch(u, body), version: (srv.stored.version ?? 0) + 1 };
        return new Response(json(srv.stored), { status: 200 });
      }
      if (u.endsWith('/api/auth/refresh')) return srv.refreshOk ? new Response(json({ token: 't2' }), { status: 200 }) : new Response(null, { status: 401 });
      if (u.endsWith('/api/self/v3/confirm')) return new Response(null, { status: 204 });
      if (u.endsWith('/api/self/v2') && method === 'GET') return new Response(json(selfV2Fixture()), { status: 200 });
      return new Response(null, { status: 404 });
    }),
  );
});
afterEach(async () => {
  // closing the board sends a change still waiting its 400 ms; let that save finish before the next test starts
  cleanup();
  await new Promise((r) => setTimeout(r, 20));
  vi.useRealTimers();
  vi.unstubAllGlobals();
  localStorage.clear();
});

const puts = () => calls.filter((c) => c.method === 'PUT' && c.url.endsWith('/api/self/v3/layout'));
const patches = () => calls.filter((c) => c.method === 'PATCH');
const tile = (id: string) => screen.getByTestId(`picker-tile-${id}`);
const ticked = () => screen.getAllByRole('checkbox').filter((t) => t.getAttribute('aria-checked') === 'true');
const chipTitles = () =>
  within(screen.getByTestId('self-v3-chips'))
    .getAllByRole('button')
    .filter((b) => b.getAttribute('data-testid') !== 'self-v3-chip-add')
    .map((c) => c.textContent);
const SUGGESTED_NOW = SUGGESTED_IDS.filter((id) => id !== 'chapter');

function unchosen() {
  srv.v3Body = () => json(selfV3Unchosen());
}

function withBoard(edit: (b: SelfV3Response) => void) {
  srv.v3Body = () => {
    const b = selfV3Fixture();
    edit(b);
    return json(b);
  };
}

describe('Self board v3: the picker', () => {
  it('opens on a first visit with every card grouped, the suggested ones marked but not ticked', async () => {
    unchosen();
    render(<SelfBoardV3 />);
    await screen.findByTestId('self-v3-picker');
    expect(screen.getByTestId('picker-lead')).toHaveTextContent(V3_WORDS.pickerLead);
    expect(screen.getAllByRole('checkbox')).toHaveLength(11);
    expect(ticked()).toHaveLength(0);
    expect(within(screen.getByTestId('picker-group-body')).getByText('Body & energy')).toBeInTheDocument();
    expect(within(tile('body')).getByTestId('picker-suggested')).toHaveTextContent('Suggested for you');
    expect(within(tile('yogas')).queryByTestId('picker-suggested')).toBeNull();
    // This chapter is out of the suggested set; the old names read in the new words
    expect(within(tile('chapter')).queryByTestId('picker-suggested')).toBeNull();
    expect(tile('stuck')).toHaveTextContent('What’s weighing on you');
    expect(tile('presence')).toBeDisabled();
    expect(screen.queryByTestId('self-v3-chips')).toBeNull();
  });

  it('"Add the suggested cards" ticks the suggested cards, This chapter left out', async () => {
    unchosen();
    render(<SelfBoardV3 />);
    await screen.findByTestId('self-v3-picker');
    fireEvent.click(screen.getByTestId('picker-add-suggested'));
    expect(ticked().map((t) => t.getAttribute('data-testid')!.replace('picker-tile-', '')).sort()).toEqual([...SUGGESTED_NOW].sort());
  });

  it('Done saves the deck (an older server: one PUT) and shows the board with the new names', async () => {
    unchosen();
    render(<SelfBoardV3 />);
    await screen.findByTestId('self-v3-picker');
    fireEvent.click(tile('year'));
    fireEvent.click(tile('body'));
    fireEvent.click(tile('mind'));
    fireEvent.click(screen.getByTestId('picker-done'));
    await waitFor(() => expect(puts()).toHaveLength(1));
    expect(puts()[0]!.body).toMatchObject({ template: 'seasons', cards: ['year', 'body', 'mind'], sections: {} });
    await screen.findByTestId('self-v3-chips');
    expect(chipTitles()).toEqual(['Your year', 'Body & energy', 'How you think']);
  });

  it('a refused layout keeps the picker open and says so', async () => {
    unchosen();
    srv.layoutStatus = 400;
    srv.layoutBody = () => ({ error: 'too_few_cards' });
    render(<SelfBoardV3 />);
    await screen.findByTestId('self-v3-picker');
    fireEvent.click(screen.getByTestId('picker-add-suggested'));
    fireEvent.click(screen.getByTestId('picker-done'));
    expect(await screen.findByTestId('picker-error')).toHaveTextContent('Keep at least three cards.');
    expect(screen.getByTestId('self-v3-picker')).toBeInTheDocument();
  });
});

describe('Self board v3: the board', () => {
  it('a title row with Edit and the gear; Seasons only, no Compact switch while feature.compact is off', async () => {
    render(<SelfBoardV3 />);
    await screen.findByTestId('self-board-row');
    expect(screen.getByTestId('self-title')).toHaveTextContent(/^Self$/);
    expect(screen.getByTestId('self-v3-edit')).toBeInTheDocument();
    expect(screen.queryByTestId('template-switch')).toBeNull();
    expect(screen.getByTestId('self-v3-page')).toHaveAttribute('data-template', 'seasons');
  });

  it('a stored Compact layout still opens as Seasons while the switch is off', async () => {
    withBoard((b) => (b.layout.template = 'compact'));
    render(<SelfBoardV3 />);
    await screen.findByTestId('self-v3-chips');
    expect(screen.getByTestId('v3-card-body')).toHaveAttribute('data-template', 'seasons');
  });

  it('two cards across at tablet landscape with the next one peeking; one on a phone', async () => {
    render(<SelfBoardV3 />);
    await screen.findByTestId('self-v3-chips');
    expect(screen.getByTestId('self-v3-carousel')).toHaveAttribute('data-per-view', '2');
    expect(perViewFor('seasons', 'phone')).toBe(1);
  });

  it('a chip slides the carousel to its card and is marked as the one in view', async () => {
    render(<SelfBoardV3 />);
    await screen.findByTestId('self-v3-chips');
    const region = screen.getByTestId('self-v3-carousel');
    fireEvent.click(screen.getByTestId('self-v3-chip-year'));
    expect(region).toHaveAttribute('data-index', '7');
    expect(screen.getByTestId('self-v3-chip-year')).toHaveAttribute('aria-current', 'true');
    expect(screen.getByTestId('self-v3-of')).toHaveTextContent('8 of 8');
  });

  it('a card filled from the v2 build: its body is the current period; named chips; the chip swaps headline and text', async () => {
    render(<SelfBoardV3 />);
    const c = await screen.findByTestId('v3-card-stuck');
    expect(within(c).getByTestId('card-title')).toHaveTextContent('What’s weighing on you');
    expect(within(c).getByTestId('period-0')).toHaveTextContent('Money and effort press · to 12 Dec 2026');
    expect(within(c).queryByTestId('period-2')).toBeNull();
    const text = () => within(c).getAllByTestId('stretch-text').map((p) => p.textContent).join(' ');
    expect(text()).toContain('The heaviest pull this stretch');
    const before = within(c).getByTestId('card-line').textContent;
    fireEvent.click(within(c).getByTestId('period-1'));
    expect(within(c).getByTestId('card-line').textContent).not.toBe(before);
    expect(text()).toContain('The pull on money and effort eases');
  });

  it('a face saves for that card only, after 400 ms, and shows at once', async () => {
    render(<SelfBoardV3 />);
    const c = await screen.findByTestId('v3-card-body');
    expect(c).toHaveAttribute('data-face', 'read');
    fireEvent.click(within(c).getByTestId('face-short'));
    expect(c).toHaveAttribute('data-face', 'short');
    expect(puts()).toHaveLength(0);
    await waitFor(() => expect(puts()).toHaveLength(1));
    expect(puts()[0]!.body!.options).toEqual({ body: { face: 'light' } });
  });

  it('with the PATCH routes live: one small PATCH per card with the version, never the whole layout', async () => {
    srv.patchLive = true;
    withBoard((b) => (b.layout = { ...b.layout, version: 1 }));
    render(<SelfBoardV3 />);
    const body = await screen.findByTestId('v3-card-body');
    fireEvent.click(within(body).getByTestId('face-short'));
    fireEvent.click(within(screen.getByTestId('v3-card-mind')).getByTestId('face-short'));
    await waitFor(() => expect(patches()).toHaveLength(2));
    expect(patches().map((p) => [p.url.replace(/^.*\/api/, '/api'), p.body])).toEqual([
      ['/api/self/v3/layout/cards/body', { version: 1, options: { face: 'light' } }],
      ['/api/self/v3/layout/cards/mind', { version: 2, options: { face: 'light' } }],
    ]);
    expect(puts()).toHaveLength(0);
  });

  it('Edit then Done right after a face change keeps both: the order and the face', async () => {
    srv.patchLive = true;
    withBoard((b) => (b.layout = { ...b.layout, cards: ['body', 'mind', 'stuck', 'year'], version: 1 }));
    srv.stored = { ...srv.stored, cards: ['body', 'mind', 'stuck', 'year'] };
    render(<SelfBoardV3 />);
    await screen.findByTestId('self-v3-chips');
    fireEvent.click(within(screen.getByTestId('v3-card-body')).getByTestId('face-short'));
    fireEvent.click(screen.getByTestId('self-v3-edit'));
    fireEvent.click(screen.getByTestId('chip-right-body'));
    fireEvent.click(screen.getByTestId('chips-done'));
    await waitFor(() => expect(srv.stored.cards).toEqual(['mind', 'body', 'stuck', 'year']));
    await waitFor(() => expect(srv.stored.options).toEqual({ body: { face: 'light' } }));
    expect(patches().find((p) => p.url.endsWith('/layout/deck'))!.body).not.toHaveProperty('options');
  });

  it('a 409 reads the layout again and reapplies the change', async () => {
    srv.patchLive = true;
    srv.stored = { ...srv.stored, version: 7, options: { mind: { face: 'light' } } };
    withBoard((b) => (b.layout = { ...b.layout, version: 1 }));
    render(<SelfBoardV3 />);
    const body = await screen.findByTestId('v3-card-body');
    srv.v3Body = () => {
      const b = selfV3Fixture();
      b.layout = srv.stored;
      return json(b);
    };
    fireEvent.click(within(body).getByTestId('face-short'));
    await waitFor(() => expect(srv.stored.options).toEqual({ mind: { face: 'light' }, body: { face: 'light' } }));
    expect(screen.queryByTestId('chips-error')).toBeNull();
  });

  it('a 401 refreshes the session quietly and saves', async () => {
    srv.patchLive = true;
    srv.refreshOk = true;
    srv.patchQueue = [401];
    withBoard((b) => (b.layout = { ...b.layout, version: 1 }));
    render(<SelfBoardV3 />);
    fireEvent.click(within(await screen.findByTestId('v3-card-body')).getByTestId('face-short'));
    await waitFor(() => expect(srv.stored.options).toEqual({ body: { face: 'light' } }));
    expect(localStorage.getItem('token')).toBe('t2');
    expect(screen.queryByTestId('chips-error')).toBeNull();
  });

  it('a session that cannot be refreshed says so, offers Sign in again, and keeps the choice on screen', async () => {
    srv.patchLive = true;
    srv.patchQueue = [401];
    withBoard((b) => (b.layout = { ...b.layout, version: 1 }));
    render(<SelfBoardV3 />);
    const body = await screen.findByTestId('v3-card-body');
    fireEvent.click(within(body).getByTestId('face-short'));
    expect(await screen.findByTestId('chips-error')).toHaveTextContent(V3_WORDS.sessionEnded);
    expect(screen.getByTestId('self-sign-in-again')).toHaveAttribute('href', expect.stringContaining('/signin'));
    expect(body).toHaveAttribute('data-face', 'short');
    // back from signing in: the waiting change goes out
    fireEvent.focus(window);
    await waitFor(() => expect(srv.stored.options).toEqual({ body: { face: 'light' } }));
    await waitFor(() => expect(screen.queryByTestId('chips-error')).toBeNull());
  });

  it('a refused save puts the card back and says so', async () => {
    srv.layoutStatus = 500;
    srv.layoutBody = () => ({ error: 'boom' });
    render(<SelfBoardV3 />);
    const c = await screen.findByTestId('v3-card-body');
    fireEvent.click(within(c).getByTestId('face-short'));
    expect(c).toHaveAttribute('data-face', 'short');
    await waitFor(() => expect(c).toHaveAttribute('data-face', 'read'));
    expect(screen.getByTestId('chips-error')).toHaveTextContent(V3_WORDS.saveFailed);
  });

  it('the gear keeps the default face and "Is this right?" only; a board face applies to every card', async () => {
    render(<SelfBoardV3 />);
    await screen.findByTestId('v3-card-body');
    fireEvent.click(screen.getByTestId('board-settings-open'));
    expect(screen.queryByTestId('bs-groupby')).toBeNull();
    expect(screen.queryByTestId('bs-tools')).toBeNull();
    expect(screen.queryByTestId('bs-voice')).toBeNull();
    fireEvent.click(screen.getByTestId('bs-face-short'));
    expect(screen.getByTestId('v3-card-body')).toHaveAttribute('data-face', 'short');
    expect(screen.getByTestId('v3-card-mind')).toHaveAttribute('data-face', 'short');
    await waitFor(() => expect(puts()).toHaveLength(1));
    expect(puts()[0]!.body!.boardOptions).toEqual({ face: 'light' });
  });

  it('the voice shows in the gear only when the server allows it and a card has both voices', async () => {
    withBoard((b) => {
      b.features = { allowed: ['feature.voice', 'feature.face.short', 'feature.periods', 'feature.confirm', 'feature.why_panel', 'feature.key_dates'] };
      b.cards.find((c) => c.id === 'body')!.voices = { direct: { line: 'Sleep more. Now.' } };
    });
    render(<SelfBoardV3 />);
    await screen.findByTestId('v3-card-body');
    fireEvent.click(screen.getByTestId('board-settings-open'));
    fireEvent.click(screen.getByTestId('bs-voice-direct'));
    expect(within(screen.getByTestId('v3-card-body')).getByTestId('card-line')).toHaveTextContent('Sleep more. Now.');
  });

  it('opens at once from the cache and keeps the board when the server is briefly unable', async () => {
    const { setSelfV3Cached } = await import('../../../lib/selfV3Cache');
    setSelfV3Cached(selfV3Fixture(), 'W/"a"');
    srv.v3Status = 500;
    srv.v3Body = () => null;
    render(<SelfBoardV3 />);
    expect(screen.getByTestId('v3-card-body')).toBeInTheDocument();
    await waitFor(() => expect(calls.some((c) => c.method === 'GET' && c.url.endsWith('/api/self/v3'))).toBe(true));
    expect(screen.queryByTestId('board-error')).toBeNull();
  });

  it('a reload lands on the card the person was reading', async () => {
    const { setActiveCard } = await import('../../../lib/selfV3Cache');
    setActiveCard('stuck');
    render(<SelfBoardV3 />);
    await screen.findByTestId('self-v3-chips');
    expect(screen.getByTestId('self-v3-carousel')).toHaveAttribute('data-index', '2');
  });

  it('Why opens the details sheet under its plain name', async () => {
    render(<SelfBoardV3 />);
    const c = await screen.findByTestId('v3-card-stuck');
    fireEvent.click(within(c).getByTestId('card-why'));
    const sheet = await screen.findByTestId('details-sheet');
    expect(sheet).toHaveTextContent("the chart's own reasons");
    expect(sheet).toHaveTextContent('What’s weighing on you · Why');
  });

  it('cardSections keeps line and year even when a stored list leaves them out', () => {
    const b = selfV3Fixture();
    const card = b.cards.find((x) => x.id === 'body')!;
    expect(cardSections({ ...b.layout, sections: { body: ['ladder'] } }, card)).toEqual(['line', 'year', 'ladder']);
  });

  it('edit mode hides Edit while Done shows; move, remove (never below three), reset to suggested', async () => {
    withBoard((b) => (b.layout.cards = ['body', 'mind', 'stuck', 'year']));
    render(<SelfBoardV3 />);
    await screen.findByTestId('self-v3-chips');
    fireEvent.click(screen.getByTestId('self-v3-edit'));
    expect(screen.queryByTestId('self-v3-edit')).toBeNull();
    expect(screen.getByTestId('chips-done')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('chip-right-body'));
    fireEvent.click(screen.getByTestId('chip-remove-stuck'));
    expect(screen.getByTestId('chip-remove-body')).toBeDisabled();
    fireEvent.click(screen.getByTestId('chips-done'));
    await waitFor(() => expect(puts()).toHaveLength(1));
    expect(puts()[0]!.body).toMatchObject({ template: 'seasons', cards: ['mind', 'body', 'year'], sections: {} });
    expect(await screen.findByTestId('self-v3-edit')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('self-v3-edit'));
    fireEvent.click(screen.getByTestId('chips-reset'));
    fireEvent.click(screen.getByTestId('chips-done'));
    await waitFor(() => expect(puts()).toHaveLength(2));
    expect(puts()[1]!.body!.cards).toEqual(SUGGESTED_NOW);
  });

  it('says "All cards are shown" when there is nothing left to add', async () => {
    withBoard((b) => (b.layout.cards = b.cards.filter((c) => c.available).map((c) => c.id)));
    render(<SelfBoardV3 />);
    await screen.findByTestId('self-v3-chips');
    expect(screen.queryByTestId('self-v3-chip-add')).toBeNull();
    expect(screen.getByTestId('chips-all-shown')).toHaveTextContent('All cards are shown');
    fireEvent.click(screen.getByTestId('self-v3-edit'));
    expect(screen.getByTestId('chips-all-shown')).toBeInTheDocument();
  });

  it('with feature.compact on, Compact keeps the card in view', async () => {
    withBoard((b) => (b.features = { allowed: ['feature.compact', 'feature.face.short', 'feature.periods', 'feature.confirm', 'feature.why_panel', 'feature.key_dates'] }));
    render(<SelfBoardV3 />);
    await screen.findByTestId('self-v3-chips');
    fireEvent.click(screen.getByTestId('self-v3-chip-diagnosis'));
    expect(screen.getByTestId('self-v3-carousel')).toHaveAttribute('data-index', '4');
    fireEvent.click(screen.getByTestId('template-compact'));
    await waitFor(() => expect(screen.getByTestId('v3-card-body')).toHaveAttribute('data-template', 'compact'));
    expect(screen.getByTestId('self-v3-carousel')).toHaveAttribute('data-index', '4');
    expect(screen.getByTestId('self-v3-chip-diagnosis')).toHaveAttribute('aria-current', 'true');
    fireEvent.click(screen.getByTestId('template-seasons'));
    await waitFor(() => expect(screen.getByTestId('v3-card-body')).toHaveAttribute('data-template', 'seasons'));
    expect(screen.getByTestId('self-v3-carousel')).toHaveAttribute('data-index', '4');
  });

  it('draws only the cards the server allows; a locked card shows "Part of Plus" and no content', async () => {
    withBoard((b) => {
      b.features = {
        allowed: ['card.self.body', 'card.self.mind', 'card.self.year', 'feature.face.short', 'feature.periods', 'feature.confirm'],
        locked: [{ key: 'card.self.stuck', minPlan: 'plus' }],
      };
    });
    render(<SelfBoardV3 />);
    await screen.findByTestId('self-v3-chips');
    expect(chipTitles()).toEqual(['Body & energy', 'How you think', 'What’s weighing on you', 'Your year']);
    const locked = screen.getByTestId('v3-card-stuck');
    expect(within(locked).getByTestId('card-locked')).toHaveTextContent('Part of Plus');
    expect(within(locked).queryByTestId('card-line')).toBeNull();
    // Why and Key dates are off for this person: not drawn
    expect(within(screen.getByTestId('v3-card-body')).queryByTestId('card-why')).toBeNull();
  });

  it('shows the stale-dates note when the server flags passed dates', async () => {
    withBoard((b) => (b.cards.find((c) => c.id === 'body')!.datesPassed = true));
    render(<SelfBoardV3 />);
    const c = await screen.findByTestId('v3-card-body');
    expect(within(c).getByTestId('card-dates-passed')).toHaveTextContent('Some dates here have passed');
  });

  it('a pending card says it is being read; a failed card says so', async () => {
    withBoard((b) => {
      b.layout.cards = ['chapters', 'body', 'stuck'];
      b.cards.find((x) => x.id === 'stuck')!.status = 'failed';
    });
    render(<SelfBoardV3 />);
    const p = await screen.findByTestId('v3-card-chapters');
    expect(within(p).getByTestId('card-title')).toHaveTextContent('Your life phases: before, now, next');
    expect(within(p).getByTestId('card-pending')).toBeInTheDocument();
    expect(within(screen.getByTestId('v3-card-stuck')).getByTestId('card-failed')).toBeInTheDocument();
  });
});

describe('Self board v3: the v2 fallback', () => {
  it('a 404 without a body shows the v2 board unchanged', async () => {
    srv.v3Status = 404;
    srv.v3Body = () => null;
    render(<SelfBoardV3 />);
    expect(await screen.findByTestId('area-card-stuck')).toBeInTheDocument();
    expect(screen.queryByTestId('self-v3-chips')).toBeNull();
  });

  it('a 404 that says no_kundli stays on v3 and asks for birth details', async () => {
    srv.v3Status = 404;
    srv.v3Body = () => json({ status: 'no_kundli' });
    render(<SelfBoardV3 />);
    expect(await screen.findByTestId('board-no-kundli')).toBeInTheDocument();
  });
});
