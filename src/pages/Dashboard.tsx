import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import TopNavigation from './TopNavigation';
import Disclaimer from '../components/Disclaimer';
import LegalLinks from '../components/LegalLinks';
import KundliNotice from '../components/KundliNotice';
import BoardTabBar, { boardsEnabled } from '../components/BoardTabBar';

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
    <div
      data-test-id="dashboard-root"
      // chat is held to the window: nav, sidebars and input stay put, and only the message list scrolls
      className={`flex flex-col text-white ${onChat ? 'h-dvh overflow-hidden' : 'min-h-screen'}`}
    >
      {/* Top Navigation */}
      <TopNavigation
        user={user}
        onLogout={onLogout}
      />

      <KundliNotice />

      {/* Main Content */}
      <div className="flex min-h-0 flex-1">
        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          <Outlet />
        </main>
      </div>
      {!onChat && (
        <footer className="border-t border-white/10 px-4 py-3">
          <Disclaimer />
          <LegalLinks className="mt-1" />
        </footer>
      )}
      {!onChat && boardsEnabled() && <BoardTabBar />}
    </div>
  );
};

export default Dashboard;
