/**
 * Life-event ledger (timeline P0) REST client.
 * Contract: server `/api/timeline/ledger*` (mounted only when TIMELINE_ENABLED=1; otherwise every route is 404).
 * Auth and hashing match `/api/chat/ask-stream`: see {@link buildApiHeaders}.
 * The ledger stores plain dated facts only; nothing astrological is computed or shown here.
 */
import { buildApiHeaders } from './apiHeaders';

export type DatePrecision = 'day' | 'month' | 'year';

export interface LedgerCategory {
  code: string;
  label: string;
}

export interface LedgerMarker {
  id: string;
  label: string;
  categories: LedgerCategory[];
}

export interface LedgerAttribute {
  key: string;
  label: string;
  /** Fixed choices (e.g. direction). Absent = free text, at most 80 characters. */
  values?: string[];
}

export interface LedgerMeta {
  markers: LedgerMarker[];
  attributes: LedgerAttribute[];
  precisions: DatePrecision[];
  years: number;
  interview: boolean;
}

export interface LifeEvent {
  id: string;
  category: string;
  /** Always `YYYY-MM-DD`; 1st of the month for month precision, 1 January for year precision. */
  date: string;
  date_precision: DatePrecision;
  place: string | null;
  attributes: Record<string, string>;
}

export interface LifeEventInput {
  kundliId?: string;
  category: string;
  /** `YYYY-MM-DD`, `YYYY-MM` or `YYYY` (server normalises to the precision). */
  date: string;
  date_precision: DatePrecision;
  place?: string | null;
  attributes?: Record<string, string>;
}

export interface LedgerProposal {
  proposalId: string;
  category: string;
  date: string;
  date_precision: DatePrecision;
  place: string | null;
  attributes: Record<string, string>;
}

export interface InterviewResult {
  proposals: LedgerProposal[];
  declined?: { reply: string };
}

/** Max interview text length accepted by the server. */
export const INTERVIEW_MAX_CHARS = 2000;
/** Max length of a free-text attribute value. */
export const ATTRIBUTE_MAX_CHARS = 80;

/** Non-2xx response from the ledger API. `field` is set on 400s that point at one input. */
export class LedgerApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  readonly field: string | undefined;
  constructor(status: number, code?: string, field?: string) {
    super(ledgerErrorMessage(status, code));
    this.name = 'LedgerApiError';
    this.status = status;
    this.code = code;
    this.field = field;
  }
}

function ledgerErrorMessage(status: number, code?: string): string {
  if (status === 401) return 'Please sign in again.';
  if (status === 404) return 'Not found.';
  if (code === 'ledger_unavailable') return 'The life-event list is not available yet. Please try again later.';
  if (code === 'interview_unavailable') return 'The interview helper is not available right now. You can still add events with the form.';
  if (status === 503) return 'Service unavailable. Please try again later.';
  if (status === 400) return code ? humaniseCode(code) : 'Please check this value.';
  return code ? humaniseCode(code) : `Request failed (${status})`;
}

/** `bad_date` -> `Bad date.`; plain sentences pass through unchanged. */
export function humaniseCode(code: string): string {
  if (!/^[a-z0-9_]+$/.test(code)) return code;
  const s = code.replace(/_/g, ' ');
  return `${s.charAt(0).toUpperCase()}${s.slice(1)}.`;
}

/** Same base-URL resolution as the chat REST calls (VITE_API_BASE, then GraphQL origin, else same-origin). */
export function ledgerApiUrl(path: string): string {
  const apiBase = import.meta.env.VITE_API_BASE || import.meta.env.VITE_GRAPHQL_BASE;
  if (apiBase) return `${apiBase.replace(/\/+$/, '')}${path}`;
  const ep = import.meta.env.VITE_GRAPHQL_ENDPOINT || '/graphql';
  if (ep.startsWith('http://') || ep.startsWith('https://')) {
    try {
      return `${new URL(ep).origin}${path}`;
    } catch {
      return path;
    }
  }
  return path;
}

function getToken(): string {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  if (!token) throw new LedgerApiError(401);
  return token;
}

async function request<T>(method: string, path: string, payload?: unknown): Promise<T> {
  const token = getToken();
  const body = payload === undefined ? undefined : JSON.stringify(payload);
  const headers = await buildApiHeaders({ token, body, method });
  const res = await fetch(ledgerApiUrl(path), { method, headers, ...(body !== undefined ? { body } : {}) });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: unknown; field?: unknown };
    throw new LedgerApiError(
      res.status,
      typeof j.error === 'string' ? j.error : undefined,
      typeof j.field === 'string' ? j.field : undefined
    );
  }
  return (await res.json()) as T;
}

function withKundli(path: string, kundliId?: string): string {
  return kundliId ? `${path}?kundliId=${encodeURIComponent(kundliId)}` : path;
}

/** Meta, or `null` when the feature is off on the server (404). */
export async function fetchLedgerMeta(): Promise<LedgerMeta | null> {
  try {
    return await request<LedgerMeta>('GET', '/api/timeline/ledger/meta');
  } catch (e) {
    if (e instanceof LedgerApiError && e.status === 404) return null;
    throw e;
  }
}

export async function fetchLedgerEvents(kundliId?: string): Promise<LifeEvent[]> {
  const r = await request<{ kundliId: string; events: LifeEvent[] }>('GET', withKundli('/api/timeline/ledger', kundliId));
  return Array.isArray(r.events) ? r.events : [];
}

export async function createLedgerEvent(input: LifeEventInput): Promise<LifeEvent> {
  const r = await request<{ event: LifeEvent }>('POST', '/api/timeline/ledger', input);
  return r.event;
}

export async function updateLedgerEvent(id: string, input: Partial<LifeEventInput>): Promise<LifeEvent> {
  const r = await request<{ event: LifeEvent }>('PATCH', `/api/timeline/ledger/${encodeURIComponent(id)}`, input);
  return r.event;
}

export async function deleteLedgerEvent(id: string): Promise<void> {
  await request<{ ok: true }>('DELETE', `/api/timeline/ledger/${encodeURIComponent(id)}`);
}

export async function runLedgerInterview(text: string, year?: number, kundliId?: string): Promise<InterviewResult> {
  const r = await request<InterviewResult>('POST', '/api/timeline/ledger/interview', {
    text,
    ...(year ? { year } : {}),
    ...(kundliId ? { kundliId } : {}),
  });
  return { proposals: Array.isArray(r.proposals) ? r.proposals : [], ...(r.declined ? { declined: r.declined } : {}) };
}
