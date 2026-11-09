/**
 * The page shared by the You and Love boards (server docs/reading-engine/45 §6–§9, 54 §3), built like the Work board:
 * the present tone first, the one question the board needs when the companion memory lacks the fact (doc 48), then
 * sibling pages instead of a long scroll (doc 45 rule 11): Now · What holds you up · What presses · Ahead · Looking back.
 * Each finding category renders a 2-column Master-Detail view (findings list on the left, full Vedic reading, time-period
 * charter, natal promise, and placements on the right) with Focus and Time-Frame filters and top-right technique badges.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  fetchArea,
  getCachedArea,
  saveAreaFact,
  sendAreaCheck,
  type AreaBoard,
  type AreaId,
  type AreaPressureFinding,
  type AreaSide,
  type AreaState,
  type AreaSupportFinding,
  type AreaWindow,
} from '../lib/areaApi';
import { longDate, monthName, type Tone } from '../lib/careerApi';
import { track } from '../lib/events';
import BoardAsk from './BoardAsk';
import { ReadingStamp } from './ReadingStamp';

const panel = 'glass glass-lift rounded-2xl p-4 sm:p-5';
const chip = 'inline-flex min-h-[44px] shrink-0 items-center rounded-full border px-4 text-sm';
const techBadgeClass =
  'inline-flex items-center gap-1 rounded-full border border-purple-400/30 bg-purple-500/15 px-2.5 py-0.5 font-mono text-[11px] font-medium text-purple-200';
type Page = 'now' | 'holds' | 'presses' | 'ahead' | 'back' | 'questions';
export type TimeframeFilter = 'all' | 'active_now' | 'next_6m' | 'next_12m' | 'next_3y' | 'natal';

export const TONE_WORD: Record<Tone, string> = { demanding: 'Demanding', easing: 'Easing', steady: 'Steady', closing: 'Closing', open: 'Open' };
const TONE_ICON: Record<Tone, string> = { demanding: '◆', easing: '◇', steady: '○', closing: '◐', open: '●' };
const CONFIDENCE_LINE: Record<string, string> = { confirmed: '', likely: 'Most of your chart points this way.', split: 'Your chart is divided on this.' };
const FAMILY_WORDS: Record<string, string> = {
  main: 'Your main timing clock',
  conditional: 'A second timing clock',
  rasi: 'The sign clock',
  karaka: 'The clock of what you seek',
  short: 'The short clocks',
  transit: 'The slow-moving sky',
  annual: "This year's chart",
};
const VOTE_WORDS = { support: 'points to a good stretch', test: 'points to a harder stretch', neutral: 'is quiet' };
const VOTE_WORDS_PLURAL = { support: 'point to a good stretch', test: 'point to a harder stretch', neutral: 'are quiet' };

const SYSTEM_CLOCK_NAMES: Record<string, string> = {
  vimshottari: 'Main Period Clock (Vimshottari)',
  yogini: 'Short Rhythm Clock (Yogini)',
  tithi_ashtottari: 'Lunar Period Clock (Ashtottari)',
  narayana: 'Jaimini Sign Clock (Narayana)',
  chara: 'Jaimini Karaka Clock (Chara)',
  shodashottari: 'Conditional Period Clock',
  dwadasottari: 'Conditional Period Clock',
  shatabdika: 'Conditional Period Clock',
  chaturshitisama: 'Conditional Period Clock',
  dwisaptatisama: 'Conditional Period Clock',
  shattrimshatsama: 'Conditional Period Clock',
};

export interface BoardQuestion {
  key: 'self.focus' | 'love.status';
  text: string;
  options: Array<{ value: string | null; label: string }>;
}

export interface AreaBoardConfig {
  area: AreaId;
  surface: string;
  title: string;
  testId: string;
  askCategory: string;
  holdsTitle: string;
  pressesTitle: string;
  headline: (b: AreaBoard, focus: string | null) => string;
  subareas: Record<string, string>;
  question: BoardQuestion;
  emptyAhead: string;
  emptyBack: string;
  unavailable: string;
  /** a page shown before Now and selected by default (the You board's "Your reading", doc 58 §4.3); Love has none */
  extraFirstTab?: { id: string; label: string; render: () => ReactNode };
}

export interface EnrichedFindingItem {
  id: string;
  kind: 'support' | 'pressure' | 'window';
  headline: string;
  subText?: string;
  subareaKey: string;
  subCategoryLabel: string;
  from: string | null;
  to: string | null;
  dateLabel: string;
  side: AreaSide;
  reading: string;
  natalPromise: string;
  periodCharter: string;
  aspectsAndPlacements: string[];
  techniqueId: string;
}

const GRAHA_LABELS: Record<string, string> = {
  Su: 'Surya (Vitality Significator)',
  Mo: 'Chandra (Emotional Mind Significator)',
  Ma: 'Mangala (Initiative Significator)',
  Me: 'Budha (Discernment Significator)',
  Ju: 'Guru (Wisdom & Protection Significator)',
  Ve: 'Shukra (Affection & Harmony Significator)',
  Sa: 'Shani (Endurance & Discipline Significator)',
  Ra: 'North Node (Expansion Axis)',
  Ke: 'South Node (Inner Mastery Axis)',
};

const BHAVA_NAMES: Record<string, string> = {
  h1: '1st Bhava (Self, Vitality & Direction)',
  h2: '2nd Bhava (Values, Speech & Family Continuity)',
  h3: '3rd Bhava (Courage, Initiative & Dialogue)',
  h4: '4th Bhava (Inner Peace, Heart & Sanctuary)',
  h5: '5th Bhava (Romance, Joy & Creative Intelligence)',
  h6: '6th Bhava (Daily Effort, Service & Resilience)',
  h7: '7th Bhava (Partnership, Covenant & Mutual Devotion)',
  h8: '8th Bhava (Deep Bonding, Trust & Transformation)',
  h9: '9th Bhava (Dharma, Higher Meaning & Grace)',
  h10: '10th Bhava (Public Standing, Action & Purpose)',
  h11: '11th Bhava (Friendships, Community & Shared Aspirations)',
  h12: '12th Bhava (Emotional Sanctuary, Letting Go & Renewal)',
};

