// Cấu hình server từ biến môi trường — không credential literal trong code.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

// Đọc .env thủ công nếu tồn tại (tránh thêm dependency dotenv).
const envPath = path.resolve(process.cwd(), '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined && !line.trimStart().startsWith('#')) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}

export const config = {
  port: Number(process.env.PORT || 3000),
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  sessionTtlMs: 7 * 24 * 60 * 60 * 1000,
  sessionCookieName: 'sid',
};

export const sha256 = (v) => createHash('sha256').update(v).digest('hex');
