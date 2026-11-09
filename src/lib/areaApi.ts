/**
 * The You and Love boards' REST client (server docs/reading-engine/54 §3). Mounted only when AREA_ENABLED=1 on the
 * server: 200 is a board, 202 means the chart is still being prepared, 404 with `no_kundli` means no birth chart yet,
 * any other 404 means the board is off.
 */
import { announceUsage } from './planUsage';
import { buildApiHeaders } from './apiHeaders';
import { ledgerApiUrl } from './ledgerApi';
import { saveFacts } from './profileApi';
import type { Tone } from './careerApi';

export type AreaId = 'self' | 'love';
export type AreaSide = 'support' | 'test';
export type AreaGrade = 'strong' | 'moderate' | 'weak';
export type FamilyVoteValue = 'support' | 'test' | 'neutral';

export interface AreaWindow {
  subarea: string;
  label: string;
  from: string;
  to: string;
  side: AreaSide;
  grade: AreaGrade;
  systems: string[];
  dateLabel?: string;
  reading?: string;
  natalPromise?: string;
  periodCharter?: string;
  aspectsAndPlacements?: string[];
  techniqueId?: string;
}

export interface AreaSupportFinding {
  text: string;
  evidence: string[];
  subCategory?: string;
  from?: string;
  to?: string;
  dateLabel?: string;
  reading?: string;
  natalPromise?: string;
  periodCharter?: string;
  aspectsAndPlacements?: string[];
  techniqueId?: string;
}

export interface AreaPressureFinding {
  text: string;
  until: string | null;
  evidence: string[];
  subCategory?: string;
  from?: string;
  to?: string;
  dateLabel?: string;
  reading?: string;
  natalPromise?: string;
  periodCharter?: string;
  aspectsAndPlacements?: string[];
  techniqueId?: string;
}

export interface SelfCharacterArcStage {
  stage: 'past_10y' | 'now' | 'next_10y';
  label: string;
  windowLabel: string;
  headline: string;
  summary: string;
  anchorTrait: string;
  evidence: string[];
}

export interface SelfCharacterArc {
  headline: string;
  pastDecade: SelfCharacterArcStage;
  presentNow: SelfCharacterArcStage;
  nextDecade: SelfCharacterArcStage;
}

export interface SelfPersonalityAndJoy {
  headline: string;
  personalitySummary: string;
  emotionalMindStyle: string;
  intellectualWitStyle: string;
  whatFeelsGood: Array<{ title: string; whyItFits: string; evidence: string[] }>;
  rechargeRule: string;
  evidence: string[];
}

export interface AreaBoard {
  asOf: string;
  tone: {
    tone: Tone;
    confidence: 'confirmed' | 'likely' | 'split';
    families: Array<{ family: string; vote: FamilyVoteValue }>;
    /** the day it changes; null when not inside the range */
    date: string | null;
  };
  supports: AreaSupportFinding[];
  pressures: AreaPressureFinding[];
  ahead: AreaWindow[];
  year: { year: number; note: string } | null;
  back: Array<{ month: string; side: AreaSide; label: string }>;
  notes: string[];
  characterArc?: SelfCharacterArc;
  personalityAndJoy?: SelfPersonalityAndJoy;
}

export type AreaState =
  | { kind: 'ok'; board: AreaBoard; focus: string | null; ask: boolean; checks: Record<string, string>; builtAt: string; madeAt?: string | null; validUntil?: string | null }
  | { kind: 'preparing' }
  | { kind: 'no_kundli' }
  | { kind: 'unavailable' }
  | { kind: 'error' };

const areaSessionCache = new WeakMap<object, Map<string, Extract<AreaState, { kind: 'ok' }>>>();

function cacheMapForCurrentFetch(): Map<string, Extract<AreaState, { kind: 'ok' }>> | null {
  if (typeof globalThis.fetch !== 'function') return null;
  let m = areaSessionCache.get(globalThis.fetch);
  if (!m) {
    m = new Map();
    areaSessionCache.set(globalThis.fetch, m);
  }
  return m;
}

export function getCachedArea(area: AreaId): Extract<AreaState, { kind: 'ok' }> | null {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') ?? '' : '';
  return cacheMapForCurrentFetch()?.get(`${token}:${area}`) ?? null;
}

export function invalidateCachedArea(area?: AreaId): void {
  const m = cacheMapForCurrentFetch();
  if (!m) return;
  if (!area) {
    m.clear();
    return;
  }
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') ?? '' : '';
  m.delete(`${token}:${area}`);
}

async function call(method: string, path: string, payload?: unknown): Promise<Response> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const body = payload === undefined ? undefined : JSON.stringify(payload);
  const headers = await buildApiHeaders({ token, body, method });
  return fetch(ledgerApiUrl(path), { method, headers, ...(body !== undefined ? { body } : {}) });
}

export async function fetchArea(area: AreaId): Promise<AreaState> {
  let r: Response;
  try {
    r = await call('GET', `/api/area/${area}`);
  } catch {
    return { kind: 'error' };
  }
  if (r.status === 202) return { kind: 'preparing' };
  if (r.status === 404) {
    const j = (await r.json().catch(() => null)) as { status?: string; error?: string } | null;
    return j?.status === 'no_kundli' || j?.error === 'no_kundli' ? { kind: 'no_kundli' } : { kind: 'unavailable' };
  }
  if (!r.ok) return { kind: 'error' };
  const j = (await r.json().catch(() => null)) as { status?: string; board?: AreaBoard; focus?: string | null; ask?: boolean; checks?: Record<string, string>; built_at?: string; made_at?: string; valid_until?: string | null; usage?: unknown } | null;
  if (!j || j.status !== 'ok' || !j.board) return { kind: 'error' };
  announceUsage(j.usage);
  const result: Extract<AreaState, { kind: 'ok' }> = {
    kind: 'ok',
    board: j.board,
    focus: j.focus ?? null,
    ask: !!j.ask,
    checks: j.checks ?? {},
    builtAt: j.built_at ?? j.board.asOf,
    madeAt: j.made_at ?? null,
    validUntil: j.valid_until ?? null,
  };
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') ?? '' : '';
  cacheMapForCurrentFetch()?.set(`${token}:${area}`, result);
  return result;
}

export async function sendAreaCheck(area: AreaId, month: string, side: AreaSide, answer: 'yes' | 'partly' | 'no' | 'skip'): Promise<boolean> {
  return (await call('POST', `/api/area/${area}/checks`, { month, side, answer })).ok;
}

/** The one-tap answer to the board's question (doc 48): `self.focus` or `love.status`; null = "I'd rather not say". */
export function saveAreaFact(key: 'self.focus' | 'love.status', value: string | null): Promise<boolean> {
  return saveFacts({ [key]: value });
}
