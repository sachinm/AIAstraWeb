/**
 * A Self board v3 response for tests (server docs/reading-engine/68 §4). Eleven cards in registry order: seven read with
 * a line, a story and their stored dates (`v2: null`, as the server sends them once v2 is retired; `{ v2: true }` gives
 * the older shape, filled from the v2 build), two filled by v3 with three spans each (Body & energy and How you
 * think), one pending (Chapters) and one unavailable (How you come across). Eight are suggested, none of them the
 * unavailable one. Plain words on every card face; chart terms only under `details`.
 *
 * Doc 70 Phase 3: every card is `ready`, the board's `reading` is null (the per-card reading off); Body & energy's spans
 * carry their clock agreement (the second span is split: no tone word). `selfV3Reading` turns the per-card reading on.
 */
import type { PersonalCard } from '../../../lib/boardTypes';
import type { BoardReadingView, RailItem, SelfCardGroup, SelfCardIdV2, SelfV3CardContent, SelfV3CardView, SelfV3Response, SpanClockView, SpanReading } from '../../../lib/selfV3Api';
import { DEFAULT_SECTIONS } from '../../../lib/selfV3Api';

export const V3_CARDS: ReadonlyArray<{ id: SelfCardIdV2; group: SelfCardGroup; title: string; description: string; suggested: boolean; sensitive: boolean }> = [
  { id: 'body', group: 'body', title: 'Body & energy', description: 'What wears the body this year and what steadies it.', suggested: true, sensitive: true },
  { id: 'mind', group: 'mind', title: 'How you think', description: 'How you reason, judge and worry.', suggested: true, sensitive: false },
  { id: 'stuck', group: 'mind', title: 'What bothers you', description: 'What gets under your skin, and until when.', suggested: true, sensitive: false },
  { id: 'diagnosis', group: 'character', title: 'In short', description: 'The one thing to know now.', suggested: true, sensitive: false },
  { id: 'lagna', group: 'character', title: 'Who you are', description: 'Your nature, in plain words.', suggested: true, sensitive: false },
  { id: 'drive', group: 'character', title: 'Drive & ambition', description: 'What pushes you and what it is for.', suggested: true, sensitive: false },
  { id: 'presence', group: 'character', title: 'How you come across', description: 'How others read you.', suggested: false, sensitive: false },
  { id: 'yogas', group: 'character', title: 'Gifts & knots', description: 'What you were given and what tangles.', suggested: false, sensitive: false },
  { id: 'chapter', group: 'time', title: 'This chapter', description: 'The stretch of life you are in now.', suggested: true, sensitive: false },
  { id: 'chapters', group: 'time', title: 'Chapters', description: 'The long arc of your life.', suggested: false, sensitive: false },
  { id: 'year', group: 'time', title: 'This year', description: 'Your birthday-to-birthday year.', suggested: true, sensitive: false },
];

export const SUGGESTED_IDS = V3_CARDS.filter((c) => c.suggested).map((c) => c.id);

function v2Card(id: SelfCardIdV2, title: string): PersonalCard {
  return {
    areaId: id,
    headline: `${title}: ideas outrun their footing until 12 Dec 2026.`,
    body: [...V2_BODY],
    patterns: [
      { text: 'You speculate past the evidence.', kind: 'risk', since: null, until: '2028-02-16', source: `${id}.p1` },
      { text: 'You recover through structure.', kind: 'strength', since: null, until: null, source: `${id}.p2` },
    ],
    ladder: {
      best: 'Finish one thing before starting the next.',
      practical: 'Write the week down on Sunday.',
      drift: 'New plans every morning.',
      floor: 'Nothing gets done; the bills wait.',
    },
    dates: [
      { from: '2026-05-05', to: '2026-12-12', label: 'Money and effort press' },
      { from: '2026-12-12', to: '2027-06-03', label: 'The pull eases' },
      { from: '2027-06-03', to: '2027-10-04', label: 'A good stretch to build' },
    ],
    certainty: 'strong',
    sources: [`${id}.p1`],
  };
}

/** the stored v2 body: on a v2-filled card it belongs to the current period; a card read without v2 carries it as that period's own text */
const V2_BODY = ['The heaviest pull this stretch is on money and effort; it eases on 12 Dec.', 'Beneath it sits a standing pattern you will recognise.'];

function v2Rail(currentText: string[] | null = null): RailItem[] {
  return [
    { from: '2026-05-05', to: '2026-12-12', label: 'now → 12 Dec 2026', tone: null, note: 'Money and effort press', current: true, span: null, ...(currentText ? { text: currentText } : {}) },
    // the second period has words of its own and can be picked; the third has none, so it is not offered
    { from: '2026-12-12', to: '2027-06-03', label: '12 Dec → 3 Jun 2027', tone: null, note: 'The pull eases', current: false, span: null, text: ['The pull on money and effort eases once the heavy stretch ends.', 'Take the first free month to tidy what you postponed.'] },
    { from: '2027-06-03', to: '2027-10-04', label: '3 Jun → 4 Oct 2027', tone: null, note: 'A good stretch to build', current: false, span: null, text: null },
  ];
}

