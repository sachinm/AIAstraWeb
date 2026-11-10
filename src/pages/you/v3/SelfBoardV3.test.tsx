import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import SelfBoardV3, { perViewFor } from './SelfBoardV3';
import { SUGGESTED_IDS, V3_CARDS, selfV3Fixture, selfV3Unchosen } from './selfV3.fixture';
import { selfV2Fixture } from '../v2/selfV2.fixture';
import { V3_WORDS } from './words';
import { cardSections, type SelfBoardLayout, type SelfV3Response } from '../../../lib/selfV3Api';

const plan = vi.hoisted(() => ({ setPlan: vi.fn(), refreshPlan: vi.fn(async () => {}) }));
vi.mock('../../../Auth/ProfileGate', () => ({ usePlan: () => ({ plan: null, setPlan: plan.setPlan, refreshPlan: plan.refreshPlan }) }));

type Call = { method: string; url: string; body?: Record<string, unknown> };
let srv: { v3Status: number; v3Body: () => string | null; layoutStatus: number; layoutBody: ((b: SelfBoardLayout) => unknown) | null };
let calls: Call[];

const json = (b: unknown) => JSON.stringify(b);

beforeEach(() => {
  localStorage.setItem('token', 't');
  Object.defineProperty(window, 'innerWidth', { value: 1180, configurable: true, writable: true });
  Object.defineProperty(window, 'innerHeight', { value: 820, configurable: true, writable: true });
  calls = [];
  srv = { v3Status: 200, v3Body: () => json(selfV3Fixture()), layoutStatus: 200, layoutBody: null };
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
      if (u.endsWith('/api/self/v3/confirm')) return new Response(null, { status: 204 });
      if (u.endsWith('/api/self/v2') && method === 'GET') return new Response(json(selfV2Fixture()), { status: 200 });
      return new Response(null, { status: 404 });
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

const puts = () => calls.filter((c) => c.method === 'PUT' && c.url.endsWith('/api/self/v3/layout'));
const tile = (id: string) => screen.getByTestId(`picker-tile-${id}`);
const ticked = () => screen.getAllByRole('checkbox').filter((t) => t.getAttribute('aria-checked') === 'true');

function unchosen() {
  srv.v3Body = () => json(selfV3Unchosen());
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
    expect(screen.getByTestId('picker-group-time')).toHaveTextContent('Time');
    expect(within(tile('body')).getByTestId('picker-suggested')).toHaveTextContent('Suggested for you');
    expect(within(tile('body')).getByTestId('picker-first-line')).toHaveTextContent('Rest stays thin until 5 December');
    expect(within(tile('yogas')).queryByTestId('picker-suggested')).toBeNull();
    // an unavailable card is greyed with its reason and cannot be ticked
    expect(tile('presence')).toBeDisabled();
    expect(within(tile('presence')).getByTestId('picker-unavailable')).toHaveTextContent('needs a birth time');
    // no chips, no carousel until Done
    expect(screen.queryByTestId('self-v3-chips')).toBeNull();
    expect(screen.queryByTestId('picker-cancel')).toBeNull();
  });

  it('"Add the suggested eight" ticks the eight suggested cards in one tap', async () => {
    unchosen();
    render(<SelfBoardV3 />);
    await screen.findByTestId('self-v3-picker');
    fireEvent.click(screen.getByTestId('picker-add-suggested'));
    expect(ticked()).toHaveLength(8);
    expect(ticked().map((t) => t.getAttribute('data-testid')!.replace('picker-tile-', '')).sort()).toEqual([...SUGGESTED_IDS].sort());
    expect(screen.getByTestId('picker-count')).toHaveTextContent('8 chosen');
    expect(screen.getByTestId('picker-done')).toBeEnabled();
  });

  it('keeps Done disabled under three cards, and is kind past eight', async () => {
    unchosen();
    render(<SelfBoardV3 />);
    await screen.findByTestId('self-v3-picker');
    const done = screen.getByTestId('picker-done');
    expect(done).toBeDisabled();
    fireEvent.click(tile('body'));
    fireEvent.click(tile('mind'));
    expect(done).toBeDisabled();
    expect(screen.getByTestId('picker-note')).toHaveTextContent('Pick at least three cards (2 chosen).');
    fireEvent.click(tile('year'));
    expect(done).toBeEnabled();
    fireEvent.click(tile('mind'));
    expect(done).toBeDisabled();
    fireEvent.click(tile('mind'));
    fireEvent.click(screen.getByTestId('picker-add-suggested'));
    fireEvent.click(tile('yogas'));
    expect(ticked()).toHaveLength(9);
    expect(screen.getByTestId('picker-note')).toHaveTextContent(V3_WORDS.moreThanEight);
    expect(done).toBeEnabled();
  });

  it('Done sends the template, the cards in the order ticked and the sections through PUT layout, then shows the board', async () => {
    unchosen();
    render(<SelfBoardV3 />);
    await screen.findByTestId('self-v3-picker');
    fireEvent.click(tile('year'));
    fireEvent.click(tile('body'));
    fireEvent.click(tile('mind'));
    fireEvent.click(screen.getByTestId('picker-done'));
    await waitFor(() => expect(puts()).toHaveLength(1));
    expect(puts()[0]!.body).toEqual({ template: 'seasons', cards: ['year', 'body', 'mind'], sections: {} });
    await screen.findByTestId('self-v3-chips');
    expect(screen.queryByTestId('self-v3-picker')).toBeNull();
    expect(within(screen.getByTestId('self-v3-chips')).getAllByRole('tab').map((c) => c.textContent)).toEqual(['This year', 'Body & energy', 'How you think']);
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

  it('the + chip opens the picker with the person’s cards ticked, and Cancel goes back', async () => {
    render(<SelfBoardV3 />);
    await screen.findByTestId('self-v3-chips');
    fireEvent.click(screen.getByTestId('self-v3-chip-add'));
    await screen.findByTestId('self-v3-picker');
    expect(ticked()).toHaveLength(8);
    fireEvent.click(screen.getByTestId('picker-cancel'));
    expect(await screen.findByTestId('self-v3-chips')).toBeInTheDocument();
    expect(puts()).toHaveLength(0);
  });
});

describe('Self board v3: the board', () => {
  it('has a title row only: Self, the clock line, Edit and the template switch; no hero and no strip', async () => {
    render(<SelfBoardV3 />);
    await screen.findByTestId('self-board-row');
    expect(screen.getByTestId('self-title')).toHaveTextContent(/^Self$/);
    expect(screen.getByTestId('self-clock-line')).toHaveTextContent('Read on your Main clock');
    expect(screen.getByTestId('self-v3-edit')).toBeInTheDocument();
    expect(screen.getByTestId('template-seasons')).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByTestId('self-hero')).toBeNull();
    expect(screen.queryByTestId('hero-strip')).toBeNull();
  });

  it('two cards across at tablet landscape with the next one peeking; one on a phone', async () => {
    render(<SelfBoardV3 />);
    await screen.findByTestId('self-v3-chips');
    expect(screen.getByTestId('self-v3-carousel')).toHaveAttribute('data-per-view', '2');
    expect(screen.getByTestId('self-v3-carousel-track').style.gridAutoColumns).toContain('88px');
    expect(perViewFor('seasons', 'phone')).toBe(1);
    expect(perViewFor('compact', 'landscape')).toBe(4);
  });

  it('a chip slides the carousel to its card, and the count follows', async () => {
    render(<SelfBoardV3 />);
    await screen.findByTestId('self-v3-chips');
    const region = screen.getByTestId('self-v3-carousel');
    expect(screen.getByTestId('self-v3-of')).toHaveTextContent('1 of 8');
    fireEvent.click(screen.getByTestId('self-v3-chip-year'));
    expect(region).toHaveAttribute('data-index', '7');
    expect(screen.getByTestId('self-v3-chip-year')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('self-v3-of')).toHaveTextContent('8 of 8');
    fireEvent.click(screen.getByTestId('self-v3-carousel-prev'));
    expect(region).toHaveAttribute('data-index', '6');
  });

  it('tapping a period on the rail changes the left column; the current period is selected on open', async () => {
    render(<SelfBoardV3 />);
    const c = await screen.findByTestId('v3-card-body');
    expect(within(c).getByTestId('card-line')).toHaveTextContent('Rest stays thin until 5 December, then it comes back.');
    expect(within(c).getByTestId('rail-0')).toHaveAttribute('aria-pressed', 'true');
    expect(within(c).getByTestId('rail-tone-0')).toHaveTextContent('Heavy');
    expect(within(c).getByTestId('rail-tone-2')).toHaveTextContent('Light');
    expect(within(c).getByTestId('stretch-mode')).toHaveTextContent('Get through');
    expect(within(c).getByTestId('stretch-asks')).toHaveTextContent('guard your evenings');
    fireEvent.click(within(c).getByTestId('rail-2'));
    expect(within(c).getByTestId('rail-2')).toHaveAttribute('aria-pressed', 'true');
    expect(within(c).getByTestId('rail-0')).toHaveAttribute('aria-pressed', 'false');
    expect(within(c).getByTestId('stretch-mode')).toHaveTextContent('Build');
    expect(within(c).getByTestId('stretch-asks')).toHaveTextContent('A good stretch to build strength');
    expect(within(c).getByTestId('stretch-step')).toHaveTextContent('twenty minutes');
    expect(within(c).getByTestId('card-agreement')).toHaveTextContent('Checked on 3 of 4 clocks');
    expect(within(c).getByTestId('card-sensitive')).toHaveTextContent('From your chart. Not medical advice.');
  });

  it('a card filled from the v2 build shows its body with the period note', async () => {
    render(<SelfBoardV3 />);
    const c = await screen.findByTestId('v3-card-stuck');
    expect(within(c).getByTestId('card-line')).toHaveTextContent('What bothers you: ideas outrun their footing');
    expect(within(c).getByTestId('stretch-mode')).toHaveTextContent('now → 12 Dec 2026 · Money and effort press');
    fireEvent.click(within(c).getByTestId('rail-1'));
    expect(within(c).getByTestId('stretch-mode')).toHaveTextContent('The pull eases');
    expect(within(c).queryByTestId('card-sensitive')).toBeNull();
  });

  it('"Is this right?" posts the answer and says it is noted', async () => {
    render(<SelfBoardV3 />);
    const c = await screen.findByTestId('v3-card-body');
    expect(within(c).getByTestId('section-confirm')).toHaveTextContent('Since 18 May 2025, have you been sleeping worse?');
    fireEvent.click(within(c).getByTestId('confirm-partly'));
    expect(await within(c).findByTestId('section-confirm-done')).toHaveTextContent('Noted. This sharpens your next reading.');
    const post = calls.find((x) => x.url.endsWith('/api/self/v3/confirm'));
    expect(post?.body).toEqual({ claimId: 'body.c1', answer: 'partly' });
  });

  it('Edit sections toggles a section and saves it; line and year cannot be switched off', async () => {
    render(<SelfBoardV3 />);
    const c = await screen.findByTestId('v3-card-body');
    expect(within(c).queryByTestId('section-pattern')).toBeNull();
    fireEvent.click(within(c).getByTestId('edit-sections-body'));
    const menu = within(c).getByTestId('sections-menu-body');
    const line = within(menu).getByTestId('section-toggle-line');
    const year = within(menu).getByTestId('section-toggle-year');
    expect(line).toBeChecked();
    expect(line).toBeDisabled();
    expect(year).toBeChecked();
    expect(year).toBeDisabled();
    expect(menu).toHaveTextContent('Always on');
    fireEvent.click(line);
    expect(puts()).toHaveLength(0);
    fireEvent.click(within(menu).getByTestId('section-toggle-pattern'));
    await waitFor(() => expect(puts()).toHaveLength(1));
    expect(puts()[0]!.body!.sections).toEqual({ body: ['line', 'year', 'stretch', 'confirm', 'pattern'] });
    expect(await within(c).findByTestId('section-pattern')).toHaveTextContent('You push through tiredness');
    fireEvent.click(within(menu).getByTestId('section-toggle-stretch'));
    await waitFor(() => expect(puts()).toHaveLength(2));
    expect(puts()[1]!.body!.sections).toEqual({ body: ['line', 'year', 'confirm', 'pattern'] });
    expect(within(c).queryByTestId('section-stretch')).toBeNull();
    expect(within(c).getByTestId('card-line')).toBeInTheDocument();
    expect(within(c).getByTestId('section-year')).toBeInTheDocument();
  });

  it('cardSections keeps line and year even when a stored list leaves them out', () => {
    const b = selfV3Fixture();
    const card = b.cards.find((x) => x.id === 'body')!;
    expect(cardSections(b.layout, card)).toEqual(['line', 'year', 'stretch', 'confirm']);
    expect(cardSections({ ...b.layout, sections: { body: ['ladder'] } }, card)).toEqual(['line', 'year', 'ladder']);
  });

  it('details opens the Chart details sheet', async () => {
    const b = selfV3Fixture();
    b.layout.sections = { stuck: ['line', 'year', 'details'] };
    srv.v3Body = () => json(b);
    render(<SelfBoardV3 />);
    const c = await screen.findByTestId('v3-card-stuck');
    fireEvent.click(within(c).getByTestId('card-details-open'));
    expect(await screen.findByTestId('details-sheet')).toHaveTextContent("the chart's own reasons");
  });

  it('edit mode: move, remove (never below three), reset to suggested, and Done saves the order', async () => {
    const b = selfV3Fixture();
    b.layout.cards = ['body', 'mind', 'stuck', 'year'];
    srv.v3Body = () => json(b);
    render(<SelfBoardV3 />);
    await screen.findByTestId('self-v3-chips');
    fireEvent.click(screen.getByTestId('self-v3-edit'));
    expect(screen.getByTestId('self-v3-chips')).toHaveAttribute('data-editing', 'true');
    fireEvent.click(screen.getByTestId('chip-right-body'));
    fireEvent.click(screen.getByTestId('chip-remove-stuck'));
    expect(screen.getByTestId('chip-remove-body')).toBeDisabled();
    fireEvent.click(screen.getByTestId('chips-done'));
    await waitFor(() => expect(puts()).toHaveLength(1));
    expect(puts()[0]!.body).toEqual({ template: 'seasons', cards: ['mind', 'body', 'year'], sections: {} });
    expect(await screen.findByTestId('self-v3-chips')).toHaveAttribute('data-editing', 'false');
    fireEvent.click(screen.getByTestId('self-v3-edit'));
    fireEvent.click(screen.getByTestId('chips-reset'));
    fireEvent.click(screen.getByTestId('chips-done'));
    await waitFor(() => expect(puts()).toHaveLength(2));
    expect(puts()[1]!.body!.cards).toEqual(V3_CARDS.filter((c) => c.suggested).map((c) => c.id));
  });

  it('the template switch saves Compact and draws the cards four across', async () => {
    render(<SelfBoardV3 />);
    await screen.findByTestId('self-v3-chips');
    fireEvent.click(screen.getByTestId('template-compact'));
    await waitFor(() => expect(puts()).toHaveLength(1));
    expect(puts()[0]!.body!.template).toBe('compact');
    expect(screen.getByTestId('self-v3-carousel')).toHaveAttribute('data-per-view', '4');
    expect(screen.getByTestId('v3-card-body')).toHaveAttribute('data-template', 'compact');
    expect(within(screen.getByTestId('v3-card-stuck')).getByTestId('card-dates')).toHaveTextContent('3 Jun → 4 Oct 2027');
  });

  it('a pending card shows its title and description; a failed card says so', async () => {
    const b: SelfV3Response = selfV3Fixture();
    b.layout.cards = ['chapters', 'body', 'stuck'];
    b.cards.find((x) => x.id === 'stuck')!.status = 'failed';
    srv.v3Body = () => json(b);
    render(<SelfBoardV3 />);
    const p = await screen.findByTestId('v3-card-chapters');
    expect(p).toHaveTextContent('The long arc of your life.');
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
    expect(screen.getByTestId('self-v2-page')).toBeInTheDocument();
    expect(screen.queryByTestId('self-v3-chips')).toBeNull();
    expect(calls.some((c) => c.method === 'GET' && c.url.endsWith('/api/self/v2'))).toBe(true);
  });

  it('a 404 with a non-JSON body shows the v2 board too', async () => {
    srv.v3Status = 404;
    srv.v3Body = () => 'Cannot GET /api/self/v3';
    render(<SelfBoardV3 />);
    expect(await screen.findByTestId('area-card-stuck')).toBeInTheDocument();
  });

  it('a 404 that says no_kundli stays on v3 and asks for birth details', async () => {
    srv.v3Status = 404;
    srv.v3Body = () => json({ status: 'no_kundli' });
    render(<SelfBoardV3 />);
    expect(await screen.findByTestId('board-no-kundli')).toBeInTheDocument();
    expect(calls.some((c) => c.url.endsWith('/api/self/v2'))).toBe(false);
  });
});
