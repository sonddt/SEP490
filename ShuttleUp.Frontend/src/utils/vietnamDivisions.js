/**
 * Địa giới VN — dữ liệu tĩnh từ https://provinces.open-api.vn/api/v1/?depth=3
 * (đã rút gọn trường trong src/data/vn-divisions.json).
 * Cấu trúc: [{ c, n, d: [{ c, n, pc, w: [{ c, n, dc }] }] }]
 */

const DISTRICT_SPLIT = '|||';

import { normalizeSearchText } from './searchNormalize';

let treePromise = null;

export function loadVietnamDivisionTree() {
  if (!treePromise) {
    treePromise = import('../data/vn-divisions.json').then((m) => m.default);
  }
  return treePromise;
}

/** Khớp tên địa phương (đồng bộ với tìm kiếm không dấu). */
export function normalizeKey(s) {
  return normalizeSearchText(s);
}

function stripAdminPrefix(s) {
  return String(s || '')
    .replace(/^(Quận|Huyện|Thị xã|Thành phố|TX\.|TP\.)\s+/i, '')
    .trim();
}

export function provinceByCode(tree, code) {
  const k = String(code);
  return tree.find((p) => String(p.c) === k) ?? null;
}

export function districtByCode(tree, provinceCode, districtCode) {
  const prov = provinceByCode(tree, provinceCode);
  if (!prov) return null;
  const dk = String(districtCode);
  return (prov.d || []).find((x) => String(x.c) === dk) ?? null;
}

function provinceNameMatch(p, name) {
  const a = normalizeKey(p.n);
  const b = normalizeKey(name);
  if (!b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

/**
 * Tìm tỉnh/TP trong cây theo tên hiển thị (khớp lỏng, dùng cho form gõ tên ngắn gọn).
 */
export function findProvinceByDisplayName(tree, provinceName) {
  if (!tree?.length) return null;
  return (
    tree.find((p) => provinceNameMatch(p, provinceName)) ??
    tree.find((p) => normalizeKey(p.n) === normalizeKey(provinceName)) ??
    null
  );
}

/** Danh sách tên quận/huyện (theo `d.n` trong JSON) cho một tỉnh */
export function listDistrictNamesForProvince(tree, provinceName) {
  const prov = findProvinceByDisplayName(tree, provinceName);
  const list = (prov?.d || []).map((d) => d.n).filter(Boolean);
  return [...list].sort((a, b) => a.localeCompare(b, 'vi'));
}

function districtNameMatch(d, name) {
  const a = normalizeKey(d.n);
  const b = normalizeKey(name);
  const b2 = normalizeKey(stripAdminPrefix(name));
  const a2 = normalizeKey(stripAdminPrefix(d.n));
  return a === b || a2 === b2 || a.includes(b2) || b.includes(a2);
}

/**
 * Tách trường district đã lưu: "Phường X|||Quận Y" hoặc legacy chỉ tên quận.
 */
export function parseStoredDistrictField(districtStr) {
  const raw = String(districtStr || '').trim();
  return { districtName: raw };
}

/** Lưu DB: giờ chỉ còn lưu tên Phường/Xã (vào trường district của DB) */
export function formatDistrictForStorage(districtName) {
  return String(districtName || '').trim();
}

/** Hiển thị (không dùng delimiter thô) */
export function formatDistrictForDisplay(districtStr) {
  return String(districtStr || '').trim();
}

/**
 * Gán mã từ tên đã lưu (khi mở form).
 * @returns {{ provinceCode: string, districtCode: string }}
 */
export function resolveCodesFromProfile(tree, provinceName, districtField) {
  const out = { provinceCode: '', districtCode: '' };
  if (!tree?.length) return out;

  const { districtName } = parseStoredDistrictField(districtField);
  const prov =
    tree.find((p) => provinceNameMatch(p, provinceName)) ??
    tree.find((p) => normalizeKey(p.n) === normalizeKey(provinceName));

  if (!prov) return out;
  out.provinceCode = String(prov.c);

  if (!districtName) return out;
  const dist = (prov.d || []).find((d) => districtNameMatch(d, districtName));
  if (!dist) return out;
  out.districtCode = String(dist.c);

  return out;
}

/** Tên gửi API từ mã */
export function namesFromCodes(tree, pCode, dCode) {
  const p = provinceByCode(tree, pCode);
  const d = districtByCode(tree, pCode, dCode);
  return {
    province: p?.n ?? '',
    district: formatDistrictForStorage(d?.n),
    districtOnly: d?.n ?? '',
    };
}
