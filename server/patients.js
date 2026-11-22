// Bệnh nhân: validation ở ranh giới API + khớp hồ sơ theo CCCD (định danh chính).
const GENDERS = new Set(['male', 'female', 'other', 'unknown']);

// Gấp tên về không dấu chữ thường — tìm kiếm tiếng Việt gõ không dấu vẫn khớp.
export function foldName(name) {
  return String(name ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

export function parsePatientInput(body = {}) {
  const fullName = String(body.fullName ?? '').trim();
  const dob = String(body.dob ?? '').trim();
  const gender = String(body.gender ?? '').trim();
  const nationalId = String(body.nationalId ?? '').trim();
  const medicalRecordNo = String(body.medicalRecordNo ?? '').trim();
  const insuranceNo = String(body.insuranceNo ?? '').trim();
  const phone = String(body.phone ?? '').trim();

  if (!fullName) return { error: 'Thiếu họ tên' };
  if (!dob || Number.isNaN(new Date(dob).getTime())) return { error: 'Ngày sinh không hợp lệ' };
  if (!GENDERS.has(gender)) return { error: 'Giới tính không hợp lệ (male|female|other|unknown)' };
  if (!nationalId) return { error: 'Thiếu CCCD' };
  if (!/^[+\d][\d\s-]{7,18}$/.test(phone)) return { error: 'Số điện thoại không hợp lệ' };

  return {
    data: {
      fullName,
      searchName: foldName(fullName),
      dob: new Date(dob),
      gender,
      nationalId,
      medicalRecordNo: medicalRecordNo || null,
      insuranceNo: insuranceNo || null,
      phone,
    },
  };
}

// Khớp hồ sơ theo CCCD; chưa có thì tạo mới. Gọi trong transaction cùng Appointment.
export async function findOrCreatePatient(tx, data) {
  const existing = await tx.patient.findUnique({ where: { nationalId: data.nationalId } });
  if (existing) return { patient: existing, created: false };
  const patient = await tx.patient.create({ data });
  return { patient, created: true };
}

export function publicPatient(p) {
  return {
    id: p.id,
    fullName: p.fullName,
    dob: p.dob instanceof Date ? p.dob.toISOString() : p.dob,
    gender: p.gender,
    nationalId: p.nationalId,
    medicalRecordNo: p.medicalRecordNo,
    insuranceNo: p.insuranceNo,
    phone: p.phone,
  };
}
