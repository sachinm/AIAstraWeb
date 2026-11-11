/**
 * "How this card reads" (server docs/reading-engine/71 §4.3): four segmented choices (length, view, words, plan), the
 * default first, and the server's plain lines where a choice cannot be honoured yet.
 */
import { CARD_OPTION_KEYS, CARD_OPTION_WORDS, CARD_OPTIONS_TITLE, effectiveOptions, type CardOptionKey, type CardOptions } from '../../lib/cardOptions';

export default function CardOptionsControls({
  cardId,
  title,
  chosen,
  notes = [],
  onChange,
  disabled = false,
  compact = false,
}: {
  cardId: string;
  title: string;
  chosen: Partial<CardOptions> | undefined;
  notes?: string[];
  onChange: (key: CardOptionKey, value: string) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const o = effectiveOptions(chosen);
  return (
    <div role="group" aria-label={`${title}: ${CARD_OPTIONS_TITLE}`} className="flex flex-col gap-2" data-testid={`card-options-${cardId}`}>
      {!compact && <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-white/50">{CARD_OPTIONS_TITLE}</p>}
      {CARD_OPTION_KEYS.map((k) => {
        const w = CARD_OPTION_WORDS[k];
        return (
          <div key={k} className="flex flex-col gap-1">
            <span className="text-xs text-white/60" id={`opt-${cardId}-${k}`}>
              {w.label}
            </span>
            <div role="radiogroup" aria-labelledby={`opt-${cardId}-${k}`} className="flex flex-wrap rounded-full border border-white/10 bg-white/5 p-0.5">
              {w.choices.map((c) => {
                const on = o[k] === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    disabled={disabled}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!on) onChange(k, c.value);
                    }}
                    className={`min-h-[34px] flex-1 rounded-full px-2.5 text-[12px] font-semibold disabled:opacity-40 ${on ? 'bg-teal-500/20 text-teal-200' : 'text-white/65 hover:text-white'}`}
                    data-testid={`opt-${cardId}-${k}-${c.value}`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      {notes.length > 0 && (
        <ul className="mt-1 flex flex-col gap-1" data-testid={`card-option-notes-${cardId}`}>
          {notes.map((n) => (
            <li key={n} className="text-xs text-white/60">
              {n}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
