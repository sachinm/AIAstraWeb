import React from 'react';
import { Outlet } from 'react-router-dom';
import TopNavigation from './TopNavigation';

interface User {
  name: string;
  email: string;
  age: number;
  dateOfBirth: string;
  placeOfBirth: string;
  timeOfBirth: string;
}

interface DashboardProps {
  user: User;
  onLogout: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ user, onLogout }) => {
  return (
    <div className="flex min-h-screen flex-col text-white">
      {/* Top Navigation */}
      <TopNavigation
        user={user}
        onLogout={onLogout}
      />

      {/* Main Content */}
      <div className="flex min-w-0 flex-1 flex-col min-h-0">
        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
