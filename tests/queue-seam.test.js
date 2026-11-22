// Seam server ticket 02: bệnh nhân, kế hoạch hẹn online, walk-in tại quầy, STT reset mỗi sáng, kho sự kiện.
import { beforeAll, afterAll, test, expect, vi } from 'vitest';
import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { dateKeyOf } from '../server/queue.js';

process.env.DATABASE_URL = 'file:./test-queue.db';

let server;
let prisma;
let baseUrl;
let receptionistCookie;
let doctorCookie;
const password = randomUUID();

async function login(username) {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error(`login ${username} thất bại`);
  return res.headers.get('set-cookie').split(';')[0];
}

function api(path, { method = 'GET', cookie, body } = {}) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function patientPayload(name) {
  return {
    fullName: name,
    dob: '1990-06-15',
    gender: 'male',
    nationalId: `C${randomUUID().replaceAll('-', '').slice(0, 11)}`,
    phone: `09${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`,
  };
}

async function bookOnline(patient) {
  const res = await api('/api/public/appointments', {
    method: 'POST',
    body: { ...patient, scheduledFor: new Date().toISOString() },
  });
  expect(res.status).toBe(201);
  return res.json();
}

beforeAll(async () => {
  // DB test dựng mới mỗi lần chạy — tránh rows cũ chặn push khi schema thêm cột bắt buộc.
  rmSync('prisma/test-queue.db', { force: true });
  rmSync('prisma/test-queue.db-journal', { force: true });
  execSync('npx prisma db push', {
    stdio: 'pipe',
    env: { ...process.env, DATABASE_URL: 'file:./test-queue.db' },
  });
  prisma = (await import('../server/db.js')).default;
  await prisma.queueTicket.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.event.deleteMany();
  await prisma.patient.deleteMany();

  const { createApp } = await import('../server/app.js');
  const { createIo } = await import('../server/sockets.js');
  const { hashPassword } = await import('../server/auth.js');
  const app = createApp();
  server = http.createServer(app);
  // Route gọi số đọc io từ app — index.js cũng set như thế này.
  app.set('io', createIo(server));
  await prisma.config.deleteMany();
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const hash = await hashPassword(password);
  const receptionist = await prisma.user.create({
    data: { username: `t_${randomUUID().slice(0, 8)}`, passwordHash: hash, role: 'RECEPTIONIST', displayName: 'Lễ tân test' },
  });
  const doctor = await prisma.user.create({
    data: { username: `d_${randomUUID().slice(0, 8)}`, passwordHash: hash, role: 'DOCTOR', displayName: 'Bác sĩ test' },
  });
  receptionistCookie = await login(receptionist.username);
  doctorCookie = await login(doctor.username);

  // Fixture: ba số đã cấp ngày hôm qua — nếu STT không đếm lại theo ngày, số mới sẽ là 4.
  const fixture = await prisma.patient.create({
    data: {
      fullName: 'Trần Fixture',
      dob: new Date('1988-01-01'),
      gender: 'female',
      nationalId: `C${randomUUID().replaceAll('-', '').slice(0, 11)}`,
      phone: '0999000001',
    },
  });
  const yesterday = dateKeyOf(new Date(Date.now() - 24 * 60 * 60 * 1000));
  for (let i = 1; i <= 3; i++) {
    await prisma.queueTicket.create({
      data: {
        patientId: fixture.id,
        dateKey: yesterday,
        number: i,
        status: 'waiting',
        trackingCode: randomUUID().replaceAll('-', '').slice(0, 8),
      },
    });
  }
});

afterAll(async () => {
  await prisma.config.deleteMany();
  await prisma.$disconnect();
  await new Promise((resolve) => server.close(resolve));
});

test('đặt hẹn online công cộng lưu Appointment booked và hiện trong danh sách ngày hẹn', async () => {
  const { appointment, patient } = await bookOnline(patientPayload('Nguyễn Đặt Online'));
  expect(appointment.status).toBe('booked');
  expect(appointment.channel).toBe('online');
  expect(patient.fullName).toBe('Nguyễn Đặt Online');

  const list = await (await api('/api/appointments', { cookie: receptionistCookie })).json();
  expect(list.appointments.some((a) => a.id === appointment.id)).toBe(true);
});

