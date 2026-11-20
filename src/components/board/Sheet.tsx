/**
 * A sheet for the Self board: a bottom sheet on a phone, a centred panel from `sm` up. With `inPane` it covers only its
 * positioned parent (the Duo's right pane, doc 66 §4.6: "Chart details opens as a sheet over the right pane only, so the
 * person keeps their place"). Escape and the backdrop close it; focus moves into it and back to where it was.
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export default function Sheet({ title, onClose, children, inPane = false, testId = 'self-sheet', wide = false }: { title: string; onClose: () => void; children: ReactNode; inPane?: boolean; testId?: string; wide?: boolean }) {
  const box = useRef<HTMLDivElement | null>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const before = typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null;
    box.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (before && typeof before.focus === 'function') before.focus();
    };
  }, []);

  return (
    <div
      className={`${inPane ? 'absolute' : 'fixed'} inset-0 z-[55] flex items-end justify-center bg-black/60 sm:items-center sm:p-4`}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      data-testid={`${testId}-backdrop`}
    >
      <div
        ref={box}
        tabIndex={-1}
        className={`flex max-h-[88%] w-full ${wide ? 'max-w-xl' : 'max-w-lg'} flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#141233] text-white shadow-2xl focus:outline-none sm:rounded-3xl`}
        onClick={(e) => e.stopPropagation()}
        data-testid={testId}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 px-5 pb-2 pt-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-white/60 hover:bg-white/10">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto px-5 pb-5">{children}</div>
      </div>
    </div>
  );
}
