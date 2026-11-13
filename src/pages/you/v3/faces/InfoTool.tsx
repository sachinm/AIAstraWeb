/**
 * Info tool: the server's notes on how this card reads, when the board was built, and, when
 * "Is this right?" is turned off for the board but the card still waits on an answer, one quiet "Check this".
 */
import { ConfirmSection, OptionNotes } from '../CardParts';
import type { ToolProps } from '../cardModel';
import { V3_WORDS } from '../words';

export default function InfoTool({ card, builtOn, confirmOn }: ToolProps) {
  const waiting = !confirmOn ? card.v3?.confirm : null;
  const nothing = !card.optionNotes?.length && !builtOn && !waiting;
  return (
    <div className="space-y-1.5 text-sm text-white/70" data-testid="tool-info-panel">
      <OptionNotes card={card} />
      {builtOn && <p className="text-xs text-white/55" data-testid="info-built">{V3_WORDS.builtOn(builtOn)}</p>}
      {waiting && (
        <div data-testid="info-check">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-white/50">{V3_WORDS.checkThis}</p>
          <ConfirmSection confirm={waiting} />
        </div>
      )}
      {nothing && <p>{V3_WORDS.nothingYet}</p>}
    </div>
  );
}
