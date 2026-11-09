/**
 * Ask everywhere (server docs/reading-engine/51): a reading specialised to the board the person is on, in a dialog that
 * fills 98 % of the viewport so the experience is the chat's own. New conversations are filed under the board's
 * category; the sidebar in the chat shows them under that heading.
 *
 * The dialog is portalled to <body> (Sachin, 2026-11-09): rendered in place it sat inside the dashboard's <main>, whose
 * `.main-panel` backdrop-filter makes it the containing block for `position: fixed`, so the 98vh dialog was clipped to
 * the main container, its close button pushed out of reach, and the board looked replaced by the chat.
 */
import { forwardRef, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, MessageCircle } from 'lucide-react';
import ChatSection from '../pages/chat-interface/ChatSection';
import type { User } from '../App';
import { CATEGORY_FOCUS, CATEGORY_LABELS, CATEGORY_PLACEHOLDER } from '../pages/chat-interface/categories';
import { track } from '../lib/events';

export const AskButton = forwardRef<HTMLButtonElement, { category: string; onOpen: () => void; expanded?: boolean }>(function AskButton(
  { category, onOpen, expanded },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={() => {
        track('chip_select', category, 'ask_open');
        onOpen();
      }}
      aria-label={`Ask about ${CATEGORY_LABELS[category] ?? category}`}
      aria-haspopup="dialog"
      aria-expanded={expanded}
      className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
      data-testid="ask-button"
    >
      <MessageCircle className="h-5 w-5" aria-hidden="true" />
    </button>
  );
});

const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function AskModal({ user, category, onClose }: { user: User; category: string; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      // keep Tab inside the dialog
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !dialogRef.current.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !dialogRef.current.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', k);
    // lock the page behind; pad by the scrollbar's width so the board grid does not shift
    const body = document.body;
    const prevOverflow = body.style.overflow;
    const prevPad = body.style.paddingRight;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = 'hidden';
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
    closeRef.current?.focus();
    return () => {
      window.removeEventListener('keydown', k);
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPad;
    };
  }, []);

  const title = category === 'general' ? 'General Reading' : `Ask about ${CATEGORY_LABELS[category] ?? category}`;
  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70"
      role="presentation"
      data-testid="ask-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid="ask-modal"
        className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0b0a1f] text-white shadow-2xl"
        style={{ width: '98vw', height: '98vh' }}
      >
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 px-4">
          <div className="font-semibold">{title}</div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className="min-h-[44px] min-w-[44px] text-white/70 hover:text-white">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          <ChatSection user={user} activeChatId={null} category={category} focus={CATEGORY_FOCUS[category]} placeholder={CATEGORY_PLACEHOLDER[category]} embedded />
        </div>
      </div>
    </div>,
    document.body,
  );
}
