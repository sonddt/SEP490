import axios, { CanceledError } from 'axios';
import { AUTH_CLEARED_EVENT } from '../context/AuthContext';
import { isJwtExpired } from '../utils/jwtRoles';

const axiosClient = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5079/api',
});

/** Đường dẫn cần đăng nhập: 401 có Bearer → đẩy về login (tránh kẹt trắng dữ liệu). */
function shouldRedirectToLoginOn401(pathname) {
    return (
        pathname.startsWith('/user') ||
        pathname.startsWith('/manager') ||
        pathname.startsWith('/admin') ||
        pathname.startsWith('/booking') ||
        pathname.startsWith('/matching') ||
        pathname.startsWith('/chat') ||
        pathname.startsWith('/personalization')
    );
}

axiosClient.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        if (isJwtExpired(token)) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.dispatchEvent(new CustomEvent(AUTH_CLEARED_EVENT));
            const path = window.location.pathname;
            if (shouldRedirectToLoginOn401(path)) {
                const ret = encodeURIComponent(path + (window.location.search || ''));
                window.location.replace(`/login?returnTo=${ret}&reason=session`);
            }
            return Promise.reject(new CanceledError('Phiên đăng nhập đã hết hạn.'));
        }
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

axiosClient.interceptors.response.use(
    (response) => response.data,
    (error) => {
        const status = error.response?.status;
        const hadAuth = Boolean(error.config?.headers?.Authorization);

        if (status === 401 && hadAuth) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            const path = window.location.pathname;
            if (shouldRedirectToLoginOn401(path)) {
                const ret = encodeURIComponent(path + (window.location.search || ''));
                window.location.replace(`/login?returnTo=${ret}&reason=session`);
            } else {
                window.dispatchEvent(new CustomEvent(AUTH_CLEARED_EVENT));
            }
        }

        console.error('API Error:', error.response?.data || error.message);
        return Promise.reject(error);
    }
);

export default axiosClient;
