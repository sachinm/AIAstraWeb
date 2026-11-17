/**
 * What a Self v3 card says for each period (doc 75, "The foundation card"). Nothing astrological: it joins what the
 * server sent (the rail, the spans, the standing lines, the key dates) and does date arithmetic on the stored periods.
 *
 * The rules: periods are ordered by start date; periods that end on the same day are one period (the one with words of
 * its own is kept); a period is offered as a chip only when it has words of its own; a card with one such period shows
 * no chips. Picking a chip changes the headline and the text. Past periods are greyed.
 */
import type { LadderSteps } from '../../../lib/selfV2Api';
import type { KeyDate, RailItem, SelfV3CardView, SpanReading, SpanTone } from '../../../lib/selfV3Api';
import { cardHeadline, cardLadder, cardPatterns, spanToneShown } from './CardParts';

export interface PeriodView {
  /** the rail index this period came from (stable id for the session) */
  index: number;
  item: RailItem;
  span: SpanReading | null;
  /** the chip's words: "Heavy stretch · to 3 Jun 2027" */
  label: string;
  /** the headline shown while this period is picked */
  headline: string | null;
  /** the period's own paragraphs; null when none is written */
  text: string[] | null;
  /** the one best step, or null */
  step: string | null;
  /** the one thing to avoid, or null */
  avoid: string | null;
  tone: SpanTone | null;
  current: boolean;
  /** ended before today */
  past: boolean;
  /** has words of its own: it is offered as a chip */
  own: boolean;
}

