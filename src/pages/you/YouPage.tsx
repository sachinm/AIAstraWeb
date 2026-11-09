/**
 * The You board (server docs/reading-engine/45 §8.3, 54 §3): the person themselves, from the Self area of the stored
 * chart digest. Leads with the tone for you now, asks once what you are working on for yourself (the companion memory's
 * `self.focus`, doc 48) and lets that choose which topic leads Ahead. Its first page is "Your reading" (doc 58).
 */
import AreaBoardView, { type AreaBoardConfig } from '../../components/AreaBoardView';
import { longDate } from '../../lib/careerApi';
import type { AreaBoard } from '../../lib/areaApi';
import SelfReading from './SelfReading';
import SelfBoardV2 from './v2/SelfBoardV2';
import { selfV2Enabled } from '../../lib/selfV2Api';

export const YOU_SUBAREAS: Record<string, string> = {
  identity: 'Direction',
  confidence: 'Confidence',
  mind: 'Peace of mind',
  growth: 'Learning and growth',
  purpose: 'Purpose and belief',
  empowerment: 'Taking charge',
  reputation: 'How you are seen',
  turning_point: 'A new chapter',
};

/** doc 45 §7, the You column. */
export function youHeadline(b: AreaBoard): string {
  const d = b.tone.date ? longDate(b.tone.date) : null;
  switch (b.tone.tone) {
    case 'demanding':
      return d ? `A heavy stretch for you. It lightens from ${d}.` : 'A heavy stretch for you: go gently this week.';
    case 'easing':
      return d ? `You're coming out of it. From ${d}, a better time to start.` : "You're coming out of it.";
    case 'closing':
      return d ? `A strong stretch for change closes ${d}.` : 'A strong stretch for change is closing.';
    case 'open':
      return d ? `A clear stretch for a fresh start. Begin before ${d}.` : 'A clear stretch for a fresh start.';
    default:
      return d ? `A steady stretch. Good for habits and rest until ${d}.` : 'A steady stretch. Good for habits and rest.';
  }
}

export const YOU_CONFIG: AreaBoardConfig = {
  area: 'self',
  surface: 'you',
  title: 'You',
  testId: 'you-page',
  askCategory: 'you',
  holdsTitle: 'What holds you up',
  pressesTitle: 'What presses',
  headline: (b) => youHeadline(b),
  subareas: YOU_SUBAREAS,
  question: {
    key: 'self.focus',
    text: 'What are you most working on for yourself?',
    options: [
      { value: 'career', label: 'My work' },
      { value: 'learning', label: 'Learning' },
      { value: 'family', label: 'Family' },
      { value: 'creativity', label: 'Creativity' },
      { value: 'spirituality', label: 'Faith and meaning' },
      { value: 'health', label: 'Health' },
      { value: null, label: "I'd rather not say" },
    ],
  },
  emptyAhead: 'Nothing large is moving in the next three years.',
  emptyBack: 'Nothing sharp enough in the last year to check with you.',
  unavailable: 'The You board is coming soon.',
  // doc 58 §4.3: "Your reading" is the first page and is selected by default
  extraFirstTab: { id: 'reading', label: 'Your reading', render: () => <SelfReading /> },
};

/** The Self board v2 (server doc 66) when VITE_SELF_V2=1 or the address has ?v2=1; otherwise this board, so release can be undone. */
export default function YouPage() {
  if (selfV2Enabled()) return <SelfBoardV2 />;
  return <AreaBoardView cfg={YOU_CONFIG} />;
}
