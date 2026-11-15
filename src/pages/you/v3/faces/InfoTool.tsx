/**
 * Info tool: surfaced only when a card carries vetted card-level notices (server optionNotes, freshness notice, or a
 * deferred "Is this right?" calibration question when footer prompts are switched off).
 */
import { ConfirmSection } from '../CardParts';
import type { ToolProps } from '../cardModel';
import { vetCardTools } from '../toolVetting';
import { V3_WORDS } from '../words';

export default function InfoTool(props: ToolProps) {
  const { card, periods, options, builtOn, confirmOn } = props;
  const info =
    props.vetted?.info ??
    vetCardTools({ card, periods, options, confirmOn, builtOn, staleCopy: V3_WORDS.staleCardDates }).info;
  const nothing = !info.optionNotes.length && !info.waitingConfirm && !info.staleNote && !info.formattedBuiltOn;

  return (
    <div className="space-y-1.5 text-sm text-white/75" data-testid="tool-info-panel">
      {info.optionNotes.length > 0 && (
        <div className="space-y-1 text-xs text-white/70" data-testid="card-option-note">
          {info.optionNotes.map((n, i) => (
            <p key={i}>{n}</p>
          ))}
        </div>
      )}
      {info.staleNote && (
        <p className="text-xs text-amber-200/80" data-testid="info-stale">
          {info.staleNote}
        </p>
      )}
      {info.formattedBuiltOn && (
        <p className="text-xs text-white/55" data-testid="info-built">
          {V3_WORDS.builtOn(info.formattedBuiltOn)}
        </p>
      )}
      {info.waitingConfirm && (
        <div data-testid="info-check">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-white/50">{V3_WORDS.checkThis}</p>
          <ConfirmSection confirm={info.waitingConfirm} />
        </div>
      )}
      {nothing && <p>{V3_WORDS.nothingYet}</p>}
    </div>
  );
}
