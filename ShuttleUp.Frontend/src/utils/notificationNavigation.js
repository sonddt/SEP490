const MANAGER_PROFILE_PATH = '/user/profile/manager-info';

/** Chuẩn hóa deepLink cũ / sai route. */
function normalizeDeepLink(path) {
  if (!path || typeof path !== 'string') return path;
  if (path === '/user/manager-info' || path === '/profile/manager-info') {
    return MANAGER_PROFILE_PATH;
  }
  return path;
}

/**
 * @param {string | null | undefined} metadataJson
 * @param {boolean} isManager
 * @returns {string | null} path nội bộ (React Router)
 */
export function getNotificationTargetPath(metadataJson, isManager) {
  let meta = {};
  if (metadataJson && typeof metadataJson === 'string') {
    try {
      meta = JSON.parse(metadataJson);
    } catch {
      return null;
    }
  }
  if (meta.deepLink && typeof meta.deepLink === 'string' && meta.deepLink.startsWith('/')) {
    return normalizeDeepLink(meta.deepLink);
  }
  // Manager request notifications (friend request cũng có requestId — ưu tiên deepLink ở trên)
  if (meta.requestId && !meta.fromUserId && !meta.postId) {
    return isManager ? MANAGER_PROFILE_PATH : '/admin/manager-requests';
  }
  if (meta.postId != null && meta.postId !== '') {
    return `/matching/${meta.postId}`;
  }
  if (meta.fromUserId) {
    return `/user/profile/${meta.fromUserId}`;
  }
  if (meta.friendUserId) {
    return `/user/profile/${meta.friendUserId}`;
  }
  if (meta.venueId != null && meta.venueId !== '') {
    return `/venue-details/${String(meta.venueId)}#reviews`;
  }
  const bid = meta.bookingId;
  if (bid) {
    const id = String(bid);
    return isManager ? `/manager/bookings?bookingId=${id}` : `/user/bookings?bookingId=${id}`;
  }
  return null;
}
