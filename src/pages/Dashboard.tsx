import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import TopNavigation from './TopNavigation';
import Disclaimer from '../components/Disclaimer';
import KundliNotice from '../components/KundliNotice';

interface User {
  name: string;
  email: string;
  dateOfBirth: string;
  placeOfBirth: string;
  timeOfBirth: string;
}

interface DashboardProps {
  user: User;
  onLogout: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ user, onLogout }) => {
  // the chat page shows the disclaimer under its input box, where it stays visible while scrolling
  const onChat = useLocation().pathname.replace(/\/+$/, '').endsWith('/chat');
  return (
    <div className="flex min-h-screen flex-col text-white">
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
        </footer>
      )}
    </div>
  );
};

export default Dashboard;
