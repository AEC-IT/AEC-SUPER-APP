import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Intercept URL token query strings for SSO
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    const urlRefresh = params.get('refresh');
    
    if (urlToken) {
      localStorage.setItem('access_token', urlToken);
      if (urlRefresh) {
        localStorage.setItem('refresh_token', urlRefresh);
      }
      // Remove query parameters from the URL clean for safety
      const newUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, document.title, newUrl);
    }

    const token = localStorage.getItem('access_token');
    if (token) {
      authAPI.me().then(res => setUser(res.data)).catch(() => {
        localStorage.clear();
      }).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const res = await authAPI.login(email, password);
    localStorage.setItem('access_token', res.data.access);
    localStorage.setItem('refresh_token', res.data.refresh);
    const me = await authAPI.me();
    setUser(me.data);
    return me.data;
  };

  const logout = async () => {
    const refresh = localStorage.getItem('refresh_token');
    try { await authAPI.logout(refresh); } catch {}
    localStorage.clear();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
