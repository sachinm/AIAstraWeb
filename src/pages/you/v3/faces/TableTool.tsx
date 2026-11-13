/** Table tool: one row per period: dates, tone, what it asks, one step. A row with words of its own opens that period. */
import { firstSentence, type ToolProps } from '../cardModel';
import { SPAN_TONE_WORD, V3_WORDS } from '../words';

const th = 'px-2.5 py-1.5 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-white/50';

export default function TableTool({ periods, period, onSelect }: ToolProps) {
  if (!periods.length) return <p className="text-sm text-white/60">{V3_WORDS.nothingYet}</p>;
  return (
    <div className="overflow-x-auto [scrollbar-width:thin]" data-testid="tool-table-panel">
      <table className="w-full min-w-[420px] border-collapse text-[14px] text-white/80">
        <thead>
          <tr>
            <th className={th}>{V3_WORDS.period}</th>
            <th className={th}>{V3_WORDS.tone}</th>
            <th className={th}>{V3_WORDS.asks}</th>
            <th className={th}>{V3_WORDS.step}</th>
          </tr>
        </thead>
        <tbody>
          {periods.map((p) => (
            <tr key={p.index} className={`border-t border-white/10 ${p.index === period?.index ? 'bg-teal-500/10' : ''}`} data-testid={`table-row-${p.index}`}>
              <td className="px-2.5 py-2 align-top font-medium text-white/90">
                {p.selectable ? (
                  <button type="button" onClick={() => onSelect(p.index)} className="self-v3-btn text-left underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60" data-testid={`table-open-${p.index}`}>
                    {p.item.label}
                  </button>
                ) : (
                  p.item.label
                )}
              </td>
              <td className="px-2.5 py-2 align-top">{p.tone ? SPAN_TONE_WORD[p.tone] : ''}</td>
              <td className="px-2.5 py-2 align-top">{firstSentence(p.span?.asks ?? p.text?.[0] ?? '')}</td>
              <td className="px-2.5 py-2 align-top">{p.step ? firstSentence(p.step) : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
