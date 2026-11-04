import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { LANDING_FAQS } from './lib/landingFaqs';
import { openSide, placeScrolls, type Placement } from './lib/scrollPlacement';

interface LandingPageProps {
  onSignUp: () => void;
}

interface Scroll {
  id: string;
  /** names the scroll on its icon, to the eye on hover and to a screen reader */
  label: string;
  body: React.ReactNode;
}

/** How long the opening scroll stays unrolled before it rolls up by itself. */
export const BLUEPRINT_OPEN_MS = 10_000;
const FIRST = 'blueprint';

const INK_HEADING = 'font-bold bg-gradient-to-r from-purple-900 via-fuchsia-800 to-rose-800 bg-clip-text text-transparent';
const PRIMARY_BUTTON =
  'px-8 py-3 bg-gradient-to-r from-purple-700 to-pink-700 text-white text-lg rounded-full hover:from-purple-800 hover:to-pink-800 transition-all duration-300 transform hover:scale-105 shadow-lg';

function scrollsFor(onSignUp: () => void): Scroll[] {
  return [
    {
      id: 'tagline',
      label: 'Your Vedic astrology assistant',
      body: (
        <p className="text-center text-sm font-semibold uppercase tracking-[0.18em] text-amber-950 sm:text-base">
          Your personal Vedic Astrology Assistant, mastered on the ancient text unabridged and astrological celestial sky
        </p>
      ),
    },
    {
      id: FIRST,
      label: 'Discover your cosmic blueprint',
      body: (
        <div className="text-center">
          <h1 className={`${INK_HEADING} mb-5 text-4xl leading-tight sm:text-5xl`}>Discover Your Cosmic Blueprint</h1>
          <button type="button" onClick={onSignUp} className={PRIMARY_BUTTON}>
            Generate My Chart
          </button>
        </div>
      ),
    },
    {
      id: 'explore',
      label: 'Explore Jyotish',
      body: (
        <p className="text-lg leading-relaxed text-amber-950">
          Explore Jyotish (Vedic astrology) through your own birth chart. Ask questions and read about what the tradition sees in
          your chart, for education and entertainment.
        </p>
      ),
    },
    {
      id: 'records',
      label: 'About 9,500 records for your chart',
      body: (
        <section aria-labelledby="chart-records">
          <h2 id="chart-records" className={`${INK_HEADING} mb-3 text-2xl`}>
            About 9,500 records of astrological data for your chart
          </h2>
          <p className="text-lg leading-relaxed text-amber-950">
            Your divisional charts, dasha systems, strengths, annual charts and transits come to about 9,500 records of
            astrological data, available for every chart. Each reading draws on the records that bear on your question.
          </p>
        </section>
      ),
    },
    ...LANDING_FAQS.map((faq, i) => ({
      id: `faq-${i}`,
      label: faq.question,
      body: (
        <section aria-labelledby={`faq-${i}-q`}>
          <h2 id={`faq-${i}-q`} className={`${INK_HEADING} mb-3 text-2xl`}>
            {faq.question}
          </h2>
          <p className="text-lg leading-relaxed text-amber-950">{faq.answer}</p>
        </section>
      ),
    })),
  ];
}

/** A rolled parchment: the paper between two wooden rods. */
const ScrollIcon: React.FC = () => (
  <svg viewBox="0 0 48 48" className="h-full w-full" aria-hidden="true">
    <rect x="11" y="9" width="26" height="30" rx="2" fill="#efdcab" stroke="#8a5a2b" strokeWidth="1.5" />
    <path d="M16 17h16M16 22h16M16 27h12M16 32h9" stroke="#8a5a2b" strokeWidth="1.4" strokeLinecap="round" opacity="0.7" />
    <rect x="6" y="5" width="36" height="7" rx="3.5" fill="#c08a4a" stroke="#6b4220" strokeWidth="1.5" />
    <rect x="6" y="36" width="36" height="7" rx="3.5" fill="#c08a4a" stroke="#6b4220" strokeWidth="1.5" />
    <circle cx="6.5" cy="8.5" r="2.5" fill="#6b4220" />
    <circle cx="41.5" cy="8.5" r="2.5" fill="#6b4220" />
    <circle cx="6.5" cy="39.5" r="2.5" fill="#6b4220" />
    <circle cx="41.5" cy="39.5" r="2.5" fill="#6b4220" />
  </svg>
);

const iconPosition = (p: Placement): React.CSSProperties => {
  switch (p.edge) {
    case 'top':
      return { top: '0.5rem', left: `${p.at}%`, transform: 'translateX(-50%)' };
    case 'bottom':
      return { bottom: '0.5rem', left: `${p.at}%`, transform: 'translateX(-50%)' };
    case 'left':
      return { left: '0.5rem', top: `${p.at}%`, transform: 'translateY(-50%)' };
    default:
      return { right: '0.5rem', top: `${p.at}%`, transform: 'translateY(-50%)' };
  }
};