function formatEvidenceToken(raw: string, area: AreaId): string {
  const mLord = raw.match(/^D1\.(h\d+)\s+lord\s+([A-Za-z]{2})\s+in\s+(h\d+)\s+\((kendra|trikona|dusthana)\)/i);
  if (mLord) {
    const src = BHAVA_NAMES[mLord[1]!.toLowerCase()] ?? mLord[1]!;
    const gr = GRAHA_LABELS[mLord[2]!] ?? mLord[2]!;
    const dst = BHAVA_NAMES[mLord[3]!.toLowerCase()] ?? mLord[3]!;
    const kind = mLord[4]!.toLowerCase() === 'dusthana' ? 'Testing Placement' : 'Pillar Placement';
    return `Rasi Chart: ${src} Ruler ${gr} placed in ${dst} (${kind})`;
  }
  const mDignity = raw.match(/^D1\.(h\d+)\s+lord\s+([A-Za-z]{2})\s+(exalted|own_sign|moolatrikona|vargottama|debilitated)/i);
  if (mDignity) {
    const src = BHAVA_NAMES[mDignity[1]!.toLowerCase()] ?? mDignity[1]!;
    const gr = GRAHA_LABELS[mDignity[2]!] ?? mDignity[2]!;
    const dig = mDignity[3]!.replace('_', ' ');
    return `Rasi & Navamsa Dignity: ${src} Ruler ${gr} in ${dig} strength`;
  }
  const mAsp = raw.match(/^D1\.(h\d+|[A-Za-z]{2})\s+aspected_by\s+([A-Za-z]{2})/i);
  if (mAsp) {
    const targetKey = mAsp[1]!;
    const target = BHAVA_NAMES[targetKey.toLowerCase()] ?? GRAHA_LABELS[targetKey] ?? targetKey;
    const by = GRAHA_LABELS[mAsp[2]!] ?? mAsp[2]!;
    const glance = mAsp[2] === 'Ju' || mAsp[2] === 'Ve' ? 'Benefic Drishti (Protective Glance)' : 'Direct Drishti (Testing Glance)';
    return `Rasi Chart: ${glance} from ${by} onto ${target}`;
  }
  const mOcc = raw.match(/^D1\.(h\d+)\s+occupant\s+([A-Za-z]{2})/i);
  if (mOcc) {
    const bh = BHAVA_NAMES[mOcc[1]!.toLowerCase()] ?? mOcc[1]!;
    const gr = GRAHA_LABELS[mOcc[2]!] ?? mOcc[2]!;
    return `Rasi Chart: ${gr} occupying ${bh}`;
  }
  const mSav = raw.match(/^SAV\.(h\d+)=(-?\d+)/i);
  if (mSav) {
    const bh = BHAVA_NAMES[mSav[1]!.toLowerCase()] ?? mSav[1]!;
    return `Sarvashtakavarga Strength: ${bh} carries ${mSav[2]} bindus`;
  }
  if (/neechabhanga/i.test(raw)) {
    return 'Neechabhanga Raja Resilience: Early vulnerability transforms into enduring mastery over time';
  }
  if (/viparita/i.test(raw)) {
    return 'Viparita Turning-Point Pattern: Pressure or upheaval clears the path for an unexpected breakthrough';
  }
  return area === 'love'
    ? 'Rasi & Navamsa 7th Bhava Covenant, Upapada (UL) Bond & Shukra Significator Alignment'
    : 'Rasi & Navamsa 1st/5th/9th Bhava Alignment with Atmakaraka & Chandra Strength';
}

function inferSubareaFromText(text: string, area: AreaId): { key: string; label: string } {
  const t = text.toLowerCase();
  if (area === 'love') {
    if (t.includes('romance')) return { key: 'romance', label: 'Romance & 5th Bhava Spark' };
    if (t.includes('friendship') || t.includes('friends')) return { key: 'friends', label: 'Friendships & 11th Bhava Alliances' };
    if (t.includes('deep bond') || t.includes('staying power')) return { key: 'commitment', label: 'Deep Bonding & 8th Bhava Covenant' };
    if (t.includes('home') || t.includes('warmth')) return { key: 'family_accept', label: 'Home Warmth & 4th Bhava Sanctuary' };
    return { key: 'health', label: 'Partnerships & 7th Bhava Covenant' };
  }
  if (t.includes('peace of mind') || t.includes('feelings') || t.includes('comfort')) return { key: 'mind', label: 'Peace of Mind & 4th Bhava Sanctuary' };
  if (t.includes('ideas') || t.includes('learning') || t.includes('judgment')) return { key: 'growth', label: 'Learning, Wit & 5th Bhava Clarity' };
  if (t.includes('purpose') || t.includes('grace') || t.includes('fortune')) return { key: 'purpose', label: 'Purpose & 9th Bhava Dharma' };
  if (t.includes('standing') || t.includes('work')) return { key: 'reputation', label: 'Public Standing & 10th Bhava Action' };
  if (t.includes('voice') || t.includes('initiative')) return { key: 'confidence', label: 'Confidence & 2nd/3rd Bhava Voice' };
  return { key: 'identity', label: 'Sense of Self & 1st Bhava Vitality' };
}

