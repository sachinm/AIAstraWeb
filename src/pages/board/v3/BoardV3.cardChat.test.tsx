/**
 * Card chat on the v3 board (server docs/reading-engine/85): a bubble on each card only when the server grants
 * `feature.card_chat`; its tap turns that card, in place, into its Chat face (other cards unchanged, the carousel held
 * still); Read goes back with the conversation kept; Esc closes and returns focus; the same on Love and Work.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import BoardV3 from './BoardV3';
import { boardV3Fixture } from './boardV3.fixture';
import { selfV3Fixture } from '../../you/v3/selfV3.fixture';
import { clearSelfV3Cached } from '../../../lib/selfV3Cache';
import type { BoardId } from '../../../lib/selfV3Api';

/** an internal technique or fact id shown as text (as in BoardV3.test.tsx) */
const INTERNAL_ID = /\b(work|love|self)\.[a-z_]+\b/;

const plan = vi.hoisted(() => ({ setPlan: vi.fn(), refreshPlan: vi.fn(async () => {}) }));
vi.mock('../../../Auth/ProfileGate', () => ({ usePlan: () => ({ plan: null, setPlan: plan.setPlan, refreshPlan: plan.refreshPlan }) }));

const FOUNDATION = ['feature.face.short', 'feature.periods', 'feature.key_dates', 'feature.why_panel', 'feature.confirm'];

type Call = { method: string; url: string; body?: Record<string, unknown> };
let calls: Call[];
let granted: boolean;
/** the grants as the server f09ad68 sends them (a map) or the older list */
let shape: 'map' | 'list';
/** card ids whose own grant locks card chat */
let cardLocked: string[];

const json = (b: unknown) => JSON.stringify(b);
const sse = (events: unknown[]) => new Response(events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join(''), { status: 200 });

function boardBody(board: BoardId) {
  const b = board === 'self' ? selfV3Fixture() : boardV3Fixture(board);
  const keys = [...FOUNDATION, ...(granted ? ['feature.card_chat'] : [])];
  const features =
    shape === 'map'
      ? { ...Object.fromEntries(keys.map((k) => [k, { locked: false }])), 'feature.compact': { locked: true, minPlan: 'plus' } }
      : { allowed: keys, locked: [] };
  const cards = b.cards.map((c) => (cardLocked.includes(c.id) ? { ...c, features: { 'feature.card_chat': { locked: true, minPlan: 'plus' } } } : c));
  return { ...b, cards, features } as unknown as typeof b;
}

let board: BoardId;

