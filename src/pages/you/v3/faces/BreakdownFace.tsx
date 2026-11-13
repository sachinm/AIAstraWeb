/**
 * The Breakdown face: labelled blocks (what it asks, the likely trap, one step, your pattern, the ladder, what holds
 * whatever the date). Each block shows its first sentence with its own "more" link. On a card 900 px or wider the
 * blocks sit in two columns (selfBoardV3.css), never beside the headline.
 */
import { useState } from 'react';
import { firstSentence, planSteps, type FaceProps } from '../cardModel';
import { cardPatterns } from '../CardParts';
import { V3_WORDS } from '../words';
import { PeriodHeading, PlanList, body, eyebrow } from './parts';

function Block({ title, text, testId }: { title: string; text: string; testId: string }) {
  const [open, setOpen] = useState(false);
  const first = firstSentence(text);
  const more = first.length < text.trim().length;
  return (
    <section className="rounded-xl bg-white/[0.04] px-3.5 py-3" data-testid={testId}>
      <h4 className={eyebrow}>{title}</h4>
      <p className={`${body} mt-1 text-[16px]`}>{open || !more ? text : first}</p>
      {more && (
        <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="self-v3-btn mt-1 rounded-lg text-[13px] font-semibold text-purple-300 hover:text-purple-200" data-testid={`${testId}-more`}>
          {open ? V3_WORDS.less : V3_WORDS.more}
        </button>
      )}
    </section>
  );
}

export default function BreakdownFace({ card, period, standing, options }: FaceProps) {
  const span = period?.span ?? null;
  const asks = span ? span.asks : period?.text?.[0];
  const trap = span ? span.obstacle : period?.text?.[1];
  const rest = span ? [] : (period?.text ?? []).slice(2);
  const patterns = cardPatterns(card);
  const steps = planSteps(card, options);
  const any = asks || trap || period?.step || rest.length || patterns.length || steps.length || standing.length;
  return (
    <div className="space-y-3" data-testid="face-body-breakdown">
      <PeriodHeading period={period} />
      {!any && <p className="text-center text-[15px] text-white/60">{V3_WORDS.noText}</p>}
      <div className="self-v3-blocks grid gap-3">
        {asks?.trim() && <Block title={V3_WORDS.asks} text={asks} testId="block-asks" />}
        {trap?.trim() && <Block title={V3_WORDS.obstacle} text={trap} testId="block-trap" />}
        {rest.map((t, i) => (
          <Block key={i} title={V3_WORDS.moreForStretch} text={t} testId={`block-more-${i}`} />
        ))}
        {period?.step && <Block title={V3_WORDS.step} text={period.step} testId="block-step" />}
        {patterns.map((pt, i) => (
          <Block key={i} title={V3_WORDS.pattern} text={pt.text} testId={`block-pattern-${i}`} />
        ))}
        {standing.map((t, i) => (
          <Block key={i} title={V3_WORDS.standing} text={t} testId={`block-standing-${i}`} />
        ))}
      </div>
      <PlanList steps={steps} heading={V3_WORDS.ladder} />
    </div>
  );
}
