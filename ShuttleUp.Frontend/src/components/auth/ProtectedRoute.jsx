import { Navigate, useLocation } from 'react-router-dom';

const AUTH_TOKEN_KEY = 'token';

/**
 * Chỉ render children khi đã đăng nhập (có token trong localStorage).
 * Nếu chưa đăng nhập → chuyển về /login.
 * Nếu có requiredRole nhưng user không có role đó → chuyển về trang chủ.
 */
export default function ProtectedRoute({ children, requiredRole }) {
  const location = useLocation();
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  const isLoggedIn = !!token;

  if (!isLoggedIn) {
    return (
      <Navigate
        to="/login"
        state={{ from: location.pathname + (location.search || '') }}
        replace
      />
    );
  }

  if (requiredRole) {
    try {
      const userData = JSON.parse(localStorage.getItem('user') || '{}');
      const roles = userData?.roles ?? [];
      if (!roles.includes(requiredRole)) {
        return <Navigate to="/" replace />;
      }
    } catch {
      return <Navigate to="/" replace />;
    }
  }

  return children;
}
