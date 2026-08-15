import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { fetchCurrentUser, getDiscordLoginUrl, logout as logoutRequest } from '../api/apiClient';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetchCurrentUser();
      setUser(response.data);
    } catch (error) {
      if (error?.response?.status !== 401) console.error('Could not check the current session:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const signIn = useCallback(() => window.location.assign(getDiscordLoginUrl()), []);
  const signOut = useCallback(async () => {
    try { await logoutRequest(); } finally { setUser(null); }
  }, []);

  const value = useMemo(
    () => ({ user, isLoading, isAuthenticated: !!user, refresh, signIn, signOut }),
    [user, isLoading, refresh, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
};
