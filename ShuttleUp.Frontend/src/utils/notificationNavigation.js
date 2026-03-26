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
  const bid = meta.bookingId;
  if (bid) {
    const id = String(bid);
    return isManager ? `/manager/bookings?bookingId=${id}` : `/user/bookings?bookingId=${id}`;
  }
  return null;
}
