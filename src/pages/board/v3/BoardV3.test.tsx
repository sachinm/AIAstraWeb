/**
 * The one v3 board on Self, Love and Work (server docs/dashboards/10 W8): each board renders its own cards, Love and
 * Work open on the server's lens and switch lenses in place, they fall back to the legacy board when v3 is off, and no
 * internal technique id is ever on screen.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import BoardV3 from './BoardV3';
import { boardV3Fixture } from './boardV3.fixture';
import { selfV3Fixture } from '../../you/v3/selfV3.fixture';
import { clearSelfV3Cached } from '../../../lib/selfV3Cache';
import type { BoardId } from '../../../lib/selfV3Api';

const plan = vi.hoisted(() => ({ setPlan: vi.fn(), refreshPlan: vi.fn(async () => {}) }));
vi.mock('../../../Auth/ProfileGate', () => ({ usePlan: () => ({ plan: null, setPlan: plan.setPlan, refreshPlan: plan.refreshPlan }) }));

/** an internal technique or fact id shown as text (`work.present_tone`, `love.activation`, `self.focus`) */
export const INTERNAL_ID = /\b(work|love|self)\.[a-z_]+\b/;

type Call = { method: string; url: string; body?: Record<string, unknown> };
let calls: Call[];
let srv: { status: number; body: () => unknown };

const json = (b: unknown) => JSON.stringify(b);

function bodyFor(board: BoardId): () => unknown {
  return board === 'self' ? () => selfV3Fixture() : () => boardV3Fixture(board);
}

beforeEach(() => {
  clearSelfV3Cached();
  sessionStorage.clear();
  localStorage.setItem('token', 't');
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-18T12:00:00'));
  Object.defineProperty(window, 'innerWidth', { value: 1180, configurable: true, writable: true });
  Object.defineProperty(window, 'innerHeight', { value: 820, configurable: true, writable: true });
  calls = [];
  srv = { status: 200, body: () => boardV3Fixture('love') };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const method = (init.method ?? 'GET').toUpperCase();
      const body = init.body && typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
      const u = String(url);
      calls.push({ method, url: u, body });
      if (/\/api\/(self\/v3|board\/(love|work)\/v3)$/.test(u) && method === 'GET') return new Response(json(srv.body()), { status: srv.status });
      if (/\/api\/board\/(love|work)\/v3\/layout$/.test(u) && method === 'PUT') {
        const cur = srv.body() as ReturnType<typeof boardV3Fixture>;
        const p = (body?.patch ?? {}) as { cards?: string[]; boardOptions?: Record<string, unknown> };
        return new Response(json({ ...cur.layout, cards: p.cards ?? cur.layout.cards, boardOptions: p.boardOptions ?? {}, version: 4, reading: { queued: [] } }), { status: 200 });
      }
      if (u.endsWith('/confirm')) return new Response(null, { status: 204 });
      return new Response(null, { status: 404 });
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  localStorage.clear();
  window.history.replaceState(null, '', '/');
});

const chipIds = () =>
  within(screen.getByTestId('self-v3-chips'))
    .queryAllByTestId(/^self-v3-chip-(?!add)/)
    .map((el) => el.getAttribute('data-testid')!.replace('self-v3-chip-', ''));

describe.each<[BoardId, string[]]>([
  ['self', ['body', 'mind']],
  ['love', ['dating_pulse', 'dating_meeting_timing']],
  ['work', ['job_pulse', 'job_promotion_recognition']],
])('the %s board', (board, firstCards) => {
  it('renders its own cards and no internal id', async () => {
    srv.body = bodyFor(board);
    render(<BoardV3 board={board} legacy={<div data-testid="legacy">legacy</div>} />);
    await screen.findByTestId('self-v3-chips');
    const page = screen.getByTestId('self-v3-page');
    expect(page).toHaveAttribute('data-board', board);
    await waitFor(() => expect(chipIds().slice(0, 2)).toEqual(firstCards));
    expect(calls.find((c) => c.url.includes('/api/'))!.url).toMatch(board === 'self' ? /\/api\/self\/v3$/ : new RegExp(`/api/board/${board}/v3$`));
    expect(page.textContent).not.toMatch(INTERNAL_ID);
    expect(screen.queryByTestId('legacy')).toBeNull();
  });
});

