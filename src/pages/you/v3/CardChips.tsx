/**
 * The chips row of the Self board v3 (server docs/reading-engine/68 §4.1 item 5, §4.7 item 2): the person's cards by
 * title, then `+`. A tap slides the carousel to that card. Arrows and "3 of 8" sit at the right.
 *
 * Edit mode: drag a chip to reorder (pointer events, so mouse, pen and touch all work), or use the small move-left and
 * move-right buttons (keyboard and screen readers); × removes a card but never below three; "Reset to suggested" puts
 * the suggested cards back; Done saves the order through PUT layout.
 */
import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { CarouselArrows } from '../../../components/carousel/Carousel';
import { MIN_CARDS, type SelfCardId } from '../../../lib/selfV3Api';
import { V3_WORDS } from './words';
import { CardThumb, cardGroupClass } from './CardBanner';

const chipCls =
  'inline-flex min-h-[40px] shrink-0 items-center rounded-full border px-3.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60';
const onCls = 'border-transparent bg-teal-500/15 font-semibold text-teal-200';
/** the active chip in its card's category colours (board-cards.css `.card-chip-on`, set by `card-grp-<group>`) */
const onTintCls = 'card-chip-on font-semibold';
const offCls = 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10';
const smallBtn = 'inline-flex h-7 w-7 items-center justify-center rounded-full text-white/70 hover:bg-white/10 disabled:opacity-30 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60';

/** move `id` to sit where `over` sits */
export function moveTo(order: SelfCardId[], id: SelfCardId, over: SelfCardId): SelfCardId[] {
  const from = order.indexOf(id);
  const to = order.indexOf(over);
  if (from < 0 || to < 0 || from === to) return order;
  const next = order.slice();
  next.splice(from, 1);
  next.splice(to, 0, id);
  return next;
}

export function moveBy(order: SelfCardId[], id: SelfCardId, d: -1 | 1): SelfCardId[] {
  const i = order.indexOf(id);
  const j = i + d;
  if (i < 0 || j < 0 || j >= order.length) return order;
  const next = order.slice();
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}

export default function CardChips({
  cards,
  titles,
  activeId,
  index,
  onSelect,
  onIndexChange,
  onAdd,
  editing,
  onEditOrder,
  onReset,
  onEditDone,
  saving = false,
  error = null,
}: {
  cards: SelfCardId[];
  titles: Partial<Record<SelfCardId, string>>;
  activeId: SelfCardId | null;
  index: number;
  onSelect: (id: SelfCardId) => void;
  onIndexChange: (i: number) => void;
  onAdd: () => void;
  editing: boolean;
  onEditOrder: (order: SelfCardId[]) => void;
  onReset: () => void;
  onEditDone: () => void;
  saving?: boolean;
  error?: string | null;
}) {
  const dragging = useRef<SelfCardId | null>(null);
  const [dragId, setDragId] = useState<SelfCardId | null>(null);
  const title = (id: SelfCardId) => titles[id] ?? id;

  const onDown = (e: ReactPointerEvent<HTMLElement>, id: SelfCardId) => {
    if (!editing) return;
    if ((e.target as HTMLElement).closest('button')) return;
    dragging.current = id;
    setDragId(id);
    try {
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch {
      /* a synthetic pointer has nothing to capture */
    }
  };
  const onMove = (e: ReactPointerEvent<HTMLElement>) => {
    const id = dragging.current;
    if (!id || typeof document.elementFromPoint !== 'function') return;
    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    const over = el?.closest<HTMLElement>('[data-chip-id]')?.dataset.chipId as SelfCardId | undefined;
    if (over && over !== id) onEditOrder(moveTo(cards, id, over));
  };
  const onUp = () => {
    dragging.current = null;
    setDragId(null);
  };

  const canRemove = cards.length > MIN_CARDS;
  return (
    <div className="flex min-w-0 flex-col gap-1.5" data-testid="self-v3-chips-row">
      <div className="flex min-w-0 items-center gap-3">
        <div
          role={editing ? 'list' : 'tablist'}
          aria-label="Your cards"
          className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto py-0.5 [scrollbar-width:none]"
          data-testid="self-v3-chips"
          data-editing={editing ? 'true' : 'false'}
        >
          {cards.map((id, i) =>
            editing ? (
              <div
                key={id}
                role="listitem"
                data-chip-id={id}
                onPointerDown={(e) => onDown(e, id)}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerCancel={onUp}
                className={`${chipCls} cursor-grab touch-none select-none gap-0.5 px-1.5 ${dragId === id ? 'border-teal-300/70 bg-teal-500/20 text-teal-100' : offCls}`}
                data-testid={`self-v3-chip-${id}`}
              >
                <button type="button" className={smallBtn} aria-label={V3_WORDS.moveLeft(title(id))} disabled={i === 0} onClick={() => onEditOrder(moveBy(cards, id, -1))} data-testid={`chip-left-${id}`}>
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                </button>
                <CardThumb cardId={id} size={24} />
                <span className="px-1">{title(id)}</span>
                <button type="button" className={smallBtn} aria-label={V3_WORDS.moveRight(title(id))} disabled={i === cards.length - 1} onClick={() => onEditOrder(moveBy(cards, id, 1))} data-testid={`chip-right-${id}`}>
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
                <button type="button" className={smallBtn} aria-label={V3_WORDS.removeCard(title(id))} disabled={!canRemove} onClick={() => onEditOrder(cards.filter((c) => c !== id))} data-testid={`chip-remove-${id}`}>
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            ) : (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={id === activeId}
                onClick={() => onSelect(id)}
                className={`${chipCls} gap-2 pl-2 ${cardGroupClass(id)} ${id === activeId ? (cardGroupClass(id) ? onTintCls : onCls) : offCls}`}
                data-testid={`self-v3-chip-${id}`}
              >
                <CardThumb cardId={id} />
                {title(id)}
              </button>
            ),
          )}
          {!editing && (
            <button type="button" onClick={onAdd} aria-label={V3_WORDS.addCard} className={`${chipCls} ${offCls} px-2.5`} data-testid="self-v3-chip-add">
              <Plus className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
        {editing ? (
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={onReset} className="min-h-[40px] rounded-full border border-white/15 px-3.5 text-sm font-semibold text-white/80 hover:bg-white/5" data-testid="chips-reset">
              {V3_WORDS.resetSuggested}
            </button>
            <button type="button" onClick={onEditDone} disabled={saving} className="min-h-[40px] rounded-full bg-teal-400 px-4 text-sm font-bold text-[#06051a] disabled:opacity-40" data-testid="chips-done">
              {V3_WORDS.done}
            </button>
          </div>
        ) : (
          <div className="flex shrink-0 items-center gap-3">
            <span className="whitespace-nowrap text-sm text-white/65" data-testid="self-v3-of">
              {V3_WORDS.ofCount(Math.min(index + 1, cards.length), cards.length)}
            </span>
            <CarouselArrows index={index} count={cards.length} onIndexChange={onIndexChange} testId="self-v3-carousel" />
          </div>
        )}
      </div>
      {editing && <p className="text-xs text-white/55">{V3_WORDS.editHint}</p>}
      {error && (
        <p role="alert" className="text-sm text-rose-300" data-testid="chips-error">
          {error}
        </p>
      )}
    </div>
  );
}
