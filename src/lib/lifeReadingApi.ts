/**
 * Life reading dashboard REST client (server docs/reading-engine/54 §4; doc 34 Part 1). Mounted only when
 * LIFE_READING_ENABLED=1 on the server: 404 means the feature is off, 202 means the chart is still being prepared.
 */
import { buildApiHeaders } from './apiHeaders';
import { ledgerApiUrl } from './ledgerApi';

export type LifeAreaId = 'self' | 'money' | 'work' | 'home' | 'marriage' | 'children' | 'parents' | 'siblings' | 'legal' | 'health' | 'travel' | 'learning' | 'dharma';
export type LifeGrade = 'strong' | 'moderate' | 'weak';

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
  return { kind: 'ok', reading: { built_at: j.built_at ?? '', cached: !!j.cached, rule_now: j.rule_now ?? null, areas: j.areas } };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "7 Feb 2027" */
export function lifeDate(iso: string): string {
  return `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
}
