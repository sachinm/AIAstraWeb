/**
 * Card chat (server docs/reading-engine/85): every request and response shape of the per-card chat lives here, so the
 * web lines up with the server in one place.
 *
 * - Open: `GET /api/cards/:board/:cardId/chat?from&to` → the card's own text (preamble), the period, the cost line and
 *   the card's thread. `normaliseOpen` accepts the brief's shape (`costLine` string, `preamble` string) and the plan's
 *   (`cost {uses, remaining}`, `preamble {headline, lines, keyDates}`), and drops anything it does not know.
 * - Send: `POST /api/chat/ask-stream` with today's body plus `card {board, cardId, from, to}`, `turnId` (one uuid per
 *   send; a retry of the same send reuses it, so it is charged once) and `chatId` (the card's thread). The SSE stream
 *   opens with `{type:'card', ...}` and then carries today's events. `cardAskFields` builds the extra fields.
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
  card?: { board?: string; id?: string; cardId?: string; title?: string } | null;
  period?: { from?: string; to?: string; label?: string } | null;
  preamble?: string | { headline?: string | null; lines?: unknown; keyDates?: unknown } | null;
  costLine?: string | null;
  cost?: { uses?: number; remaining?: number | null } | null;
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
  preamble: { headline: string | null; lines: string[] };
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
  if (typeof p === 'string') {
    const parts = p.split(/\n+/).map((s) => s.trim()).filter(Boolean);
    headline = parts[0] ?? null;
    lines = parts.slice(1);
  } else if (p && typeof p === 'object') {
    headline = str(p.headline);
    lines = Array.isArray(p.lines) ? p.lines.map(str).filter((s): s is string => !!s) : [];
  }
  const costLine = w && 'costLine' in w ? str(w.costLine) : w?.cost ? costLineFor(w.cost.uses ?? 1, w.cost.remaining) : null;
  const thread = (w?.thread?.messages ?? [])
    .map((m) => ({ question: str(m?.question) ?? '', answer: typeof m?.answer === 'string' ? m.answer : '', periodLabel: str(m?.periodLabel) }))
    .filter((m) => m.question || m.answer);
  return {
    title: str(w?.card?.title),
    periodLabel: str(w?.period?.label),
    preamble: { headline, lines },
    costLine,
    chatId: str(w?.thread?.chatId),
    thread,
  };
}

/** why an open or a send did not go through, in the web's own words (never the server's code) */
export type CardChatProblem = 'auth' | 'off' | 'not_ready' | 'no_kundli' | 'quota' | 'failed';

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

/** a server status and error code to the web's problem */
export function problemOf(status: number, code?: string | null): CardChatProblem {
  if (status === 401) return 'auth';
  if (status === 402 || code === 'quota_exhausted') return 'quota';
  if (code === 'no_kundli') return 'no_kundli';
  if (code === 'card_not_ready' || code === 'chart_not_ready') return 'not_ready';
  if (status === 403 || code === 'feature_off' || code === 'locked' || code === 'card_not_on_board' || code === 'unknown_card') return 'off';
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
