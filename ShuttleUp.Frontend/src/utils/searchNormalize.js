/**
 * Chuẩn hóa chuỗi để so khớp tìm kiếm: bỏ dấu tiếng Việt, gộp khoảng trắng, chữ thường.
 * Ví dụ: "ha noi" khớp "Hà Nội", "quan 1" khớp "Quận 1".
 */
export function normalizeSearchText(s) {
  return String(s ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/** true nếu chuỗi đích (sau chuẩn hóa) chứa query (sau chuẩn hóa). Query rỗng → true. */
export function normalizedIncludes(haystack, query) {
  const nq = normalizeSearchText(query);
  if (!nq) return true;
  return normalizeSearchText(haystack).includes(nq);
}

/** true nếu ít nhất một field khớp (OR). */
export function normalizedIncludesAny(query, fields) {
  const nq = normalizeSearchText(query);
  if (!nq) return true;
  const arr = Array.isArray(fields) ? fields : [];
  return arr.some((f) => normalizeSearchText(f).includes(nq));
}
