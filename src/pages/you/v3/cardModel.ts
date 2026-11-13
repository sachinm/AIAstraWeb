/**
 * What a Self v3 card says for each period, worked out once for every face and tool (server docs/reading-engine/68,
 * the card-faces plan). Nothing astrological: it joins what the server sent (the rail, the spans, the standing lines)
 * and does date arithmetic on the stored periods.
 *
 * The rule: a period is offered as a choice only when it has words of its own (a v3 span, or `rail[i].text`) or is the
 * current one. The card's `standing` lines are the base that shows on every period; no period ever borrows another's
 * body.
 */
import type { CardGroupBy, CardOptions } from '../../../lib/cardOptions';
import type { LadderSteps } from '../../../lib/selfV2Api';
import type { RailItem, SelfV3CardView, SpanReading, SpanTone } from '../../../lib/selfV3Api';
import { spanToneShown, cardLadder } from './CardParts';

export interface PeriodView {
  index: number;
  item: RailItem;
  span: SpanReading | null;
  /** the period's own paragraphs (asks, then the trap for a v3 span); null when none is written */
  text: string[] | null;
  /** a v3 span's one step, or null */
  step: string | null;
  /** the tone shown: null when the clocks are split on it or none is known */
  tone: SpanTone | null;
  current: boolean;
  /** true when the period has words of its own */
  own: boolean;
  /** true when the person can pick it: it has words of its own, or it is the current one */
  selectable: boolean;
}

/** what every face is handed */
export interface FaceProps {
  card: SelfV3CardView;
  periods: PeriodView[];
  /** the period on screen, or null when the card has none */
  period: PeriodView | null;
  onSelect: (i: number) => void;
  standing: string[];
  options: CardOptions;
  expanded: boolean;
  onExpanded: (v: boolean) => void;
  /** evidence keys are shown only when the server marks the person a practitioner */
  showEvidence: boolean;
}

/** what every tool is handed: the face's props, plus what only tools need */
export interface ToolProps extends FaceProps {
  coarse: boolean;
  onGroupBy: (by: CardGroupBy) => void;
  /** when the board was built, plain words, or null */
  builtOn: string | null;
  /** whether "Is this right?" is on for this board */
  confirmOn: boolean;
}

/** the span a rail bar opens on a v3 card: by id, else by position */
export function spanFor(card: SelfV3CardView, i: number): SpanReading | null {
  const spans = card.v3?.spans ?? [];
  const id = card.rail[i]?.span;
  return (id ? spans.find((s) => s.span === id) : null) ?? spans[i] ?? null;
}

/** the rail bar selected on open: the current one, else the first */
export function currentRail(rail: RailItem[]): number {
  const i = rail.findIndex((r) => r.current);
  return i < 0 ? 0 : i;
}

export function periodsOf(card: SelfV3CardView): PeriodView[] {
  return card.rail.map((item, index) => {
    const span = card.v3 ? spanFor(card, index) : null;
    const spanText = span ? [span.asks, span.obstacle].filter((s) => !!s?.trim()) : [];
    const railText = (item.text ?? []).filter((s) => !!s?.trim());
    const text = span ? (spanText.length ? spanText : null) : railText.length ? railText : null;
    const step = span?.step?.trim() ? span.step : null;
    const own = !!text || !!step;
    return {
      index,
      item,
      span,
      text,
      step,
      tone: spanToneShown(span, item.tone),
      current: item.current,
      own,
      selectable: own || item.current,
    };
  });
}

/** where a card opens: the period remembered for this session when it can still be picked, else the current one */
export function openPeriod(card: SelfV3CardView, periods: PeriodView[], remembered: number | null): number {
  if (remembered !== null && periods[remembered]?.selectable) return remembered;
  const cur = currentRail(card.rail);
  if (periods[cur]?.selectable) return cur;
  return Math.max(0, periods.findIndex((p) => p.selectable));
}

/** the selectable periods before (-1) or after (+1) `from`, or null */
export function neighbour(periods: PeriodView[], from: number, d: -1 | 1): number | null {
  for (let i = from + d; i >= 0 && i < periods.length; i += d) if (periods[i]!.selectable) return i;
  return null;
}

/**
 * The card's standing lines: what the server sent, shown on every period. A server that sends none yet (older) leaves a
 * card filled from the v2 build with its one stored body, which then belongs to the current period only.
 */
export function standingOf(card: SelfV3CardView): string[] {
  if (Array.isArray(card.standing)) return card.standing.filter((s) => !!s?.trim());
  return card.v3 ? [] : (card.v2?.card?.body ?? []);
}

/** how many dated windows (other periods) have words of their own */
export function otherWindows(periods: PeriodView[], selected: number): PeriodView[] {
  return periods.filter((p) => p.own && p.index !== selected);
}

const STEPS: Array<keyof LadderSteps> = ['best', 'practical', 'drift', 'floor'];

