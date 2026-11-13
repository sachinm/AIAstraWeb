/** Plan tool: the ladder of steps, best to floor. Opened on purpose, so it shows even when the card's plan option is off. */
import { planSteps, type ToolProps } from '../cardModel';
import { V3_WORDS } from '../words';
import { PlanList } from './parts';

export default function PlanTool({ card }: ToolProps) {
  const steps = planSteps(card, { plan: 'with' });
  return (
    <div data-testid="tool-plan-panel">
      {steps.length ? <PlanList steps={steps} heading={V3_WORDS.ladder} /> : <p className="text-sm text-white/60">{V3_WORDS.noLadder}</p>}
    </div>
  );
}
