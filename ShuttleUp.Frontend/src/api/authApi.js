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
