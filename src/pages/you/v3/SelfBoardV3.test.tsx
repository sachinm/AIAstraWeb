import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import SelfBoardV3, { perViewFor } from './SelfBoardV3';
import { selfHeaderLine } from '../../board/v3/BoardV3';
import { SUGGESTED_IDS, selfV3Fixture, selfV3Unchosen } from './selfV3.fixture';
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

  // server docs/dashboards/13 §4.3: Seasons cards across follows the deck's measured width once it is measured
  it('three cards across on a 1708 px deck (1920 px desktop), and the gear\'s "Cards across" overrides it', async () => {
    const seen: Array<(w: number) => void> = [];
    class RO {
      cb: (e: Array<{ contentRect: { width: number } }>) => void;
      constructor(cb: (e: Array<{ contentRect: { width: number } }>) => void) {
        this.cb = cb;
        seen.push((w) => this.cb([{ contentRect: { width: w } }]));
      }
      observe() {}
      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', RO);
    Object.defineProperty(window, 'innerWidth', { value: 1920, configurable: true, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 1080, configurable: true, writable: true });
    render(<SelfBoardV3 />);
    await screen.findByTestId('self-v3-chips');
    act(() => seen.forEach((fire) => fire(1708)));
    expect(screen.getByTestId('self-v3-carousel')).toHaveAttribute('data-per-view', '3');
    fireEvent.click(screen.getByTestId('board-settings-open'));
    fireEvent.click(screen.getByTestId('bs-across-2'));
    expect(screen.getByTestId('self-v3-carousel')).toHaveAttribute('data-per-view', '2');
    expect(localStorage.getItem('aa.board.across')).toBe('2');
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

  it('a card read with its stored dates: its body is the current period; named chips; the chip swaps headline and text', async () => {
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

  // docs/dashboards/12: the three bars (Read · Analysis · Calendar) replaced the per-card Read / Short switch, so no card
  // control saves a face of its own any more (the per-card PATCH queue keeps its unit tests in layoutSaver.test.ts)
  it('a card has no face switch of its own; a stored own Short reads as Read and nothing is saved', async () => {
    withBoard((b) => (b.layout = { ...b.layout, options: { body: { face: 'light' } } }));
    render(<SelfBoardV3 />);
    const c = await screen.findByTestId('v3-card-body');
    expect(within(c).queryByTestId('face-short')).toBeNull();
    // tablet and desktop (server docs/dashboards/13): Outlook · Astrology Reading · Calendar
    expect(c).toHaveAttribute('data-face', 'outlook');
    fireEvent.click(within(c).getByTestId('card-view-astrology'));
    expect(c).toHaveAttribute('data-face', 'astrology');
    fireEvent.click(within(c).getByTestId('card-view-calendar'));
    expect(c).toHaveAttribute('data-face', 'calendar');
    await new Promise((r) => setTimeout(r, 450));
    expect(puts()).toHaveLength(0);
    expect(patches()).toHaveLength(0);
  });

  it('the gear keeps "Is this right?" and no face or tools', async () => {
    render(<SelfBoardV3 />);
    await screen.findByTestId('v3-card-body');
    fireEvent.click(screen.getByTestId('board-settings-open'));
    expect(screen.queryByTestId('bs-groupby')).toBeNull();
    expect(screen.queryByTestId('bs-tools')).toBeNull();
    expect(screen.queryByTestId('bs-voice')).toBeNull();
    expect(screen.queryByTestId('bs-face-short')).toBeNull();
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

  // docs/techniques/09 §4.3: the "i" button is back on tablet and desktop and opens the full reading; Outlook's Full
  // reading section carries it too; the Astrology Reading tab waits for the thread
  it('tablet and desktop: "i" opens the full reading sheet (the story, no filler); the Astrology tab shows the story', async () => {
    render(<SelfBoardV3 />);
    const c = await screen.findByTestId('v3-card-stuck');
    fireEvent.click(within(c).getByTestId('card-why'));
    const sheet = await screen.findByTestId('details-sheet');
    expect(within(sheet).getByTestId('details-story')).toHaveTextContent("the chart's own reasons");
    expect(within(sheet).queryByTestId('area-details')).toBeNull();
    expect(sheet).not.toHaveTextContent('Nothing more to show');
    fireEvent.click(within(c).getByTestId('card-view-astrology'));
    expect(within(c).getByTestId('astrology-story')).toHaveTextContent("the chart's own reasons");
    expect(within(c).queryByTestId('astrology-details')).toBeNull();
  });

  it('"i" on a card with no story, no systems and no long reading says it is being prepared, never a filler line', async () => {
    withBoard((b) => {
      const s = b.cards.find((c) => c.id === 'stuck')!;
      s.v3 = { ...s.v3!, story: null };
    });
    render(<SelfBoardV3 />);
    const c = await screen.findByTestId('v3-card-stuck');
    fireEvent.click(within(c).getByTestId('card-why'));
    const sheet = await screen.findByTestId('details-sheet');
    expect(within(sheet).getByTestId('details-empty')).toHaveTextContent('The full astrology reading is being prepared for this card.');
    expect(sheet).not.toHaveTextContent('Nothing more to show');
  });

  it('legacy: a card still filled from the v2 build shows its long reading in the "i" sheet and on the Astrology tab', async () => {
    srv.v3Body = () => json(selfV3Fixture({ v2: true }));
    render(<SelfBoardV3 />);
    const c = await screen.findByTestId('v3-card-stuck');
    fireEvent.click(within(c).getByTestId('card-why'));
    const sheet = await screen.findByTestId('details-sheet');
    expect(within(sheet).getByTestId('area-details')).toHaveTextContent("the chart's own reasons");
    fireEvent.click(within(c).getByTestId('card-view-astrology'));
    expect(within(c).getByTestId('astrology-empty')).toBeInTheDocument();
    expect(within(c).getByTestId('astrology-details')).toHaveTextContent("the chart's own reasons");
  });

  it('a phone: Why opens the details sheet under its plain name', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 390, configurable: true, writable: true });
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

  // server docs/dashboards/13 §4.3: on a phone Edit stays the chips edit mode (in the board sheet)
  it('a phone: edit mode shows Done; move, remove (never below three), reset to suggested', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 390, configurable: true, writable: true });
    withBoard((b) => (b.layout.cards = ['body', 'mind', 'stuck', 'year']));
    render(<SelfBoardV3 />);
    const edit = async () => {
      fireEvent.click(await screen.findByTestId('self-phone-reading'));
      fireEvent.click(within(await screen.findByTestId('self-reading-sheet')).getByTestId('self-v3-edit'));
    };
    await edit();
    expect(screen.getByTestId('chips-done')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('chip-right-body'));
    fireEvent.click(screen.getByTestId('chip-remove-stuck'));
    expect(screen.getByTestId('chip-remove-body')).toBeDisabled();
    fireEvent.click(screen.getByTestId('chips-done'));
    await waitFor(() => expect(puts()).toHaveLength(1));
    expect(puts()[0]!.body).toMatchObject({ template: 'seasons', cards: ['mind', 'body', 'year'], sections: {} });
    await waitFor(() => expect(screen.queryByTestId('chips-done')).toBeNull());
    await edit();
    fireEvent.click(screen.getByTestId('chips-reset'));
    fireEvent.click(screen.getByTestId('chips-done'));
    await waitFor(() => expect(puts()).toHaveLength(2));
    expect(puts()[1]!.body!.cards).toEqual(SUGGESTED_NOW);
  });

  // server docs/dashboards/13 §4.3: on tablet and desktop "Cards" opens the chooser with the board's cards ticked, in order
  it('tablet and desktop: Cards opens the chooser with the board ticked; Done saves the order and the choice in one save', async () => {
    withBoard((b) => (b.layout.cards = ['body', 'mind', 'stuck', 'year']));
    render(<SelfBoardV3 />);
    await screen.findByTestId('self-v3-chips');
    expect(screen.getByTestId('self-v3-edit')).toHaveTextContent('Cards');
    fireEvent.click(screen.getByTestId('self-v3-edit'));
    await screen.findByTestId('self-v3-picker');
    expect(ticked()).toHaveLength(4);
    for (const id of ['body', 'mind', 'stuck', 'year']) expect(tile(id)).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByTestId('chips-done')).toBeNull();
    fireEvent.click(screen.getByTestId('picker-tray-later-body'));
    fireEvent.click(tile('stuck'));
    fireEvent.click(screen.getByTestId('picker-done'));
    await waitFor(() => expect(puts()).toHaveLength(1));
    expect(puts()[0]!.body).toMatchObject({ template: 'seasons', cards: ['mind', 'body', 'year'], sections: {} });
    await waitFor(() => expect(screen.queryByTestId('self-v3-picker')).toBeNull());
  });

  it('tablet and desktop: Cancel leaves the board as it was', async () => {
    render(<SelfBoardV3 />);
    await screen.findByTestId('self-v3-chips');
    fireEvent.click(screen.getByTestId('self-v3-edit'));
    fireEvent.click(await screen.findByTestId('picker-cancel'));
    expect(await screen.findByTestId('self-v3-chips')).toBeInTheDocument();
    expect(puts()).toHaveLength(0);
  });

  it('says "All cards are shown" when there is nothing left to add', async () => {
    withBoard((b) => (b.layout.cards = b.cards.filter((c) => c.available).map((c) => c.id)));
    render(<SelfBoardV3 />);
    await screen.findByTestId('self-v3-chips');
    expect(screen.queryByTestId('self-v3-chip-add')).toBeNull();
    expect(screen.getByTestId('chips-all-shown')).toHaveTextContent('All cards are shown');
  });

  it('a phone: "All cards are shown" stays in edit mode', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 390, configurable: true, writable: true });
    withBoard((b) => (b.layout.cards = b.cards.filter((c) => c.available).map((c) => c.id)));
    render(<SelfBoardV3 />);
    fireEvent.click(await screen.findByTestId('self-phone-reading'));
    fireEvent.click(within(await screen.findByTestId('self-reading-sheet')).getByTestId('self-v3-edit'));
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

describe('Self board v3: served board fields (servedFieldsRendered, board)', () => {
  it('`reading.deeperReadingReady`: one calm note; its Refresh opens the consent sheet; closing it holds for the session', async () => {
    withBoard((b) => {
      b.reading = { enabled: true, stage: 'done', clocks: [], done: 8, total: 8, capReached: false, preparing: false, deeperReadingReady: true };
    });
    const r = render(<SelfBoardV3 />);
    const note = await screen.findByTestId('deeper-ready');
    expect(note).toHaveTextContent('A deeper reading is ready. Refresh uses 1 of your questions.');
    fireEvent.click(within(note).getByTestId('deeper-refresh'));
    expect(await screen.findByTestId('fresh-sheet')).toBeInTheDocument();
    // the note never refreshes by itself: only the sheet's confirm posts
    expect(calls.some((c) => c.method === 'POST' && c.url.includes('refresh'))).toBe(false);
    fireEvent.click(screen.getByTestId('fresh-not-now'));
    fireEvent.click(screen.getByTestId('deeper-hide'));
    expect(screen.queryByTestId('deeper-ready')).toBeNull();
    r.unmount();
    render(<SelfBoardV3 />);
    await screen.findByTestId('self-v3-chips');
    expect(screen.queryByTestId('deeper-ready')).toBeNull();
  });

  it('no note without the flag', async () => {
    render(<SelfBoardV3 />);
    await screen.findByTestId('self-v3-chips');
    expect(screen.queryByTestId('deeper-ready')).toBeNull();
  });

  it('a phone: the note is in the reading sheet and the reading button carries its dot', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 390, configurable: true, writable: true });
    withBoard((b) => {
      b.reading = { enabled: true, stage: 'done', clocks: [], done: 8, total: 8, capReached: false, preparing: false, deeperReadingReady: true };
    });
    render(<SelfBoardV3 />);
    expect(await screen.findByTestId('self-phone-reading-dot')).toBeInTheDocument();
    expect(screen.queryByTestId('deeper-ready')).toBeNull();
    fireEvent.click(screen.getByTestId('self-phone-reading'));
    expect(within(await screen.findByTestId('self-reading-sheet')).getByTestId('deeper-ready')).toBeInTheDocument();
  });
});

