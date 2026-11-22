// Trường chuẩn bệnh nhân dùng chung các form — một nguồn cho từ vựng giới tính (giá trị khớp enum Gender của Prisma).
export const GENDER_OPTIONS = [
  { value: 'male', label: 'Nam' },
  { value: 'female', label: 'Nữ' },
  { value: 'other', label: 'Khác' },
  { value: 'unknown', label: 'Không khai' },
];

export function genderOptionsHtml() {
  return GENDER_OPTIONS.map((g) => `<option value="${g.value}">${g.label}</option>`).join('');
}
