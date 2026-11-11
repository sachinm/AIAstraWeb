/**
 * The card picker (server docs/reading-engine/68 §4.1). Opens on the first visit (`layout.chosen` false) and from the
 * `+` chip. Every catalogue card is a tile in its group with its description and, once read, its real first line for
 * this person. Suggested cards carry a small mark but are never ticked for the person; one button ticks them in one tap.
 * Unavailable cards are greyed with the reason. Done needs at least three cards; past eight the page says so, kindly.
 */
import { useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { MIN_CARDS, MIN_READING_CARDS, SELF_CARD_GROUPS, SUGGESTED_COUNT, type SelfCardId, type SelfV3CardView } from '../../../lib/selfV3Api';
import { V3_WORDS } from './words';

export default function Picker({
  cards,
  initial,
  busy = false,
  error = null,
  onDone,
  onCancel,
  readingOn = false,
}: {
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
}) {
  const [picked, setPicked] = useState<SelfCardId[]>(initial);
  const on = useMemo(() => new Set(picked), [picked]);
  const suggested = cards.filter((c) => c.suggested && c.available).slice(0, SUGGESTED_COUNT);
  const groups = SELF_CARD_GROUPS.map((g) => ({ ...g, cards: cards.filter((c) => c.group === g.id) })).filter((g) => g.cards.length);

  const toggle = (c: SelfV3CardView) => {
    if (!c.available) return;
    setPicked((p) => (p.includes(c.id) ? p.filter((x) => x !== c.id) : [...p, c.id]));
  };
  const addSuggested = () => setPicked((p) => [...p, ...suggested.map((c) => c.id).filter((id) => !p.includes(id))]);

  const enough = picked.length >= MIN_CARDS;
  return (
    <section className="self-v3-picker glass flex h-full min-h-0 flex-col rounded-2xl p-5 sm:p-6" aria-label={V3_WORDS.pickerTitle} data-testid="self-v3-picker">
      <header className="shrink-0">
        <h2 className="text-xl font-bold text-white">{V3_WORDS.pickerTitle}</h2>
        <p className="mt-1 max-w-[65ch] text-base text-white/75" data-testid="picker-lead">
          {V3_WORDS.pickerLead}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={addSuggested}
            disabled={!suggested.length || suggested.every((c) => on.has(c.id))}
            className="inline-flex min-h-[44px] items-center rounded-full border border-teal-300/50 bg-teal-500/10 px-4 text-sm font-semibold text-teal-200 hover:bg-teal-500/20 disabled:opacity-40"
            data-testid="picker-add-suggested"
          >
            {V3_WORDS.addSuggested}
          </button>
          <span className="text-sm text-white/60" aria-live="polite" data-testid="picker-count">
            {V3_WORDS.chosenCount(picked.length)}
          </span>
        </div>
      </header>
      <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1 [scrollbar-width:thin]" data-testid="picker-groups">
        {groups.map((g) => (
          <fieldset key={g.id} className="mb-5" data-testid={`picker-group-${g.id}`}>
            <legend className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-white/50">{g.title}</legend>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {g.cards.map((c) => {
                const ticked = on.has(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="checkbox"
                    aria-checked={ticked}
                    aria-disabled={!c.available || undefined}
                    disabled={!c.available}
                    onClick={() => toggle(c)}
                    className={`relative flex min-h-[96px] flex-col items-start rounded-2xl border p-4 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60 ${
                      !c.available ? 'cursor-not-allowed border-white/5 bg-white/[0.02] opacity-50' : ticked ? 'border-teal-300/60 bg-teal-500/10' : 'border-white/10 bg-white/5 hover:bg-white/10'
                    }`}
                    data-testid={`picker-tile-${c.id}`}
                    data-suggested={c.suggested ? 'true' : 'false'}
                  >
                    <span className="flex w-full items-start justify-between gap-2">
                      <b className="text-base font-semibold text-white">{c.title}</b>
                      <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border ${ticked ? 'border-teal-300 bg-teal-400 text-[#06051a]' : 'border-white/25'}`} aria-hidden="true">
                        {ticked && <Check className="h-4 w-4" />}
                      </span>
                    </span>
                    <span className="mt-1 text-sm text-white/65">{c.description}</span>
                    {c.available && c.firstLine && <span className="mt-2 text-sm italic text-white/85" data-testid="picker-first-line">{c.firstLine}</span>}
                    {!c.available && c.unavailableReason && (
                      <span className="mt-2 text-sm text-white/70" data-testid="picker-unavailable">
                        {c.unavailableReason}
                      </span>
                    )}
                    {c.suggested && c.available && (
                      <span className="mt-2 inline-flex rounded-full bg-purple-500/15 px-2 py-0.5 text-[11px] font-semibold text-purple-200" data-testid="picker-suggested">
                        {V3_WORDS.suggested}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>
      <footer className="mt-3 flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-white/10 pt-3">
        <p className="mr-auto text-sm text-white/65" aria-live="polite" data-testid="picker-note">
          {!enough
            ? V3_WORDS.needThree(picked.length)
            : readingOn && picked.length < MIN_READING_CARDS
              ? V3_WORDS.addFive
              : picked.length > SUGGESTED_COUNT
                ? V3_WORDS.moreThanEight
                : ''}
        </p>
        {error && (
          <p role="alert" className="w-full text-right text-sm text-rose-300" data-testid="picker-error">
            {error}
          </p>
        )}
        {onCancel && (
          <button type="button" onClick={onCancel} className="min-h-[44px] rounded-xl border border-white/15 px-4 text-sm font-bold text-white/80 hover:bg-white/5" data-testid="picker-cancel">
            {V3_WORDS.cancel}
          </button>
        )}
        <button
          type="button"
          disabled={!enough || busy}
          onClick={() => onDone(picked)}
          className="min-h-[44px] rounded-xl bg-teal-400 px-6 text-sm font-bold text-[#06051a] disabled:opacity-40"
          data-testid="picker-done"
        >
          {V3_WORDS.done}
        </button>
      </footer>
    </section>
  );
}
