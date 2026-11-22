/**
 * The Self board v3 client (server docs/reading-engine/68 §4.6). One GET carries the whole board: the layout the person
 * chose, every catalogue card in registry order with its period rail, and the build state. The types below are copied
 * from the server's `src/reading/self/v3/types.ts` and must stay identical to it; where the server reuses a v2 type,
 * this file reuses the one in selfV2Api.ts.
 *
 * GET /api/self/v3            -> 200 SelfV3Response (`status` ok | pending | preparing) | 404 no_kundli
 *                                | 404 without a v3 body: the server has v3 off, the page shows the v2 board
 * PUT /api/self/v3/layout     -> 200 SelfBoardLayoutView (+ `reading: { queued }` when five or more cards and the per-card
 *                                reading is on) | 400 { error: LayoutError }
 * POST /api/self/v3/confirm   -> 204
 * POST /api/self/v3/cards/:id/read (doc 70 §4.2) -> 202 { state: 'queued' } | 409 already_reading | 429 spend_cap
 *   | 409 { code: 'preparing', pipeline } (the reading gate: the chart is still being built; also on refresh and layout)
 *                                | 400 unknown_card, card_not_offered | 404 no_kundli | 503 off
 * The clock switch stays PUT /api/self/v2/clock (selfV2Api.changeSelfV2Clock).
 *
 * Love and Work (server docs/dashboards/10 §4.3) use the same calls under /api/board/:board/v3, with these differences
 * (all of them in `boardBase`, `isV3Board`, `boardLayoutBody` and `fetchSelfV3State` below, so they are easy to adjust):
 * GET /api/board/:board/v3    -> 200 BoardV3Response (SelfV3Response + board, lenses, activeLens, defaultLens)
 *                                | 404 { status: 'no_kundli' } | 404 { error: 'board_v3_off' } or any other 404,
 *                                400 unknown_board, 503 { error: 'off' }: the page shows the legacy board
 * PUT /api/board/:board/v3/layout { version, patch: { cards, options, boardOptions: { lens } } } (no PATCH routes)
 * POST /api/board/:board/v3/confirm, POST /api/board/:board/v3/cards/:id/read: as Self
 */
import { optionsFor, type BoardCardOptions, type BoardOptions, type CardOptions } from './cardOptions';
import { buildApiHeaders } from './apiHeaders';
import { getSelfV3Cached, setSelfV3Cached } from './selfV3Cache';
import { announcePipeline, readPipeline, refusedPipeline, type PipelineView } from './pipelineStatus';
import { ledgerApiUrl } from './ledgerApi';
import type {
  CardStatus,
  IsoDate,
  LadderSteps,
  PersonalCard,
  PersonalPattern,
  SelfConfirmAnswer,
  SelfV2AreaId,
  SelfV2BuildView,
  SelfV2Clock,
  SelfV2Quality,
  SelfV2Refresh,
  SelfV2Response,
} from './selfV2Api';

// ---------------------------------------------------------------------------------------------------------------------
// Copied from the server's src/reading/self/v3/types.ts. Keep identical.
// ---------------------------------------------------------------------------------------------------------------------

/** Phase A and B: the eleven v2 areas (the `now` hero is not a card; the top strip is gone) */
export type SelfCardIdV2 = Exclude<SelfV2AreaId, 'now'>;
/** Phase C ids (offered when the per-card reading is on) and Phase D ids (reserved) */
export type SelfCardIdLater =
  | 'fitness'
  | 'sleep'
  | 'blood'
  | 'sharpness'
  | 'mood'
  | 'restores'
  | 'play'
  | 'purpose'
  | 'learning'
  | 'layers'
  | 'constitution'
  | 'aims'
  | 'practice'
  | 'saturn'
  | 'helps';
/** the Self ids the server knows today */
export type SelfCardKnownId = SelfCardIdV2 | SelfCardIdLater;
/**
 * Any board's card id (docs/dashboards/10 W1): Self ids, and Love/Work ids such as `dating_pulse` or `job_pulse`. Ids are
 * unique across boards, so a card id alone names its card.
 */
export type SelfCardId = string;

// ---------------------------------------------------------------------------------------------------------------------
// Boards (docs/dashboards/10): Self, Love and Work share this client
// ---------------------------------------------------------------------------------------------------------------------

export type BoardId = 'self' | 'love' | 'work';
export type AreaBoardId = Exclude<BoardId, 'self'>;
export type LoveLensId = 'dating' | 'marriage' | 'friends' | 'allies';
export type WorkLensId = 'career_start' | 'primary_job' | 'hobby' | 'business';
export type BoardLensId = LoveLensId | WorkLensId;

/** one lens of a Love or Work board, as the server sends it */
export interface BoardLensView {
  id: BoardLensId;
  title: string;
  /** the lens's starter cards for this person (status-routed by the server) */
  suggested: SelfCardId[];
}

/** the lenses in their order, with the titles the page uses until the server's arrive */
export const BOARD_LENSES: Record<AreaBoardId, ReadonlyArray<{ id: BoardLensId; title: string }>> = {
  love: [
    { id: 'dating', title: 'Dating' },
    { id: 'marriage', title: 'Marriage' },
    { id: 'friends', title: 'Friends' },
    { id: 'allies', title: 'Allies at work' },
  ],
  work: [
    { id: 'career_start', title: 'Starting out' },
    { id: 'primary_job', title: 'Your job' },
    { id: 'hobby', title: 'Craft & hobby' },
    { id: 'business', title: 'Business' },
  ],
};

/** where a board's v3 routes live */
export function boardBase(board: BoardId = 'self'): string {
  return board === 'self' ? '/api/self/v3' : `/api/board/${board}/v3`;
}

/** "Done" needs this many cards: three on Self, one on Love and Work (server CARDS_READ_MIN_AREA) */
export function minCardsFor(board: BoardId = 'self'): number {
  return board === 'self' ? MIN_CARDS : 1;
}

