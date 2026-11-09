/**
 * The person's own avatar (server docs/reading-engine/52 §4): their selfie when they have one, the Ganesh image when
 * not. The assistant's avatar beside answers stays the Ganesh image.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { fetchSelfieUrl } from '../lib/profileApi';
import { ShriGaneshAvatar } from './ShriGaneshAvatar';

export const SELFIE_CHANGED = 'astra:selfie-changed';

/** `fallback` replaces the Ganesh image when there is no photo (the Self board's "Add your photo" tap). */
export default function UserAvatar({ className = 'h-10 w-10', fallback }: { className?: string; fallback?: ReactNode }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let current: string | null = null;
    const load = () =>
      fetchSelfieUrl()
        .then((u) => {
          if (current) URL.revokeObjectURL(current);
          current = u;
          setUrl(u);
        })
        .catch(() => undefined);
    void load();
    window.addEventListener(SELFIE_CHANGED, load);
    return () => {
      window.removeEventListener(SELFIE_CHANGED, load);
      if (current) URL.revokeObjectURL(current);
    };
  }, []);
  if (!url) return fallback ? <>{fallback}</> : <ShriGaneshAvatar className={className} />;
  return (
    <div className={`shrink-0 overflow-hidden rounded-full ring-2 ring-white/25 ${className}`} data-testid="user-avatar-photo">
      <img src={url} alt="Your photo" className="h-full w-full object-cover" width={80} height={80} />
    </div>
  );
}