/**
 * The front page: no column to scroll. Each piece of it is a parchment scroll resting on an edge of the screen, and opens beside
 * the scene rather than over it. The first one shows by itself, then rolls up. The scenes behind come from SkyLayout.
 */
const LandingPage: React.FC<LandingPageProps> = ({ onSignUp }) => {
  const scrolls = useMemo(() => scrollsFor(onSignUp), [onSignUp]);
  const [placements, setPlacements] = useState<Placement[]>(() => placeScrolls(scrolls.length));
  const [open, setOpen] = useState<string | null>(FIRST);
  const holding = useRef(false);
  const touched = useRef(false);
  const panels = useRef<Record<string, HTMLDivElement | null>>({});
  const icons = useRef<Record<string, HTMLButtonElement | null>>({});

  // dealt out in the browser, so the prerendered page and the first paint agree, and each visit differs
  useEffect(() => {
    const portrait = window.matchMedia?.('(orientation: portrait)').matches ?? false;
    setPlacements(placeScrolls(scrolls.length, Math.random, portrait));
  }, [scrolls.length]);

  // each scroll knows where its icon is, so it grows out of the icon and shrinks back into it
  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const aim = () => {
      const box = root.current?.getBoundingClientRect();
      if (!box) return;
      for (const s of scrolls) {
        const panel = panels.current[s.id];
        const icon = icons.current[s.id]?.getBoundingClientRect();
        if (!panel || !icon) continue;
        // the panel's middle before its transform: top is its middle, since it is pulled up by half its height
        const px = panel.offsetLeft + panel.offsetWidth / 2;
        const py = panel.offsetTop;
        panel.style.setProperty('--from-x', `${icon.left + icon.width / 2 - box.left - px}px`);
        panel.style.setProperty('--from-y', `${icon.top + icon.height / 2 - box.top - py}px`);
      }
    };
    aim();
    window.addEventListener('resize', aim);
    return () => window.removeEventListener('resize', aim);
  }, [placements, scrolls]);

  // the opening scroll rolls up after a while, but never out from under someone reading it
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const roll = () => {
      if (touched.current) return;
      if (holding.current) {
        timer = setTimeout(roll, 1000);
        return;
      }
      setOpen((o) => (o === FIRST ? null : o));
    };
    timer = setTimeout(roll, BLUEPRINT_OPEN_MS);
    return () => clearTimeout(timer);
  }, []);

  const close = useCallback(() => {
    setOpen((o) => {
      if (o) icons.current[o]?.focus({ preventScroll: true });
      return null;
    });
  }, []);

  const toggle = (id: string) => {
    touched.current = true;
    setOpen((o) => (o === id ? null : id));
    // the scroll takes focus when someone opens it, so a keyboard user lands in what they asked for
    requestAnimationFrame(() => panels.current[id]?.focus({ preventScroll: true }));
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panels.current[open]?.contains(t) || Object.values(icons.current).some((b) => b?.contains(t))) return;
      // the header and footer keep their own links working
      if ((t as Element).closest?.('header, footer')) return;
      setOpen(null);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open, close]);

  return (
    <div ref={root} className="landing-scrolls relative h-full overflow-hidden text-white" data-test-id="landing-scrolls">
      {scrolls.map((s, i) => {
        const p = placements[i]!;
        const isOpen = open === s.id;
        return (
          <React.Fragment key={s.id}>
            <button
              ref={(el) => (icons.current[s.id] = el)}
              type="button"
              aria-label={s.label}
              aria-expanded={isOpen}
              aria-controls={`scroll-${s.id}`}
              title={s.label}
              onClick={() => toggle(s.id)}
              className={`scroll-icon group absolute z-10 h-11 w-11 rounded-full p-1 transition-[filter,opacity] duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 ${
                isOpen ? 'scroll-icon-open' : ''
              }`}
              style={{ ...iconPosition(p), animationDelay: `${(i % 4) * -1.1}s` }}
              data-edge={p.edge}
            >
              <ScrollIcon />
              <span className={`scroll-label scroll-label-${p.edge}`} aria-hidden="true">
                {s.label}
              </span>
            </button>
            <div
              id={`scroll-${s.id}`}
              ref={(el) => (panels.current[s.id] = el)}
              role="region"
              aria-label={s.label}
              aria-hidden={!isOpen}
              tabIndex={-1}
              onPointerEnter={() => (holding.current = true)}
              onPointerLeave={() => (holding.current = false)}
              onFocus={() => (holding.current = true)}
              onBlur={() => (holding.current = false)}
              className={`parchment scroll-side-${openSide(p)}${s.id === FIRST ? ' parchment-high' : ''} ${isOpen ? 'parchment-open' : 'parchment-closed'}`}
              data-test-id={`scroll-${s.id}`}
            >
              <button
                type="button"
                onClick={close}
                tabIndex={isOpen ? 0 : -1}
                aria-label="Roll up"
                className="absolute right-3 top-3 rounded-full p-1 text-amber-900/70 hover:bg-amber-900/10 hover:text-amber-950"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
              <div className="parchment-body">{s.body}</div>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default LandingPage;
