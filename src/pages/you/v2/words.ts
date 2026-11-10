/**
 * Every word the Self board v2 says that is not from the server (server docs/reading-engine/66 §4.6, §4.7 and the
 * mockup). Plain words only: no technique id, internal label, chart term, clock count or engine name on a card face or
 * the hero. Chart details may carry chart terms; those come from the server.
 */
import { longDate } from '../../../lib/careerApi';
import type { PlanStatus } from '../../../lib/billing';
import type { AreaCertainty, SelfV2Area, SelfV2Group, Tone } from '../../../lib/selfV2Api';

export const V2_WORDS = {
  title: 'Self',
  addPhoto: 'Add your photo',
  loading: 'Reading your chart…',
  preparing: 'Your chart is still being prepared. This page will update by itself.',
  writing: 'Your board is being written. It will appear here by itself.',
  stillWorking: 'Still working…',
  retry: 'Retry',
  noKundli: 'Add your birth details in your profile to see this board.',
  unavailable: 'Self is coming soon.',
  error: 'Your board did not load.',
  heroWithheld: 'Not enough stored yet to say where you are; check back soon.',
  cardWithheld: 'Not enough in your chart to say this with confidence.',
  cardFailed: 'The full reading did not finish; here is what the chart says for sure.',
  /** an area the newest reading could not write: its card is the last reading's */
  cardStale: 'From your last reading',
  /** the heading over a card's illustration, one plain heading per kind */
  illustration: { analogy: 'Think of it this way', example: 'For example', modern: 'Like…' },
  thanks: 'Thanks, noted',
  saveFailed: 'That did not save. Try again.',
  why: 'Why we think so',
  whyTitle: 'Why we think so',
  whyEmpty: 'The cards below hold the reasons in full.',
  chartDetails: 'Chart details',
  moodAsk: 'How are you arriving today?',
  questionNote: 'One question per visit. Your answer sharpens the board.',
  bodyNote: 'What the chart and the sky put on the body. Not medical advice.',
  pressureEases: 'Pressure eases',
  subChapterEnds: 'Sub-chapter ends',
  doThisMonth: 'What to do this month',
  stripLabel: 'Six months back · six ahead',
  today: 'today',
  rebuilding: (label: string) => `Rebuilding your board on the ${label} clock. This page will update by itself.`,
  // the clock sheet (mockup §4)
  clockTitle: 'Read your board on a different clock?',
  clockAlsoChanges: 'Love and Work are read on the same clock, so they are rebuilt too.',
  clockApplies: 'Applies',
  clockCurrent: 'Now',
  clockNotApplies: 'Does not apply to your chart',
  notNow: 'Not now',
  rebuildOn: (label: string) => `Rebuild on ${label} · 1 question`,
  pickClock: 'Pick a clock',
  clockErrors: {
    not_applicable: 'That clock does not apply to your chart.',
    unknown_system: 'That clock is not one we can read your board on.',
    failed: 'That did not go through. Try again.',
  },
  // the fresh reading (server docs/billing/03): offered once the reading's last good day has passed
  fresh: {
    get: 'Get a fresh reading',
    /** the first day a fresh reading may be asked for: the day after the last good day */
    from: (validUntil: string) => `Fresh reading from ${longDate(dayAfter(validUntil))}`,
    made: (madeAt: string, validUntil: string | null) => `Made ${longDate(madeAt.slice(0, 10))}${validUntil ? ` · Good until ${longDate(validUntil)}` : ''}`,
    working: 'Making your fresh reading…',
    veil: 'Making your fresh reading. This page will update by itself.',
    noQuestions: 'No questions left',
    upgrade: 'Upgrade',
    failed: 'That did not work. Try again',
    /** the fresh build itself failed (server `refresh.failed`): the build gave the question back */
    givenBack: 'That did not work; your question was given back.',
    tryAgain: 'Try again',
    sheetTitle: 'Get a fresh reading?',
    confirm: 'Get fresh reading · 1 question',
  },
} as const;

