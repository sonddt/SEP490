import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { jwtHasRole, isJwtExpired } from '../../utils/jwtRoles';

const AUTH_TOKEN_KEY = 'token';

/**
 * Chỉ render children khi đã đăng nhập (JWT còn hạn trong localStorage).
 * Hết hạn / không có token → logout + chuyển về /login.
 * requiredRole: kiểm tra trên **JWT** (khớp với [Authorize(Roles=...)] trên API),
 * không chỉ localStorage — tránh vào /manager khi token cũ chỉ có PLAYER.
 */
export default function ProtectedRoute({ children, requiredRole }) {
  const location = useLocation();
  const { logout } = useAuth();

  let token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (token && isJwtExpired(token)) {
    logout();
    token = localStorage.getItem(AUTH_TOKEN_KEY);
  }

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

  // ── Bắt buộc Personalization cho mọi PLAYER đã đăng nhập ──────────────────
  // Kiểm tra TRƯỚC requiredRole để cover cả routes không có requiredRole (VD: /venues)
  if (location.pathname !== '/personalization') {
    try {
      const userData = JSON.parse(localStorage.getItem('user') || '{}');
      const roles = userData?.roles ?? [];
      const isPlayer = roles.some((r) => String(r).toUpperCase() === 'PLAYER');
      const isManagerRoute = location.pathname.startsWith('/manager');
      const isAdminRoute = location.pathname.startsWith('/admin');
      const isPlayerSocialRoute =
        location.pathname.startsWith('/user/social') ||
        /^\/user\/profile\/[0-9a-fA-F-]{36}\/?$/i.test(location.pathname);

      if (isPlayer && !isManagerRoute && !isAdminRoute && !isPlayerSocialRoute) {
        // isPersonalized === false hoặc null/undefined → chưa hoàn thành onboarding
        const notPersonalized =
          userData?.isPersonalized === false ||
          userData?.isPersonalized === null ||
          userData?.isPersonalized === undefined;
        if (notPersonalized) {
          const skipped = sessionStorage.getItem('skippedPersonalization') === 'true';

          if (!skipped) {
            return <Navigate to="/personalization" replace state={{ from: location.pathname }} />;
          }
        }
      }
    } catch {
      // ignore parse error
    }
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