/** the five clocks, plain names; `agree` marks the ones holding the span's tone */
function clocks(tones: Array<[SpanClockView['tone'], boolean]>): SpanClockView[] {
  const names: Array<[string, string]> = [
    ['main', 'Main'],
    ['vimshottari', 'Life chapters'],
    ['narayana', 'Sign periods'],
    ['tp_year', 'Birthday year'],
    ['short', 'Short cycles'],
  ];
  return tones.map(([tone, agrees], i) => ({ system: names[i]![0], label: names[i]![1], tone, agrees }));
}

const BODY_SPANS: SpanReading[] = [
  {
    span: 's1',
    from: '2026-11-09',
    to: '2026-12-05',
    tone: 'heavy',
    mode: 'get_through',
    asks: 'This stretch asks you to guard your evenings and keep the body warm.',
    obstacle: 'The likely trap is working late to catch up.',
    step: 'If it is past ten and you are still working, stop and write tomorrow’s first task instead.',
    held: true,
    agreement: { agree: 4, of: 5 },
    clocks: clocks([
      ['heavy', true],
      ['heavy', true],
      ['heavy', true],
      ['light', false],
      ['heavy', true],
    ]),
  },
  {
    span: 's2',
    from: '2026-12-05',
    to: '2027-03-01',
    tone: 'mixed',
    mode: 'get_through',
    asks: 'Energy comes back in waves; take the good days slowly.',
    obstacle: 'Spending a good day all at once.',
    step: 'If you wake rested, walk before you work.',
    held: false,
    agreement: { agree: 2, of: 5 },
    clocks: clocks([
      ['heavy', false],
      ['light', false],
      ['mixed', true],
      ['mixed', true],
      ['light', false],
    ]),
  },
  {
    span: 's3',
    from: '2027-03-01',
    to: '2027-10-04',
    tone: 'light',
    mode: 'build',
    asks: 'A good stretch to build strength that lasts: a habit, a routine, a plan for the body.',
    obstacle: 'Doing too much in the first week.',
    step: 'If you start a routine, keep it to twenty minutes for the first month.',
    held: true,
    agreement: { agree: 3, of: 5 },
    clocks: clocks([
      ['light', true],
      ['light', true],
      ['mixed', false],
      ['light', true],
      ['heavy', false],
    ]),
  },
];

const MIND_SPANS: SpanReading[] = [
  {
    span: 's1',
    from: '2026-11-09',
    to: '2027-01-15',
    tone: 'light',
    mode: 'build',
    asks: 'Your thinking is clear now; a good time to learn one hard thing.',
    obstacle: 'Starting three courses and finishing none.',
    step: 'If you sign up for something, drop one thing first.',
  },
  {
    span: 's2',
    from: '2027-01-15',
    to: '2027-05-20',
    tone: 'heavy',
    mode: 'get_through',
    asks: 'Worry runs louder; write it down rather than turning it over.',
    obstacle: 'Deciding big things at night.',
    step: 'If a worry comes after dark, write it and decide it in the morning.',
  },
  {
    span: 's3',
    from: '2027-05-20',
    to: '2027-10-04',
    tone: 'mixed',
    mode: 'get_through',
    asks: 'Judgment steadies, though some days are foggy.',
    obstacle: 'Trusting a foggy day’s verdict.',
    step: 'If a choice can wait a day, let it.',
  },
];

function v3Rail(spans: SpanReading[]): RailItem[] {
  const fmt = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  return spans.map((s, i) => ({
    from: s.from,
    to: s.to,
    label: i === 0 ? `now → ${fmt(s.to)}` : `${fmt(s.from)} → ${fmt(s.to)}`,
    tone: s.held === false ? null : s.tone,
    note: null,
    current: i === 0,
    span: s.span,
  }));
}

function details(title: string) {
  return { headline: `${title}: the chart's own reasons`, paragraphs: ['Two stored rows press on this part of the chart until 12 Dec 2026.'], evidence: ['row.k1'], certainty: 'strong' };
}

/**
 * A card read without the v2 build (the server after v2 is retired): its line, pattern and ladder as v3 content, the
 * technical story where the long reading was, and the body as the current period's own text. `v2` is null.
 */
function v3Only(id: SelfCardIdV2, title: string): SelfV3CardContent {
  const v2 = v2Card(id, title);
  return {
    line: v2.headline,
    spans: [],
    confirm: null,
    pattern: v2.patterns[0] ?? null,
    ladder: v2.ladder,
    agreement: null,
    story: `${title}: the chart's own reasons.

Two stored rows press on this part of the chart until 12 Dec 2026.`,
  };
}

