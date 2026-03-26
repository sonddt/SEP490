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

/** @param {string} bookingId */
export function submitPayment(bookingId, formData) {
  return axiosClient.post(`/bookings/${bookingId}/payment`, formData);
}

export function getMyBookings() {
  return axiosClient.get('/bookings/my');
}

/** @param {string} bookingId */
export function cancelBooking(bookingId) {
  return axiosClient.patch(`/bookings/${bookingId}/cancel`);
}

/** @param {string} venueId @param {{ amount?: number, addInfo?: string }} [params] */
export function getVenueCheckoutSettings(venueId, params) {
  return axiosClient.get(`/venues/${venueId}/checkout-settings`, { params });
}

/** @param {string} bookingId */
export function getBookingPaymentContext(bookingId) {
  return axiosClient.get(`/bookings/${bookingId}/payment-context`);
}
