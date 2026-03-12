import axiosClient from './axiosClient';

/**
 * Đăng ký bằng email + mật khẩu
 * @param {{ email, password, fullName, roles }} data
 */
export function registerEmail(data) {
  return axiosClient.post('/auth/register', {
    email: data.email,
    password: data.password,
    fullName: data.fullName,
    roles: data.roles,
  });
}

/**
 * Đăng nhập bằng email + mật khẩu
 * @param {{ email, password }} data
 */
export function loginEmail(data) {
  return axiosClient.post('/auth/login', {
    email: data.email,
    password: data.password,
  });
}

/**
 * Đăng nhập / đăng ký qua Google ID token
 * @param {{ idToken, roles }} data
 */
export function loginGoogle(data) {
  return axiosClient.post('/auth/google', {
    idToken: data.idToken,
    roles: data.roles ?? ['PLAYER'],
  });
}

/**
 * Yêu cầu gửi email đặt lại mật khẩu
 * @param {string} email
 */
export function forgotPassword(email) {
  return axiosClient.post('/auth/forgot-password', { email });
}

/**
 * Đặt lại mật khẩu bằng token nhận từ link email
 * @param {{ token, newPassword, confirmPassword }} data
 */
export function resetPassword(data) {
  return axiosClient.post('/auth/reset-password', {
    token: data.token,
    newPassword: data.newPassword,
    confirmPassword: data.confirmPassword,
  });
}

/**
 * Đổi mật khẩu khi đã đăng nhập (cần JWT trong header)
 * @param {{ currentPassword, newPassword, confirmPassword }} data
 */
export function changePassword(data) {
  return axiosClient.post('/auth/change-password', {
    currentPassword: data.currentPassword,
    newPassword: data.newPassword,
    confirmPassword: data.confirmPassword,
  });
}
