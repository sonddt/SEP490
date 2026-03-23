import axiosClient from './axiosClient';

/** @param {{ status?: string }} [params] */
export function getManagerBookings(params) {
  return axiosClient.get('/manager/bookings', { params });
}

/** @param {string} bookingId */
export function patchManagerBookingStatus(bookingId, body) {
  return axiosClient.patch(`/manager/bookings/${bookingId}/status`, body);
}
