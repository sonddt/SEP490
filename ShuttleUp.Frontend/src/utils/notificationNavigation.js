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
    return meta.deepLink;
  }
  // Manager request notifications
  if (meta.requestId) {
    return isManager ? '/user/manager-info' : '/admin/manager-requests';
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
