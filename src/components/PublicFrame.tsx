import React, { useEffect, useRef } from 'react';
import { ArrowRight, Star } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import Disclaimer, { DISCLAIMER_SHORT } from './Disclaimer';
import LegalLinks from './LegalLinks';
import { logVisit } from '../lib/assistantApi';
import { PRODUCT_NAME, PRODUCT_TAGLINE, SUPPORT_EMAIL } from '../lib/legal';

/** Sign-up and sign-in have their own switch between the two, so the header does not repeat it. */
const NO_CTA_PATHS = ['/signin', '/signup', '/signup/details'];
/** The visit log is for visitors on the public pages, not someone signing in or already filling in their details. */
const NO_VISIT_LOG_PATHS = ['/signin', '/signup/details'];

interface PublicFrameProps {
  children: React.ReactNode;
  /** Replaces the public header, for a signed-in visitor on a public page. */
  nav?: React.ReactNode;
}

/** Every public page: header and footer stay at the top and bottom of the viewport, and only the middle scrolls. */
const PublicFrame: React.FC<PublicFrameProps> = ({ children, nav }) => {
  const { pathname } = useLocation();
  const path = pathname.replace(/\/+$/, '');
  const scroller = useRef<HTMLElement>(null);

  // The scroller outlives a route change, so a new page would otherwise open part way down.
  useEffect(() => {
    scroller.current?.scrollTo?.({ top: 0 });
  }, [pathname]);

  useEffect(() => {
    if (!nav && !NO_VISIT_LOG_PATHS.includes(path)) void logVisit();
  }, [nav, path]);

  return (
    <div className="flex h-dvh flex-col overflow-hidden text-white">
      {nav ?? (
        <header className="z-20 shrink-0 bg-transparent px-4 py-3 sm:px-6" data-test-id="public-header">
          <div className="flex w-full items-center justify-between gap-3">
            <Link to="/" className="flex min-w-0 items-center gap-2" title={`${PRODUCT_NAME} – ${PRODUCT_TAGLINE}`} aria-label={`${PRODUCT_NAME} – ${PRODUCT_TAGLINE}`}>
              <Star className="h-7 w-7 shrink-0 text-purple-400" aria-hidden="true" />
              {/* The tagline sits under the name on phones and beside it from tablet width up. */}
              <span className="flex min-w-0 flex-col bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent md:flex-row md:items-baseline md:gap-2">
                <span className="text-2xl font-bold leading-tight">{PRODUCT_NAME}</span>
                <span className="text-[11px] leading-tight md:text-sm" data-test-id="header-tagline">
                  <span className="hidden md:inline" aria-hidden="true">– </span>
                  {PRODUCT_TAGLINE}
                </span>
              </span>
            </Link>
            {!NO_CTA_PATHS.includes(path) && (
              <Link
                to="/signup"
                className="group flex shrink-0 items-center whitespace-nowrap rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2 text-white sm:px-5 transition-all duration-300 hover:from-purple-700 hover:to-pink-700"
              >
                Get Started
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
              </Link>
            )}
          </div>
        </header>
      )}

      <main ref={scroller} className="relative min-h-0 flex-1 overflow-y-auto">
        {children}
      </main>

      <footer className="z-20 shrink-0 bg-gradient-to-t from-black/40 via-black/20 to-transparent px-4 pb-2 pt-6 sm:px-6" data-test-id="public-footer">
        <div className="w-full">
          <div className="flex items-center justify-between gap-x-3 sm:flex-wrap sm:gap-x-6">
            <p className="shrink-0 py-1 text-xs text-gray-400" data-test-id="copyright-notice">
              &copy; 2026 {PRODUCT_NAME} (vedic-astrology.app)<span className="hidden sm:inline">. All rights reserved.</span>
            </p>
            <div className="flex flex-wrap items-center gap-x-3">
              <LegalLinks />
              {SUPPORT_EMAIL && (
                <a href={`mailto:${SUPPORT_EMAIL}`} className="text-xs text-gray-400 hover:text-purple-300">
                  {SUPPORT_EMAIL}
                </a>
              )}
            </div>
          </div>
          {/* three lines on a phone covered the page, so a phone gets one; the full text is in the Terms */}
          <Disclaimer className="hidden sm:block" />
          <p role="note" data-test-id="disclaimer-short" className="text-center text-xs leading-snug text-slate-400 sm:hidden">
            {DISCLAIMER_SHORT}
          </p>
        </div>
      </footer>
    </div>
  );
};

export default PublicFrame;
