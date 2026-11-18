/**
 * The chat bubble in a card's header, left of the "i" (server docs/reading-engine/85 §4 UI/UX). It opens that card's
 * Chat view; while the view is open it is pressed. With the assistant unavailable it is disabled and says why.
 */
import { MessageCircle } from 'lucide-react';
import { AI_UNAVAILABLE_MESSAGE, useAiUnavailable } from '../../lib/aiStatus';
import { CARD_CHAT_WORDS } from './words';

const iconBtn =
  'self-v3-btn inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/25 text-white hover:bg-black/40 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70';

export default function CardChatBubble({ title, open, onOpen, cardKey }: { title: string; open: boolean; onOpen: () => void; cardKey: string }) {
  const unavailable = useAiUnavailable();
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={unavailable}
      aria-label={CARD_CHAT_WORDS.bubble(title)}
      aria-pressed={open}
      title={unavailable ? AI_UNAVAILABLE_MESSAGE : CARD_CHAT_WORDS.bubble(title)}
      className={`${iconBtn} ${open ? 'bg-teal-500/40 ring-1 ring-teal-200/60' : ''}`}
      data-testid="card-chat-bubble"
      data-card-chat={cardKey}
    >
      <MessageCircle className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}
