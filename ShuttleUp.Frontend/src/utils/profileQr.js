/** Trích userId từ URL / chuỗi QR (full URL hoặc chỉ path). */
export function getProfileUserIdFromDecodedQr(text) {
  const m = String(text || '').match(/\/user\/profile\/([0-9a-fA-F-]{36})(?:\/?|$)/);
  return m ? m[1] : null;
}

export function getPublicAppBaseUrl() {
  const raw = import.meta.env.VITE_PUBLIC_APP_URL;
  if (raw && String(raw).trim()) {
    return String(raw).trim().replace(/\/$/, '');
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/$/, '');
  }
  return '';
}

export function buildProfileShareUrl(userId) {
  const base = getPublicAppBaseUrl();
  if (!base || !userId) return '';
  return `${base}/user/profile/${userId}`;
}
