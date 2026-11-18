/**
 * The Read face (default, doc 75; server docs/dashboards/12): "What to do" first, the one best step and the one thing to
 * avoid (the old Short face is now the top of Read), then the picked period's own words, the card's standing lines and
 * "Your pattern" in one line. The card body scrolls; nothing is clamped.
 */
import { patternLine, whatToDo, type FaceProps } from '../cardModel';
import { V3_WORDS } from '../words';
import { body, label } from './parts';

export default function ReadFace({ card, period, standing }: FaceProps) {
  const paragraphs = [...(period?.text ?? []), ...standing];
  const pattern = patternLine(card);
  const todo = whatToDo(card, period);
  if (!paragraphs.length && !pattern && !todo.best && !todo.avoid)
    return (
      <p className="text-center text-[15px] text-white/60" data-testid="face-body-read">
        {V3_WORDS.noText}
      </p>
    );
  return (
    <div key={period?.index ?? -1} className="self-v3-fade space-y-3" data-testid="face-body-read">
      {(todo.best || todo.avoid) && (
        <section data-testid="section-todo">
          <h4 className={label}>{V3_WORDS.whatToDo}</h4>
          <ul className="mt-1.5 grid gap-1.5">
            {todo.best && (
              <li className="grid grid-cols-[72px_1fr] gap-2.5 rounded-xl bg-white/5 px-3 py-2 text-[15px]" data-testid="todo-best">
                <b className="self-center text-[13px] font-bold text-emerald-300">{V3_WORDS.doThis}</b>
                <span className="text-white/85">{todo.best}</span>
              </li>
            )}
            {todo.avoid && (
              <li className="grid grid-cols-[72px_1fr] gap-2.5 rounded-xl bg-white/5 px-3 py-2 text-[15px]" data-testid="todo-avoid">
                <b className="self-center text-[13px] font-bold text-amber-300">{V3_WORDS.avoid}</b>
                <span className="text-white/85">{todo.avoid}</span>
              </li>
            )}
          </ul>
        </section>
      )}
      {paragraphs.map((t, i) => (
        <p key={i} className={body} data-testid={i < (period?.text?.length ?? 0) ? 'stretch-text' : 'card-standing'}>
          {t}
        </p>
      ))}
      {pattern && (
        <section data-testid="section-pattern">
          <h4 className={label}>{V3_WORDS.pattern}</h4>
          <p className="mt-0.5 text-[15px] text-white/85">{pattern}</p>
        </section>
      )}
    </div>
  );
}
