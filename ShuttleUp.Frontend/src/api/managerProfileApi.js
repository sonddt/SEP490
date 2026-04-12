import axiosClient from './axiosClient';

export const managerProfileApi = {
  getMe() {
    return axiosClient.get('/manager-profile/me');
  },
  updateMe({ taxCode, address, cccdFrontFile, cccdBackFile, businessLicenseFiles, retainedLicenseIds, licensesDirty }) {
    const formData = new FormData();
    formData.append('taxCode', taxCode ?? '');
    formData.append('address', address ?? '');

    if (cccdFrontFile) formData.append('cccdFrontFile', cccdFrontFile);
    if (cccdBackFile) formData.append('cccdBackFile', cccdBackFile);

    (businessLicenseFiles ?? []).forEach((f) => {
      if (f) formData.append('businessLicenseFiles', f);
    });

    // CHỈ gửi retainedLicenseIds khi user thực sự thay đổi danh sách giấy phép
    // (upload file mới HOẶC xóa file cũ). Nếu không gửi field này,
    // backend sẽ giữ nguyên 3 slot hiện tại, không xóa gì cả.
    if (licensesDirty) {
      formData.append('retainedLicenseIds', retainedLicenseIds ?? '');
    }

    return axiosClient.put('/manager-profile/me', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  }
};

