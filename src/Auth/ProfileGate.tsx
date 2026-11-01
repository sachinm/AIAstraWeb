import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { fetchMe, type Me } from './api';
import { SessionLoadingScreen } from './RouteGuards';

const MeContext = createContext<{ me: Me | null; refresh: () => Promise<void> }>({
  me: null,
  refresh: async () => {},
});

/** The signed-in user's onboarding state (null while unknown or when it could not be read). */
export function useMe(): Me | null {
  return useContext(MeContext).me;
}

/** Re-reads `me` now (for example right after a change that rebuilds the chart). */
export function useRefreshMe(): () => Promise<void> {
  return useContext(MeContext).refresh;
}

/** Re-check the chart status this often while it is not ready. */
const POLL_MS = 60_000;

/**
 * Wraps the signed-in app. A user whose registration is unfinished (profile_complete false) is sent to the
 * birth-details page, whichever way they signed in. If `me` cannot be read the app opens anyway.
 */
export function ProfileGate() {
  const [me, setMe] = useState<Me | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let alive = true;
    void fetchMe().then((m) => {
      if (!alive) return;
      setMe(m);
      setChecked(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    const m = await fetchMe();
    if (m) setMe(m);
  }, []);

  const notReady = me !== null && me.kundli_status !== 'ready';
  useEffect(() => {
    if (!notReady) return undefined;
    const t = setInterval(() => {
      void fetchMe().then((m) => m && setMe(m));
    }, POLL_MS);
    return () => clearInterval(t);
  }, [notReady]);

  if (!checked) return <SessionLoadingScreen />;
  if (me && !me.profile_complete) return <Navigate to="/signup/details" replace />;
  return (
    <MeContext.Provider value={{ me, refresh }}>
      <Outlet />
    </MeContext.Provider>
  );
}

export default ProfileGate;
