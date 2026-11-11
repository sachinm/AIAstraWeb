import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import TopNavigation from './TopNavigation';
import LegalLinks from '../components/LegalLinks';
import KundliNotice from '../components/KundliNotice';
import { GeneralReadingProvider } from '../components/GeneralReading';
import SideNav, { SideNavProvider } from '../components/SideNav';
import NightSky from '../components/NightSky';
import { boardsEnabled } from '../components/BoardTabBar';
import { selfV2Enabled } from '../lib/selfV2Api';

interface User {
  name: string;
  email?: string;
}

interface DashboardProps {
  user: User;
  onLogout: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ user, onLogout }) => {
  // the chat page shows the disclaimer under its input box, where it stays visible while scrolling
  const location = useLocation();
  const path = location.pathname.replace(/\/+$/, '');
  const onChat = path.endsWith('/chat');
  // the Self board v2 (server doc 66) never scrolls: the shell is held to the window and the board fills the main area
  const fixedBoard = path === '/dashboard/you' && selfV2Enabled(location.search);
  return (
    <GeneralReadingProvider user={user}>
    <SideNavProvider>
    <div
      data-test-id="dashboard-root"
      // chat is held to the window: nav, sidebars and input stay put, and only the message list scrolls
      // the shell (Sachin, 2026-11-05): header on top, footer at the bottom, and between them the left sidebar, the
      // main area and an optional right sidebar, edge to edge; only the main area scrolls
      className={`relative isolate flex flex-col text-white ${onChat || fixedBoard || boardsEnabled() ? 'h-dvh overflow-hidden' : 'min-h-screen'}`}
    >
      {/* a royal dark-blue sky with shooting stars behind every signed-in page (Sachin, 2026-11-05) */}
      <NightSky className="-z-10" />

      {/* Top Navigation */}
      <TopNavigation
        user={user}
        onLogout={onLogout}
      />

      <KundliNotice />

      {/* Main Content */}
      <div className="flex min-h-0 flex-1">
        {boardsEnabled() && <SideNav />}
        <main className={`flex min-h-0 min-w-0 flex-1 flex-col ${boardsEnabled() ? 'main-panel' : ''} ${fixedBoard ? 'overflow-hidden' : boardsEnabled() && !onChat ? 'overflow-y-auto' : ''}`}>
          <Outlet />
        </main>
      </div>
      {!onChat && (
        <footer className="glass-bar flex shrink-0 items-center justify-center gap-x-1.5 overflow-hidden whitespace-nowrap border-t border-white/10 px-3 py-0.5 text-center text-[11px] leading-4 text-gray-500 md:flex-wrap md:gap-x-2 md:gap-y-0.5 md:whitespace-normal md:px-4 md:py-2 md:leading-5" data-test-id="dashboard-footer">
          {/* one row (Sachin, 2026-11-05): the disclaimer in a sentence, the copyright, Terms and Privacy. Below 768 px a
              sliver about 26 px tall (Sachin, 2026-11-10): the short disclaimer, Terms and Privacy on one line. */}
          <span data-test-id="disclaimer" className="hidden md:inline">For education and entertainment only, not advice. You are responsible for your decisions.</span>
          <span data-test-id="disclaimer-short" className="truncate md:hidden">For education and entertainment only</span>
          <span aria-hidden="true" className="hidden md:inline">·</span>
          <span data-test-id="copyright-notice" className="hidden md:inline">© 2026 AdAstra AI (vedic-astrology.app)</span>
          <span aria-hidden="true">·</span>
          <LegalLinks compact className="inline-flex shrink-0 flex-nowrap md:flex-wrap" />
        </footer>
      )}
    </div>
    </SideNavProvider>
    </GeneralReadingProvider>
  );
};

export default Dashboard;