describe('Love and Work lenses', () => {
  it('Love opens on the server default lens and shows only its cards', async () => {
    render(<BoardV3 board="love" />);
    await screen.findByTestId('self-v3-chips');
    expect(screen.getByTestId('lens-dating')).toHaveAttribute('aria-selected', 'true');
    expect(chipIds()).toEqual(['dating_pulse', 'dating_meeting_timing']);
    expect(screen.getByTestId('board-title')).toHaveTextContent('Love');
  });

  it('a stored lens wins over the default', async () => {
    srv.body = () => boardV3Fixture('love', { lens: 'marriage' });
    render(<BoardV3 board="love" />);
    await screen.findByTestId('self-v3-chips');
    expect(screen.getByTestId('lens-marriage')).toHaveAttribute('aria-selected', 'true');
    expect(chipIds()).toEqual(['marriage_pulse']);
  });

  it('switching to a lens with cards shows them at once and saves the lens', async () => {
    render(<BoardV3 board="love" />);
    await screen.findByTestId('self-v3-chips');
    fireEvent.click(screen.getByTestId('lens-marriage'));
    expect(chipIds()).toEqual(['marriage_pulse']);
    await waitFor(() => expect(calls.some((c) => c.method === 'PUT')).toBe(true), { timeout: 2000 });
    const put = calls.find((c) => c.method === 'PUT')!;
    expect(put.url).toMatch(/\/api\/board\/love\/v3\/layout$/);
    expect(put.body).toMatchObject({ version: '3', patch: { cards: ['dating_pulse', 'dating_meeting_timing', 'marriage_pulse'], boardOptions: { lens: 'marriage' } } });
    expect(put.body).not.toHaveProperty('template');
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false);
  });

  it('switching to an empty lens opens the picker with its starters ticked; Done saves deck and lens in one PUT', async () => {
    render(<BoardV3 board="love" />);
    await screen.findByTestId('self-v3-chips');
    fireEvent.click(screen.getByTestId('lens-friends'));
    const picker = await screen.findByTestId('self-v3-picker');
    expect(picker).toHaveTextContent('Your Love cards');
    expect(screen.getByTestId('picker-tile-friends_social_energy')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('picker-tile-friends_core_allies')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('picker-tile-dating_pulse')).toHaveAttribute('aria-checked', 'true');
    await act(async () => {
      fireEvent.click(screen.getByTestId('picker-done'));
    });
    await waitFor(() => expect(screen.queryByTestId('self-v3-picker')).toBeNull());
    const puts = calls.filter((c) => c.method === 'PUT');
    expect(puts).toHaveLength(1);
    expect(puts[0]!.body).toMatchObject({
      patch: { cards: ['dating_pulse', 'dating_meeting_timing', 'marriage_pulse', 'friends_social_energy', 'friends_core_allies'], boardOptions: { lens: 'friends' } },
    });
    expect(chipIds()).toEqual(['friends_social_energy', 'friends_core_allies']);
  });

  it('the picker groups Work cards by lens and shows Coming soon cards greyed', async () => {
    srv.body = () => boardV3Fixture('work');
    render(<BoardV3 board="work" />);
    await screen.findByTestId('self-v3-chips');
    fireEvent.click(screen.getByTestId('self-v3-chip-add'));
    await screen.findByTestId('self-v3-picker');
    for (const g of ['career_start', 'primary_job', 'hobby', 'business']) expect(screen.getByTestId(`picker-group-${g}`)).toBeInTheDocument();
    expect(screen.getByTestId('picker-tile-start_degree_to_career')).toBeDisabled();
    expect(screen.getByTestId('picker-card-start_degree_to_career')).toHaveTextContent('Coming soon');
  });

  it('a queued card that already has its text keeps it on screen', async () => {
    srv.body = () => {
      const b = boardV3Fixture('love');
      b.reading = { enabled: true, stage: 'cards', clocks: [], done: 0, total: 2, capReached: false, preparing: false };
      b.cards = b.cards.map((c) => (c.id === 'dating_pulse' ? { ...c, state: 'queued' } : c));
      return b;
    };
    render(<BoardV3 board="love" />);
    await screen.findByTestId('self-v3-chips');
    expect(screen.getByTestId('self-v3-carousel')).toHaveTextContent('Where Dating Stands: a steadier stretch from 5 Dec 2026.');
  });

  it('a Coming soon card on the deck says so', async () => {
    srv.body = () => boardV3Fixture('love', { lens: 'marriage', deck: ['marriage_children_family'] });
    render(<BoardV3 board="love" />);
    expect(await screen.findByTestId('card-coming-soon')).toHaveTextContent('Coming soon');
  });

  it('a phone puts "Love · Dating" in the header and switches lenses from its sheet', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 390, configurable: true, writable: true });
    render(<BoardV3 board="love" />);
    const title = await screen.findByTestId('self-phone-title');
    expect(title).toHaveTextContent('Love · Dating');
    expect(screen.queryByTestId('lens-tabs')).toBeNull();
    fireEvent.click(title);
    fireEvent.click(await screen.findByTestId('lens-option-marriage'));
    expect(chipIds()).toEqual(['marriage_pulse']);
    expect(screen.getByTestId('self-phone-title')).toHaveTextContent('Love · Marriage');
  });

  it('"Is this right?" goes to the board\'s own route', async () => {
    render(<BoardV3 board="love" />);
    await screen.findByTestId('self-v3-chips');
    const yes = (await screen.findAllByTestId('confirm-yes'))[0]!;
    await act(async () => {
      fireEvent.click(yes);
    });
    await waitFor(() => expect(calls.some((c) => c.url.endsWith('/api/board/love/v3/confirm'))).toBe(true));
    expect(calls.some((c) => c.url.endsWith('/api/self/v3/confirm'))).toBe(false);
  });
});

