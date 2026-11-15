/**
 * The open optional tools, one panel each, between the period strip and the reading.
 * Only tools that BOTH (a) are requested in `options.tools` AND (b) pass `vetCardTools` for this card are rendered,
 * so board-wide or stale tool preferences never open blank, redundant, or misleading panels.
 */
import type { ComponentType } from 'react';
import { X } from 'lucide-react';
import { CARD_TOOLS, type CardTool } from '../../../../lib/cardOptions';
import type { ToolProps } from '../cardModel';
import { vetCardTools } from '../toolVetting';
import { TOOL_WORD, V3_WORDS } from '../words';
import CalendarTool from './CalendarTool';
import DatesTool from './DatesTool';
import InfoTool from './InfoTool';
import PlanTool from './PlanTool';
import TableTool from './TableTool';
import TimeframeTool from './TimeframeTool';

const TOOL: Record<CardTool, ComponentType<ToolProps>> = {
  table: TableTool,
  calendar: CalendarTool,
  dates: DatesTool,
  timeframe: TimeframeTool,
  plan: PlanTool,
  info: InfoTool,
};

export default function ToolPanels(props: ToolProps) {
  const vetted =
    props.vetted ??
    vetCardTools({
      card: props.card,
      periods: props.periods,
      options: props.options,
      confirmOn: props.confirmOn,
      builtOn: props.builtOn,
      staleCopy: V3_WORDS.staleCardDates,
    });
  const open = CARD_TOOLS.filter((t) => vetted.openTools.includes(t));
  if (!open.length) return null;

  return (
    <div className="self-v3-tools flex shrink-0 flex-col gap-2 overflow-y-auto [scrollbar-width:thin]" data-testid="tool-panels">
      {open.map((t) => {
        const Tool = TOOL[t];
        const title = TOOL_WORD[t];
        return (
          <section key={t} aria-label={title} className="rounded-xl border border-white/10 bg-white/[0.035] p-3" data-testid={`tool-panel-${t}`}>
            <div className="mb-2 flex items-center justify-between gap-2 border-b border-white/10 pb-1.5">
              <h4 className="text-[11px] font-bold uppercase tracking-[0.08em] text-teal-200/85">{title}</h4>
              {props.onCloseTool && (
                <button
                  type="button"
                  onClick={() => props.onCloseTool?.(t)}
                  aria-label={V3_WORDS.closeTool(title)}
                  title={V3_WORDS.closeTool(title)}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full text-white/55 hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60"
                  data-testid={`tool-close-${t}`}
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
            <Tool {...props} vetted={vetted} />
          </section>
        );
      })}
    </div>
  );
}
