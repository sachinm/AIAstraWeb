import { Routes, Route, Navigate, Outlet, useNavigate } from 'react-router-dom';
import LandingPage from './LandingPage';
import PublicFrame from './components/PublicFrame';
import SignIn from './Auth/SignIn';
import SignUp from './Auth/SignUp';
import BirthDetails from './Auth/BirthDetails';
import ProfileGate from './Auth/ProfileGate';
import Dashboard from './pages/Dashboard';
import TopNavigation from './pages/TopNavigation';
import ProfileSection from './pages/profile/ProfileSection';
import ProfileLayout from './pages/profile/ProfileLayout';
import ProfilePlan from './pages/profile/ProfilePlan';
import ProfileSettings from './pages/profile/ProfileSettings';
import ProfileTimeline from './pages/profile/ProfileTimeline';
import ChartsSection from './pages/charts/ChartsSection';
import ChatSection from './pages/chat-interface/ChatSection';
import MantrasSection from './pages/mantras/MantrasSection';
import RemediesSection from './pages/remedies/RemediesSection';
import PricingPage from './pages/pricing/PricingPage';
import { PrivacyPage, RefundsPage, TermsPage } from './pages/legal/LegalPages';
import SeoHead from './components/SeoHead';
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
  handleLogout,
}) => {
  const navigate = useNavigate();

  const gateProps = { sessionReady, isAuthenticated };

  return (
    <>
    <SeoHead />
    <Routes>
      <Route
        path="/"
        element={
          !sessionReady ? (
            <SessionLoadingScreen />
          ) : isAuthenticated ? (
            <Navigate to="/dashboard/chat" replace />
          ) : (
            <PublicFrame>
              <LandingPage onSignUp={() => navigate('/signup')} />
            </PublicFrame>
          )
        }
      />

      {/* public, and with the signed-in nav and question count when there is a session */}
      <Route element={isAuthenticated && user ? <ProfileGate /> : <Outlet />}>
        <Route
          path="/pricing"
          element={<PublicFrame nav={isAuthenticated && user ? <TopNavigation user={user} onLogout={handleLogout} /> : undefined}><PricingPage /></PublicFrame>}
        />
      </Route>
      <Route path="/terms" element={<PublicFrame><TermsPage /></PublicFrame>} />
      <Route path="/privacy" element={<PublicFrame><PrivacyPage /></PublicFrame>} />
      <Route path="/refunds" element={<PublicFrame><RefundsPage /></PublicFrame>} />

      <Route element={<GuestRoute {...gateProps} />}>
        <Route
          path="/signin"
          element={
            <PublicFrame>
              <SignIn
              onSignUp={() => navigate('/signup')}
              onBack={() => navigate('/')}
              handleSignIn={handleSignIn}
            />
            </PublicFrame>
          }
        />
        <Route
          path="/signup"
          element={
            <PublicFrame>
              <SignUp
              onVerified={({ email, name }) => {
                handleSignIn({ name, email, dateOfBirth: '', placeOfBirth: '', timeOfBirth: '' });
                navigate('/signup/details', { replace: true });
              }}
              onSignIn={(email) => navigate('/signin', { state: email ? { email } : undefined })}
              onBack={() => navigate('/')}
              />
            </PublicFrame>
          }
        />
      </Route>

      <Route element={<ProtectedRoute {...gateProps} />}>
        <Route
          path="/signup/details"
          element={<BirthDetails onDone={() => navigate('/dashboard/chat', { replace: true })} />}
        />
        <Route element={<ProfileGate />}>
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
          <Route path="charts" element={<ChartsSection />} />
          <Route path="mantras" element={<MantrasSection user={user!} />} />
          <Route path="remedies" element={<RemediesSection user={user!} />} />
          <Route path="timeline/ledger" element={<Navigate to="/profile/timeline" replace />} />
        </Route>
        <Route
          path="/profile"
          element={
            user ? (
              <Dashboard user={user} onLogout={handleLogout} />
            ) : (
              <Navigate to="/signin" replace />
            )
          }
        >
          <Route element={<ProfileLayout />}>
            <Route index element={<ProfileSection />} />
            <Route path="plan" element={<ProfilePlan />} />
            <Route path="settings" element={<ProfileSettings />} />
            <Route path="timeline" element={<ProfileTimeline />} />
          </Route>
        </Route>
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
    </>
  );
};

export default AppRoutes;
