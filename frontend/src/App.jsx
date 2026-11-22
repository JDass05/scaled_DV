import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import AdminPortal from './components/AdminPortal';
import FarmerPortal from './components/FarmerPortal';

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = sessionStorage.getItem('aahar_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const handleLogin = (user) => {
    setCurrentUser(user);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('aahar_user');
    setCurrentUser(null);
  };

  if (!currentUser) {
    return <Login onLogin={handleLogin} />;
  }

  if (currentUser.role === 'admin') {
    return <AdminPortal user={currentUser} onLogout={handleLogout} />;
  }

  return <FarmerPortal user={currentUser} onLogout={handleLogout} />;
}
