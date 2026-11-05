/**
 * Renders its children into the nearest header slot (the General Reading modal's when it is open, else the page
 * header's), so a control that belongs to the chat, like "Use my location", lives in the header (Sachin, 2026-11-05).
 * With no slot on the page (a test, an embedded chat) the children render where they are.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export default function HeaderSlot({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<Element | null | undefined>(undefined);
  useEffect(() => {
    const slots = document.querySelectorAll('[data-chat-header-slot]');
    setTarget(slots.length ? slots[slots.length - 1]! : null);
  }, []);
  if (target === undefined) return null;
  return target ? createPortal(children, target) : <div className="mt-1 text-center">{children}</div>;
}
