/**
 * Life reading dashboard REST client (server docs/reading-engine/54 §4; doc 34 Part 1). Mounted only when
 * LIFE_READING_ENABLED=1 on the server: 404 means the feature is off, 202 means the chart is still being prepared.
 */
import { buildApiHeaders } from './apiHeaders';
import { ledgerApiUrl } from './ledgerApi';

export type LifeAreaId = 'self' | 'money' | 'work' | 'home' | 'marriage' | 'children' | 'parents' | 'siblings' | 'legal' | 'health' | 'travel' | 'learning' | 'dharma';
export type LifeGrade = 'strong' | 'moderate' | 'weak';
export type LifeCharterRole = 'anchor' | 'growth' | 'guarded';
export type LifeAntardashaTone = 'breakthrough' | 'build' | 'steady_work' | 'careful';

export interface LifeAreaCharter {
  id: LifeAreaId;
  label: string;
  role: LifeCharterRole;
  verdict: 'promised' | 'partial' | 'not_written';
  theme: string;
  promise_note: string;
  peak_from: string | null;
  peak_to: string | null;
  watch_from: string | null;
  watch_to: string | null;
  guidance: string;
  grade: LifeGrade;
  basis: string;
  evidence: {
    houses: number[];
    vargas: string[];
    planets: string[];
    yogas: string[];
  };
}

export interface LifeAntardashaAreaNote {
  id: LifeAreaId;
  label: string;
  verdict: 'promised' | 'partial' | 'not_written';
  summary: string;
  timing: string;
  action: string;
}

export interface LifeAntardashaRow {
  from: string;
  to: string;
  is_current: boolean;
  tone: LifeAntardashaTone;
  headline: string;
  areas: LifeAntardashaAreaNote[];
  grade: LifeGrade;
  basis: string;
  evidence: {
    md: string;
    ad: string;
    house_from_md: number | null;
    fruition_class: string | null;
    links: string[];
    systems: string[];
    annual_years: string[];
    transit_houses: number[];
  };
}

export interface LifeMahadashaBridge {
  from: string;
  to: string;
  remaining_years: number;
  summary: string;
  antardashas: LifeAntardashaRow[];
}

export interface LifeMahadashaCharter {
  from: string;
  to: string;
  remaining_years: number;
  total_years: number;
  is_current: boolean;
  headline: string;
  charter_summary: string;
  area_charters: LifeAreaCharter[];
  antardashas: LifeAntardashaRow[];
  bridge: LifeMahadashaBridge | null;
  evidence: {
    md: string;
    own_houses: number[];
    placed_house: number | null;
    dispositor: string | null;
    star_lord: string | null;
    avastha: string | null;
  };
}

export interface LifeWindow {
  from: string;
  to: string;
  md: string | null;
  ad: string | null;
  systems: string[];
  grade: LifeGrade;
  basis: string;
}

export interface LifeAreaRow {
  id: LifeAreaId;
  label: string;
  verdict: 'promised' | 'partial' | 'not_written';
  score: number;
  issue: string;
  cause: { planets: string[]; dashas: string[]; text: string };
  improves: LifeWindow[];
  solution: string[];
  grade: LifeGrade;
  basis: string;
}

export interface LifeReading {
  built_at: string;
  cached: boolean;
  rule_now: string | null;
  areas: LifeAreaRow[];
  charter?: LifeMahadashaCharter | null;
}

export type LifeReadingState =
  | { kind: 'ok'; reading: LifeReading }
  | { kind: 'preparing' }
  | { kind: 'no_kundli' }
  /** the feature is off on the server (404) */
  | { kind: 'unavailable' };

export class LifeReadingError extends Error {
  constructor(public status: number) {
    super(`life reading failed (${status})`);
  }
}

export async function fetchLifeReading(): Promise<LifeReadingState> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const headers = await buildApiHeaders({ token, method: 'GET' });
  const r = await fetch(ledgerApiUrl('/api/life-reading'), { method: 'GET', headers });
  if (r.status === 404) return { kind: 'unavailable' };
  if (r.status === 202) return { kind: 'preparing' };
  if (!r.ok) throw new LifeReadingError(r.status);
  const j = (await r.json()) as { status: string } & Partial<LifeReading>;
  if (j.status === 'no_kundli') return { kind: 'no_kundli' };
  if (j.status === 'preparing') return { kind: 'preparing' };
  if (j.status !== 'ok' || !Array.isArray(j.areas)) throw new LifeReadingError(500);
  return {
    kind: 'ok',
    reading: {
      built_at: j.built_at ?? '',
      cached: !!j.cached,
      rule_now: j.rule_now ?? null,
      areas: j.areas,
      charter: j.charter ?? null,
    },
  };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "7 Feb 2027" */
export function lifeDate(iso: string): string {
  return `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
}
