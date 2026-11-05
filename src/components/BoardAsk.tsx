/**
 * The Ask icon in a board's header and the modal it opens (server docs/reading-engine/51). ChatSection does not read
 * the user prop, so the modal passes an empty one; the session comes from the stored token like every chat call.
 */
import { useState } from 'react';
import AskModal, { AskButton } from './AskModal';
import type { User } from '../App';

export default function BoardAsk({ category }: { category: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <AskButton category={category} onOpen={() => setOpen(true)} />
      {open && <AskModal user={{} as User} category={category} onClose={() => setOpen(false)} />}
    </>
  );
}
