// Seed idempotent: ba vai demo + vài bệnh nhân. Mật khẩu demo chỉ từ env DEMO_PASSWORD.
// Called by: docker-compose.yml line 38 (node prisma/seed.js)
// No existing file serves this purpose - this is the backup copy
// Data schemas: Reads DEMO_PASSWORD from env, writes User (username, passwordHash, role, displayName) and Room (code, name, kind, capacity) models
// User instruction: "LƯU TOÀN BỘ KẾT QUẢ,ĐÁNH GIÁ,BÁO CÁO, TOÀN BỘ IMPORTANT THING VÀO CHỖ AN TOÀN ĐỂ DỌN %TEMP%"
import { hashPassword } from '../server/auth.js';
import prisma from '../server/db.js';

const DEMO_STAFF = [
  { username: 'lexitan', role: 'RECEPTIONIST', displayName: 'Lễ tân demo' },
  { username: 'bacsi', role: 'DOCTOR', displayName: 'Bác sĩ demo' },
  { username: 'admin', role: 'ADMIN', displayName: 'Admin demo' },
];

// Phòng demo — mã bất biến, khu thu ngân là một phòng (ticket 05).
const DEMO_ROOMS = [
  { code: 'P01', name: 'Phòng khám 1', kind: 'CONSULT' },
  { code: 'P02', name: 'Phòng khám 2', kind: 'CONSULT' },
  { code: 'P03', name: 'Phòng khám 3', kind: 'CONSULT' },
  { code: 'XQ', name: 'X-quang', kind: 'ANCILLARY' },
  { code: 'TN', name: 'Khu thu ngân', kind: 'CASHIER' },
];

async function main() {
  const password = process.env.DEMO_PASSWORD;
  if (!password) {
    console.error('[seed] Thiếu DEMO_PASSWORD trong .env — seed không tạo tài khoản demo.');
    process.exitCode = 1;
    return;
  }
  const hash = await hashPassword(password);
  for (const s of DEMO_STAFF) {
    await prisma.user.upsert({
      where: { username: s.username },
      update: { passwordHash: hash, role: s.role, displayName: s.displayName },
      create: { username: s.username, passwordHash: hash, role: s.role, displayName: s.displayName },
    });
  }
  for (const r of DEMO_ROOMS) {
    await prisma.room.upsert({
      where: { code: r.code },
      update: { name: r.name, kind: r.kind },
      create: { ...r, capacity: 1 },
    });
  }
  console.log('[seed] xong: 3 vai demo + 5 phòng demo, mật khẩu từ DEMO_PASSWORD.');
}

main().finally(() => prisma.$disconnect());