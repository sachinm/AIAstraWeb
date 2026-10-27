export const MIN_YEAR = 1900;

export function pad(n: number, w = 2): string {
  return String(n).padStart(w, '0');
}

export function isoOf(y: number, m: number, d: number): string {
  return `${pad(y, 4)}-${pad(m)}-${pad(d)}`;
}

export function todayISO(now = new Date()): string {
  return isoOf(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

/** True when y-m-d is a real calendar date. */
export function isRealDate(y: number, m: number, d: number): boolean {
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

/**
 * Parses what a person types: DD/MM/YYYY (also with - . or spaces) or YYYY-MM-DD.
 * Returns the ISO date, or null when it is not a complete real date.
 */
export function parseTypedDate(text: string): string | null {
  const t = text.trim();
  let m = /^(\d{1,2})\s*[/.\-\s]\s*(\d{1,2})\s*[/.\-\s]\s*(\d{4})$/.exec(t);
  if (m) {
    const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
    return isRealDate(y, mo, d) ? isoOf(y, mo, d) : null;
  }
  m = /^(\d{4})\s*[/.\-\s]\s*(\d{1,2})\s*[/.\-\s]\s*(\d{1,2})$/.exec(t);
  if (m) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    return isRealDate(y, mo, d) ? isoOf(y, mo, d) : null;
  }
  return null;
}

export function isoToTyped(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

/** Error text for a typed date, or '' when it is valid (past, on or after 1 Jan 1900). */
export function dateError(text: string, today = todayISO()): string {
  if (!text.trim()) return 'Enter your date of birth.';
  const iso = parseTypedDate(text);
  if (!iso) return 'Enter a real date as DD/MM/YYYY, for example 27/04/1990.';
  if (iso > today) return 'Date of birth cannot be in the future.';
  if (Number(iso.slice(0, 4)) < MIN_YEAR) return `Enter a year ${MIN_YEAR} or later.`;
  return '';
}
