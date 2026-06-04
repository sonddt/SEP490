/** Giờ Việt Nam — đồng bộ với StartTime/EndTime (wall-clock VN) và TimeZoneHelper backend. */

const VN_TZ = 'Asia/Ho_Chi_Minh';

/** Thời điểm hiện tại theo wall-clock VN (dùng so sánh với slot local). */
export function getVnNow() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: VN_TZ }));
}

/** YYYY-MM-DD theo giờ VN. */
export function todayIsoVn() {
  const n = getVnNow();
  const y = n.getFullYear();
  const m = String(n.getMonth() + 1).padStart(2, '0');
  const d = String(n.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Parse thời điểm slot từ API (Unspecified VN) hoặc ISO có Z.
 * @returns {Date|null}
 */
export function parseSlotDateTime(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const s = String(value).trim();
  if (!s) return null;

  if (/[zZ]$|[+-]\d{2}:\d{2}$/.test(s)) {
    const utc = new Date(s);
    if (Number.isNaN(utc.getTime())) return null;
    return new Date(utc.toLocaleString('en-US', { timeZone: VN_TZ }));
  }

  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (m) {
    return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], 0, 0);
  }

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Khung đã qua khi thời điểm kết thúc slot <= hiện tại (giờ VN). */
export function isPastSlotEnd(endTime) {
  const end = parseSlotDateTime(endTime);
  if (!end) return false;
  return end.getTime() <= getVnNow().getTime();
}

/** Lọc danh sách item preview/booking, bỏ khung đã qua. */
export function filterFutureSlotItems(items) {
  if (!Array.isArray(items)) return [];
  return items.filter((item) => !isPastSlotEnd(item.endTime ?? item.end));
}
