// Session cookie httpOnly + bcrypt — auth ba vai (ticket 01).
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { config, sha256 } from './config.js';
import prisma from './db.js';

export async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

export async function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

export async function createSession(userId) {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + config.sessionTtlMs);
  await prisma.session.create({
    data: {
      tokenHash: sha256(token),
      userId,
      expiresAt,
    },
  });
  return { token, expiresAt };
}

export async function resolveSession(token) {
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: true },
  });
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  if (!session.user.active) return null;
  return session;
}

export function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i === -1) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function setSessionCookie(res, token, maxAgeMs) {
  const flags = [
    `${config.sessionCookieName}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(maxAgeMs / 1000)}`,
  ];
  if (config.cookieSecure) flags.push('Secure');
  res.setHeader('Set-Cookie', flags.join('; '));
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${config.sessionCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

export function publicUser(user) {
  return { id: user.id, username: user.username, role: user.role, displayName: user.displayName };
}