/** the fewest cards that start the per-card reading: five on Self, one on Love and Work */
export function minReadingCardsFor(board: BoardId = 'self'): number {
  return board === 'self' ? MIN_READING_CARDS : 1;
}

/** the legacy page asked for (`?legacy=1`): Love and Work render their old boards */
export function legacyRequested(): boolean {
  try {
    return typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('legacy') === '1';
  } catch {
    return false;
  }
}

export type SelfCardGroup = 'body' | 'mind' | 'character' | 'indian' | 'time';

export const SELF_CARD_GROUPS: ReadonlyArray<{ id: SelfCardGroup; title: string }> = [
  { id: 'body', title: 'Body' },
  { id: 'mind', title: 'Mind' },
  { id: 'character', title: 'Character' },
  { id: 'indian', title: 'Indian lens' },
  { id: 'time', title: 'Time' },
];

/** the seven sections a card can show (doc 68 §4.4) */
export type SelfSectionId = 'line' | 'year' | 'stretch' | 'confirm' | 'pattern' | 'ladder' | 'details';
export const SELF_SECTIONS: readonly SelfSectionId[] = ['line', 'year', 'stretch', 'confirm', 'pattern', 'ladder', 'details'];
/** "In a line" and "Your year" cannot be switched off */
export const FIXED_SECTIONS: readonly SelfSectionId[] = ['line', 'year'];
export const DEFAULT_SECTIONS: readonly SelfSectionId[] = ['line', 'year', 'stretch', 'confirm'];

/** 1 Compact (today's), 2 Seasons (default), 3 One at a time, 4 Year table (doc 68 §4.2) */
export type SelfTemplateId = 'compact' | 'seasons' | 'single' | 'table';
export const SELF_TEMPLATES: readonly SelfTemplateId[] = ['compact', 'seasons', 'single', 'table'];
/** the templates the page offers today; the others are refused by PUT until they ship */
export const SELF_TEMPLATES_LIVE: readonly SelfTemplateId[] = ['compact', 'seasons'];
export const DEFAULT_TEMPLATE: SelfTemplateId = 'seasons';
/** "Done" needs at least three cards */
export const MIN_CARDS = 3;
export const SUGGESTED_COUNT = 8;

export interface SelfBoardLayout {
  template: SelfTemplateId;
  /** the person's cards, in their order */
  cards: SelfCardId[];
  /** per card, the sections switched on, when the person changed them; absent: the card's defaults */
  sections: Partial<Record<SelfCardId, SelfSectionId[]>>;
  /** per card, how it reads (server doc 71 §4.3), only the keys the person changed */
  options?: BoardCardOptions;
  /** the board-wide gear settings, only the keys that differ from the defaults (absent from older servers) */
  boardOptions?: Partial<BoardOptions>;
}

export interface SelfBoardLayoutView extends SelfBoardLayout {
  /** false until the person has pressed Done once: the page opens the picker */
  chosen: boolean;
  updatedAt: string | null;
  /** the server's env-driven defaults; the client holds COLD_BOARD_DEFAULTS only until these arrive (absent from older servers) */
  boardDefaults?: BoardOptions;
  /**
   * doc 75: bumped on every stored change; a PATCH carrying an older one is answered 409 (absent from older servers).
   * Opaque to the page: it is sent back exactly as received (the server's Love/Work layout sends an ISO string).
   */
  version?: number;
}

/** PUT /api/self/v3/layout body; without `options` / `boardOptions` the server keeps what is stored */
export interface SelfV3LayoutBody {
  template: SelfTemplateId;
  cards: SelfCardId[];
  sections?: Partial<Record<SelfCardId, SelfSectionId[]>>;
  options?: BoardCardOptions;
  boardOptions?: Partial<BoardOptions>;
}

/** PUT /api/self/v3/layout errors */
export type LayoutError =
  | 'unknown_template'
  | 'template_not_live'
  | 'unknown_card'
  | 'card_not_offered'
  | 'duplicate_card'
  | 'too_few_cards'
  | 'unknown_section'
  | 'fixed_section_off'
  | 'bad_body'
  | 'unknown_option';

/** the engine's word for a span on one clock */
export type SpanTone = 'heavy' | 'mixed' | 'light';

export type SpanMode = 'get_through' | 'build';

/** what the person reads for one span (doc 68 §4.8) */
export interface SpanReading {
  span: string;
  from: IsoDate;
  to: IsoDate;
  tone: SpanTone;
  mode: SpanMode;
  /** at most 30 words */
  asks: string;
  /** at most 20 words */
  obstacle: string;
  /** one if-then sentence */
  step: string;
  /** doc 75: the span's own headline, and the one thing to avoid (absent from older servers) */
  headline?: string | null;
  avoid?: string | null;
  /** false when fewer than READING_CLOCKS_MIN clocks hold the frame span's tone: the page shows no tone word */
  held?: boolean;
  /** doc 70 §4.2: how many clocks hold the span's tone, of how many read ("4 of 5 clocks agree") */
  agreement?: { agree: number; of: number } | null;
  /** doc 70 §4.3 item 6, Chart details: each clock read for this span, its tone, and whether it holds the span's tone */
  clocks?: SpanClockView[];
}

/** one clock's word for a span, as Chart details lists it (labels are plain names) */
export interface SpanClockView {
  system: string;
  label: string;
  tone: SpanTone;
  agrees: boolean;
}

export interface SelfV3CardContent {
  /** "In a line": one sentence with a date */
  line: string;
  spans: SpanReading[];
  /** "Is this right?" */
  confirm: { claimId: string; text: string } | null;
  /** "Your pattern" (off by default) */
  pattern: PersonalPattern | null;
  /** "The ladder" (off by default) */
  ladder: LadderSteps | null;
  /** "Checked on 3 of 4 clocks" */
  agreement: { agree: number; of: number } | null;
  /**
   * docs/dashboards/13 §4.1: the chart-language reasoning from the stored card (the Astrology Reading tab). Absent from
   * older servers; null when nothing is stored.
   */
  chart?: CardChartReading | null;
  /** docs/dashboards/13 §4.1 (phase 5): one plain sentence saying why the reading holds; absent until then */
  why?: string | null;
}