test('tìm kiếm vài chữ đầu tên và số điện thoại trả gợi ý hồ sơ', async () => {
  const byName = await (
    await api(`/api/patients/search?q=${encodeURIComponent('Nguyễn Đặt')}`, { cookie: receptionistCookie })
  ).json();
  expect(byName.patients.some((p) => p.fullName === 'Nguyễn Đặt Online')).toBe(true);
  const byFolded = await (
    await api(`/api/patients/search?q=${encodeURIComponent('nguyen dat online')}`, { cookie: receptionistCookie })
  ).json();
  expect(byFolded.patients.some((p) => p.fullName === 'Nguyễn Đặt Online')).toBe(true);
  const byPhone = await (
    await api(`/api/patients/search?q=${encodeURIComponent(byName.patients[0].phone.slice(0, 5))}`, { cookie: receptionistCookie })
  ).json();
  expect(byPhone.patients.some((p) => p.fullName === 'Nguyễn Đặt Online')).toBe(true);
});

test('lễ tân tạo hồ sơ mới với đầy đủ trường chuẩn', async () => {
  const res = await api('/api/patients', {
    method: 'POST',
    cookie: receptionistCookie,
    body: { ...patientPayload('Lê Hồ Sơ Mới'), medicalRecordNo: `MR${randomUUID().slice(0, 6)}`, insuranceNo: 'HY12345' },
  });
  expect(res.status).toBe(201);
  const { patient } = await res.json();
  expect(patient.medicalRecordNo).toBeTruthy();
  expect(patient.insuranceNo).toBe('HY12345');
});

test('check-in hẹn booked cấp STT đếm lại theo ngày (không cộng với fixture hôm qua)', async () => {
  const booked = await bookOnline(patientPayload('Phạm Hẹn Booked'));
  const res = await api(`/api/appointments/${booked.appointment.id}/check-in`, {
    method: 'POST',
    cookie: receptionistCookie,
  });
  expect(res.status).toBe(200);
  const { appointment, ticket } = await res.json();
  expect(appointment.status).toBe('checked-in');
  expect(appointment.checkedInAt).toBeTruthy();
  expect(ticket.number).toBe(1);
  expect(ticket.dateKey).toBe(dateKeyOf(new Date()));
});

test('walk-in tạo Appointment checked-in một bước và cấp STT đúng thứ tự trong ngày', async () => {
  const created = await api('/api/patients', {
    method: 'POST',
    cookie: receptionistCookie,
    body: patientPayload('Lê Walk In'),
  });
  const { patient } = await created.json();

  const res = await api(`/api/patients/${patient.id}/check-in`, { method: 'POST', cookie: receptionistCookie });
  expect(res.status).toBe(200);
  const first = await res.json();
  expect(first.appointment.status).toBe('checked-in');
  expect(first.appointment.channel).toBe('desk');
  expect(first.ticket.number).toBe(2);

  const again = await api(`/api/patients/${patient.id}/check-in`, { method: 'POST', cookie: receptionistCookie });
  expect(again.status).toBe(200);
  expect((await again.json()).ticket.number).toBe(3);
});

test('danh sách STT hôm nay trả đủ các số đã cấp theo thứ tự', async () => {
  const list = await (await api('/api/tickets', { cookie: receptionistCookie })).json();
  expect(list.tickets.map((t) => t.number)).toEqual([1, 2, 3]);
  expect(list.tickets.every((t) => t.dateKey === dateKeyOf(new Date()))).toBe(true);
});

test('kho sự kiện append-only ghi patient.status.changed + queue.ticket.changed với actor và timestamp server', async () => {
  const events = await prisma.event.findMany({
    where: { type: { in: ['patient.status.changed', 'queue.ticket.changed'] } },
    orderBy: { occurredAt: 'asc' },
  });
  expect(new Set(events.map((e) => e.type))).toEqual(new Set(['patient.status.changed', 'queue.ticket.changed']));
  const statusEvents = events.filter((e) => e.type === 'patient.status.changed');
  expect(statusEvents.length).toBeGreaterThanOrEqual(3);
  for (const e of statusEvents) {
    expect(e.actorUserId).toBeTruthy();
    expect(e.actorLabel).toBe('Lễ tân test');
    expect(Math.abs(Date.now() - new Date(e.occurredAt).getTime())).toBeLessThan(60_000);
  }
  expect(JSON.parse(statusEvents[0].payload).subjectStatus).toBe('arrived');
});

test('check-in lại hẹn đã checked-in bị từ chối 409; hẹn không tồn tại 404', async () => {
  const booked = await bookOnline(patientPayload('Trịnh Đã Check'));
  const first = await api(`/api/appointments/${booked.appointment.id}/check-in`, {
    method: 'POST',
    cookie: receptionistCookie,
  });
  expect(first.status).toBe(200);
  const second = await api(`/api/appointments/${booked.appointment.id}/check-in`, {
    method: 'POST',
    cookie: receptionistCookie,
  });
  expect(second.status).toBe(409);
  const missing = await api('/api/appointments/khong-ton-tai/check-in', { method: 'POST', cookie: receptionistCookie });
  expect(missing.status).toBe(404);
});

