/**
 * Portals a board's own title and controls into the app header's board slot (`[data-board-header-slot]` in
 * TopNavigation) on a phone, so the main area holds only the cards (server docs/dashboards/09). With no slot on the
 * page (a test without the shell) the children render where they are, so nothing is lost.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export const BOARD_HEADER_SLOT = '[data-board-header-slot]';

export default function BoardHeaderSlot({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<Element | null | undefined>(undefined);
  useEffect(() => {
    setTarget(document.querySelector(BOARD_HEADER_SLOT));
  }, []);
  if (target === undefined) return null;
  return target ? createPortal(children, target) : <div className="flex items-center gap-1">{children}</div>;
}
