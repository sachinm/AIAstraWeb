/** Dates tool: every date range on the card with its tone; the ones with words of their own can be opened. */
import type { ToolProps } from '../cardModel';
import { SPAN_TONE_DOT, SPAN_TONE_WORD, V3_WORDS } from '../words';

export default function DatesTool({ periods, period, onSelect }: ToolProps) {
  if (!periods.length) return <p className="text-sm text-white/60">{V3_WORDS.nothingYet}</p>;
  return (
    <ul className="grid gap-1.5" data-testid="tool-dates-panel">
      {periods.map((p) => (
        <li key={p.index}>
          <button
            type="button"
            disabled={!p.selectable}
            aria-pressed={p.index === period?.index}
            onClick={() => onSelect(p.index)}
            className={`self-v3-btn grid w-full grid-cols-[12px_1fr_auto] items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60 disabled:opacity-50 ${
              p.index === period?.index ? 'border-teal-300/50 bg-teal-500/10 text-white' : 'border-white/10 bg-white/[0.03] text-white/75 enabled:hover:bg-white/5'
            }`}
            data-testid={`date-${p.index}`}
          >
            <span className={`h-2.5 w-2.5 rounded-full ${SPAN_TONE_DOT[p.tone ?? 'none']}`} aria-hidden="true" />
            <span className="min-w-0 truncate font-medium">{p.item.label}</span>
            {p.tone && <span className="text-xs font-semibold text-white/70">{SPAN_TONE_WORD[p.tone]}</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}