function card(def: (typeof V3_CARDS)[number], withV2: boolean): SelfV3CardView {
  const base: SelfV3CardView = {
    id: def.id,
    group: def.group,
    title: def.title,
    description: def.description,
    suggested: def.suggested,
    sensitive: def.sensitive,
    available: true,
    unavailableReason: null,
    status: 'ok',
    state: 'ready',
    firstLine: `${def.title}: ideas outrun their footing until 12 Dec 2026.`,
    defaultSections: [...DEFAULT_SECTIONS],
    rail: withV2 ? v2Rail() : v2Rail(V2_BODY),
    v3: withV2 ? null : v3Only(def.id, def.title),
    v2: withV2 ? { card: v2Card(def.id, def.title), rangeLabel: 'True until 12 Dec 2026', details: details(def.title) } : null,
  };
  if (def.id === 'body') {
    return {
      ...base,
      firstLine: 'Rest stays thin until 5 December, then it comes back.',
      rail: v3Rail(BODY_SPANS),
      v3: {
        line: 'Rest stays thin until 5 December, then it comes back.',
        spans: BODY_SPANS,
        confirm: { claimId: 'body.c1', text: 'Since 18 May 2025, have you been sleeping worse?' },
        pattern: { text: 'You push through tiredness and pay for it a week later.', kind: 'watch', since: '2025-05-18', until: null, source: 'body.p2' },
        ladder: { best: 'Sleep by eleven five nights a week.', practical: 'No screens after ten.', drift: 'Late nights add up.', floor: 'Run on empty and fall ill.' },
        agreement: { agree: 3, of: 4 },
      },
    };
  }
  if (def.id === 'mind') {
    return {
      ...base,
      firstLine: 'Your thinking is clear until 15 January; use it to learn one hard thing.',
      rail: v3Rail(MIND_SPANS),
      standing: ['You decide best after sleeping on it.', 'Worry is loudest when you are tired.'],
      v3: {
        line: 'Your thinking is clear until 15 January; use it to learn one hard thing.',
        spans: MIND_SPANS,
        confirm: { claimId: 'mind.c1', text: 'Between March and June 2025, did worry keep you up?' },
        pattern: null,
        ladder: null,
        agreement: { agree: 2, of: 3 },
      },
    };
  }
  if (def.id === 'chapters') return { ...base, status: 'pending', firstLine: null, rail: [], v3: null, v2: null };
  if (def.id === 'presence')
    return { ...base, available: false, unavailableReason: 'Your chart needs a birth time to read this card.', status: 'pending', firstLine: null, rail: [], v3: null, v2: null };
  return base;
}

/**
 * The board as the server sends it. Every card has `v2: null` (v2 is retired); `{ v2: true }` is the board while the
 * server still fills cards from the v2 build (eight cards with `v2` and no `v3`), for the legacy Chart details path.
 */
export function selfV3Fixture(opts: { v2?: boolean } = {}): SelfV3Response {
  return {
    status: 'ok',
    builtAt: '2026-11-09T08:00:00Z',
    readVersion: 'v3',
    clock: {
      system: 'main',
      label: 'Main',
      reason: 'default',
      reasonLine: 'Your board is read on the main clock.',
      applicable: [
        { system: 'main', label: 'Main', line: 'The usual clock for most charts.' },
        { system: 'short', label: 'Short cycles', line: 'Finer timing for the next few years.' },
      ],
      notApplicable: [{ system: 'sixteen', label: 'Sixteen-year', reason: 'Your birth was not in the right half of the day.' }],
    },
    profile: { ageBand: '36_45', hasGender: true, missing: [], role: 'public' },
    refresh: { madeAt: '2026-11-09T08:00:00Z', validUntil: '2026-12-05', due: false, building: false, failed: false },
    build: { state: 'ready', stage: null, step: 0, steps: 7, percent: 100, nextPercent: 100, stageExpectedMs: null, startedAt: null, stageAt: null },
    quality: null,
    layout: {
      template: 'seasons',
      cards: ['body', 'mind', 'stuck', 'chapter', 'diagnosis', 'lagna', 'drive', 'year'],
      sections: {},
      chosen: true,
      updatedAt: '2026-11-09T08:05:00Z',
    },
    cards: V3_CARDS.map((d) => card(d, opts.v2 === true)),
    reading: null,
  };
}

