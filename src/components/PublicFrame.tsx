import React, { useEffect, useRef } from 'react';
import { ArrowRight } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import Disclaimer, { DISCLAIMER_SHORT } from './Disclaimer';
import LegalLinks from './LegalLinks';
import { logVisit } from '../lib/assistantApi';
import { PRODUCT_NAME, PRODUCT_TAGLINE, PRODUCT_TITLE, SUPPORT_EMAIL } from '../lib/legal';

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
    <div className="public-frame flex h-dvh flex-col overflow-hidden text-white" data-test-id="public-frame">
      {nav ?? (
        <header className="z-20 shrink-0 bg-transparent px-4 py-3 sm:px-6" data-test-id="public-header">
          <div className="flex w-full items-center justify-between gap-3">
            <Link to="/" className="flex min-w-0 items-center gap-3" title={PRODUCT_TITLE} aria-label={PRODUCT_TITLE}>
              <img src="/images/logo-128.png" alt="" width={80} height={80} className="h-12 w-12 shrink-0 rounded-2xl sm:h-16 sm:w-16 lg:h-20 lg:w-20" data-test-id="brand-logo" />
              {/* The tagline sits under the name at every width; the logo grows with the pair above phone width (Sachin, 2026-11-11). */}
              <span className="flex min-w-0 flex-col bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                <span className="whitespace-nowrap text-2xl font-bold leading-tight sm:text-3xl lg:text-4xl">{PRODUCT_NAME}</span>
                <span className="text-xs leading-tight sm:text-sm lg:text-lg" data-test-id="header-tagline">
                  {PRODUCT_TAGLINE}
                </span>
              </span>
            </Link>
            {!NO_CTA_PATHS.includes(path) && (
              <Link
                to="/signin"
                className="group flex shrink-0 items-center whitespace-nowrap rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2 text-white sm:px-5 transition-all duration-300 hover:from-purple-700 hover:to-pink-700"
              >
                Get Started
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
              </Link>
            )}
          </div>
        </header>
      )}

      <main ref={scroller} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {children}
      </main>

      <footer className="z-20 shrink-0 bg-gradient-to-t from-black/40 via-black/20 to-transparent px-4 pb-1.5 pt-3 sm:px-6 sm:pb-2 sm:pt-6 [@media(max-height:480px)]:pt-1 [@media(max-height:480px)]:pb-1" data-test-id="public-footer">
        <div className="w-full">
          {/* On a wide screen one row of three, top lines level and equal gaps either side of the disclaimer; narrower,
              the disclaimer wraps under copyright and links. On a phone two short lines (Sachin, 2026-11-10):
              "© 2026 name (site) · Terms · Privacy", then the one-line disclaimer. */}
          <div className="flex flex-wrap items-center justify-center gap-x-1.5 sm:justify-between sm:gap-x-6 lg:flex-nowrap lg:items-start">
            <p className="order-1 shrink-0 text-[11px] leading-snug text-gray-400 sm:py-1 sm:text-xs" data-test-id="copyright-notice">
              &copy; 2026 {PRODUCT_NAME} (vedic-astrology.app)<span className="hidden sm:inline">. All rights reserved.</span>
            </p>
            {/* three lines on a phone, or a very short window, covered the page, so they get one; the full text is in the Terms */}
            <Disclaimer className="order-3 hidden w-full py-1 sm:block lg:order-2 lg:w-auto [@media(max-height:480px)]:!hidden" />
            <div className="order-2 flex shrink-0 flex-wrap items-center gap-x-1.5 leading-snug sm:gap-x-3 sm:py-1 lg:order-3">
              <span className="text-[11px] text-gray-500 sm:hidden" aria-hidden="true">·</span>
              <LegalLinks compact />
              {SUPPORT_EMAIL && (
                <a href={`mailto:${SUPPORT_EMAIL}`} className="hidden text-xs text-gray-400 hover:text-purple-300 sm:inline">
                  {SUPPORT_EMAIL}
                </a>
              )}
            </div>
          </div>
          <p role="note" data-test-id="disclaimer-short" className="text-center text-[11px] leading-snug text-slate-400 sm:hidden sm:text-xs [@media(max-height:480px)]:!block">
            {DISCLAIMER_SHORT}
          </p>
        </div>
      </footer>
    </div>
  );
};

export default PublicFrame;