/** the chart-language text of a card, as served (text only, never evidence keys) */
export interface CardChartReading {
  gift: string | null;
  knot: string | null;
  /** the stored enum ("strong", "likely", "possible"); the page maps it to a word */
  certainty: string | null;
  /** what each stretch shows in the chart, by span id */
  spans: Array<{ span: string; shows: string }>;
}

// ---------------------------------------------------------------------------------------------------------------------
// GET /api/self/v3 (doc 68 §4.6)
// ---------------------------------------------------------------------------------------------------------------------

/** one bar of the period rail */
export interface RailItem {
  from: IsoDate;
  to: IsoDate;
  /** "now → 5 Dec 2026" style label in calendar words */
  label: string;
  /** the tone word shown beside the bar; null in Phase A (v2 dates carry no tone) */
  tone: SpanTone | null;
  /** the reading's own label for the date, when the rail comes from v2 dates */
  note: string | null;
  current: boolean;
  /** the SpanReading.span this bar opens, when the card is v3 */
  span: string | null;
  /** the period's own words for the Read face, paragraph by paragraph; null when none is written (absent from older servers) */
  text?: string[] | null;
  /** doc 75: the period's plain name ("Heavy stretch", "Next: new phase"); absent from older servers */
  name?: string | null;
  /** doc 75: the period's own headline, shown when its chip is picked; absent from older servers */
  headline?: string | null;
  /** doc 75: the one thing to avoid in this period; absent from older servers */
  avoid?: string | null;
}

/** doc 75: a dated turning point named in the card's own text, in plain words */
export interface KeyDate {
  date: IsoDate;
  label: string;
  tone?: SpanTone | null;
  passed?: boolean;
}

/** doc 75: a card or feature the person's plan does not cover arrives with no content */
export interface LockedFeature {
  key: string;
  minPlan: string;
}

/** doc 75: the switchable cards and in-card features the server allows for this person */
export interface BoardFeatures {
  /** the keys on for this person (`card.self.body`, `feature.face.short`, `feature.card_chat`, ...) */
  allowed: string[];
  /** premium keys the plan does not cover: shown with a lock and no content */
  locked?: LockedFeature[];
}

/** doc 75: a card's text in the other voice, when the server writes both */
export interface CardVoiceText {
  line?: string | null;
  standing?: string[] | null;
}

/** doc 75: a named, vetted period window sent by the server when a window has its own prose */
export interface CardPeriodView {
  id: string;
  name: string;
  label: string;
  from: IsoDate;
  to: IsoDate;
  headline: string;
  text: string[];
  tone: SpanTone | null;
  current: boolean;
  passed: boolean;
  span: string | null;
}

/** doc 75: a turning-point date derived from stored engine windows */
export type KeyDateView = KeyDate;

/** doc 75 §4.2: feature usability per card */
export interface CardFeatureGrant {
  usable: boolean;
  locked: boolean;
  minPlan: string | null;
}

/** the server's map entry for one key: on when not locked */
export interface FeatureGrantMapEntry {
  locked: boolean;
  minPlan?: string | null;
}
/** the board's grants as the server's map: `{"feature.card_chat": {locked: false}, ...}` */
export type BoardFeaturesMap = Record<string, FeatureGrantMapEntry>;

type GrantWire = { locked?: unknown; minPlan?: unknown; usable?: unknown } | null | undefined;

/**
 * The board's grants in the one shape the page reads. The server sends either the list shape (`{allowed: [], locked:
 * [{key, minPlan}]}`) or a map (`{"feature.card_chat": {locked: false}, "card.love.x": {locked: true, minPlan}}`): in the
 * map a key with `locked: false` is on, a locked key is shown with its lock, and a key absent is off.
 */
export function normaliseBoardFeatures(f: unknown): BoardFeatures | null {
  if (!f || typeof f !== 'object') return null;
  const o = f as Record<string, unknown>;
  if (Array.isArray(o.allowed)) return f as BoardFeatures;
  const allowed: string[] = [];
  const locked: LockedFeature[] = [];
  for (const [key, raw] of Object.entries(o)) {
    if (!raw || typeof raw !== 'object') continue;
    const g = raw as Exclude<GrantWire, null | undefined>;
    if (g.locked === true) locked.push({ key, minPlan: typeof g.minPlan === 'string' ? g.minPlan : '' });
    else if (g.usable !== false) allowed.push(key);
  }
  return { allowed, locked };
}

/** a card's own grant: `{usable, locked, minPlan}`, or the map's `{locked, minPlan?}` (usable when not locked) */
export function normaliseCardGrant(g: unknown): CardFeatureGrant | null {
  if (!g || typeof g !== 'object') return null;
  const w = g as Exclude<GrantWire, null | undefined>;
  const locked = w.locked === true;
  return { usable: typeof w.usable === 'boolean' ? w.usable && !locked : !locked, locked, minPlan: typeof w.minPlan === 'string' ? w.minPlan : null };
}

function normaliseCardFeatures(f: unknown): Record<string, CardFeatureGrant> | undefined {
  if (!f || typeof f !== 'object') return undefined;
  const out: Record<string, CardFeatureGrant> = {};
  for (const [k, g] of Object.entries(f as Record<string, unknown>)) {
    const n = normaliseCardGrant(g);
    if (n) out[k] = n;
  }
  return out;
}

/** a board's grants, and each card's, in the shapes the page reads (both server shapes accepted) */
export function withFeatureShapes<T extends Pick<SelfV3Response, 'features' | 'cards'>>(b: T): T {
  const features = normaliseBoardFeatures(b.features);
  const cards = Array.isArray(b.cards) ? b.cards.map((c) => (c.features ? { ...c, features: normaliseCardFeatures(c.features) } : c)) : b.cards;
  return { ...b, ...(b.features !== undefined ? { features } : {}), cards };
}

