import axiosClient from './axiosClient';

export const managerProfileApi = {
  getMe() {
    return axiosClient.get('/manager-profile/me');
  },
  updateMe({ taxCode, address, cccdFrontFile, cccdBackFile, businessLicenseFiles }) {
    const formData = new FormData();
    formData.append('taxCode', taxCode ?? '');
    formData.append('address', address ?? '');

    if (cccdFrontFile) formData.append('cccdFrontFile', cccdFrontFile);
    if (cccdBackFile) formData.append('cccdBackFile', cccdBackFile);

    (businessLicenseFiles ?? []).forEach((f) => {
      if (f) formData.append('businessLicenseFiles', f);
    });

    return axiosClient.put('/manager-profile/me', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  }
};

