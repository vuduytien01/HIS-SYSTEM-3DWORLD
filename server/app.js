// Express app: routes auth + phục vụ client (Vite middleware mode khi dev, static khi prod).
import express from 'express';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import prisma from './db.js';
import {
  verifyPassword, createSession, resolveSessionFromCookieHeader,
  setSessionCookie, clearSessionCookie, publicUser,
} from './auth.js';

const CLIENT_DIR = path.resolve(process.cwd(), 'client');

export function createApp({ vite = null, distDir = null } = {}) {
  const app = express();
  app.use(express.json({ limit: '256kb' }));

  // Đính session từ cookie vào req
  app.use(async (req, res, next) => {
    req.session = await resolveSessionFromCookieHeader(req.headers.cookie);
    next();
  });

  app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Thiếu username hoặc mật khẩu' });
    const user = await prisma.user.findUnique({ where: { username: String(username) } });
    if (!user || !user.active) return res.status(401).json({ error: 'Sai tài khoản hoặc mật khẩu' });
    const ok = await verifyPassword(String(password), user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Sai tài khoản hoặc mật khẩu' });
    const { token, expiresAt } = await createSession(user.id);
    setSessionCookie(res, token, expiresAt.getTime() - Date.now());
    res.json({ user: publicUser(user) });
  });

  app.post('/api/auth/logout', async (req, res) => {
    if (req.session) {
      await prisma.session.delete({ where: { id: req.session.id } }).catch(() => {});
    }
    clearSessionCookie(res);
    res.status(204).end();
  });

  app.get('/api/me', (req, res) => {
    if (!req.session) return res.status(401).json({ error: 'Chưa đăng nhập' });
    res.json({ user: publicUser(req.session.user) });
  });

  // Vite middleware phục vụ module JS/CSS khi dev — sau routes API, trước fallback SPA
  if (vite) app.use(vite.middlewares);

  // Trang SPA cho các đường client-side (router client đọc pathname)
  const sendIndex = async (req, res) => {
    if (vite) {
      const raw = readFileSync(path.join(CLIENT_DIR, 'index.html'), 'utf8');
      res.status(200).set({ 'Content-Type': 'text/html' }).send(await vite.transformIndexHtml(req.originalUrl, raw));
    } else if (distDir) {
      res.sendFile(path.join(distDir, 'index.html'));
    } else {
      res.status(500).send('Client chưa được build và không có Vite dev');
    }
  };
  app.get('/', sendIndex);
  app.get('/tv', sendIndex);

  return app;
}
