import axiosClient from './axiosClient';

export function getNotifications(params) {
  return axiosClient.get('/notifications', { params });
}

export function getUnreadCount() {
  return axiosClient.get('/notifications/unread-count');
}

export function markNotificationRead(id) {
  return axiosClient.patch(`/notifications/${id}/read`);
}

export function markAllNotificationsRead() {
  return axiosClient.patch('/notifications/read-all');
}
