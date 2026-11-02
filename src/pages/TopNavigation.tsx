import React from 'react';
import { Star, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import ProfileMenu from '../components/ProfileMenu';
import UsageBar from '../components/UsageBar';

interface User {
  name: string;
  email: string;
}

interface TopNavigationProps {
  user?: User | null;
  onLogout: () => void;
  errorMessage?: string | null;   // ✅ accept error message
}

const TopNavigation: React.FC<TopNavigationProps> = ({ user, onLogout, errorMessage }) => (
  <nav
    className="sticky top-0 z-50 w-screen shrink-0 border-b border-white/10 bg-black/45 backdrop-blur-md ml-[calc(50%-50vw)]"
    aria-label="Main"
  >
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="flex h-16 items-center justify-between gap-3">
        <Link to="/dashboard/chat" className="flex shrink-0 items-center space-x-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
          <Star className="w-8 h-8 text-purple-400" />
          <h1 className="hidden sm:block text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            AI AdAstra
          </h1>
        </Link>

        <UsageBar />

        <ProfileMenu user={user} onLogout={onLogout} />
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
);

export default TopNavigation;
