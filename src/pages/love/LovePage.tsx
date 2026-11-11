/**
 * The Love board (server docs/reading-engine/45 §8.2, 54 §3): house 7 and its helpers from the stored chart digest.
 * It asks once where the person is (the companion memory's `love.status`, doc 48): meeting someone leads for a single
 * person, how things are between you for someone with a partner, getting back together after a separation. What does
 * not fit their situation is not shown. Strain is named as distance or tension with a date, never as a verdict.
 */
import AreaBoardView, { type AreaBoardConfig } from '../../components/AreaBoardView';
import { longDate } from '../../lib/careerApi';
import type { AreaBoard } from '../../lib/areaApi';

export const LOVE_SUBAREAS: Record<string, string> = {
  meet: 'Meeting someone',
  romance: 'Romance',
  commitment: 'Commitment',
  delay: 'Why it is taking time',
  health: 'How things are between you',
  strain: 'Distance or tension',
  reconcile: 'Getting back together',
  family_accept: 'Family and in-laws',
  friends: 'Friendships',
};

/** doc 45 §7, the Love column; the open line suits the person's situation. */
export function loveHeadline(b: AreaBoard, focus: string | null): string {
  const d = b.tone.date ? longDate(b.tone.date) : null;
  switch (b.tone.tone) {
    case 'demanding':
      return d ? `A strained stretch in love. It eases from ${d}.` : 'A strained stretch in love: go gently this week.';
    case 'easing':
      return d ? `Things are softening. From ${d}, a better time to talk.` : 'Things are softening.';
    case 'closing':
      return d ? `A good window for a decision closes ${d}.` : 'A good window for a decision is closing.';
    case 'open':
      if (focus === 'meet') return d ? `A warm opening for love. Say yes to introductions before ${d}.` : 'A warm opening for love.';
      return d ? `A warm stretch for love. Make time for each other before ${d}.` : 'A warm stretch for love.';
    default:
      return d ? `A settled stretch in love. A new opening on ${d}.` : 'A settled stretch in love.';
  }
}

export const LOVE_CONFIG: AreaBoardConfig = {
  area: 'love',
  surface: 'love',
  title: 'Love',
  testId: 'love-page',
  askCategory: 'love',
  holdsTitle: 'What holds it up',
  pressesTitle: 'What presses',
  headline: loveHeadline,
  subareas: LOVE_SUBAREAS,
  question: {
    key: 'love.status',
    text: 'Right now are you…',
    options: [
      { value: 'single', label: 'Single' },
      { value: 'dating', label: 'Seeing someone' },
      { value: 'committed', label: 'Committed' },
      { value: 'married', label: 'Married' },
      { value: 'separated', label: 'Separated' },
      { value: 'complicated', label: "It's complicated" },
      { value: null, label: 'Prefer not to say' },
    ],
  },
  emptyAhead: 'Nothing large is moving in love in the next three years.',
  emptyBack: 'Nothing sharp enough in the last year to check with you.',
  unavailable: 'The Love board is coming soon.',
  cardsBoard: 'love',
};

export default function LovePage() {
  return <AreaBoardView cfg={LOVE_CONFIG} />;
}
