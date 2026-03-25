import axiosClient from './axiosClient';

const favoritesApi = {
  getMyFavorites: () => axiosClient.get('/favorites'),
  addFavorite: (venueId) => axiosClient.post(`/favorites/${venueId}`),
  removeFavorite: (venueId) => axiosClient.delete(`/favorites/${venueId}`),
};

export default favoritesApi;

