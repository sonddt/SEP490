/** Chuẩn trình độ tiếng Việt; legacy EN vẫn được map khi hiển thị/lọc. */
export const SKILL_LEVELS = [
  { value: 'Yếu', label: 'Yếu / Mới chơi', legacy: ['beginner'] },
  { value: 'Trung Bình Yếu', label: 'Trung Bình Yếu', legacy: [] },
  { value: 'Trung Bình', label: 'Trung Bình', legacy: ['intermediate'] },
  { value: 'Khá', label: 'Khá', legacy: ['advanced'] },
  { value: 'Bán Chuyên', label: 'Bán Chuyên', legacy: [] },
  { value: 'Chuyên Nghiệp', label: 'Chuyên nghiệp', legacy: ['expert'] },
];

export const SKILL_FILTER_OPTIONS = [
  { value: '', label: 'Tất cả trình độ' },
  ...SKILL_LEVELS.map(({ value, label }) => ({ value, label })),
];

export const SKILL_CREATE_OPTIONS = [
  { value: '', label: 'Không yêu cầu' },
  ...SKILL_LEVELS.map(({ value, label }) => ({ value, label })),
];

export function getSkillLabel(value) {
  if (!value) return null;
  const found = SKILL_LEVELS.find(
    (s) => s.value === value || s.legacy.includes(value),
  );
  return found?.label ?? value;
}
