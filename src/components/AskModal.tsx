/**
 * Ask everywhere (server docs/reading-engine/51): a reading specialised to the board the person is on, in a dialog that
 * fills 98 % of the viewport so the experience is the chat's own. New conversations are filed under the board's
 * category; the sidebar in the chat shows them under that heading.
 */
import { useEffect } from 'react';
import { X, MessageCircle } from 'lucide-react';
import ChatSection from '../pages/chat-interface/ChatSection';
import type { User } from '../App';
import { CATEGORY_FOCUS, CATEGORY_LABELS, CATEGORY_PLACEHOLDER } from '../pages/chat-interface/categories';
import { track } from '../lib/events';

export function AskButton({ category, onOpen }: { category: string; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={() => {
        track('chip_select', category, 'ask_open');
        onOpen();
      }}
      aria-label={`Ask about ${CATEGORY_LABELS[category] ?? category}`}
      className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
      data-testid="ask-button"
    >
      <MessageCircle className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}

export default function AskModal({ user, category, onClose }: { user: User; category: string; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', k);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  const title = category === 'general' ? 'General Reading' : `Ask about ${CATEGORY_LABELS[category] ?? category}`;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid="ask-modal"
        className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0b0a1f] text-white shadow-2xl"
        style={{ width: '98vw', height: '98vh' }}
      >
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 px-4">
          <div className="font-semibold">{title}</div>
          <button type="button" onClick={onClose} aria-label="Close" className="min-h-[44px] min-w-[44px] text-white/70 hover:text-white">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          <ChatSection user={user} activeChatId={null} category={category} focus={CATEGORY_FOCUS[category]} placeholder={CATEGORY_PLACEHOLDER[category]} embedded />
        </div>
      </div>
    </div>
  );
}
