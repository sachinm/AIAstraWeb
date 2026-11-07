import React from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '../App';
import { touchActivity } from './sessionIdle';
import { readStoredUser, writeStoredUser } from './storedUser';

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
    const savedUser = readStoredUser();
    if (savedUser) setUser(savedUser);
  };

  const handleSignUp = () => {
    navigate('/signup');
  };

  const handleSuccessfulSignIn = (userData?: User) => {
    if (userData) {
      setUser(userData);
      writeStoredUser(userData);
    } else {
      const savedUser = readStoredUser();
      if (savedUser) setUser(savedUser);
    }
    setIsAuthenticated(true);
    touchActivity();
    navigate('/dashboard/you', { replace: true });
  };

  const handleSuccessfulSignUp = (userData: User) => {
    setUser(userData);
    setIsAuthenticated(true);
    writeStoredUser(userData);
    localStorage.setItem('isAuthenticated', 'true');
    touchActivity();
    navigate('/dashboard/you', { replace: true });
  };

  return React.cloneElement(children as React.ReactElement, {
    user,
    isAuthenticated,
    onSignIn: handleSignIn,
    onSignUp: handleSignUp,
    handleSignIn: handleSuccessfulSignIn,
    handleSignUp: handleSuccessfulSignUp,
  });
};

export default AuthProvider;
