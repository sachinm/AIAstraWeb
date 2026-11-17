/** The Short face (doc 75): one sentence and the one step, under the headline. */
import { firstSentence, whatToDo, type FaceProps } from '../cardModel';
import { V3_WORDS } from '../words';
import { body, label } from './parts';

export default function ShortFace({ card, period, standing }: FaceProps) {
  const first = period?.text?.[0] ?? standing[0] ?? null;
  const { best } = whatToDo(card, period);
  return (
    <div key={period?.index ?? -1} className="self-v3-fade space-y-3" data-testid="face-body-short">
      {first ? (
        <p className={body} data-testid="short-sentence">
          {firstSentence(first)}
        </p>
      ) : (
        <p className="text-center text-[15px] text-white/60">{V3_WORDS.noText}</p>
      )}
      {best && (
        <p className="rounded-xl bg-white/5 px-3.5 py-2.5 text-[15px] leading-[1.6] text-white/90" data-testid="short-step">
          <span className={`${label} mb-0.5 block`}>{V3_WORDS.step}</span>
          {best}
        </p>
      )}
    </div>
  );
}
