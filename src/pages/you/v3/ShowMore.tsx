/**
 * "Show more" for the Read face: the first block clamped to about four lines with a soft fade, and a button whose label
 * says what is waiting (built from real counts in cardModel.showMoreLabel). "Show less" folds it back. Nothing here is
 * invented: when nothing is hidden the block shows whole and there is no button.
 */
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { V3_WORDS } from './words';

export interface ShowMoreProps {
  /** the always-visible lead (the first block); clamped while folded */
  lead: ReactNode;
  /** the rest, shown only when expanded */
  rest?: ReactNode;
  expanded: boolean;
  onToggle: (next: boolean) => void;
  /** the teaser from showMoreLabel; ignored when `canExpand` is false */
  label: string;
  /** false when there is nothing to reveal: the lead shows whole and no button is drawn */
  canExpand: boolean;
  cardId: string;
}

export default function ShowMore({ lead, rest, expanded, onToggle, label, canExpand, cardId }: ShowMoreProps) {
  const folded = canExpand && !expanded;
  const box = useRef<HTMLDivElement | null>(null);
  const [cut, setCut] = useState(false);
  // the fade shows only when the clamp really cuts a line
  useLayoutEffect(() => {
    const el = box.current?.firstElementChild as HTMLElement | null | undefined;
    setCut(!!folded && !!el && el.scrollHeight > el.clientHeight + 1);
  }, [folded, lead]);
  return (
    <div data-testid="show-more" data-expanded={expanded ? 'true' : 'false'}>
      <div ref={box} className={folded ? 'self-v3-clamp' : undefined} data-clamped={folded ? 'true' : 'false'} data-cut={cut ? 'true' : 'false'}>
        {lead}
      </div>
      {canExpand && expanded && (
        <div id={`more-${cardId}`} className="self-v3-unfold mt-3 space-y-3" data-testid="show-more-rest">
          {rest}
        </div>
      )}
      {canExpand && (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={`more-${cardId}`}
          onClick={() => onToggle(!expanded)}
          className="self-v3-btn mx-auto mt-2 flex max-w-full items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3.5 text-[13px] font-semibold text-white/85 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60"
          data-testid="show-more-toggle"
        >
          <span className="truncate">{expanded ? V3_WORDS.showLess : label}</span>
          <ChevronDown className={`h-4 w-4 shrink-0 ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
