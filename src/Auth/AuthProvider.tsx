import React from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '../App';

interface AuthProviderProps {
  children: React.ReactNode;
  user: User | null;
  setUser: (user: User | null) => void;
  isAuthenticated: boolean;
  setIsAuthenticated: (value: boolean) => void;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({
  children,
  user,
  setUser,
  isAuthenticated,
  setIsAuthenticated,
}) => {
  const navigate = useNavigate();

  const handleSignIn = () => {
    setIsAuthenticated(true);
    // Check if we have a saved user
    const savedUser = localStorage.getItem('astroUser');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  };

  const handleSignUp = () => {
    navigate('/signup');
  };

  const handleSuccessfulSignIn = (userData?: User) => {
    if (userData) {
      setUser(userData);
      localStorage.setItem('astroUser', JSON.stringify(userData));
    } else {
      const savedUser = localStorage.getItem('astroUser');
      if (savedUser) {
        setUser(JSON.parse(savedUser));
      }
    }
    setIsAuthenticated(true);
    navigate('/dashboard/chat', { replace: true });
  };

  const handleSuccessfulSignUp = (userData: User) => {
    setUser(userData);
    setIsAuthenticated(true);
    localStorage.setItem('astroUser', JSON.stringify(userData));
    localStorage.setItem('isAuthenticated', 'true');
    navigate('/dashboard/chat', { replace: true });
  };

  const handleLogout = () => {
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('astroUser');
    navigate('/');
  };

  return React.cloneElement(children as React.ReactElement, {
    user,
    isAuthenticated,
    onSignIn: handleSignIn,
    onSignUp: handleSignUp,
    handleSignIn: handleSuccessfulSignIn,
    handleSignUp: handleSuccessfulSignUp,
    handleLogout,
  });
};

export default AuthProvider;
