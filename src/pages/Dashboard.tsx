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
    <div className="min-h-screen text-white">
      {/* Top Navigation */}
      <TopNavigation
        user={user}
        onLogout={onLogout}
      />

      {/* Main Content */}
      <div className="flex">
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
