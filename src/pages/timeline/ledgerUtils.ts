/**
 * Pure helpers for the life-event ledger page: date handling by precision and year-strip placement.
 * No astrology and no evaluation here; events are plain dated facts.
 */
import type { DatePrecision, LedgerMeta, LifeEvent } from '../../lib/ledgerApi';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export interface DateParts {
  year: number;
  month?: number; // 1..12
  day?: number; // 1..31
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Parses `YYYY`, `YYYY-MM` or `YYYY-MM-DD` (as typed or as stored). Returns null when not a real date. */
export function parseDateParts(value: string | null | undefined): DateParts | null {
  const m = /^\s*(\d{4})(?:-(\d{1,2})(?:-(\d{1,2}))?)?\s*$/.exec(value ?? '');
  if (!m) return null;
  const year = Number(m[1]);
  if (year < 1000) return null;
  const parts: DateParts = { year };
  if (m[2] !== undefined) {
    const month = Number(m[2]);
    if (month < 1 || month > 12) return null;
    parts.month = month;
    if (m[3] !== undefined) {
      const day = Number(m[3]);
      if (day < 1 || day > daysInMonth(year, month)) return null;
      parts.day = day;
    }
  }
  return parts;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * The value an `<input>` for this precision shows: `YYYY-MM-DD` (date), `YYYY-MM` (month), `YYYY` (number).
 * Missing parts default to January / the 1st; extra parts are dropped.
 */
export function toInputValue(value: string | null | undefined, precision: DatePrecision): string {
  const p = parseDateParts(value);
  if (!p) return '';
  if (precision === 'year') return String(p.year);
  if (precision === 'month') return `${p.year}-${pad2(p.month ?? 1)}`;
  return `${p.year}-${pad2(p.month ?? 1)}-${pad2(p.day ?? 1)}`;
}

/**
 * The `date` sent to the API for this precision, or null when the input is incomplete/invalid.
 * Day needs a full date; month needs year+month; year needs a year.
 */
export function normaliseDate(value: string, precision: DatePrecision): string | null {
  const p = parseDateParts(value);
  if (!p) return null;
  if (precision === 'year') return String(p.year);
  if (p.month === undefined) return null;
  if (precision === 'month') return `${p.year}-${pad2(p.month)}`;
  if (p.day === undefined) return null;
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

/** True when the normalised date lies after `today` (compared at the precision's granularity). */
export function isFutureDate(value: string, precision: DatePrecision, today: Date = new Date()): boolean {
  const p = parseDateParts(value);
  if (!p) return false;
  const ty = today.getFullYear();
  const tm = today.getMonth() + 1;
  const td = today.getDate();
  if (p.year !== ty || precision === 'year') return p.year > ty;
  const m = p.month ?? 1;
  if (m !== tm || precision === 'month') return m > tm;
  return (p.day ?? 1) > td;
}

/** Human date at the event's precision: `2014`, `March 2014`, `12 March 2014`. */
export function formatEventDate(date: string, precision: DatePrecision): string {
  const p = parseDateParts(date);
  if (!p) return date;
  if (precision === 'year' || p.month === undefined) return String(p.year);
  if (precision === 'month' || p.day === undefined) return `${MONTHS_LONG[p.month - 1]} ${p.year}`;
  return `${p.day} ${MONTHS_LONG[p.month - 1]} ${p.year}`;
}

export function monthShort(month: number): string {
  return MONTHS[month - 1] ?? '';
}

/** Years shown on the strip: the current year and the `count - 1` before it, oldest first. */
export function stripYears(today: Date = new Date(), count = 18): number[] {
  const n = Math.max(1, Math.floor(count));
  const last = today.getFullYear();
  return Array.from({ length: n }, (_, i) => last - n + 1 + i);
}

export interface StripPlacement {
  event: LifeEvent;
  year: number;
  /** 'year' = whole-year mark; 'point' = placed at a month within the year. */
  kind: 'year' | 'point';
  /** 1..12 for point events. */
  month?: number;
  /** Position within the year, 0 (1 Jan) .. <1 (end of Dec). 0 for whole-year marks. */
  offset: number;
}

/** Where one event sits on the strip, or null when its date cannot be read. */
export function placeEvent(event: LifeEvent): StripPlacement | null {
  const p = parseDateParts(event.date);
  if (!p) return null;
  if (event.date_precision === 'year' || p.month === undefined) {
    return { event, year: p.year, kind: 'year', offset: 0 };
  }
  const month = p.month;
  let offset = (month - 1) / 12;
  if (event.date_precision === 'day' && p.day !== undefined) {
    offset += (p.day - 1) / daysInMonth(p.year, month) / 12;
  }
  return { event, year: p.year, kind: 'point', month, offset };
}

export interface StripColumn {
  year: number;
  /** Whole-year marks, in list order. */
  wholeYear: StripPlacement[];
  /** Month/day events, sorted by position within the year. */
  points: StripPlacement[];
}

/** Buckets events into one column per strip year. Events outside the years are counted, not placed. */
export function buildYearStrip(events: LifeEvent[], years: number[]): { columns: StripColumn[]; outside: number } {
  const byYear = new Map<number, StripColumn>(years.map((y) => [y, { year: y, wholeYear: [], points: [] }]));
  let outside = 0;
  for (const ev of events) {
    const pl = placeEvent(ev);
    const col = pl ? byYear.get(pl.year) : undefined;
    if (!pl || !col) {
      outside += 1;
      continue;
    }
    if (pl.kind === 'year') col.wholeYear.push(pl);
    else col.points.push(pl);
  }
  for (const col of byYear.values()) col.points.sort((a, b) => a.offset - b.offset);
  return { columns: years.map((y) => byYear.get(y)!), outside };
}

/** `code -> label` for every category in meta. */
export function categoryLabels(meta: LedgerMeta | null): Map<string, string> {
  const m = new Map<string, string>();
  for (const marker of meta?.markers ?? []) {
    for (const c of marker.categories) m.set(c.code, c.label);
  }
  return m;
}

/** Category label, falling back to the code with underscores as spaces. */
export function categoryLabel(labels: Map<string, string>, code: string): string {
  return labels.get(code) ?? code.replace(/_/g, ' ');
}

/** Drops empty values and trims the rest; used before sending attributes. */
export function cleanAttributes(attrs: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(attrs)) {
    const t = (v ?? '').trim();
    if (t) out[k] = t;
  }
  return out;
}

/**
 * Maps a server 400 `field` to a form field key: `category`, `date`, `place`, or `attr:<key>`.
 * Accepts `date_precision` as date, and `attributes.<key>`, `attributes[<key>]` or a bare attribute key.
 */
export function formFieldForServerField(field: string | undefined, attributeKeys: string[]): string | null {
  if (!field) return null;
  if (field === 'category' || field === 'place') return field;
  if (field === 'date' || field === 'date_precision') return 'date';
  const m = /^attributes(?:\.|\[)([^\]]+)\]?$/.exec(field);
  if (m) return `attr:${m[1]}`;
  if (attributeKeys.includes(field)) return `attr:${field}`;
  if (field === 'attributes') return 'attributes';
  return null;
}
