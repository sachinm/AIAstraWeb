/**
 * The one loading overlay (server docs/loading-overlay/01). A translucent veil over whatever is beneath (a skeleton
 * passed as children, or the page itself). Top: the brand line and a line in the assistant's voice that changes every
 * few seconds. Middle: one of four house-chart boards in the viewer's theme, clear of any text, flanked by the nine
 * grahas and twelve rashis as 3D tiles shuffled on every show. Bottom: the caller's factual note. The line, the board
 * and the tile order are picked at random each time the veil appears. If the board cannot be had (signed out, not
 * configured, offline) the tiles and lines still show; a wait never fails because of its decoration.
 */
import React, { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles } from 'lucide-react';
import { LINE_MS, prefersReducedMotion } from '../pages/chat-interface/ReadingStagesPanel';
import { LOADING_QUIPS, pickQuipStart } from '../lib/loadingQuips';
import { pickStyle, type ArtStyle, type ArtTheme } from '../lib/overlayArt';
import { chartSvg } from '../lib/chartBoard.js';
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

export type PieceKind = 'graha' | 'rashi' | 'nakshatra';
export interface Piece {
  glyph: string;
  name: string;
  kind: PieceKind;
}

/**
 * Every piece beside the board, always all of them (Sachin, 2026-11-10): the nine grahas with Rahu and Ketu as glyph
 * tiles (gold), the twelve rashis as glyph tiles (violet) and the twenty-seven nakshatras as named chips. Which piece
 * stands on which side, and in what order, is shuffled on every show.
 */
const GRAHAS: Piece[] = [
  ['☉', 'Sun'], ['☽', 'Moon'], ['♂', 'Mars'], ['☿', 'Mercury'], ['♃', 'Jupiter'], ['♀', 'Venus'], ['♄', 'Saturn'], ['☊', 'Rahu'], ['☋', 'Ketu'],
].map(([glyph, name]) => ({ glyph: glyph!, name: name!, kind: 'graha' as const }));
const RASHIS: Piece[] = [
  ['♈', 'Mesha'], ['♉', 'Vrishabha'], ['♊', 'Mithuna'], ['♋', 'Karka'], ['♌', 'Simha'], ['♍', 'Kanya'],
  ['♎', 'Tula'], ['♏', 'Vrishchika'], ['♐', 'Dhanu'], ['♑', 'Makara'], ['♒', 'Kumbha'], ['♓', 'Meena'],
].map(([glyph, name]) => ({ glyph: glyph!, name: name!, kind: 'rashi' as const }));
const NAKSHATRAS: Piece[] = [
  'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra', 'Punarvasu', 'Pushya', 'Ashlesha',
  'Magha', 'Purva Phalguni', 'Uttara Phalguni', 'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha',
  'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha', 'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati',
].map((name) => ({ glyph: '', name, kind: 'nakshatra' as const }));

export const PIECES: readonly Piece[] = [...GRAHAS, ...RASHIS, ...NAKSHATRAS];

/** One side of the board: its glyph tiles and its nakshatra chips. */
export interface Side {
  glyphs: Piece[];
  naks: Piece[];
}

function shuffled<T>(list: readonly T[], random: () => number): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Every piece, shuffled, split between the left and the right of the board. */
export function shufflePieces(random: () => number = Math.random): { left: Side; right: Side } {
  const glyphs = shuffled([...GRAHAS, ...RASHIS], random);
  const naks = shuffled(NAKSHATRAS, random);
  const g = Math.ceil(glyphs.length / 2);
  const n = Math.ceil(naks.length / 2);
  return {
    left: { glyphs: glyphs.slice(0, g), naks: naks.slice(0, n) },
    right: { glyphs: glyphs.slice(g), naks: naks.slice(n) },
  };
}

/** The theme on <html> now (src/lib/theme.ts puts `light` there on the signed-in pages). */
function htmlTheme(): ArtTheme {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.classList.contains('light') ? 'light' : 'dark';
}

/**
 * One wait often follows another at once (the session check, then the board's own wait). The second full-screen veil
 * takes over the first one's line, chart and pieces and skips its entrance, so the person sees one overlay that stays
 * put, not two that jump (Sachin, 2026-11-09). A hand-over older than HANDOFF_MS is ignored.
 */
