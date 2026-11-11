import React, { useState } from 'react';
import { Star, AlertTriangle, Menu, MessageCircle, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import ProfileMenu from '../components/ProfileMenu';
import HeaderTabs from '../components/HeaderTabs';
import { boardsEnabled } from '../components/BoardTabBar';
import { useLeftRail } from '../components/SideNav';
import UsageBar from '../components/UsageBar';
import { PRODUCT_NAME, PRODUCT_TAGLINE } from '../lib/legal';
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
            <Link to="/dashboard/you" title={`${PRODUCT_NAME} – ${PRODUCT_TAGLINE}`} aria-label={`${PRODUCT_NAME} – ${PRODUCT_TAGLINE}`} className="flex shrink-0 items-center space-x-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
              <Star className="w-8 h-8 text-purple-400" />
              <h1 className="hidden sm:block text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                AdAstra AI
              </h1>
              <span className={`${boardsEnabled() ? 'hidden' : 'hidden xl:inline'} self-center ml-1 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-sm text-transparent`} data-test-id="header-tagline">
                {PRODUCT_TAGLINE}
              </span>
            </Link>

            {/* the question quota takes the middle; the menu, the chat's location control and the avatar sit at the right (Sachin, 2026-11-05) */}
            <div className="flex min-w-0 flex-1 justify-center">
              <UsageBar />
            </div>
            {boardsEnabled() ? (
              <HeaderTabs />
            ) : (
              <Link to="/dashboard/chat" className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/85 hover:bg-white/10 sm:inline-flex" data-testid="general-reading-link">
                <MessageCircle className="h-4 w-4 text-purple-300" aria-hidden="true" />
                General Reading
              </Link>
              )}
            <div data-chat-header-slot className="flex min-w-0 items-center" />

            <button
              type="button"
              onClick={() => setWizardOpen(true)}
              data-testid="header-wizard-trigger"
              title="Personalize your readings"
              aria-label="Personalize your readings"
              className="inline-flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-full border border-purple-400/35 bg-purple-500/15 px-3 py-1.5 text-xs font-medium text-purple-100 hover:bg-purple-500/25 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <Sparkles className="h-3.5 w-3.5 text-purple-300" aria-hidden="true" />
              <span className="hidden sm:inline">Personalize</span>
            </button>

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