function buildEnrichedFindings(
  board: AreaBoard,
  cfg: AreaBoardConfig,
  kind: 'support' | 'pressure' | 'window' | 'all',
): EnrichedFindingItem[] {
  const items: EnrichedFindingItem[] = [];
  const leadWin = board.ahead[0] ?? null;

  if (kind === 'support' || kind === 'all') {
    board.supports.forEach((s: AreaSupportFinding, idx: number) => {
      const inferred = inferSubareaFromText(s.text, cfg.area);
      const matchingWin = board.ahead.find((w) => w.side === 'support' && w.subarea === inferred.key) ?? board.ahead.find((w) => w.side === 'support') ?? leadWin;
      const from = s.from ?? matchingWin?.from ?? board.asOf;
      const to = s.to ?? matchingWin?.to ?? board.tone.date ?? null;
      const dateLabel =
        s.dateLabel ??
        (from && to ? `Active window: ${longDate(from)} – ${longDate(to)}` : `Natal foundation · Active from ${longDate(board.asOf)}`);
      const aspects =
        s.aspectsAndPlacements && s.aspectsAndPlacements.length > 0
          ? s.aspectsAndPlacements
          : (s.evidence ?? []).map((ev) => formatEvidenceToken(ev, cfg.area));
      const techniqueId = s.techniqueId ?? `${cfg.area}.promise · ${cfg.area}.protection`;
      const reading =
        s.reading ??
        (cfg.area === 'love'
          ? `${s.text} In Vedic relationship analysis, this shows that your 7th Bhava covenant and Navamsa (D9) bonding capacity carry real staying power—when you lead with emotional honesty and unhurried presence, mutual trust deepens naturally during this window.`
          : `${s.text} In classical Vedic chart synthesis, this indicates a resilient structural pillar across your Rasi and Navamsa charts—giving you steady inner authority and reliable recovery even when external schedules feel busy.`);
      const natalPromise =
        s.natalPromise ??
        (cfg.area === 'love'
          ? `Rooted in ${inferred.label}: your natal chart promises enduring relational warmth when partnership commitments are built on shared values and calm communication.`
          : `Rooted in ${inferred.label}: your natal chart carries above-average structural strength here, supporting long-term self-trust and steady personal growth.`);
      const periodCharter =
        s.periodCharter ??
        (from && to
          ? `Time-Period Charter (${longDate(from)} – ${longDate(to)}): Main and sub-period timing clocks activate this natal strength right now—lean on this area for key conversations and commitments before ${longDate(to)}.`
          : `Time-Period Charter (Active across ${board.year?.year ?? new Date().getFullYear()}): Continuous foundational protection across your active timing periods.`);

      items.push({
        id: `support-${idx}`,
        kind: 'support',
        headline: s.text,
        subText: dateLabel,
        subareaKey: s.subCategory ?? inferred.key,
        subCategoryLabel: cfg.subareas[s.subCategory ?? ''] ?? inferred.label,
        from,
        to,
        dateLabel,
        side: 'support',
        reading,
        natalPromise,
        periodCharter,
        aspectsAndPlacements: aspects.length > 0 ? aspects : [formatEvidenceToken('', cfg.area)],
        techniqueId,
      });
    });
  }

  if (kind === 'pressure' || kind === 'all') {
    board.pressures.forEach((p: AreaPressureFinding, idx: number) => {
      const inferred = inferSubareaFromText(p.text, cfg.area);
      const from = p.from ?? board.asOf;
      const to = p.until ?? p.to ?? null;
      const subText = p.until ? `Eases by ${longDate(p.until)}` : 'A steady weight: it asks for care, not worry.';
      const dateLabel =
        p.dateLabel ??
        (p.until ? `${longDate(from)} – ${longDate(p.until)} (${subText})` : `Ongoing discipline · ${subText}`);
      const aspects =
        p.aspectsAndPlacements && p.aspectsAndPlacements.length > 0
          ? p.aspectsAndPlacements
          : (p.evidence ?? []).map((ev) => formatEvidenceToken(ev, cfg.area));
      const techniqueId = p.techniqueId ?? `${cfg.area}.affliction · ${cfg.area}.activation`;
      const reading =
        p.reading ??
        (cfg.area === 'love'
          ? `${p.text} ${subText}. In Vedic timing synthesis, a testing glance from Shani or a demanding Bhava placement asks for patience, clear spoken expectations, and zero rushed ultimatums until the pressure lifts.`
          : `${p.text} ${subText}. In Vedic timing synthesis, this pressure acts as a structural training weight—slowing down impulsive moves so you build cleaner boundaries and sustainable daily rhythms.`);
      const natalPromise =
        p.natalPromise ??
        (cfg.area === 'love'
          ? `Sensitivity in ${inferred.label}: this area matures through explicit agreements, unhurried listening, and giving both partners room to breathe.`
          : `Sensitivity in ${inferred.label}: this placement rewards methodical pacing and boundary-setting rather than overextending your energy.`);
      const periodCharter =
        p.periodCharter ??
        (p.until
          ? `Time-Period Charter (Now – ${longDate(p.until)}): The active timing clock tests this area until ${longDate(p.until)}, after which the weight visibly eases and forward momentum returns.`
          : `Time-Period Charter (Steady Natal Discipline): Manage this through steady weekly habits and clear boundaries rather than waiting for an overnight shift.`);

      items.push({
        id: `pressure-${idx}`,
        kind: 'pressure',
        headline: p.text,
        subText,
        subareaKey: p.subCategory ?? inferred.key,
        subCategoryLabel: cfg.subareas[p.subCategory ?? ''] ?? inferred.label,
        from,
        to,
        dateLabel,
        side: 'test',
        reading,
        natalPromise,
        periodCharter,
        aspectsAndPlacements: aspects.length > 0 ? aspects : [formatEvidenceToken('', cfg.area)],
        techniqueId,
      });
    });
  }

  if (kind === 'window' || kind === 'all') {
    board.ahead.forEach((w: AreaWindow, idx: number) => {
      const subLabel = cfg.subareas[w.subarea] ?? w.subarea;
      const dateLabel = w.dateLabel ?? `${longDate(w.from)} – ${longDate(w.to)}`;
      const sysCount = w.systems?.length ?? 1;
      const techniqueId = w.techniqueId ?? `${cfg.area}.activation`;
      const reading =
        w.reading ??
        (w.side === 'support'
          ? `${w.label} for ${subLabel.toLowerCase()} (${dateLabel}). Confirmed across ${sysCount} independent Vedic timing clock${sysCount > 1 ? 's' : ''}, making this a constructive window to initiate conversations, commit to plans, and build momentum.`
          : `${w.label} for ${subLabel.toLowerCase()} (${dateLabel}). Flagged by ${sysCount} Vedic timing clock${sysCount > 1 ? 's' : ''}, asking you to pace commitments, protect your rest, and avoid forcing outcomes until ${longDate(w.to)}.`);
      const natalPromise =
        w.natalPromise ??
        `Sub-area focus: ${subLabel} (${w.grade} ${w.side === 'support' ? 'opening' : 'testing'} grade in Rasi & Navamsa synthesis).`;
      const periodCharter =
        w.periodCharter ??
        `Time-Period Charter (${dateLabel}): ${sysCount} timing clock${sysCount > 1 ? 's' : ''} (${w.side === 'support' ? 'constructive activation' : 'deliberate pacing required'}) converge across this exact date range.`;
      const aspects =
        w.aspectsAndPlacements && w.aspectsAndPlacements.length > 0
          ? w.aspectsAndPlacements
          : [
              `Multi-Clock Activation: ${sysCount} independent period system${sysCount > 1 ? 's' : ''} aligned on ${subLabel}`,
              `Activation Grade: ${w.grade.toUpperCase()} (${w.side === 'support' ? 'Constructive Fruition Window' : 'Boundary & Patience Window'})`,
            ];

      items.push({
        id: `window-${w.subarea}-${idx}`,
        kind: 'window',
        headline: `${subLabel}: ${w.label}`,
        subText: dateLabel,
        subareaKey: w.subarea,
        subCategoryLabel: subLabel,
        from: w.from,
        to: w.to,
        dateLabel,
        side: w.side,
        reading,
        natalPromise,
        periodCharter,
        aspectsAndPlacements: aspects,
        techniqueId,
      });
    });
  }

  return items;
}

function matchesTimeframe(item: EnrichedFindingItem, tf: TimeframeFilter, asOf: string): boolean {
  if (tf === 'all') return true;
  if (tf === 'natal') return item.kind === 'support' || (item.kind === 'pressure' && !item.to);
  const baseMs = Date.parse(`${asOf}T00:00:00Z`) || Date.now();
  const fromMs = item.from ? Date.parse(`${item.from}T00:00:00Z`) : baseMs;
  const toMs = item.to ? Date.parse(`${item.to}T00:00:00Z`) : baseMs + 365 * 86_400_000;
  if (tf === 'active_now') return fromMs <= baseMs + 30 * 86_400_000 && toMs >= baseMs;
  if (tf === 'next_6m') return fromMs <= baseMs + 183 * 86_400_000 && toMs >= baseMs;
  if (tf === 'next_12m') return fromMs <= baseMs + 366 * 86_400_000 && toMs >= baseMs;
  if (tf === 'next_3y') return fromMs <= baseMs + 1095 * 86_400_000 && toMs >= baseMs;
  return true;
}

