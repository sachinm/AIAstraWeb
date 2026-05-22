import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import LandingPage from './LandingPage';
import SignIn from './Auth/SignIn';
import SignUp from './Auth/SignUp';
import Dashboard from './pages/Dashboard';
import ChartsSection from './pages/charts/ChartsSection';
import ChatSection from './pages/chat-interface/ChatSection';
import MantrasSection from './pages/mantras/MantrasSection';
import RemediesSection from './pages/remedies/RemediesSection';
import {
  GuestRoute,
  ProtectedRoute,
  SessionLoadingScreen,
} from './Auth/RouteGuards';
import { User } from './App';

interface AppRoutesProps {
  user: User | null;
  isAuthenticated: boolean;
  sessionReady: boolean;
  handleSignIn: (userData?: User) => void;
  handleSignUp: (userData: User) => void;
  handleLogout: () => void;
}

const AppRoutes: React.FC<AppRoutesProps> = ({
  user,
  isAuthenticated,
  sessionReady,
  handleSignIn,
  handleSignUp,
  handleLogout,
}) => {
  const navigate = useNavigate();

  const gateProps = { sessionReady, isAuthenticated };

  return (
    <Routes>
      <Route
        path="/"
        element={
          !sessionReady ? (
            <SessionLoadingScreen />
          ) : isAuthenticated ? (
            <Navigate to="/dashboard/chat" replace />
          ) : (
            <LandingPage
              onSignIn={() => navigate('/signin')}
              onSignUp={() => navigate('/signup')}
            />
          )
        }
      />

      <Route element={<GuestRoute {...gateProps} />}>
        <Route
          path="/signin"
          element={
            <SignIn
              onSignUp={() => navigate('/signup')}
              onBack={() => navigate('/')}
              handleSignIn={handleSignIn}
            />
          }
        />
        <Route
          path="/signup"
          element={
            <SignUp
              onSignUp={handleSignUp}
              onSignIn={() => navigate('/signin')}
              onBack={() => navigate('/')}
            />
          }
        />
      </Route>

      <Route element={<ProtectedRoute {...gateProps} />}>
        <Route
          path="/dashboard"
          element={
            user ? (
              <Dashboard user={user} onLogout={handleLogout} />
            ) : (
              <Navigate to="/signin" replace />
            )
          }
        >
          <Route index element={<Navigate to="chat" replace />} />
          <Route
            path="chat"
            element={<ChatSection user={user!} activeChatId={null} />}
          />
          <Route path="charts" element={<ChartsSection user={user!} />} />
          <Route path="mantras" element={<MantrasSection user={user!} />} />
          <Route path="remedies" element={<RemediesSection user={user!} />} />
        </Route>
      </Route>

      <Route
        path="*"
        element={
          !sessionReady ? (
            <SessionLoadingScreen />
          ) : isAuthenticated ? (
            <Navigate to="/dashboard/chat" replace />
          ) : (
            <Navigate to="/signin" replace />
          )
        }
      />
    </Routes>
  );
};

export default AppRoutes;
