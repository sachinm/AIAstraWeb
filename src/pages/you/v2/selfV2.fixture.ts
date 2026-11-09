/**
 * A Self board v2 response for tests (server docs/reading-engine/66 mockup §1): twelve areas in the server's order,
 * a hero with its strip and question, a clock with two clocks that apply and one that does not. Plain words on every
 * card face; chart terms only under `details`.
 */
import type { PersonalCard, SelfV2Area, SelfV2AreaId, SelfV2Group, SelfV2Response } from '../../../lib/selfV2Api';

export const V2_AREAS: ReadonlyArray<{ id: SelfV2AreaId; group: SelfV2Group; title: string }> = [
  { id: 'now', group: 'now', title: 'Right now' },
  { id: 'stuck', group: 'now', title: 'Where you get stuck' },
  { id: 'chapter', group: 'now', title: 'This chapter' },
  { id: 'diagnosis', group: 'you', title: 'In short' },
  { id: 'lagna', group: 'you', title: 'Who you are' },
  { id: 'mind', group: 'you', title: 'How you think' },
  { id: 'body', group: 'you', title: 'Body & energy' },
  { id: 'drive', group: 'you', title: 'Drive & ambition' },
  { id: 'presence', group: 'you', title: 'How you come across' },
  { id: 'yogas', group: 'you', title: 'Gifts & knots' },
  { id: 'chapters', group: 'time', title: 'Chapters' },
  { id: 'year', group: 'time', title: 'This year' },
];

/** the range lines the server sends (src/reading/self/v2api/response.ts areaRange) */
const RANGES: Record<SelfV2AreaId, Pick<SelfV2Area, 'range' | 'rangeLabel'>> = {
  now: { range: { from: '2026-09-20', to: '2026-12-10' }, rangeLabel: 'True until 10 Dec 2026' },
  stuck: { range: { from: '2025-11-16', to: '2027-01-01' }, rangeLabel: 'True until 1 Jan 2027' },
  chapter: { range: { from: '2025-11-16', to: '2027-01-01' }, rangeLabel: 'True until 1 Jan 2027' },
  diagnosis: { range: { from: '2025-11-16', to: '2027-01-01' }, rangeLabel: 'True until 1 Jan 2027' },
  lagna: { range: 'always', rangeLabel: 'Always' },
  mind: { range: { from: '2019-02-16', to: '2037-02-16' }, rangeLabel: 'True until 16 Feb 2037' },
  body: { range: { from: '2025-11-16', to: '2027-01-01' }, rangeLabel: 'True until 1 Jan 2027' },
  drive: { range: { from: '2019-02-16', to: '2037-02-16' }, rangeLabel: 'True until 16 Feb 2037' },
  presence: { range: { from: '2025-11-16', to: '2027-01-01' }, rangeLabel: 'True until 1 Jan 2027' },
  yogas: { range: 'always', rangeLabel: 'Always' },
  chapters: { range: { from: '2019-02-16', to: '2037-02-16' }, rangeLabel: 'True until 16 Feb 2037' },
  year: { range: { from: '2026-09-09', to: '2027-09-09' }, rangeLabel: 'This year: 9 Sep 2026 – 9 Sep 2027' },
};

function card(id: SelfV2AreaId, title: string): PersonalCard {
  return {
    areaId: id,
    headline: `${title}: ideas outrun their footing until 12 Dec 2026.`,
    body: [
      'The heaviest pull this stretch is on money and effort; it eases on 12 Dec.',
      'Beneath it sits a standing pattern you will recognise.',
    ],
    patterns: [
      { text: 'You speculate past the evidence.', kind: 'risk', since: null, until: '2028-02-16', source: `${id}.p1` },
      { text: "You carry other people's load.", kind: 'watch', since: null, until: null, source: `${id}.p2` },
      { text: 'You recover through structure.', kind: 'strength', since: null, until: null, source: `${id}.p3` },
    ],
    ladder: {
      best: 'Audit every agreement and outflow; close two open loops a month.',
      practical: 'No new partnership terms until the review in December.',
      drift: 'Saying yes to one more thing; the cost lands in January.',
      floor: "Do not fund anyone else's shortfall before 1 Jan 2027.",
    },
    dates: [{ from: '2026-05-05', to: '2026-12-12', label: 'Heaviest' }],
    certainty: 'strong',
    sources: [`${id}.p1`, `${id}.p2`],
  };
}

export function selfV2Fixture(edit?: (b: SelfV2Response) => void): SelfV2Response {
  const areas: SelfV2Area[] = V2_AREAS.map((a) => ({
    ...a,
    status: 'ok',
    card: card(a.id, a.title),
    floor: ['Money and effort carry the weight this stretch.'],
    ...RANGES[a.id],
    details: {
      headline: 'Saturn transits the 2nd house from the lagna; Vimshottari Ketu dasha runs.',
      paragraphs: ['The 2nd lord sits in the 12th house. Rahu aspects the lagna lord.'],
      evidence: ['planet:D1.Sa', 'claim:self.stuck.c1'],
      certainty: 'strong',
    },
  }));
  const b: SelfV2Response = {
    status: 'ok',
    builtAt: '2026-11-09T08:00:00Z',
    nextCheck: '2027-01-01',
    clock: {
      system: 'kaala',
      label: 'Kaala',
      reason: 'preferred',
      reasonLine: 'Your board is written on the Kaala clock, the one your chart qualifies for.',
      applicable: [
        { system: 'kaala', label: 'Kaala', line: 'The clock your chart qualifies for' },
        { system: 'vimshottari', label: 'Vimshottari', line: "The standard clock, read from your Moon's star" },
        { system: 'yogini', label: 'Yogini', line: 'A 36-year cycle, strong for timing of events' },
      ],
      notApplicable: [{ system: 'dwisaptatisama', label: 'Dwisaptati Sama', reason: 'Only when the first lord sits in the 7th or 1st' }],
    },
    hero: {
      tone: 'easing',
      sentence: 'The heavy stretch since May is lifting. From 1 Dec you have room to start something.',
      sub: 'Money and effort carried the weight. Most of your chart agrees on the date.',
      strip: [
        { rowId: 'r1', matters: ['money_in_hand'], polarity: 'presses', strength: 3, from: '2026-05-05', to: '2026-12-12' },
        { rowId: 'r2', matters: ['effort_and_courage'], polarity: 'mixed', strength: 2, from: '2026-10-01', to: '2026-12-01' },
        { rowId: 'r3', matters: ['career_and_standing'], polarity: 'supports', strength: 2, from: '2026-12-01', to: '2027-05-01' },
      ],
      easesAt: '2026-12-12',
      nextCheck: '2027-01-01',
      question: { claimId: 'claim:self.now.work_heavy', text: 'Has work felt heavier than usual since around May?' },
      withheld: false,
      supporting: ['stuck', 'chapter'],
    },
    areas,
    profile: { ageBand: '36_45', hasGender: false, missing: [], role: 'public' },
    subChapterEnds: '2027-01-01',
    usage: {
      code: 'free',
      desired_plan: null,
      desired_interval: null,
      is_paid: false,
      interval: null,
      used: 3,
      limit: 20,
      remaining: 17,
      window: 'month',
      resets_at: '2026-12-01',
      exempt: false,
    },
  };
  edit?.(b);
  return b;
}
