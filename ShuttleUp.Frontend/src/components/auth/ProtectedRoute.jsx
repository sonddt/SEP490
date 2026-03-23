import { Navigate, useLocation } from 'react-router-dom';
import { jwtHasRole } from '../../utils/jwtRoles';

const AUTH_TOKEN_KEY = 'token';

/**
 * Chỉ render children khi đã đăng nhập (có token trong localStorage).
 * Nếu chưa đăng nhập → chuyển về /login.
 * requiredRole: kiểm tra trên **JWT** (khớp với [Authorize(Roles=...)] trên API),
 * không chỉ localStorage — tránh vào /manager khi token cũ chỉ có PLAYER.
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
      const need = String(requiredRole).toUpperCase();
      const storageOk = roles.some((r) => String(r).toUpperCase() === need);
      const tokenOk = jwtHasRole(token, requiredRole);

      if (!tokenOk) {
        if (storageOk) {
          return (
            <Navigate
              to="/login"
              replace
              state={{
                from: location.pathname + (location.search || ''),
                authHint:
                  'Quyền trên tài khoản đã đổi hoặc phiên đăng nhập cũ. Vui lòng đăng nhập lại để tải token mới (có role MANAGER/ADMIN).',
              }}
            />
          );
        }
        return <Navigate to="/" replace />;
      }
    } catch {
      return <Navigate to="/" replace />;
    }
  }

  return children;
}
