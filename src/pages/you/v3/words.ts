/**
 * Every word the Self board v3 says that is not from the server (server docs/reading-engine/68 §4.1, §4.4, §4.7).
 * Plain words only: no chart term, clock count or engine name on a card face. The v2 words (header, clock sheet, fresh
 * reading, build progress) are reused from ../v2/words.
 */
import type { CardFace } from '../../../lib/cardOptions';
import type { CardVoice, SelfSectionId, SelfTemplateId, SpanMode, SpanTone } from '../../../lib/selfV3Api';
import type { ShownFace } from './faces/FaceBody';

export const V3_WORDS = {
  pickerTitle: 'Your cards',
  pickerLead: 'Choose what you want to see about yourself. Eight to start. You can change them any time.',
  suggested: 'Suggested for you',
  addSuggested: 'Add the suggested cards',
  moreThanEight: 'Eight is comfortable. More is fine.',
  needThree: (n: number) => `Pick at least three cards (${n} chosen).`,
  chosenCount: (n: number) => `${n} chosen`,
  done: 'Done',
  cancel: 'Cancel',
  edit: 'Edit',
  addCard: 'Add a card',
  resetSuggested: 'Reset to suggested',
  removeCard: (title: string) => `Remove ${title}`,
  moveLeft: (title: string) => `Move ${title} left`,
  moveRight: (title: string) => `Move ${title} right`,
  editHint: 'Drag a chip to move it, or use the arrows. Keep at least three.',
  ofCount: (i: number, n: number) => `${i} of ${n}`,
  template: 'Layout',
  yourYear: 'Your year',
  allShown: 'All cards are shown',
  // the card header, the faces and the periods (doc 75)
  faces: 'How this card reads',
  ownSettings: 'This card has its own settings',
  why: 'Why',
  periods: 'Periods',
  prevPeriod: 'Previous period',
  nextPeriod: 'Next period',
  passed: 'passed',
  keyDates: 'Key dates',
  whatToDo: 'What to do',
  doThis: 'Do',
  avoid: 'Avoid',
  datesPassed: 'Some dates here have passed. Refresh to update.',
  refresh: 'Refresh',
  locked: (plan: string) => `Part of ${plan}`,
  // the board's card settings (gear)
  cardSettings: 'Card settings',
  settingsLead: 'How every card opens. A card changed on its own keeps its choice.',
  readAs: 'Open cards as',
  voice: 'Voice',
  showConfirm: 'Show “Is this right?”',
  isThisRight: 'Is this right?',
  noted: 'Noted. This sharpens your next reading.',
  saveFailed: 'That did not save. Try again.',
  sessionEnded: 'Your session ended. Sign in again to keep your changes.',
  signInAgain: 'Sign in again',
  sensitive: 'From your chart. Not medical advice.',
  step: 'One step',
  pattern: 'Your pattern',
  noText: 'Nothing more for this stretch yet.',
  pendingCard: 'Being read for you now.',
  cardFailed: 'The full reading did not finish for this card. It will be read again with your next reading.',
  unavailableCard: 'Not available for your chart yet.',
  // doc 70 §4.3, §4.4: a reading per card
  cardReading: 'Reading your chart',
  cardQueued: 'In the queue',
  cardNotThrough: 'This one did not come through',
  tryAgain: 'Try again',
  notReadYet: 'Not read yet',
  stageClocks: 'Reading your chart',
  stageLedger: 'Putting your reading together',
  stageCards: (done: number, total: number) => `Writing your cards · ${done} of ${total}`,
  chartPreparing: 'Your chart is still being prepared. Back in a few minutes.',
  addFive: 'Add at least five cards to start your reading.',
} as const;

export const TEMPLATE_WORD: Record<Extract<SelfTemplateId, 'compact' | 'seasons'>, string> = {
  compact: 'Compact',
  seasons: 'Seasons',
};

/** doc 68 §4.7: the tone is always written, never colour alone */
export const SPAN_TONE_WORD: Record<SpanTone, string> = { heavy: 'Heavy', mixed: 'Mixed', light: 'Light' };
export const SPAN_MODE_WORD: Record<SpanMode, string> = { get_through: 'Get through', build: 'Build' };

/** the dot beside a rail bar: warm for heavy, amber for mixed, cool for light; neutral when the bar has no tone */
export const SPAN_TONE_DOT: Record<SpanTone | 'none', string> = {
  heavy: 'bg-rose-400',
  mixed: 'bg-amber-300',
  light: 'bg-teal-300',
  none: 'bg-white/35',
};

export const FACE_WORD: Record<ShownFace, string> = { read: 'Read', short: 'Short' };
/** what each shown face is stored as (Short rides on the stored `light` the server already accepts) */
export const FACE_WIRE: Record<ShownFace, CardFace> = { read: 'read', short: 'light' };
export const VOICE_WORD: Record<CardVoice, string> = { gentle: 'Gentle', direct: 'Direct' };

/** "Is this right?": the three answers and what each is stored as */
export const CONFIRM_ANSWERS: ReadonlyArray<{ value: 'yes' | 'no' | 'skip'; label: string }> = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'Not really' },
  { value: 'skip', label: 'Not sure' },
];

export const SECTION_WORD: Record<SelfSectionId, string> = {
  line: 'In a line',
  year: 'Your year',
  stretch: 'This stretch',
  confirm: 'Is this right?',
  pattern: 'Your pattern',
  ladder: 'The ladder',
  details: 'Chart details',
};

export const LAYOUT_ERROR_WORD: Record<string, string> = {
  too_few_cards: 'Keep at least three cards.',
  template_not_live: 'That layout is not ready yet.',
  card_not_offered: 'One of those cards is not offered yet.',
  fixed_section_off: '"In a line" and "Your year" always stay on.',
  failed: 'That did not save. Try again.',
  unknown_option: 'That choice is not offered yet.',
};