/** "2026-12-04" → "2026-12-05" (UTC calendar days) */
export function dayAfter(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** The line under the fresh-reading button: "Uses 1 of your 20 questions"; an unlimited plan counts none. */
export function freshCostLine(plan: PlanStatus | null | undefined): string {
  if (!plan) return 'Uses 1 question';
  if (plan.exempt || plan.limit === null) return 'Included in your plan';
  return `Uses 1 of your ${plan.limit} questions`;
}

/** The consent sheet's sentence (mockup: the clock sheet's pattern). */
export function freshSheetBody(plan: PlanStatus | null | undefined): string {
  const lead = "Your board will be read again from today's sky and your latest answers.";
  if (plan && (plan.exempt || plan.limit === null)) return `${lead} This is included in your plan; no question is counted.`;
  if (!plan) return `${lead} This uses 1 of your questions.`;
  return `${lead} This uses 1 of your ${plan.limit} questions ${plan.window === 'day' ? 'today' : 'this month'}.`;
}

export const GROUP_LABEL: Record<SelfV2Group, string> = { now: 'Now', you: 'You', time: 'Time' };

/** doc 66 §4.7: one word, never a score */
export const TONE_WORD: Record<Tone, string> = {
  demanding: 'Demanding',
  heavy: 'Heavy',
  mixed: 'Mixed',
  easing: 'Easing',
  steady: 'Steady',
  open: 'Open',
};

/** the chip's colour: rose for the hard tones, amber for mixed, teal for the lifting and open ones */
export const TONE_CLASS: Record<Tone, string> = {
  demanding: 'bg-rose-500/15 text-rose-200',
  heavy: 'bg-rose-500/15 text-rose-200',
  mixed: 'bg-amber-500/15 text-amber-200',
  easing: 'bg-teal-500/15 text-teal-200',
  steady: 'bg-sky-500/15 text-sky-200',
  open: 'bg-emerald-500/15 text-emerald-200',
};

export const CERTAINTY_WORD: Record<AreaCertainty, string> = { strong: 'Strong', likely: 'Likely', possible: 'Possible' };

export const ANSWERS = [
  { value: 'yes', label: 'Yes' },
  { value: 'partly', label: 'Partly' },
  { value: 'no', label: 'No' },
  { value: 'skip', label: 'Rather not say' },
] as const;

export const MOODS = [
  { value: 'heavy', label: 'Heavy' },
  { value: 'mixed', label: 'Mixed' },
  { value: 'fine', label: 'Fine' },
] as const;

/** "16 Nov 2025 – 1 Jan 2027"; one date when both ends are the same */
export function rangeWords(from: string, to: string): string {
  if (!from) return to ? longDate(to) : '';
  if (!to || from === to) return longDate(from);
  return `${longDate(from)} – ${longDate(to)}`;
}

/** "since 5 May 2026", "until Feb 2028" style for a pattern's span; '' when it has none */
export function spanWords(since: string | null, until: string | null): string {
  if (since && until) return rangeWords(since, until);
  if (until) return `Until ${longDate(until)}`;
  if (since) return `Since ${longDate(since)}`;
  return '';
}

/**
 * The line under a card's title for a board built before the server sent `rangeLabel` (mockup §1, doc 62 header
 * ranges): chosen from the area's horizon (doc 66 mockup §5) and the board's next check date. AreaCard prefers the
 * server's `rangeLabel` whenever it is present.
 */
export function cardRange(area: SelfV2Area, nextCheck: string | null): string {
  const first = area.card?.dates[0];
  switch (area.id) {
    case 'lagna':
    case 'yogas':
      return 'Always';
    case 'diagnosis':
    case 'mind':
    case 'drive':
    case 'presence':
    case 'body':
      return nextCheck ? `Always · with what is live until ${longDate(nextCheck)}` : 'Always';
    case 'chapter':
    case 'chapters':
      return first ? rangeWords(first.from, first.to) : nextCheck ? `True until ${longDate(nextCheck)}` : '';
    case 'year':
      return first ? `This year: ${rangeWords(first.from, first.to)}` : 'This year';
    default:
      return nextCheck ? `True until ${longDate(nextCheck)}` : '';
  }
}
