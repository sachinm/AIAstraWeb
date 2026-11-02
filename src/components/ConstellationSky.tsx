import React from 'react';
import { buildSky, type Sky, type SkyLayout } from '../lib/constellationSky';

const GOLD = '#e8c77a';

const WIDE = buildSky('wide');
const TALL = buildSky('tall');

/** One drawing of the map. The animation classes are in index.css and stop under prefers-reduced-motion. */
const SkyPicture: React.FC<{ sky: Sky; layout: SkyLayout; labels: boolean }> = ({ sky, layout, labels }) => {
  const id = `sky-${layout}`;
  return (
    <svg
      viewBox={`0 0 ${sky.width} ${sky.height}`}
      preserveAspectRatio="xMidYMin slice"
      className="h-full w-full"
      data-test-id={`constellation-sky-${layout}`}
    >
      <defs>
        <radialGradient id={`${id}-glow`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f6b85b" stopOpacity="0.55" />
          <stop offset="60%" stopColor="#f6b85b" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#f6b85b" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-bottom`} x1="0" y1="0" x2="0" y2="1">
          {/* a mask shows where it is white, so the fade runs white to transparent */}
          <stop offset="70%" stopColor="#fff" stopOpacity="1" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id={`${id}-mask`}>
          <rect width={sky.width} height={sky.height} fill={`url(#${id}-bottom)`} />
        </mask>
        <filter id={`${id}-soft`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>

      <g mask={`url(#${id}-mask)`}>
        {/* loose stars */}
        <g fill="#fff">
          {sky.field.map((s, i) => (
            <circle key={i} cx={s.x} cy={s.y} r={s.size} opacity={0.5 + (i % 4) * 0.15} className={`sky-twinkle sky-twinkle-${i % 3}`} />
          ))}
        </g>

        {/* orbits and the belt */}
        <g fill="none" stroke={GOLD} strokeOpacity="0.28" strokeWidth="1">
          {sky.orbits.map((o, i) => (
            <ellipse key={i} cx={sky.centre.x} cy={sky.centre.y} rx={o.rx} ry={o.ry} strokeDasharray={i % 2 ? '2 8' : undefined} />
          ))}
        </g>
        <ellipse cx={sky.centre.x} cy={sky.centre.y} rx={sky.belt.rx} ry={sky.belt.ry} fill="none" stroke={GOLD} strokeOpacity="0.6" strokeWidth="1.4" />

        {/* the mesh: belt links between signs, then each planet to the signs it rules */}
        <g fill="none" strokeLinecap="round">
          {sky.lines.map((l, i) => (
            <line
              key={i}
              x1={l.from.x}
              y1={l.from.y}
              x2={l.to.x}
              y2={l.to.y}
              stroke={l.kind === 'belt' ? GOLD : '#b7a6ff'}
              strokeOpacity={l.kind === 'belt' ? 0.4 : 0.55}
              strokeWidth={l.kind === 'belt' ? 1.1 : 1}
              strokeDasharray={l.kind === 'rule' ? '3 7' : undefined}
              className={l.kind === 'rule' ? 'sky-flow' : undefined}
            />
          ))}
        </g>

        {/* the sun's glow sits behind everything else that is drawn */}
        {sky.planets
          .filter((pl) => pl.id === 'sun')
          .map((pl) => (
            <circle key="sun-glow" cx={pl.centre.x} cy={pl.centre.y} r={pl.size * 6} fill={`url(#${id}-glow)`} />
          ))}

        {/* constellations */}
        {sky.constellations.map((c) => (
          <g key={c.id} data-sign={c.id}>
            <g fill="none" stroke="#fff" strokeOpacity="0.75" strokeWidth="1.1" strokeLinecap="round">
              {c.lines.map(([a, b], i) => (
                <line key={i} x1={c.stars[a].x} y1={c.stars[a].y} x2={c.stars[b].x} y2={c.stars[b].y} />
              ))}
            </g>
            <g fill="#fff">
              {c.stars.map((s, i) => (
                <circle key={i} cx={s.x} cy={s.y} r={s.size} opacity={0.95} className={`sky-twinkle sky-twinkle-${(i + 1) % 3}`} />
              ))}
            </g>
            {labels && (
              <text x={c.label.x} y={c.label.y} textAnchor="middle" fill={GOLD} fillOpacity="0.85" fontSize="12" fontWeight="600" letterSpacing="2" style={{ textTransform: 'uppercase' }}>
                {c.rashi}
              </text>
            )}
          </g>
        ))}

        {/* planets */}
        {sky.planets.map((pl) => (
          <g key={pl.id} data-planet={pl.id} className="sky-pulse" style={{ transformOrigin: `${pl.centre.x}px ${pl.centre.y}px` }}>
            <circle cx={pl.centre.x} cy={pl.centre.y} r={pl.size * 2.4} fill={pl.colour} fillOpacity="0.28" filter={`url(#${id}-soft)`} />
            {pl.node ? (
              // the nodes are shadow points: a ring with a dark middle
              <>
                <circle cx={pl.centre.x} cy={pl.centre.y} r={pl.size} fill="#0b0a1f" stroke={pl.colour} strokeWidth="1.5" />
                <circle cx={pl.centre.x} cy={pl.centre.y} r={pl.size * 0.4} fill={pl.colour} fillOpacity="0.8" />
              </>
            ) : (
              <circle cx={pl.centre.x} cy={pl.centre.y} r={pl.size} fill={pl.colour} />
            )}
            {pl.ring && (
              <ellipse cx={pl.centre.x} cy={pl.centre.y} rx={pl.size * 2} ry={pl.size * 0.6} fill="none" stroke={pl.colour} strokeOpacity="0.8" strokeWidth="1.2" transform={`rotate(-18 ${pl.centre.x} ${pl.centre.y})`} />
            )}
            {labels && (
              <text x={pl.label.x} y={pl.label.y} textAnchor={pl.node ? 'middle' : 'start'} fill={pl.colour} fillOpacity="0.95" fontSize="13" fontWeight="600" letterSpacing="1">
                {pl.name}
              </text>
            )}
          </g>
        ))}
      </g>
    </svg>
  );
};

/**
 * The star map behind the home page hero: the zodiac belt with its twelve figures, the seven grahas on their orbits,
 * and Rahu and Ketu on the belt, joined into one mesh. Art only; it shows no chart and nothing about today's sky.
 */
const ConstellationSky: React.FC = () => (
  <div className="pointer-events-none absolute inset-x-0 top-0 h-[820px] overflow-hidden sm:h-[760px]" aria-hidden="true" data-test-id="constellation-sky">
    <div className="hidden h-full sm:block">
      <SkyPicture sky={WIDE} layout="wide" labels />
    </div>
    <div className="h-full sm:hidden">
      <SkyPicture sky={TALL} layout="tall" labels={false} />
    </div>
  </div>
);

export default ConstellationSky;
