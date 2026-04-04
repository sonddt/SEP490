import axiosClient from './axiosClient';

/** @param {{ status?: string }} [params] */
export function getManagerRefunds(params) {
  return axiosClient.get('/manager/refunds', { params });
}

/** @param {string} refundId @param {{ confirmed: boolean, reason?: string }} body */
export function reconcileRefund(refundId, body) {
  return axiosClient.patch(`/manager/refunds/${refundId}/reconcile`, body);
}

/** @param {string} refundId @param {{ managerNote?: string }} [body] */
export function completeRefund(refundId, body = {}) {
  return axiosClient.patch(`/manager/refunds/${refundId}/complete`, body);
}

/** @param {string} refundId @param {FormData} formData */
export function uploadRefundEvidence(refundId, formData) {
  return axiosClient.post(`/manager/refunds/${refundId}/upload-evidence`, formData);
}