export interface SelfV3CardView {
  id: SelfCardId;
  /** Self: the picker group; Love and Work: the card's lens */
  group: SelfCardGroup | BoardLensId;
  title: string;
  description: string;
  suggested: boolean;
  sensitive: boolean;
  /** false: shown greyed in the picker with `unavailableReason` */
  available: boolean;
  unavailableReason: string | null;
  status: CardStatus;
  /** doc 70 §4.2: the card's own reading state (always `ready` or `not_read` while the per-card reading is off) */
  state: CardReadState;
  /** the card's real first line for this person, for the picker tile; null until read */
  firstLine: string | null;
  defaultSections: SelfSectionId[];
  /** doc 71: the options in force and the plain lines where one cannot be honoured yet (absent from older servers) */
  options?: CardOptions;
  optionNotes?: string[];
  /** what stands for the person on this card regardless of period, plain lines (absent from older servers) */
  standing?: string[];
  /** doc 75 optional server-computed periods, freshness and feature grants */
  periods?: CardPeriodView[];
  stale?: boolean;
  staleDates?: IsoDate[];
  /** the card's grants: `{usable, locked, minPlan}`, or the server's map entry `{locked, minPlan?}` (read through normaliseCardGrant) */
  features?: Record<string, CardFeatureGrant | FeatureGrantMapEntry>;
  rail: RailItem[];
  /** doc 75: one plain line under the name saying what the card answers; absent from older servers */
  subtitle?: string | null;
  /** doc 75: the card's dated turning points; absent when it has none */
  keyDates?: KeyDate[] | null;
  /** doc 75: true when a sentence on the card names a date that has passed (rewritten on the next build) */
  datesPassed?: boolean;
  /** doc 75: the card's text in each voice, when the server writes both */
  voices?: Partial<Record<CardVoice, CardVoiceText>> | null;
  /** Phase B content; null while the card is filled from the v2 build */
  v3: SelfV3CardContent | null;
  /** Phase A content: the stored v2 card and its Chart details (engine names redacted) */
  v2: {
    card: PersonalCard | null;
    rangeLabel: string;
    details: { headline?: string; paragraphs?: string[]; evidence: string[]; certainty?: string };
  } | null;
}

export interface SelfV3Response {
  status: SelfV2Response['status'];
  builtAt: string | null;
  /** which build filled the cards */
  readVersion: 'v2' | 'v3' | null;
  clock: SelfV2Clock;
  profile: SelfV2Response['profile'];
  refresh: SelfV2Refresh;
  build: SelfV2BuildView;
  quality: SelfV2Quality | null;
  layout: SelfBoardLayoutView;
  /** every catalogue card in registry order, offered or not; the page shows `layout.cards` on the board */
  cards: SelfV3CardView[];
  /** doc 70 §4.2: the board's reading progress; null when nothing is known yet */
  reading: BoardReadingView | null;
  /** doc 75: what this person may see; absent from older servers (the page then keeps the foundation set) */
  /** the list shape or the server's map (read through normaliseBoardFeatures) */
  features?: BoardFeatures | BoardFeaturesMap | null;
  /** Love and Work only (docs/dashboards/10 §4.3); absent on Self */
  board?: BoardId;
  lenses?: BoardLensView[];
  /** the lens the person is on (`layout.boardOptions.lens`, else the default) */
  activeLens?: BoardLensId | null;
  /** the lens the server routes this person to from their stated facts */
  defaultLens?: BoardLensId | null;
  /**
   * The reading gate (server prep gate): where the person's chart build stands. `locked`: no reading may be started on
   * this board. Absent from an older server: read as not locked.
   */
  pipeline?: PipelineView;
}

/** GET /api/board/:board/v3: the Self response field for field, plus the board and its lenses */
export interface BoardV3Response extends SelfV3Response {
  board: AreaBoardId;
  lenses: BoardLensView[];
  activeLens: BoardLensId | null;
  defaultLens: BoardLensId | null;
}

/** doc 75: the two voices a card can be written in */
export type CardVoice = 'gentle' | 'direct';

// ---------------------------------------------------------------------------------------------------------------------
// Doc 70 Phase 3: a reading per card (§4.2, §4.4)
// ---------------------------------------------------------------------------------------------------------------------

/**
 * One card's reading state. `ready`: a stored reading is served; `reading`: its calls are running; `queued`: waiting
 * for its turn; `failed`: its last attempt did not come through (Try again); `not_read`: not read yet (the person has
 * not chosen it, the rest is off, or the spend cap stopped the queue).
 */
export type CardReadState = 'ready' | 'reading' | 'queued' | 'failed' | 'not_read';
export const CARD_READ_STATES: readonly CardReadState[] = ['ready', 'reading', 'queued', 'failed', 'not_read'];

/** where the board's reading is: reading the clocks, checking agreement, writing cards, done; idle when nothing runs */
export type BoardReadingStage = 'idle' | 'clocks' | 'ledger' | 'cards' | 'done';

export interface BoardReadingView {
  /** false when the per-card reading is off on this server (the board is filled the Phase B way) */
  enabled: boolean;
  stage: BoardReadingStage;
  /** the clocks the ledger stands on, plain labels; `missing`: not stored yet; `failed`: its reader did not come through */
  clocks: Array<{ system: string; label: string; state: 'read' | 'missing' | 'failed' }>;
  /** board cards ready, of board cards */
  done: number;
  total: number;
  /** the day's spend cap stopped the queue: the rest stays "Not read yet" */
  capReached: boolean;
  /** fewer clocks stored than READING_CLOCKS_MIN: "Your chart is still being prepared" */
  preparing: boolean;
}

