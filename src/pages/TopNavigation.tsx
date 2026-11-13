import React, { useState } from 'react';
import { AlertTriangle, Clock, Menu } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import ProfileMenu from '../components/ProfileMenu';
import { boardsEnabled } from '../components/BoardTabBar';
import { useLeftRail } from '../components/SideNav';
import UsageRing from '../components/UsageRing';
import { track } from '../lib/events';
import { PRODUCT_NAME, PRODUCT_TAGLINE, PRODUCT_TITLE } from '../lib/legal';
import WelcomeWizard from './welcome/WelcomeWizard';

interface User {
  name: string;
  email?: string;
}

interface TopNavigationProps {
  user?: User | null;
  onLogout: () => void;
  errorMessage?: string | null;   // ✅ accept error message
}

const TopNavigation: React.FC<TopNavigationProps> = ({ user, onLogout, errorMessage }) => {
  const [wizardOpen, setWizardOpen] = useState(false);
  const rail = useLeftRail();

  return (
    <>
      <nav
        className="sticky top-0 z-50 w-screen shrink-0 glass-bar border-b border-white/10 ml-[calc(50%-50vw)]"
        aria-label="Main"
      >
        <div className="w-full px-3 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center gap-2 sm:gap-3">
            {/* below 768 px the boards rail is a drawer, opened here, left of the brand (Sachin, 2026-11-10) */}
            {rail && boardsEnabled() && (
              <button
                type="button"
                onClick={() => rail.setDrawer(!rail.drawer)}
                aria-label={rail.drawer ? 'Close the menu' : 'Open the menu'}
                aria-expanded={rail.drawer}
                aria-controls="side-nav"
                data-testid="header-menu-button"
                className="-ml-2 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/80 hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 md:hidden"
              >
                <Menu className="h-6 w-6" aria-hidden="true" />
              </button>
            )}
            <Link to="/dashboard/you" title={PRODUCT_TITLE} aria-label={PRODUCT_TITLE} className="flex shrink-0 items-center gap-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
              <img src="/images/logo-128.png" alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-xl" data-test-id="brand-logo" />
              {/* name over tagline; General Reading and Personalize live in the avatar menu (Sachin, 2026-11-12) */}
              <div className="hidden min-w-0 flex-col justify-center bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent sm:flex">
                <h1 className="text-xl font-bold leading-none">{PRODUCT_NAME}</h1>
                <span className="mt-1 text-[11px] leading-tight" data-test-id="header-tagline">
                  {PRODUCT_TAGLINE}
                </span>
              </div>
            </Link>

            <div className="min-w-0 flex-1" />
            {/* below 768 px Happy Hour(s) lives in the menu drawer (SideNav) */}
            {boardsEnabled() && (
              <NavLink
                to="/dashboard/lucky"
                onClick={() => track('tab_select', 'header', 'happy hour(s)')}
                data-testid="header-happy-hours"
                className={({ isActive }) =>
                  `hidden min-h-[40px] shrink-0 items-center gap-1.5 rounded-full px-3 text-sm md:flex ${isActive ? 'bg-white/15 text-white' : 'text-white/65 hover:bg-white/10 hover:text-white'}`
                }
              >
                <Clock className="h-4 w-4" aria-hidden="true" />
                Happy Hour(s)
              </NavLink>
            )}
            <div data-chat-header-slot className="flex min-w-0 items-center" />
            <UsageRing />
            <ProfileMenu user={user} onLogout={onLogout} onOpenWizard={() => setWizardOpen(true)} />
          </div>

          {/* ✅ Error Banner */}
          {errorMessage && (
            <div className="bg-red-500/20 border-t border-red-500/30 py-2 px-4 flex items-center space-x-2 text-red-300 text-sm">
              <AlertTriangle className="w-4 h-4" />
              <span>{errorMessage || "This task is not possible at this moment"}</span>
            </div>
          )}
        </div>
      </nav>

      {wizardOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Personalize your readings"
          data-testid="header-wizard-modal"
          onClick={() => setWizardOpen(false)}
        >
          <div
            className="relative flex h-[min(640px,88vh)] w-[min(880px,94vw)] flex-col overflow-hidden rounded-3xl border border-white/15 bg-[#0d0c24] p-4 shadow-2xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex shrink-0 items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h2 className="text-lg font-semibold text-white">Personalize Your Readings</h2>
                <p className="text-xs text-white/60">Tell us where you are in life so every board and reading speaks to your situation.</p>
              </div>
              <button
                type="button"
                aria-label="Close personalization wizard"
                data-testid="header-wizard-close"
                onClick={() => setWizardOpen(false)}
                className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
              >
                ✕
              </button>
            </div>
            <WelcomeWizard onFinish={() => setWizardOpen(false)} inModal />
          </div>
        </div>
      )}
    </>
  );
};

export default TopNavigation;
