/**
 * Small pieces the faces and tools share: the line that names the period on screen, a block of reading, the list of
 * other dated windows, and the plan ladder. Words come from words.ts; nothing here invents text.
 */
import type { LadderSteps } from '../../../../lib/selfV2Api';
import { firstSentence, type PeriodView, type ReadBlock } from '../cardModel';
import { SpanAgreement } from '../CardParts';
import { SPAN_MODE_WORD, SPAN_TONE_WORD, V3_WORDS } from '../words';

export const eyebrow = 'text-[11px] font-bold uppercase tracking-[0.08em] text-white/55';
export const body = 'text-[17px] leading-[1.65] text-white/85';

/** "Get through · now to 3 Jun 2027 · Heavy", then how many clocks agree */
export function PeriodHeading({ period }: { period: PeriodView | null }) {
  if (!period) return null;
  const bits = [period.span ? SPAN_MODE_WORD[period.span.mode] : null, period.item.label, period.item.note, period.tone ? SPAN_TONE_WORD[period.tone] : null].filter(Boolean);
  return (
    <div className="space-y-0.5 text-center" data-testid="period-heading" data-period={period.index}>
      <p className={eyebrow} data-testid="stretch-mode">
        {bits.join(' · ')}
      </p>
      <SpanAgreement span={period.span} />
    </div>
  );
}

/** one block of the Read face; the standing lines carry a quiet heading the first time */
export function BlockView({ block, lead = false }: { block: ReadBlock; lead?: boolean }) {
  if (block.kind === 'step')
    return (
      <p className="rounded-xl bg-white/5 px-3.5 py-2.5 text-[17px] leading-[1.6] text-white/90" data-testid="stretch-step">
        <span className={`${eyebrow} mb-0.5 block`}>{V3_WORDS.step}</span>
        {block.text}
      </p>
    );
  return (
    <p className={`${body} ${lead ? '' : block.kind === 'standing' ? 'text-white/75' : ''}`} data-testid={block.kind === 'standing' ? 'card-standing' : 'stretch-text'}>
      {block.text}
    </p>
  );
}

/** the other periods that have their own words: the first sentence each, and a way to open it */
export function WindowsList({ windows, onSelect }: { windows: PeriodView[]; onSelect: (i: number) => void }) {
  if (!windows.length) return null;
  return (
    <section data-testid="section-windows">
      <h4 className={eyebrow}>{V3_WORDS.otherWindows}</h4>
      <ul className="mt-1.5 grid gap-1.5">
        {windows.map((w) => (
          <li key={w.index}>
            <button type="button" onClick={() => onSelect(w.index)} className="self-v3-btn w-full rounded-xl bg-white/5 px-3 py-2 text-left text-[15px] text-white/80 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60" data-testid={`window-${w.index}`}>
              <b className="block text-[13px] font-semibold text-white/90">
                {w.item.label}
                {w.tone ? ` · ${SPAN_TONE_WORD[w.tone]}` : ''}
              </b>
              {firstSentence(w.text?.[0] ?? w.step ?? '')}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

const LADDER_LABEL: Record<keyof LadderSteps, { label: string; cls: string }> = {
  best: { label: 'Best', cls: 'text-emerald-300' },
  practical: { label: 'Practical', cls: 'text-teal-300' },
  drift: { label: 'Drift', cls: 'text-amber-300' },
  floor: { label: 'Floor', cls: 'text-rose-300' },
};

/** the plan's steps, best to floor */
export function PlanList({ steps, heading = V3_WORDS.whatToDo }: { steps: Array<{ key: keyof LadderSteps; text: string }>; heading?: string }) {
  if (!steps.length) return null;
  return (
    <section data-testid="section-plan">
      <h4 className={eyebrow}>{heading}</h4>
      <ul className="mt-1.5 grid gap-1.5">
        {steps.map((s) => (
          <li key={s.key} className="grid grid-cols-[84px_1fr] gap-2.5 rounded-xl bg-white/5 px-3 py-2 text-[15px]">
            <b className={`self-center text-xs font-bold uppercase tracking-wide ${LADDER_LABEL[s.key].cls}`}>{LADDER_LABEL[s.key].label}</b>
            <span className="text-white/80">{s.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