/** what every face is handed */
export interface FaceProps {
  card: SelfV3CardView;
  periods: PeriodView[];
  /** the period on screen, or null when the card has none of its own */
  period: PeriodView | null;
  standing: string[];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** today as YYYY-MM-DD in the person's own calendar */
export function todayIso(now: Date = new Date()): string {
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${m}-${d}`;
}

/** "3 Jun 2027"; the year is left off when it is this year and `short` */
export function dayWords(iso: string, opts: { short?: boolean; today?: string } = {}): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const year = opts.short && opts.today && opts.today.slice(0, 4) === String(y) ? '' : ` ${y}`;
  return `${d ?? 1} ${MONTHS[(m ?? 1) - 1]}${year}`;
}

/** the span a rail bar opens on a v3 card: by id, else by position */
export function spanFor(card: SelfV3CardView, i: number): SpanReading | null {
  const spans = card.v3?.spans ?? [];
  const id = (card.rail ?? [])[i]?.span;
  return (id ? spans.find((s) => s.span === id) : null) ?? spans[i] ?? null;
}

/** the rail bar that holds today: the server's mark, else by dates */
export function currentRail(rail: RailItem[] = [], today: string = todayIso()): number {
  const i = rail.findIndex((r) => r.current);
  if (i >= 0) return i;
  const j = rail.findIndex((r) => r.from <= today && today < r.to);
  return j < 0 ? 0 : j;
}

const TONE_NAME: Record<SpanTone, string> = { heavy: 'Heavy stretch', mixed: 'Mixed stretch', light: 'Lighter stretch' };

/** the plain name of a period: the server's, else the note, else the tone's */
function nameOf(item: RailItem, tone: SpanTone | null): string | null {
  return item.name?.trim() || item.note?.trim() || (tone ? TONE_NAME[tone] : null);
}

/** the dates in words: "to 3 Jun 2027" for the one running now, "from 1 Jan 2027" ahead, "5 May – 12 Dec 2026" behind */
export function datesWords(item: RailItem, today: string): string {
  if (item.to < today) return `${dayWords(item.from)} – ${dayWords(item.to)}`;
  if (item.from <= today) return `to ${dayWords(item.to)}`;
  return `from ${dayWords(item.from)}`;
}

function firstSentenceOf(text: string): string {
  const m = text.match(/^.*?[.!?](?=\s|$)/);
  return (m ? m[0] : text).trim();
}

/** a card filled from the v2 build keeps one stored body, which belongs to the current period only */
function v2Body(card: SelfV3CardView): string[] {
  if (card.v3 || Array.isArray(card.standing)) return [];
  return (card.v2?.card?.body ?? []).filter((s) => !!s?.trim());
}

export function periodsOf(card: SelfV3CardView, today: string = todayIso()): PeriodView[] {
  const rail = card.rail ?? [];
  const cur = currentRail(rail, today);
  const body = v2Body(card);
  const all = rail.map((item, index): PeriodView => {
    const span = card.v3 ? spanFor(card, index) : null;
    const avoid = item.avoid?.trim() || span?.avoid?.trim() || span?.obstacle?.trim() || null;
    const spanText = span ? [span.asks].filter((s) => !!s?.trim()) : [];
    const railText = (item.text ?? []).filter((s) => !!s?.trim());
    const text = railText.length ? railText : spanText.length ? spanText : index === cur && body.length ? body : null;
    const step = span?.step?.trim() || null;
    const tone = spanToneShown(span, item.tone);
    const current = index === cur;
    const name = nameOf(item, tone);
    const dates = datesWords(item, today);
    const own = !!text;
    const headline = item.headline?.trim() || span?.headline?.trim() || (current ? cardHeadline(card) : null) || (text ? firstSentenceOf(text[0]!) : null);
    return { index, item, span, label: name ? `${name} · ${dates}` : dates, headline, text, step, avoid, tone, current, past: item.to < today && !current, own };
  });
  // one period per end date: the one with words of its own, else the earlier
  const byEnd = new Map<string, PeriodView>();
  for (const p of all) {
    const held = byEnd.get(p.item.to);
    if (!held || (!held.own && p.own) || (held.own === p.own && p.current && !held.current)) byEnd.set(p.item.to, p);
  }
  return [...byEnd.values()].sort((a, b) => a.item.from.localeCompare(b.item.from) || a.item.to.localeCompare(b.item.to));
}

/** the periods offered as chips: only those with words of their own, and only when there are two or more */
export function chipPeriods(periods: PeriodView[]): PeriodView[] {
  const own = periods.filter((p) => p.own);
  return own.length >= 2 ? own : [];
}

/**
 * Where a card opens: the period remembered for this session when it is still a chip, else the current one, else the
 * first chip ahead. Without chips, only the current period's own words show (or none).
 */
export function openPeriod(periods: PeriodView[], remembered: number | null): number | null {
  const chips = chipPeriods(periods);
  if (!chips.length) return periods.find((p) => p.current && p.own)?.index ?? null;
  if (remembered !== null && chips.some((p) => p.index === remembered)) return remembered;
  return (chips.find((p) => p.current) ?? chips.find((p) => !p.past) ?? chips[0]!).index;
}

/** the chip before (-1) or after (+1) the one on screen, or null */
export function neighbour(periods: PeriodView[], from: number | null, d: -1 | 1): number | null {
  const chips = chipPeriods(periods);
  const at = chips.findIndex((p) => p.index === from);
  if (at < 0) return null;
  return chips[at + d]?.index ?? null;
}

/**
 * The card's standing lines: what the server sent, shown whatever the period. A server that sends none yet (older)
 * leaves a card filled from the v2 build with its one stored body.
 */
export function standingOf(card: SelfV3CardView, voice: 'gentle' | 'direct' = 'gentle'): string[] {
  const v = card.voices?.[voice]?.standing;
  if (Array.isArray(v)) return v.filter((s) => !!s?.trim());
  if (Array.isArray(card.standing)) return card.standing.filter((s) => !!s?.trim());
  // the v2 body is the current period's text when there is a current period to hold it
  return card.v3 || (card.rail ?? []).length ? [] : v2Body(card);
}

/** the headline on screen: the picked period's own, else the card's (in the chosen voice when written) */
export function headlineOf(card: SelfV3CardView, period: PeriodView | null, voice: 'gentle' | 'direct' = 'gentle'): string | null {
  const own = card.voices?.[voice]?.line?.trim();
  if (period && !period.current && period.headline) return period.headline;
  return own || period?.headline || cardHeadline(card);
}

/** "Your pattern": one line, the first the card has */
export function patternLine(card: SelfV3CardView): string | null {
  return cardPatterns(card)[0]?.text?.trim() || null;
}

/** "What to do": the one best step and the one thing to avoid (never the four rungs) */
export function whatToDo(card: SelfV3CardView, period: PeriodView | null): { best: string | null; avoid: string | null } {
  const ladder: LadderSteps | null = cardLadder(card);
  return {
    best: period?.step ?? (ladder?.best?.trim() || null),
    avoid: period?.avoid ?? (ladder?.drift?.trim() || null),
  };
}

/** the key dates in date order, each marked when it has passed */
export function keyDatesOf(card: SelfV3CardView, today: string = todayIso()): Array<KeyDate & { passed: boolean }> {
  return (card.keyDates ?? [])
    .filter((k) => !!k?.date && !!k.label?.trim())
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((k) => ({ ...k, passed: k.date < today }));
}

export function firstSentence(text: string): string {
  return firstSentenceOf(text);
}