test('phân quyền: chưa đăng nhập 401, vai DOCTOR 403, kênh công cộng vẫn đặt hẹn được', async () => {
  const noAuth = await api('/api/patients/search?q=x');
  expect(noAuth.status).toBe(401);
  const wrongRole = await api('/api/patients/search?q=x', { cookie: doctorCookie });
  expect(wrongRole.status).toBe(403);
  const noAuthCheckin = await api('/api/patients/x/check-in', { method: 'POST' });
  expect(noAuthCheckin.status).toBe(401);
  const publicBook = await bookOnline(patientPayload('Vũ Công Cộng'));
  expect(publicBook.appointment.status).toBe('booked');
});

test('validation: thiếu CCCD hoặc ngày sinh sai bị từ chối 400', async () => {
  const noNational = await api('/api/patients', {
    method: 'POST',
    cookie: receptionistCookie,
    body: { fullName: 'Không CCCD', dob: '1990-01-01', gender: 'male', phone: '0909009009' },
  });
  expect(noNational.status).toBe(400);
  const badDob = await api('/api/public/appointments', {
    method: 'POST',
    body: {
      fullName: 'Ngày Sinh Sai',
      dob: 'not-a-date',
      gender: 'female',
      nationalId: 'C123',
      phone: '0909009010',
      scheduledFor: new Date().toISOString(),
    },
  });
  expect(badDob.status).toBe(400);
});

test('gọi số phát call.issued đồng thời ba kênh với cùng payload', async () => {
  const { io } = await import('socket.io-client');
  const created = await api('/api/patients', { method: 'POST', cookie: receptionistCookie, body: patientPayload('Đinh Gọi Số') });
  const { patient } = await created.json();
  const check = await api(`/api/patients/${patient.id}/check-in`, { method: 'POST', cookie: receptionistCookie });
  const { ticket } = await check.json();

  const hello = (sock) => new Promise((resolve) => sock.once('hello', resolve));
  const tvSock = io(baseUrl, { transports: ['websocket'] });
  const trackSock = io(baseUrl, { transports: ['websocket'], auth: { trackingCode: ticket.trackingCode } });
  const deskSock = io(baseUrl, { transports: ['websocket'], extraHeaders: { cookie: receptionistCookie } });
  const payloads = { tv: [], track: [], desk: [] };
  tvSock.on('call.issued', (p) => payloads.tv.push(p));
  trackSock.on('call.issued', (p) => payloads.track.push(p));
  deskSock.on('call.issued', (p) => payloads.desk.push(p));
  await Promise.all([hello(tvSock), hello(trackSock), hello(deskSock)]);

  const call = await api(`/api/tickets/${ticket.id}/call`, { method: 'POST', cookie: receptionistCookie });
  expect(call.status).toBe(200);
  expect((await call.json()).number).toBe(ticket.number);

  // Đua gọi số: người bấm sau nhận 409, không phát sự kiện thứ hai.
  const second = await api(`/api/tickets/${ticket.id}/call`, { method: 'POST', cookie: receptionistCookie });
  expect(second.status).toBe(409);

  await vi.waitFor(() => {
    expect(payloads.tv.length).toBe(1);
    expect(payloads.track.length).toBe(1);
    expect(payloads.desk.length).toBe(1);
  });
  expect(payloads.track[0]).toEqual(payloads.tv[0]);
  expect(payloads.desk[0]).toEqual(payloads.tv[0]);
  [tvSock, trackSock, deskSock].forEach((s) => s.close());
});

test('reconnect nhận queue:snapshot khớp DB', async () => {
  const { io } = await import('socket.io-client');
  const created = await api('/api/patients', { method: 'POST', cookie: receptionistCookie, body: patientPayload('Đinh Snapshot') });
  const { patient } = await created.json();
  const check = await api(`/api/patients/${patient.id}/check-in`, { method: 'POST', cookie: receptionistCookie });
  const { ticket } = await check.json();

  const sock = io(baseUrl, { transports: ['websocket'], auth: { trackingCode: ticket.trackingCode } });
  const snap = await new Promise((resolve) => sock.once('queue:snapshot', resolve));
  expect(snap.number).toBe(ticket.number);
  expect(snap.status).toBe('waiting');

  const call = await api(`/api/tickets/${ticket.id}/call`, { method: 'POST', cookie: receptionistCookie });
  expect(call.status).toBe(200);

  const sock2 = io(baseUrl, { transports: ['websocket'], auth: { trackingCode: ticket.trackingCode } });
  const snap2 = await new Promise((resolve) => sock2.once('queue:snapshot', resolve));
  expect(snap2.status).toBe('called');
  [sock, sock2].forEach((s) => s.close());
});

