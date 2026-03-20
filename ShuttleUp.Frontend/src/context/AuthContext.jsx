import { createContext, useContext, useState, useCallback } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const login = useCallback((data) => {
    // data = { accessToken, tokenType, expiresInMinutes, user: { id, email, fullName, roles } }
    localStorage.setItem('token', data.accessToken);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
  }, []);

  const updateUser = useCallback((patch) => {
    setUser((prev) => {
      const next = { ...(prev || {}), ...(patch || {}) };
      try {
        localStorage.setItem('user', JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  }, []);

  const isAuthenticated = !!user;

  const hasRole = useCallback(
    (role) => user?.roles?.includes(role) ?? false,
    [user]
  );

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, login, updateUser, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