describe('fallback to the legacy board', () => {
  it.each<[string, number, unknown]>([
    ['404 board_v3_off', 404, { error: 'board_v3_off' }],
    ['a bare 404 (older server)', 404, null],
    ['503 off', 503, { error: 'off' }],
    ['400 unknown_board', 400, { error: 'unknown_board' }],
  ])('%s shows the legacy board', async (_n, status, body) => {
    srv.status = status;
    srv.body = () => body;
    render(<BoardV3 board="work" legacy={<div data-testid="legacy">legacy</div>} />);
    expect(await screen.findByTestId('legacy')).toBeInTheDocument();
    expect(screen.queryByTestId('self-v3-page')).toBeNull();
  });

  it('a 404 no_kundli is not a fallback', async () => {
    srv.status = 404;
    srv.body = () => ({ status: 'no_kundli' });
    render(<BoardV3 board="love" legacy={<div data-testid="legacy">legacy</div>} />);
    expect(await screen.findByTestId('board-no-kundli')).toBeInTheDocument();
    expect(screen.queryByTestId('legacy')).toBeNull();
  });
});

describe('the Love/Work layout body', () => {
  it('is the versioned patch shape; cleared keys go as null for the server to delete', async () => {
    const { boardLayoutBody } = await import('../../../lib/selfV3Api');
    const prev = { template: 'seasons' as const, cards: ['a_x'], sections: {}, options: { a_x: { length: 'glance' as const, view: 'now' as const } }, boardOptions: { lens: 'dating', motion: false } };
    const body = boardLayoutBody(
      'love',
      { template: 'seasons', cards: ['a_x', 'b_y'], sections: {}, options: { a_x: { view: 'now' } }, boardOptions: { lens: 'marriage' }, version: 7 },
      prev,
    );
    expect(body).toEqual({ version: '7', patch: { cards: ['a_x', 'b_y'], options: { a_x: { view: 'now', length: null } }, boardOptions: { lens: 'marriage', motion: null } } });
    const self = { template: 'seasons' as const, cards: ['body'], sections: {} };
    expect(boardLayoutBody('self', self)).toBe(self);
  });
});