test('mặt công cộng zero-PII: không tên, CCCD, BHYT, SĐT; mã sai trả 404', async () => {
  const created = await api('/api/patients', { method: 'POST', cookie: receptionistCookie, body: patientPayload('Phí Zero Pii') });
  const { patient } = await created.json();
  const check = await api(`/api/patients/${patient.id}/check-in`, { method: 'POST', cookie: receptionistCookie });
  const { ticket } = await check.json();

  const tv = await (await api('/api/public/tv')).json();
  const tvText = JSON.stringify(tv);
  expect(tvText).not.toContain('Phí Zero Pii');
  expect(tvText).not.toContain('fullName');
  expect(tvText).not.toContain('nationalId');
  expect(tvText).not.toContain('insuranceNo');
  expect(tvText).not.toContain('phone');
  expect(tvText).not.toContain('trackingCode');
  expect(tvText).not.toContain('ticketId');

  const track = await (await api(`/api/public/track/${ticket.trackingCode}`)).json();
  const trackText = JSON.stringify(track);
  expect(trackText).not.toContain('Phí Zero Pii');
  expect(trackText).not.toContain('phone');
  expect(track.number).toBe(ticket.number);
  expect(track.status).toBe('waiting');

  const miss = await api('/api/public/track/ma-sai');
  expect(miss.status).toBe(404);
});

test('giao thức vắng mặt: park → gọi lại ×2 → từ chối lần 3 → skip → undo → sweep no-show → rejoin giữ số', async () => {
  // Sweep chỉ chốt skipped quá hạn — test đặt grace 0 để thẻ vừa skip chuyển được ngay qua sweep.
  await prisma.config.create({ data: { key: 'noShowGraceMs', value: '0' } });
  const created = await api('/api/patients', { method: 'POST', cookie: receptionistCookie, body: patientPayload('Trương Vắng Mặt') });
  const { patient } = await created.json();
  const check = await api(`/api/patients/${patient.id}/check-in`, { method: 'POST', cookie: receptionistCookie });
  const { ticket } = await check.json();

  const call = await api(`/api/tickets/${ticket.id}/call`, { method: 'POST', cookie: receptionistCookie });
  expect(call.status).toBe(200);

  // Tạm giữ một cú bấm — parkUntil bắt buộc do server tính theo cấu hình.
  const park = await api(`/api/tickets/${ticket.id}/park`, { method: 'POST', cookie: receptionistCookie });
  expect(park.status).toBe(200);
  const parked = await park.json();
  expect(parked.status).toBe('parked');
  expect(new Date(parked.parkedUntil).getTime()).toBeGreaterThan(Date.now() - 1000);

  // Gọi lại ×2 thành công (mặc định maxRecalls=2), lần 3 bị từ chối kèm lý do.
  const recall1 = await api(`/api/tickets/${ticket.id}/recall`, { method: 'POST', cookie: receptionistCookie });
  expect(recall1.status).toBe(200);
  const park2 = await api(`/api/tickets/${ticket.id}/park`, { method: 'POST', cookie: receptionistCookie });
  expect(park2.status).toBe(200);
  const recall2 = await api(`/api/tickets/${ticket.id}/recall`, { method: 'POST', cookie: receptionistCookie });
  expect(recall2.status).toBe(200);
  const recall3 = await api(`/api/tickets/${ticket.id}/recall`, { method: 'POST', cookie: receptionistCookie });
  expect(recall3.status).toBe(409);
  expect((await recall3.json()).error).toContain('gọi lại đủ');

  // Skip một cú bấm → undo ngay trong cửa sổ → reason 'undo'.
  const skip = await api(`/api/tickets/${ticket.id}/skip`, { method: 'POST', cookie: receptionistCookie });
  expect(skip.status).toBe(200);
  const rejoin = await api(`/api/tickets/${ticket.id}/rejoin`, { method: 'POST', cookie: receptionistCookie });
  expect(rejoin.status).toBe(200);
  expect((await rejoin.json()).reason).toBe('undo');

  // Skip lại rồi sweep cuối phiên → no-show; rejoin từ no-show giữ số gốc.
  const skip2 = await api(`/api/tickets/${ticket.id}/skip`, { method: 'POST', cookie: receptionistCookie });
  expect(skip2.status).toBe(200);
  const sweep = await api('/api/sweep', { method: 'POST', cookie: receptionistCookie });
  expect(sweep.status).toBe(200);
  expect((await sweep.json()).moved).toBeGreaterThanOrEqual(1);

  const rejoin2 = await api(`/api/tickets/${ticket.id}/rejoin`, { method: 'POST', cookie: receptionistCookie });
  expect(rejoin2.status).toBe(200);
  const r2 = await rejoin2.json();
  expect(r2.reason).toBe('rejoin');
  expect(r2.number).toBe(ticket.number);

  // Xếp cuối hàng: thẻ rejoin đứng cuối trong các thẻ đang waiting, dù số gốc nhỏ hơn các thẻ khác.
  const list = await (await api('/api/tickets', { cookie: receptionistCookie })).json();
  const waiting = list.tickets.filter((t) => t.status === 'waiting');
  expect(waiting[waiting.length - 1].number).toBe(ticket.number);

  await prisma.config.deleteMany();
});

