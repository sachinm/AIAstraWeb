/**
 * The card's toolbar (card-faces plan): FACES rotate, one active (Read, Light, Breakdown, Research); TOOLS are
 * independent icon toggles (Table, Calendar, Dates, By timeframe, Plan, Info). "Chart details" is a plain button here
 * and in the card's footer: no face, tool or setting hides it.
 *
 * One row at every width from 640 px; below that it wraps to a second row. The compact variant (four cards across)
 * keeps only a face menu and the details button. Every control is a real button with a label; touch targets grow to
 * 44 px on a coarse pointer (selfBoardV3.css).
 *
 * Keyboard navigation follows Modern Web Guidance (`toolbar`): `focusgroup="toolbar wrap"` is kept in the markup, and
 * ONLY when `'focusGroup' in HTMLElement.prototype` is false does the toolbar install a single-tab-stop roving
 * `tabIndex` fallback across faces, vetted tools, and Chart details.
 */
import { useState, type FocusEvent, type KeyboardEvent, type ReactNode } from 'react';
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
  /** optional tools that passed vetting for this card; when empty, the optional tools group is omitted completely */
  availableTools?: readonly CardTool[];
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

function hasNativeFocusGroup(): boolean {
  return typeof HTMLElement !== 'undefined' && 'focusGroup' in HTMLElement.prototype;
}

export default function CardToolbar({
  cardId,
  face,
  onFace,
  tools,
  onTool,
  availableTools = CARD_TOOLS,
  onDetails,
  hasOwn = false,
  variant = 'full',
}: CardToolbarProps) {
  const [focusedStop, setFocusedStop] = useState<string>(`face-${face}`);
  const nativeFocusGroup = hasNativeFocusGroup();
  const shownTools = CARD_TOOLS.filter((t) => availableTools.includes(t));

  const stopIds = [
    ...CARD_FACES.map((f) => `face-${f}`),
    ...shownTools.map((t) => `tool-${t}`),
    ...(onDetails ? ['toolbar-details'] : []),
  ];
  const activeStop = stopIds.includes(focusedStop)
    ? focusedStop.startsWith('face-')
      ? `face-${face}`
      : focusedStop
    : `face-${face}`;

  const stopTabIndex = (stopId: string): number | undefined => {
    if (nativeFocusGroup) return undefined;
    return activeStop === stopId ? 0 : -1;
  };

  // Chart details is a required action control (opens the details sheet; never a toggle, never gated off by tool vetting)
  const details = onDetails && (
    <button
      type="button"
      onClick={onDetails}
      tabIndex={variant === 'compact' ? undefined : stopTabIndex('toolbar-details')}
      data-toolbar-stop={variant === 'compact' ? undefined : 'toolbar-details'}
      aria-label={V3_WORDS.chartDetails}
      title={V3_WORDS.chartDetails}
      className={`${btn} h-9 w-9 text-purple-200 hover:bg-white/10`}
      data-testid="toolbar-details"
    >
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

  const onToolbarKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (nativeFocusGroup || !stopIds.length) return;
    const targetStop = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-toolbar-stop]')?.dataset.toolbarStop;
    const currentStop = targetStop && stopIds.includes(targetStop) ? targetStop : activeStop;
    const currentIdx = Math.max(0, stopIds.indexOf(currentStop));

    let nextIdx: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      nextIdx = (currentIdx + 1) % stopIds.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      nextIdx = (currentIdx - 1 + stopIds.length) % stopIds.length;
    } else if (e.key === 'Home') {
      nextIdx = 0;
    } else if (e.key === 'End') {
      nextIdx = stopIds.length - 1;
    }
    if (nextIdx === null) return;

    e.preventDefault();
    const nextStop = stopIds[nextIdx]!;
    setFocusedStop(nextStop);
    if (nextStop.startsWith('face-')) {
      const nextFaceId = nextStop.slice(5) as CardFace;
      if (nextFaceId !== face) onFace(nextFaceId);
    }
    (e.currentTarget.querySelector(`[data-toolbar-stop="${nextStop}"]`) as HTMLElement | null)?.focus();
  };

  const onToolbarFocus = (e: FocusEvent<HTMLDivElement>) => {
    if (nativeFocusGroup) return;
    const stop = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-toolbar-stop]')?.dataset.toolbarStop;
    if (stop && stopIds.includes(stop)) setFocusedStop(stop);
  };

  return (
    <div
      role="toolbar"
      aria-label={shownTools.length > 0 ? `${V3_WORDS.faces} · ${V3_WORDS.tools}` : V3_WORDS.faces}
      {...({ focusgroup: 'toolbar wrap' } as Record<string, string>)}
      onKeyDown={onToolbarKeyDown}
      onFocus={onToolbarFocus}
      className="self-v3-toolbar flex min-w-0 shrink-0 items-center gap-x-2.5 gap-y-1.5"
      data-testid={`card-toolbar-${cardId}`}
      data-variant="full"
      data-vetted-tools={shownTools.length}
    >
      <div role="radiogroup" aria-label={V3_WORDS.faces} className="flex shrink-0 rounded-full border border-white/10 bg-white/5 p-0.5" data-testid="face-switch">
        {CARD_FACES.map((f) => {
          const stopId = `face-${f}`;
          return (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={face === f}
              tabIndex={stopTabIndex(stopId)}
              data-face={f}
              data-toolbar-stop={stopId}
              onClick={() => {
                setFocusedStop(stopId);
                onFace(f);
              }}
              className={`${btn} h-8 px-3 ${face === f ? 'self-v3-on' : 'text-white/70 hover:text-white'}`}
              data-testid={stopId}
            >
              {FACE_WORD[f]}
            </button>
          );
        })}
      </div>
      {shownTools.length > 0 && (
        <>
          <span role="separator" aria-orientation="vertical" className="h-4 w-0 shrink-0 border-l border-white/15" />
          <div role="group" aria-label={V3_WORDS.tools} className="flex shrink-0 items-center gap-0.5" data-testid="tool-switch">
            {shownTools.map((t) => {
              const active = tools.includes(t);
              const stopId = `tool-${t}`;
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={active}
                  aria-label={TOOL_WORD[t]}
                  title={TOOL_WORD[t]}
                  tabIndex={stopTabIndex(stopId)}
                  data-toolbar-stop={stopId}
                  onClick={() => {
                    setFocusedStop(stopId);
                    onTool(t);
                  }}
                  className={`${btn} h-9 w-9 ${active ? 'self-v3-on' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}
                  data-testid={stopId}
                >
                  {TOOL_ICON[t]}
                </button>
              );
            })}
          </div>
        </>
      )}
      <span className="ml-auto flex shrink-0 items-center gap-1.5">
        {dot}
        {details}
      </span>
    </div>
  );
}
