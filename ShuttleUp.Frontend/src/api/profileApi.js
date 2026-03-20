import axiosClient from './axiosClient';

export const profileApi = {
  getMe() {
    return axiosClient.get('/profile/me');
  },
  updateMe(data) {
    return axiosClient.put('/profile/me', data);
  },
  uploadAvatar(file) {
    const formData = new FormData();
    formData.append('avatar', file);
    return axiosClient.post('/profile/avatar', formData);
  },
};

