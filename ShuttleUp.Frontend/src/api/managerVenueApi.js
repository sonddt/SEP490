import axiosClient from './axiosClient';

/** @param {{ search?: string, page?: number, pageSize?: number }} [params] */
export function getManagedVenues(params) {
  return axiosClient.get('/manager/venues', { params });
}

/** @param {string} venueId @param {{ amount?: number, addInfo?: string }} [params] */
export function getManagerVenueCheckoutSettings(venueId, params) {
  return axiosClient.get(`/manager/venues/${venueId}/checkout-settings`, { params });
}

/** @param {string} venueId @param {object} body */
export function putVenueCheckoutSettings(venueId, body) {
  return axiosClient.put(`/manager/venues/${venueId}/checkout-settings`, body);
}

/** @param {{ bin: string, accountNumber: string }} body */
export function lookupBankAccount(body) {
  return axiosClient.post('/manager/venues/bank-lookup', body);
}

/** @param {string} venueId @param {string} courtId @param {{ from?: string, to?: string }} [params] */
export function getCourtBlocks(venueId, courtId, params) {
  return axiosClient.get(`/manager/venues/${venueId}/courts/${courtId}/blocks`, { params });
}

/** @param {string} venueId @param {string} courtId @param {object} body */
export function createCourtBlock(venueId, courtId, body) {
  return axiosClient.post(`/manager/venues/${venueId}/courts/${courtId}/blocks`, body);
}

/** @param {string} venueId @param {string} courtId @param {string} blockId @param {object} body */
export function updateCourtBlock(venueId, courtId, blockId, body) {
  return axiosClient.put(`/manager/venues/${venueId}/courts/${courtId}/blocks/${blockId}`, body);
}

/** @param {string} venueId @param {string} courtId @param {string} blockId */
export function deleteCourtBlock(venueId, courtId, blockId) {
  return axiosClient.delete(`/manager/venues/${venueId}/courts/${courtId}/blocks/${blockId}`);
}
