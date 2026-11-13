/**
 * The Research face: what stands behind the card, for the period on screen: the chart details the server sent, how
 * many clocks agree, each clock's word. Evidence keys show only when the server marks the person a practitioner
 * (`showEvidence`); a public person never sees more than the server sent. Opens in full, no Show more.
 */
import type { SelfV2Area } from '../../../../lib/selfV2Api';
import type { SelfV3CardView } from '../../../../lib/selfV3Api';
import { ChartDetails } from '../../v2/AreaCard';
import { SpanClocks } from '../CardParts';
import type { FaceProps } from '../cardModel';
import { V3_WORDS } from '../words';
import { PeriodHeading, eyebrow } from './parts';

/** Chart details reuses the v2 body, which reads only `details` */
export function detailsArea(card: SelfV3CardView): SelfV2Area {
  return {
    id: 'diagnosis',
    group: 'you',
    title: card.title,
    status: card.status,
    card: card.v2?.card ?? null,
    floor: [],
    details: { ...(card.v2?.details ?? { evidence: [] }), certainty: card.v2?.details.certainty as SelfV2Area['details']['certainty'] },
  };
}

export default function ResearchFace({ card, period, showEvidence }: FaceProps) {
  const agreement = card.v3?.agreement;
  return (
    <div className="space-y-3" data-testid="face-body-research">
      <PeriodHeading period={period} />
      <section data-testid="research-details">
        <h4 className={eyebrow}>{V3_WORDS.researchTitle}</h4>
        <div className="mt-1.5">
          <ChartDetails area={detailsArea(card)} showEvidence={showEvidence} />
        </div>
      </section>
      {agreement && (
        <p className="text-sm text-white/65" data-testid="research-agreement">
          {V3_WORDS.checkedOn(agreement.agree, agreement.of)}
        </p>
      )}
      <SpanClocks span={period?.span ?? null} label={period?.item.label ?? null} />
    </div>
  );
}
