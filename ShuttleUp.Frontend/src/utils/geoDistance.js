/**
 * Chuẩn hóa cặp lat/lng (số). Sửa lỗi phổ biến: cột Lat/Lng trong DB bị đảo
 * (vĩ độ VN ~8–24, kinh độ ~102–110).
 */
export function normalizeLatLngPair(lat, lng) {
  let la = Number(lat);
  let lo = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return null;

  if (Math.abs(la) > 90 && Math.abs(lo) <= 90) {
    [la, lo] = [lo, la];
  } else if (la > 25 && la <= 130 && lo >= 8 && lo <= 25) {
    [la, lo] = [lo, la];
  }

  if (Math.abs(la) > 90 || Math.abs(lo) > 180) return null;
  return { lat: la, lng: lo };
}

/** Khoảng cách Haversine giữa hai điểm (độ), trả về km (luôn ≥ 0 khi hợp lệ) */
export function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  let a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  a = Math.min(1, Math.max(0, a));
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  const km = R * c;
  if (!Number.isFinite(km)) return NaN;
  return Math.max(0, km);
}

/** Trả về km hoặc null nếu thiếu tọa độ hợp lệ */
export function distanceToVenueKm(refLat, refLng, venueLat, venueLng) {
  if (refLat == null || refLng == null) return null;
  const ref = normalizeLatLngPair(refLat, refLng);
  const venue = normalizeLatLngPair(venueLat, venueLng);
  if (!ref || !venue) return null;
  const km = haversineKm(ref.lat, ref.lng, venue.lat, venue.lng);
  return Number.isFinite(km) ? km : null;
}
