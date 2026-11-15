/**
 * Table tool: side-by-side stretch comparison across vetted periods ONLY.
 * Renders only rows with vetted prose and dynamically includes only columns (`Tone`, `Focus`, `One step`) that carry
 * real data — never dead blank columns or empty rows.
 */
import type { ToolProps } from '../cardModel';
import { vetCardTools } from '../toolVetting';
import { SPAN_TONE_DOT, V3_WORDS } from '../words';

const th = 'px-2.5 py-1.5 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-white/55';

export default function TableTool(props: ToolProps) {
  const { card, periods, period, options, confirmOn, builtOn, onSelect } = props;
  const table =
    props.vetted?.table ??
    vetCardTools({ card, periods, options, confirmOn, builtOn, staleCopy: V3_WORDS.staleCardDates }).table;

  if (!table.rows.length) return <p className="text-sm text-white/60">{V3_WORDS.nothingYet}</p>;

  return (
    <div className="overflow-x-auto [scrollbar-width:thin]" data-testid="tool-table-panel">
      <table className="w-full min-w-[400px] border-collapse text-[14px] text-white/85">
        <caption className="sr-only">{V3_WORDS.tableCaption(card.title)}</caption>
        <thead>
          <tr>
            <th scope="col" className={th}>
              {V3_WORDS.period}
            </th>
            {table.showTone && (
              <th scope="col" className={th}>
                {V3_WORDS.tone}
              </th>
            )}
            {table.showFocus && (
              <th scope="col" className={th}>
                {V3_WORDS.focus}
              </th>
            )}
            <th scope="col" className={th}>
              {V3_WORDS.asks}
            </th>
            {table.showStep && (
              <th scope="col" className={th}>
                {V3_WORDS.step}
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row) => {
            const p = row.period;
            const selected = p.index === period?.index;
            return (
              <tr
                key={p.index}
                className={`border-t border-white/10 ${selected ? 'bg-teal-500/10' : ''}`}
                data-testid={`table-row-${p.index}`}
              >
                <td className="px-2.5 py-2 align-top font-medium text-white/95">
                  {p.selectable ? (
                    <button
                      type="button"
                      onClick={() => onSelect(p.index)}
                      className="self-v3-btn text-left underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60"
                      data-testid={`table-open-${p.index}`}
                    >
                      <span className="block whitespace-nowrap">{p.item.label}</span>
                      {p.current && (
                        <span className="mt-0.5 inline-block rounded-full bg-teal-400/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-teal-200">
                          {V3_WORDS.statusNow}
                        </span>
                      )}
                    </button>
                  ) : (
                    <span>{p.item.label}</span>
                  )}
                </td>
                {table.showTone && (
                  <td className="px-2.5 py-2 align-top whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${SPAN_TONE_DOT[p.tone ?? 'none']}`} aria-hidden="true" />
                      <span className="font-semibold text-white/90">{row.toneWord ?? row.modeWord ?? '—'}</span>
                    </div>
                    {row.toneWord && row.modeWord && <span className="block text-xs text-white/55">{row.modeWord}</span>}
                    {row.agreementShort && <span className="block text-[11px] text-white/50">{row.agreementShort}</span>}
                  </td>
                )}
                {table.showFocus && <td className="px-2.5 py-2 align-top text-white/80">{row.focus ?? ''}</td>}
                <td className="px-2.5 py-2 align-top">
                  <p>{row.summary}</p>
                  {row.trap && (
                    <p className="mt-0.5 text-xs text-amber-200/80">
                      <span className="font-semibold">{V3_WORDS.trapShort}:</span> {row.trap}
                    </p>
                  )}
                </td>
                {table.showStep && <td className="px-2.5 py-2 align-top text-white/85">{row.step ?? ''}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