beforeEach(() => {
  clearSelfV3Cached();
  sessionStorage.clear();
  localStorage.setItem('token', 't');
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-18T12:00:00'));
  Object.defineProperty(window, 'innerWidth', { value: 1180, configurable: true, writable: true });
  Object.defineProperty(window, 'innerHeight', { value: 820, configurable: true, writable: true });
  calls = [];
  granted = true;
  shape = 'map';
  cardLocked = [];
  board = 'self';
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const method = (init.method ?? 'GET').toUpperCase();
      const body = init.body && typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
      const u = String(url);
      calls.push({ method, url: u, body });
      if (/\/api\/(self\/v3|board\/(love|work)\/v3)$/.test(u) && method === 'GET') return new Response(json(boardBody(board)), { status: 200 });
      if (u.includes('/api/cards/') && method === 'GET')
        return new Response(json({ preamble: { headline: 'What the card says now.', lines: ['One more line.'] }, period: null, cost: { uses: 1, remaining: 5 }, thread: { chatId: 'thread-1', messages: [] } }), { status: 200 });
      if (u.endsWith('/api/chat/ask-stream')) return sse([{ type: 'card' }, { type: 'token', delta: 'A card answer.' }, { type: 'done', answer: 'A card answer.', chatId: 'thread-1' }]);
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

const cardEl = (id: string) => screen.getByTestId(`v3-card-${id}`);

async function mount(b: BoardId) {
  board = b;
  render(<BoardV3 board={b} legacy={<div data-testid="legacy">legacy</div>} />);
  await screen.findByTestId('self-v3-carousel');
}

describe('the bubble', () => {
  it('shows on every card only when the server grants card chat', async () => {
    granted = false;
    await mount('self');
    expect(screen.queryAllByTestId('card-chat-bubble')).toHaveLength(0);
    expect(within(cardEl('body')).queryByTestId('card-chat')).toBeNull();
    cleanup();
    clearSelfV3Cached();
    granted = true;
    await mount('self');
    const bubble = within(cardEl('body')).getByTestId('card-chat-bubble');
    expect(bubble).toHaveAttribute('aria-label', 'Ask about Body & energy');
    expect(within(cardEl('mind')).getByTestId('card-chat-bubble')).toBeInTheDocument();
    // docs/dashboards/12: every granted card carries the thin input at its foot, idle until the person starts
    expect(within(cardEl('body')).getByTestId('card-chat')).toHaveAttribute('data-conversation', 'false');
  });

  it('reads the older list shape of grants too', async () => {
    shape = 'list';
    await mount('self');
    expect(within(cardEl('body')).getByTestId('card-chat-bubble')).toBeInTheDocument();
  });

  it('a card whose own grant locks card chat shows no bubble', async () => {
    cardLocked = ['mind'];
    await mount('self');
    expect(within(cardEl('body')).getByTestId('card-chat-bubble')).toBeInTheDocument();
    expect(within(cardEl('mind')).queryByTestId('card-chat-bubble')).toBeNull();
    expect(within(cardEl('mind')).queryByTestId('card-chat')).toBeNull();
  });
});

describe('the Chat face', () => {
  it('a tap turns that card into its Chat face in place; the others stay; the carousel is held still', async () => {
    await mount('self');
    fireEvent.click(within(cardEl('body')).getByTestId('card-chat-bubble'));
    expect(cardEl('body')).toHaveAttribute('data-face', 'chat');
    expect(within(cardEl('body')).getByTestId('card-chat-back')).toHaveTextContent('Back to card');
    expect(within(cardEl('body')).queryByTestId('card-body')).toBeNull();
    expect(within(cardEl('body')).queryByTestId('confirm-yes')).toBeNull();
    expect(within(cardEl('mind')).queryByTestId('card-chat-thread')).toBeNull();
    expect(cardEl('mind')).not.toHaveAttribute('data-face', 'chat');
    expect(screen.getByTestId('self-v3-carousel')).toHaveAttribute('data-locked', 'true');
    expect(screen.getByTestId('self-v3-carousel-track').style.overflowX).toBe('hidden');
    // the preamble comes from the server, for the card and the period on screen
    expect(await within(cardEl('body')).findByTestId('card-chat-headline')).toHaveTextContent('What the card says now.');
    const open = calls.find((c) => c.url.includes('/api/cards/'))!;
    expect(open.url).toMatch(/^\/api\/cards\/self\/body\/chat\?from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}$/);
    // the input is the card's foot
    const chat = within(cardEl('body')).getByTestId('card-chat');
    expect(chat.lastElementChild).toBe(within(cardEl('body')).getByTestId('card-chat-input-bar'));
    expect(screen.getByTestId('self-v3-page').textContent).not.toMatch(INTERNAL_ID);
  });

  it('a send carries the card, a turnId and the thread; Read goes back and the conversation is kept', async () => {
    await mount('self');
    fireEvent.click(within(cardEl('body')).getByTestId('card-chat-bubble'));
    await within(cardEl('body')).findByTestId('card-chat-headline');
    fireEvent.change(within(cardEl('body')).getByTestId('card-chat-textarea'), { target: { value: 'Is this my low month?' } });
    await act(async () => {
      fireEvent.click(within(cardEl('body')).getByTestId('card-chat-send'));
    });
    await waitFor(() => expect(within(cardEl('body')).getByTestId('card-chat-thread')).toHaveTextContent('A card answer.'));
    const ask = calls.find((c) => c.url.endsWith('/api/chat/ask-stream'))!;
    expect(ask.body).toMatchObject({ question: 'Is this my low month?', chatId: 'thread-1', card: { board: 'self', cardId: 'body' } });
    expect(typeof ask.body!.turnId).toBe('string');

    const patches = calls.filter((c) => c.method === 'PATCH' || c.method === 'PUT').length;
    fireEvent.click(within(cardEl('body')).getByTestId('card-chat-back'));
    expect(cardEl('body')).toHaveAttribute('data-face', 'outlook');
    expect(within(cardEl('body')).queryByTestId('card-chat-thread')).toBeNull();
    expect(within(cardEl('body')).getByTestId('card-chat')).toHaveAttribute('data-conversation', 'false');
    expect(within(cardEl('body')).getByTestId('card-body')).toBeInTheDocument();
    expect(screen.getByTestId('self-v3-carousel')).toHaveAttribute('data-locked', 'false');
    // Chat is not a stored face: going back to the face already stored saves nothing
    expect(calls.filter((c) => c.method === 'PATCH' || c.method === 'PUT')).toHaveLength(patches);

    fireEvent.click(within(cardEl('body')).getByTestId('card-chat-bubble'));
    expect(within(cardEl('body')).getByTestId('card-chat-thread')).toHaveTextContent('Is this my low month?');
    expect(within(cardEl('body')).getByTestId('card-chat-thread')).toHaveTextContent('A card answer.');
  });

  it('Esc closes it and focus returns to the bubble', async () => {
    await mount('self');
    const bubble = within(cardEl('body')).getByTestId('card-chat-bubble');
    fireEvent.click(bubble);
    await within(cardEl('body')).findByTestId('card-chat-headline');
    fireEvent.keyDown(within(cardEl('body')).getByTestId('card-chat-textarea'), { key: 'Escape' });
    await waitFor(() => expect(cardEl('body')).not.toHaveAttribute('data-face', 'chat'));
    await waitFor(() => expect(document.activeElement).toBe(within(cardEl('body')).getByTestId('card-chat-bubble')));
  });

  it('opening a second card closes the first; a chip tap closes it too', async () => {
    await mount('self');
    fireEvent.click(within(cardEl('body')).getByTestId('card-chat-bubble'));
    fireEvent.click(within(cardEl('mind')).getByTestId('card-chat-bubble'));
    expect(cardEl('mind')).toHaveAttribute('data-face', 'chat');
    expect(cardEl('body')).not.toHaveAttribute('data-face', 'chat');
    fireEvent.click(screen.getByTestId('self-v3-chip-body'));
    expect(cardEl('mind')).not.toHaveAttribute('data-face', 'chat');
    expect(screen.getByTestId('self-v3-carousel')).toHaveAttribute('data-locked', 'false');
  });

  it('on a phone the one card on screen keeps its slot in Chat', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 390, configurable: true, writable: true });
    await mount('self');
    fireEvent.click(within(cardEl('body')).getByTestId('card-chat-bubble'));
    expect(screen.getByTestId('self-v3-carousel')).toHaveAttribute('data-per-view', '1');
    expect(screen.getByTestId('self-v3-carousel')).toHaveAttribute('data-locked', 'true');
    expect(cardEl('body').className).toMatch(/\bh-full\b/);
    expect(within(cardEl('body')).getByTestId('card-chat').className).toMatch(/min-h-0/);
  });
});

