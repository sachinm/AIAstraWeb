/**
 * A fresh reading the person asks for (server docs/billing/03). Boards are offline first: opening one shows the last
 * reading made for it and costs nothing; once its "good until" day has passed the person may ask for a fresh one, which
 * takes one question. The server decides when that is due; the web only shows its answer.
 */
import { buildApiHeaders } from './apiHeaders';
import { ledgerApiUrl } from './ledgerApi';
import type { PlanStatus } from './billing';
import { announceUsage } from './planUsage';
import { announceAiUnavailable } from './aiStatus';

export type RefreshBoard = 'self' | 'love' | 'work';

/**
 * Love and Work on v3 (server src/reading/boards/lensRefresh.ts): the answer names the lens and says whether a question
 * was counted. `first`: the lens had never been read, so this reading is free. `repeat`: the same lens was already
 * asked for today; nothing is read again and nothing is counted. `charged`: the gate took a question.
 */
export interface LensRefreshFlags {
  lens?: string;
  first?: boolean;
  repeat?: boolean;
  charged?: boolean;
}

export type RefreshResult =
  | ({ kind: 'made'; usage?: PlanStatus | null } & LensRefreshFlags)
  | { kind: 'building'; usage?: PlanStatus | null }
  | { kind: 'not_due'; validUntil: string | null }
  | { kind: 'no_questions'; usage: PlanStatus | null }
  /** 409 not_ready: the board is catching up (a build failed in the last half hour, or the deck is not ready) */
  | { kind: 'not_ready' }
  | { kind: 'error' };

export const BOARD_REFRESHED_EVENT = 'aiastra:board-refreshed';

export async function refreshBoard(board: RefreshBoard, opts: { lens?: string | null } = {}): Promise<RefreshResult> {
  // Love and Work refresh one lens: the one on screen (the server falls back to the stored lens when none is sent)
  const body = board !== 'self' && opts.lens ? JSON.stringify({ lens: opts.lens }) : undefined;
  let r: Response;
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const headers = await buildApiHeaders({ token, body, method: 'POST' });
    r = await fetch(ledgerApiUrl(`/api/boards/${board}/refresh`), { method: 'POST', headers, credentials: 'include', ...(body ? { body } : {}) });
  } catch {
    return { kind: 'error' };
  }
  const j = (await r.json().catch(() => null)) as
    | { code?: string; error?: string; valid_until?: string | null; usage?: PlanStatus; lens?: unknown; first?: unknown; repeat?: unknown; charged?: unknown }
    | null;
  if (j?.usage) announceUsage(j.usage);
  if (r.status === 200 || r.status === 202) {
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(BOARD_REFRESHED_EVENT, { detail: board }));
    if (r.status === 202) return { kind: 'building', usage: j?.usage ?? null };
    const flags: LensRefreshFlags = {};
    if (typeof j?.lens === 'string') flags.lens = j.lens;
    if (j?.first === true) flags.first = true;
    if (j?.repeat === true) flags.repeat = true;
    if (typeof j?.charged === 'boolean') flags.charged = j.charged;
    return { kind: 'made', usage: j?.usage ?? null, ...flags };
  }
  if (r.status === 402) return { kind: 'no_questions', usage: j?.usage ?? null };
  if (r.status === 503 && j?.code === 'ai_unavailable') announceAiUnavailable();
  const code = j?.code ?? j?.error;
  if (r.status === 409 && code === 'not_due') return { kind: 'not_due', validUntil: j?.valid_until ?? null };
  if (r.status === 409 && code === 'building') return { kind: 'building', usage: j?.usage ?? null };
  if (r.status === 409 && code === 'not_ready') return { kind: 'not_ready' };
  return { kind: 'error' };
}

/** Calls `apply` when a board was given a fresh reading; returns the unsubscribe. */
export function onBoardRefreshed(board: RefreshBoard, apply: () => void): () => void {
  const h = (e: Event) => {
    if ((e as CustomEvent<RefreshBoard>).detail === board) apply();
  };
  window.addEventListener(BOARD_REFRESHED_EVENT, h);
  return () => window.removeEventListener(BOARD_REFRESHED_EVENT, h);
}
