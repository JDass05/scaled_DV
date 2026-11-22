import React, { useState } from 'react';
import { USERS } from '../api';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const userKey = username.trim().toLowerCase();
    const user = USERS[userKey];

    if (!user || user.password !== password) {
      setError('Invalid username or password. Please try again.');
      return;
    }

    setError('');
    const sessionUser = { username: userKey, ...user };
    sessionStorage.setItem('aahar_user', JSON.stringify(sessionUser));
    onLogin(sessionUser);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative" style={{ background: 'linear-gradient(135deg, #064e3b 0%, #065f46 40%, #047857 100%)' }}>
      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-2xl shadow-xl mb-4">
            <span className="material-icons text-green-700 text-5xl">eco</span>
          </div>
          <h1 className="text-5xl font-bold text-white hindi">आहार</h1>
          <p className="text-green-200 mt-2 text-sm tracking-widest uppercase">Smart Agriculture Platform</p>
        </div>

        <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl p-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-1">Welcome back</h2>
          <p className="text-gray-500 text-sm mb-7">Sign in to your account to continue</p>

          {error && (
            <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm flex items-center gap-2">
              <span className="material-icons text-sm">error</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Username</label>
              <div className="relative">
                <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xl">person</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-gray-800 bg-gray-50 focus:outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/20 text-sm"
                  required
                />
              </div>
            </div>

            <div className="mb-7">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xl">lock</span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-10 pr-11 py-3 border border-gray-200 rounded-xl text-gray-800 bg-gray-50 focus:outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/20 text-sm"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <span className="material-icons text-xl">{showPassword ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full text-white font-semibold py-3 rounded-xl text-sm shadow-lg flex items-center justify-center gap-2 bg-gradient-to-r from-green-600 to-green-700 hover:opacity-95 transition"
            >
              <span className="material-icons text-xl">login</span>
              Sign In
            </button>
          </form>

          <p className="text-center text-gray-400 text-xs mt-6">
            Aahar Precision Farming · React Portal
          </p>
        </div>
      </div>
    </div>
  );
}