describe('the input anchored on the card (docs/dashboards/12)', () => {
  it('every card carries the thin input at its foot, and drawing the board opens no card chat', async () => {
    await mount('self');
    for (const id of ['body', 'mind']) {
      const chat = within(cardEl(id)).getByTestId('card-chat');
      expect(chat).toHaveAttribute('data-conversation', 'false');
      // the input is the last thing on the card, under the body and "Is this right?"
      const stage = within(cardEl(id)).getByTestId('card-stage');
      expect(stage.lastElementChild).toBe(chat);
      expect(within(chat).getByTestId('card-chat-mic')).toBeInTheDocument();
      expect(within(chat).getByTestId('card-chat-send')).toBeInTheDocument();
      expect(within(chat).queryByTestId('card-chat-cost')).toBeNull();
    }
    expect(calls.filter((c) => c.url.includes('/api/cards/'))).toHaveLength(0);
  });

  it('typing starts the conversation over the card, in the same box, with Back to card; Send waits for the cost line', async () => {
    await mount('self');
    const box = within(cardEl('body')).getByTestId('card-chat-textarea');
    box.focus();
    fireEvent.change(box, { target: { value: 'Why so tired?' } });
    expect(cardEl('body')).toHaveAttribute('data-face', 'chat');
    // the same textarea node: focus (and a phone's keyboard) stays
    expect(within(cardEl('body')).getByTestId('card-chat-textarea')).toBe(box);
    expect(document.activeElement).toBe(box);
    expect(box).toHaveValue('Why so tired?');
    expect(within(cardEl('body')).queryByTestId('card-body')).toBeNull();
    expect(within(cardEl('body')).getByTestId('card-chat-back')).toBeInTheDocument();
    expect(await within(cardEl('body')).findByTestId('card-chat-headline')).toHaveTextContent('What the card says now.');
    expect(calls.filter((c) => c.url.includes('/api/cards/'))).toHaveLength(1);
    // nothing was sent on its own while the card opened
    expect(calls.some((c) => c.url.endsWith('/api/chat/ask-stream'))).toBe(false);
    expect(within(cardEl('body')).getByTestId('card-chat-cost')).toHaveTextContent('Uses 1 of your 5 questions');
    await act(async () => {
      fireEvent.click(within(cardEl('body')).getByTestId('card-chat-send'));
    });
    await waitFor(() => expect(within(cardEl('body')).getByTestId('card-chat-thread')).toHaveTextContent('A card answer.'));
    fireEvent.click(within(cardEl('body')).getByTestId('card-chat-back'));
    expect(cardEl('body')).toHaveAttribute('data-face', 'outlook');
    // starting again shows the kept thread; a bar goes back to the card on that view
    fireEvent.change(box, { target: { value: 'x' } });
    expect(await within(cardEl('body')).findByTestId('card-chat-thread')).toHaveTextContent('A card answer.');
    fireEvent.click(within(cardEl('body')).getByTestId('card-view-calendar'));
    expect(cardEl('body')).toHaveAttribute('data-face', 'calendar');
  });
});

