import axiosClient from './axiosClient';

const matchingApi = {
  // ── Posts ──────────────────────────────────────────────
  getPosts: (params) => axiosClient.get('/matching/posts', { params }),
  getMyPosts: () => axiosClient.get('/matching/posts/my'),
  getPostDetail: (id) => axiosClient.get(`/matching/posts/${id}`),
  createPost: (data) => axiosClient.post('/matching/posts', data),
  updatePost: (id, data) => axiosClient.put(`/matching/posts/${id}`, data),
  closePost: (id) => axiosClient.post(`/matching/posts/${id}/close`),
  reopenPost: (id) => axiosClient.post(`/matching/posts/${id}/reopen`),

  // ── Join / Leave ──────────────────────────────────────
  joinPost: (id, data) => axiosClient.post(`/matching/posts/${id}/join`, data || {}),
  cancelJoin: (id) => axiosClient.delete(`/matching/posts/${id}/join`),
  acceptRequest: (requestId) => axiosClient.post(`/matching/join-requests/${requestId}/accept`),
  rejectRequest: (requestId, data) => axiosClient.post(`/matching/join-requests/${requestId}/reject`, data || {}),
  removeMember: (memberId) => axiosClient.delete(`/matching/members/${memberId}`),

  // ── Comments (FB-style) ───────────────────────────────
  getComments: (postId, params) => axiosClient.get(`/matching/posts/${postId}/comments`, { params }),
  postComment: (postId, data) => axiosClient.post(`/matching/posts/${postId}/comments`, data),
  patchComment: (postId, commentId, data) =>
    axiosClient.patch(`/matching/posts/${postId}/comments/${commentId}`, data),
  deleteComment: (postId, commentId) =>
    axiosClient.delete(`/matching/posts/${postId}/comments/${commentId}`),

  // ── Bookings (for Create flow) ────────────────────────
  getUpcomingBookings: () => axiosClient.get('/matching/bookings'),
};

export default matchingApi;