/** POST /api/self/v3/cards/:id/read; `preparing`: refused by the reading gate (409 `code: 'preparing'`) */
export type CardReadError = 'unknown_card' | 'card_not_offered' | 'already_reading' | 'spend_cap' | 'off' | 'no_kundli' | 'preparing';

/** GET /api/self/v3/catalogue: the picker without card bodies */
export interface SelfV3CatalogueEntry {
  id: SelfCardId;
  group: SelfCardGroup | BoardLensId;
  title: string;
  description: string;
  suggested: boolean;
  available: boolean;
  unavailableReason: string | null;
  firstLine: string | null;
  state: CardReadState;
}

// ---------------------------------------------------------------------------------------------------------------------
// Page state
// ---------------------------------------------------------------------------------------------------------------------

export type SelfV3State =
  | { kind: 'ok'; board: SelfV3Response }
  /** `pipeline`: the server's build state when the body carried one (its line is preferred over the page's) */
  | { kind: 'preparing'; pipeline?: PipelineView }
  | { kind: 'no_kundli' }
  /** the server has v3 off (a 404 without a v3 body): the page shows the v2 board unchanged */
  | { kind: 'v2' }
  | { kind: 'error' };

/** PUT /api/self/v3/layout 200: the layout, plus the cards queued for reading (five or more cards, the reading on) */
export type SelfBoardLayoutSaved = SelfBoardLayoutView & { reading?: { queued: SelfCardId[] } };

export type LayoutSaveResult = { ok: true; layout: SelfBoardLayoutView; queued: SelfCardId[] } | { ok: false; error: LayoutError | 'failed' };

export type CardReadResult = { ok: true; state: CardReadState } | { ok: false; status: number; error: CardReadError | 'failed' };

/** the fewest cards that start the per-card reading (doc 70 §4.3 item 1); three and four still save */
export const MIN_READING_CARDS = 5;

/** the states a card is still being read in: the page polls while any card on the board has one */
export function cardReadPending(state: CardReadState | undefined): boolean {
  return state === 'queued' || state === 'reading';
}

/** The sections a card shows: the person's choice when stored, else the card's defaults; the fixed two always on. */
export function cardSections(layout: SelfBoardLayout, card: Pick<SelfV3CardView, 'id' | 'defaultSections'>): SelfSectionId[] {
  const chosen = layout.sections[card.id] ?? card.defaultSections ?? DEFAULT_SECTIONS;
  const on = new Set<SelfSectionId>([...FIXED_SECTIONS, ...chosen]);
  return SELF_SECTIONS.filter((s) => on.has(s));
}

// ---------------------------------------------------------------------------------------------------------------------
// Calls
// ---------------------------------------------------------------------------------------------------------------------

const TRANSIENT = new Set([502, 503, 504]);
const LAYOUT_ERRORS = new Set<LayoutError>([
  'unknown_template',
  'template_not_live',
  'unknown_card',
  'card_not_offered',
  'duplicate_card',
  'too_few_cards',
  'unknown_section',
  'fixed_section_off',
  'bad_body',
  'unknown_option',
]);

async function call(method: string, path: string, payload?: unknown, extra?: { headers?: Record<string, string>; signal?: AbortSignal }): Promise<Response> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const body = payload === undefined ? undefined : JSON.stringify(payload);
  const headers = await buildApiHeaders({ token, body, method, ...(extra?.headers ? { extra: extra.headers } : {}) });
  return fetch(ledgerApiUrl(path), { method, headers, credentials: 'include', ...(body !== undefined ? { body } : {}), ...(extra?.signal ? { signal: extra.signal } : {}) });
}

/** the longest a 503's Retry-After is honoured (ms), and the wait when it names none */
const RETRY_AFTER_DEFAULT_MS = 1000;
const RETRY_AFTER_MAX_MS = 5000;

function retryAfterMs(r: Response): number {
  const secs = Number(r.headers?.get('Retry-After'));
  return Number.isFinite(secs) && secs >= 0 ? Math.min(secs * 1000, RETRY_AFTER_MAX_MS) : RETRY_AFTER_DEFAULT_MS;
}

function abortError(): Error {
  const e = new Error('aborted');
  e.name = 'AbortError';
  return e;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError());
    const t = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(abortError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/** a v3 board body; Love and Work need no clock (it is unused there) */
export function isV3Board(j: unknown, board: BoardId = 'self'): j is SelfV3Response {
  const b = j as Partial<SelfV3Response> | null;
  if (!b || typeof b !== 'object' || typeof b.status !== 'string' || !Array.isArray(b.cards) || !b.layout || typeof b.layout !== 'object') return false;
  return board === 'self' ? !!b.clock : Array.isArray(b.layout.cards);
}

/** a layout view; Love and Work need no template (it is unused there) */
function isLayoutView(j: unknown, board: BoardId = 'self'): j is SelfBoardLayoutView {
  const l = j as Partial<SelfBoardLayoutView> | null;
  return !!l && typeof l === 'object' && Array.isArray(l.cards) && (board !== 'self' || typeof l.template === 'string');
}

/** a layout from Love or Work, with the Self-only fields filled so the shared page code can read it */
function withLayoutDefaults(l: SelfBoardLayoutView): SelfBoardLayoutView {
  return { ...l, template: l.template ?? DEFAULT_TEMPLATE, sections: l.sections ?? {}, chosen: l.chosen ?? l.cards.length > 0, updatedAt: l.updatedAt ?? null };
}

/** a board body from Love or Work, with the Self-only fields filled */
function withBoardDefaults(raw: SelfV3Response, board: BoardId): SelfV3Response {
  const shaped = withFeatureShapes(raw);
  // the gate's block as the page reads it (a malformed one is read as absent: not locked)
  const b = shaped.pipeline === undefined ? shaped : { ...shaped, pipeline: readPipeline(shaped.pipeline) ?? undefined };
  if (board === 'self') return b;
  return { ...b, board, layout: withLayoutDefaults(b.layout), clock: b.clock ?? ({ system: '', label: '' } as SelfV2Clock) };
}

/** `next` as a key-merge patch over `prev`: keys `prev` has and `next` dropped are sent as null (the server deletes them) */
function mergePatch(prev: Record<string, unknown> | undefined, next: Record<string, unknown> | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(next ?? {}) };
  for (const k of Object.keys(prev ?? {})) if (!(k in out)) out[k] = null;
  return out;
}

