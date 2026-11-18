/**
 * Card chat (server docs/reading-engine/85): every request and response shape of the per-card chat lives here, so the
 * web lines up with the server in one place.
 *
 * - Open: `GET /api/cards/:board/:cardId/chat?from&to` → `{card {board, id, title, subtitle}, period {from, to, label}
 *   | null, preamble {headline, lines[], keyDates[{date, label}], confirm}, cost {uses, remaining, limit, line | null},
 *   thread {chatId | null, messages[{question, answer, at, periodLabel}]}}` (server f09ad68). `normaliseOpen` also takes
 *   a plain-string preamble and a top-level `costLine`, and drops anything it does not know.
 * - Send: `POST /api/chat/ask-stream` with `{question, card {board, cardId, from?, to?}, turnId, chatId?}`. `turnId` is
 *   one uuid per send; a retry of the same send reuses it (an answered one replays, `done.replay`), so it is charged
 *   once. The SSE stream: `turn_init`, `card`, `start`, `usage`, `token`..., `done {chatId, answer, card, usage?}`;
 *   `error {code?, message, usage?}`; a declined topic is `info {reason:'declined'}`, a token and `done`.
 * - Clarify (Sachin, 2026-11-18): the thread's first question also sends `clarify: true`. The server runs Clarify
 *   pre-filled from the card (its area, the period on screen), so it asks only a missing fact: `turn_init`, `card`,
 *   `clarify {type:'start'}`, `clarify {type:'clarify', runId, criterion, question, chips, allowFreeText}`, then `done
 *   {status:'clarifying', runId}`; nothing is charged. `POST /api/chat/answer` gives the next `clarify` or `{type:'ready'}`,
 *   and `POST /api/chat/confirm-stream {runId, chatId}` streams the answer as a send does (the server keeps the card and
 *   the first send's turnId on the clarify run). Nothing to ask: the answer streams at once. Follow-ups never send it.
 * - Errors are mapped on the server's `error` / `code` string (`problemOf`), on the status only when there is none.
 *
 * The web never sends the card's text: the server reads the stored card again. Nothing here is shown to the person
 * except through the view model below (no ids, no server error codes).
 */
import { buildApiHeaders } from './apiHeaders';
import { ledgerApiUrl } from './ledgerApi';
import type { PlanStatus } from './billing';
import type { BoardId } from './selfV3Api';

export type CardChatBoard = BoardId;

/** the card on screen and its period, as the web knows it */
export interface CardChatRef {
  board: CardChatBoard;
  cardId: string;
  /** the period on screen (YYYY-MM-DD); absent when the card has no period of its own */
  from?: string | null;
  to?: string | null;
}

/** `card` on the ask-stream body. The brief names it `cardId`; plan doc 85 §4 API writes `id`. Change it here only. */
export interface CardChatWire {
  board: CardChatBoard;
  cardId: string;
  from?: string;
  to?: string;
}

export function toWireCard(ref: CardChatRef): CardChatWire {
  return { board: ref.board, cardId: ref.cardId, ...(ref.from ? { from: ref.from } : {}), ...(ref.to ? { to: ref.to } : {}) };
}

/** the fields a card chat adds to the ask-stream body */
export function cardAskFields(ref: CardChatRef, turnId: string): { card: CardChatWire; turnId: string } {
  return { card: toWireCard(ref), turnId };
}

