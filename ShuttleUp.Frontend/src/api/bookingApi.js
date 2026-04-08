import axiosClient from './axiosClient';

export function getVenueCourts(venueId) {
  return axiosClient.get(`/venues/${venueId}/courts`);
}

export function getVenueAvailability(venueId, date) {
  return axiosClient.get(`/venues/${venueId}/availability`, { params: { date } });
}

export function createBooking(payload) {
  return axiosClient.post('/bookings', payload);
}

export function previewLongTermBooking(payload) {
  return axiosClient.post('/bookings/long-term/preview', payload);
}

export function createLongTermBooking(payload) {
  return axiosClient.post('/bookings/long-term', payload);
}

export function previewLongTermFlexible(payload) {
  return axiosClient.post('/bookings/long-term/flexible/preview', payload);
}

export function createLongTermFlexible(payload) {
  return axiosClient.post('/bookings/long-term/flexible', payload);
}

/** @param {string} bookingId */
export function submitPayment(bookingId, formData) {
  return axiosClient.post(`/bookings/${bookingId}/payment`, formData);
}

export function getMyBookings() {
  return axiosClient.get('/bookings/my');
}

/** @param {string} bookingId */
export function getCancelPreview(bookingId) {
  return axiosClient.get(`/bookings/${bookingId}/cancel-preview`);
}

/** @param {string} bookingId @param {object} [body] */
export function cancelBooking(bookingId, body = {}) {
  return axiosClient.patch(`/bookings/${bookingId}/cancel`, body);
}

/** @param {string} bookingId @param {object} bankInfo */
export function updateRefundBankInfo(bookingId, bankInfo) {
  return axiosClient.patch(`/bookings/${bookingId}/refund-bank-info`, bankInfo);
}

/** @param {string} venueId @param {{ amount?: number, addInfo?: string }} [params] */
export function getVenueCheckoutSettings(venueId, params) {
  return axiosClient.get(`/venues/${venueId}/checkout-settings`, { params });
}

/** @param {string} bookingId */
export function getBookingPaymentContext(bookingId) {
  return axiosClient.get(`/bookings/${bookingId}/payment-context`);
}

/** 
 * @param {object} payload 
 * { venueId, baseAmount, daysDuration, couponCode }
 */
export function previewDiscount(payload) {
  return axiosClient.post('/bookings/preview-discount', payload);
}

/** @param {string} bookingId — Cancel a HOLDING booking immediately */
export function cancelHold(bookingId) {
  return axiosClient.post(`/bookings/${bookingId}/cancel-hold`);
}
