import { Routes, Route, Navigate, Outlet, useNavigate } from 'react-router-dom';
import LandingPage from './LandingPage';
import PublicFrame from './components/PublicFrame';
import SkyLayout from './components/SkyLayout';
import SignIn from './Auth/SignIn';
import SignUp from './Auth/SignUp';
import BirthDetails from './Auth/BirthDetails';
import ProfileGate from './Auth/ProfileGate';
import Dashboard from './pages/Dashboard';
import TopNavigation from './pages/TopNavigation';
import ProfileSection from './pages/profile/ProfileSection';
import ProfileLayout from './pages/profile/ProfileLayout';
import ProfilePlan from './pages/profile/ProfilePlan';
import GaPageViews from './components/GaPageViews';
import ProfileLocale from './pages/profile/ProfileLocale';
import ProfileLegal from './pages/profile/ProfileLegal';
import ProfileTimeline from './pages/profile/ProfileTimeline';
import ChatSection from './pages/chat-interface/ChatSection';
import LuckyTimesPage from './pages/lucky/LuckyTimesPage';
import WorkPage from './pages/work/WorkPage';
import LovePage from './pages/love/LovePage';
import YouPage from './pages/you/YouPage';
import WelcomeWizard from './pages/welcome/WelcomeWizard';
import { boardsEnabled } from './components/BoardTabBar';
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
    <GaPageViews />
    <Routes>
      {/* one sky across these three: it keeps playing as the visitor moves between them */}
      <Route element={<SkyLayout />}>
        <Route
          path="/"
          element={
            !sessionReady ? (
              <SessionLoadingScreen />
            ) : isAuthenticated ? (
              <Navigate to={boardsEnabled() ? '/dashboard/lucky' : '/dashboard/chat'} replace />
            ) : (
              <LandingPage onSignUp={() => navigate('/signup')} />
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
                onVerified={({ email, name }) => {
                  handleSignIn({ name, email });
                  navigate('/signup/details', { replace: true });
                }}
                onSignIn={(email) => navigate('/signin', { state: email ? { email } : undefined })}
                onBack={() => navigate('/')}
              />
            }
          />
        </Route>
        <Route element={<ProtectedRoute {...gateProps} />}>
          <Route
            path="/signup/details"
            element={<BirthDetails onDone={() => navigate('/welcome', { replace: true })} />}
          />
        </Route>
      </Route>

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

      <Route element={<ProtectedRoute {...gateProps} />}>
        <Route element={<ProfileGate />}>
        <Route path="/welcome" element={<SkyLayout />}>
          <Route index element={<WelcomeWizard onFinish={() => navigate(boardsEnabled() ? '/dashboard/lucky' : '/dashboard/chat', { replace: true })} />} />
        </Route>
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
          <Route path="charts" element={<Navigate to={import.meta.env.VITE_BOARDS_ENABLED === '1' ? '/dashboard/lucky' : '/dashboard/chat'} replace />} />
          <Route path="chart" element={<Navigate to="/dashboard/charts" replace />} />
          <Route path="mantras" element={<Navigate to={import.meta.env.VITE_BOARDS_ENABLED === '1' ? '/dashboard/lucky' : '/dashboard/chat'} replace />} />
          <Route path="remedies" element={<Navigate to={import.meta.env.VITE_BOARDS_ENABLED === '1' ? '/dashboard/lucky' : '/dashboard/chat'} replace />} />
          <Route path="lucky" element={<LuckyTimesPage />} />
          <Route path="work" element={<WorkPage />} />
          <Route path="today" element={<Navigate to="/dashboard/lucky" replace />} />
          <Route path="love" element={<LovePage />} />
          <Route path="you" element={<YouPage />} />
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
            <Route path="locale" element={<ProfileLocale />} />
            <Route path="legal" element={<ProfileLegal />} />
            <Route path="settings" element={<Navigate to="/profile/locale" replace />} />
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
