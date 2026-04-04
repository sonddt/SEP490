import axiosClient from './axiosClient';

/** @param {string} venueId */
export function getVenueCoupons(venueId) {
  return axiosClient.get(`/manager/venues/${venueId}/coupons`);
}

/** @param {string} venueId @param {object} payload */
export function createVenueCoupon(venueId, payload) {
  return axiosClient.post(`/manager/venues/${venueId}/coupons`, payload);
}

/** @param {string} venueId @param {string} couponId @param {object} payload */
export function updateVenueCoupon(venueId, couponId, payload) {
  return axiosClient.put(`/manager/venues/${venueId}/coupons/${couponId}`, payload);
}

/** @param {string} venueId @param {string} couponId */
export function deleteVenueCoupon(venueId, couponId) {
  return axiosClient.delete(`/manager/venues/${venueId}/coupons/${couponId}`);
}
