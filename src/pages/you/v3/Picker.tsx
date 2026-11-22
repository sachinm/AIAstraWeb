/**
 * The Self card picker (server docs/reading-engine/68 §4.1, 71 §4.2). Opens on the first visit (`layout.chosen` false)
 * and from the `+` chip. The shared designed picker (src/components/boardCards) with Self's rules: suggested cards carry
 * a mark but are never ticked for the person; one button ticks them in one tap; unavailable cards are greyed with the
 * reason. Done needs at least three cards; past eight the page says so, kindly. Self sets each card's options on the
 * card itself, so this picker does not show them.
 */
import BoardCardPicker from '../../../components/boardCards/BoardCardPicker';
import { MIN_CARDS, MIN_READING_CARDS, SELF_CARD_GROUPS, SUGGESTED_COUNT, type BoardId, type SelfCardId, type SelfV3CardView } from '../../../lib/selfV3Api';
import { V3_WORDS } from './words';
import { PIPELINE_WORDS } from '../../../components/board/words';

export default function Picker({
  cards,
  initial,
  busy = false,
  error = null,
  onDone,
  onCancel,
  readingOn = false,
  board = 'self',
  groups = SELF_CARD_GROUPS,
  title = V3_WORDS.pickerTitle,
  lead = V3_WORDS.pickerLead,
  minCards = MIN_CARDS,
  minReadingCards = MIN_READING_CARDS,
  reorder = false,
  suggestedIds,
  locked = false,
}: {
  /** the reading gate: the pick still saves; the note says its reading starts once the chart is ready */
  locked?: boolean;
  /** Love and Work (server docs/dashboards/10 W4): the board, its lenses as groups, its own words and minimums */
  board?: BoardId;
  groups?: ReadonlyArray<{ id: string; title: string }>;
  title?: string;
  lead?: string;
  minCards?: number;
  minReadingCards?: number;
  cards: SelfV3CardView[];
  /** the cards ticked when the picker opens: none on a first visit, the person's own from the `+` chip */
  initial: SelfCardId[];
  busy?: boolean;
  error?: string | null;
  onDone: (cards: SelfCardId[]) => void;
  /** absent on a first visit: there is nothing to go back to */
  onCancel?: () => void;
  /** the per-card reading is on: under five cards the board saves but is not read (doc 70 §4.3 item 1) */
  readingOn?: boolean;
  /** tablet and desktop (server docs/dashboards/13 §4.3): the tray's cards can be put in order; Done returns that order */
  reorder?: boolean;
  /** with `reorder`: "Reset to suggested" puts these cards back, in this order */
  suggestedIds?: readonly SelfCardId[];
}) {
  const note = (picked: string[]) =>
    picked.length < minCards
      ? minCards === MIN_CARDS
        ? V3_WORDS.needThree(picked.length)
        : V3_WORDS.needOne
      : locked
        ? PIPELINE_WORDS.pickerNote
        : readingOn && picked.length < minReadingCards
          ? V3_WORDS.addFive
          : picked.length > SUGGESTED_COUNT
            ? V3_WORDS.moreThanEight
            : '';
  return (
    <BoardCardPicker
      board={board}
      title={title}
      lead={lead}
      groups={groups}
      cards={cards}
      initial={initial}
      busy={busy}
      error={error}
      minCards={minCards}
      suggestedCount={SUGGESTED_COUNT}
      addSuggestedLabel={V3_WORDS.addSuggested}
      note={note}
      onDone={(picked) => onDone(picked as SelfCardId[])}
      onCancel={onCancel}
      testId="self-v3-picker"
      reorder={reorder}
      suggestedIds={suggestedIds}
    />
  );
}
