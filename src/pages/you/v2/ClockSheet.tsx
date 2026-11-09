/**
 * The clock switch asks first and is counted (server docs/reading-engine/66 §4.4, mockup §4): why the board is read on
 * its clock now, what a switch costs, the clocks that apply with one plain line each, the ones that do not greyed with
 * the reason and not selectable, the note that Love and Work change too, then Not now / Rebuild on <clock> · 1 question.
 * A 400 is shown in the sheet; a 202 hands the plan status back to the page and closes the sheet.
 */
import { useState } from 'react';
import type { PlanStatus } from '../../../lib/billing';
import { changeSelfV2Clock, type ClockChangeResult, type SelfV2Clock } from '../../../lib/selfV2Api';
import Sheet from './Sheet';
import { V2_WORDS } from './words';

/** "Uses 1 of your 20 questions this month"; an unlimited plan uses none it counts. */
export function costLine(plan: PlanStatus | null | undefined): string {
  if (!plan || plan.exempt || plan.limit === null) return 'Included in your plan; no question is counted.';
  const when = plan.window === 'day' ? 'today' : 'this month';
  return `Uses 1 of your ${plan.limit} questions ${when}`;
}

export default function ClockSheet({ clock, plan, onClose, onChanged }: { clock: SelfV2Clock; plan: PlanStatus | null | undefined; onClose: () => void; onChanged: (system: string, label: string, r: Extract<ClockChangeResult, { ok: true }>) => void }) {
  const [pick, setPick] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chosen = clock.applicable.find((c) => c.system === pick) ?? null;

  const confirm = async () => {
    if (!chosen) return;
    setBusy(true);
    setError(null);
    const r = await changeSelfV2Clock(chosen.system);
    setBusy(false);
    if (r.ok) onChanged(chosen.system, chosen.label, r);
    else setError(V2_WORDS.clockErrors[r.error]);
  };

  return (
    <Sheet title={V2_WORDS.clockTitle} onClose={onClose} testId="clock-sheet">
      {clock.reasonLine && (
        <p className="text-sm text-white/70" data-testid="clock-reason">
          {clock.reasonLine}
        </p>
      )}
      <p className="my-3 rounded-xl bg-amber-500/15 px-3 py-2.5 text-sm font-bold text-amber-200" data-testid="clock-cost">
        {costLine(plan)}
      </p>
      <ul className="space-y-2" data-testid="clock-options">
        {clock.applicable.map((c) => {
          const current = c.system === clock.system;
          const on = pick === c.system;
          return (
            <li key={c.system}>
              <button
                type="button"
                role="radio"
                aria-checked={on}
                disabled={current || busy}
                onClick={() => setPick(c.system)}
                className={`grid min-h-[44px] w-full grid-cols-[1fr_auto] items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm ${on ? 'border-teal-300/60 bg-teal-500/15' : 'border-white/10 hover:bg-white/5'} ${current ? 'cursor-default' : ''}`}
                data-testid={`clock-option-${c.system}`}
              >
                <span>
                  <b className="block font-semibold text-white">{c.label}</b>
                  {c.line && <span className="text-xs text-white/55">{c.line}</span>}
                </span>
                <span className="text-xs text-white/55">{current ? V2_WORDS.clockCurrent : V2_WORDS.clockApplies}</span>
              </button>
            </li>
          );
        })}
        {clock.notApplicable.map((c) => (
          <li key={c.system}>
            <button
              type="button"
              disabled
              aria-disabled="true"
              className="grid min-h-[44px] w-full cursor-not-allowed grid-cols-[1fr_auto] items-center gap-2 rounded-xl border border-white/10 px-3 py-2.5 text-left text-sm opacity-50"
              data-testid={`clock-option-${c.system}`}
              data-applies="false"
            >
              <span>
                <b className="block font-semibold text-white">{c.label}</b>
                {c.reason && <span className="text-xs text-white/55">{c.reason}</span>}
              </span>
              <span className="text-xs text-white/55">{V2_WORDS.clockNotApplies}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-white/60" data-testid="clock-also">
        {V2_WORDS.clockAlsoChanges}
      </p>
      {error && (
        <p className="mt-2 text-sm text-rose-300" role="alert" data-testid="clock-error">
          {error}
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={onClose} className="min-h-[44px] flex-1 rounded-xl border border-white/15 px-3 text-sm font-bold text-white/80 hover:bg-white/5" data-testid="clock-not-now">
          {V2_WORDS.notNow}
        </button>
        <button
          type="button"
          disabled={!chosen || busy}
          onClick={() => void confirm()}
          className="min-h-[44px] flex-1 rounded-xl bg-teal-400 px-3 text-sm font-bold text-[#06051a] disabled:opacity-40"
          data-testid="clock-confirm"
        >
          {chosen ? V2_WORDS.rebuildOn(chosen.label) : V2_WORDS.pickClock}
        </button>
      </div>
    </Sheet>
  );
}