describe.each<[BoardId, string]>([
  ['love', 'dating_pulse'],
  ['work', 'job_pulse'],
])('the %s board', (b, first) => {
  it('chats on its own cards and sends its own board', async () => {
    await mount(b);
    fireEvent.click(within(cardEl(first)).getByTestId('card-chat-bubble'));
    expect(cardEl(first)).toHaveAttribute('data-face', 'chat');
    await within(cardEl(first)).findByTestId('card-chat-headline');
    expect(calls.find((c) => c.url.includes('/api/cards/'))!.url).toMatch(new RegExp(`^/api/cards/${b}/${first}/chat`));
    fireEvent.change(within(cardEl(first)).getByTestId('card-chat-textarea'), { target: { value: 'What now?' } });
    await act(async () => {
      fireEvent.click(within(cardEl(first)).getByTestId('card-chat-send'));
    });
    await waitFor(() => expect(within(cardEl(first)).getByTestId('card-chat-thread')).toHaveTextContent('A card answer.'));
    const ask = calls.find((c) => c.url.endsWith('/api/chat/ask-stream'))!;
    expect(ask.body).toMatchObject({ card: { board: b, cardId: first }, chatId: 'thread-1' });
    expect(screen.getByTestId('self-v3-page').textContent).not.toMatch(INTERNAL_ID);
  });
});
