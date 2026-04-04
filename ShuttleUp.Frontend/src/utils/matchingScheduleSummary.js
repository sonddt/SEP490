/** Parse API datetime (UTC) — khớp logic comment matching. */
export function parseSlotDate(d) {
  if (d == null) return new Date(NaN);
  if (d instanceof Date) return d;
  const s = String(d).trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s) && !/[zZ]$/.test(s) && !/[+-]\d{2}:?\d{2}$/.test(s)) {
    return new Date(`${s}Z`);
  }
  return new Date(s);
}

/** VD: thứ sáu, 03/04/2026 — dùng cho tóm tắt lịch. */
export function formatVnLongWeekdayDate(d) {
  if (!d || Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Tóm tắt lịch (tổng quãng + danh sách sân) từ chi tiết post hoặc list post có bookingItems.
 */
export function buildScheduleSummary(post) {
  const sortedBookingItems = [...(post?.bookingItems || [])];
  sortedBookingItems.sort((a, b) => {
    const ta = parseSlotDate(a.startTime).getTime();
    const tb = parseSlotDate(b.startTime).getTime();
    if (Number.isNaN(ta) && Number.isNaN(tb)) return 0;
    if (Number.isNaN(ta)) return 1;
    if (Number.isNaN(tb)) return -1;
    return ta - tb;
  });

  if (sortedBookingItems.length > 0) {
    let minStart = null;
    let maxEnd = null;
    let minTs = Infinity;
    let maxTs = -Infinity;
    for (const item of sortedBookingItems) {
      const s = parseSlotDate(item.startTime);
      const e = parseSlotDate(item.endTime);
      const ts = s.getTime();
      const te = e.getTime();
      if (!Number.isNaN(ts) && ts < minTs) {
        minTs = ts;
        minStart = s;
      }
      if (!Number.isNaN(te) && te > maxTs) {
        maxTs = te;
        maxEnd = e;
      }
    }
    const range =
      minStart && maxEnd
        ? `${formatVnLongWeekdayDate(minStart)} - ${formatVnLongWeekdayDate(maxEnd)}`
        : null;
    const courts = [...new Set(sortedBookingItems.map((i) => i.courtName).filter(Boolean))];
    return { range, courtsText: courts.length ? courts.join(', ') : '—' };
  }

  const playDateStr =
    post?.playDate != null ? formatVnLongWeekdayDate(new Date(post.playDate)) : '';
  let range = null;
  if (playDateStr && post?.playStartTime && post?.playEndTime) {
    range = `${playDateStr}, ${post.playStartTime} – ${post.playEndTime}`;
  } else if (playDateStr) {
    range = playDateStr;
  }
  return {
    range,
    courtsText: post?.courtName || '—',
  };
}
