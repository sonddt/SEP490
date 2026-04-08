import axios, { CanceledError } from 'axios';
import { AUTH_CLEARED_EVENT } from '../context/AuthContext';
import { isJwtExpired } from '../utils/jwtRoles';
import { notifyError } from '../hooks/useNotification';

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
        pathname.startsWith('/personalization') ||
        pathname.startsWith('/venue-details')
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

function extractErrorMessage(error) {
    const body = error.response?.data;
    if (typeof body === 'string' && body.length < 300) return body;
    if (body?.message) return body.message;
    if (body?.title) return body.title;
    if (Array.isArray(body?.errors) && body.errors.length) return body.errors.join(' ');
    return null;
}

axiosClient.interceptors.response.use(
    (response) => response.data,
    (error) => {
        if (error instanceof CanceledError) return Promise.reject(error);

        const status = error.response?.status;
        const hadAuth = Boolean(error.config?.headers?.Authorization);
        const silenced = error.config?._silenceToast === true;

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

        if (!silenced && [400, 401, 403, 500].includes(status)) {
            const msg = extractErrorMessage(error);
            if (msg) {
                notifyError(msg);
            } else if (status === 403) {
                notifyError('Bạn không có quyền thực hiện thao tác này.');
            } else if (status === 500) {
                notifyError('Lỗi hệ thống. Vui lòng thử lại sau.');
            }
        }

        console.error('API Error:', error.response?.data || error.message);
        return Promise.reject(error);
    }
);

export default axiosClient;
