/**
 * The one loading overlay (server docs/loading-overlay/01). A translucent veil over whatever is beneath (a skeleton
 * passed as children, or the page itself), one of four house-chart illustrations in the viewer's theme behind a line
 * in the assistant's voice that changes every few seconds. The line and the illustration are picked at random each
 * time the veil appears. If the illustration cannot be had (signed out, not configured, offline) the veil shows its
 * lines alone; a wait never fails because of its decoration.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Sparkles } from 'lucide-react';
import { LINE_MS, prefersReducedMotion } from '../pages/chat-interface/ReadingStagesPanel';
import { LOADING_QUIPS, pickQuipStart } from '../lib/loadingQuips';
import { getOverlayArt, pickStyle, type ArtStyle, type ArtTheme } from '../lib/overlayArt';

export interface LoadingVeilProps {
  /** Cover the whole viewport (session restore). Otherwise the veil fills its relative parent, over `children`. */
  fullScreen?: boolean;
  /** A short factual sentence under the rotating line, e.g. what the page will do by itself. */
  note?: string;
  /** What stays faintly visible beneath the veil: a skeleton, a progress card, the page's own frame. */
  children?: ReactNode;
  /** Something the person can use while waiting (a progress card with Retry): drawn over the veil, fully interactive. */
  foreground?: ReactNode;
  /** The wait is over: the layer fades out (300 ms) while the caller keeps it mounted a moment longer. */
  leaving?: boolean;
  /** Kept for callers whose tests look for the old loading element. */
  testId?: string;
  className?: string;
}

/** The theme on <html> now (src/lib/theme.ts puts `light` there on the signed-in pages). */
function htmlTheme(): ArtTheme {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.classList.contains('light') ? 'light' : 'dark';
}

/** The rotating line: a random start, then the next one every LINE_MS. */
export function useLoadingQuip(): string {
  const [i, setI] = useState(() => pickQuipStart());
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % LOADING_QUIPS.length), LINE_MS);
    return () => clearInterval(t);
  }, []);
  return LOADING_QUIPS[i]!;
}

/** An object URL for a random chart style in the given theme, or null while loading or when unavailable. */
export function useOverlayArt(theme: ArtTheme): { url: string | null; style: ArtStyle } {
  const style = useMemo(() => pickStyle(), []);
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    let made: string | null = null;
    void getOverlayArt(style, theme).then((blob) => {
      if (!alive || !blob || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return;
      made = URL.createObjectURL(blob);
      setUrl(made);
    });
    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [style, theme]);
  return { url, style };
}

export default function LoadingVeil({ fullScreen = false, note, children, foreground, leaving = false, testId = 'loading-veil', className = '' }: LoadingVeilProps) {
  const theme = htmlTheme();
  const line = useLoadingQuip();
  const { url, style } = useOverlayArt(theme);
  const still = prefersReducedMotion();

  return (
    <div
      className={`load-veil ${fullScreen ? 'load-veil--fixed' : 'load-veil--fill'} ${leaving ? 'load-veil--leaving' : ''} ${className}`}
      data-testid={testId}
      data-theme={theme}
      data-art={url ? style : 'none'}
      aria-busy="true"
    >
      {children && (
        <div className="load-veil__under" aria-hidden="true">
          {children}
        </div>
      )}
      <div className="load-veil__layer">
        {url && <img src={url} alt="" className={`load-veil__art ${still ? '' : 'load-veil__art--in'}`} draggable={false} />}
        <div className="load-veil__text">
          <p role="status" aria-live="polite" className="load-veil__line" data-testid={`${testId}-line`}>
            <Sparkles className={`h-4 w-4 shrink-0 ${still ? '' : 'animate-pulse'}`} aria-hidden="true" />
            <span key={still ? 'still' : line} className={still ? '' : 'load-veil__line-in'}>{line}</span>
          </p>
          {note && (
            <p className="load-veil__note" data-testid={`${testId}-note`}>
              {note}
            </p>
          )}
          {foreground && <div className="load-veil__front">{foreground}</div>}
        </div>
      </div>
    </div>
  );
}
