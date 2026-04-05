import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { isJwtExpired } from '../utils/jwtRoles';

const AuthContext = createContext(null);

export const AUTH_CLEARED_EVENT = 'shuttleup:auth-cleared';

function readInitialUser() {
  try {
    const token = localStorage.getItem('token');
    if (!token || isJwtExpired(token)) {
      if (token) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
      return null;
    }
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readInitialUser);

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

  useEffect(() => {
    const onApiCleared = () => setUser(null);
    window.addEventListener(AUTH_CLEARED_EVENT, onApiCleared);
    return () => window.removeEventListener(AUTH_CLEARED_EVENT, onApiCleared);
  }, []);

  /** Hết hạn JWT hoặc xóa token: đồng bộ user (tab công khai vẫn xem được, chỉ mất trạng thái đăng nhập). */
  useEffect(() => {
    const sync = () => {
      const t = localStorage.getItem('token');
      if (user && (!t || isJwtExpired(t))) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
      }
    };
    sync();
    const id = setInterval(sync, 30_000);
    const onVis = () => {
      if (document.visibilityState === 'visible') sync();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [user]);

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
