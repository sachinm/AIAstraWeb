/**
 * By timeframe tool: the card's periods grouped by weeks, months, quarters, years or decades (date arithmetic on the
 * stored dates), shown as a swipe carousel (scroll-snap, one group per slide) or as an accordion. A touch screen always
 * gets the swipe; the accordion is for a mouse (cardModel.resolveGroupsAs).
 */
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { CARD_GROUP_BYS } from '../../../../lib/cardOptions';
import { groupPeriods, resolveGroupsAs, type PeriodGroup, type ToolProps } from '../cardModel';
import { GROUP_BY_WORD, SPAN_TONE_WORD, V3_WORDS } from '../words';
import { body, eyebrow } from './parts';

function GroupText({ group, onSelect }: { group: PeriodGroup; onSelect: (i: number) => void }) {
  const written = group.periods.filter((p) => p.own);
  if (!written.length) return <p className="text-[15px] text-white/60">{V3_WORDS.noGroupText}</p>;
  return (
    <div className="space-y-3">
      {written.map((p) => (
        <div key={p.index} data-testid={`group-period-${p.index}`}>
          <button type="button" onClick={() => onSelect(p.index)} className={`${eyebrow} self-v3-btn text-left hover:text-white/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60`}>
            {p.item.label}
            {p.tone ? ` · ${SPAN_TONE_WORD[p.tone]}` : ''}
          </button>
          {(p.text ?? []).map((t, i) => (
            <p key={i} className={`${body} mt-1 text-[16px]`}>
              {t}
            </p>
          ))}
          {p.step && <p className="mt-1 rounded-xl bg-white/5 px-3 py-2 text-[15px] text-white/90">{p.step}</p>}
        </div>
      ))}
    </div>
  );
}

function Swipe({ groups, onSelect }: { groups: PeriodGroup[]; onSelect: (i: number) => void }) {
  const [at, setAt] = useState(0);
  return (
    <div data-testid="timeframe-swipe">
      <div
        className="self-v3-swipe flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none]"
        role="region"
        aria-roledescription="carousel"
        aria-label={V3_WORDS.timeframeTitle}
        tabIndex={0}
        onScroll={(e) => {
          const el = e.currentTarget;
          if (el.clientWidth) setAt(Math.round(el.scrollLeft / el.clientWidth));
        }}
      >
        {groups.map((g, i) => (
          <section key={g.key} role="group" aria-roledescription="slide" aria-label={V3_WORDS.groupN(i + 1, groups.length)} className="w-full shrink-0 snap-start px-1" data-testid={`group-${g.key}`}>
            <h5 className={`${eyebrow} mb-1.5`}>{g.label}</h5>
            <GroupText group={g} onSelect={onSelect} />
          </section>
        ))}
      </div>
      {groups.length > 1 && (
        <div className="mt-2 flex justify-center gap-1.5" aria-hidden="true">
          {groups.map((g, i) => (
            <span key={g.key} className={`h-1.5 rounded-full ${i === at ? 'w-4 bg-teal-300' : 'w-1.5 bg-white/30'}`} />
          ))}
        </div>
      )}
    </div>
  );
}

function Accordion({ groups, onSelect, selected }: { groups: PeriodGroup[]; onSelect: (i: number) => void; selected: number }) {
  const [open, setOpen] = useState<string | null>(() => groups.find((g) => g.periods.some((p) => p.index === selected))?.key ?? groups[0]?.key ?? null);
  return (
    <div className="grid gap-1.5" data-testid="timeframe-accordion">
      {groups.map((g) => (
        <section key={g.key} className="rounded-xl bg-white/[0.04]" data-testid={`group-${g.key}`}>
          <button
            type="button"
            aria-expanded={open === g.key}
            onClick={() => setOpen(open === g.key ? null : g.key)}
            className="self-v3-btn flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-white/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60"
          >
            {g.label}
            <ChevronDown className={`h-4 w-4 ${open === g.key ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
          {open === g.key && (
            <div className="px-3 pb-3">
              <GroupText group={g} onSelect={onSelect} />
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

export default function TimeframeTool({ periods, period, options, coarse, onGroupBy, onSelect }: ToolProps) {
  const as = resolveGroupsAs(options.groupsAs, coarse);
  const groups = groupPeriods(periods, options.groupBy);
  return (
    <div className="space-y-2.5" data-testid="tool-timeframe-panel" data-groups-as={as}>
      <div role="radiogroup" aria-label={V3_WORDS.groupBy} className="flex flex-wrap gap-1" data-testid="group-by">
        {CARD_GROUP_BYS.map((g) => (
          <button
            key={g}
            type="button"
            role="radio"
            aria-checked={options.groupBy === g}
            onClick={() => onGroupBy(g)}
            className={`self-v3-btn rounded-full px-3 text-[13px] font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60 ${options.groupBy === g ? 'self-v3-on' : 'bg-white/5 text-white/70 hover:text-white'}`}
            data-testid={`group-by-${g}`}
          >
            {GROUP_BY_WORD[g]}
          </button>
        ))}
      </div>
      {!groups.length ? (
        <p className="text-sm text-white/60">{V3_WORDS.nothingYet}</p>
      ) : as === 'swipe' ? (
        <Swipe groups={groups} onSelect={onSelect} />
      ) : (
        <Accordion groups={groups} onSelect={onSelect} selected={period?.index ?? 0} />
      )}
    </div>
  );
}
