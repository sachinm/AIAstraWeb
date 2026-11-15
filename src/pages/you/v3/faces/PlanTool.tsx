/** Plan tool: vetted multi-step action ladder (best, practical, drift, floor). */
import { planSteps, type ToolProps } from '../cardModel';
import { scrubEmptyRefs } from '../toolVetting';
import { V3_WORDS } from '../words';
import { PlanList } from './parts';

export default function PlanTool(props: ToolProps) {
  const steps =
    props.vetted?.plan.steps ??
    planSteps(props.card, { plan: 'with' })
      .map((s) => ({ key: s.key, text: scrubEmptyRefs(s.text) }))
      .filter((s) => Boolean(s.text));
  return (
    <div data-testid="tool-plan-panel">
      {steps.length ? <PlanList steps={steps} heading={null} /> : <p className="text-sm text-white/60">{V3_WORDS.noLadder}</p>}
    </div>
  );
}
