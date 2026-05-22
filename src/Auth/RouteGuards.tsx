import { Navigate, Outlet, useLocation } from 'react-router-dom';

interface SessionGateProps {
  sessionReady: boolean;
  isAuthenticated: boolean;
}

export function SessionLoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center text-white/80">
      <p className="text-sm tracking-wide">Loading…</p>
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
    return <Navigate to="/dashboard/chat" replace />;
  }

  return <Outlet />;
}
