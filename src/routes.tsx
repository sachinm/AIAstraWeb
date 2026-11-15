import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, Outlet, useNavigate } from 'react-router-dom';
import PublicFrame from './components/PublicFrame';
import SkyLayout from './components/SkyLayout';
import ProfileGate from './Auth/ProfileGate';
import TopNavigation from './pages/TopNavigation';
import ProfileLayout from './pages/profile/ProfileLayout';
import GaPageViews from './components/GaPageViews';
import SeoHead from './components/SeoHead';
import { PageTimingTracker } from './lib/pageTelemetry';
import {
  GuestRoute,
  ProtectedRoute,
  SessionLoadingScreen,
} from './Auth/RouteGuards';
import { User } from './App';

// Lazy-loaded page components for route-level code splitting
const LandingPage = lazy(() => import('./LandingPage'));
const SignIn = lazy(() => import('./Auth/SignIn'));
const SignUp = lazy(() => import('./Auth/SignUp'));
const BirthDetails = lazy(() => import('./Auth/BirthDetails'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ProfileSection = lazy(() => import('./pages/profile/ProfileSection'));
const ProfilePlan = lazy(() => import('./pages/profile/ProfilePlan'));
const ProfileLocale = lazy(() => import('./pages/profile/ProfileLocale'));
const ProfileLegal = lazy(() => import('./pages/profile/ProfileLegal'));
const ProfileTimeline = lazy(() => import('./pages/profile/ProfileTimeline'));
const ChatSection = lazy(() => import('./pages/chat-interface/ChatSection'));
const LuckyTimesPage = lazy(() => import('./pages/lucky/LuckyTimesPage'));
const WorkPage = lazy(() => import('./pages/work/WorkPage'));
const LovePage = lazy(() => import('./pages/love/LovePage'));
const YouPage = lazy(() => import('./pages/you/YouPage'));
const WelcomeWizard = lazy(() => import('./pages/welcome/WelcomeWizard'));
const PricingPage = lazy(() => import('./pages/pricing/PricingPage'));
const PrivacyPage = lazy(() => import('./pages/legal/LegalPages').then((m) => ({ default: m.PrivacyPage })));
const TermsPage = lazy(() => import('./pages/legal/LegalPages').then((m) => ({ default: m.TermsPage })));
const RefundsPage = lazy(() => import('./pages/legal/LegalPages').then((m) => ({ default: m.RefundsPage })));

/** Accessible loading fallback for lazy-loaded route boundaries */
export function RouteLoadingFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="min-h-[50vh] flex items-center justify-center p-8"
      data-testid="route-loading-fallback"
    >
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-slate-400 font-medium">Loading...</span>
        <span className="sr-only">Loading page content</span>
      </div>
    </div>
  );
}

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
    <PageTimingTracker />
    <Suspense fallback={<RouteLoadingFallback />}>
      <Routes>
      {/* one sky across these three: it keeps playing as the visitor moves between them */}
      <Route element={<SkyLayout />}>
        <Route
          path="/"
          element={
            !sessionReady ? (
              <SessionLoadingScreen />
            ) : isAuthenticated ? (
              <Navigate to="/dashboard/you" replace />
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
          <Route index element={<WelcomeWizard onFinish={() => navigate('/dashboard/you', { replace: true })} />} />
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
          <Route index element={<Navigate to="you" replace />} />
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
            <Navigate to="/dashboard/you" replace />
          ) : (
            <Navigate to="/signin" replace />
          )
        }
      />
      </Routes>
    </Suspense>
    </>
  );
};

export default AppRoutes;
