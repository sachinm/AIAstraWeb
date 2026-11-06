import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import TopNavigation from './TopNavigation';
import LegalLinks from '../components/LegalLinks';
import KundliNotice from '../components/KundliNotice';
import { GeneralReadingProvider } from '../components/GeneralReading';
import SideNav, { SideNavProvider } from '../components/SideNav';
import NightSky from '../components/NightSky';
import { boardsEnabled } from '../components/BoardTabBar';

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
  const onChat = useLocation().pathname.replace(/\/+$/, '').endsWith('/chat');
  return (
    <GeneralReadingProvider user={user}>
    <SideNavProvider>
    <div
      data-test-id="dashboard-root"
      // chat is held to the window: nav, sidebars and input stay put, and only the message list scrolls
      // the shell (Sachin, 2026-11-05): header on top, footer at the bottom, and between them the left sidebar, the
      // main area and an optional right sidebar, edge to edge; only the main area scrolls
      className={`relative isolate flex flex-col text-white ${onChat || boardsEnabled() ? 'h-dvh overflow-hidden' : 'min-h-screen'}`}
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
        <main className={`flex min-h-0 min-w-0 flex-1 flex-col ${boardsEnabled() ? 'main-panel' : ''} ${boardsEnabled() && !onChat ? 'overflow-y-auto' : ''}`}>
          <Outlet />
        </main>
      </div>
      {!onChat && (
        <footer className="glass-bar flex shrink-0 flex-wrap items-center justify-center gap-x-2 gap-y-0.5 border-t border-white/10 px-4 py-2 text-center text-[11px] leading-5 text-gray-500" data-test-id="dashboard-footer">
          {/* one row (Sachin, 2026-11-05): the disclaimer in a sentence, the copyright, Terms and Privacy */}
          <span data-test-id="disclaimer">For education and entertainment only, not advice. You are responsible for your decisions.</span>
          <span aria-hidden="true">·</span>
          <span data-test-id="copyright-notice">© 2026 AdAstra AI (vedic-astrology.app)</span>
          <span aria-hidden="true">·</span>
          <LegalLinks className="inline-flex" />
        </footer>
      )}
    </div>
    </SideNavProvider>
    </GeneralReadingProvider>
  );
};

export default Dashboard;
