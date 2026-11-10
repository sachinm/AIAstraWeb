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
  /**
   * Real progress from the server (server docs/loading-overlay/05). Once the wait has passed VEIL_PROGRESS_AFTER_MS a
   * thin bar shows under the brand line with the step in plain words; before that the veil looks as it always did.
   */
  progress?: VeilProgress;
}

export interface VeilProgress {
  percent: number;
  nextPercent: number;
  stageExpectedMs: number | null;
  stageAt: string | null;
  label: string;
  step: number;
  steps: number;
}

/** Under this long the veil shows the quip only; the bar appears after. */
export const VEIL_PROGRESS_AFTER_MS = 5000;
/** How often the bar is recomputed while it eases. */
export const VEIL_PROGRESS_TICK_MS = 250;

/**
 * Where the bar stands at `now`: the server's floor plus a share of the way to the next stage's floor that grows with
 * the time spent in this stage (1 − e^(−2x), x = elapsed / expected), capped at 90% so it never reaches the next floor
 * before the server says that stage is done.
 */
export function easedPercent(p: Pick<VeilProgress, 'percent' | 'nextPercent' | 'stageExpectedMs' | 'stageAt'>, now: number = Date.now()): number {
  const floor = Math.max(0, Math.min(100, p.percent));
  const next = Math.max(floor, Math.min(100, p.nextPercent));
  if (next <= floor || !p.stageAt || !p.stageExpectedMs || p.stageExpectedMs <= 0) return floor;
  const at = Date.parse(p.stageAt);
  if (!Number.isFinite(at)) return floor;
  const x = Math.max(0, now - at) / p.stageExpectedMs;
  const share = Math.min(0.9, 1 - Math.exp(-2 * x));
  return floor + (next - floor) * share;
}

/** The bar's value, recomputed every tick, never lower than it has been. */
function useEasedPercent(progress: VeilProgress | undefined): number {
  const max = useRef(0);
  const [, setTick] = useState(0);
  const active = !!progress && progress.percent < 100;
  useEffect(() => {
    if (!active) return undefined;
    const t = setInterval(() => setTick((n) => n + 1), VEIL_PROGRESS_TICK_MS);
    return () => clearInterval(t);
  }, [active]);
  if (!progress) return max.current;
  max.current = Math.max(max.current, easedPercent(progress));
  return max.current;
}

function ProgressBar({ progress, testId }: { progress: VeilProgress; testId: string }) {
  const value = useEasedPercent(progress);
  return (
    <div className="load-veil__progress" data-testid={`${testId}-progress-wrap`}>
      <div
        className="load-veil__progress-track"
        role="progressbar"
        aria-label={progress.label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.floor(value)}
        data-testid="veil-progress"
      >
        <div className="load-veil__progress-fill" style={{ width: `${value}%` }} />
      </div>
      <p className="load-veil__progress-label" data-testid={`${testId}-progress-label`}>
        {progress.label}
        {progress.step > 0 && progress.steps > 0 ? ` · Step ${progress.step} of ${progress.steps}` : ''}
      </p>
    </div>
  );
}

/** True once the veil has been up VEIL_PROGRESS_AFTER_MS (counted from its first show). */
function useLongWait(enabled: boolean): boolean {
  const shownAt = useRef(Date.now());
  const [long, setLong] = useState(() => Date.now() - shownAt.current >= VEIL_PROGRESS_AFTER_MS);
  useEffect(() => {
    if (!enabled || long) return undefined;
    const t = setTimeout(() => setLong(true), Math.max(0, VEIL_PROGRESS_AFTER_MS - (Date.now() - shownAt.current)));
    return () => clearTimeout(t);
  }, [enabled, long]);
  return long;
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
  blob: Blob | null;
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

/** An object URL for a chart style in the given theme, or null while loading or when unavailable. */
export function useOverlayArt(theme: ArtTheme, style: ArtStyle, carried: Blob | null): { url: string | null; blob: Blob | null } {
  const canUrl = typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function';
  const [art, setArt] = useState<{ url: string | null; blob: Blob | null }>(() =>
    carried && canUrl ? { url: URL.createObjectURL(carried), blob: carried } : { url: null, blob: null }
  );
  useEffect(() => {
    let alive = true;
    if (!art.blob) {
      void getOverlayArt(style, theme).then((blob) => {
        if (!alive || !blob || !canUrl) return;
        setArt({ url: URL.createObjectURL(blob), blob });
      });
    }
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [style, theme]);
  useEffect(() => {
    const made = art.url;
    return () => {
      if (made) URL.revokeObjectURL(made);
    };
  }, [art.url]);
  return art;
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

export default function LoadingVeil({ fullScreen = false, note, children, foreground, leaving = false, testId = 'loading-veil', className = '', progress }: LoadingVeilProps) {
  const longWait = useLongWait(!!progress);
  const theme = htmlTheme();
  // a full-screen veil that follows another one at once carries on from it
  const [carry] = useState(() => (fullScreen ? freshHandoff() : null));
  const [style] = useState<ArtStyle>(() => carry?.style ?? pickStyle());
  const [cols] = useState(() => carry?.cols ?? shufflePieces());
  const { line, index } = useLoadingQuip(carry?.quip);
  const { url, blob } = useOverlayArt(theme, style, carry?.blob ?? null);
  const still = prefersReducedMotion() || carry !== null;

  // remember where this veil is, so a veil mounted right after it can take over
  const last = useRef({ index, blob });
  last.current = { index, blob };
  useEffect(() => {
    if (!fullScreen) return undefined;
    return () => {
      handoff = { at: Date.now(), quip: last.current.index, style, cols, blob: last.current.blob };
    };
  }, [fullScreen, style, cols]);

  const veil = (
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
          {progress && longWait && <ProgressBar progress={progress} testId={testId} />}
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

  // full screen means the whole screen: render on <body>, so no page container (a backdrop-filter or transform on
  // the dashboard's main panel) can turn `position: fixed` into "fixed to that panel"
  return fullScreen && typeof document !== 'undefined' ? createPortal(veil, document.body) : veil;
}
