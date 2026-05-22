import { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import AppRoutes from './routes';
import AuthProvider from './Auth/AuthProvider';
import { clearClientSession, performLogout } from './Auth/logout';
import { restoreSessionFromStorage } from './Auth/sessionRestore';
import {
  startIdleSessionWatcher,
  stopIdleSessionWatcher,
  touchActivity,
} from './Auth/sessionIdle';

export interface User {
  name: string;
  email: string;
  age: number;
  dateOfBirth: string;
  placeOfBirth: string;
  timeOfBirth: string;
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
    if (userData) {
      setUser(userData);
      localStorage.setItem('astroUser', JSON.stringify(userData));
    }
    setIsAuthenticated(true);
    touchActivity();
  };

  const handleSignUp = (userData: User) => {
    setUser(userData);
    setIsAuthenticated(true);
    localStorage.setItem('astroUser', JSON.stringify(userData));
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
    <div className="relative min-h-screen w-full max-w-[100vw] overflow-x-hidden">
      <div
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url('https://images.pexels.com/photos/1169754/pexels-photo-1169754.jpeg?auto=compress&cs=tinysrgb&w=1920&h=1280&fit=crop')`,
        }}
      >
        <div className="absolute inset-0 bg-black/40"></div>
      </div>

      <div className="relative z-10">
        <Router>
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
      </div>
    </div>
  );
};

export default App;
