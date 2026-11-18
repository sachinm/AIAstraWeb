/**
 * The card's face switch (doc 75): Read (default) and Short. With card chat on (server docs/reading-engine/85) a third
 * face, Chat, sits beside them: it is the card's conversation, opened in place, and Read or Short goes back to the card
 * (the conversation is kept). Chat is never stored as the card's face. The chat bubble and "i" for Why sit in the card's
 * header art (CardFrame). Touch targets grow to 44 px on a coarse pointer (selfBoardV3.css).
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
  /** Short is offered (the board's `feature.face.short`); default true */
  shortOn?: boolean;
  /** the card's Chat face, when card chat is on: whether it is open, and the way in */
  chat?: { open: boolean; onOpen: () => void };
}

export const FACES: readonly ShownFace[] = ['read', 'short'];

/** a face on the switch: the stored ones and Chat */
export type ToolbarFace = ShownFace | 'chat';
const TOOLBAR_WORD: Record<ToolbarFace, string> = { ...FACE_WORD, chat: 'Chat' };

const btn = 'self-v3-btn inline-flex items-center justify-center rounded-full text-[13px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60';

export default function CardToolbar({ cardId, face, onFace, hasOwn = false, shortOn = true, chat }: CardToolbarProps) {
  const faces: ToolbarFace[] = [...FACES.filter((f) => shortOn || f !== 'short'), ...(chat ? (['chat'] as const) : [])];
  const on: ToolbarFace = chat?.open ? 'chat' : face;
  const pick = (f: ToolbarFace) => {
    if (f === 'chat') chat?.onOpen();
    else onFace(f);
  };
  const onKeys = (e: KeyboardEvent<HTMLDivElement>) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    e.stopPropagation();
    const next = faces[(faces.indexOf(on) + d + faces.length) % faces.length]!;
    pick(next);
    (e.currentTarget.querySelector(`[data-face="${next}"]`) as HTMLElement | null)?.focus();
  };
  return (
    <div className="self-v3-toolbar flex min-w-0 shrink-0 items-center gap-2" data-testid={`card-toolbar-${cardId}`}>
      <div role="radiogroup" aria-label={V3_WORDS.faces} onKeyDown={onKeys} className="flex shrink-0 rounded-full border border-white/10 bg-white/5 p-0.5" data-testid="face-switch">
        {faces.map((f) => (
          <button
            key={f}
            type="button"
            role="radio"
            aria-checked={on === f}
            tabIndex={on === f ? 0 : -1}
            data-face={f}
            onClick={() => pick(f)}
            className={`${btn} h-8 px-3 ${on === f ? 'self-v3-on' : 'text-white/70 hover:text-white'}`}
            data-testid={`face-${f}`}
          >
            {TOOLBAR_WORD[f]}
          </button>
        ))}
      </div>
      {hasOwn && <span className="h-2 w-2 shrink-0 rounded-full bg-teal-300" role="img" aria-label={V3_WORDS.ownSettings} title={V3_WORDS.ownSettings} data-testid="toolbar-own-dot" />}
    </div>
  );
}
