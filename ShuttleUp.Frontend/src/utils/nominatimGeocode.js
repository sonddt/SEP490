/**
 * Geocode địa chỉ qua Nominatim (OSM). Tuân thủ rate limit; cache sessionStorage.
 * https://operations.osmfoundation.org/policies/nominatim/
 */

const CACHE_PREFIX = 'shuttleup_nom_';
const MIN_INTERVAL_MS = 1100;

let lastRequestAt = 0;

function cacheKey(query) {
  const h = query.trim().toLowerCase();
  if (h.length > 200) return CACHE_PREFIX + h.slice(0, 200);
  return CACHE_PREFIX + h;
}

/**
 * @param {string} query
 * @returns {Promise<{ lat: number, lng: number } | null>}
 */
export async function geocodeAddressQuery(query) {
  const q = (query || '').trim();
  if (!q) return null;

  const key = cacheKey(q);
  try {
    const raw = sessionStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        typeof parsed.lat === 'number' &&
        typeof parsed.lng === 'number'
      ) {
        return parsed;
      }
    }
  } catch {
    /* ignore */
  }

  const now = Date.now();
  const wait = MIN_INTERVAL_MS - (now - lastRequestAt);
  if (wait > 0) {
    await new Promise((r) => setTimeout(r, wait));
  }
  lastRequestAt = Date.now();

  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'vi,en',
    },
  });

  if (!res.ok) return null;

  const data = await res.json();
  const first = Array.isArray(data) ? data[0] : null;
  if (!first) return null;

  const lat = parseFloat(first.lat);
  const lng = parseFloat(first.lon ?? first.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const out = { lat, lng };
  try {
    sessionStorage.setItem(key, JSON.stringify(out));
  } catch {
    /* quota */
  }
  return out;
}

export function buildProfileAddressQuery(parts) {
  if (!parts) return '';
  const a = parts.address ?? parts.Address;
  const dRaw = parts.district ?? parts.District;
  const d =
    typeof dRaw === 'string' ? dRaw.split('|||').join(', ').trim() : dRaw;
  const p = parts.province ?? parts.Province;
  const segs = [a, d, p]
    .map((x) => (x == null ? '' : String(x).trim()))
    .filter(Boolean);
  if (segs.length === 0) return '';
  return `${segs.join(', ')}, Việt Nam`;
}

/**
 * Reverse geocode tọa độ → địa danh (display_name). Cache + cùng rate limit với search.
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<string | null>}
 */
export async function reverseGeocodeLatLng(lat, lng) {
  const la = Number(lat);
  const lo = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return null;

  const key = `${CACHE_PREFIX}rev_${la.toFixed(5)}_${lo.toFixed(5)}`;
  try {
    const raw = sessionStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed?.displayName === 'string' && parsed.displayName) {
        return parsed.displayName;
      }
    }
  } catch {
    /* ignore */
  }

  const now = Date.now();
  const wait = MIN_INTERVAL_MS - (now - lastRequestAt);
  if (wait > 0) {
    await new Promise((r) => setTimeout(r, wait));
  }
  lastRequestAt = Date.now();

  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(la)}&lon=${encodeURIComponent(lo)}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'vi,en',
    },
  });

  if (!res.ok) return null;

  const data = await res.json();
  const name =
    typeof data?.display_name === 'string' ? data.display_name.trim() : '';
  if (!name) return null;

  try {
    sessionStorage.setItem(key, JSON.stringify({ displayName: name }));
  } catch {
    /* quota */
  }
  return name;
}
