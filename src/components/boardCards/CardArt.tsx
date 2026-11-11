/**
 * A card's picture (server docs/reading-engine/71 §4.1): the category gradient, a backdrop that says the topic (a pulse
 * line for Body, ripples for Mind, a constellation for Character, a lotus for the Indian lens, orbits for Time, rings
 * for Love, steps for Work), and the card's glyph on a small glass medallion. Colours are CSS variables
 * (src/styles/board-cards.css) so light and dark each get their own. No text is drawn on the art.
 */
import { useId, type ReactNode } from 'react';
import { glyphOf, themeOf, type ArtTheme } from './cardArtRegistry';
import { useCardPhoto } from './cardPhotos';
import '../../styles/board-cards.css';

const LINE = {
  fill: 'none',
  stroke: 'var(--art-line)',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function Backdrop({ theme }: { theme: ArtTheme }): ReactNode {
  switch (theme) {
    case 'body':
      return (
        <g>
          <circle cx="252" cy="34" r="22" fill="var(--art-glow)" />
          <circle cx="252" cy="34" r="34" fill="none" stroke="var(--art-line)" strokeOpacity="0.35" />
          <polyline {...LINE} strokeWidth="2.5" points="0,84 70,84 86,84 98,58 112,108 126,46 140,84 196,84 206,72 216,84 320,84" />
        </g>
      );
    case 'mind':
      return (
        <g>
          {[10, 24, 40, 58, 78].map((r, i) => (
            <circle key={r} cx="246" cy="60" r={r} fill="none" stroke="var(--art-line)" strokeOpacity={0.75 - i * 0.13} strokeWidth="1.6" />
          ))}
          <circle cx="246" cy="60" r="4" fill="var(--art-glow)" />
        </g>
      );
    case 'character': {
      const stars: Array<[number, number, number]> = [
        [170, 30, 2.4],
        [204, 52, 3.2],
        [236, 26, 2.2],
        [262, 64, 3.6],
        [292, 40, 2.4],
        [240, 92, 2.6],
        [300, 96, 2],
      ];
      return (
        <g>
          <polyline {...LINE} strokeWidth="1.2" strokeOpacity="0.6" points="170,30 204,52 236,26 262,64 292,40" />
          <polyline {...LINE} strokeWidth="1.2" strokeOpacity="0.6" points="204,52 240,92 262,64 300,96" />
          {stars.map(([x, y, r]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill="var(--art-glow)" />
          ))}
        </g>
      );
    }
    case 'indian':
      return (
        <g transform="translate(250 60)">
          {Array.from({ length: 8 }, (_, i) => (
            <ellipse
              key={i}
              cx="0"
              cy="-26"
              rx="11"
              ry="26"
              transform={`rotate(${i * 45})`}
              fill="var(--art-glow)"
              fillOpacity="0.35"
              stroke="var(--art-line)"
              strokeWidth="1.2"
            />
          ))}
          <circle r="10" fill="var(--art-glow)" />
          <circle r="62" fill="none" stroke="var(--art-line)" strokeOpacity="0.35" strokeDasharray="2 5" />
        </g>
      );
    case 'time':
      return (
        <g>
          <ellipse cx="240" cy="62" rx="74" ry="26" {...LINE} strokeWidth="1.4" transform="rotate(-14 240 62)" />
          <ellipse cx="240" cy="62" rx="46" ry="16" {...LINE} strokeWidth="1.4" strokeOpacity="0.6" transform="rotate(-14 240 62)" />
          <circle cx="240" cy="62" r="9" fill="var(--art-glow)" />
          <circle cx="306" cy="45" r="4.5" fill="var(--art-line)" />
          <circle cx="198" cy="76" r="3" fill="var(--art-line)" fillOpacity="0.8" />
        </g>
      );
    case 'bond':
    case 'meeting':
    case 'circle':
      return (
        <g>
          <circle cx="228" cy="60" r="30" {...LINE} strokeWidth="2" />
          <circle cx="264" cy="60" r="30" {...LINE} strokeWidth="2" />
          <path d="M246 36 a30 30 0 0 1 0 48 a30 30 0 0 1 0 -48z" fill="var(--art-glow)" />
          {theme !== 'bond' &&
            [
              [172, 30],
              [302, 92],
              [306, 26],
            ].map(([x, y]) => <circle key={`${x}`} cx={x} cy={y} r="3.5" fill="var(--art-glow)" fillOpacity="0.8" />)}
        </g>
      );
    case 'standing':
    case 'money':
    case 'growth':
      return (
        <g>
          {Array.from({ length: 9 }, (_, i) => (
            <line key={`v${i}`} x1={150 + i * 20} y1="0" x2={150 + i * 20} y2="120" stroke="var(--art-line)" strokeOpacity="0.12" />
          ))}
          {Array.from({ length: 6 }, (_, i) => (
            <line key={`h${i}`} x1="150" y1={i * 20 + 10} x2="320" y2={i * 20 + 10} stroke="var(--art-line)" strokeOpacity="0.12" />
          ))}
          <polyline {...LINE} strokeWidth="2.5" points="170,112 170,92 206,92 206,72 242,72 242,52 278,52 278,32 314,32" />
          <circle cx="314" cy="32" r="6" fill="var(--art-glow)" />
        </g>
      );
    default:
      return null;
  }
}

export default function CardArt({
  id,
  group,
  size = 'tile',
  muted = false,
  children,
  className = '',
}: {
  id: string;
  group: string;
  /** tile: the art band on a picker tile; small: a coming-soon tile; thumb: the chosen tray; swatch: a group banner */
  size?: 'tile' | 'small' | 'thumb' | 'swatch';
  /** coming soon: desaturated */
  muted?: boolean;
  /** labels laid over the art on their own solid chips */
  children?: ReactNode;
  className?: string;
}) {
  const uid = useId().replace(/:/g, '');
  const theme = themeOf(group);
  const Glyph = glyphOf(id, group);
  const medallion = size === 'tile' ? 'h-11 w-11' : size === 'small' ? 'h-8 w-8' : 'h-7 w-7';
  const glyph = size === 'tile' ? 'h-5 w-5' : 'h-4 w-4';
  const photo = useCardPhoto(id);
  return (
    <div
      className={`card-art relative overflow-hidden ${className}`}
      data-art-theme={theme}
      data-muted={muted ? 'true' : 'false'}
      data-testid={`card-art-${id}`}
      data-photo={photo ? 'true' : 'false'}
    >
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 320 120" preserveAspectRatio={size === 'tile' || size === 'small' ? 'xMaxYMid slice' : 'xMidYMid slice'} aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={`g${uid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--art-a)" />
            <stop offset="1" stopColor="var(--art-b)" />
          </linearGradient>
          <radialGradient id={`r${uid}`} cx="0.82" cy="0.3" r="0.7">
            <stop offset="0" stopColor="var(--art-glow)" stopOpacity="0.45" />
            <stop offset="1" stopColor="var(--art-glow)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="320" height="120" fill={`url(#g${uid})`} />
        <rect width="320" height="120" fill={`url(#r${uid})`} />
        {!photo && <Backdrop theme={theme} />}
      </svg>
      {photo && (
        <>
          {/* a real photo, tinted in the category colour so the page stays one design in light and dark */}
          <img src={photo} alt="" decoding="async" className="card-art-photo absolute inset-0 h-full w-full object-cover" data-testid={`card-photo-${id}`} />
          <span className="card-art-tint absolute inset-0" aria-hidden="true" />
        </>
      )}
      {size !== 'swatch' && (
        <span
          className={`card-art-medallion absolute grid place-items-center rounded-full ${medallion} ${size === 'tile' ? 'bottom-3 left-3' : 'bottom-2 left-2'}`}
          aria-hidden="true"
        >
          <Glyph className={glyph} strokeWidth={1.8} />
        </span>
      )}
      {size === 'swatch' && (
        <span
          className="card-art-medallion absolute left-1/2 top-1/2 grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full"
          aria-hidden="true"
        >
          <Glyph className="h-4 w-4" strokeWidth={1.8} />
        </span>
      )}
      {children}
    </div>
  );
}