/** the plan's steps, in order, when the card has a ladder and the options keep the plan */
export function planSteps(card: SelfV3CardView, options: Pick<CardOptions, 'plan'>): Array<{ key: keyof LadderSteps; text: string }> {
  if (options.plan === 'without') return [];
  const ladder = cardLadder(card);
  return ladder ? STEPS.filter((k) => ladder[k]?.trim()).map((key) => ({ key, text: ladder[key]! })) : [];
}

// ---------------------------------------------------------------------------------------------------------------------
// By timeframe: date arithmetic on the stored periods
// ---------------------------------------------------------------------------------------------------------------------

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parts(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return { y: y ?? 1970, m: (m ?? 1) - 1, d: d ?? 1 };
}

function dayLabel(iso: string): string {
  const p = parts(iso);
  return `${p.d} ${MONTHS[p.m]} ${p.y}`;
}

/** the key and the plain label of the timeframe a date starts in */
export function bucketOf(iso: string, by: CardGroupBy): { key: string; label: string } {
  const p = parts(iso);
  if (by === 'years') return { key: String(p.y), label: String(p.y) };
  if (by === 'decades') {
    const dec = Math.floor(p.y / 10) * 10;
    return { key: String(dec), label: `${dec}s` };
  }
  if (by === 'months') return { key: `${p.y}-${p.m}`, label: `${MONTHS[p.m]} ${p.y}` };
  if (by === 'quarters') {
    const q = Math.floor(p.m / 3);
    return { key: `${p.y}-q${q}`, label: `${MONTHS[q * 3]} to ${MONTHS[q * 3 + 2]} ${p.y}` };
  }
  const t = Date.UTC(p.y, p.m, p.d);
  const dow = (new Date(t).getUTCDay() + 6) % 7;
  const monday = new Date(t - dow * 86_400_000).toISOString().slice(0, 10);
  return { key: monday, label: `Week of ${dayLabel(monday)}` };
}

export interface PeriodGroup {
  key: string;
  label: string;
  periods: PeriodView[];
}

/** the periods grouped by the timeframe each starts in, in date order */
export function groupPeriods(periods: PeriodView[], by: CardGroupBy): PeriodGroup[] {
  const out: PeriodGroup[] = [];
  for (const p of [...periods].sort((a, b) => a.item.from.localeCompare(b.item.from))) {
    const b = bucketOf(p.item.from, by);
    const g = out.find((x) => x.key === b.key);
    if (g) g.periods.push(p);
    else out.push({ ...b, periods: [p] });
  }
  return out;
}

/** "swipe" on a touch screen whatever was chosen; the chosen way with a mouse */
export function resolveGroupsAs(groupsAs: CardOptions['groupsAs'], coarse: boolean): CardOptions['groupsAs'] {
  return coarse ? 'swipe' : groupsAs;
}

// ---------------------------------------------------------------------------------------------------------------------
// Show more: the label names what is waiting, from counts we hold
// ---------------------------------------------------------------------------------------------------------------------

export interface HiddenCounts {
  paragraphs: number;
  windows: number;
  steps: number;
}

export interface ReadBlock {
  kind: 'text' | 'step' | 'standing';
  text: string;
}

/** the Read face's blocks in order: the period's own words, its one step, then the card's standing lines */
export function readBlocks(period: PeriodView | null, standing: string[]): ReadBlock[] {
  return [
    ...(period?.text ?? []).map((text): ReadBlock => ({ kind: 'text', text })),
    ...(period?.step ? [{ kind: 'step', text: period.step } as ReadBlock] : []),
    ...standing.map((text): ReadBlock => ({ kind: 'standing', text })),
  ];
}

/** what the clamped Read face holds back, counted from the real content */
export function hiddenCounts(period: PeriodView | null, standing: string[], periods: PeriodView[], steps: number): HiddenCounts {
  const blocks = (period?.text?.length ?? 0) + (period?.step ? 1 : 0) + standing.length;
  return {
    paragraphs: Math.max(0, blocks - 1),
    windows: otherWindows(periods, period?.index ?? -1).length,
    steps,
  };
}

export function showMoreLabel(c: HiddenCounts): string {
  const bits: string[] = [];
  if (c.paragraphs) bits.push(`${c.paragraphs} more ${c.paragraphs === 1 ? 'paragraph' : 'paragraphs'}`);
  if (c.windows) bits.push(`${c.windows} dated ${c.windows === 1 ? 'window' : 'windows'}`);
  if (c.steps) bits.push(`${c.steps} ${c.steps === 1 ? 'step' : 'steps'} to take`);
  if (!bits.length) return 'Show more';
  const last = bits.pop()!;
  return `Show more: ${bits.length ? `${bits.join(', ')} and ${last}` : last}`;
}

/** the first sentence of a paragraph */
export function firstSentence(text: string): string {
  const m = text.match(/^.*?[.!?](?=\s|$)/);
  return (m ? m[0] : text).trim();
}