export default function AreaBoardView({ cfg }: { cfg: AreaBoardConfig }) {
  const [state, setState] = useState<AreaState | null>(() => getCachedArea(cfg.area));
  const extra = cfg.extraFirstTab ?? null;
  const [page, setPage] = useState<Page | string>(() => extra?.id ?? 'now');
  const [why, setWhy] = useState(false);
  const [focusFilter, setFocusFilter] = useState<string>('all');
  const [timeframeFilter, setTimeframeFilter] = useState<TimeframeFilter>('all');
  const polls = useRef(0);

  const load = () =>
    fetchArea(cfg.area)
      .then(setState)
      .catch(() => setState((prev) => prev ?? { kind: 'error' }));
  useEffect(() => {
    const cached = getCachedArea(cfg.area);
    if (cached) setState(cached);
    setFocusFilter((prev) => (prev !== 'all' && !cfg.subareas[prev] ? 'all' : prev));
    track('board_open', cfg.surface);
    void load();
  }, [cfg.area]);
  // a chart still being prepared is checked again every 30 s, up to 10 times
  useEffect(() => {
    if (state?.kind !== 'preparing' || polls.current >= 10) return;
    const t = setTimeout(() => {
      polls.current += 1;
      void load();
    }, 30_000);
    return () => clearTimeout(t);
  }, [state]);

  const shell = (body: ReactNode) => (
    <div className="w-full px-4 pb-24 pt-4 text-white sm:px-6 lg:px-10" data-testid={cfg.testId}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-3xl font-bold text-transparent">{cfg.title}</h1>
          {state?.kind === 'ok' && <ReadingStamp madeAt={state.madeAt} validUntil={state.validUntil} />}
        </div>
        <BoardAsk category={cfg.askCategory} />
      </div>
      {body}
    </div>
  );

  if (!state) return shell(<div className="p-2 text-white/70" data-testid="board-loading">Loading…</div>);
  if (state.kind === 'preparing') return shell(<div className={`${panel} text-white/80`} data-testid="board-preparing">Your chart is still being prepared. This page will update by itself.</div>);
  if (state.kind === 'no_kundli') return shell(<div className={`${panel} text-white/80`} data-testid="board-no-kundli">Add your birth details in your profile to see this board.</div>);
  if (state.kind === 'unavailable') return shell(<div className={`${panel} text-white/80`} data-testid="board-unavailable">{cfg.unavailable}</div>);
  if (state.kind === 'error')
    return shell(
      <div role="alert" className={`${panel} text-white/80`} data-testid="board-error">
        <p>This page did not load.</p>
        <button type="button" onClick={() => { setState(null); void load(); }} className={`${chip} mt-3 border-white/20 bg-white/5`}>
          Retry
        </button>
      </div>,
    );

  const { board, focus, ask, checks } = state;
  const answer = async (value: string | null) => {
    track('question_answer', cfg.surface, cfg.question.key, { value: value ?? 'declined' });
    await saveAreaFact(cfg.question.key, value);
    void load();
  };
  const PAGES: Array<[Page | string, string]> = [
    ...(extra ? ([[extra.id, extra.label]] as Array<[string, string]>) : []),
    ['now', 'Now'],
    ['holds', cfg.holdsTitle],
    ['presses', cfg.pressesTitle],
    ['ahead', 'Ahead'],
    ['back', 'Looking back'],
    ['questions', 'Your questions'],
  ];
  const supVotes = board.tone.families.filter((f) => f.vote === 'support').length;
  const testVotes = board.tone.families.filter((f) => f.vote === 'test').length;

  return shell(
    <>
      {ask && (
        <div className={`${panel} mb-4`} data-testid="board-question">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="font-medium">{cfg.question.text}</div>
            <span className={techBadgeClass} data-testid="question-technique-badge">
              {cfg.question.key} · Companion Fact Selector
            </span>
          </div>
          <p className="mb-3 text-xs text-white/60">
            Why we ask: highlights the sub-area and timing windows most relevant to your life right now.
          </p>
          <div className="flex flex-wrap gap-2">
            {cfg.question.options.map((o) => (
              <button key={o.label} type="button" onClick={() => void answer(o.value)} className={`${chip} border-white/20 bg-white/5`}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <section className={`${panel} mb-4`} data-testid="tone-card" data-tone={board.tone.tone}>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm uppercase tracking-wide text-white/60">
            <span aria-hidden>{TONE_ICON[board.tone.tone]}</span>
            {TONE_WORD[board.tone.tone]}
          </div>
          <span className={techBadgeClass} data-testid="panel-technique-badge">
            {cfg.area}.activation · Present Tone Consensus
          </span>
        </div>
        <h2 className="text-2xl font-semibold leading-snug">{cfg.headline(board, focus)}</h2>
        {CONFIDENCE_LINE[board.tone.confidence] && <p className="mt-2 text-sm text-white/60">{CONFIDENCE_LINE[board.tone.confidence]}</p>}

        <div className="mt-3 grid gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/75 sm:grid-cols-3" data-testid="tone-summary-grid">
          <div>
            <span className="block font-semibold uppercase tracking-wide text-purple-200">Timing Clocks</span>
            <span>
              {supVotes} supporting · {testVotes} testing of {board.tone.families.length} clocks
            </span>
          </div>
          <div>
            <span className="block font-semibold uppercase tracking-wide text-purple-200">Core Strength</span>
            <span>{board.supports[0]?.text ?? 'Steady foundational footing across your chart.'}</span>
          </div>
          <div>
            <span className="block font-semibold uppercase tracking-wide text-purple-200">Key Horizon</span>
            <span>
              {board.pressures[0]?.until
                ? `Primary pressure eases by ${longDate(board.pressures[0].until)}`
                : board.ahead[0]
                  ? `${longDate(board.ahead[0].from)} – ${longDate(board.ahead[0].to)}`
                  : 'Steady rhythm across this period'}
            </span>
          </div>
        </div>

        <button type="button" onClick={() => { setWhy(true); track('why_open', cfg.surface, 'tone'); }} className="mt-3 min-h-[44px] text-sm text-purple-300 underline underline-offset-4">
          Why we think so
        </button>
      </section>

      <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div role="tablist" aria-label={`${cfg.title} pages`} className="flex flex-1 gap-1 overflow-x-auto glass rounded-xl p-1">
          {PAGES.map(([p, label]) => (
            <button key={p} role="tab" type="button" aria-selected={page === p} onClick={() => { setPage(p); track('tab_select', cfg.surface, p); }} className={`min-h-[44px] flex-1 whitespace-nowrap rounded-lg px-4 text-sm ${page === p ? 'bg-white/15 text-white' : 'text-white/60'}`}>
              {label}
            </button>
          ))}
        </div>

        {(!extra || page !== extra.id) && (
          <div className="flex flex-wrap items-center gap-2 glass rounded-xl px-3 py-1.5" data-testid="board-filter-bar">
            <label className="flex items-center gap-1.5 text-xs text-white/70">
              <span className="font-medium text-purple-200">Focus on:</span>
              <select
                aria-label="Focus on"
                data-testid="board-focus-dropdown"
                value={focusFilter}
                onChange={(e) => {
                  setFocusFilter(e.target.value);
                  track('chip_select', cfg.surface, `focus_${e.target.value}`);
                }}
                className="rounded-lg border border-white/15 bg-[#141233] px-2.5 py-1.5 text-xs text-white focus:border-purple-400 focus:outline-none"
              >
                <option value="all">All sub-areas</option>
                {Object.entries(cfg.subareas).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
  
            <label className="flex items-center gap-1.5 text-xs text-white/70">
              <span className="font-medium text-purple-200">Time frame:</span>
              <select
                aria-label="Time frame"
                data-testid="board-timeframe-dropdown"
                value={timeframeFilter}
                onChange={(e) => {
                  setTimeframeFilter(e.target.value as TimeframeFilter);
                  track('chip_select', cfg.surface, `timeframe_${e.target.value}`);
                }}
                className="rounded-lg border border-white/15 bg-[#141233] px-2.5 py-1.5 text-xs text-white focus:border-purple-400 focus:outline-none"
              >
                <option value="all">All time frames</option>
                <option value="active_now">Active now</option>
                <option value="next_6m">Next 6 months</option>
                <option value="next_12m">This year (12 months)</option>
                <option value="next_3y">3-year horizon</option>
                <option value="natal">Natal promise (lifelong)</option>
              </select>
            </label>
          </div>
        )}
      </div>

      {extra && page === extra.id && <div data-testid={`board-page-${extra.id}`}>{extra.render()}</div>}
      {page === 'now' && <NowPage board={board} focus={focus} cfg={cfg} focusFilter={focusFilter} timeframeFilter={timeframeFilter} />}
      {page === 'holds' && (
        <FindingsMasterDetail
          testId="holds"
          empty="Nothing stands out yet."
          techniqueBadge={`${cfg.area}.promise · ${cfg.area}.protection`}
          items={buildEnrichedFindings(board, cfg, 'support')}
          focusFilter={focusFilter}
          timeframeFilter={timeframeFilter}
          asOf={board.asOf}
        />
      )}
      {page === 'presses' && (
        <FindingsMasterDetail
          testId="presses"
          empty="Nothing is pressing on this now."
          techniqueBadge={`${cfg.area}.affliction · ${cfg.area}.activation`}
          items={buildEnrichedFindings(board, cfg, 'pressure')}
          focusFilter={focusFilter}
          timeframeFilter={timeframeFilter}
          asOf={board.asOf}
        />
      )}
      {page === 'ahead' && <AheadPage board={board} focus={focus} cfg={cfg} focusFilter={focusFilter} timeframeFilter={timeframeFilter} />}
      {page === 'back' && <BackPage board={board} checks={checks} cfg={cfg} onAnswered={() => void load()} />}
      {page === 'questions' && <QuestionsPage board={board} cfg={cfg} timeframeFilter={timeframeFilter} />}

      {why && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" role="dialog" aria-modal="true" aria-label="Why we think so" onClick={() => setWhy(false)}>
          <div className="w-full max-w-md rounded-t-3xl border border-white/10 bg-[#141233] p-5 sm:rounded-3xl" onClick={(e) => e.stopPropagation()} data-testid="why-sheet">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Why we think so</h2>
              <button type="button" aria-label="Close" onClick={() => setWhy(false)} className="min-h-[44px] min-w-[44px] text-white/60">✕</button>
            </div>
            <p className="mb-3 text-sm text-white/70">
              {board.tone.families.filter((f) => f.vote !== 'neutral').length} of {board.tone.families.length} independent signals have a view.
            </p>
            <ul className="space-y-1 text-sm text-white/80">
              {board.tone.families.map((f) => {
                const words = f.family === 'short' ? VOTE_WORDS_PLURAL : VOTE_WORDS;
                return (
                  <li key={f.family}>
                    {FAMILY_WORDS[f.family] ?? 'Another signal'} {words[f.vote]}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </>,
  );
}

function NowPage({
  board,
  focus,
  cfg,
  focusFilter,
  timeframeFilter,
}: {
  board: AreaBoard;
  focus: string | null;
  cfg: AreaBoardConfig;
  focusFilter: string;
  timeframeFilter: TimeframeFilter;
}) {
  const effectiveFocus = focusFilter !== 'all' ? focusFilter : focus;
  const lead = board.ahead.find((w) => w.subarea === effectiveFocus) ?? board.ahead[0] ?? null;
  const allFindings = useMemo(() => buildEnrichedFindings(board, cfg, 'all'), [board, cfg]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className={panel} data-testid="year-card">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs uppercase tracking-wide text-white/50">This year</div>
            <span className={techBadgeClass} data-testid="panel-technique-badge">
              {cfg.area}.annual · Annual Solar Return
            </span>
          </div>
          <div className="mt-1 text-lg font-semibold">{board.year ? board.year.note : "This year's chart is not ready yet."}</div>
          {board.year && (
            <div className="mt-1 text-xs text-white/60">
              {board.year.year} annual return synthesis across your active timing periods.
            </div>
          )}
        </div>
        <div className={panel} data-testid="lead-card">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs uppercase tracking-wide text-white/50">{lead ? cfg.subareas[lead.subarea] ?? 'Next' : 'Next'}</div>
            <span className={techBadgeClass} data-testid="panel-technique-badge">
              {cfg.area}.activation · Lead Timing Window
            </span>
          </div>
          <div className="mt-1 text-lg font-semibold">{lead ? `${lead.label}, ${longDate(lead.from)} – ${longDate(lead.to)}` : cfg.emptyAhead}</div>
          {lead && (
            <div className="mt-1 text-xs text-white/60">
              {lead.systems.length} independent timing clock{lead.systems.length > 1 ? 's' : ''} aligned ({lead.grade} {lead.side === 'support' ? 'opening' : 'pacing'} window).
            </div>
          )}
        </div>
      </div>

      {cfg.area === 'self' && board.characterArc && (
        <section className={panel} data-testid="self-character-arc">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs uppercase tracking-wide text-purple-300">Character Evolution (Last 10 Years → Now → Next 10 Years)</div>
            <span className={techBadgeClass} data-testid="panel-technique-badge">
              self.character_arc · 3-Decade Character Evolution
            </span>
          </div>
          <h3 className="mt-1 text-lg font-semibold text-white">{board.characterArc.headline}</h3>
          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            {[board.characterArc.pastDecade, board.characterArc.presentNow, board.characterArc.nextDecade].map((st) => (
              <div key={st.stage} className="rounded-xl border border-white/10 bg-white/5 p-3.5" data-testid={`character-stage-${st.stage}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-purple-200">{st.label}</span>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/75">{st.windowLabel}</span>
                </div>
                <div className="mt-1.5 font-medium text-white">{st.headline}</div>
                <p className="mt-1 text-sm leading-relaxed text-white/75">{st.summary}</p>
                <div className="mt-2 text-xs text-purple-200/90">Core quality: {st.anchorTrait}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {cfg.area === 'self' && board.personalityAndJoy && (
        <section className={panel} data-testid="self-personality-joy">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs uppercase tracking-wide text-pink-300">Your Personality & What Makes You Feel Good</div>
            <span className={techBadgeClass} data-testid="panel-technique-badge">
              self.personality_joy · Mind, Wit & Joy Synthesis
            </span>
          </div>
          <h3 className="mt-1 text-lg font-semibold text-white">{board.personalityAndJoy.headline}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-white/80">{board.personalityAndJoy.personalitySummary}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-purple-200">Emotional Rhythm & Comfort</div>
              <p className="mt-1 text-sm text-white/75">{board.personalityAndJoy.emotionalMindStyle}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-pink-200">Curiosity, Wit & Expression</div>
              <p className="mt-1 text-sm text-white/75">{board.personalityAndJoy.intellectualWitStyle}</p>
            </div>
          </div>
          {board.personalityAndJoy.whatFeelsGood.length > 0 && (
            <div className="mt-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/60">What You Naturally Enjoy & Recharge With</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {board.personalityAndJoy.whatFeelsGood.map((item, idx) => (
                  <div key={idx} className="rounded-xl border border-white/10 bg-white/5 p-3" data-testid={`joy-item-${idx}`}>
                    <div className="font-medium text-white">{item.title}</div>
                    <div className="mt-0.5 text-xs text-white/70">{item.whyItFits}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="mt-3 rounded-xl border border-purple-400/20 bg-purple-500/10 px-3 py-2 text-xs text-purple-100">
            {board.personalityAndJoy.rechargeRule}
          </div>
        </section>
      )}

      {cfg.area === 'love' && <LoveVedicDeepDive board={board} lead={lead} />}

      {allFindings.length > 0 && (
        <section className="space-y-2" data-testid="now-oracle-explorer">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <div className="text-xs font-semibold uppercase tracking-wide text-purple-200">
              Astrology Oracle Findings & Time-Period Charter
            </div>
            <span className={techBadgeClass} data-testid="panel-technique-badge">
              {cfg.area}.promise · {cfg.area}.activation
            </span>
          </div>
          <FindingsMasterDetail
            testId="now-findings"
            empty="Nothing stands out for this filter."
            techniqueBadge={`${cfg.area}.promise · ${cfg.area}.activation`}
            items={allFindings}
            focusFilter={focusFilter}
            timeframeFilter={timeframeFilter}
            asOf={board.asOf}
          />
        </section>
      )}
    </div>
  );
}

function LoveVedicDeepDive({ board, lead }: { board: AreaBoard; lead: AreaWindow | null }) {
  const yearNum = board.year?.year ?? (Number(board.asOf.slice(0, 4)) || 2026);
  const supText = board.supports[0]?.text ?? 'Steady relational integrity in your 7th Bhava covenant.';
  const pressText = board.pressures[0]?.text ?? 'Deliberate pacing around emotional expectations.';
  const nextRange = lead ? `${longDate(lead.from)} – ${longDate(lead.to)}` : `${yearNum}–${yearNum + 3}`;
  const arc = board.characterArc;
  const chem = board.personalityAndJoy;

  return (
    <>
      <section className={panel} data-testid="love-relationship-arc">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs uppercase tracking-wide text-purple-300">
            Love & Relationship Evolution (Last 10 Years → How You Show Up in Love Now → Next 10 Years)
          </div>
          <span className={techBadgeClass} data-testid="panel-technique-badge">
            love.character_arc · love.relationship_arc
          </span>
        </div>
        <h3 className="mt-1 text-lg font-semibold text-white">
          {arc?.headline ?? 'How your approach to intimacy, commitment, and mutual devotion matures across three chapters'}
        </h3>
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3.5" data-testid="love-stage-past_10y">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-purple-200">{arc?.pastDecade.label ?? 'Last 10 Years'}</span>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/75">{arc?.pastDecade.windowLabel ?? `${yearNum - 10}–${yearNum}`}</span>
            </div>
            <div className="mt-1.5 font-medium text-white">{arc?.pastDecade.headline ?? 'Clarifying Boundaries & Darapada (A7) Attraction'}</div>
            <p className="mt-1 text-sm leading-relaxed text-white/75">
              {arc?.pastDecade.summary ??
                'Over the last decade, your chart tested the difference between surface chemistry (Darapada A7) and true emotional sanctuary (Upapada UL)—teaching you never to trade inner peace for approval.'}
            </p>
            <div className="mt-2 text-xs text-purple-200/90">Core quality: {arc?.pastDecade.anchorTrait ?? 'Selective relational trust'}</div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3.5" data-testid="love-stage-now">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-purple-200">{arc?.presentNow.label ?? 'How You Show Up in Love Now'}</span>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/75">{arc?.presentNow.windowLabel ?? String(yearNum)}</span>
            </div>
            <div className="mt-1.5 font-medium text-white">{arc?.presentNow.headline ?? '7th Bhava & Navamsa Alignment'}</div>
            <p className="mt-1 text-sm leading-relaxed text-white/75">
              {arc?.presentNow.summary ?? `${supText} ${pressText} Right now your Shukra and 7th Bhava synthesis rewards direct, unhurried honesty over guessing games.`}
            </p>
            <div className="mt-2 text-xs text-purple-200/90">
              {arc?.presentNow.anchorTrait ? `Core quality: ${arc.presentNow.anchorTrait} · Active window: ${nextRange}` : `Active window: ${nextRange}`}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3.5" data-testid="love-stage-next_10y">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-purple-200">{arc?.nextDecade.label ?? 'Next 10 Years'}</span>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/75">{arc?.nextDecade.windowLabel ?? `${yearNum}–${yearNum + 10}`}</span>
            </div>
            <div className="mt-1.5 font-medium text-white">{arc?.nextDecade.headline ?? 'Enduring Covenant & Shared Sanctuary'}</div>
            <p className="mt-1 text-sm leading-relaxed text-white/75">
              {arc?.nextDecade.summary ??
                'As your Navamsa (D9) and Darakaraka promise matures over the coming decade, partnership shifts toward a deeply settled alliance rooted in shared home warmth (4th Bhava) and mutual respect.'}
            </p>
            <div className="mt-2 text-xs text-purple-200/90">
              {arc?.nextDecade.anchorTrait ? `Core quality: ${arc.nextDecade.anchorTrait}` : 'Fruition anchor: Upapada (UL) & Guru protective grace'}
            </div>
          </div>
        </div>
      </section>

      <section className={panel} data-testid="love-partner-chemistry">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs uppercase tracking-wide text-pink-300">
            Your Love Personality & Partner Blueprint (Darakaraka DK · Upapada UL · Navamsa 7th Bhava · Shukra)
          </div>
          <span className={techBadgeClass} data-testid="panel-technique-badge">
            love.personality_partner · love.partner_chemistry
          </span>
        </div>
        <h3 className="mt-1 text-lg font-semibold text-white">
          {chem?.headline ?? 'Deep loyalty and emotional candor paired with warm, observant devotion'}
        </h3>
        <p className="mt-1 text-sm leading-relaxed text-white/80">
          {chem?.personalitySummary ??
            'In relationships you show love through reliability, thoughtful acts, and protecting your partner’s peace of mind rather than loud performative gestures.'}
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-purple-200">How You Bond Emotionally (Chandra & 4th/8th Bhava)</div>
            <p className="mt-1 text-sm text-white/75">
              {chem?.emotionalMindStyle ??
                'You bond most deeply when consistency matches words. Calm domestic rituals, kept promises, and unhurried one-on-one time unlock your deepest affection.'}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-pink-200">Communication & Affection Style (5th Bhava & Shukra)</div>
            <p className="mt-1 text-sm text-white/75">
              {chem?.intellectualWitStyle ??
                'Playful intellectual rapport, shared creative projects, and warm appreciation keep romance alive even during busy or demanding timing stretches.'}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-purple-200">Partner Archetype That Fits You (Darakaraka DK & Upapada UL)</div>
            <p className="mt-1 text-sm text-white/75">
              {chem?.whatFeelsGood?.[0]?.whyItFits ??
                'You thrive with a partner who is emotionally self-aware, grounded in their own craft, and steady in communication—someone who values calm partnership over drama.'}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-pink-200">What Builds vs. Drains Trust (7th Bhava & Shani Balance)</div>
            <p className="mt-1 text-sm text-white/75">
              {chem?.rechargeRule ??
                'Directness and shared follow-through build unshakeable trust; unspoken expectations or rushed ultimatums during testing periods drain closeness fastest.'}
            </p>
          </div>
        </div>
      </section>
    </>
  );
}

function FindingsMasterDetail({
  items,
  empty,
  testId,
  techniqueBadge,
  focusFilter,
  timeframeFilter,
  asOf,
}: {
  items: EnrichedFindingItem[];
  empty: string;
  testId: string;
  techniqueBadge: string;
  focusFilter: string;
  timeframeFilter: TimeframeFilter;
  asOf: string;
}) {
  const filtered = useMemo(() => {
    const byFocus = focusFilter === 'all' ? items : items.filter((it) => it.subareaKey === focusFilter);
    const byTf = byFocus.filter((it) => matchesTimeframe(it, timeframeFilter, asOf));
    return byTf.length > 0 ? byTf : items;
  }, [items, focusFilter, timeframeFilter, asOf]);

  const [selectedId, setSelectedId] = useState<string | null>(filtered[0]?.id ?? null);

  useEffect(() => {
    if (!filtered.some((it) => it.id === selectedId)) {
      setSelectedId(filtered[0]?.id ?? null);
    }
  }, [filtered, selectedId]);

  if (!items.length) {
    return (
      <div className={panel} data-testid={testId}>
        <div className="mb-2 flex items-center justify-end">
          <span className={techBadgeClass} data-testid="panel-technique-badge">
            {techniqueBadge}
          </span>
        </div>
        {empty}
      </div>
    );
  }

  const selected = filtered.find((it) => it.id === selectedId) ?? filtered[0]!;

  return (
    <div className="grid gap-4 lg:grid-cols-12" data-testid={testId}>
      {/* Left column: selectable list view of Oracle findings */}
      <ul className="space-y-2.5 lg:col-span-5" data-testid="findings-list-view">
        {filtered.map((item, idx) => {
          const isSelected = item.id === selected.id;
          return (
            <li key={item.id}>
              <button
                type="button"
                data-testid={`finding-item-${idx}`}
                aria-selected={isSelected}
                onClick={() => setSelectedId(item.id)}
                className={`w-full rounded-2xl border p-3.5 text-left transition ${
                  isSelected
                    ? 'border-purple-400/60 bg-purple-500/15 shadow-lg shadow-purple-950/30'
                    : 'border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/10'
                }`}
              >
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1.5">
                  <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-purple-200">
                    {item.subCategoryLabel}
                  </span>
                  <span className={techBadgeClass} data-testid="panel-technique-badge">
                    {item.techniqueId}
                  </span>
                </div>
                <div className="font-medium text-white">{item.headline}</div>
                {item.subText && <div className="mt-1 text-sm text-white/65">{item.subText}</div>}
              </button>
            </li>
          );
        })}
      </ul>

      {/* Right column: selected finding's detailed Vedic reading, dates, aspects & time-period charter */}
      <div className={`${panel} lg:col-span-7`} data-testid="finding-detail-panel">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-purple-300">{selected.subCategoryLabel}</span>
            <h3 className="mt-0.5 text-xl font-semibold text-white">{selected.headline}</h3>
          </div>
          <span className={techBadgeClass} data-testid="panel-technique-badge">
            {selected.techniqueId}
          </span>
        </div>

        <div className="mb-3 inline-flex items-center gap-2 rounded-xl border border-purple-400/25 bg-purple-500/10 px-3 py-1.5 text-xs font-medium text-purple-100" data-testid="finding-detail-dates">
          <span>Time Window:</span>
          <span>{selected.dateLabel}</span>
        </div>

        <div className="space-y-3 text-sm leading-relaxed text-white/85">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-white/50">Astrology Oracle Reading</div>
            <p className="mt-1" data-testid="finding-detail-reading">{selected.reading}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-purple-200">Natal Promise</div>
              <p className="mt-1 text-xs leading-relaxed text-white/75" data-testid="finding-detail-promise">
                {selected.natalPromise}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-pink-200">Time-Period Charter</div>
              <p className="mt-1 text-xs leading-relaxed text-white/75" data-testid="finding-detail-charter">
                {selected.periodCharter}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-purple-200">
              Vedic Placements, Aspects & Strength Signals
            </div>
            <ul className="mt-1.5 space-y-1 text-xs text-white/80" data-testid="finding-detail-aspects">
              {selected.aspectsAndPlacements.map((asp, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-purple-300">•</span>
                  <span>{asp}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function windowLine(w: AreaWindow): string {
  return `${longDate(w.from)} – ${longDate(w.to)}`;
}

function SubareaPanel({ id, windows, cfg }: { id: string; windows: AreaWindow[]; cfg: AreaBoardConfig }) {
  return (
    <div className={panel} data-testid={`ahead-${id}`}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs uppercase tracking-wide text-white/50">{cfg.subareas[id] ?? id}</div>
        <span className={techBadgeClass} data-testid="panel-technique-badge">
          {cfg.area}.activation · {id}
        </span>
      </div>
      <ul className="space-y-3">
        {windows.map((w, i) => (
          <li key={i}>
            <div className="font-medium">{w.label}</div>
            <div className="text-sm text-white/70">{windowLine(w)}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AheadPage({
  board,
  focus,
  cfg,
  focusFilter,
  timeframeFilter,
}: {
  board: AreaBoard;
  focus: string | null;
  cfg: AreaBoardConfig;
  focusFilter: string;
  timeframeFilter: TimeframeFilter;
}) {
  const subs = [...new Set(board.ahead.map((w) => w.subarea))];
  const [sel, setSel] = useState<string | null>(focus && subs.includes(focus) ? focus : subs[0] ?? null);
  const rail = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (focusFilter !== 'all' && subs.includes(focusFilter)) {
      setSel(focusFilter);
    }
  }, [focusFilter]);

  if (!subs.length || !sel) return <div className={panel} data-testid="ahead-empty">{cfg.emptyAhead}</div>;
  const pick = (s: string) => {
    setSel(s);
    track('chip_select', cfg.surface, `ahead_${s}`);
    const el = rail.current?.querySelector<HTMLElement>(`[data-slide="${s}"]`);
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
  };
  const onScroll = () => {
    const r = rail.current;
    if (!r || !r.clientWidth) return;
    const i = Math.round(r.scrollLeft / r.clientWidth);
    if (subs[i] && subs[i] !== sel) setSel(subs[i]!);
  };
  const windowItems = buildEnrichedFindings(board, cfg, 'window');

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Ahead by topic" className="mb-3 flex gap-2 overflow-x-auto">
        {subs.map((s) => (
          <button key={s} role="tab" type="button" aria-selected={sel === s} onClick={() => pick(s)} className={`${chip} ${sel === s ? 'border-white/40 bg-white/15' : 'border-white/10 text-white/60'}`}>
            {cfg.subareas[s] ?? s}
          </button>
        ))}
      </div>
      {/* phone and tablet: a swipeable carousel with dots */}
      <div className="lg:hidden">
        <div ref={rail} onScroll={onScroll} className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2" data-testid="ahead-carousel">
          {subs.map((s) => (
            <div key={s} data-slide={s} className="w-full shrink-0 snap-start">
              <SubareaPanel id={s} windows={board.ahead.filter((w) => w.subarea === s)} cfg={cfg} />
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-center gap-1.5" aria-hidden="true">
          {subs.map((s) => (
            <span key={s} className={`h-1.5 w-1.5 rounded-full ${sel === s ? 'bg-white' : 'bg-white/30'}`} />
          ))}
        </div>
      </div>
      {/* desktop: a tab panel */}
      <div className="hidden lg:block" role="tabpanel" data-testid="ahead-tabpanel">
        <SubareaPanel id={sel} windows={board.ahead.filter((w) => w.subarea === sel)} cfg={cfg} />
      </div>

      {/* Master-Detail Explorer for Ahead Timing Windows */}
      <FindingsMasterDetail
        testId="ahead-master-detail"
        empty={cfg.emptyAhead}
        techniqueBadge={`${cfg.area}.activation`}
        items={windowItems}
        focusFilter={focusFilter !== 'all' ? focusFilter : sel}
        timeframeFilter={timeframeFilter}
        asOf={board.asOf}
      />
    </div>
  );
}

function BackPage({ board, checks, cfg, onAnswered }: { board: AreaBoard; checks: Record<string, string>; cfg: AreaBoardConfig; onAnswered: () => void }) {
  const answered = board.back.filter((b) => checks[b.month] && checks[b.month] !== 'skip');
  const yes = answered.filter((b) => checks[b.month] === 'yes').length;
  if (board.back.length === 0) return <div className={panel} data-testid="back-empty">{cfg.emptyBack}</div>;
  const answer = async (b: AreaBoard['back'][number], a: 'yes' | 'partly' | 'no' | 'skip') => {
    track('question_answer', cfg.surface, 'looking_back', { answer: a });
    await sendAreaCheck(cfg.area, b.month, b.side, a);
    onAnswered();
  };
  return (
    <div>
      {answered.length > 0 && <p className="mb-3 text-white/70" data-testid="confirmed-line">You confirmed {yes} of {answered.length}.</p>}
      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2">
        {board.back.map((b) => (
          <div key={b.month} className={`${panel} w-[85%] shrink-0 snap-start sm:w-[48%]`} data-testid={`back-${b.month}`}>
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs uppercase tracking-wide text-white/50">{monthName(b.month)}</div>
              <span className={techBadgeClass} data-testid="panel-technique-badge">
                {cfg.area}.calibration · Past Window Check
              </span>
            </div>
            <div className="mt-1 font-medium">Around then, {b.label}.</div>
            {checks[b.month] ? (
              <div className="mt-3 text-sm text-white/60">Thanks — noted.</div>
            ) : (
              <>
                <div className="mt-3 text-sm text-white/70">Did that feel right?</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(['yes', 'partly', 'no', 'skip'] as const).map((a) => (
                    <button key={a} type="button" onClick={() => void answer(b, a)} className={`${chip} border-white/20 bg-white/5`}>
                      {a === 'yes' ? 'Yes' : a === 'partly' ? 'Partly' : a === 'no' ? 'Not really' : 'Skip'}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const LOVE_QUESTION_TOPICS: Array<{ id: string; label: string; subareas: string[]; bhavaRef: string }> = [
  { id: 'meet', label: 'Meeting someone', subareas: ['meet', 'romance', 'friends'], bhavaRef: '7th & 5th Bhava · Darakaraka & Upapada Opening' },
  { id: 'commitment', label: 'Commitment & marriage', subareas: ['commitment', 'health'], bhavaRef: '7th Bhava Covenant · Upapada (UL) & Navamsa Alignment' },
  { id: 'closeness', label: 'Deepening closeness', subareas: ['romance', 'health', 'commitment'], bhavaRef: '5th & 8th Bhava · Shukra & Chandra Bonding' },
  { id: 'repair', label: 'Repairing tension', subareas: ['reconcile', 'strain', 'delay'], bhavaRef: '7th Bhava & Guru Protective Drishti Resolution' },
  { id: 'home_family', label: 'Home & family bond', subareas: ['family_accept', 'health', 'friends'], bhavaRef: '2nd & 4th Bhava · Shared Sanctuary & Family Harmony' },
];

const YOU_QUESTION_TOPICS: Array<{ id: string; label: string; subareas: string[]; bhavaRef: string }> = [
  { id: 'fresh_chapter', label: 'Fresh life chapter', subareas: ['turning_point', 'identity', 'empowerment'], bhavaRef: '1st & 9th Bhava · Atmakaraka & Main Period Shift' },
  { id: 'home_relocation', label: 'Home & relocation', subareas: ['mind', 'turning_point'], bhavaRef: '4th & 12th Bhava · Sanctuary & Place Transition' },
  { id: 'wealth_security', label: 'Wealth & security', subareas: ['empowerment', 'reputation'], bhavaRef: '2nd & 11th Bhava · Resource & Stability Foundation' },
  { id: 'learning_mastery', label: 'Learning & mastery', subareas: ['growth', 'purpose'], bhavaRef: '5th & 9th Bhava · Budha & Guru Discernment' },
  { id: 'energy_peace', label: 'Energy & inner peace', subareas: ['mind', 'confidence', 'identity'], bhavaRef: '1st & 4th Bhava · Chandra & Surya Vitality' },
];

function QuestionsPage({
  board,
  cfg,
  timeframeFilter,
}: {
  board: AreaBoard;
  cfg: AreaBoardConfig;
  timeframeFilter: TimeframeFilter;
}) {
  const topics = cfg.area === 'love' ? LOVE_QUESTION_TOPICS : YOU_QUESTION_TOPICS;
  const [selectedTopic, setSelectedTopic] = useState<string>(topics[0]!.id);
  const currentTopic = topics.find((t) => t.id === selectedTopic) ?? topics[0]!;

  const items = useMemo((): EnrichedFindingItem[] => {
    const matchedWindows = board.ahead.filter((w) => currentTopic.subareas.includes(w.subarea));
    const windowsToUse = matchedWindows.length > 0 ? matchedWindows : board.ahead;
    const totalClocks = Math.max(board.tone.families.length, 5);

    if (windowsToUse.length > 0) {
      return windowsToUse.map((w, idx) => {
        const clockNames = (w.systems ?? []).map((s) => SYSTEM_CLOCK_NAMES[s] ?? 'Main Period Clock');
        const agreeCount = Math.max(w.systems?.length ?? 1, w.grade === 'strong' ? 3 : 2);
        const dateLabel = `${longDate(w.from)} – ${longDate(w.to)}`;
        const openingLabel =
          w.side === 'test'
            ? 'Pace & boundary window'
            : w.grade === 'strong'
              ? 'A strong opening'
              : w.grade === 'moderate'
                ? 'A good opening'
                : 'A small opening';
        const subText = `${openingLabel} · ${agreeCount} of ${totalClocks} Vedic timing clocks align (${clockNames.join(' · ')})`;
        return {
          id: `q-${currentTopic.id}-${idx}`,
          kind: 'window',
          headline: `${dateLabel} — ${w.label}`,
          subText,
          subareaKey: w.subarea,
          subCategoryLabel: currentTopic.label,
          from: w.from,
          to: w.to,
          dateLabel,
          side: w.side,
          reading: `${w.label} for ${currentTopic.label.toLowerCase()} (${dateLabel}). ${agreeCount} of ${totalClocks} independent Vedic timing clocks align across this window (${clockNames.join(', ')}), making it a clear period to ${w.side === 'support' ? 'move forward with confidence and concrete commitments' : 'move with patience, clear boundaries, and unhurried dialogue'}.`,
          natalPromise: `${currentTopic.bhavaRef}: ${board.supports[0]?.text ?? 'Supported by your natal Rasi and Navamsa foundation.'}`,
          periodCharter: `Time-Period Charter (${dateLabel}): ${agreeCount} of ${totalClocks} Vedic timing clocks align (${clockNames.join(' + ')}).`,
          aspectsAndPlacements: [
            `Timing Clocks Aligned (${agreeCount} of ${totalClocks}): ${clockNames.join(' · ')}`,
            `Classical Bhava Focus: ${currentTopic.bhavaRef}`,
            ...(board.supports[0]?.evidence ?? []).map((ev) => formatEvidenceToken(ev, cfg.area)),
          ],
          techniqueId: `${cfg.area}.activation · ${currentTopic.id}`,
        };
      });
    }

    return buildEnrichedFindings(board, cfg, 'all');
  }, [board, cfg, currentTopic]);

  return (
    <div className="space-y-4" data-testid="questions-page">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Question topics">
          {topics.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={selectedTopic === t.id}
              onClick={() => {
                setSelectedTopic(t.id);
                track('worry_open', cfg.surface, t.id);
              }}
              className={`${chip} ${selectedTopic === t.id ? 'border-white/40 bg-white/15 text-white' : 'border-white/10 text-white/60'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <span className={techBadgeClass} data-testid="panel-technique-badge">
          {cfg.area}.activation · Multi-Clock Topic Windows
        </span>
      </div>

      <FindingsMasterDetail
        testId="questions-master-detail"
        empty={cfg.emptyAhead}
        techniqueBadge={`${cfg.area}.activation · ${currentTopic.id}`}
        items={items}
        focusFilter="all"
        timeframeFilter={timeframeFilter}
        asOf={board.asOf}
      />
    </div>
  );
}
