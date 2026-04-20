export function normalizeSearchText(s) {
  let str = String(s ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  // Replace common punctuation with space so boundaries are clean
  str = str.replace(/[.,\-]/g, ' ');

  // Strip common administrative words & their abbreviations
  str = str.replace(/\b(thanh pho|tinh|quan|huyen|thi xa|phuong|xa|tp|tx|q|p|h)\b/g, ' ');

  // Common aliases (Standardizing both query and data)
  const cityAliases = {
    'ho chi minh': 'hcm',
    'ha noi': 'hn',
    'da nang': 'dn',
    'hai phong': 'hp',
    'can tho': 'ct',
    'ba ria vung tau': 'brvt',
    'vung tau': 'vt',
    'buon ma thuot': 'bmt',
    'nha trang': 'nt',
    'phan thiet': 'pt',
    'quy nhon': 'qn',
    'da lat': 'dl',
  };

  for (const [full, short] of Object.entries(cityAliases)) {
    const regex = new RegExp(`\\b${full}\\b`, 'g');
    str = str.replace(regex, short);
  }

  // Collapse spaces
  return str.replace(/\s+/g, ' ').trim();
}

/** true if haystack includes query (both normalized). Empty query -> true. */
export function normalizedIncludes(haystack, query) {
  const nq = normalizeSearchText(query);
  if (!nq) return true;
  
  const tokens = nq.split(' ').filter(Boolean);
  const target = normalizeSearchText(haystack);
  
  // Kiểm tra xem tất cả các từ trong từ khóa có xuất hiện trong chuỗi mục tiêu không
  return tokens.every(t => target.includes(t));
}

/** true nếu ít nhất một field khớp (OR). */
export function normalizedIncludesAny(query, fields) {
  const nq = normalizeSearchText(query);
  if (!nq) return true;
  
  const tokens = nq.split(' ').filter(Boolean);
  const arr = Array.isArray(fields) ? fields : [];
  
  // Tìm ít nhất một field thỏa mãn điều kiện "chứa đủ tất cả các token"
  return arr.some((f) => {
    const target = normalizeSearchText(f);
    return tokens.every(t => target.includes(t));
  });
}
