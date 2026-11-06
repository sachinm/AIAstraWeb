/**
 * Lucky times REST client (server docs/reading-engine/49 §4.2). Routes are mounted only when LUCKY_ENABLED=1 on the
 * server; a 404 on setup means the feature is off. Times are minutes from the local midnight of each day at the
 * person's place; nothing astrological is computed here.
 */
import { buildApiHeaders } from './apiHeaders';
import { ledgerApiUrl } from './ledgerApi';

export class LuckyApiError extends Error {
  constructor(public status: number, public code?: string) {
    super(code ?? `lucky ${status}`);
  }
}

export type AskKind = 'who' | 'job' | 'relationship';

export interface ScenarioEntry {
  id: string;
  label: string;
  ask: AskKind | null;
}

export interface ScenarioGroup {
  area: string;
  label: string;
  scenarios: ScenarioEntry[];
}

export interface Pick {
  scenario: string;
  shown: boolean;
  answers: Record<string, string>;
}

export interface LuckySetup {
  place: string | null;
  places: Array<{ key: string; name: string }>;
  scenarios: ScenarioGroup[];
  picks: Pick[];
}

/** Whose a reason is (server docs/reading-engine/54 §6): the same for everyone at the place, or from this person's chart. */
export type ReasonScope = 'general' | 'personal';

export interface LuckyReason {
  key: string;
  scope: ReasonScope;
}

export interface LuckyWindow {
  from: number;
  to: number;
  score: number;
  /** each reason with its scope; an older server sent plain keys here */
  reasons: Array<LuckyReason | string>;
  /** the same keys as plain strings */
  reasonKeys?: string[];
}

/** The day's yoga or karana as the server names it (classical spelling) and the hour it ends (from local midnight). */
export interface DayLimb {
  name: string;
  endHour: number | null;
}

const scopeOfKey = (key: string): ReasonScope => (key.startsWith('personal:') ? 'personal' : 'general');

/** A window's reasons with scopes, whichever shape the server sent. */
export function windowReasons(w: { reasons?: LuckyWindow['reasons']; reasonKeys?: string[] }): LuckyReason[] {
  const raw = Array.isArray(w.reasons) && w.reasons.length ? w.reasons : (w.reasonKeys ?? []);
  return raw
    .map((r) => (typeof r === 'string' ? { key: r, scope: scopeOfKey(r) } : r && typeof r.key === 'string' ? { key: r.key, scope: r.scope === 'personal' ? 'personal' : 'general' } : null))
    .filter((r): r is LuckyReason => r !== null);
}

/** A window's plain keys, whichever shape the server sent. */
export const windowKeys = (w: { reasons?: LuckyWindow['reasons']; reasonKeys?: string[] }): string[] => windowReasons(w).map((r) => r.key);

export interface LuckyDay {
  date: string;
  weekday: string | null;
  sunrise: number | null;
  sunset: number | null;
  personal: { tara_good: boolean | null; moon_good: boolean | null } | null;
  avoid: Array<{ kind: string; from: number; to: number }>;
  good: Array<{ kind: 'abhijit' | 'amrita' | 'brahma'; from: number; to: number }>;
  /** the day's yoga and karana (named only in the Why sheet); absent from an older server */
  yoga?: DayLimb | null;
  karana?: DayLimb | null;
  layers: Record<string, { verdict: 'good' | 'none' | 'avoid_day'; windows: LuckyWindow[]; dayReasons: string[] }>;
}

export type NowState =
  | { kind: 'avoid'; band: string; until: number }
  | { kind: 'good'; what: 'abhijit' | 'amrita' | 'brahma'; until: number }
  | { kind: 'neutral'; next?: { what: string; from: number } };

export interface LuckyRange {
  status: 'ok';
  place: string;
  today: string;
  nowMin: number;
  from: string;
  to: string;
  days: LuckyDay[];
  missing: string[];
  now: NowState | null;
}

function token(): string {
  const t = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  if (!t) throw new LuckyApiError(401);
  return t;
}

async function request<T>(method: string, path: string, payload?: unknown): Promise<T> {
  const body = payload === undefined ? undefined : JSON.stringify(payload);
  const headers = await buildApiHeaders({ token: token(), body, method });
  const res = await fetch(ledgerApiUrl(path), { method, headers, ...(body !== undefined ? { body } : {}) });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: unknown };
    throw new LuckyApiError(res.status, typeof j.error === 'string' ? j.error : undefined);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** The setup, or `null` when Lucky times is off on the server. */
export async function fetchLuckySetup(): Promise<LuckySetup | null> {
  try {
    return await request<LuckySetup>('GET', '/api/lucky/setup');
  } catch (e) {
    if (e instanceof LuckyApiError && e.status === 404) return null;
    throw e;
  }
}

export const setLuckyPlace = (place: string) => request<void>('PUT', '/api/lucky/place', { place });
export const addLuckyPick = (scenario: string) => request<{ pick: Pick }>('POST', '/api/lucky/picks', { scenario });
export const patchLuckyPick = (scenario: string, patch: { shown?: boolean; answers?: Record<string, string> }) =>
  request<{ pick: Pick }>('PATCH', `/api/lucky/picks/${encodeURIComponent(scenario)}`, patch);
export const removeLuckyPick = (scenario: string) => request<void>('DELETE', `/api/lucky/picks/${encodeURIComponent(scenario)}`);
export const fetchLuckyRange = (from?: string, to?: string) => {
  const q = new URLSearchParams();
  if (from) q.set('from', from);
  if (to) q.set('to', to);
  const s = q.toString();
  return request<LuckyRange>('GET', `/api/lucky/range${s ? `?${s}` : ''}`);
};

/** "HH:MM" for minutes from local midnight (24 h; past midnight shown as the next day's clock). */
export function clock(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
