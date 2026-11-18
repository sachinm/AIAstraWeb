/**
 * Card toolbar vetting & content enhancement layer.
 *
 * Principle:
 * 1. Required controls (`Chart details`) are ALWAYS preserved on ready cards.
 * 2. Optional toolbar tools (`table`, `calendar`, `dates`, `timeframe`, `plan`, `info`) are shown and allowed to open
 *    ONLY when the card holds complete, non-redundant, chronologically honest data that genuinely enhances communication
 *    beyond what is already visible on the primary card face and period strip.
 * 3. When zero optional tools pass vetting, the optional tools group in the toolbar is omitted completely.
 * 4. Pure date arithmetic and string formatting over stored server windows — zero astrological computation in the client.
 */
import { CARD_GROUP_BYS, CARD_TOOLS, type CardGroupBy, type CardOptions, type CardTool } from '../../../lib/cardOptions';
import type { LadderSteps } from '../../../lib/selfV2Api';
import { normaliseCardGrant, type SelfV3CardView, type SpanMode, type SpanTone } from '../../../lib/selfV3Api';
import { cardPatterns } from './CardParts';
import { firstSentence, groupPeriods, planSteps, type PeriodView } from './cardModel';
import { formatDisplayDate, scrubEmptyRefs } from './textClean';
import { SPAN_MODE_WORD, SPAN_TONE_WORD } from './words';

export { formatDisplayDate, scrubEmptyRefs };

const ISO_DAY_RE = /^(\d{4})-(\d{2})-(\d{2})/;
const DAY_MS = 86_400_000;

function readEnvInt(key: string, fallback: number): number {
  const env = (import.meta as ImportMeta & { env?: Record<string, unknown> }).env;
  const raw = env?.[key];
  if (raw === undefined || raw === null || raw === '') return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : fallback;
}

export interface ToolVettingConfig {
  minTablePeriods: number;
  minCalendarTonedPeriods: number;
  maxCalendarMonths: number;
  minDatesPeriods: number;
  minDatesMilestones: number;
  minTimeframePeriods: number;
  maxWeekSpanDays: number;
  maxMonthSpanDays: number;
  maxQuarterSpanDays: number;
  maxYearSpanDays: number;
  minPlanSteps: number;
}

export function getToolVettingConfig(): ToolVettingConfig {
  return {
    minTablePeriods: readEnvInt('VITE_CARD_TOOL_TABLE_MIN_PERIODS', 2),
    minCalendarTonedPeriods: readEnvInt('VITE_CARD_TOOL_CALENDAR_MIN_TONED_PERIODS', 2),
    maxCalendarMonths: readEnvInt('VITE_CARD_TOOL_CALENDAR_MAX_MONTHS', 12),
    minDatesPeriods: readEnvInt('VITE_CARD_TOOL_DATES_MIN_PERIODS', 2),
    minDatesMilestones: readEnvInt('VITE_CARD_TOOL_DATES_MIN_MILESTONES', 2),
    minTimeframePeriods: readEnvInt('VITE_CARD_TOOL_TIMEFRAME_MIN_PERIODS', 3),
    maxWeekSpanDays: readEnvInt('VITE_CARD_TOOL_TIMEFRAME_WEEK_MAX_DAYS', 21),
    maxMonthSpanDays: readEnvInt('VITE_CARD_TOOL_TIMEFRAME_MONTH_MAX_DAYS', 95),
    maxQuarterSpanDays: readEnvInt('VITE_CARD_TOOL_TIMEFRAME_QUARTER_MAX_DAYS', 400),
    maxYearSpanDays: readEnvInt('VITE_CARD_TOOL_TIMEFRAME_YEAR_MAX_DAYS', 3660),
    minPlanSteps: readEnvInt('VITE_CARD_TOOL_PLAN_MIN_STEPS', 2),
  };
}

