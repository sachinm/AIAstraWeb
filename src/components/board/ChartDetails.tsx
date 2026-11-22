/**
 * Chart details and the card shell the boards share (moved here unchanged from the v2 Self board's AreaCard when the v2
 * Self reading was retired). Chart details is the server's long reading with chart terms allowed.
 */
import type { AreaCertainty } from '../../lib/boardTypes';
import { scrubEmptyRefs } from '../../pages/you/v3/toolVetting';
import { CERTAINTY_WORD } from './words';

export const cardShell = 'glass flex h-full min-h-0 flex-col rounded-2xl p-4';

/** the long reading's body as the server stores it (a v2 area's `details`, or a v3 card's `v2.details`) */
export interface ChartDetailsBody {
  headline?: string;
  paragraphs?: string[];
  evidence?: string[];
  /** the stored enum ("strong", "likely", "possible"); anything else shows no word */
  certainty?: string;
}

/** true when the body has a headline or a paragraph to show */
export function hasChartDetails(d: ChartDetailsBody | null | undefined): boolean {
  return !!d && (!!d.headline?.trim() || (d.paragraphs ?? []).some((p) => !!p?.trim()));
}

/**
 * Chart details: the server's own words with chart terms allowed. No timings, technique ids or claim ids; evidence keys
 * only for a practitioner (`profile.role === 'practitioner'` on the board). `emptyLine`: the v2 board says when there is
 * nothing more; the v3 board draws this only when there is something (`hasChartDetails`).
 */
export function ChartDetails({ details, showEvidence = false, emptyLine = true }: { details: ChartDetailsBody; showEvidence?: boolean; emptyLine?: boolean }) {
  const d = details;
  const evidence = d.evidence ?? [];
  const headline = d.headline ? scrubEmptyRefs(d.headline) : '';
  const paragraphs = (d.paragraphs ?? []).map((p) => scrubEmptyRefs(p)).filter(Boolean);
  const certainty = d.certainty && Object.prototype.hasOwnProperty.call(CERTAINTY_WORD, d.certainty) ? CERTAINTY_WORD[d.certainty as AreaCertainty] : null;
  const nothing = !headline && !paragraphs.length && !(showEvidence && evidence.length);
  return (
    <div className="space-y-2.5 text-[15px] leading-relaxed text-white/80" data-testid="area-details">
      {headline && <p className="font-semibold text-white">{headline}</p>}
      {paragraphs.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
      {certainty && <p className="text-xs text-white/55">{certainty}</p>}
      {showEvidence && evidence.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-xs text-white/50" data-testid="area-evidence">
          {evidence.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      {nothing && emptyLine && <p className="text-white/60">Nothing more to show for this card yet.</p>}
    </div>
  );
}
