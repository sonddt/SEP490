import axiosClient from './axiosClient';

/** @param {{ search?: string, page?: number, pageSize?: number }} [params] */
export function getManagedVenues(params) {
  return axiosClient.get('/manager/venues', { params });
}

/** @param {string} venueId @param {object} body */
export function putVenueCheckoutSettings(venueId, body) {
  return axiosClient.put(`/manager/venues/${venueId}/checkout-settings`, body);
}

/** @param {{ bin: string, accountNumber: string }} body */
export function lookupBankAccount(body) {
  return axiosClient.post('/manager/venues/bank-lookup', body);
}
