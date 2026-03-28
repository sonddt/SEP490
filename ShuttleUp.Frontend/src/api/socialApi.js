import axiosClient from './axiosClient';

const socialApi = {
  getPrivacy: () => axiosClient.get('/social/privacy'),
  putPrivacy: (body) => axiosClient.put('/social/privacy', body),
  searchExact: (query) => axiosClient.get('/social/users/search/exact', { params: { query } }),
  searchName: (q, take = 20) => axiosClient.get('/social/users/search/name', { params: { q, take } }),
  sendFriendRequest: (toUserId) => axiosClient.post('/social/friend-requests', { toUserId }),
  cancelSentRequest: (toUserId) => axiosClient.delete(`/social/friend-requests/sent/${toUserId}`),
  acceptRequest: (requestId) => axiosClient.post(`/social/friend-requests/${requestId}/accept`),
  declineRequest: (requestId) => axiosClient.post(`/social/friend-requests/${requestId}/decline`),
  incomingRequests: () => axiosClient.get('/social/friend-requests/incoming'),
  sentRequests: () => axiosClient.get('/social/friend-requests/sent'),
  getFriends: () => axiosClient.get('/social/friends'),
  unfriend: (userId) => axiosClient.delete(`/social/friends/${userId}`),
  block: (blockedUserId) => axiosClient.post('/social/blocks', { blockedUserId }),
  unblock: (userId) => axiosClient.delete(`/social/blocks/${userId}`),
  getRelationship: (otherUserId) => axiosClient.get(`/social/relationship/${otherUserId}`),
};

export default socialApi;
