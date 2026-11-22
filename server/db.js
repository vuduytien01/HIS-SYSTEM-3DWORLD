// Prisma client singleton cho SQLite dev (connection_limit=1 + WAL theo nghiên cứu).
// Import config.js trước để .env được nạp trước khi Prisma đọc DATABASE_URL.
import './config.js';
import { PrismaClient } from '@prisma/client';

// SQLite: một connection duy nhất tránh SQLITE_BUSY khi nhiều thao tác đồng thời.
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
  log: process.env.PRISMA_LOG === 'true' ? ['query'] : [],
});

export default prisma;
