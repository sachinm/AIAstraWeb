/**
 * The one loading overlay (server docs/loading-overlay/01). A translucent veil over whatever is beneath (a skeleton
 * passed as children, or the page itself). Top: the brand line and a line in the assistant's voice that changes every
 * few seconds. Middle: one of four house-chart boards in the viewer's theme, clear of any text, flanked by the nine
 * grahas and twelve rashis as 3D tiles shuffled on every show. Bottom: the caller's factual note. The line, the board
 * and the tile order are picked at random each time the veil appears. If the board cannot be had (signed out, not
 * configured, offline) the tiles and lines still show; a wait never fails because of its decoration.
 */
import React, { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Sparkles } from 'lucide-react';
import { LINE_MS, prefersReducedMotion } from '../pages/chat-interface/ReadingStagesPanel';
import { LOADING_QUIPS, pickQuipStart } from '../lib/loadingQuips';
import { getOverlayArt, pickStyle, type ArtStyle, type ArtTheme } from '../lib/overlayArt';
import '../styles/loading-veil.css';

export interface LoadingVeilProps {
  /** Cover the whole viewport (session restore). Otherwise the veil fills its relative parent, over `children`. */
  fullScreen?: boolean;
  /** A short factual sentence at the bottom, e.g. what the page will do by itself. */
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

/** The wordmark and the words beside it, above the quip. */
export const BRAND_NAME = 'AdAstra AI';
/** The same classes as the dashboard header's name (src/pages/TopNavigation.tsx). */
export const BRAND_CLASS = 'font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent';
export const BRAND_REST = 'preparing your board…';

/** The pieces beside the board: the nine grahas (gold) and the twelve rashis (violet). */
export const PIECES: ReadonlyArray<{ glyph: string; name: string; kind: 'graha' | 'rashi' }> = [
  { glyph: '☉', name: 'Sun', kind: 'graha' },
  { glyph: '☽', name: 'Moon', kind: 'graha' },
  { glyph: '♂', name: 'Mars', kind: 'graha' },
  { glyph: '☿', name: 'Mercury', kind: 'graha' },
  { glyph: '♃', name: 'Jupiter', kind: 'graha' },
  { glyph: '♀', name: 'Venus', kind: 'graha' },
  { glyph: '♄', name: 'Saturn', kind: 'graha' },
  { glyph: '☊', name: 'Rahu', kind: 'graha' },
  { glyph: '☋', name: 'Ketu', kind: 'graha' },
  { glyph: '♈', name: 'Mesha', kind: 'rashi' },
  { glyph: '♉', name: 'Vrishabha', kind: 'rashi' },
  { glyph: '♊', name: 'Mithuna', kind: 'rashi' },
  { glyph: '♋', name: 'Karka', kind: 'rashi' },
  { glyph: '♌', name: 'Simha', kind: 'rashi' },
  { glyph: '♍', name: 'Kanya', kind: 'rashi' },
  { glyph: '♎', name: 'Tula', kind: 'rashi' },
  { glyph: '♏', name: 'Vrishchika', kind: 'rashi' },
  { glyph: '♐', name: 'Dhanu', kind: 'rashi' },
  { glyph: '♑', name: 'Makara', kind: 'rashi' },
  { glyph: '♒', name: 'Kumbha', kind: 'rashi' },
  { glyph: '♓', name: 'Meena', kind: 'rashi' },
];

/** A shuffled copy of the pieces, split into four columns: two for the left of the board, two for the right. */
export function shufflePieces(random: () => number = Math.random): Array<typeof PIECES[number][]> {
  const a = [...PIECES];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  const cols: Array<typeof PIECES[number][]> = [[], [], [], []];
  a.forEach((p, i) => cols[i % 4]!.push(p));
  return cols;
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

/**
 * The decrypted chart painted onto a canvas, never an <img>: no "Save image as", nothing to drag out, and no URL left
 * behind (the hook revokes its object URL on unmount). Screenshots cannot be stopped by any page.
 */
function ChartCanvas({ url, className, testId }: { url: string; className: string; testId: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let alive = true;
    const img = new Image();
    img.onload = () => {
      const c = ref.current;
      if (!alive || !c) return;
      c.width = img.naturalWidth || 1000;
      c.height = img.naturalHeight || 1000;
      try {
        c.getContext('2d')?.drawImage(img, 0, 0);
      } catch {
        /* a canvas the browser will not draw on: the slab stays */
      }
    };
    img.src = url;
    return () => {
      alive = false;
      img.src = '';
    };
  }, [url]);
  return <canvas ref={ref} className={className} data-testid={testId} aria-hidden="true" onContextMenu={(e) => e.preventDefault()} />;
}

/** U+FE0E asks for the text form of a sign, so Windows and phones do not swap in a coloured emoji. */
const TEXT_FORM = '︎';

function TileColumn({ pieces, place, start }: { pieces: ReadonlyArray<typeof PIECES[number]>; place: 'outer' | 'inner'; start: number }) {
  return (
    <div className={`load-veil__col load-veil__col--${place}`} aria-hidden="true">
      {pieces.map((p, i) => (
        <span key={p.name} className={`load-veil__tile load-veil__tile--${p.kind}`} title={p.name} style={{ '--i': start + i } as React.CSSProperties}>
          {p.glyph}
          {TEXT_FORM}
        </span>
      ))}
    </div>
  );
}

export default function LoadingVeil({ fullScreen = false, note, children, foreground, leaving = false, testId = 'loading-veil', className = '' }: LoadingVeilProps) {
  const theme = htmlTheme();
  const line = useLoadingQuip();
  const { url, style } = useOverlayArt(theme);
  const still = prefersReducedMotion();
  const cols = useMemo(() => shufflePieces(), []);

  return (
    <div
      className={`load-veil ${fullScreen ? 'load-veil--fixed' : 'load-veil--fill'} ${still ? '' : 'load-veil--animate'} ${leaving ? 'load-veil--leaving' : ''} ${className}`}
      data-testid={testId}
      data-theme={theme}
      data-art={url ? style : 'none'}
      data-chart={style}
      aria-busy="true"
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      {children && (
        <div className="load-veil__under" aria-hidden="true">
          {children}
        </div>
      )}
      <div className="load-veil__layer">
        <div className="load-veil__top">
          <p className="load-veil__brand" data-testid={`${testId}-brand`}>
            <span className={`load-veil__brand-name ${BRAND_CLASS}`}>{BRAND_NAME}</span>
            <span className="load-veil__brand-rest">{BRAND_REST}</span>
          </p>
          <p role="status" aria-live="polite" className="load-veil__line" data-testid={`${testId}-line`}>
            <Sparkles className={`h-4 w-4 shrink-0 ${still ? '' : 'animate-pulse'}`} aria-hidden="true" />
            <span key={still ? 'still' : line} className={still ? '' : 'load-veil__line-in'}>{line}</span>
          </p>
        </div>
        <div className="load-veil__stage" data-testid={`${testId}-stage`}>
          <TileColumn pieces={cols[0]!} place="outer" start={0} />
          <TileColumn pieces={cols[1]!} place="inner" start={6} />
          <div className="load-veil__board">
            {url ? (
              <ChartCanvas url={url} className={`load-veil__art ${still ? '' : 'load-veil__art--in'}`} testId={`${testId}-chart`} />
            ) : (
              <div className="load-veil__slab" aria-hidden="true" data-testid={`${testId}-slab`} />
            )}
          </div>
          <TileColumn pieces={cols[2]!} place="inner" start={11} />
          <TileColumn pieces={cols[3]!} place="outer" start={16} />
        </div>
        <div className="load-veil__bottom">
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
