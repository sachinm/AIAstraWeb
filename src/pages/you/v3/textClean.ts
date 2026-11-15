/**
 * Pure text and ISO-date cleaning helpers shared by card faces, Chart details, and toolbar tools.
 * Kept dependency-free so `CardParts`, `cardModel`, and `toolVetting` can all normalize server text without cycles.
 */

const ISO_DAY_RE = /^(\d{4})-(\d{2})-(\d{2})/;
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/**
 * Strips empty parenthetical artifacts left behind when chart terms were redacted upstream:
 * "()", "(,)", "(, ,)", "(Mars ())" -> "(Mars)", "(Amatyakaraka,)" -> "(Amatyakaraka)".
 */
export function scrubEmptyRefs(text: string): string {
  let current = text;
  for (let i = 0; i < 4; i++) {
    const next = current
      .replace(/\(\s*(?:[,;:\-–]\s*)*\)/g, '')
      .replace(/\(\s*[,;]\s*/g, '(')
      .replace(/\s*[,;]\s*\)/g, ')')
      .replace(/\(\s+/g, '(')
      .replace(/\s+\)/g, ')');
    if (next === current) break;
    current = next;
  }
  return current
    .replace(/[ \t]+([,.;:!?])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/** Formats an ISO date or timestamp ("2026-11-09" / "2026-11-09T08:00:00Z") as "9 Nov 2026". */
export function formatDisplayDate(value: string): string {
  const m = ISO_DAY_RE.exec(value.trim());
  if (!m) return value.trim();
  const year = Number(m[1]);
  const monthIdx = Number(m[2]) - 1;
  const day = Number(m[3]);
  const mon = MONTHS_SHORT[monthIdx];
  if (!mon || day < 1 || day > 31) return value.trim();
  return `${day} ${mon} ${year}`;
}
