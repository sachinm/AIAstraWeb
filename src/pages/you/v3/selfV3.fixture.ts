/**
 * A Self board v3 response for tests (server docs/reading-engine/68 §4). Eleven cards in registry order: eight filled
 * from the v2 build with rails from their dates, two filled by v3 with three spans each (Body & energy and How you
 * think), one pending (Chapters) and one unavailable (How you come across). Eight are suggested, none of them the
 * unavailable one. Plain words on every card face; chart terms only under `details`.
 */
import type { PersonalCard } from '../../../lib/selfV2Api';
import type { RailItem, SelfCardGroup, SelfCardIdV2, SelfV3CardView, SelfV3Response, SpanReading } from '../../../lib/selfV3Api';
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
    body: ['The heaviest pull this stretch is on money and effort; it eases on 12 Dec.', 'Beneath it sits a standing pattern you will recognise.'],
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

function v2Rail(): RailItem[] {
  return [
    { from: '2026-05-05', to: '2026-12-12', label: 'now → 12 Dec 2026', tone: null, note: 'Money and effort press', current: true, span: null },
    { from: '2026-12-12', to: '2027-06-03', label: '12 Dec → 3 Jun 2027', tone: null, note: 'The pull eases', current: false, span: null },
    { from: '2027-06-03', to: '2027-10-04', label: '3 Jun → 4 Oct 2027', tone: null, note: 'A good stretch to build', current: false, span: null },
  ];
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
    tone: s.tone,
    note: null,
    current: i === 0,
    span: s.span,
  }));
}

function details(title: string) {
  return { headline: `${title}: the chart's own reasons`, paragraphs: ['Two stored rows press on this part of the chart until 12 Dec 2026.'], evidence: ['row.k1'], certainty: 'strong' };
}

function card(def: (typeof V3_CARDS)[number]): SelfV3CardView {
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
    firstLine: `${def.title}: ideas outrun their footing until 12 Dec 2026.`,
    defaultSections: [...DEFAULT_SECTIONS],
    rail: v2Rail(),
    v3: null,
    v2: { card: v2Card(def.id, def.title), rangeLabel: 'True until 12 Dec 2026', details: details(def.title) },
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
  if (def.id === 'chapters') return { ...base, status: 'pending', firstLine: null, rail: [], v2: null };
  if (def.id === 'presence')
    return { ...base, available: false, unavailableReason: 'Your chart needs a birth time to read this card.', status: 'pending', firstLine: null, rail: [], v2: null };
  return base;
}

export function selfV3Fixture(): SelfV3Response {
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
    cards: V3_CARDS.map(card),
  };
}

/** a first visit: nothing chosen yet, the picker opens */
export function selfV3Unchosen(): SelfV3Response {
  const b = selfV3Fixture();
  b.layout = { template: 'seasons', cards: [], sections: {}, chosen: false, updatedAt: null };
  return b;
}
