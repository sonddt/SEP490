import axiosClient from './axiosClient';

export const managerProfileApi = {
  getMe() {
    return axiosClient.get('/manager-profile/me');
  },
  updateMe(data) {
    return axiosClient.put('/manager-profile/me', data);
  },
};

