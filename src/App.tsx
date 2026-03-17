import { useState, useEffect } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import AppRoutes from './routes';
import AuthProvider from './Auth/AuthProvider';

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

  const handleSignIn = (userData?: User) => {
    if (userData) {
      setUser(userData);
      localStorage.setItem('astroUser', JSON.stringify(userData));
    }
    setIsAuthenticated(true);
  };

  const handleSignUp = (userData: User) => {
    setUser(userData);
    setIsAuthenticated(true);
    localStorage.setItem('astroUser', JSON.stringify(userData));
    localStorage.setItem('isAuthenticated', 'true');
  };

  const handleLogout = () => {
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('astroUser');
    localStorage.removeItem('isAuthenticated');
  };

  useEffect(() => {
    const savedUser = localStorage.getItem('astroUser');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
      setIsAuthenticated(true);
    }
  }, []);

  return (
    <div className="min-h-screen relative overflow-x-hidden">
      {/* Fixed Galaxy Background */}
      <div
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url('https://images.pexels.com/photos/1169754/pexels-photo-1169754.jpeg?auto=compress&cs=tinysrgb&w=1920&h=1280&fit=crop')`,
        }}
      >
        <div className="absolute inset-0 bg-black/40"></div>
      </div>

      {/* Content */}
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