/**
 * PUT …/layout body for a board (server commit a1cd8a0, docs/dashboards/10 §4.3). Self sends the whole layout as before. Love and Work send the versioned v3 shape the
 * server dispatches on (`patch` present, server docs/dashboards/10 §4.3): `{ version, patch: { cards, options,
 * boardOptions } }`. The server merges `options` and `boardOptions` key by key (null deletes), so what the person
 * cleared since `prev` (the last layout the server sent) goes as null. Template and sections are Self-only and stay out.
 */
export function boardLayoutBody(board: BoardId, body: SelfV3LayoutBody & { version?: number | string }, prev?: SelfBoardLayout | null): unknown {
  if (board === 'self') return body;
  const { version, cards, options, boardOptions } = body;
  const prevOptions = prev?.options ?? {};
  const nextOptions = options ?? {};
  const optionPatch: Record<string, unknown> = {};
  for (const id of new Set([...Object.keys(prevOptions), ...Object.keys(nextOptions)])) {
    if (!(id in nextOptions)) optionPatch[id] = null;
    else optionPatch[id] = mergePatch(prevOptions[id] as Record<string, unknown> | undefined, nextOptions[id] as Record<string, unknown>);
  }
  return {
    // the server's layout version is an opaque string ('' before the first save); it checks it and answers 409 when stale
    version: version === undefined || version === null ? '' : String(version),
    patch: {
      cards,
      ...(options || prev?.options ? { options: optionPatch } : {}),
      ...(boardOptions || prev?.boardOptions ? { boardOptions: mergePatch(prev?.boardOptions as Record<string, unknown> | undefined, boardOptions as Record<string, unknown> | undefined) } : {}),
    },
  };
}

/** the errors a Love or Work GET answers when the page should show the legacy board instead */
const LEGACY_ERRORS = new Set(['board_v3_off', 'unknown_board', 'off']);

/**
 * GET /api/self/v3 with the cache in play: sends `If-None-Match` with the ETag selfV3Cache holds (the response is
 * no-store, so the browser keeps nothing itself), answers a 304 with the cached body, stores body and tag on a 200 `ok`
 * board, and retries once after Retry-After on a 503. Throws only an AbortError when `signal` aborts.
 */
export async function fetchSelfV3State(opts?: { signal?: AbortSignal; board?: BoardId }): Promise<{ state: SelfV3State; notModified: boolean }> {
  const signal = opts?.signal;
  const board = opts?.board ?? 'self';
  let retried = false;
  let useTag = true;
  for (;;) {
    const held = getSelfV3Cached(board);
    const tag = useTag ? held?.etag : null;
    let r: Response;
    try {
      r = await call('GET', boardBase(board), undefined, { ...(tag ? { headers: { 'If-None-Match': tag } } : {}), ...(signal ? { signal } : {}) });
    } catch (e) {
      if (signal?.aborted || (e as { name?: string } | null)?.name === 'AbortError') throw abortError();
      return { state: { kind: 'error' }, notModified: false };
    }
    if (r.status === 304) {
      if (held) return { state: { kind: 'ok', board: held.data }, notModified: true };
      // a 304 with nothing held (the cache was cleared meanwhile): ask again without a tag, once
      if (!useTag) return { state: { kind: 'error' }, notModified: false };
      useTag = false;
      continue;
    }
    // Love and Work: the server has the board's v3 off, or cannot read cards: the legacy board stands in
    if (board !== 'self' && r.status === 503) {
      const off = (await r.json().catch(() => null)) as { error?: string } | null;
      if (off?.error && LEGACY_ERRORS.has(off.error)) return { state: { kind: 'v2' }, notModified: false };
    }
    if (r.status === 503 && !retried) {
      retried = true;
      await sleep(retryAfterMs(r), signal);
      continue;
    }
    if (TRANSIENT.has(r.status)) return { state: { kind: 'preparing' }, notModified: false };
    const j = (await r.json().catch(() => null)) as (Partial<SelfV3Response> & { error?: string }) | null;
    if (j?.status === ('no_kundli' as string) || j?.error === 'no_kundli') return { state: { kind: 'no_kundli' }, notModified: false };
    // a 404 without a v3 body: the route is off on this server; the v2 board (Self) or the legacy board (Love, Work) stands in
    if (r.status === 404) return { state: { kind: 'v2' }, notModified: false };
    if (board !== 'self' && r.status === 400 && j?.error && LEGACY_ERRORS.has(j.error)) return { state: { kind: 'v2' }, notModified: false };
    const gate = readPipeline(j?.pipeline);
    const preparing: SelfV3State = gate ? { kind: 'preparing', pipeline: gate } : { kind: 'preparing' };
    if (j?.status === 'preparing' && !isV3Board(j, board)) return { state: preparing, notModified: false };
    if (!r.ok && r.status !== 202) return { state: { kind: 'error' }, notModified: false };
    if (!isV3Board(j, board)) return { state: r.status === 202 ? preparing : { kind: 'error' }, notModified: false };
    const body = withBoardDefaults(j, board);
    // only a finished board is held: a pending one must not be drawn as the next visit's first frame. A locked one (the
    // reading gate) is held without its tag, so every poll is read in full and a 304 can never keep a stale lock
    if (r.status === 200 && body.status === 'ok') setSelfV3Cached(body, body.pipeline?.locked ? null : (r.headers?.get('ETag') ?? null), board);
    return { state: { kind: 'ok', board: body }, notModified: false };
  }
}

