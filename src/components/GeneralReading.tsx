/**
 * General Reading as a layer over the personal boards (Sachin, 2026-11-05; server docs/reading-engine/51). The boards
 * are the app; the full chat (every thread, grouped and pinned) opens in a 98 % modal from the header pill or the tab
 * bar's Ask, above whatever board the person is on. /dashboard/chat stays the one chat route behind it.
 */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import ChatSection from '../pages/chat-interface/ChatSection';
import type { User } from '../App';
import { track } from '../lib/events';
import { NoLeftRail } from './SideNav';

const Ctx = createContext<{ open: () => void } | null>(null);

/** Opens General Reading; outside the provider (tests, public pages) it is a no-op. */
export function useGeneralReading(): () => void {
  return useContext(Ctx)?.open ?? (() => undefined);
}

/** Opens General Reading, or null outside the provider (the signed-in header on public pages such as /pricing). */
export function useGeneralReadingIfAvailable(): (() => void) | null {
  return useContext(Ctx)?.open ?? null;
}

export function GeneralReadingProvider({ user, children }: { user: User; children: ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const open = useCallback(() => {
    track('board_open', 'header', 'general_reading');
    setOpen(true);
  }, []);
  return (
    <Ctx.Provider value={{ open }}>
      {children}
      {isOpen && <GeneralReadingModal user={user} onClose={() => setOpen(false)} />}
    </Ctx.Provider>
  );
}

function GeneralReadingModal({ user, onClose }: { user: User; onClose: () => void }) {
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
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="General Reading"
        data-testid="general-reading-modal"
        className="glass flex flex-col overflow-hidden rounded-2xl bg-[#0b0a1f]/80 text-white"
        style={{ width: '98vw', height: '98vh' }}
      >
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 px-4">
          <div className="flex min-w-0 items-center gap-4">
            <div className="font-semibold">General Reading</div>
            <div data-chat-header-slot className="flex min-w-0 items-center" />
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="min-h-[44px] min-w-[44px] text-white/70 hover:text-white">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          <NoLeftRail>
            <ChatSection user={user} activeChatId={null} category="general" />
          </NoLeftRail>
        </div>
      </div>
    </div>
  );
}
