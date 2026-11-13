/**
 * The Light face: the period on screen, one sentence and one step. Short already, so no Show more.
 */
import { firstSentence, readBlocks, type FaceProps } from '../cardModel';
import { V3_WORDS } from '../words';
import { BlockView, PeriodHeading, body } from './parts';

export default function LightFace({ period, standing }: FaceProps) {
  const blocks = readBlocks(period, standing);
  const sentence = blocks.find((b) => b.kind !== 'step');
  return (
    <div className="space-y-3" data-testid="face-body-light">
      <PeriodHeading period={period} />
      {sentence ? <p className={body} data-testid="light-sentence">{firstSentence(sentence.text)}</p> : <p className="text-center text-[15px] text-white/60">{V3_WORDS.noText}</p>}
      {period?.step && <BlockView block={{ kind: 'step', text: period.step }} />}
    </div>
  );
}
