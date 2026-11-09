import { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import AppRoutes from './routes';
import AppFrame from './components/AppFrame';
import ThemeScope from './components/ThemeScope';
import AuthProvider from './Auth/AuthProvider';
import { clearClientSession, performLogout } from './Auth/logout';
import { resolveUserForSession, restoreSessionFromStorage } from './Auth/sessionRestore';
import { toUser, writeStoredUser } from './Auth/storedUser';
import {
  startIdleSessionWatcher,
  stopIdleSessionWatcher,
  touchActivity,
} from './Auth/sessionIdle';

/**
 * What `astroUser` in localStorage holds: the display name only. Birth details live on the server and are never kept
 * in the browser (server docs/privacy/02 §4.3).
 */
export interface StoredUser {
  name: string;
}

/** The signed-in user in memory. The email is known only for this page's life (from sign-up) and is never stored. */
export interface User extends StoredUser {
  email?: string;
}

const App = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  const applyLogoutState = useCallback(() => {
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  const handleSignIn = (userData?: User) => {
    // code sign-in passes the user id string, not a user object: fall back to the stored name or the placeholder
    const next = toUser(userData) ?? resolveUserForSession();
    if (next) {
      setUser(next);
      writeStoredUser(next);
    }
    setIsAuthenticated(true);
    touchActivity();
  };

  const handleSignUp = (userData: User) => {
    setUser(userData);
    setIsAuthenticated(true);
    writeStoredUser(userData);
    localStorage.setItem('isAuthenticated', 'true');
    touchActivity();
  };

  const handleLogout = () => {
    applyLogoutState();
    performLogout({ reason: 'manual', redirect: true });
  };

  useEffect(() => {
    const restored = restoreSessionFromStorage();
    if (!restored.isAuthenticated) {
      clearClientSession();
      applyLogoutState();
    } else if (restored.user) {
      setUser(restored.user);
      setIsAuthenticated(true);
      touchActivity();
    } else {
      clearClientSession();
      applyLogoutState();
    }
    setSessionReady(true);
  }, [applyLogoutState]);

  useEffect(() => {
    const onAuthLogout = () => applyLogoutState();
    const onSessionExpired = () => {
      applyLogoutState();
      performLogout({ reason: 'expired', redirect: true, broadcast: false });
    };
    window.addEventListener('auth:logout', onAuthLogout);
    window.addEventListener('auth:session-expired', onSessionExpired);
    return () => {
      window.removeEventListener('auth:logout', onAuthLogout);
      window.removeEventListener('auth:session-expired', onSessionExpired);
    };
  }, [applyLogoutState]);

  useEffect(() => {
    if (!sessionReady || !isAuthenticated) {
      stopIdleSessionWatcher();
      return;
    }
    startIdleSessionWatcher(() => {
      applyLogoutState();
      performLogout({ reason: 'idle', redirect: true });
    });
    return () => stopIdleSessionWatcher();
  }, [sessionReady, isAuthenticated, applyLogoutState]);

  return (
    <AppFrame>
      <Router>
        <ThemeScope />
        <AuthProvider
          user={user}
          setUser={setUser}
          isAuthenticated={isAuthenticated}
          setIsAuthenticated={setIsAuthenticated}
        >
          <AppRoutes
            user={user}
            isAuthenticated={isAuthenticated}
            sessionReady={sessionReady}
            handleSignIn={handleSignIn}
            handleSignUp={handleSignUp}
            handleLogout={handleLogout}
          />
        </AuthProvider>
      </Router>
    </AppFrame>
  );
};

export default App;
