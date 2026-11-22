// Seed idempotent: ba vai demo + vài bệnh nhân. Mật khẩu demo chỉ từ env DEMO_PASSWORD.
import { hashPassword } from '../server/auth.js';
import prisma from '../server/db.js';

const DEMO_STAFF = [
  { username: 'lexitan', role: 'RECEPTIONIST', displayName: 'Lễ tân demo' },
  { username: 'bacsi', role: 'DOCTOR', displayName: 'Bác sĩ demo' },
  { username: 'admin', role: 'ADMIN', displayName: 'Admin demo' },
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
  console.log('[seed] xong: 3 vai demo, mật khẩu từ DEMO_PASSWORD.');
}

main().finally(() => prisma.$disconnect());
