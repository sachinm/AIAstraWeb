import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sendChatMessageStream } from './UserData';
import { QuotaExhaustedError, type PlanStatus } from '../lib/billing';
import type { ReadingStreamEvent } from './chat-interface/readingProgress';

const usage: PlanStatus = {
  code: 'free',
  desired_plan: null,
  desired_interval: null,
  is_paid: false,
  interval: null,
  used: 5,
  limit: 5,
  remaining: 0,
  window: 'lifetime',
  resets_at: null,
  exempt: false,
};

const sse = (...events: unknown[]) =>
  new Response(events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join(''), { status: 200, headers: { 'Content-Type': 'text/event-stream' } });

describe('question limits on the chat stream', () => {
  beforeEach(() => localStorage.setItem('token', 't'));
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('turns a 402 into QuotaExhaustedError with the usage', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'used', code: 'quota_exhausted', usage }), { status: 402 })));
    const err = await sendChatMessageStream('q', null, () => {}).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(QuotaExhaustedError);
    expect((err as QuotaExhaustedError).usage).toEqual(usage);
  });

  it('turns a quota SSE error into QuotaExhaustedError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sse({ type: 'error', code: 'quota_exhausted', usage, message: 'used' })));
    const err = await sendChatMessageStream('q', null, () => {}).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(QuotaExhaustedError);
    expect((err as QuotaExhaustedError).usage).toEqual(usage);
  });

  it('keeps other SSE errors as plain errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sse({ type: 'error', message: 'model down' })));
    const err = await sendChatMessageStream('q', null, () => {}).catch((e: unknown) => e);
    expect(err).not.toBeInstanceOf(QuotaExhaustedError);
    expect((err as Error).message).toBe('model down');
  });

  it('passes usage from `usage` and `done` events to the listener', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        sse(
          { type: 'usage', usage: { ...usage, used: 4, remaining: 1 } },
          { type: 'token', delta: 'hi' },
          { type: 'done', chatId: 'c1', answer: 'hi', usage }
        )
      )
    );
    const events: ReadingStreamEvent[] = [];
    const r = await sendChatMessageStream('q', null, () => {}, { onEvent: (e) => events.push(e) });
    expect(r.answer).toBe('hi');
    expect(events.map((e) => e.usage?.used)).toEqual([4, 5]);
  });
});
