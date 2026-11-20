/**
 * The board types the Self, Love and Work boards share (moved out of selfV2Api.ts when the v2 Self reading was retired;
 * no change). They are copied from the server's `src/reading/self/v2types.ts` (and AreaDate / AreaCertainty from
 * areaDoc.ts), which the server's v3 types reuse, and must stay identical to it. The "SelfV2" names are the server's.
 */
import type { PlanStatus } from './billing';

// ---------------------------------------------------------------------------------------------------------------------
// Copied from the server's src/reading/self/v2types.ts (and AreaDate / AreaCertainty from areaDoc.ts). Keep identical.
// ---------------------------------------------------------------------------------------------------------------------

export type SelfV2AreaId =
  | 'now'
  | 'stuck'
  | 'chapter'
  | 'diagnosis'
  | 'lagna'
  | 'mind'
  | 'body'
  | 'drive'
  | 'presence'
  | 'yogas'
  | 'chapters'
  | 'year';

export type SelfV2Group = 'now' | 'you' | 'time';

export type IsoDate = string; // YYYY-MM-DD

export type Matter =
  | 'self_and_body'
  | 'money_in_hand'
  | 'effort_and_courage'
  | 'home_and_peace'
  | 'ideas_and_children'
  | 'work_load_and_health'
  | 'partnership'
  | 'sudden_and_hidden'
  | 'luck_and_belief'
  | 'career_and_standing'
  | 'gains_and_network'
  | 'loss_rest_and_distance';

export type Polarity = 'presses' | 'mixed' | 'supports';
export type Strength = 1 | 2 | 3;

export interface WindowRef {
  rowId: string;
  matters: Matter[];
  polarity: Polarity;
  strength: Strength;
  from: IsoDate;
  to: IsoDate;
}

export type AreaCertainty = 'strong' | 'likely' | 'possible';

export interface AreaDate {
  from: string;
  to: string;
  label: string;
}

export type Tone = 'demanding' | 'heavy' | 'mixed' | 'easing' | 'steady' | 'open';
export type Mood = 'heavy' | 'mixed' | 'fine';

export interface LadderSteps {
  best: string;
  practical: string;
  drift: string;
  floor: string;
}

export interface PersonalPattern {
  text: string;
  kind: 'risk' | 'watch' | 'strength';
  since: IsoDate | null;
  until: IsoDate | null;
  /** the Oracle paragraph id ('<area>.p<n>') or evidence key the sentence rests on */
  source: string;
}

export interface PersonalCard {
  areaId: SelfV2AreaId;
  /** ≤ 14 words, second person, names a life area and, on live cards, a date */
  headline: string;
  /** two or three short paragraphs, ≤ 120 words in all */
  body: string[];
  patterns: PersonalPattern[];
  ladder: LadderSteps | null;
  /** copied from the Oracle; the validator rejects any date not in the Oracle document */
  dates: AreaDate[];
  certainty: AreaCertainty;
  /** per sentence of headline + body, the Oracle paragraph id or evidence key it rests on */
  sources: string[];
  /** storyteller (server 2026-11-09): one short example, analogy or modern reference that makes one Oracle point land */
  illustration?: CardIllustration;
}

/** server `CardIllustration` (v2types.ts "storyteller"): at most 40 words, no date, no chart term */
export interface CardIllustration {
  text: string;
  kind: 'example' | 'analogy' | 'modern';
  /** the Oracle paragraph id it illustrates */
  illustrates: string;
}

export interface HeroDoc {
  tone: Tone;
  /** one sentence: the life area and the date it changes */
  sentence: string;
  sub: string;
  strip: WindowRef[];
  easesAt: IsoDate | null;
  nextCheck: IsoDate | null;
  question: { claimId: string; text: string } | null;
  /** a split verdict is withheld, never shown */
  withheld: boolean;
  /** storyteller (server 2026-11-09): the hero may carry one illustration too */
  illustration?: CardIllustration;
}

/** `stale` (server 2026-11-09): the Oracle failed this area this build; the card is the last good reading's */
export type CardStatus = 'ok' | 'pending' | 'withheld' | 'failed' | 'stale';