/** one uuid per send */
export function newTurnId(): string {
  const c = typeof crypto !== 'undefined' ? (crypto as Crypto & { randomUUID?: () => string }) : undefined;
  if (c?.randomUUID) return c.randomUUID();
  const b = new Uint8Array(16);
  if (c?.getRandomValues) c.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// ---------------------------------------------------------------------------------------------------------------------
// Open
// ---------------------------------------------------------------------------------------------------------------------

/** the GET body as the server may send it (both shapes; every field optional) */
export interface CardChatOpenWire {
  card?: { board?: string; id?: string; cardId?: string; title?: string; subtitle?: string | null } | null;
  period?: { from?: string; to?: string; label?: string } | null;
  preamble?: string | { headline?: string | null; lines?: unknown; keyDates?: unknown; confirm?: string | null } | null;
  costLine?: string | null;
  cost?: { uses?: number; remaining?: number | null; limit?: number | null; line?: string | null } | null;
  thread?: {
    chatId?: string | null;
    messages?: Array<{ question?: unknown; answer?: unknown; at?: unknown; periodLabel?: unknown }> | null;
  } | null;
}

export interface CardChatTurnView {
  question: string;
  answer: string;
  periodLabel: string | null;
}

/** what the chat view draws */
export interface CardChatOpen {
  title: string | null;
  periodLabel: string | null;
  preamble: {
    headline: string | null;
    lines: string[];
    /** the card's dated turning points (YYYY-MM-DD and its words) */
    keyDates: Array<{ date: string; label: string }>;
    /** the card's "Is this right?" claim, when the server sends one */
    confirm: string | null;
  };
  /** "Uses 1 of your 7 questions"; null for Unlimited or exempt accounts, or when the server cannot say */
  costLine: string | null;
  chatId: string | null;
  thread: CardChatTurnView[];
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** "Uses 1 of your N questions" from a remaining count */
export function costLineFor(uses: number, remaining: number | null | undefined): string | null {
  if (remaining === null || remaining === undefined || !Number.isFinite(remaining)) return null;
  return `Uses ${uses} of your ${remaining} question${remaining === 1 ? '' : 's'}`;
}

export function normaliseOpen(w: CardChatOpenWire | null | undefined): CardChatOpen {
  const p = w?.preamble;
  let headline: string | null = null;
  let lines: string[] = [];
  let keyDates: Array<{ date: string; label: string }> = [];
  let confirm: string | null = null;
  if (typeof p === 'string') {
    const parts = p.split(/\n+/).map((s) => s.trim()).filter(Boolean);
    headline = parts[0] ?? null;
    lines = parts.slice(1);
  } else if (p && typeof p === 'object') {
    headline = str(p.headline);
    lines = Array.isArray(p.lines) ? p.lines.map(str).filter((s): s is string => !!s) : [];
    keyDates = Array.isArray(p.keyDates)
      ? (p.keyDates as Array<{ date?: unknown; label?: unknown } | null>)
          .map((k) => ({ date: str(k?.date) ?? '', label: str(k?.label) ?? '' }))
          .filter((k) => /^[0-9]{4}-[0-9]{2}-[0-9]{2}/.test(k.date) && !!k.label)
      : [];
    confirm = str(p.confirm);
  }
  // the server's own line wins (null hides it: Unlimited or exempt); else one from the count left
  const c = w?.cost;
  const costLine = w && 'costLine' in w ? str(w.costLine) : c && 'line' in c ? str(c.line) : c ? costLineFor(c.uses ?? 1, c.remaining) : null;
  const thread = (w?.thread?.messages ?? [])
    .map((m) => ({ question: str(m?.question) ?? '', answer: typeof m?.answer === 'string' ? m.answer : '', periodLabel: str(m?.periodLabel) }))
    .filter((m) => m.question || m.answer);
  return {
    title: str(w?.card?.title),
    periodLabel: str(w?.period?.label),
    preamble: { headline, lines, keyDates, confirm },
    costLine,
    chatId: str(w?.thread?.chatId),
    thread,
  };
}

/** why an open or a send did not go through, in the web's own words (never the server's code) */
export type CardChatProblem = 'auth' | 'off' | 'not_ready' | 'no_kundli' | 'period' | 'quota' | 'busy' | 'rate_limited' | 'spend_cap' | 'timeout' | 'failed';

export class CardChatError extends Error {
  readonly problem: CardChatProblem;
  readonly usage: PlanStatus | null;
  constructor(problem: CardChatProblem, usage: PlanStatus | null = null) {
    super(problem);
    this.name = 'CardChatError';
    this.problem = problem;
    this.usage = usage;
  }
}

/** the server's `error` (GET, ask-stream) or SSE `code` strings, by the web's problem */
const PROBLEM_BY_CODE: Readonly<Record<string, CardChatProblem>> = {
  quota_exhausted: 'quota',
  no_kundli: 'no_kundli',
  card_not_ready: 'not_ready',
  chart_not_ready: 'not_ready',
  unknown_card: 'off',
  card_not_on_board: 'off',
  unknown_board: 'off',
  board_off: 'off',
  feature_off: 'off',
  locked: 'off',
  bad_period: 'period',
  turn_in_flight: 'busy',
  rate_limited: 'rate_limited',
  spend_cap: 'spend_cap',
  timeout: 'timeout',
  // a request the web built wrong: nothing the person can change
  bad_card: 'failed',
  bad_turn_id: 'failed',
  card_with_focus: 'failed',
};

/** a server error to the web's problem: by its code first, by the status only when the code says nothing */
export function problemOf(status: number, code?: string | null): CardChatProblem {
  const byCode = code ? PROBLEM_BY_CODE[code] : undefined;
  if (byCode) return byCode;
  if (status === 401) return 'auth';
  if (status === 402) return 'quota';
  if (status === 403) return 'off';
  if (status === 429) return 'rate_limited';
  if (status === 503 || status === 504) return 'timeout';
  return 'failed';
}

export function cardChatUrl(ref: CardChatRef): string {
  const q = new URLSearchParams();
  if (ref.from) q.set('from', ref.from);
  if (ref.to) q.set('to', ref.to);
  const qs = q.toString();
  return ledgerApiUrl(`/api/cards/${encodeURIComponent(ref.board)}/${encodeURIComponent(ref.cardId)}/chat${qs ? `?${qs}` : ''}`);
}

/** GET open: the card's preamble, the period, the cost line and its thread. No model call on the server. */
export async function openCardChat(ref: CardChatRef, signal?: AbortSignal): Promise<CardChatOpen> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  if (!token) throw new CardChatError('auth');
  const headers = await buildApiHeaders({ token, method: 'GET' });
  let res: Response;
  try {
    res = await fetch(cardChatUrl(ref), { method: 'GET', headers, credentials: 'include', ...(signal ? { signal } : {}) });
  } catch (e) {
    if ((e as { name?: string })?.name === 'AbortError') throw e;
    throw new CardChatError('failed');
  }
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string; usage?: PlanStatus };
    throw new CardChatError(problemOf(res.status, j.error), j.usage ?? null);
  }
  const body = (await res.json().catch(() => null)) as CardChatOpenWire | null;
  return normaliseOpen(body);
}