/** Why `fetchSelfV3` has no board: the page state to show instead */
export class SelfV3FetchError extends Error {
  constructor(public readonly state: Exclude<SelfV3State, { kind: 'ok' }>) {
    super(`self_v3_${state.kind}`);
    this.name = 'SelfV3FetchError';
  }
}

/**
 * The board, conditional on the cached ETag. `notModified: true` means `data` is the cached body itself (same
 * reference), so nothing needs to redraw. Rejects with SelfV3FetchError (`state`: preparing, no_kundli, v2, error) when
 * there is no board, and with an AbortError when `signal` aborts.
 */
export async function fetchSelfV3(opts?: { signal?: AbortSignal; board?: BoardId }): Promise<{ data: SelfV3Response; notModified: boolean }> {
  const { state, notModified } = await fetchSelfV3State(opts);
  if (state.kind === 'ok') return { data: state.board, notModified };
  throw new SelfV3FetchError(state);
}

/** PUT /api/self/v3/layout failed: `code` is the server's LayoutError, or 'failed' */
export class SelfV3LayoutError extends Error {
  constructor(public readonly code: LayoutError | 'failed') {
    super(`self_v3_layout_${code}`);
    this.name = 'SelfV3LayoutError';
  }
}

/**
 * Save the layout (template, cards, sections, per-card options, board options). The server's answer is the saved
 * layout (plus `reading.queued` when cards were queued). Rejects with SelfV3LayoutError so a caller can roll back. The
 * cached board takes the saved layout and drops its tag, so the next open draws the new layout and fetches in full.
 */
export async function putSelfV3Layout(body: SelfV3LayoutBody, board: BoardId = 'self'): Promise<SelfBoardLayoutSaved> {
  let r: Response;
  try {
    r = await call('PUT', `${boardBase(board)}/layout`, boardLayoutBody(board, body, getSelfV3Cached(board)?.data.layout));
  } catch {
    throw new SelfV3LayoutError('failed');
  }
  const j = (await r.json().catch(() => null)) as (SelfBoardLayoutSaved & { error?: string }) | null;
  if (r.ok && isLayoutView(j, board)) {
    const { reading, ...raw } = j;
    const layoutView = board === 'self' ? raw : withLayoutDefaults(raw);
    const held = getSelfV3Cached(board);
    if (held) setSelfV3Cached({ ...held.data, layout: layoutView }, null, board);
    return board === 'self' ? j : { ...layoutView, ...(reading ? { reading } : {}) };
  }
  if (r.status === 400 && j?.error && LAYOUT_ERRORS.has(j.error as LayoutError)) throw new SelfV3LayoutError(j.error as LayoutError);
  throw new SelfV3LayoutError('failed');
}

/** Save the template, the card order and the sections. Never triggers a reading. */
export async function saveSelfV3Layout(layout: SelfBoardLayout): Promise<LayoutSaveResult> {
  try {
    const j = await putSelfV3Layout({
      template: layout.template,
      cards: layout.cards,
      sections: layout.sections,
      ...(layout.options ? { options: layout.options } : {}),
      ...(layout.boardOptions ? { boardOptions: layout.boardOptions } : {}),
    });
    const { reading, ...layoutView } = j;
    return { ok: true, layout: layoutView, queued: Array.isArray(reading?.queued) ? reading.queued : [] };
  } catch (e) {
    return { ok: false, error: e instanceof SelfV3LayoutError ? e.code : 'failed' };
  }
}

/**
 * A layout change that shows at once and is confirmed by the server. `optimistic` is `current` with the patch applied
 * (a patched `options` map or `boardOptions` replaces the stored one: the caller builds the whole next map, e.g. with
 * `withCardOption` or `applyToAllCards`; a patched `cards` list also drops the options of cards that left). `done`
 * resolves with the server's saved layout, which replaces `optimistic`, and rejects when the save fails so the caller can
 * go back to `current`. Debouncing is the caller's job.
 */
export function saveLayoutOptimistic(args: {
  current: SelfBoardLayoutView;
  patch: { options?: Record<string, Partial<CardOptions>>; boardOptions?: Partial<BoardOptions>; cards?: string[] };
  send: typeof putSelfV3Layout;
}): { optimistic: SelfBoardLayoutView; done: Promise<SelfBoardLayoutSaved> } {
  const { current, patch, send } = args;
  const cards = (patch.cards ?? current.cards) as SelfCardId[];
  const options = optionsFor(patch.options ?? current.options, cards);
  const boardOptions = patch.boardOptions ?? current.boardOptions ?? {};
  const optimistic: SelfBoardLayoutView = { ...current, cards, options, boardOptions };
  const done = send({
    template: current.template,
    cards,
    sections: current.sections,
    options,
    boardOptions,
  });
  return { optimistic, done };
}

// ---------------------------------------------------------------------------------------------------------------------
// Doc 75: one small PATCH per change, carrying the layout version
// ---------------------------------------------------------------------------------------------------------------------

/**
 * One change to the stored layout. A card's patch carries that card's whole own map (replace, so a retry is harmless);
 * the board's carries its whole board-wide map; the deck carries the template, the card order and the sections.
 *
 * PATCH /api/self/v3/layout/cards/:id { version, options }       -> 200 SelfBoardLayoutView
 * PATCH /api/self/v3/layout/board     { version, boardOptions }  -> 200 SelfBoardLayoutView
 * PATCH /api/self/v3/layout/deck      { version, template, cards, sections } -> 200 SelfBoardLayoutSaved
 *   409 { error: 'stale_layout' } another save landed first: read the layout again and reapply
 *   401 the session ended; 404/405 the route is not live on this server (the page falls back to PUT)
 */
export type LayoutPatch =
  | { kind: 'card'; id: SelfCardId; options: Partial<CardOptions> }
  | { kind: 'board'; boardOptions: Partial<BoardOptions> }
  | { kind: 'deck'; template: SelfTemplateId; cards: SelfCardId[]; sections: SelfBoardLayout['sections'] };

