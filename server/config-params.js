// Tham số vận hành đọc từ bảng Config (màn chỉnh của admin vào ticket 12) — không hardcode trong luồng nghiệp vụ.
import prisma from './db.js';

const DEFAULTS = {
  parkedHoldMs: 3 * 60 * 1000,
  maxRecalls: 2,
  undoWindowMs: 60 * 1000,
};

// Trả về số; thiếu hoặc hỏng thì dùng mặc định hội đồng.
export async function getConfigParam(key) {
  const row = await prisma.config.findUnique({ where: { key } });
  if (!row) return DEFAULTS[key];
  const parsed = Number(row.value);
  return Number.isFinite(parsed) ? parsed : DEFAULTS[key];
}
