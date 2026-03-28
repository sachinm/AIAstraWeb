import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import LandingPage from './LandingPage';
import SignIn from './Auth/SignIn';
import SignUp from './Auth/SignUp';
import Dashboard from './pages/Dashboard';
import ChartsSection from './pages/charts/ChartsSection';
import ChatSection from './pages/chat-interface/ChatSection';
import MantrasSection from './pages/mantras/MantrasSection';
import RemediesSection from './pages/remedies/RemediesSection';
import { User } from './App';

interface AppRoutesProps {
  user: User | null;
  isAuthenticated: boolean;
  handleSignIn: (userData?: User) => void;
  handleSignUp: (userData: User) => void;
  handleLogout: () => void;
}

const AppRoutes: React.FC<AppRoutesProps> = ({
  user,
  isAuthenticated,
  handleSignIn,
  handleSignUp,
  handleLogout,
}) => {
  const navigate = useNavigate();

  return (
    <Routes>
      <Route 
        path="/" 
        element={
          isAuthenticated ? (
            <Navigate to="/dashboard/chat" replace />
          ) : (
            <LandingPage 
              onSignIn={() => navigate('/signin')}
              onSignUp={() => navigate('/signup')}
            />
          )
        } 
      />

      <Route
        path="/signin"
        element={
          !isAuthenticated ? (
            <SignIn
              onSignUp={() => navigate('/signup')}
              onBack={() => navigate('/')}
              handleSignIn={handleSignIn} // ✅ fixed
            />
          ) : (
            <Navigate to="/dashboard/chat" replace />
          )
        }
      />

      <Route
        path="/signup"
        element={
          !isAuthenticated ? (
            <SignUp
              onSignUp={handleSignUp}
              onSignIn={() => navigate('/signin')}
              onBack={() => navigate('/')}
            />
          ) : (
            <Navigate to="/dashboard/chat" replace />
          )
        }
      />

      <Route
        path="/dashboard"
        element={
          isAuthenticated && user ? (
            <Dashboard user={user} onLogout={handleLogout} />
          ) : (
            <Navigate to="/signin" replace />
          )
        }
      >
        <Route index element={<ChatSection user={user!} activeChatId={null} />} />
        <Route path="chat" element={<ChatSection user={user!} activeChatId={null} />} />
        <Route path="charts" element={<ChartsSection user={user!} />} />
        <Route path="mantras" element={<MantrasSection user={user!} />} />
        <Route path="remedies" element={<RemediesSection user={user!} />} />
      </Route>

      {/* Catch-all: redirect unknown routes to landing */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default AppRoutes;
