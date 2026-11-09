/**
 * A fresh reading the person asks for (server docs/billing/03). Boards are offline first: opening one shows the last
 * reading made for it and costs nothing; once its "good until" day has passed the person may ask for a fresh one, which
 * takes one question. The server decides when that is due; the web only shows its answer.
 */
import { buildApiHeaders } from './apiHeaders';
import { ledgerApiUrl } from './ledgerApi';
import type { PlanStatus } from './billing';
import { announceUsage } from './planUsage';

export type RefreshBoard = 'self' | 'love' | 'work';

export type RefreshResult =
  | { kind: 'made' }
  | { kind: 'building' }
  | { kind: 'not_due'; validUntil: string | null }
  | { kind: 'no_questions'; usage: PlanStatus | null }
  | { kind: 'error' };

export const BOARD_REFRESHED_EVENT = 'aiastra:board-refreshed';

export async function refreshBoard(board: RefreshBoard): Promise<RefreshResult> {
  let r: Response;
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const headers = await buildApiHeaders({ token, body: undefined, method: 'POST' });
    r = await fetch(ledgerApiUrl(`/api/boards/${board}/refresh`), { method: 'POST', headers });
  } catch {
    return { kind: 'error' };
  }
  const j = (await r.json().catch(() => null)) as { code?: string; valid_until?: string | null; usage?: PlanStatus } | null;
  if (j?.usage) announceUsage(j.usage);
  if (r.status === 200 || r.status === 202) {
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(BOARD_REFRESHED_EVENT, { detail: board }));
    return { kind: r.status === 200 ? 'made' : 'building' };
  }
  if (r.status === 402) return { kind: 'no_questions', usage: j?.usage ?? null };
  if (r.status === 409 && j?.code === 'not_due') return { kind: 'not_due', validUntil: j.valid_until ?? null };
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