function toIsoDay(value: string | null | undefined): string | null {
  if (!value) return null;
  const m = ISO_DAY_RE.exec(value.trim());
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function parseUtcMs(iso: string): number | null {
  const day = toIsoDay(iso);
  if (!day) return null;
  const ms = Date.parse(`${day}T00:00:00Z`);
  return Number.isFinite(ms) ? ms : null;
}

export function spanDaysBetween(fromIso: string, toIso: string): number {
  const a = parseUtcMs(fromIso);
  const b = parseUtcMs(toIso);
  if (a === null || b === null) return 0;
  return Math.max(1, Math.round((b - a) / DAY_MS));
}

function daysBetweenSigned(fromIso: string, toIso: string): number | null {
  const a = parseUtcMs(fromIso);
  const b = parseUtcMs(toIso);
  if (a === null || b === null) return null;
  return Math.round((b - a) / DAY_MS);
}

function localTodayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Resolves the reference "today" ISO date. In live production, `localToday` sits inside the active `current` period and
 * is returned unchanged. When rendering a static snapshot or test fixture whose `current` period belongs to another
 * month/year, clamping to the active `current` period keeps calendar and turning-point calculations deterministic.
 */
export function resolveReferenceToday(periods: readonly PeriodView[], builtOn?: string | null, explicitToday?: string | null): string {
  const explicit = toIsoDay(explicitToday);
  if (explicit) return explicit;
  const local = localTodayIso();
  const active = periods.find((p) => p.current);
  if (!active) return local;
  const from = toIsoDay(active.item.from);
  const to = toIsoDay(active.item.to);
  if (!from || !to) return local;
  if (from <= local && local <= to) return local;
  const built = toIsoDay(builtOn);
  if (built && from <= built && built <= to) return built;
  return from;
}

function featureUsable(card: SelfV3CardView, key: string): boolean {
  // the card's grant in either server shape: `{usable, locked}` or the map's `{locked}`
  const grant = normaliseCardGrant(card.features?.[key]);
  return grant ? grant.usable && !grant.locked : true;
}

/**
 * Resolves the most specific period covering `day`.
 * - Broad overarching rails that strictly contain a sub-period covering `day` yield to the inner sub-period.
 * - On an exact handoff day (`p1.to === day && p2.from === day`), the incoming stretch starting on `day` wins when selectable.
 */
export function coveringPeriodForDay(periods: readonly PeriodView[], day: string): PeriodView | null {
  const hits: Array<{ p: PeriodView; from: string; to: string; days: number }> = [];
  for (const p of periods) {
    const from = toIsoDay(p.item.from);
    const to = toIsoDay(p.item.to);
    if (!from || !to || day < from || day > to) continue;
    hits.push({ p, from, to, days: spanDaysBetween(from, to) });
  }
  if (hits.length === 0) return null;
  if (hits.length === 1) return hits[0]!.p;

  // Drop outer overarching containers when a strictly narrower nested period also covers `day`
  const leafHits = hits.filter(
    (a) => !hits.some((b) => b !== a && a.from <= b.from && b.to <= a.to && (a.from < b.from || b.to < a.to)),
  );
  const pool = leafHits.length ? leafHits : hits;
  if (pool.length === 1) return pool[0]!.p;

  // On a handoff boundary where one stretch ends on `day` and another starts on `day`, prefer the incoming own-prose stretch
  const incoming = pool.find((x) => x.from === day && x.from < x.to && x.p.own);
  if (incoming) return incoming.p;

  pool.sort((a, b) => {
    if (a.p.own !== b.p.own) return a.p.own ? -1 : 1;
    if ((a.p.tone !== null) !== (b.p.tone !== null)) return a.p.tone !== null ? -1 : 1;
    if (a.days !== b.days) return a.days - b.days;
    return a.p.index - b.p.index;
  });
  return pool[0]!.p;
}

// ---------------------------------------------------------------------------------------------------------------------
// Prepared tool models
// ---------------------------------------------------------------------------------------------------------------------

export interface VettedTableRow {
  period: PeriodView;
  summary: string;
  trap: string | null;
  focus: string | null;
  step: string | null;
  toneWord: string | null;
  modeWord: string | null;
  agreementShort: string | null;
}

export interface VettedTableData {
  rows: VettedTableRow[];
  showTone: boolean;
  showFocus: boolean;
  showStep: boolean;
}

export interface CalendarTurningPoint {
  date: string;
  displayDate: string;
  summary: string;
  tone: SpanTone | null;
  periodIndex: number | null;
}

export interface VettedCalendarData {
  today: string;
  months: Array<{ y: number; m: number }>;
  turningPoints: CalendarTurningPoint[];
  turningPointByDay: ReadonlyMap<string, CalendarTurningPoint>;
  activeTones: SpanTone[];
}

export type DateMilestoneStatus = 'past' | 'started' | 'now' | 'next' | 'upcoming';

export interface DateMilestone {
  id: string;
  date: string;
  displayDate: string;
  title: string;
  detail: string | null;
  tone: SpanTone | null;
  modeWord: string | null;
  agreementLabel: string | null;
  status: DateMilestoneStatus;
  relativeLabel: string | null;
  periodIndex: number | null;
}

export interface VettedDatesData {
  milestones: DateMilestone[];
}

export interface VettedTimeframeData {
  validGroupBys: CardGroupBy[];
  effectiveGroupBy: CardGroupBy;
  writtenPeriods: PeriodView[];
}

export interface VettedPlanData {
  steps: Array<{ key: keyof LadderSteps; text: string }>;
}

export interface VettedInfoData {
  optionNotes: string[];
  waitingConfirm: { claimId: string; text: string } | null;
  staleNote: string | null;
  formattedBuiltOn: string | null;
}

export interface ToolAuditEntry {
  vetted: boolean;
  reason: string;
}

export interface CardToolVetting {
  /** Required controls that must remain accessible on every ready card regardless of optional tool vetting. */
  requiredControls: {
    chartDetails: boolean;
  };
  /** Optional tools from `CARD_TOOLS` that passed strict data & communication-enhancement vetting on this card. */
  availableTools: CardTool[];
  /** Requested tools (`options.tools`) intersected with `availableTools` so unvetted tools never open blank panels. */
  openTools: CardTool[];
  /** Diagnostic audit trail for each optional tool. */
  audit: Record<CardTool, ToolAuditEntry>;
  table: VettedTableData;
  calendar: VettedCalendarData;
  dates: VettedDatesData;
  timeframe: VettedTimeframeData;
  plan: VettedPlanData;
  info: VettedInfoData;
}

const GENERIC_KEYDATE_LABEL_RE = /^(?:earlier|this|next|later|current|first|heavy|mixed|light|lighter)\s+stretch\s+(?:begins|ends)$/i;

function agreementBadge(p: PeriodView): string | null {
  const ag = p.span?.agreement;
  if (!ag) return null;
  if (p.span?.held === false || p.tone === null) return 'Clocks split';
  return `${ag.agree}/${ag.of} clocks`;
}

function stretchNameOf(p: PeriodView, idx: number, currentIdx: number): string {
  if (p.tone) return `${SPAN_TONE_WORD[p.tone]} stretch`;
  const note = p.item.note ? scrubEmptyRefs(p.item.note) : '';
  if (note) return note;
  if (p.current || idx === currentIdx) return 'Current stretch';
  if (currentIdx >= 0 && idx < currentIdx) return 'Earlier stretch';
  if (currentIdx >= 0 && idx === currentIdx + 1) return 'Next stretch';
  if (currentIdx < 0 && idx === 0) return 'First stretch';
  return 'Later stretch';
}

function vetTable(card: SelfV3CardView, periods: readonly PeriodView[], cfg: ToolVettingConfig): { entry: ToolAuditEntry; data: VettedTableData } {
  if (!featureUsable(card, 'feature.periods')) {
    return {
      entry: { vetted: false, reason: 'feature.periods is not usable on this card' },
      data: { rows: [], showTone: false, showFocus: false, showStep: false },
    };
  }
  const rows: VettedTableRow[] = [];
  for (const p of periods) {
    if (!p.own) continue;
    const rawSummary = scrubEmptyRefs(firstSentence(p.span?.asks ?? p.text?.[0] ?? ''));
    if (!rawSummary) continue;
    const rawTrap = p.span?.obstacle ? scrubEmptyRefs(firstSentence(p.span.obstacle)) : '';
    const rawFocus = p.item.note ? scrubEmptyRefs(p.item.note) : '';
    const rawStep = p.step ? scrubEmptyRefs(firstSentence(p.step)) : '';
    rows.push({
      period: p,
      summary: rawSummary,
      trap: rawTrap || null,
      focus: rawFocus && rawFocus.toLowerCase() !== rawSummary.toLowerCase() ? rawFocus : null,
      step: rawStep || null,
      toneWord: p.tone ? SPAN_TONE_WORD[p.tone] : null,
      modeWord: p.span?.mode ? SPAN_MODE_WORD[p.span.mode as SpanMode] : null,
      agreementShort: agreementBadge(p),
    });
  }
  const showTone = rows.some((r) => Boolean(r.toneWord || r.modeWord));
  const showFocus = rows.some((r) => Boolean(r.focus));
  const showStep = rows.some((r) => Boolean(r.step));
  if (rows.length < cfg.minTablePeriods) {
    return {
      entry: { vetted: false, reason: `needs >= ${cfg.minTablePeriods} periods with own prose (found ${rows.length})` },
      data: { rows, showTone, showFocus, showStep },
    };
  }
  if (!showTone && !showFocus && !showStep) {
    return {
      entry: { vetted: false, reason: 'no structured comparison columns (tone, focus, or step) beyond prose' },
      data: { rows, showTone, showFocus, showStep },
    };
  }
  return {
    entry: { vetted: true, reason: `${rows.length} vetted stretches across ${2 + Number(showTone) + Number(showFocus) + Number(showStep)} columns` },
    data: { rows, showTone, showFocus, showStep },
  };
}

function monthRange(y: number, m: number): { start: string; end: string; days: number } {
  const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const mm = String(m + 1).padStart(2, '0');
  return { start: `${y}-${mm}-01`, end: `${y}-${mm}-${String(days).padStart(2, '0')}`, days };
}

export function activeCalendarMonths(periods: readonly PeriodView[], today: string, maxMonths = 12): Array<{ y: number; m: number }> {
  if (!periods.length) return [];
  const validStarts = periods.map((p) => toIsoDay(p.item.from)).filter((d): d is string => Boolean(d)).sort();
  if (!validStarts.length) return [];
  const anchor = validStarts[0]! > today ? validStarts[0]! : today;
  const y0 = Number(anchor.slice(0, 4));
  const m0 = Number(anchor.slice(5, 7)) - 1;
  const candidates = Array.from({ length: maxMonths }, (_, k) => ({
    y: y0 + Math.floor((m0 + k) / 12),
    m: (m0 + k) % 12,
  }));
  return candidates.filter(({ y, m }) => {
    const { start, end } = monthRange(y, m);
    return periods.some((p) => {
      const pFrom = toIsoDay(p.item.from);
      const pTo = toIsoDay(p.item.to);
      return Boolean(pFrom && pTo && pFrom <= end && pTo >= start);
    });
  });
}

function vetCalendar(
  card: SelfV3CardView,
  periods: readonly PeriodView[],
  today: string,
  cfg: ToolVettingConfig,
): { entry: ToolAuditEntry; data: VettedCalendarData } {
  const emptyMap = new Map<string, CalendarTurningPoint>();
  if (!featureUsable(card, 'feature.periods')) {
    return {
      entry: { vetted: false, reason: 'feature.periods is not usable on this card' },
      data: { today, months: [], turningPoints: [], turningPointByDay: emptyMap, activeTones: [] },
    };
  }
  const months = activeCalendarMonths(periods, today, cfg.maxCalendarMonths);
  if (!months.length) {
    return {
      entry: { vetted: false, reason: 'no months in horizon overlap card periods' },
      data: { today, months: [], turningPoints: [], turningPointByDay: emptyMap, activeTones: [] },
    };
  }
  const windowStart = monthRange(months[0]!.y, months[0]!.m).start;
  const lastMonth = months[months.length - 1]!;
  const windowEnd = monthRange(lastMonth.y, lastMonth.m).end;

  // Walk every day actually rendered in `months` so shadowed overarching periods or uniform single-tone grids cannot pass
  const paintedPeriods = new Map<number, PeriodView>();
  const paintedTones = new Set<SpanTone>();
  const paintedShades = new Set<SpanTone | 'none'>();
  let prevPeriodIdx: number | null | undefined = undefined;
  let hasDayTransition = false;

  for (const { y, m } of months) {
    const { days } = monthRange(y, m);
    const mm = String(m + 1).padStart(2, '0');
    for (let d = 1; d <= days; d++) {
      const dayIso = `${y}-${mm}-${String(d).padStart(2, '0')}`;
      const p = coveringPeriodForDay(periods, dayIso);
      const pIdx = p ? p.index : null;
      if (prevPeriodIdx !== undefined && pIdx !== prevPeriodIdx) {
        hasDayTransition = true;
      }
      prevPeriodIdx = pIdx;
      if (p) {
        paintedPeriods.set(p.index, p);
        paintedShades.add(p.tone ?? 'none');
        if (p.tone) paintedTones.add(p.tone);
      }
    }
  }

  const resolvedList = [...paintedPeriods.values()].sort((a, b) => a.item.from.localeCompare(b.item.from) || a.index - b.index);
  const paintedTonedCount = resolvedList.filter((p) => p.tone !== null).length;
  const currentIdx = resolvedList.findIndex((p) => p.current);

  const byDay = new Map<string, CalendarTurningPoint>();
  for (let i = 0; i < resolvedList.length; i++) {
    const p = resolvedList[i]!;
    const from = toIsoDay(p.item.from);
    const to = toIsoDay(p.item.to);
    const toneName = stretchNameOf(p, i, currentIdx);
    if (from && from >= windowStart && from <= windowEnd) {
      const prev = i > 0 ? resolvedList[i - 1] : null;
      const prevTo = prev ? toIsoDay(prev.item.to) : null;
      const summary =
        prev && prevTo === from && prev.tone
          ? `${SPAN_TONE_WORD[prev.tone]} ends · ${toneName} begins`
          : `${toneName} begins`;
      byDay.set(from, {
        date: from,
        displayDate: formatDisplayDate(from),
        summary,
        tone: p.tone,
        periodIndex: p.own ? p.index : null,
      });
    }
    if (to && to >= windowStart && to <= windowEnd && !byDay.has(to)) {
      byDay.set(to, {
        date: to,
        displayDate: formatDisplayDate(to),
        summary: `${toneName} ends`,
        tone: p.tone,
        periodIndex: p.own ? p.index : null,
      });
    }
  }

  const turningPoints = [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
  const activeTones = (['heavy', 'mixed', 'light'] as const).filter((t) => paintedTones.has(t));

  if (paintedTonedCount < cfg.minCalendarTonedPeriods) {
    return {
      entry: {
        vetted: false,
        reason: `needs >= ${cfg.minCalendarTonedPeriods} distinct toned stretches painted on the calendar (found ${paintedTonedCount})`,
      },
      data: { today, months, turningPoints, turningPointByDay: byDay, activeTones },
    };
  }
  if (paintedShades.size < 2) {
    return {
      entry: {
        vetted: false,
        reason: 'all covered calendar days share the same shade; calendar adds no visual contrast',
      },
      data: { today, months, turningPoints, turningPointByDay: byDay, activeTones },
    };
  }
  if (!turningPoints.length || !hasDayTransition) {
    return {
      entry: { vetted: false, reason: 'no visible day-to-day turning-point transition inside the calendar window' },
      data: { today, months, turningPoints, turningPointByDay: byDay, activeTones },
    };
  }
  return {
    entry: { vetted: true, reason: `${months.length} active months, ${paintedTonedCount} painted toned stretches, ${turningPoints.length} turning points` },
    data: { today, months, turningPoints, turningPointByDay: byDay, activeTones },
  };
}

function vetDates(
  card: SelfV3CardView,
  periods: readonly PeriodView[],
  today: string,
  cfg: ToolVettingConfig,
): { entry: ToolAuditEntry; data: VettedDatesData } {
  if (!featureUsable(card, 'feature.key_dates')) {
    return {
      entry: { vetted: false, reason: 'feature.key_dates is not usable on this card' },
      data: { milestones: [] },
    };
  }
  const ownPeriods = periods.filter((p) => p.own);
  if (ownPeriods.length < cfg.minDatesPeriods) {
    return {
      entry: {
        vetted: false,
        reason: `needs >= ${cfg.minDatesPeriods} periods with vetted prose so dates add turning-point context beyond PeriodStrip (found ${ownPeriods.length})`,
      },
      data: { milestones: [] },
    };
  }

  const keyDateLabels = new Map<string, string>();
  for (const kd of card.keyDates ?? []) {
    const d = toIsoDay(kd.date);
    const label = scrubEmptyRefs(kd.label ?? '');
    if (d && label && !GENERIC_KEYDATE_LABEL_RE.test(label)) keyDateLabels.set(d, label);
  }

  const byDate = new Map<string, Omit<DateMilestone, 'status' | 'relativeLabel'> & { activeStart: boolean }>();
  const sortedOwn = [...ownPeriods].sort((a, b) => a.item.from.localeCompare(b.item.from) || a.index - b.index);
  const currentIdx = sortedOwn.findIndex((p) => p.current);

  for (let i = 0; i < sortedOwn.length; i++) {
    const p = sortedOwn[i]!;
    const from = toIsoDay(p.item.from);
    const to = toIsoDay(p.item.to);
    const prev = i > 0 ? sortedOwn[i - 1] : null;
    const prevTo = prev ? toIsoDay(prev.item.to) : null;
    const summary = scrubEmptyRefs(firstSentence(p.span?.asks ?? p.text?.[0] ?? ''));
    const modeWord = p.span?.mode ? SPAN_MODE_WORD[p.span.mode as SpanMode] : null;
    const ag = agreementBadge(p);
    const curStretch = stretchNameOf(p, i, currentIdx);

    if (from) {
      const serverLabel = keyDateLabels.get(from);
      const prevToneWord = prev?.tone ? SPAN_TONE_WORD[prev.tone] : null;
      const title =
        serverLabel ??
        (prev && prevTo === from && prevToneWord
          ? `${prevToneWord} stretch ends · ${curStretch} begins`
          : `${curStretch} begins`);
      const activeStart = Boolean(p.current && from <= today && (!to || today <= to));
      byDate.set(from, {
        id: `m-${from}-start`,
        date: from,
        displayDate: formatDisplayDate(from),
        title,
        detail: summary || null,
        tone: p.tone,
        modeWord,
        agreementLabel: ag,
        activeStart,
        periodIndex: p.own ? p.index : null,
      });
    }

    const next = i + 1 < sortedOwn.length ? sortedOwn[i + 1] : null;
    const nextFrom = next ? toIsoDay(next.item.from) : null;
    if (to && to !== nextFrom && !byDate.has(to)) {
      const title = keyDateLabels.get(to) ?? `${curStretch} ends`;
      const stepLine = p.step ? scrubEmptyRefs(firstSentence(p.step)) : null;
      byDate.set(to, {
        id: `m-${to}-end`,
        date: to,
        displayDate: formatDisplayDate(to),
        title,
        detail: stepLine ?? (summary || null),
        tone: p.tone,
        modeWord: null,
        agreementLabel: null,
        activeStart: false,
        periodIndex: p.own ? p.index : null,
      });
    }
  }

  // Surface dated pattern horizons (`until`) when they fall on or after `today` and do not duplicate an existing boundary
  for (const pt of cardPatterns(card)) {
    const until = toIsoDay(pt.until);
    if (!until || until < today || byDate.has(until)) continue;
    byDate.set(until, {
      id: `m-${until}-pattern`,
      date: until,
      displayDate: formatDisplayDate(until),
      title: keyDateLabels.get(until) ?? 'Pattern eases',
      detail: firstSentence(pt.text) || null,
      tone: null,
      modeWord: null,
      agreementLabel: null,
      activeStart: false,
      periodIndex: null,
    });
  }

  const ordered = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  let markedNext = false;
  const milestones: DateMilestone[] = ordered.map(({ activeStart, ...item }) => {
    let status: DateMilestoneStatus;
    let relativeLabel: string | null = null;
    if (item.date === today) {
      status = 'now';
    } else if (activeStart && item.date < today) {
      status = 'started';
    } else if (item.date < today) {
      status = 'past';
    } else if (!markedNext) {
      markedNext = true;
      status = 'next';
      const delta = daysBetweenSigned(today, item.date);
      if (delta !== null && delta >= 1 && delta <= 90) {
        relativeLabel = delta === 1 ? 'In 1 day' : `In ${delta}d`;
      }
    } else {
      status = 'upcoming';
    }
    return { ...item, status, relativeLabel };
  });

  if (milestones.length < cfg.minDatesMilestones) {
    return {
      entry: { vetted: false, reason: `needs >= ${cfg.minDatesMilestones} turning-point milestones (found ${milestones.length})` },
      data: { milestones },
    };
  }
  const upcomingCount = milestones.filter((m) => m.date >= today).length;
  if (upcomingCount < 1) {
    return {
      entry: { vetted: false, reason: 'all dated milestones have already passed' },
      data: { milestones },
    };
  }
  return {
    entry: { vetted: true, reason: `${milestones.length} vetted turning-point milestones (${upcomingCount} ahead) across ${ownPeriods.length} stretches` },
    data: { milestones },
  };
}

export function vettedTimeframeGroupBys(periods: readonly PeriodView[], cfg = getToolVettingConfig()): CardGroupBy[] {
  const written = periods.filter((p) => p.own);
  if (written.length < 2) return [];
  const durations = written.map((p) => spanDaysBetween(p.item.from, p.item.to)).filter((d) => d > 0);
  const minDays = durations.length ? Math.min(...durations) : 0;

  return CARD_GROUP_BYS.filter((by) => {
    if (by === 'weeks' && minDays > cfg.maxWeekSpanDays) return false;
    if (by === 'months' && minDays > cfg.maxMonthSpanDays) return false;
    if (by === 'quarters' && minDays > cfg.maxQuarterSpanDays) return false;
    if (by === 'years' && minDays > cfg.maxYearSpanDays) return false;
    return groupPeriods(written, by).length >= 2;
  });
}

function vetTimeframe(
  card: SelfV3CardView,
  periods: readonly PeriodView[],
  requestedGroupBy: CardGroupBy,
  cfg: ToolVettingConfig,
): { entry: ToolAuditEntry; data: VettedTimeframeData } {
  if (!featureUsable(card, 'feature.periods')) {
    return {
      entry: { vetted: false, reason: 'feature.periods is not usable on this card' },
      data: { validGroupBys: [], effectiveGroupBy: requestedGroupBy, writtenPeriods: [] },
    };
  }
  const writtenPeriods = periods.filter((p) => p.own);
  const validGroupBys = vettedTimeframeGroupBys(periods, cfg);
  const effectiveGroupBy = validGroupBys.includes(requestedGroupBy) ? requestedGroupBy : (validGroupBys[0] ?? requestedGroupBy);

  if (writtenPeriods.length < cfg.minTimeframePeriods) {
    return {
      entry: { vetted: false, reason: `needs >= ${cfg.minTimeframePeriods} periods with own prose for timeframe bucketing (found ${writtenPeriods.length})` },
      data: { validGroupBys, effectiveGroupBy, writtenPeriods },
    };
  }
  if (!validGroupBys.length) {
    return {
      entry: { vetted: false, reason: 'no chronologically honest granularity produces >= 2 non-empty buckets' },
      data: { validGroupBys, effectiveGroupBy, writtenPeriods },
    };
  }
  return {
    entry: { vetted: true, reason: `${writtenPeriods.length} stretches bucketed honestly across [${validGroupBys.join(', ')}]` },
    data: { validGroupBys, effectiveGroupBy, writtenPeriods },
  };
}

function vetPlan(card: SelfV3CardView, planOption: CardOptions['plan'], cfg: ToolVettingConfig): { entry: ToolAuditEntry; data: VettedPlanData } {
  if (planOption === 'without') {
    return {
      entry: { vetted: false, reason: 'plan option is disabled on this card' },
      data: { steps: [] },
    };
  }
  const steps = planSteps(card, { plan: 'with' })
    .map((s) => ({ key: s.key, text: scrubEmptyRefs(s.text) }))
    .filter((s) => Boolean(s.text));
  if (steps.length < cfg.minPlanSteps) {
    return {
      entry: { vetted: false, reason: `needs >= ${cfg.minPlanSteps} vetted ladder steps (found ${steps.length})` },
      data: { steps },
    };
  }
  return {
    entry: { vetted: true, reason: `${steps.length} vetted action steps` },
    data: { steps },
  };
}

function vetInfo(
  card: SelfV3CardView,
  confirmOn: boolean,
  builtOn: string | null,
  staleCopy: string,
): { entry: ToolAuditEntry; data: VettedInfoData } {
  const optionNotes = (card.optionNotes ?? []).map((n) => scrubEmptyRefs(n)).filter(Boolean);
  const waitingConfirm =
    !confirmOn && featureUsable(card, 'feature.confirm') && card.v3?.confirm
      ? { claimId: card.v3.confirm.claimId, text: scrubEmptyRefs(card.v3.confirm.text) }
      : null;
  const staleNote = card.stale && (card.staleDates?.length ?? 0) > 0 ? staleCopy : null;
  const formattedBuiltOn = builtOn ? formatDisplayDate(builtOn) : null;

  if (!optionNotes.length && !waitingConfirm && !staleNote) {
    return {
      entry: { vetted: false, reason: 'no card-specific option notes, hidden confirm prompt, or freshness notice' },
      data: { optionNotes, waitingConfirm, staleNote, formattedBuiltOn },
    };
  }
  return {
    entry: { vetted: true, reason: 'card carries vetted notice or deferred confirm prompt' },
    data: { optionNotes, waitingConfirm, staleNote, formattedBuiltOn },
  };
}

export interface VetCardToolsInput {
  card: SelfV3CardView;
  periods: readonly PeriodView[];
  options: Pick<CardOptions, 'tools' | 'groupBy'> & Partial<Pick<CardOptions, 'plan'>>;
  confirmOn?: boolean;
  builtOn?: string | null;
  hasDetailsHandler?: boolean;
  today?: string | null;
  staleCopy?: string;
}

export function vetCardTools({
  card,
  periods,
  options,
  confirmOn = true,
  builtOn = null,
  hasDetailsHandler = true,
  today = null,
  staleCopy = 'Some dates in this reading have passed since it was built.',
}: VetCardToolsInput): CardToolVetting {
  const cfg = getToolVettingConfig();
  const refToday = resolveReferenceToday(periods, builtOn, today);

  const tableRes = vetTable(card, periods, cfg);
  const calendarRes = vetCalendar(card, periods, refToday, cfg);
  const datesRes = vetDates(card, periods, refToday, cfg);
  const timeframeRes = vetTimeframe(card, periods, options.groupBy, cfg);
  const planRes = vetPlan(card, options.plan ?? 'with', cfg);
  const infoRes = vetInfo(card, confirmOn, builtOn, staleCopy);

  const audit: Record<CardTool, ToolAuditEntry> = {
    table: tableRes.entry,
    calendar: calendarRes.entry,
    dates: datesRes.entry,
    timeframe: timeframeRes.entry,
    plan: planRes.entry,
    info: infoRes.entry,
  };

  const availableTools = CARD_TOOLS.filter((t) => audit[t].vetted);
  const openTools = availableTools.filter((t) => options.tools.includes(t));

  return {
    requiredControls: {
      chartDetails: Boolean(hasDetailsHandler),
    },
    availableTools,
    openTools,
    audit,
    table: tableRes.data,
    calendar: calendarRes.data,
    dates: datesRes.data,
    timeframe: timeframeRes.data,
    plan: planRes.data,
    info: infoRes.data,
  };
}
