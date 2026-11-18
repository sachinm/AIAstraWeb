/**
 * The card's Chat view (server docs/reading-engine/85): the preamble comes from the open response, the input sits at the
 * card's foot, a send carries the card, a turnId and the thread's chatId, Try again reuses the turnId, the mic dictates
 * into the box (and is disabled where the browser has no speech recognition), the clarifier's chips show inside the card,
 * and a 402 keeps the question in the box.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import CardChat from './CardChat';
import { createCardChatStore, type CardChatStore } from './cardChatStore';
import type { CardChatRef } from '../../lib/cardChatApi';

type Call = { method: string; url: string; body?: Record<string, unknown> };
let calls: Call[];
let askReplies: Array<() => Response>;
let openBody: unknown;

const sse = (events: unknown[]) => new Response(events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join(''), { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
const answered = (text: string, chatId = 'c-1') => () =>
  sse([
    { type: 'turn_init', turnId: 'resume-1' },
    { type: 'card', board: 'self', id: 'body', title: 'Body & energy', periodLabel: 'Heavy stretch', turnId: 'x' },
    { type: 'start' },
    { type: 'usage', usage: { remaining: 6, exempt: false } },
    { type: 'token', delta: text },
    { type: 'done', answer: text, chatId, card: { board: 'self', id: 'body' } },
  ]);
const refused = (status: number, error: string) => () => new Response(JSON.stringify({ error }), { status });

const REF: CardChatRef = { board: 'self', cardId: 'body', from: '2026-11-01', to: '2027-06-03' };

beforeEach(() => {
  localStorage.setItem('token', 't');
  calls = [];
  askReplies = [];
  openBody = {
    card: { board: 'self', id: 'body', title: 'Body & energy' },
    period: { from: '2026-11-01', to: '2027-06-03', label: 'Heavy stretch · to 3 Jun 2027' },
    preamble: { headline: 'Pace yourself this winter.', lines: ['Rest comes first until March.', 'Short walks help most.'], keyDates: [{ date: '2027-03-01', label: 'Energy starts to return' }], confirm: null },
    cost: { uses: 1, remaining: 7, limit: 10, line: 'Uses 1 of your 7 questions this month' },
    thread: { chatId: 'c-1', messages: [{ question: 'Will my energy come back?', answer: 'Slowly, from March.', at: '2026-11-17T10:00:00Z', periodLabel: 'Heavy stretch' }] },
  };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const method = (init.method ?? 'GET').toUpperCase();
      const body = typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
      const u = String(url);
      calls.push({ method, url: u, body });
      if (u.includes('/api/cards/') && method === 'GET') return new Response(JSON.stringify(openBody), { status: 200 });
      if (u.endsWith('/api/chat/ask-stream')) return (askReplies.shift() ?? answered('An answer.'))();
      if (u.endsWith('/api/chat/answer')) return new Response(JSON.stringify({ type: 'ready', runId: 'run-1' }), { status: 200 });
      if (u.endsWith('/api/chat/confirm-stream')) return answered('After the question, the reading.')();
      return new Response(null, { status: 404 });
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
  delete (window as unknown as Record<string, unknown>).SpeechRecognition;
  delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
});

function mount(store: CardChatStore = createCardChatStore(), onBack = vi.fn()) {
  const r = render(<CardChat store={store} chatRef={REF} periodLabel="Heavy stretch · to 3 Jun 2027" onBack={onBack} />);
  return { store, onBack, ...r };
}

const asks = () => calls.filter((c) => c.url.endsWith('/api/chat/ask-stream'));
const type = (text: string) => fireEvent.change(screen.getByTestId('card-chat-textarea'), { target: { value: text } });

describe('opening', () => {
  it('asks the server for the card and its period, and draws the preamble from the response', async () => {
    mount();
    expect(await screen.findByTestId('card-chat-headline')).toHaveTextContent('Pace yourself this winter.');
    const open = calls.find((c) => c.url.includes('/api/cards/'))!;
    expect(open.url).toBe('/api/cards/self/body/chat?from=2026-11-01&to=2027-06-03');
    expect(screen.getByTestId('card-chat-preamble')).toHaveTextContent('Rest comes first until March.');
    // collapsed to the first line; More shows the rest
    expect(screen.getByTestId('card-chat-preamble')).not.toHaveTextContent('Short walks help most.');
    expect(screen.queryByTestId('card-chat-key-dates')).toBeNull();
    fireEvent.click(screen.getByTestId('card-chat-more'));
    expect(screen.getByTestId('card-chat-preamble')).toHaveTextContent('Short walks help most.');
    expect(screen.getByTestId('card-chat-key-dates')).toHaveTextContent('1 Mar 2027: Energy starts to return');
    // the stored thread
    expect(screen.getByTestId('card-chat-thread')).toHaveTextContent('Will my energy come back?');
    expect(screen.getByTestId('card-chat-thread')).toHaveTextContent('Slowly, from March.');
  });

  it('accepts a plain-string preamble and a cost line the server writes', async () => {
    openBody = { preamble: 'One line.\nAnother line.', period: null, costLine: 'Uses 1 of your 3 questions', thread: { chatId: null, messages: [] } };
    mount();
    expect(await screen.findByTestId('card-chat-headline')).toHaveTextContent('One line.');
    expect(screen.getByTestId('card-chat-cost')).toHaveTextContent('Uses 1 of your 3 questions');
  });

  it('a card the server will not chat about says so in plain words', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(async () => new Response(JSON.stringify({ error: 'card_not_on_board' }), { status: 404 }));
    mount();
    const failed = await screen.findByTestId('card-chat-open-failed');
    expect(failed).toHaveTextContent('Chat is not available for this card.');
    expect(failed.textContent).not.toMatch(/card_not_on_board/);
    expect(screen.getByTestId('card-chat-textarea')).toBeDisabled();
  });

  it('shows the cost line before sending', async () => {
    mount();
    expect(await screen.findByTestId('card-chat-cost')).toHaveTextContent('Uses 1 of your 7 questions this month');
  });

  it('a failed open says so in the card, never the server code, and Retry opens again', async () => {
    let n = 0;
    (fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(async (url: string, init: RequestInit = {}) => {
      calls.push({ method: (init.method ?? 'GET').toUpperCase(), url: String(url) });
      n += 1;
      return n === 1 ? new Response(JSON.stringify({ error: 'resolver_exploded' }), { status: 500 }) : new Response(JSON.stringify(openBody), { status: 200 });
    });
    mount();
    const failed = await screen.findByTestId('card-chat-open-failed');
    expect(failed).toHaveTextContent('This chat did not open.');
    expect(failed.textContent).not.toMatch(/resolver_exploded|500|body/);
    fireEvent.click(screen.getByTestId('card-chat-reopen'));
    expect(await screen.findByTestId('card-chat-headline')).toBeInTheDocument();
  });
});

describe('the input', () => {
  it('is anchored at the card bottom: the thread scrolls above it and the bar is the last part of the chat', async () => {
    mount();
    await screen.findByTestId('card-chat-headline');
    const chat = screen.getByTestId('card-chat');
    const bar = screen.getByTestId('card-chat-input-bar');
    expect(chat.lastElementChild).toBe(bar);
    expect(bar).toHaveAttribute('data-anchor', 'card-bottom');
    expect(bar.className).toMatch(/shrink-0/);
    const thread = screen.getByTestId('card-chat-thread');
    expect(thread.className).toMatch(/overflow-y-auto/);
    expect(thread.className).toMatch(/flex-1/);
    expect(within(bar).getByTestId('card-chat-textarea')).toBeInTheDocument();
    expect(within(bar).getByTestId('card-chat-mic')).toBeInTheDocument();
    expect(within(bar).getByTestId('card-chat-send')).toBeInTheDocument();
  });

  it('a send posts the card, a turnId and the thread chatId, and the answer streams into the card', async () => {
    mount();
    await screen.findByTestId('card-chat-headline');
    type('When does it lift?');
    await act(async () => {
      fireEvent.click(screen.getByTestId('card-chat-send'));
    });
    await waitFor(() => expect(screen.getByTestId('card-chat-thread')).toHaveTextContent('An answer.'));
    expect(asks()).toHaveLength(1);
    const body = asks()[0]!.body!;
    expect(body).toMatchObject({ question: 'When does it lift?', chatId: 'c-1', card: { board: 'self', cardId: 'body', from: '2026-11-01', to: '2027-06-03' } });
    expect(body.turnId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(body).not.toHaveProperty('focus');
    // a follow-up (the thread already has an answered turn) skips the clarifier
    expect(body).not.toHaveProperty('clarify');
    // the usage after the answer updates the cost line
    expect(screen.getByTestId('card-chat-cost')).toHaveTextContent('Uses 1 of your 6 questions');
    expect(screen.getByTestId('card-chat-textarea')).toHaveValue('');
  });

  it('Enter sends, Shift+Enter does not', async () => {
    mount();
    await screen.findByTestId('card-chat-headline');
    type('One?');
    fireEvent.keyDown(screen.getByTestId('card-chat-textarea'), { key: 'Enter', shiftKey: true });
    expect(asks()).toHaveLength(0);
    await act(async () => {
      fireEvent.keyDown(screen.getByTestId('card-chat-textarea'), { key: 'Enter' });
    });
    await waitFor(() => expect(asks()).toHaveLength(1));
  });

  it('Try again reuses the turnId; a new question gets a new one', async () => {
    askReplies = [() => new Response(null, { status: 500 }), answered('Now it went.'), answered('Second answer.')];
    mount();
    await screen.findByTestId('card-chat-headline');
    type('When does it lift?');
    await act(async () => {
      fireEvent.click(screen.getByTestId('card-chat-send'));
    });
    const failed = await screen.findByTestId('card-chat-turn-failed');
    expect(failed).toHaveTextContent('That did not go through.');
    expect(failed.textContent).not.toMatch(/500|failed \(/);
    await act(async () => {
      fireEvent.click(screen.getByTestId('card-chat-try-again'));
    });
    await waitFor(() => expect(screen.getByTestId('card-chat-thread')).toHaveTextContent('Now it went.'));
    expect(asks()).toHaveLength(2);
    expect(asks()[1]!.body!.turnId).toBe(asks()[0]!.body!.turnId);
    expect(asks()[1]!.body!.question).toBe('When does it lift?');
    type('And after that?');
    await act(async () => {
      fireEvent.click(screen.getByTestId('card-chat-send'));
    });
    await waitFor(() => expect(asks()).toHaveLength(3));
    expect(asks()[2]!.body!.turnId).not.toBe(asks()[0]!.body!.turnId);
  });

  it('a card with no thread yet sends no chatId', async () => {
    openBody = { ...(openBody as object), thread: { chatId: null, messages: [] } };
    mount();
    await screen.findByTestId('card-chat-headline');
    type('First question?');
    await act(async () => {
      fireEvent.click(screen.getByTestId('card-chat-send'));
    });
    await waitFor(() => expect(asks()).toHaveLength(1));
    expect(asks()[0]!.body).not.toHaveProperty('chatId');
  });

  it.each<[string, () => Response, string]>([
    ['turn_in_flight (409)', refused(409, 'turn_in_flight'), 'Your last question is still being answered.'],
    ['rate_limited (429)', refused(429, 'rate_limited'), 'Too many questions at once.'],
    ['card_not_on_board (404)', refused(404, 'card_not_on_board'), 'Chat is not available for this card.'],
    ['bad_period (400)', refused(400, 'bad_period'), 'This period is no longer on your card.'],
    ['timeout (503)', refused(503, 'timeout'), 'That took too long.'],
    ['an SSE spend_cap error', () => sse([{ type: 'card' }, { type: 'error', code: 'spend_cap', message: 'operation spend cap reached' }]), 'too large to answer in one go'],
  ])('a send refused with %s says so in plain words, never the code', async (_n, reply, words) => {
    askReplies = [reply];
    mount();
    await screen.findByTestId('card-chat-headline');
    type('Will it lift?');
    await act(async () => {
      fireEvent.click(screen.getByTestId('card-chat-send'));
    });
    const failed = await screen.findByTestId('card-chat-turn-failed');
    expect(failed).toHaveTextContent(words);
    expect(failed.textContent).not.toMatch(/turn_in_flight|rate_limited|card_not_on_board|bad_period|timeout|spend_cap|\(\d{3}\)/);
    expect(screen.getByTestId('card-chat-try-again')).toBeInTheDocument();
  });

  it('a declined topic arrives as words in the card', async () => {
    askReplies = [() => sse([{ type: 'card' }, { type: 'info', reason: 'declined' }, { type: 'token', delta: 'That is outside this card.' }, { type: 'done', answer: 'That is outside this card.', chatId: 'c-1' }])];
    mount();
    await screen.findByTestId('card-chat-headline');
    type('Lottery numbers?');
    await act(async () => {
      fireEvent.click(screen.getByTestId('card-chat-send'));
    });
    await waitFor(() => expect(screen.getByTestId('card-chat-thread')).toHaveTextContent('That is outside this card.'));
  });

  it('a 402 keeps the question in the box and shows the plan line', async () => {
    askReplies = [() => new Response(JSON.stringify({ error: 'quota_exhausted', usage: { remaining: 0, exempt: false } }), { status: 402 })];
    mount();
    await screen.findByTestId('card-chat-headline');
    type('Will it lift?');
    await act(async () => {
      fireEvent.click(screen.getByTestId('card-chat-send'));
    });
    expect(await screen.findByTestId('card-chat-quota')).toBeInTheDocument();
    expect(screen.getByTestId('card-chat-textarea')).toHaveValue('Will it lift?');
    expect(screen.queryAllByTestId('card-chat-question').map((q) => q.textContent)).not.toContain('You: Will it lift?');
  });

  it("the thread's first question sends clarify; the follow-up does not", async () => {
    openBody = { ...(openBody as object), thread: { chatId: null, messages: [] } };
    mount();
    await screen.findByTestId('card-chat-headline');
    type('First question?');
    await act(async () => {
      fireEvent.click(screen.getByTestId('card-chat-send'));
    });
    await waitFor(() => expect(screen.getByTestId('card-chat-thread')).toHaveTextContent('An answer.'));
    expect(asks()[0]!.body).toMatchObject({ question: 'First question?', clarify: true, card: { board: 'self', cardId: 'body' } });
    type('And then?');
    await act(async () => {
      fireEvent.click(screen.getByTestId('card-chat-send'));
    });
    await waitFor(() => expect(asks()).toHaveLength(2));
    expect(asks()[1]!.body).not.toHaveProperty('clarify');
    expect(asks()[1]!.body).toMatchObject({ chatId: 'c-1' });
  });

  it("the clarifier's question on a first question shows inside the card, then the answer streams into the same turn", async () => {
    openBody = { ...(openBody as object), thread: { chatId: null, messages: [] } };
    // the server's shape (cardChatRoutes.ts): card, clarify start, the clarify question, done "clarifying"; nothing charged
    askReplies = [
      () =>
        new Response(
          [
            `id: 0
event: turn_init
data: ${JSON.stringify({ type: 'turn_init', turnId: 'tt', seq: 0 })}

`,
            `id: 1
event: card
data: ${JSON.stringify({ type: 'card', board: 'self', id: 'body', title: 'Body & energy', periodLabel: 'Heavy stretch', turnId: 'x', seq: 1 })}

`,
            `id: 2
event: clarify
data: ${JSON.stringify({ type: 'start', seq: 2 })}

`,
            `id: 3
event: clarify
data: ${JSON.stringify({ type: 'clarify', runId: 'run-1', criterion: 'sibling', question: 'Which brother do you mean?', chips: [{ label: 'Elder brother', value: 'elder_brother' }, { label: 'Younger brother', value: 'younger_brother' }], allowFreeText: true, turn: 1, understanding: 'You are asking about the year ahead.', seq: 3 })}

`,
            `id: 4
event: turn_done
data: ${JSON.stringify({ turnId: 'tt', seq: 4, type: 'done', status: 'clarifying', runId: 'run-1', ms: 12, card: { board: 'self', id: 'body' } })}

`,
          ].join(''),
          { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
        ),
    ];
    mount();
    await screen.findByTestId('card-chat-headline');
    type('Will my brother stand by me?');
    await act(async () => {
      fireEvent.click(screen.getByTestId('card-chat-send'));
    });
    expect(asks()[0]!.body).toMatchObject({ clarify: true });
    const clarify = await screen.findByTestId('card-chat-clarify');
    expect(clarify).toHaveTextContent('Which brother do you mean?');
    // inside the card's own thread, with the input still anchored at the card's foot
    expect(screen.getByTestId('card-chat-thread')).toContainElement(clarify);
    expect(screen.getByTestId('card-chat').lastElementChild).toBe(screen.getByTestId('card-chat-input-bar'));
    const chips = clarify.querySelectorAll('[data-test-id="clarify-chip"]');
    expect(Array.from(chips).map((c) => c.textContent)).toEqual(['Elder brother', 'Younger brother']);
    await act(async () => {
      fireEvent.click(chips[0]!);
    });
    await waitFor(() => expect(screen.getByTestId('card-chat-thread')).toHaveTextContent('After the question, the reading.'));
    expect(screen.queryByTestId('card-chat-clarify')).toBeNull();
    const answer = calls.find((c) => c.url.endsWith('/api/chat/answer'))!;
    expect(answer.body).toMatchObject({ runId: 'run-1', value: 'elder_brother', viaChip: true });
    // the server keeps the card (and the first send's turnId) on the clarify run: confirm carries the run only
    const confirm = calls.find((c) => c.url.endsWith('/api/chat/confirm-stream'))!;
    expect(confirm.body).toMatchObject({ runId: 'run-1' });
    expect(confirm.body).not.toHaveProperty('card');
    // one question in the thread, answered; the next one is a follow-up
    expect(screen.queryAllByTestId('card-chat-question')).toHaveLength(1);
    type('And my sister?');
    await act(async () => {
      fireEvent.click(screen.getByTestId('card-chat-send'));
    });
    await waitFor(() => expect(asks()).toHaveLength(2));
    expect(asks()[1]!.body).not.toHaveProperty('clarify');
    expect(asks()[1]!.body).toMatchObject({ chatId: 'c-1' });
  });

  it('Esc goes back to the card', async () => {
    const { onBack } = mount();
    await screen.findByTestId('card-chat-headline');
    fireEvent.keyDown(screen.getByTestId('card-chat-textarea'), { key: 'Escape' });
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

describe('the mic', () => {
  it('is disabled with a short reason where the browser has no speech recognition', async () => {
    mount();
    await screen.findByTestId('card-chat-headline');
    const mic = screen.getByTestId('card-chat-mic');
    expect(mic).toBeDisabled();
    expect(mic).toHaveAttribute('aria-label', 'Microphone unavailable');
    expect(mic.getAttribute('title')).toMatch(/does not work in this browser/);
    expect(screen.getByTestId('card-chat-mic-reason')).toHaveTextContent('Microphone unavailable');
  });

  it('dictates into the box after what was typed, and nothing is sent until Send', async () => {
    const made: Array<{ onresult?: (e: unknown) => void; start: () => void }> = [];
    class FakeRecognition {
      continuous = false;
      interimResults = false;
      lang = '';
      maxAlternatives = 1;
      onresult?: (e: unknown) => void;
      onend?: () => void;
      onerror?: () => void;
      constructor() {
        made.push(this);
      }
      start() {}
      stop() {}
      abort() {}
    }
    (window as unknown as Record<string, unknown>).SpeechRecognition = FakeRecognition;
    mount();
    await screen.findByTestId('card-chat-headline');
    type('About sleep:');
    const mic = screen.getByTestId('card-chat-mic');
    expect(mic).not.toBeDisabled();
    fireEvent.click(mic);
    expect(await screen.findByTestId('card-chat-listening')).toHaveTextContent('Listening');
    act(() => {
      made[made.length - 1]!.onresult!({ results: [[{ transcript: 'when will it get better' }]] });
    });
    expect(screen.getByTestId('card-chat-textarea')).toHaveValue('About sleep: when will it get better');
    expect(asks()).toHaveLength(0);
  });
});

describe('the mic after Send', () => {
  it('late words the browser delivers after Send do not refill the box', async () => {
    const made: Array<{ onresult?: (e: unknown) => void }> = [];
    class FakeRecognition {
      continuous = false;
      interimResults = false;
      lang = '';
      maxAlternatives = 1;
      onresult?: (e: unknown) => void;
      onend?: () => void;
      onerror?: () => void;
      constructor() {
        made.push(this);
      }
      start() {}
      stop() {}
      abort() {}
    }
    (window as unknown as Record<string, unknown>).SpeechRecognition = FakeRecognition;
    mount();
    await screen.findByTestId('card-chat-headline');
    fireEvent.click(screen.getByTestId('card-chat-mic'));
    act(() => made[made.length - 1]!.onresult!({ results: [[{ transcript: 'when will it lift' }]] }));
    await act(async () => {
      fireEvent.click(screen.getByTestId('card-chat-send'));
    });
    act(() => made[made.length - 1]!.onresult!({ results: [[{ transcript: 'when will it lift' }]] }));
    expect(screen.getByTestId('card-chat-textarea')).toHaveValue('');
    await waitFor(() => expect(asks()).toHaveLength(1));
  });
});

describe('the phone keyboard', () => {
  it('lifts the input above it and the preamble gives way', async () => {
    const listeners: Array<() => void> = [];
    const vv = { height: 400, offsetTop: 0, addEventListener: (_: string, fn: () => void) => listeners.push(fn), removeEventListener: () => undefined };
    vi.stubGlobal('visualViewport', vv);
    const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ bottom: 700, height: 500, top: 200, left: 0, right: 300, width: 300, x: 0, y: 200, toJSON: () => ({}) } as DOMRect);
    try {
      mount();
      await screen.findByTestId('card-chat-headline');
      act(() => listeners.forEach((fn) => fn()));
      expect(screen.getByTestId('card-chat').style.paddingBottom).toBe('300px');
      expect(screen.getByTestId('card-chat-preamble')).toHaveAttribute('data-keyboard', 'up');
      expect(screen.getByTestId('card-chat-preamble').className).toMatch(/\bhidden\b/);
      vv.height = 820;
      act(() => listeners.forEach((fn) => fn()));
      expect(screen.getByTestId('card-chat').style.paddingBottom).toBe('');
      expect(screen.getByTestId('card-chat-preamble')).toHaveAttribute('data-keyboard', 'down');
    } finally {
      rect.mockRestore();
    }
  });
});

describe('the store keeps the thread', () => {
  it('a second mount (back to Read, then Chat again) shows the turns without a new open', async () => {
    const store = createCardChatStore();
    const first = mount(store);
    await screen.findByTestId('card-chat-headline');
    type('Kept?');
    await act(async () => {
      fireEvent.click(screen.getByTestId('card-chat-send'));
    });
    await waitFor(() => expect(screen.getByTestId('card-chat-thread')).toHaveTextContent('An answer.'));
    first.unmount();
    const opens = calls.filter((c) => c.url.includes('/api/cards/')).length;
    mount(store);
    expect(screen.getByTestId('card-chat-thread')).toHaveTextContent('Kept?');
    expect(screen.getByTestId('card-chat-thread')).toHaveTextContent('An answer.');
    expect(calls.filter((c) => c.url.includes('/api/cards/'))).toHaveLength(opens);
  });
});
