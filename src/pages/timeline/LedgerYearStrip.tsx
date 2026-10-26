import React from 'react';
import type { LifeEvent } from '../../lib/ledgerApi';
import { buildYearStrip, categoryLabel, formatEventDate, monthShort } from './ledgerUtils';

interface Props {
  events: LifeEvent[];
  years: number[];
  labels: Map<string, string>;
  selectedId?: string | null;
  onSelect: (event: LifeEvent) => void;
}

/**
 * Plain year strip: one column per year, oldest on the left. Whole-year events sit in a band at the top of the
 * column; month/day events are listed below in date order with their month. One neutral colour for everything.
 */
const LedgerYearStrip: React.FC<Props> = ({ events, years, labels, selectedId, onSelect }) => {
  const { columns, outside } = buildYearStrip(events, years);

  const chip = (ev: LifeEvent, prefix: string | null) => {
    const label = categoryLabel(labels, ev.category);
    const when = formatEventDate(ev.date, ev.date_precision);
    return (
      <button
        key={ev.id}
        type="button"
        onClick={() => onSelect(ev)}
        title={`${label} — ${when}${ev.place ? `, ${ev.place}` : ''}`}
        aria-label={`${label}, ${when}. Edit`}
        className={`block w-full break-words rounded border px-1 py-0.5 text-left text-[11px] leading-tight text-gray-100 hover:bg-white/15 ${
          selectedId === ev.id ? 'border-purple-300 bg-white/15' : 'border-white/15 bg-white/5'
        }`}
      >
        {prefix && <span className="block text-[10px] text-gray-400">{prefix}</span>}
        {label}
      </button>
    );
  };

  return (
    <div>
      <div className="overflow-x-auto pb-2" role="region" aria-label="Year strip">
        <ol
          className="grid min-w-[1100px] gap-px rounded-lg border border-white/10 bg-white/10"
          style={{ gridTemplateColumns: `repeat(${years.length}, minmax(0, 1fr))` }}
        >
          {columns.map((col) => (
            <li key={col.year} className="flex min-h-[9rem] flex-col bg-black/40" aria-label={String(col.year)} data-year={col.year}>
              <div className="border-b border-white/10 py-1 text-center text-xs font-medium text-gray-300">{col.year}</div>
              {col.wholeYear.length > 0 && (
                <div className="space-y-0.5 border-b border-dashed border-white/15 p-1" aria-label="Whole year">
                  {col.wholeYear.map((p) => chip(p.event, null))}
                </div>
              )}
              <div className="flex-1 space-y-0.5 p-1">
                {col.points.map((p) => chip(p.event, p.month ? monthShort(p.month) : null))}
              </div>
            </li>
          ))}
        </ol>
      </div>
      <p className="mt-1 text-xs text-gray-400">
        Events dated by year only sit above the dashed line of their year. {outside > 0 && `${outside} event${outside === 1 ? ' is' : 's are'} outside these years and shown in the list below only.`}
      </p>
    </div>
  );
};

export default LedgerYearStrip;
