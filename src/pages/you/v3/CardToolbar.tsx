/**
 * The card's toolbar (card-faces plan): FACES rotate, one active (Read, Light, Breakdown, Research); TOOLS are
 * independent icon toggles (Table, Calendar, Dates, By timeframe, Plan, Info). "Chart details" is a plain button here
 * and in the card's footer: no face, tool or setting hides it.
 *
 * One row at every width from 640 px; below that it wraps to a second row. The compact variant (four cards across)
 * keeps only a face menu and the details button. Every control is a real button with a label; touch targets grow to
 * 44 px on a coarse pointer (selfBoardV3.css).
 */
import type { KeyboardEvent, ReactNode } from 'react';
import { CalendarDays, FileSearch, Info, Layers, List, ListChecks, Table } from 'lucide-react';
import { CARD_FACES, CARD_TOOLS, type CardFace, type CardTool } from '../../../lib/cardOptions';
import { FACE_WORD, TOOL_WORD, V3_WORDS } from './words';

const TOOL_ICON: Record<CardTool, ReactNode> = {
  table: <Table className="h-4 w-4" aria-hidden="true" />,
  calendar: <CalendarDays className="h-4 w-4" aria-hidden="true" />,
  dates: <List className="h-4 w-4" aria-hidden="true" />,
  timeframe: <Layers className="h-4 w-4" aria-hidden="true" />,
  plan: <ListChecks className="h-4 w-4" aria-hidden="true" />,
  info: <Info className="h-4 w-4" aria-hidden="true" />,
};

export interface CardToolbarProps {
  cardId: string;
  face: CardFace;
  onFace: (face: CardFace) => void;
  tools: readonly CardTool[];
  onTool: (tool: CardTool) => void;
  /** opens the Chart details sheet for the period on screen; always offered */
  onDetails?: () => void;
  /** a dot shows that the card keeps its own choices */
  hasOwn?: boolean;
  variant?: 'full' | 'compact';
}

const btn = 'self-v3-btn inline-flex items-center justify-center rounded-full text-[13px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60';

export function nextFace(face: CardFace, d: -1 | 1): CardFace {
  const i = CARD_FACES.indexOf(face);
  return CARD_FACES[(i + d + CARD_FACES.length) % CARD_FACES.length]!;
}

export default function CardToolbar({ cardId, face, onFace, tools, onTool, onDetails, hasOwn = false, variant = 'full' }: CardToolbarProps) {
  const details = onDetails && (
    <button type="button" onClick={onDetails} aria-label={V3_WORDS.chartDetails} title={V3_WORDS.chartDetails} className={`${btn} h-9 w-9 text-purple-200 hover:bg-white/10`} data-testid="toolbar-details">
      <FileSearch className="h-4 w-4" aria-hidden="true" />
    </button>
  );
  const dot = hasOwn && <span className="h-2 w-2 shrink-0 rounded-full bg-teal-300" role="img" aria-label={V3_WORDS.ownSettings} title={V3_WORDS.ownSettings} data-testid="toolbar-own-dot" />;

  if (variant === 'compact') {
    return (
      <div className="flex shrink-0 items-center gap-1.5" data-testid={`card-toolbar-${cardId}`} data-variant="compact">
        <select
          aria-label={V3_WORDS.faces}
          value={face}
          onChange={(e) => onFace(e.target.value as CardFace)}
          className="self-v3-btn min-w-0 flex-1 rounded-full border border-white/15 bg-[#0e1650] px-2.5 text-[13px] font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60"
          data-testid="face-select"
        >
          {CARD_FACES.map((f) => (
            <option key={f} value={f}>
              {FACE_WORD[f]}
            </option>
          ))}
        </select>
        {dot}
        {details}
      </div>
    );
  }

  const onKeys = (e: KeyboardEvent<HTMLDivElement>) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = nextFace(face, d);
    onFace(next);
    (e.currentTarget.querySelector(`[data-face="${next}"]`) as HTMLElement | null)?.focus();
  };

  return (
    <div className="self-v3-toolbar flex min-w-0 shrink-0 items-center gap-x-3 gap-y-1.5" data-testid={`card-toolbar-${cardId}`} data-variant="full">
      <div role="radiogroup" aria-label={V3_WORDS.faces} onKeyDown={onKeys} className="flex shrink-0 rounded-full border border-white/10 bg-white/5 p-0.5" data-testid="face-switch">
        {CARD_FACES.map((f) => (
          <button
            key={f}
            type="button"
            role="radio"
            aria-checked={face === f}
            tabIndex={face === f ? 0 : -1}
            data-face={f}
            onClick={() => onFace(f)}
            className={`${btn} h-8 px-3 ${face === f ? 'self-v3-on' : 'text-white/70 hover:text-white'}`}
            data-testid={`face-${f}`}
          >
            {FACE_WORD[f]}
          </button>
        ))}
      </div>
      <div role="group" aria-label={V3_WORDS.tools} className="flex shrink-0 items-center gap-0.5" data-testid="tool-switch">
        {CARD_TOOLS.map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={tools.includes(t)}
            aria-label={TOOL_WORD[t]}
            title={TOOL_WORD[t]}
            onClick={() => onTool(t)}
            className={`${btn} h-9 w-9 ${tools.includes(t) ? 'self-v3-on' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}
            data-testid={`tool-${t}`}
          >
            {TOOL_ICON[t]}
          </button>
        ))}
      </div>
      <span className="ml-auto flex shrink-0 items-center gap-1.5">
        {dot}
        {details}
      </span>
    </div>
  );
}
