/**
 * The open tools, one panel each, between the toolbar and the reading. Each panel is labelled and scrolls inside
 * itself, so a tool never pushes the reading off the card.
 */
import type { ComponentType } from 'react';
import { CARD_TOOLS, type CardTool } from '../../../../lib/cardOptions';
import type { ToolProps } from '../cardModel';
import { TOOL_WORD } from '../words';
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
  const open = CARD_TOOLS.filter((t) => props.options.tools.includes(t));
  if (!open.length) return null;
  return (
    <div className="self-v3-tools grid shrink-0 gap-2" data-testid="tool-panels">
      {open.map((t) => {
        const Tool = TOOL[t];
        return (
          <section key={t} aria-label={TOOL_WORD[t]} className="max-h-[38vh] overflow-y-auto rounded-xl border border-white/10 bg-white/[0.03] p-3 [scrollbar-width:thin]" data-testid={`tool-panel-${t}`}>
            <Tool {...props} />
          </section>
        );
      })}
    </div>
  );
}