/** the per-card reading on (doc 70 Phase 3): eight cards on the board, writing cards, 5 of 8 ready */
export function selfV3Reading(over: Partial<BoardReadingView> = {}): SelfV3Response {
  const b = selfV3Fixture();
  b.reading = {
    enabled: true,
    stage: 'cards',
    clocks: [
      { system: 'main', label: 'Main', state: 'read' },
      { system: 'vimshottari', label: 'Life chapters', state: 'read' },
      { system: 'narayana', label: 'Sign periods', state: 'read' },
      { system: 'tp_year', label: 'Birthday year', state: 'read' },
      { system: 'short', label: 'Short cycles', state: 'read' },
    ],
    done: 5,
    total: 8,
    capReached: false,
    preparing: false,
    ...over,
  };
  return b;
}

/** a first visit: nothing chosen yet, the picker opens */
export function selfV3Unchosen(): SelfV3Response {
  const b = selfV3Fixture();
  b.layout = { template: 'seasons', cards: [], sections: {}, chosen: false, updatedAt: null };
  return b;
}

/**
 * Tablet and desktop cards (server docs/dashboards/13): Body & energy as the server sends it with the Astrology Reading
 * text (`chart`), a plain `why` and its three windows, plus two key dates. Not on the board fixture's card list, so the
 * tests that count cards are unchanged. `withWhy: false` leaves `why` off (the counted line shows instead).
 */
export function selfV3OutlookCard(opts: { withWhy?: boolean; withChart?: boolean } = {}): SelfV3CardView {
  const base = selfV3Fixture().cards.find((c) => c.id === 'body')!;
  const { withWhy = true, withChart = true } = opts;
  return {
    ...base,
    keyDates: [
      { date: '2026-12-05', label: 'Rest comes back' },
      { date: '2027-03-01', label: 'A good month to start a routine' },
    ],
    v3: {
      ...base.v3!,
      why: withWhy ? 'You have run on short sleep since May, and this stretch asks more of the body than usual.' : null,
      chart: withChart
        ? {
            gift: 'The sixth lord sits strong in its own sign, so the body recovers well once rested.',
            knot: 'Saturn crosses the ascendant, pressing on stamina until early December.',
            certainty: 'likely',
            spans: [
              { span: 's1', shows: 'Saturn on the ascendant weighs on vitality for these weeks.' },
              { span: 's2', shows: 'Mixed periods: the moon period lifts while the sub-period still presses.' },
              { span: 's3', shows: 'Jupiter aspects the sixth house and supports a lasting routine.' },
            ],
          }
        : null,
    },
  } as SelfV3CardView;
}

/** the Oracle's technical story (plan revision 2 §6): continuous paragraphs, no headings; test and screenshot data only */
export const STORY_TEXT = [
  'From the rising sign, the sixth house and its lord carry the body here; the lord is a friend to the rising sign, so effort turns into stamina once it is paced.',
  'Saturn runs the main period on the life-chapters clock until 27 Dec 2027, with the Moon under it; the sign periods are quieter, and the birthday year asks for habits.',
  'Saturn crosses the rising degree in early December 2026. The signs lean toward a slow, steady rebuild; a month of early nights would settle it.',
].join('\n\n');

/** the Personalizer's plain story: what Outlook shows under the headline */
export const PLAIN_STORY = 'You are rebuilding, not running down. This stretch asks for a slower rhythm, and gives back a steadier body for it.';
export const GROWTH_LINE = 'It teaches you to keep a pace you can hold.';
/** how long the story card's reading holds (server `v3.goodUntil`) */
export const GOOD_UNTIL = '2027-12-27';
/**
 * The systems the story read, in the server's shape (server src/reading/self/v3/types.ts `CardSystemView`): the internal
 * key, the plain label and what runs today. The last one has no end date stored; a fourth has nothing running.
 */
export const STORY_SYSTEMS: NonNullable<NonNullable<SelfV3CardView['v3']>['systems']> = [
  { system: 'vimshottari', label: 'Life chapters', running: { lord: 'Saturn', from: '2008-12-27', to: '2027-12-27' } },
  { system: 'narayana', label: 'Sign periods', running: { lord: 'Virgo', from: '2026-01-10', to: '2027-01-10' } },
  { system: 'tp_year', label: 'Birthday year', running: { lord: 'Saturn', from: '2026-08-01', to: null } },
  { system: 'yogini', label: 'Short chapters', running: null },
];

/**
 * The Outlook card with every reading field the server serves or will serve: the technical story, the plain story,
 * the systems read and a growth line on each stretch, on top of the Outlook card's why, chart lines, ladder, key dates,
 * agreement counts and its v2 long reading.
 */
export function selfV3StoryCard(): SelfV3CardView {
  const c = selfV3OutlookCard();
  return {
    ...c,
    v3: {
      ...c.v3!,
      story: STORY_TEXT,
      plain: { story: PLAIN_STORY, pending: false },
      systems: STORY_SYSTEMS,
      goodUntil: GOOD_UNTIL,
      spans: c.v3!.spans.map((x) => ({ ...x, growth: GROWTH_LINE })),
    },
  };
}
