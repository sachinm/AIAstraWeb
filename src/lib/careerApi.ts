/**
 * Career map REST client (server docs/reading-engine/42 §B.5, Phase 1). Mounted only when AREA_ENABLED=1 on the
 * server; 404 means no chart yet or the feature is off, 202 means the chart is still being prepared.
 */
import { announceUsage } from './planUsage';
import { buildApiHeaders } from './apiHeaders';
import type { SelfCharacterArc, SelfPersonalityAndJoy } from './areaApi';
import { ledgerApiUrl } from './ledgerApi';

export type Tone = 'demanding' | 'easing' | 'steady' | 'closing' | 'open';
export type WorkStatus = 'yes' | 'between_jobs' | 'own_business' | 'studying';
export type SecurityGrade = 'clear_protected' | 'clear' | 'watch' | 'risk' | 'high_risk';

export interface SubareaWindow {
  subarea: string;
  side: 'support' | 'test';
  from: string;
  to: string;
  peakMonth: string;
  band: 'possible' | 'moderate' | 'high';
  score: number;
  families: string[];
  drivers: string[];
  security?: SecurityGrade;
}

export interface CareerMap {
  asOf: string;
  month: string;
  present: {
    tone: Tone;
    confidence: 'confirmed' | 'likely' | 'split';
    votes: Array<{ family: string; label: string; vote: 'support' | 'test' | 'neutral'; planet: string | null }>;
    available: number;
    agree: number;
    ease_date: string | null;
    window_end: string | null;
    next_window_start: string | null;
    security: SecurityGrade;
  };
  ahead: SubareaWindow[];
  horizons: Array<{ months: 1 | 3 | 6 | 12; best: SubareaWindow | null; hardest: SubareaWindow | null; quiet: boolean }>;
  security: Array<{ month: string; grade: SecurityGrade }>;
  back: Array<{ month: string; side: 'support' | 'test'; band: string; label: string }>;
  notes: string[];
  characterArc?: SelfCharacterArc;
  vocationBlueprint?: SelfPersonalityAndJoy;
}

export type CareerState =
  | { kind: 'ok'; map: CareerMap; work: WorkStatus | null; checks: Record<string, string>; madeAt?: string | null; validUntil?: string | null }
  | { kind: 'not_ready' }
  | { kind: 'unavailable' };

const careerSessionCache = new WeakMap<object, Map<string, Extract<CareerState, { kind: 'ok' }>>>();

function careerCacheMap(): Map<string, Extract<CareerState, { kind: 'ok' }>> | null {
  if (typeof globalThis.fetch !== 'function') return null;
  let m = careerSessionCache.get(globalThis.fetch);
  if (!m) {
    m = new Map();
    careerSessionCache.set(globalThis.fetch, m);
  }
  return m;
}

export function getCachedCareer(): Extract<CareerState, { kind: 'ok' }> | null {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') ?? '' : '';
  return careerCacheMap()?.get(token) ?? null;
}

async function call(method: string, path: string, payload?: unknown): Promise<Response> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const body = payload === undefined ? undefined : JSON.stringify(payload);
  const headers = await buildApiHeaders({ token, body, method });
  return fetch(ledgerApiUrl(path), { method, headers, ...(body !== undefined ? { body } : {}) });
}

export async function fetchCareer(): Promise<CareerState> {
  const r = await call('GET', '/api/area/career');
  if (r.status === 202) return { kind: 'not_ready' };
  if (!r.ok) return { kind: 'unavailable' };
  const j = (await r.json()) as { map: CareerMap; work: WorkStatus | null; checks?: Record<string, string>; made_at?: string; valid_until?: string | null; usage?: unknown };
  announceUsage(j.usage);
  const result: Extract<CareerState, { kind: 'ok' }> = { kind: 'ok', map: j.map, work: j.work, checks: j.checks ?? {}, madeAt: j.made_at ?? null, validUntil: j.valid_until ?? null };
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') ?? '' : '';
  careerCacheMap()?.set(token, result);
  return result;
}

export async function setWorkStatus(value: WorkStatus): Promise<boolean> {
  return (await call('PUT', '/api/profile/work-status', { value })).ok;
}

export async function sendCheck(month: string, side: 'support' | 'test', answer: 'yes' | 'partly' | 'no' | 'skip'): Promise<boolean> {
  return (await call('POST', '/api/area/career/checks', { month, side, answer })).ok;
}

/** "10 Dec 2026" */
export function longDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' });
}

/** "Oct 2025" */
export function monthName(month: string): string {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'UTC', month: 'short', year: 'numeric' });
}
