// Test tích hợp qua seam server (REST + Socket.io) — mẫu cho mọi ticket sau.
// DB test riêng (test.db), user tạo trực tiếp qua prisma, mật khẩu ngẫu nhiên — không literal credential.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { io } from 'socket.io-client';

process.env.DATABASE_URL = 'file:./prisma/test.db';
process.env.NODE_ENV = 'test';
process.env.PRISMA_PROVIDER = 'sqlite';

let prisma;
let server;
let baseUrl;
let staffUser;
let staffPassword;
let wrongPassword;
let sessionToken;

beforeAll(async () => {
  const { execSync } = await import('node:child_process');
  execSync('npx prisma db push', {
    stdio: 'pipe',
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
  });
  ({ default: prisma } = await import('../server/db.js'));
  const { createApp } = await import('../server/app.js');

  const app = createApp();
  server = http.createServer(app);
  const { createIo } = await import('../server/sockets.js');
  createIo(server);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  staffPassword = randomUUID();
  wrongPassword = randomUUID();
  staffUser = await prisma.user.create({
    data: {
      username: `t_${randomUUID().slice(0, 8)}`,
      passwordHash: await bcrypt.hash(staffPassword, 4),
      role: 'RECEPTIONIST',
      displayName: 'Lễ tân test',
    },
  });
});

afterAll(async () => {
  server.close();
  await prisma.$disconnect();
});

function connectSocket(token) {
  const headers = token ? { cookie: `sid=${token}` } : {};
  return io(baseUrl, { extraHeaders: headers, transports: ['websocket'] });
}

function waitForHello(socket) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Không nhận được hello trong 5s')), 5000);
    socket.on('hello', (msg) => { clearTimeout(t); resolve(msg); });
    socket.on('connect_error', (e) => { clearTimeout(t); reject(e); });
  });
}

describe('Auth qua seam server', () => {
  it('sai mật khẩu bị từ chối 401', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: staffUser.username, password: wrongPassword }),
    });
    expect(res.status).toBe(401);
  });

  it('đúng mật khẩu nhận cookie httpOnly + /api/me hoạt động', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: staffUser.username, password: staffPassword }),
    });
    expect(res.status).toBe(200);
    const cookie = res.headers.get('set-cookie');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('sid=');
    sessionToken = cookie.match(/sid=([^;]+)/)[1];

    const me = await fetch(`${baseUrl}/api/me`, { headers: { cookie: `sid=${sessionToken}` } });
    expect(me.status).toBe(200);
    expect((await me.json()).user.id).toBe(staffUser.id);

    const noCookie = await fetch(`${baseUrl}/api/me`);
    expect(noCookie.status).toBe(401);
  });
});

describe('Socket qua seam server', () => {
  it('kết nối không đăng nhập → hello user null', async () => {
    const socket = connectSocket(null);
    const msg = await waitForHello(socket);
    expect(msg.user).toBeNull();
    socket.close();
  });

  it('kết nối có session → hello kèm vai', async () => {
    const socket = connectSocket(sessionToken);
    const msg = await waitForHello(socket);
    expect(msg.user?.username).toBe(staffUser.username);
    expect(msg.user?.role).toBe('RECEPTIONIST');
    socket.close();
  });
});
