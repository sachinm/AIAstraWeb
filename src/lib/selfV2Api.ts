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
import type { PlanStatus } from './billing';

// ---------------------------------------------------------------------------------------------------------------------
// Copied from the server's src/reading/self/v2types.ts (and AreaDate / AreaCertainty from areaDoc.ts). Keep identical.
// ---------------------------------------------------------------------------------------------------------------------

export type SelfV2AreaId =
  | 'now'
  | 'stuck'
  | 'chapter'
  | 'diagnosis'
  | 'lagna'
  | 'mind'
  | 'body'
  | 'drive'
  | 'presence'
  | 'yogas'
  | 'chapters'
  | 'year';

export type SelfV2Group = 'now' | 'you' | 'time';

export type IsoDate = string; // YYYY-MM-DD

export type Matter =
  | 'self_and_body'
  | 'money_in_hand'
  | 'effort_and_courage'
  | 'home_and_peace'
  | 'ideas_and_children'
  | 'work_load_and_health'
  | 'partnership'
  | 'sudden_and_hidden'
  | 'luck_and_belief'
  | 'career_and_standing'
  | 'gains_and_network'
  | 'loss_rest_and_distance';

export type Polarity = 'presses' | 'mixed' | 'supports';
export type Strength = 1 | 2 | 3;

export interface WindowRef {
  rowId: string;
  matters: Matter[];
  polarity: Polarity;
  strength: Strength;
  from: IsoDate;
  to: IsoDate;
}

export type AreaCertainty = 'strong' | 'likely' | 'possible';

export interface AreaDate {
  from: string;
  to: string;
  label: string;
}

export type Tone = 'demanding' | 'heavy' | 'mixed' | 'easing' | 'steady' | 'open';
export type Mood = 'heavy' | 'mixed' | 'fine';

export interface LadderSteps {
  best: string;
  practical: string;
  drift: string;
  floor: string;
}

export interface PersonalPattern {
  text: string;
  kind: 'risk' | 'watch' | 'strength';
  since: IsoDate | null;
  until: IsoDate | null;
  /** the Oracle paragraph id ('<area>.p<n>') or evidence key the sentence rests on */
  source: string;
}

export interface PersonalCard {
  areaId: SelfV2AreaId;
  /** ≤ 14 words, second person, names a life area and, on live cards, a date */
  headline: string;
  /** two or three short paragraphs, ≤ 120 words in all */
  body: string[];
  patterns: PersonalPattern[];
  ladder: LadderSteps | null;
  /** copied from the Oracle; the validator rejects any date not in the Oracle document */
  dates: AreaDate[];
  certainty: AreaCertainty;
  /** per sentence of headline + body, the Oracle paragraph id or evidence key it rests on */
  sources: string[];
}

export interface HeroDoc {
  tone: Tone;
  /** one sentence: the life area and the date it changes */
  sentence: string;
  sub: string;
  strip: WindowRef[];
  easesAt: IsoDate | null;
  nextCheck: IsoDate | null;
  question: { claimId: string; text: string } | null;
  /** a split verdict is withheld, never shown */
  withheld: boolean;
}

export type CardStatus = 'ok' | 'pending' | 'withheld' | 'failed';
export type AgeBand = 'under_25' | '25_35' | '36_45' | '46_60' | '60_plus';

// ---------------------------------------------------------------------------------------------------------------------
// The response
// ---------------------------------------------------------------------------------------------------------------------

export interface SelfV2Clock {
  system: string;
  label: string;
  reason: string;
  /** one plain line: why the board is read on this clock */
  reasonLine: string;
  applicable: Array<{ system: string; label: string; line: string }>;
  notApplicable: Array<{ system: string; label: string; reason: string }>;
}

export interface SelfV2Area {
  id: SelfV2AreaId;
  group: SelfV2Group;
  title: string;
  status: CardStatus;
  card: PersonalCard | null;
  /** what the chart says for sure, shown under a pending or failed card */
  floor: string[];
  /** Chart details: chart terms allowed here */
  details: { headline?: string; paragraphs?: string[]; evidence: string[]; certainty?: AreaCertainty };
}

export interface SelfV2Response {
  status: 'ok' | 'pending' | 'preparing' | 'no_kundli';
  builtAt: string | null;
  nextCheck: string | null;
  clock: SelfV2Clock;
  hero: HeroDoc | null;
  areas: SelfV2Area[];
  profile: { ageBand: AgeBand | null; hasGender: boolean; missing: string[] };
  usage?: PlanStatus;
}

export type SelfV2State =
  | { kind: 'ok'; board: SelfV2Response }
  | { kind: 'preparing' }
  | { kind: 'no_kundli' }
  | { kind: 'unavailable' }
  | { kind: 'error' };

export type SelfConfirmAnswer = 'yes' | 'partly' | 'no' | 'skip';

export type ClockChangeResult =
  | { ok: true; usage: PlanStatus | null; alsoChanges: string[] }
  | { ok: false; error: 'not_applicable' | 'unknown_system' | 'failed' };

// ---------------------------------------------------------------------------------------------------------------------
// The flag
// ---------------------------------------------------------------------------------------------------------------------

/** The v2 board shows when the build sets VITE_SELF_V2=1 or the address carries ?v2=1, so release can be undone. */
export function selfV2Enabled(search: string = typeof window !== 'undefined' ? window.location.search : '', env: string | undefined = import.meta.env.VITE_SELF_V2): boolean {
  if (env === '1') return true;
  try {
    return new URLSearchParams(search).get('v2') === '1';
  } catch {
    return false;
  }
}

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
  return fetch(ledgerApiUrl(path), { method, headers, ...(body !== undefined ? { body } : {}) });
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

export async function changeSelfV2Clock(system: string): Promise<ClockChangeResult> {
  let r: Response;
  try {
    r = await call('PUT', '/api/self/v2/clock', { system });
  } catch {
    return { ok: false, error: 'failed' };
  }
  const j = (await r.json().catch(() => null)) as { usage?: PlanStatus; alsoChanges?: string[]; error?: string } | null;
  if (r.ok) return { ok: true, usage: j?.usage ?? null, alsoChanges: j?.alsoChanges ?? [] };
  if (r.status === 400 && (j?.error === 'not_applicable' || j?.error === 'unknown_system')) return { ok: false, error: j.error };
  return { ok: false, error: 'failed' };
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
