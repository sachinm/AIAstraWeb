/**
 * The "Your reading" client for the You board (server docs/reading-engine/58 §4.2, card contract doc 62): panels, each one catalogued
 * technique, read on the person's own clock. 200 is a reading, 202 means the chart is still being prepared, 404 with
 * `no_kundli` means no birth chart yet, any other 404 means the reading is off. `gaps`, `purview`,
 * `audit` and `dossierId` are staff-only and never rendered as such.
 */
import { buildApiHeaders } from './apiHeaders';
import { ledgerApiUrl } from './ledgerApi';

export type SelfAnswer = 'yes' | 'partly' | 'no' | 'skip';

export interface SelfClockChoice {
  system: string;
  label: string;
}

export interface SelfClock {
  system: string;
  label: string;
  reason: 'preferred' | 'applicable' | 'default';
  confirming: SelfClockChoice[];
  choices: SelfClockChoice[];
}

export interface SelfClaim {
  /** stable per kundli: '<panel>.<rule>' e.g. 'lagna.lord_house' */
  id: string;
  /** plain words, no chart terms */
  text: string;
  /** chart terms, shown under "Chart details" */
  detail: string;
  certainty: 'fact' | 'confirmed' | 'likely' | 'split';
  evidence: string[];
  /** reason, when the person said it did not fit */
  withheld?: string;
}

export interface SelfSubChapter {
  lord: string;
  lordLabel: string;
  from: string;
  to: string;
  text: string;
  detail: string;
  houses: number[];
}

export interface SelfChapter {
  kind: 'previous' | 'running' | 'next';
  lord: string;
  lordLabel: string;
  from: string;
  to: string;
  /** null on split */
  text: string | null;
  detail: string;
  certainty: 'confirmed' | 'likely' | 'split';
  houses: number[];
  /** running only: the sub-chapter now */
  sub?: SelfSubChapter;
  nextSub?: { lord: string; lordLabel: string; from: string; to: string; houses: number[] };
  confirmations: Array<{ system: string; label: string; agrees: boolean; boundary: string | null }>;
  evidence: string[];
}

/** display order (server docs/reading-engine/62): In short, chapters, lagna, mind, body, atma, yogas, struggle, year */
export type SelfPanelId = 'diagnosis' | 'chapters' | 'lagna' | 'mind' | 'body' | 'atma' | 'yogas' | 'struggle' | 'year';

/** server docs/reading-engine/62: the range a line or a card is true for; YYYY-MM-DD */
export type LineRange = { from: string; to: string } | 'always';

/** doc 61 §1; only timing lines show the word, never 'fact' */
export type LineCertainty = 'fact' | 'strong' | 'moderate' | 'possible';

/** One line of a panel's card (doc 62). */
export interface SelfLine {
  /** '<panel>.<n>' */
  id: string;
  /** plain words, at most 22 words */
  text: string;
  range: LineRange;
  /** the SelfClaim ids it rests on */
  claimIds: string[];
  certainty: LineCertainty;
  /** chart terms, shown under "Chart details" */
  detail: string;
}

export interface SelfPurviewEntry {
  rule: string;
  source: string;
  action: 'override' | 'veto' | 'annotate';
  affects: string[];
  text: string;
}

export interface SelfAudit {
  verdict: 'pass' | 'fail';
  checked: number;
  failures: Array<{ lineId: string; check: string; text: string }>;
}

export interface SelfPanel {
  id: SelfPanelId;
  /** self.reading.<id> */
  technique: string;
  title: string;
  /** one plain sentence */
  lead: string;
  status: 'ok' | 'partial' | 'withheld' | 'failed';
  claims: SelfClaim[];
  /** chapters panel only */
  chapters?: SelfChapter[];
  cached: boolean;
  /** time to make it (0 on a cache hit) */
  ms: number;
  /** the range the whole card is true for (doc 61 §0.2) */
  headerRange: LineRange;
  /** 1 to 3; the card. Empty when status is 'withheld' */
  lines: SelfLine[];
  /** standing line under the title (the body panel's "not medical advice" line) */
  note?: string;
  /** claims the purview removed, for Chart details only */
  vetoed?: Array<{ claimId: string; rule: string; text: string }>;
}

export interface SelfQuestion {
  claimId: string;
  panel: string;
  text: string;
  options: Array<{ value: SelfAnswer; label: string }>;
}

export interface SelfReading {
  /** YYYY-MM-DD */
  asOf: string;
  digestVersion: string;
  clock: SelfClock;
  /** in display order */
  panels: SelfPanel[];
  question: SelfQuestion | null;
  /** staff only; the web never renders these */
  gaps: string[];
  /** whole-chart checks; never shown to the person except as an "Adjusted by" note inside Chart details */
  purview: SelfPurviewEntry[];
  /** staff only; never rendered */
  audit: SelfAudit;
  /** the reading_dossiers row of this build (staff tools only) */
  dossierId: string | null;
  /** "Built 7 Nov 2026, next check 1 Jan 2027"; shown once at the bottom */
  builtLine: string;
}

export type SelfReadingState =
  | { kind: 'ok'; reading: SelfReading; builtAt: string; cached: boolean }
  | { kind: 'preparing' }
  | { kind: 'no_kundli' }
  | { kind: 'unavailable' }
  | { kind: 'error' };

async function call(method: string, path: string, payload?: unknown): Promise<Response> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const body = payload === undefined ? undefined : JSON.stringify(payload);
  const headers = await buildApiHeaders({ token, body, method });
  return fetch(ledgerApiUrl(path), { method, headers, ...(body !== undefined ? { body } : {}) });
}

export async function fetchSelfReading(): Promise<SelfReadingState> {
  let r: Response;
  try {
    r = await call('GET', '/api/self/reading');
  } catch {
    return { kind: 'error' };
  }
  if (r.status === 202) return { kind: 'preparing' };
  if (r.status === 404) {
    const j = (await r.json().catch(() => null)) as { status?: string; error?: string } | null;
    return j?.status === 'no_kundli' || j?.error === 'no_kundli' ? { kind: 'no_kundli' } : { kind: 'unavailable' };
  }
  if (!r.ok) return { kind: 'error' };
  const j = (await r.json().catch(() => null)) as { status?: string; built_at?: string; cached?: boolean; reading?: SelfReading } | null;
  if (!j || j.status !== 'ok' || !j.reading || !Array.isArray(j.reading.panels)) return { kind: 'error' };
  return { kind: 'ok', reading: j.reading, builtAt: j.built_at ?? j.reading.asOf, cached: !!j.cached };
}

/** The answer to the reading's one question; true on 204. */
export async function sendSelfConfirm(claimId: string, answer: SelfAnswer): Promise<boolean> {
  try {
    return (await call('POST', '/api/self/reading/confirm', { claimId, answer })).ok;
  } catch {
    return false;
  }
}

/** Sets the kundli's reading clock; null clears it so the chart's own choice applies. */
export async function setSelfClock(system: string | null): Promise<boolean> {
  try {
    return (await call('PUT', '/api/self/clock', { system })).ok;
  } catch {
    return false;
  }
}
