import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AI_UNAVAILABLE_MESSAGE, closeAiNotice, useAiNoticeOpen } from '../lib/aiStatus';

/** Viewport-wide notice while the assistant is unavailable (see lib/aiStatus). Mounted once, in the signed-in app. */
export default function AiUnavailableModal() {
  const down = useAiNoticeOpen();
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (down) buttonRef.current?.focus();
  }, [down]);

  if (!down || typeof document === 'undefined') return null;
  return createPortal(
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="ai-down-title"
      aria-describedby="ai-down-text"
      data-testid="ai-unavailable-modal"
      className="fixed inset-0 z-[100] flex h-screen w-screen items-center justify-center bg-slate-950/95 px-6 text-center backdrop-blur-sm"
    >
      <div className="max-w-xl">
        <h2 id="ai-down-title" className="text-2xl font-semibold text-white">
          Assistant unavailable
        </h2>
        <p id="ai-down-text" className="mt-3 text-lg text-gray-200">
          {AI_UNAVAILABLE_MESSAGE}
        </p>
        <p className="mt-2 text-sm text-gray-400">Asking a question and getting a fresh reading are paused for a few minutes. Your earlier answers and readings are still here.</p>
        <button
          ref={buttonRef}
          type="button"
          onClick={closeAiNotice}
          className="mt-6 inline-flex min-h-11 items-center rounded-full bg-purple-500 px-6 text-sm font-semibold text-white hover:bg-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-300"
        >
          Close
        </button>
      </div>
    </div>,
    document.body,
  );
}
