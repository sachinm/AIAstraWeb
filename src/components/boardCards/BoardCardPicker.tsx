/**
 * The card picker shared by Self, Love and Work (server docs/reading-engine/71 §4.2; Self's rules from doc 68 §4.1).
 * Every card is a designed tile: its category's art and glyph on top, then its title, what it answers and, once read,
 * its first line for this person. Chosen, suggested and coming-soon tiles look different and say so in words.
 * A tray at the top shows the board forming. On a phone each group is a swipe row with dots and the groups are chips;
 * on a tablet or desktop they are grids. With `options`, a chosen tile opens "How this card reads".
 */
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, SlidersHorizontal, Star } from 'lucide-react';
import { optionsFor, withCardOption, type BoardCardOptions } from '../../lib/cardOptions';
import CardArt from './CardArt';
import CardOptionsControls from './CardOptionsControls';
import { useLoadCardPhotos } from './cardPhotos';
import { GROUP_ART, type BoardKind } from './cardArtRegistry';

export interface PickerCard {
  id: string;
  group: string;
  title: string;
  description: string;
  suggested: boolean;
  available: boolean;
  unavailableReason: string | null;
  firstLine?: string | null;
}

export const PICKER_WORDS = {
  suggested: 'Suggested for you',
  onBoard: 'On your board',
  comingSoon: 'Coming soon',
  options: 'Options',
  trayEmpty: 'Your board is empty. Tap a card to add it.',
  done: 'Done',
  cancel: 'Cancel',
  chosenCount: (n: number) => `${n} chosen`,
  soonTitle: 'On the way',
} as const;