describe('Self board v3: the header line (the diagnosis card)', () => {
  const LINE = 'In short: ideas outrun their footing until 12 Dec 2026.';

  it("reads the diagnosis card's v3 line and shows it beside the clock line", async () => {
    render(<SelfBoardV3 />);
    const line = await screen.findByTestId('self-hero-line');
    expect(line).toHaveTextContent(LINE);
    expect(line.parentElement).toBe(screen.getByTestId('self-clock-line').parentElement);
    expect(screen.getAllByTestId('self-hero-line')).toHaveLength(1);
  });

  it("the server's `headerLine` wins; a null `headerLine` shows nothing", async () => {
    withBoard((b) => (b.headerLine = 'You are rebuilding, not running down, until 5 December.'));
    const r = render(<SelfBoardV3 />);
    expect(await screen.findByTestId('self-hero-line')).toHaveTextContent('You are rebuilding, not running down, until 5 December.');
    r.unmount();
    clearSelfV3Cached();
    withBoard((b) => (b.headerLine = null));
    render(<SelfBoardV3 />);
    await screen.findByTestId('self-v3-chips');
    expect(screen.queryByTestId('self-hero-line')).toBeNull();
  });

  it('comes from every card the board carries, not only the ones on screen', async () => {
    withBoard((b) => (b.layout = { ...b.layout, cards: b.layout.cards.filter((id) => id !== 'diagnosis') }));
    render(<SelfBoardV3 />);
    expect(await screen.findByTestId('self-hero-line')).toHaveTextContent(LINE);
  });

  it.each<[string, (b: SelfV3Response) => void]>([
    ['unread', (b) => (b.cards.find((c) => c.id === 'diagnosis')!.state = 'not_read')],
    ['locked', (b) => (b.features = { allowed: ['card.self.body', 'feature.why_panel'], locked: [{ key: 'card.self.diagnosis', minPlan: 'plus' }] })],
    ['off', (b) => (b.features = { allowed: ['card.self.body', 'feature.why_panel'] })],
    ['no v3 text', (b) => (b.cards.find((c) => c.id === 'diagnosis')!.v3 = null)],
  ])('nothing when the card is %s', async (_n, edit) => {
    withBoard(edit);
    render(<SelfBoardV3 />);
    await screen.findByTestId('self-v3-page');
    await waitFor(() => expect(calls.some((c) => c.method === 'GET' && c.url.endsWith('/api/self/v3'))).toBe(true));
    expect(screen.queryByTestId('self-hero-line')).toBeNull();
  });

  it('never falls back to the v2 headline', async () => {
    srv.v3Body = () => json(selfV3Fixture({ v2: true }));
    render(<SelfBoardV3 />);
    await screen.findByTestId('self-v3-chips');
    expect(screen.queryByTestId('self-hero-line')).toBeNull();
  });

  it('a phone: only in the reading sheet', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 390, configurable: true, writable: true });
    render(<SelfBoardV3 />);
    await screen.findByTestId('v3-card-body');
    expect(screen.queryByTestId('self-hero-line')).toBeNull();
    fireEvent.click(screen.getByTestId('self-phone-reading'));
    expect(within(await screen.findByTestId('self-reading-sheet')).getByTestId('self-hero-line')).toHaveTextContent(LINE);
  });

  it('Love and Work have none', () => {
    expect(selfHeaderLine({ ...selfV3Fixture(), headerLine: 'x' }, 'love')).toBeNull();
    expect(selfHeaderLine(selfV3Fixture(), 'self')).toBe(LINE);
  });
});

describe('Self board v3: the legacy fallback', () => {
  it('a 404 without a body shows the legacy board it was given, unchanged', async () => {
    srv.v3Status = 404;
    srv.v3Body = () => null;
    render(<SelfBoardV3 legacy={<div data-testid="legacy-you">legacy</div>} />);
    expect(await screen.findByTestId('legacy-you')).toBeInTheDocument();
    expect(screen.queryByTestId('self-v3-chips')).toBeNull();
  });

  it('a 404 that says no_kundli stays on v3 and asks for birth details', async () => {
    srv.v3Status = 404;
    srv.v3Body = () => json({ status: 'no_kundli' });
    render(<SelfBoardV3 />);
    expect(await screen.findByTestId('board-no-kundli')).toBeInTheDocument();
  });
});
