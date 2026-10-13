import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setUnauthorizedHandler } from '../api/client';

// AuthContext makes the logged-in user (and login/register/logout functions)
// available to any component in the app via the useAuth() hook below,
// instead of passing them down as props through every layer.
const AuthContext = createContext(null);

function readSavedUser() {
  try {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null; // Corrupt or unavailable storage - start logged out
  }
}

export function AuthProvider({ children }) {
  // Restore the user from localStorage on first load, so refreshing the
  // page doesn't log the user out.
  const [user, setUser] = useState(readSavedUser);

  const persistSession = useCallback((data) => {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data));
    setUser(data);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  }, []);

  // If the API rejects our token (expired, user deleted), end the session.
  useEffect(() => {
    setUnauthorizedHandler(logout);
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  const value = useMemo(
    () => ({
      user,
      logout,
      register: async (name, email, password) => {
        const res = await api.post('/auth/register', { name, email, password }, { auth: false });
        persistSession(res.data);
        return res.data;
      },
      login: async (email, password) => {
        const res = await api.post('/auth/login', { email, password }, { auth: false });
        persistSession(res.data);
        return res.data;
      },
      // Used after a successful password reset, where the backend returns a
      // fresh token/user just like login/register do.
      refreshSession: persistSession,
      // Merge changed profile fields (e.g. name) into the saved session.
      updateUser: (patch) => {
        const next = { ...user, ...patch };
        localStorage.setItem('user', JSON.stringify(next));
        setUser(next);
      },
    }),
    [user, logout, persistSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Custom hook so components just call useAuth() instead of importing
// useContext + AuthContext everywhere.
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
