// Tham số vận hành đọc từ bảng Config (màn chỉnh của admin vào ticket 12) — không hardcode trong luồng nghiệp vụ.
import prisma from './db.js';

const DEFAULTS = {
  parkedHoldMs: 3 * 60 * 1000,
  maxRecalls: 2,
  undoWindowMs: 60 * 1000,
  noShowGraceMs: 15 * 60 * 1000,
  forgotThresholdMultiplier: 1.5,
  forgotThresholdMinMs: 15 * 60 * 1000,
};

// Danh sách lý do override cấu hình được (admin chỉnh ticket 12).
export async function getOverrideReasons() {
  const row = await prisma.config.findUnique({ where: { key: 'overrideReasons' } });
  if (!row) return ['khẩn cấp', 'lỗi nhập', 'bệnh nhân yêu cầu', 'phòng hỏng', 'khác'];
  try {
    return JSON.parse(row.value);
  } catch {
    return ['khẩn cấp', 'lỗi nhập', 'bệnh nhân yêu cầu', 'phòng hỏng', 'khác'];
  }
}

// Trả về số; thiếu hoặc hỏng thì dùng mặc định hội đồng.
export async function getConfigParam(key) {
  const row = await prisma.config.findUnique({ where: { key } });
  if (!row) return DEFAULTS[key];
  const parsed = Number(row.value);
  return Number.isFinite(parsed) ? parsed : DEFAULTS[key];
}
