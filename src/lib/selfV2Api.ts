/**
 * The Self board v2 client (server docs/reading-engine/66 §4.5 and the mockup). One GET carries the whole board: the
 * clock it is read on, the hero (the person's present shade), the twelve areas in the server's order and the plan
 * status. The card types are copied from the server's `src/reading/self/v2types.ts` and must stay identical to it.
 *
 * GET /api/self/v2            -> SelfV2Response (`status` ok | pending | preparing | no_kundli)
 * PUT /api/self/v2/clock      -> 202 { usage, status: 'building', alsoChanges } | 400 { error }
 * POST /api/self/v2/confirm   -> 204
 * POST /api/self/v2/mood      -> 204
 */
import { buildApiHeaders } from './apiHeaders';
import { ledgerApiUrl } from './ledgerApi';
// the clock switch the v3 Self header keeps (PUT /api/self/v2/clock) lives in selfClockApi.ts
export { changeSelfV2Clock } from './selfClockApi';
import type { Mood, SelfConfirmAnswer, SelfV2Response } from './boardTypes';

// The shared board types live in boardTypes.ts (moved there unchanged); they are re-exported for the v2 board.
export type {
  SelfV2AreaId,
  SelfV2Group,
  IsoDate,
  Matter,
  Polarity,
  Strength,
  WindowRef,
  AreaCertainty,
  AreaDate,
  Tone,
  Mood,
  LadderSteps,
  PersonalPattern,
  PersonalCard,
  CardIllustration,
  HeroDoc,
  CardStatus,
  SelfV2Quality,
  AgeBand,
  ReaderRole,
  SelfV2Clock,
  SelfV2Area,
  SelfV2Response,
  SelfV2BuildState,
  SelfV2BuildStage,
  SelfV2BuildView,
  SelfV2Refresh,
  SelfConfirmAnswer,
  ClockChangeResult,
} from './boardTypes';

export type SelfV2State =
  | { kind: 'ok'; board: SelfV2Response }
  | { kind: 'preparing' }
  | { kind: 'no_kundli' }
  | { kind: 'unavailable' }
  | { kind: 'error' };

// ---------------------------------------------------------------------------------------------------------------------
// Calls
// ---------------------------------------------------------------------------------------------------------------------

/** A gateway that could not answer in time: the build goes on behind it, so the page keeps waiting. */
const TRANSIENT = new Set([502, 503, 504]);

async function call(method: string, path: string, payload?: unknown): Promise<Response> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const body = payload === undefined ? undefined : JSON.stringify(payload);
  // buildApiHeaders sends X-Astra-Page (the page timing telemetry joins server timings to the page by it)
  const headers = await buildApiHeaders({ token, body, method });
  return fetch(ledgerApiUrl(path), { method, headers, credentials: 'include', ...(body !== undefined ? { body } : {}) });
}

function isBoard(j: unknown): j is SelfV2Response {
  const b = j as Partial<SelfV2Response> | null;
  return !!b && typeof b === 'object' && typeof b.status === 'string' && Array.isArray(b.areas) && !!b.clock;
}

export async function fetchSelfV2(): Promise<SelfV2State> {
  let r: Response;
  try {
    r = await call('GET', '/api/self/v2');
  } catch {
    return { kind: 'error' };
  }
  if (TRANSIENT.has(r.status)) return { kind: 'preparing' };
  const j = (await r.json().catch(() => null)) as (Partial<SelfV2Response> & { error?: string }) | null;
  if (j?.status === 'no_kundli' || j?.error === 'no_kundli') return { kind: 'no_kundli' };
  if (r.status === 404) return { kind: 'unavailable' };
  if (j?.status === 'preparing') return { kind: 'preparing' };
  if (!r.ok && r.status !== 202) return { kind: 'error' };
  // a 202 with the whole board is a board still being written (pending); a 202 without one is the chart not ready
  if (!isBoard(j)) return r.status === 202 ? { kind: 'preparing' } : { kind: 'error' };
  return { kind: 'ok', board: j };
}

/** The hero's one question; true on 204. */
export async function sendSelfV2Confirm(claimId: string, answer: SelfConfirmAnswer): Promise<boolean> {
  try {
    return (await call('POST', '/api/self/v2/confirm', { claimId, answer })).ok;
  } catch {
    return false;
  }
}

/** "How are you arriving today?"; true on 204. */
export async function sendSelfV2Mood(mood: Mood): Promise<boolean> {
  try {
    return (await call('POST', '/api/self/v2/mood', { mood })).ok;
  } catch {
    return false;
  }
}
