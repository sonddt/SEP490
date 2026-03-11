import { Navigate, useLocation } from 'react-router-dom';

const AUTH_TOKEN_KEY = 'token';

/**
 * Chỉ render children khi đã đăng nhập (có token trong localStorage).
 * Nếu chưa đăng nhập → chuyển về /login và lưu returnUrl để sau khi login xong quay lại.
 */
export default function ProtectedRoute({ children }) {
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

  return children;
}