test('xác nhận có mặt từ web và từ quầy ghi cùng marker với actor khác nhau', async () => {
  const mkWeb = await api('/api/patients', { method: 'POST', cookie: receptionistCookie, body: patientPayload('Vương Mặt Web') });
  const { patient: pWeb } = await mkWeb.json();
  const checkWeb = await api(`/api/patients/${pWeb.id}/check-in`, { method: 'POST', cookie: receptionistCookie });
  const { ticket: tWeb } = await checkWeb.json();
  await api(`/api/tickets/${tWeb.id}/call`, { method: 'POST', cookie: receptionistCookie });

  const confirm = await api(`/api/public/track/${tWeb.trackingCode}/confirm`, { method: 'POST' });
  expect(confirm.status).toBe(200);
  expect((await confirm.json()).status).toBe('present');

  const eventWeb = await prisma.event.findFirst({
    where: { aggregateId: tWeb.id, type: 'queue.ticket.changed' },
    orderBy: { occurredAt: 'desc' },
  });
  expect(JSON.parse(eventWeb.payload).reason).toBe('present-web');
  expect(eventWeb.actorType).toBe('patient-web');

  const mkDesk = await api('/api/patients', { method: 'POST', cookie: receptionistCookie, body: patientPayload('Vương Mặt Quầy') });
  const { patient: pDesk } = await mkDesk.json();
  const checkDesk = await api(`/api/patients/${pDesk.id}/check-in`, { method: 'POST', cookie: receptionistCookie });
  const { ticket: tDesk } = await checkDesk.json();
  await api(`/api/tickets/${tDesk.id}/call`, { method: 'POST', cookie: receptionistCookie });

  const present = await api(`/api/tickets/${tDesk.id}/present`, { method: 'POST', cookie: receptionistCookie });
  expect(present.status).toBe(200);
  expect((await present.json()).status).toBe('present');

  const eventDesk = await prisma.event.findFirst({
    where: { aggregateId: tDesk.id, type: 'queue.ticket.changed' },
    orderBy: { occurredAt: 'desc' },
  });
  expect(JSON.parse(eventDesk.payload).reason).toBe('present-desk');
  expect(eventDesk.actorType).toBe('user');
});

test('ngưỡng đọc từ cấu hình: maxRecalls=1 chặn gọi lại lần 2; undoWindowMs=0 → khôi phục là restore', async () => {
  await prisma.config.create({ data: { key: 'maxRecalls', value: '1' } });
  await prisma.config.create({ data: { key: 'undoWindowMs', value: '0' } });

  const created = await api('/api/patients', { method: 'POST', cookie: receptionistCookie, body: patientPayload('Thành Cấu Hình') });
  const { patient } = await created.json();
  const check = await api(`/api/patients/${patient.id}/check-in`, { method: 'POST', cookie: receptionistCookie });
  const { ticket } = await check.json();

  await api(`/api/tickets/${ticket.id}/call`, { method: 'POST', cookie: receptionistCookie });
  const recall1 = await api(`/api/tickets/${ticket.id}/recall`, { method: 'POST', cookie: receptionistCookie });
  expect(recall1.status).toBe(200);
  const recall2 = await api(`/api/tickets/${ticket.id}/recall`, { method: 'POST', cookie: receptionistCookie });
  expect(recall2.status).toBe(409);

  const skip = await api(`/api/tickets/${ticket.id}/skip`, { method: 'POST', cookie: receptionistCookie });
  expect(skip.status).toBe(200);
  const rejoin = await api(`/api/tickets/${ticket.id}/rejoin`, { method: 'POST', cookie: receptionistCookie });
  expect(rejoin.status).toBe(200);
  expect((await rejoin.json()).reason).toBe('restore');

  await prisma.config.deleteMany();
});