const HANDOFF_MS = 1500;
interface Handoff {
  at: number;
  quip: number;
  style: ArtStyle;
  cols: ReturnType<typeof shufflePieces>;
}
let handoff: Handoff | null = null;

function freshHandoff(): Handoff | null {
  return handoff && Date.now() - handoff.at < HANDOFF_MS ? handoff : null;
}

/** Tests: forget the last veil. */
export function resetVeilHandoffForTests(): void {
  handoff = null;
}

/** The rotating line: a random start (or the line the last veil showed), then the next one every LINE_MS. */
export function useLoadingQuip(start?: number): { line: string; index: number } {
  const [i, setI] = useState(() => start ?? pickQuipStart());
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % LOADING_QUIPS.length), LINE_MS);
    return () => clearInterval(t);
  }, []);
  return { line: LOADING_QUIPS[i]!, index: i };
}

/**
 * The 12-house board, South or North Indian, in the viewer's theme, drawn here in the app as inline vector art. It is
 * painted in the same frame as the rest of the veil: no download, key, decryption or image decode to wait for (Sachin,
 * 2026-11-09: "the board needs to start out with the 12 houses drawn"). There is no image file to save or drag, and the
 * veil blocks the context menu. Screenshots cannot be stopped by any page.
 */
function ChartBoard({ style, theme, className, testId }: { style: ArtStyle; theme: ArtTheme; className: string; testId: string }) {
  const [svg] = useState(() => chartSvg(style, theme));
  return <div className={className} data-testid={testId} aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />;
}

/** U+FE0E asks for the text form of a sign, so Windows and phones do not swap in a coloured emoji. */
const TEXT_FORM = '︎';

function SidePieces({ side, place, start }: { side: Side; place: 'left' | 'right'; start: number }) {
  return (
    <div className={`load-veil__side load-veil__side--${place}`} aria-hidden="true">
      <div className="load-veil__naks">
        {side.naks.map((p, i) => (
          <span key={p.name} className="load-veil__chip" style={{ '--i': start + i } as React.CSSProperties}>
            {p.name}
          </span>
        ))}
      </div>
      <div className="load-veil__glyphs">
        {side.glyphs.map((p, i) => (
          <span key={p.name} className={`load-veil__tile load-veil__tile--${p.kind}`} title={p.name} style={{ '--i': start + i } as React.CSSProperties}>
            {p.glyph}
            {TEXT_FORM}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function LoadingVeil({ fullScreen = false, note, children, foreground, leaving = false, testId = 'loading-veil', className = '' }: LoadingVeilProps) {
  const theme = htmlTheme();
  // a full-screen veil that follows another one at once carries on from it
  const [carry] = useState(() => (fullScreen ? freshHandoff() : null));
  const [style] = useState<ArtStyle>(() => carry?.style ?? pickStyle());
  const [cols] = useState(() => carry?.cols ?? shufflePieces());
  const { line, index } = useLoadingQuip(carry?.quip);
  const still = prefersReducedMotion() || carry !== null;

  // remember where this veil is, so a veil mounted right after it can take over
  const last = useRef({ index });
  last.current = { index };
  useEffect(() => {
    if (!fullScreen) return undefined;
    return () => {
      handoff = { at: Date.now(), quip: last.current.index, style, cols };
    };
  }, [fullScreen, style, cols]);

  const veil = (
    <div
      className={`load-veil ${fullScreen ? 'load-veil--fixed' : 'load-veil--fill'} ${still ? '' : 'load-veil--animate'} ${leaving ? 'load-veil--leaving' : ''} ${className}`}
      data-testid={testId}
      data-theme={theme}
      data-art={style}
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
          <SidePieces side={cols.left} place="left" start={0} />
          <div className="load-veil__board">
            <ChartBoard style={style} theme={theme} className={`load-veil__art ${still ? '' : 'load-veil__art--in'}`} testId={`${testId}-chart`} />
          </div>
          <SidePieces side={cols.right} place="right" start={14} />
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

  // full screen means the whole screen: render on <body>, so no page container (a backdrop-filter or transform on
  // the dashboard's main panel) can turn `position: fixed` into "fixed to that panel"
  return fullScreen && typeof document !== 'undefined' ? createPortal(veil, document.body) : veil;
}
