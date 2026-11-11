/**
 * "Your cards" on the Love and Work boards (server docs/reading-engine/71 §4.6): the button that opens the shared
 * picker in a sheet, the row of chosen cards above the board (tap one to see the board through it, with its View as
 * the time filter), and the hook that loads and saves the choice. On a first visit nothing is forced: the board shows
 * everything, as before, until the person chooses.
 */
import { useCallback, useEffect, useState } from 'react';
import { LayoutGrid } from 'lucide-react';
import {
  AREA_LAYOUT_ERROR_WORD,
  fetchAreaCatalogue,
  fetchAreaLayout,
  saveAreaLayout,
  type AreaCardsBoard,
  type AreaCardsLayout,
  type AreaCatalogue,
  type AreaCatalogueCard,
} from '../../lib/boardCardsApi';
import type { BoardCardOptions } from '../../lib/cardOptions';
import { track } from '../../lib/events';
import BoardCardPicker from './BoardCardPicker';
import CardArt from './CardArt';
import { loadCardPhotos } from './cardPhotos';

export const AREA_CARDS_WORDS = {
  button: 'Your cards',
  love: {
    lead: 'Choose what you want to see about love. Five to start. Each card has its own options.',
    add: 'Add the suggested',
  },
  work: {
    lead: 'Choose what you want to see about work. Five to start. Each card has its own options.',
    add: 'Add the suggested',
  },
  allCards: 'All',
  needOne: 'Pick at least one card.',
} as const;

export function useAreaCards(board: AreaCardsBoard | null) {
  const [catalogue, setCatalogue] = useState<AreaCatalogue | null>(null);
  const [layout, setLayout] = useState<AreaCardsLayout | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!board) return;
    let live = true;
    void Promise.all([fetchAreaCatalogue(board), fetchAreaLayout(board)]).then(([c, l]) => {
      if (!live) return;
      setCatalogue(c);
      setLayout(l);
    });
    return () => {
      live = false;
    };
  }, [board]);
  const save = useCallback(
    async (cards: string[], options: BoardCardOptions) => {
      if (!board) return;
      setBusy(true);
      setError(null);
      const r = await saveAreaLayout(board, cards, options);
      setBusy(false);
      if (r.ok) {
        setLayout(r.layout);
        setOpen(false);
        track('chip_select', board, `cards_${cards.length}`);
      } else setError(AREA_LAYOUT_ERROR_WORD[r.error] ?? AREA_LAYOUT_ERROR_WORD.failed!);
    },
    [board],
  );
  return {
    ready: !!board && !!catalogue,
    catalogue,
    layout,
    open,
    setOpen,
    busy,
    error,
    setError,
    save,
  };
}

export type AreaCardsState = ReturnType<typeof useAreaCards>;

export function AreaCardsButton({ cards }: { cards: AreaCardsState }) {
  if (!cards.ready) return null;
  return (
    <button
      type="button"
      onClick={() => cards.setOpen(true)}
      className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-full border border-white/15 px-4 text-[13px] font-semibold text-white/85 hover:bg-white/5"
      data-testid="area-cards-open"
    >
      <LayoutGrid className="h-4 w-4" aria-hidden="true" />
      {AREA_CARDS_WORDS.button}
    </button>
  );
}

export function AreaCardsSheet({ board, cards }: { board: AreaCardsBoard; cards: AreaCardsState }) {
  if (!cards.open || !cards.catalogue) return null;
  const words = AREA_CARDS_WORDS[board];
  const notes = Object.fromEntries(Object.entries(cards.layout?.effective ?? {}).map(([id, e]) => [id, e.notes]));
  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/60 p-2 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={AREA_CARDS_WORDS.button}
      data-testid="area-cards-sheet"
    >
      <div className="h-full w-full max-w-[1500px] rounded-2xl bg-[#0d0c24]">
        <BoardCardPicker
          board={board}
          title={AREA_CARDS_WORDS.button}
          lead={words.lead}
          groups={cards.catalogue.groups}
          cards={cards.catalogue.cards}
          initial={cards.layout?.chosen ? cards.layout.cards : []}
          busy={cards.busy}
          error={cards.error}
          minCards={1}
          suggestedCount={5}
          addSuggestedLabel={words.add}
          note={(p) => (p.length ? '' : AREA_CARDS_WORDS.needOne)}
          onDone={(picked, options) => void cards.save(picked, options)}
          onCancel={() => {
            cards.setOpen(false);
            cards.setError(null);
          }}
          options={{ initial: cards.layout?.options ?? {}, notes }}
          testId="area-cards-picker"
        />
      </div>
    </div>
  );
}

/** the chosen cards above the board: tap one to see the board through it; All shows everything again */
export function AreaCardChips({
  cards,
  active,
  onSelect,
}: {
  cards: AreaCardsState;
  active: string | null;
  onSelect: (card: AreaCatalogueCard | null) => void;
}) {
  if (!cards.layout?.chosen || !cards.catalogue) return null;
  void loadCardPhotos(cards.layout.board);
  const chosen = cards.layout.cards.map((id) => cards.catalogue!.cards.find((c) => c.id === id)).filter((c): c is AreaCatalogueCard => !!c);
  const notes = active ? (cards.layout.effective[active]?.notes ?? []) : [];
  return (
    <div className="mb-4" data-testid="area-card-chips">
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]" role="radiogroup" aria-label={AREA_CARDS_WORDS.button}>
        <button
          type="button"
          role="radio"
          aria-checked={active === null}
          onClick={() => onSelect(null)}
          className={`inline-flex min-h-[44px] shrink-0 items-center rounded-xl border px-4 text-sm font-semibold ${active === null ? 'border-teal-300/60 bg-teal-500/10 text-teal-200' : 'border-white/10 bg-white/5 text-white/70'}`}
          data-testid="area-card-chip-all"
        >
          {AREA_CARDS_WORDS.allCards}
        </button>
        {chosen.map((c) => (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={active === c.id}
            onClick={() => onSelect(c)}
            className={`flex min-h-[44px] shrink-0 items-center gap-2 rounded-xl border py-1 pl-1 pr-3 text-sm font-semibold ${active === c.id ? 'border-teal-300/60 bg-teal-500/10 text-teal-100' : 'border-white/10 bg-white/5 text-white/80'}`}
            data-testid={`area-card-chip-${c.id}`}
          >
            <CardArt id={c.id} group={c.group} size="thumb" className="h-9 w-12 rounded-lg" />
            {c.title}
          </button>
        ))}
      </div>
      {notes.length > 0 && (
        <p className="mt-1.5 text-xs text-white/55" data-testid="area-card-notes">
          {notes.join(' ')}
        </p>
      )}
    </div>
  );
}
