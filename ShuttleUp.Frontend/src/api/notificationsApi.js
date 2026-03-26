import axiosClient from './axiosClient';

/**
 * @param {{ take?: number, before?: string }} params before = nextBefore (ISO) từ lần gọi trước
 * @returns {Promise<{ items: any[], hasMore: boolean, nextBefore: string | null }>}
 */
export async function getNotifications(params) {
  // axiosClient interceptor đã trả về body JSON (response.data), không bọc thêm lớp .data
  const res = await axiosClient.get('/notifications', { params });
  if (Array.isArray(res)) {
    return { items: res, hasMore: false, nextBefore: null };
  }
  return {
    items: res?.items ?? [],
    hasMore: !!res?.hasMore,
    nextBefore: res?.nextBefore ?? null,
  };
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

export function deleteNotification(id) {
  return axiosClient.delete(`/notifications/${id}`);
}