/** `preparing`: refused by the reading gate (409 `code: 'preparing'`); the page shows the locked state, not an error */
export type LayoutPatchError = LayoutError | 'conflict' | 'unauthorized' | 'unsupported' | 'preparing' | 'failed';
export type LayoutPatchResult = { ok: true; layout: SelfBoardLayoutView; queued: SelfCardId[] } | { ok: false; error: LayoutPatchError };

function patchRoute(p: LayoutPatch): { path: string; body: Record<string, unknown> } {
  if (p.kind === 'card') return { path: `/api/self/v3/layout/cards/${encodeURIComponent(p.id)}`, body: { options: p.options } };
  if (p.kind === 'board') return { path: '/api/self/v3/layout/board', body: { boardOptions: p.boardOptions } };
  return { path: '/api/self/v3/layout/deck', body: { template: p.template, cards: p.cards, sections: p.sections } };
}

/** a stored layout from the server: taken into the held board, with the cards it queued for reading */
function layoutStored(j: SelfBoardLayoutSaved, board: BoardId): LayoutPatchResult {
  const { reading, ...raw } = j;
  const layout = board === 'self' ? raw : withLayoutDefaults(raw);
  const held = getSelfV3Cached(board);
  if (held) setSelfV3Cached({ ...held.data, layout }, null, board);
  return { ok: true, layout, queued: Array.isArray(reading?.queued) ? reading.queued : [] };
}

function layoutAnswer(r: Response, j: unknown, board: BoardId = 'self'): LayoutPatchResult {
  if (r.ok && isLayoutView(j, board)) return layoutStored(j as SelfBoardLayoutSaved, board);
  if (r.status === 401) return { ok: false, error: 'unauthorized' };
  // the reading gate refused what the save would start (not a stale layout): never refetched and resent. When the
  // server stored the pick anyway and says so (`layout` in the body), that is a save
  const refused = refusedPipeline(r.status, j);
  if (refused) {
    announcePipeline(refused);
    const stored = (j as { layout?: unknown } | null)?.layout;
    return isLayoutView(stored, board) ? layoutStored(stored as SelfBoardLayoutSaved, board) : { ok: false, error: 'preparing' };
  }
  if (r.status === 409) return { ok: false, error: 'conflict' };
  if (r.status === 404 || r.status === 405) return { ok: false, error: 'unsupported' };
  const code = (j as { error?: string } | null)?.error;
  if (r.status === 400 && code && LAYOUT_ERRORS.has(code as LayoutError)) return { ok: false, error: code as LayoutError };
  return { ok: false, error: 'failed' };
}

export async function patchSelfV3Layout(patch: LayoutPatch, version: number | undefined, board: BoardId = 'self'): Promise<LayoutPatchResult> {
  // Love and Work have no PATCH routes yet (docs/dashboards/10 Phase C): the saver sends one PUT instead, with no 404 first
  if (board !== 'self') return { ok: false, error: 'unsupported' };
  const { path, body } = patchRoute(patch);
  let r: Response;
  try {
    r = await call('PATCH', path, version === undefined ? body : { version, ...body });
  } catch {
    return { ok: false, error: 'failed' };
  }
  return layoutAnswer(r, await r.json().catch(() => null));
}

/** PUT the whole layout (older servers without the PATCH routes); the caller builds it from the latest saved copy. */
export async function putSelfV3LayoutResult(body: SelfV3LayoutBody & { version?: number }, board: BoardId = 'self'): Promise<LayoutPatchResult> {
  let r: Response;
  try {
    r = await call('PUT', `${boardBase(board)}/layout`, boardLayoutBody(board, body, getSelfV3Cached(board)?.data.layout));
  } catch {
    return { ok: false, error: 'failed' };
  }
  const res = layoutAnswer(r, await r.json().catch(() => null), board);
  return !res.ok && res.error === 'unsupported' ? { ok: false, error: 'failed' } : res;
}

/** GET the board again for its stored layout (after a 409) */
export async function fetchSelfV3Layout(board: BoardId = 'self'): Promise<SelfBoardLayoutView | null> {
  try {
    const r = await call('GET', boardBase(board));
    if (!r.ok) return null;
    const j = (await r.json().catch(() => null)) as unknown;
    return isV3Board(j, board) ? withBoardDefaults(j, board).layout : null;
  } catch {
    return null;
  }
}

/** A card's "Is this right?"; true on 204. */
export async function sendSelfV3Confirm(claimId: string, answer: SelfConfirmAnswer, board: BoardId = 'self'): Promise<boolean> {
  try {
    return (await call('POST', `${boardBase(board)}/confirm`, { claimId, answer })).ok;
  } catch {
    return false;
  }
}

const CARD_READ_ERRORS = new Set<CardReadError>(['unknown_card', 'card_not_offered', 'already_reading', 'spend_cap', 'off', 'no_kundli']);

/** Queue or retry one card's reading (doc 70 §4.2). 202 is `{ ok: true, state: 'queued' }`. */
export async function readSelfV3Card(id: SelfCardId, board: BoardId = 'self'): Promise<CardReadResult> {
  let r: Response;
  try {
    r = await call('POST', `${boardBase(board)}/cards/${encodeURIComponent(id)}/read`);
  } catch {
    return { ok: false, status: 0, error: 'failed' };
  }
  const j = (await r.json().catch(() => null)) as { state?: CardReadState; error?: string } | null;
  if (r.ok) return { ok: true, state: j?.state && CARD_READ_STATES.includes(j.state) ? j.state : 'queued' };
  const refused = refusedPipeline(r.status, j);
  if (refused) {
    announcePipeline(refused);
    return { ok: false, status: r.status, error: 'preparing' };
  }
  const error = j?.error && CARD_READ_ERRORS.has(j.error as CardReadError) ? (j.error as CardReadError) : 'failed';
  return { ok: false, status: r.status, error };
}
