import { Navigate, Outlet, useLocation } from 'react-router-dom';
import LoadingVeil from '../components/LoadingVeil';

interface SessionGateProps {
  sessionReady: boolean;
  isAuthenticated: boolean;
}

/** The wait while the session is restored or `me` is read: the loading veil over the whole viewport. */
export function SessionLoadingScreen() {
  return (
    <div className="min-h-screen" data-testid="session-loading">
      <LoadingVeil fullScreen testId="session-loading-veil" />
    </div>
  );
}

/** Requires valid session; otherwise sends user to sign-in (preserves intended path). */
export function ProtectedRoute({
  sessionReady,
  isAuthenticated,
}: SessionGateProps) {
  const location = useLocation();

  if (!sessionReady) {
    return <SessionLoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/signin" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}

/** Sign-in / sign-up only when logged out; otherwise dashboard. */
export function GuestRoute({
  sessionReady,
  isAuthenticated,
}: SessionGateProps) {
  if (!sessionReady) {
    return <SessionLoadingScreen />;
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard/you" replace />;
  }

  return <Outlet />;
}
