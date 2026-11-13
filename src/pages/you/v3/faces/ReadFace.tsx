/**
 * The Read face (default): the period on screen, its own words, its one step and the card's standing lines, clamped to
 * about four lines with a button that says what is waiting. Folded away: the other dated windows and the plan.
 */
import { hiddenCounts, otherWindows, planSteps, readBlocks, showMoreLabel, type FaceProps } from '../cardModel';
import ShowMore from '../ShowMore';
import { V3_WORDS } from '../words';
import { BlockView, PeriodHeading, PlanList, WindowsList } from './parts';

export default function ReadFace({ card, period, periods, standing, options, expanded, onExpanded, onSelect }: FaceProps) {
  const blocks = readBlocks(period, standing);
  const steps = planSteps(card, options);
  const windows = otherWindows(periods, period?.index ?? -1);
  const counts = hiddenCounts(period, standing, periods, steps.length);
  const canExpand = counts.paragraphs + counts.windows + counts.steps > 0;
  if (!blocks.length && !windows.length && !steps.length)
    return (
      <div className="space-y-3" data-testid="face-body-read">
        <PeriodHeading period={period} />
        <p className="text-center text-[15px] text-white/60">{V3_WORDS.noText}</p>
      </div>
    );
  const [lead, ...others] = blocks;
  return (
    <div className="space-y-3" data-testid="face-body-read">
      <PeriodHeading period={period} />
      <div key={period?.index ?? -1} className="self-v3-fade">
        <ShowMore
          cardId={card.id}
          expanded={expanded}
          onToggle={onExpanded}
          canExpand={canExpand}
          label={showMoreLabel(counts)}
          lead={lead ? <BlockView block={lead} lead /> : <span />}
          rest={
            <>
              {others.map((b, i) => (
                <BlockView key={i} block={b} />
              ))}
              <WindowsList windows={windows} onSelect={onSelect} />
              <PlanList steps={steps} />
            </>
          }
        />
      </div>
    </div>
  );
}
