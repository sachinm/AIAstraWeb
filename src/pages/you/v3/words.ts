/**
 * Every word the Self board v3 says that is not from the server (server docs/reading-engine/68 §4.1, §4.4, §4.7).
 * Plain words only: no chart term, clock count or engine name on a card face. The v2 words (header, clock sheet, fresh
 * reading, build progress) are reused from ../v2/words.
 */
import type { SelfSectionId, SelfTemplateId, SpanMode, SpanTone } from '../../../lib/selfV3Api';

export const V3_WORDS = {
  pickerTitle: 'Your cards',
  pickerLead: 'Choose what you want to see about yourself. Eight to start. You can change them any time.',
  suggested: 'Suggested for you',
  addSuggested: 'Add the suggested eight',
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
  editSections: 'Edit sections',
  fineTune: 'Fine-tune',
  sectionsTitle: (title: string) => `${title} · sections`,
  locked: 'Always on',
  yourYear: 'Your year',
  isThisRight: 'Is this right?',
  noted: 'Noted. This sharpens your next reading.',
  saveFailed: 'That did not save. Try again.',
  checkedOn: (agree: number, of: number) => `Checked on ${agree} of ${of} clocks`,
  sensitive: 'From your chart. Not medical advice.',
  asks: 'What it asks',
  obstacle: 'The likely trap',
  step: 'One step',
  pattern: 'Your pattern',
  ladder: 'The ladder',
  noPattern: 'No pattern stands out for this card yet.',
  noLadder: 'No steps for this card yet.',
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
  stageClocks: 'Reading five clocks of your chart',
  stageLedger: 'Checking where they agree',
  stageCards: (done: number, total: number) => `Writing your cards · ${done} of ${total}`,
  chartPreparing: 'Your chart is still being prepared. Back in a few minutes.',
  clocksAgree: (agree: number, of: number) => `${agree} of ${of} clocks agree`,
  clocksSplit: 'The clocks are split here',
  addFive: 'Add at least five cards to start your reading.',
  clocksTitle: (label: string) => `The clocks for ${label}`,
  clockAgrees: 'Agrees',
  clockDiffers: 'Differs',
} as const;

export const TEMPLATE_WORD: Record<Extract<SelfTemplateId, 'compact' | 'seasons'>, string> = {
  compact: 'Compact',
  seasons: 'Seasons',
};

/** doc 68 §4.7: the tone is always written, never colour alone */
export const SPAN_TONE_WORD: Record<SpanTone, string> = { heavy: 'Heavy', mixed: 'Mixed', light: 'Light' };

/** the dot beside a rail bar: warm for heavy, amber for mixed, cool for light; neutral when the bar has no tone */
export const SPAN_TONE_DOT: Record<SpanTone | 'none', string> = {
  heavy: 'bg-rose-400',
  mixed: 'bg-amber-300',
  light: 'bg-teal-300',
  none: 'bg-white/35',
};

export const SPAN_MODE_WORD: Record<SpanMode, string> = { get_through: 'Get through', build: 'Build' };

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
