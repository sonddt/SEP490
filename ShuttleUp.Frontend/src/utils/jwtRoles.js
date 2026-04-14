/**
 * Đọc claim role từ JWT (phải khớp với token backend phát hành khi đăng nhập).
 * Hỗ trợ key ngắn "role" và claim type đầy đủ của .NET.
 */
const ROLE_CLAIM_URI = 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role';

function normalizeRoleList(value) {
  if (value == null) return [];
  const arr = Array.isArray(value) ? value : [value];
  return arr
    .filter((v) => typeof v === 'string' && v.trim())
    .map((v) => v.trim().toUpperCase());
}

export function getJwtRoles(token) {
  if (!token || typeof token !== 'string') return [];
  const parts = token.split('.');
  if (parts.length < 2) return [];
  try {
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4;
    if (pad) b64 += '='.repeat(4 - pad);
    const payload = JSON.parse(atob(b64));
    const merged = [
      ...normalizeRoleList(payload.role),
      ...normalizeRoleList(payload.roles),
      ...normalizeRoleList(payload[ROLE_CLAIM_URI]),
    ];
    return [...new Set(merged)];
  } catch {
    return [];
  }
}

/** @param {string} token */
/** @param {string} role ví dụ MANAGER */
export function jwtHasRole(token, role) {
  if (!role) return false;
  const need = role.trim().toUpperCase();
  return getJwtRoles(token).includes(need);
}

/** Claim exp (Unix giây). Không có exp → không coi là hết hạn (tránh khóa token lạ). */
export function isJwtExpired(token) {
  if (!token || typeof token !== 'string') return true;
  const parts = token.split('.');
  if (parts.length < 2) return true;
  try {
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4;
    if (pad) b64 += '='.repeat(4 - pad);
    const payload = JSON.parse(atob(b64));
    if (payload.exp == null || typeof payload.exp !== 'number') return false;
    const skewSec = 15;
    return Date.now() / 1000 >= payload.exp - skewSec;
  } catch {
    return true;
  }
}
