import axiosClient from './axiosClient';

export const profileApi = {
  getMe() {
    return axiosClient.get('/profile/me');
  },
  getPublic(userId) {
    return axiosClient.get(`/profile/${userId}`);
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

