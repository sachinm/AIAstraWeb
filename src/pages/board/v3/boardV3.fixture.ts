/**
 * Love and Work v3 responses for tests (server docs/dashboards/10 §4.3): the Self fixture's board fields (clock, build,
 * refresh) with each board's own cards, lenses and layout. Love: two Dating cards and one Marriage card on the deck,
 * one Coming-soon Marriage card. Work: two "Your job" cards on the deck, one Business card off it, one Coming-soon card.
 */
import type { AreaBoardId, BoardLensId, BoardV3Response, SelfV3CardView } from '../../../lib/selfV3Api';
import { DEFAULT_SECTIONS } from '../../../lib/selfV3Api';
import { selfV3Fixture } from '../../you/v3/selfV3.fixture';

type Def = { id: string; lens: BoardLensId; title: string; suggested?: boolean; later?: boolean };

const LOVE: Def[] = [
  { id: 'dating_pulse', lens: 'dating', title: 'Where Dating Stands', suggested: true },
  { id: 'dating_meeting_timing', lens: 'dating', title: 'When You Meet Someone', suggested: true },
  { id: 'marriage_pulse', lens: 'marriage', title: 'Where Your Partnership Stands', suggested: true },
  { id: 'marriage_daily_harmony', lens: 'marriage', title: 'Warmth & Day-to-Day Harmony', suggested: true },
  { id: 'marriage_children_family', lens: 'marriage', title: 'Children & Family Growth', later: true },
  { id: 'friends_social_energy', lens: 'friends', title: 'Your Social Energy This Year', suggested: true },
  { id: 'friends_core_allies', lens: 'friends', title: 'The Friends Who Truly Carry You', suggested: true },
  { id: 'allies_pulse', lens: 'allies', title: 'Workplace Dynamics This Year', suggested: true },
];

const WORK: Def[] = [
  { id: 'job_pulse', lens: 'primary_job', title: 'Where Your Job Stands', suggested: true },
  { id: 'job_promotion_recognition', lens: 'primary_job', title: 'Promotions, Titles & Recognition', suggested: true },
  { id: 'start_launch_window', lens: 'career_start', title: 'Your Career Launch Window', suggested: true },
  { id: 'start_degree_to_career', lens: 'career_start', title: 'Turning Your Degree Into a Career', later: true },
  { id: 'craft_creative_flow', lens: 'hobby', title: 'Your Creative Flow This Year', suggested: true },
  { id: 'biz_readiness', lens: 'business', title: 'Job vs. Business Readiness', suggested: true },
  { id: 'biz_launch_timing', lens: 'business', title: 'Timing Your Launch or Major Pivot', suggested: true },
];

const LENSES = {
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
} as const;

function card(d: Def): SelfV3CardView {
  const line = `${d.title}: a steadier stretch from 5 Dec 2026.`;
  return {
    id: d.id,
    group: d.lens,
    title: d.title,
    subtitle: `What ${d.title.toLowerCase()} asks of you`,
    description: `${d.title}, read for you.`,
    suggested: !!d.suggested,
    sensitive: false,
    available: !d.later,
    unavailableReason: d.later ? 'Coming soon' : null,
    status: d.later ? 'pending' : 'ok',
    state: d.later ? 'not_read' : 'ready',
    firstLine: d.later ? null : line,
    defaultSections: [...DEFAULT_SECTIONS],
    rail: [],
    v3: d.later
      ? null
      : {
          line,
          spans: [],
          confirm: { claimId: `${d.id}.c1`, text: 'Since spring 2025, has this felt heavier?' },
          pattern: null,
          ladder: null,
          agreement: { agree: 3, of: 4 },
        },
    v2: null,
  };
}

/** a board on v3; `deck` defaults to the board's usual deck, `lens` to the server's default */
export function boardV3Fixture(board: AreaBoardId, over: { deck?: string[]; lens?: BoardLensId; chosen?: boolean } = {}): BoardV3Response {
  const self = selfV3Fixture();
  const defs = board === 'love' ? LOVE : WORK;
  const defaultLens: BoardLensId = board === 'love' ? 'dating' : 'primary_job';
  const deck = over.deck ?? (board === 'love' ? ['dating_pulse', 'dating_meeting_timing', 'marriage_pulse'] : ['job_pulse', 'job_promotion_recognition']);
  return {
    ...self,
    board,
    readVersion: 'v3',
    cards: defs.map(card),
    layout: {
      template: 'seasons',
      cards: deck,
      sections: {},
      chosen: over.chosen ?? true,
      updatedAt: '2026-11-18T08:00:00Z',
      version: 3,
      ...(over.lens ? { boardOptions: { lens: over.lens } } : {}),
    },
    lenses: LENSES[board].map((l) => ({ ...l, suggested: defs.filter((d) => d.lens === l.id && d.suggested).map((d) => d.id) })),
    activeLens: over.lens ?? defaultLens,
    defaultLens,
  };
}