function GroupRow({ children, count, soon, label }: { children: ReactNode; count: number; soon?: boolean; label: string }) {
  const row = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState(0);
  const onScroll = () => {
    const el = row.current;
    const first = el?.firstElementChild as HTMLElement | null;
    if (!el || !first) return;
    setAt(Math.min(count - 1, Math.round(el.scrollLeft / (first.offsetWidth + 12))));
  };
  return (
    <>
      <div ref={row} onScroll={onScroll} className={`bc-row ${soon ? 'bc-row-soon' : ''}`} aria-label={label}>
        {children}
      </div>
      {count > 1 && (
        <div className="mt-2 flex justify-center gap-1.5 sm:hidden" aria-hidden="true">
          {Array.from({ length: count }, (_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i === at ? 'w-4 bg-teal-300' : 'w-1.5 bg-white/25'}`} />
          ))}
        </div>
      )}
    </>
  );
}

export default function BoardCardPicker({
  board,
  title,
  lead,
  groups,
  cards,
  initial,
  busy = false,
  error = null,
  minCards,
  suggestedCount,
  addSuggestedLabel,
  note,
  onDone,
  onCancel,
  options,
  testId = 'board-picker',
}: {
  board: BoardKind;
  title: string;
  lead: string;
  groups: ReadonlyArray<{ id: string; title: string }>;
  cards: PickerCard[];
  initial: string[];
  busy?: boolean;
  error?: string | null;
  minCards: number;
  suggestedCount: number;
  addSuggestedLabel: string;
  /** the footer line for the cards picked so far */
  note: (picked: string[]) => string;
  onDone: (cards: string[], options: BoardCardOptions) => void;
  onCancel?: () => void;
  /** Love and Work: each chosen tile opens its options here; Self sets them on the card itself */
  options?: { initial: BoardCardOptions; notes?: Record<string, string[]> };
  testId?: string;
}) {
  useLoadCardPhotos(board);
  const [picked, setPicked] = useState<string[]>(initial);
  const [opts, setOpts] = useState<BoardCardOptions>(options?.initial ?? {});
  const [openOpts, setOpenOpts] = useState<string | null>(null);
  const on = useMemo(() => new Set(picked), [picked]);
  const byId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const suggested = cards.filter((c) => c.suggested && c.available).slice(0, suggestedCount);
  const shownGroups = groups.map((g) => ({ ...g, cards: cards.filter((c) => c.group === g.id) })).filter((g) => g.cards.length);
  const groupRefs = useRef<Record<string, HTMLFieldSetElement | null>>({});

  const toggle = (c: PickerCard) => {
    if (!c.available) return;
    setPicked((p) => (p.includes(c.id) ? p.filter((x) => x !== c.id) : [...p, c.id]));
    if (openOpts === c.id) setOpenOpts(null);
  };
  const addSuggested = () => setPicked((p) => [...p, ...suggested.map((c) => c.id).filter((id) => !p.includes(id))]);
  const enough = picked.length >= minCards;

  const tile = (c: PickerCard) => {
    const ticked = on.has(c.id);
    const state = !c.available ? 'soon' : ticked ? 'on' : 'open';
    const optsOpen = options && ticked && openOpts === c.id;
    return (
      <div key={c.id} className="bc-tile flex flex-col overflow-hidden rounded-2xl" data-state={state} data-testid={`picker-card-${c.id}`}>
        <button
          type="button"
          role="checkbox"
          aria-checked={ticked}
          aria-disabled={!c.available || undefined}
          disabled={!c.available}
          onClick={() => toggle(c)}
          className={`flex flex-1 items-stretch text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-purple-400/60 ${c.available ? '' : 'cursor-not-allowed'}`}
          data-testid={`picker-tile-${c.id}`}
          data-suggested={c.suggested ? 'true' : 'false'}
        >
          {/* the picture: a square on the left, about a quarter of the tile, so the words keep the room */}
          <CardArt id={c.id} group={c.group} size={c.available ? 'tile' : 'small'} muted={!c.available} className={`shrink-0 self-stretch ${c.available ? 'w-24 min-h-[96px]' : 'w-16 min-h-[64px]'}`}>
            {ticked && (
              <span className="bc-chip absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full" data-kind="on" aria-hidden="true">
                <Check className="h-3.5 w-3.5" />
              </span>
            )}
          </CardArt>
          <span className={`flex min-w-0 flex-1 flex-col ${c.available ? 'p-3.5' : 'px-3 py-2.5'}`}>
            <span className="flex items-start justify-between gap-2">
              <b className={`${c.available ? 'text-base' : 'text-sm'} font-semibold leading-snug text-white`}>{c.title}</b>
              {ticked && (
                <span className="shrink-0 text-[11px] font-bold text-teal-300" data-testid="picker-on-board">
                  {PICKER_WORDS.onBoard}
                </span>
              )}
            </span>
            <span className={`mt-1 ${c.available ? 'text-sm' : 'text-xs'} text-white/65`}>{c.description}</span>
            {c.available && c.firstLine && (
              <span className="mt-1.5 text-sm italic text-white/85" data-testid="picker-first-line">
                {c.firstLine}
              </span>
            )}
            {c.suggested && c.available && !ticked && (
              <span className="mt-2 inline-flex w-fit items-center gap-1 rounded-full bg-purple-500/15 px-2 py-0.5 text-[11px] font-semibold text-purple-200" data-testid="picker-suggested">
                <Star className="h-3 w-3" aria-hidden="true" />
                {PICKER_WORDS.suggested}
              </span>
            )}
            {!c.available && (
              <span className="mt-1.5 text-[11px] font-semibold text-white/55" data-testid="picker-unavailable">
                {c.unavailableReason || PICKER_WORDS.comingSoon}
              </span>
            )}
          </span>
        </button>
        {options && ticked && (
          <div className="border-t border-white/10 px-4 pb-3 pt-2">
            <button
              type="button"
              aria-expanded={!!optsOpen}
              onClick={() => setOpenOpts(optsOpen ? null : c.id)}
              className="inline-flex min-h-[36px] items-center gap-1.5 text-[13px] font-semibold text-purple-300 hover:text-purple-200"
              data-testid={`picker-options-${c.id}`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
              {PICKER_WORDS.options}
            </button>
            {optsOpen && (
              <div className="mt-2">
                <CardOptionsControls
                  cardId={c.id}
                  title={c.title}
                  chosen={opts[c.id]}
                  notes={options.notes?.[c.id]}
                  onChange={(k, v) => setOpts((o) => withCardOption(o, c.id, k, v))}
                />
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="glass flex h-full min-h-0 w-full min-w-0 max-w-full flex-col overflow-hidden rounded-2xl p-4 sm:p-6" aria-label={title} data-testid={testId} data-board={board}>
      <header className="shrink-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-white">{title}</h2>
            <p className="mt-1 max-w-[65ch] text-base text-white/75" data-testid="picker-lead">
              {lead}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={addSuggested}
              disabled={!suggested.length || suggested.every((c) => on.has(c.id))}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-teal-300/50 bg-teal-500/10 px-4 text-sm font-semibold text-teal-200 hover:bg-teal-500/20 disabled:opacity-40"
              data-testid="picker-add-suggested"
            >
              <Star className="h-4 w-4" aria-hidden="true" />
              {addSuggestedLabel}
            </button>
            <span className="text-sm text-white/60" aria-live="polite" data-testid="picker-count">
              {PICKER_WORDS.chosenCount(picked.length)}
            </span>
          </div>
        </div>
        {/* the tray: the board forming, in order */}
        <div
          className="mt-3 flex min-h-[52px] w-full min-w-0 items-center gap-2 overflow-x-auto rounded-xl border border-white/10 bg-white/5 p-1.5 [scrollbar-width:none]"
          data-testid="picker-tray"
        >
          {picked.length === 0 ? (
            <span className="px-2 text-sm text-white/55">{PICKER_WORDS.trayEmpty}</span>
          ) : (
            picked.map((id) => {
              const c = byId.get(id);
              if (!c) return null;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggle(c)}
                  aria-label={`Remove ${c.title}`}
                  className="flex shrink-0 items-center gap-2 rounded-lg border border-white/10 bg-white/5 py-1 pl-1 pr-2.5 hover:bg-white/10"
                  data-testid={`picker-tray-${id}`}
                >
                  <CardArt id={c.id} group={c.group} size="thumb" className="h-9 w-12 rounded-md" />
                  <span className="max-w-[10rem] truncate text-[13px] font-semibold text-white/85">{c.title}</span>
                </button>
              );
            })
          )}
        </div>
        {/* phone: the groups as chips */}
        {shownGroups.length > 1 && (
          <nav className="mt-3 flex gap-2 overflow-x-auto [scrollbar-width:none] sm:hidden" aria-label="Card groups">
            {shownGroups.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() =>
                  groupRefs.current[g.id]?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start',
                  })
                }
                className="inline-flex min-h-[36px] shrink-0 items-center rounded-full border border-white/15 px-3 text-[13px] font-semibold text-white/80"
                data-testid={`picker-chip-${g.id}`}
              >
                {g.title}
              </button>
            ))}
          </nav>
        )}
      </header>
      <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1 [scrollbar-width:thin]" data-testid="picker-groups">
        {shownGroups.map((g) => {
          const open = g.cards.filter((c) => c.available);
          const soon = g.cards.filter((c) => !c.available);
          const art = GROUP_ART[g.id];
          return (
            <fieldset key={g.id} ref={(el) => (groupRefs.current[g.id] = el)} className="mb-6 scroll-mt-2" data-testid={`picker-group-${g.id}`}>
              <legend className="sr-only">{g.title}</legend>
              <div className="mb-3 flex items-center gap-3" aria-hidden="true">
                <CardArt id={`group-${g.id}`} group={g.id} size="swatch" className="h-10 w-16 shrink-0 rounded-lg" />
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-white/50">{g.title}</p>
                  {art && <p className="truncate text-sm text-white/70">{art.blurb}</p>}
                </div>
              </div>
              {/* open cards first, then the coming-soon ones in the same row, so a group never leaves a gap */}
              <GroupRow count={g.cards.length} label={g.title}>
                {[...open, ...soon].map(tile)}
              </GroupRow>
            </fieldset>
          );
        })}
      </div>
      <footer className="mt-3 flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-white/10 pt-3">
        <p className="mr-auto text-sm text-white/65" aria-live="polite" data-testid="picker-note">
          {note(picked)}
        </p>
        {error && (
          <p role="alert" className="w-full text-right text-sm text-rose-300" data-testid="picker-error">
            {error}
          </p>
        )}
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] rounded-xl border border-white/15 px-4 text-sm font-bold text-white/80 hover:bg-white/5"
            data-testid="picker-cancel"
          >
            {PICKER_WORDS.cancel}
          </button>
        )}
        <button
          type="button"
          disabled={!enough || busy}
          onClick={() => onDone(picked, optionsFor(opts, picked))}
          className="min-h-[44px] rounded-xl bg-teal-400 px-6 text-sm font-bold text-[#06051a] disabled:opacity-40"
          data-testid="picker-done"
        >
          {PICKER_WORDS.done}
        </button>
      </footer>
    </section>
  );
}
