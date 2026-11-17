/**
 * The card's face switch (doc 75): Read (default) and Short, nothing else. The chat bubble and "i" for Why sit in the
 * card's header art (CardFrame). Touch targets grow to 44 px on a coarse pointer (selfBoardV3.css).
 */
import type { KeyboardEvent } from 'react';
import type { ShownFace } from './faces/FaceBody';
import { FACE_WORD, V3_WORDS } from './words';

export interface CardToolbarProps {
  cardId: string;
  face: ShownFace;
  onFace: (face: ShownFace) => void;
  /** a dot shows that the card keeps its own choices */
  hasOwn?: boolean;
}

export const FACES: readonly ShownFace[] = ['read', 'short'];

const btn = 'self-v3-btn inline-flex items-center justify-center rounded-full text-[13px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60';

export default function CardToolbar({ cardId, face, onFace, hasOwn = false }: CardToolbarProps) {
  const onKeys = (e: KeyboardEvent<HTMLDivElement>) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = FACES[(FACES.indexOf(face) + d + FACES.length) % FACES.length]!;
    onFace(next);
    (e.currentTarget.querySelector(`[data-face="${next}"]`) as HTMLElement | null)?.focus();
  };
  return (
    <div className="self-v3-toolbar flex min-w-0 shrink-0 items-center gap-2" data-testid={`card-toolbar-${cardId}`}>
      <div role="radiogroup" aria-label={V3_WORDS.faces} onKeyDown={onKeys} className="flex shrink-0 rounded-full border border-white/10 bg-white/5 p-0.5" data-testid="face-switch">
        {FACES.map((f) => (
          <button
            key={f}
            type="button"
            role="radio"
            aria-checked={face === f}
            tabIndex={face === f ? 0 : -1}
            data-face={f}
            onClick={() => onFace(f)}
            className={`${btn} h-8 px-3 ${face === f ? 'self-v3-on' : 'text-white/70 hover:text-white'}`}
            data-testid={`face-${f}`}
          >
            {FACE_WORD[f]}
          </button>
        ))}
      </div>
      {hasOwn && <span className="h-2 w-2 shrink-0 rounded-full bg-teal-300" role="img" aria-label={V3_WORDS.ownSettings} title={V3_WORDS.ownSettings} data-testid="toolbar-own-dot" />}
    </div>
  );
}
