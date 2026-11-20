/**
 * The Self board's title: the person is the title (their photo, else the avatar that opens Personalize, and "Self").
 * Moved here unchanged from the v2 Self board when the v2 Self reading was retired.
 */
import UserAvatar from '../UserAvatar';
import { ShriGaneshAvatar } from '../ShriGaneshAvatar';
import { V2_WORDS } from './words';

export function SelfTitle({ onAddPhoto, small = false }: { onAddPhoto: () => void; small?: boolean }) {
  const size = small ? 'h-9 w-9' : 'h-11 w-11';
  return (
    <div className="flex min-w-0 items-center gap-3">
      <UserAvatar
        className={size}
        fallback={
          <button type="button" onClick={onAddPhoto} className="group flex items-center gap-2 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60" data-testid="self-add-photo" aria-label={V2_WORDS.addPhoto}>
            {/* the avatar alone is the way in (Sachin 2026-11-09: no "Add your photo" words in the header) */}
            <ShriGaneshAvatar className={size} />
          </button>
        }
      />
      <div className="min-w-0">
        <h1 className={`bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text font-extrabold leading-none tracking-tight text-transparent ${small ? 'text-2xl' : 'text-3xl'}`} data-testid="self-title">
          {V2_WORDS.title}
        </h1>
      </div>
    </div>
  );
}
