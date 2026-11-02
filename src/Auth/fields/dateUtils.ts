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

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** `1990-04-05` as `5 April 1990`, so a person can see which month was understood. */
export function longDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTH_NAMES[m - 1]} ${y}`;
}

/**
 * The same typed date with day and month swapped, when both readings are real and differ. 04/05/1990 may be a US
 * person's April 5; the field reads it as 4 May, so it offers the other reading rather than guessing from the country.
 */
export function swappedDate(text: string, today = todayISO()): string | null {
  const m = /^(\d{1,2})\s*[/.\-\s]\s*(\d{1,2})\s*[/.\-\s]\s*(\d{4})$/.exec(text.trim());
  if (!m || m[1] === m[2] || Number(m[1]) === Number(m[2])) return null;
  const [mo, d, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (!isRealDate(y, mo, d)) return null;
  const iso = isoOf(y, mo, d);
  return iso > today ? null : iso;
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
