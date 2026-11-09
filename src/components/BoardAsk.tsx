/**
 * The Ask icon in a board's header and the modal it opens (server docs/reading-engine/51). ChatSection does not read
 * the user prop, so the modal passes an empty one; the session comes from the stored token like every chat call.
 *
 * Opening pushes a history entry (same URL, marked in history.state) so the browser's Back button closes the dialog
 * and leaves the person on the board; X, Esc and the backdrop pop that entry. The board itself is never unmounted, so
 * its tab and card stay as they were, and focus returns to the icon on close.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import AskModal, { AskButton } from './AskModal';
import type { User } from '../App';

const ASK_KEY = '__boardAsk';

export default function BoardAsk({ category }: { category: string }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  // Back (or anything else that pops the entry) closes the dialog
  useEffect(() => {
    if (!open) return;
    const onPop = () => setOpen(false);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [open]);

  // focus goes back to the icon once the dialog has gone
  useEffect(() => {
    if (wasOpen.current && !open) buttonRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  const openAsk = () => {
    if (open) return;
    const prev: unknown = window.history.state;
    window.history.pushState({ ...(prev && typeof prev === 'object' ? prev : {}), [ASK_KEY]: category }, '');
    setOpen(true);
  };

  const close = useCallback(() => {
    setOpen(false);
    // drop the entry we pushed so Back after closing does not land on a closed dialog
    const s: unknown = window.history.state;
    if (s && typeof s === 'object' && ASK_KEY in s) window.history.back();
  }, []);

  return (
    <>
      <AskButton ref={buttonRef} category={category} onOpen={openAsk} expanded={open} />
      {open && <AskModal user={{} as User} category={category} onClose={close} />}
    </>
  );
}