/** server `SelfV2Quality`: the build's Oracle areas ok, repaired by its one repair pass, or failed */
export interface SelfV2Quality {
  okAreas: SelfV2AreaId[];
  repaired: SelfV2AreaId[];
  failed: SelfV2AreaId[];
}
export type AgeBand = 'under_25' | '25_35' | '36_45' | '46_60' | '60_plus';
/** reading register: the plain card for the public; evidence keys under Chart details for practitioners */
export type ReaderRole = 'public' | 'practitioner';

// ---------------------------------------------------------------------------------------------------------------------
// The response
// ---------------------------------------------------------------------------------------------------------------------

export interface SelfV2Clock {
  system: string;
  label: string;
  reason: string;
  /** one plain line: why the board is read on this clock */
  reasonLine: string;
  applicable: Array<{ system: string; label: string; line: string }>;
  notApplicable: Array<{ system: string; label: string; reason: string }>;
}

export interface SelfV2Area {
  id: SelfV2AreaId;
  group: SelfV2Group;
  title: string;
  status: CardStatus;
  card: PersonalCard | null;
  /** what the chart says for sure, shown under a pending or failed card */
  floor: string[];
  /**
   * How long this area's reading holds: the span of the shortest clock period that can make it stale, the year span for
   * `year`, 'always' for a standing area; null when the build stored no frame (server final integration).
   */
  range?: { from: string; to: string } | 'always' | null;
  /** the range in words ("True until 1 Jan 2027", "Always", "This year: 9 Sep 2026 – 9 Sep 2027"); '' when unknown */
  rangeLabel?: string;
  /** Chart details: chart terms allowed here */
  details: { headline?: string; paragraphs?: string[]; evidence: string[]; certainty?: AreaCertainty };
}

export interface SelfV2Response {
  status: 'ok' | 'pending' | 'preparing' | 'no_kundli';
  builtAt: string | null;
  nextCheck: string | null;
  clock: SelfV2Clock;
  /** `supporting`: the areas whose cards ground the hero, for "Why we think so" */
  hero: (HeroDoc & { supporting?: SelfV2AreaId[] }) | null;
  areas: SelfV2Area[];
  /** `role`: practitioners see evidence keys under Chart details */
  profile: { ageBand: AgeBand | null; hasGender: boolean; missing: string[]; role?: ReaderRole };
  /** the running sub period's end date, for "Sub-chapter ends"; null when not known */
  subChapterEnds?: string | null;
  usage?: PlanStatus;
  /**
   * The fresh-reading control (server docs/billing/03): when the reading was made, its last good day, and whether the
   * person may ask for a fresh one (the same rule as the v1 board). Absent from a server older than 2026-11-09.
   */
  refresh?: SelfV2Refresh;
  /**
   * Where the board's build stands (server docs/loading-overlay/05): the veil's bar and the header chip read it.
   * Absent from a server older than that plan: the page then behaves as before.
   */
  build?: SelfV2BuildView;
  /** the build's Oracle quality; null when none is stored, absent from an older server */
  quality?: SelfV2Quality | null;
}

export type SelfV2BuildState = 'none' | 'queued' | 'running' | 'ready' | 'failed' | 'stuck';
export type SelfV2BuildStage = 'subs' | 'briefs' | 'slices' | 'warm' | 'families' | 'oracle' | 'personalizer';

export interface SelfV2BuildView {
  state: SelfV2BuildState;
  stage: SelfV2BuildStage | null;
  /** 1..steps while running, else 0 */
  step: number;
  steps: number;
  /** the bar's floor now, 0..100 (100 when ready) */
  percent: number;
  /** the next stage's floor: the bar eases toward it and never passes it */
  nextPercent: number;
  /** typical duration of the current stage, for easing */
  stageExpectedMs: number | null;
  startedAt: string | null;
  /** ISO time the current stage began */
  stageAt: string | null;
}

export interface SelfV2Refresh {
  madeAt: string | null;
  validUntil: string | null;
  due: boolean;
  /**
   * From today's You build marker (server fix/self-v2-single-build): a build is running now, or today's last build
   * failed (a fresh reading's question was given back). Optional: a server before that branch omits them.
   */
  building?: boolean;
  failed?: boolean;
}

export type SelfConfirmAnswer = 'yes' | 'partly' | 'no' | 'skip';

export type ClockChangeResult =
  | { ok: true; usage: PlanStatus | null; alsoChanges: string[] }
  | { ok: false; error: 'not_applicable' | 'unknown_system' | 'failed' };
