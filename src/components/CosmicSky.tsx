import React, { useEffect, useRef, useState } from 'react';
import { SKY_SCENES, pickCorners, randomScene, shuffledRound, skyHoldMs, skySrc, type SkyCorner } from '../lib/skies';

/** How long a scene holds before the next begins (VITE_SKY_HOLD_SECONDS, default 2 minutes; see lib/skies.ts). */
const HOLD_MS = skyHoldMs();
const TRANSITION_MS = 3000;

interface Stage {
  current: number;
  previous: number | null;
  from: SkyCorner | null;
  to: SkyCorner | null;
  /** counts transitions, so the bloom replays each time */
  turn: number;
}

/**
 * The home page background: one full-screen scene at a time, pinned while the page scrolls over it, in an endless loop
 * of random order, each scene once per round. Each one blooms in from a random corner while the last dissolves toward
 * another. Only the current and next images are ever loaded. With reduced motion on the scenes still change, by a plain crossfade with no movement (index.css): many Windows PCs have that setting on, and freezing left them on one scene.
 */
const CosmicSky: React.FC = () => {
  // A build has no visitor, so the prerendered page carries no scene, or everyone would start on the same one. The browser
  // picks here, and that scene fades in over the starfield.
  const [first] = useState<number | null>(() => (typeof window === 'undefined' ? null : randomScene()));
  const [stage, setStage] = useState<Stage>({ current: first ?? 0, previous: null, from: null, to: null, turn: 0 });
  const currentRef = useRef(first ?? 0);
  const roundRef = useRef<number[]>([]);

  useEffect(() => {
    let cancelled = false;
    let clearOld: ReturnType<typeof setTimeout> | undefined;

    const advance = async () => {
      if (document.hidden) return;
      const from = currentRef.current;
      // a scene that will not load is skipped, so the loop never stalls on one bad file
      for (let attempt = 0; attempt < 3; attempt++) {
        if (roundRef.current.length === 0) roundRef.current = shuffledRound(from).filter((i) => i !== from);
        const next = roundRef.current.shift() as number;
        const img = new Image();
        img.src = skySrc(SKY_SCENES[next].id);
        try {
          await img.decode();
        } catch {
          continue;
        }
        if (cancelled) return;
        currentRef.current = next;
        const corners = pickCorners();
        setStage((s) => ({ current: next, previous: from, from: corners.from, to: corners.to, turn: s.turn + 1 }));
        clearTimeout(clearOld);
        clearOld = setTimeout(() => setStage((s) => ({ ...s, previous: null })), TRANSITION_MS);
        return;
      }
    };

    const timer = setInterval(() => void advance(), HOLD_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
      clearTimeout(clearOld);
    };
  }, []);

  const { current, previous, from, to, turn } = stage;
  const scene = SKY_SCENES[current];
  // the keys keep each image's element alive as it goes from current to previous, so its slow drift never jumps
  const layers = first === null ? [] : previous === null ? [current] : [previous, current];

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true" data-test-id="cosmic-sky">
      <div className="sky-stage absolute inset-0" data-test-id="sky-stage">
      {layers.map((index) => {
        const leaving = index === previous;
        const style = leaving && to
          ? ({ '--sky-dx': to.dx, '--sky-dy': to.dy } as React.CSSProperties)
          : from
            ? ({ '--sky-x': from.x, '--sky-y': from.y } as React.CSSProperties)
            : undefined;
        const motion = leaving ? 'sky-out' : turn > 0 ? 'sky-in' : 'sky-first';
        return (
          <div key={SKY_SCENES[index].id} className={`absolute inset-0 ${motion}`} style={style} data-scene={SKY_SCENES[index].id}>
            <img src={skySrc(SKY_SCENES[index].id)} alt="" className="sky-image sky-drift h-full w-full object-cover" draggable={false} />
          </div>
        );
      })}
      {from && previous !== null && <div key={turn} className="sky-bloom absolute inset-0" style={{ '--sky-x': from.x, '--sky-y': from.y } as React.CSSProperties} />}
      </div>
      {/* keeps the words readable on every scene */}
      <div className="sky-scrim absolute inset-0 bg-gradient-to-b from-[#05060f]/70 via-[#05060f]/60 to-[#05060f]/80 sm:from-[#05060f]/55 sm:via-[#05060f]/45 sm:to-[#05060f]/70" />
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="shooting-star absolute h-1 w-1 rounded-full bg-white opacity-0"
          style={{ top: `${15 + i * 25}%`, left: '-5%', animationDuration: `${15 + i * 5}s`, animationDelay: `${i * 10}s` }}
        />
      ))}
      {first !== null && (
      <div key={scene.id} className="sky-caption absolute bottom-24 right-4 text-right text-amber-50 [text-shadow:0_1px_6px_rgba(0,0,0,0.9)] sm:bottom-24 sm:right-8" data-test-id="sky-caption">
        <p className="text-base font-semibold sm:text-xl">
          <span lang="hi">{scene.nameHi}</span> · {scene.name}
        </p>
        <p className="text-xs text-amber-100/85 sm:text-sm">
          {scene.captionHi && <span lang="hi">{scene.captionHi} · </span>}
          {scene.caption}
        </p>
        {scene.signs.length > 0 && (
          <p className="text-xs text-amber-100/85 sm:text-sm" data-test-id="sky-signs">
            {scene.signs.map((s, i) => (
              <span key={s.en}>
                {i > 0 && ' / '}
                <span lang="hi">{s.hi}</span> {s.en}
              </span>
            ))}
          </p>
        )}
      </div>
      )}
    </div>
  );
};

export default CosmicSky;
