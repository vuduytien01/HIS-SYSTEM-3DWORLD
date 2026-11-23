// Seam server ticket 02: bệnh nhân, kế hoạch hẹn online, walk-in tại quầy, STT reset mỗi sáng, kho sự kiện.
import { beforeAll, afterAll, test, expect, vi } from 'vitest';
import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { dateKeyOf } from '../server/queue.js';

process.env.DATABASE_URL = 'file:./test-queue.db';
process.env.PRISMA_PROVIDER = 'sqlite';

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

  // Fixture phòng (ticket 05): mã bất biến, capacity 1, khu thu ngân là một phòng.
  await prisma.room.createMany({
    data: [
      { code: 'P01', name: 'Phòng khám 1', kind: 'CONSULT', capacity: 1 },
      { code: 'P02', name: 'Phòng khám 2', kind: 'CONSULT', capacity: 1 },
      { code: 'P03', name: 'Phòng khám 3', kind: 'CONSULT', capacity: 1 },
      { code: 'TN', name: 'Khu thu ngân', kind: 'CASHIER', capacity: 1 },
    ],
  });

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
  if (server) await new Promise((resolve) => server.close(resolve));
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

test('gán phòng từ present: visit in-progress, room occupied, location active + events', async () => {
  const created = await api('/api/patients', { method: 'POST', cookie: receptionistCookie, body: patientPayload('Đậu Xếp Phòng') });
  const { patient } = await created.json();
  const check = await api(`/api/patients/${patient.id}/check-in`, { method: 'POST', cookie: receptionistCookie });
  const { ticket } = await check.json();
  await api(`/api/tickets/${ticket.id}/call`, { method: 'POST', cookie: receptionistCookie });
  await api(`/api/tickets/${ticket.id}/present`, { method: 'POST', cookie: receptionistCookie });

  const { rooms } = await (await api('/api/rooms', { cookie: receptionistCookie })).json();
  const p01 = rooms.find((r) => r.code === 'P01');

  const assign = await api(`/api/tickets/${ticket.id}/assign`, { method: 'POST', cookie: receptionistCookie, body: { roomId: p01.id } });
  expect(assign.status).toBe(200);
  const { visit, room } = await assign.json();
  expect(visit.status).toBe('in-progress');
  expect(room.state).toBe('occupied');

  const assignment = await prisma.event.findFirst({ where: { type: 'assignment.created', aggregateId: ticket.id } });
  expect(JSON.parse(assignment.payload).roomId).toBe(p01.id);
  const roomEvent = await prisma.event.findFirst({
    where: { type: 'room.state.changed', aggregateId: p01.id },
    orderBy: { occurredAt: 'desc' },
  });
  expect(JSON.parse(roomEvent.payload).to).toBe('occupied');
  const locs = await prisma.visitLocation.findMany({ where: { visitId: visit.id } });
  expect(locs.map((l) => l.status)).toEqual(['active']);
});

test('xếp trước khi gọi: room reserved → gọi, có mặt → admit chuyển occupied + location active', async () => {
  const created = await api('/api/patients', { method: 'POST', cookie: receptionistCookie, body: patientPayload('Đậu Xếp Trước') });
  const { patient } = await created.json();
  const check = await api(`/api/patients/${patient.id}/check-in`, { method: 'POST', cookie: receptionistCookie });
  const { ticket } = await check.json();

  const { rooms } = await (await api('/api/rooms', { cookie: receptionistCookie })).json();
  const p02 = rooms.find((r) => r.code === 'P02');

  const assign = await api(`/api/tickets/${ticket.id}/assign`, { method: 'POST', cookie: receptionistCookie, body: { roomId: p02.id } });
  expect(assign.status).toBe(200);
  const first = await assign.json();
  expect(first.room.state).toBe('reserved');
  expect(first.visit.status).toBe('planned');

  await api(`/api/tickets/${ticket.id}/call`, { method: 'POST', cookie: receptionistCookie });
  await api(`/api/tickets/${ticket.id}/present`, { method: 'POST', cookie: receptionistCookie });
  const admit = await api(`/api/tickets/${ticket.id}/admit`, { method: 'POST', cookie: receptionistCookie });
  expect(admit.status).toBe(200);
  const { visit, room } = await admit.json();
  expect(visit.status).toBe('in-progress');
  expect(room.state).toBe('occupied');

  const locs = await prisma.visitLocation.findMany({ where: { visitId: visit.id }, orderBy: { startedAt: 'asc' } });
  // Xếp trước tạo 'planned', admit completed entry cũ + entry mới 'active' (append-only)
  expect(locs.map((l) => l.status)).toEqual(['completed', 'active']);
  const locEvent = await prisma.event.findFirst({
    where: { type: 'encounter.location.changed', aggregateId: visit.id },
    orderBy: { occurredAt: 'desc' },
  });
  expect(JSON.parse(locEvent.payload).from).toBe('planned');
  expect(JSON.parse(locEvent.payload).to).toBe('active');
});

test('phòng đầy, disabled, alert từ chối kèm lý do rõ ràng', async () => {
  const mk = await api('/api/patients', { method: 'POST', cookie: receptionistCookie, body: patientPayload('Đậu Từ Chối') });
  const { patient } = await mk.json();
  const check = await api(`/api/patients/${patient.id}/check-in`, { method: 'POST', cookie: receptionistCookie });
  const { ticket } = await check.json();
  await api(`/api/tickets/${ticket.id}/call`, { method: 'POST', cookie: receptionistCookie });
  await api(`/api/tickets/${ticket.id}/present`, { method: 'POST', cookie: receptionistCookie });

  const { rooms } = await (await api('/api/rooms', { cookie: receptionistCookie })).json();
  const p01 = rooms.find((r) => r.code === 'P01');
  const p03 = rooms.find((r) => r.code === 'P03');

  // P01 đã occupied từ test gán phòng đầu — xếp thêm là đầy
  const full = await api(`/api/tickets/${ticket.id}/assign`, { method: 'POST', cookie: receptionistCookie, body: { roomId: p01.id } });
  expect(full.status).toBe(409);
  expect((await full.json()).error).toContain('đã đầy');

  await prisma.room.update({ where: { id: p03.id }, data: { state: 'disabled', disabledReason: 'hỏng máy' } });
  const disabled = await api(`/api/tickets/${ticket.id}/assign`, { method: 'POST', cookie: receptionistCookie, body: { roomId: p03.id } });
  expect(disabled.status).toBe(409);
  expect((await disabled.json()).error).toContain('hỏng máy');

  await prisma.room.update({ where: { id: p03.id }, data: { state: 'alert', disabledReason: null } });
  const alert = await api(`/api/tickets/${ticket.id}/assign`, { method: 'POST', cookie: receptionistCookie, body: { roomId: p03.id } });
  expect(alert.status).toBe(409);
  expect((await alert.json()).error).toContain('xử lý gấp');

  await prisma.room.update({ where: { id: p03.id }, data: { state: 'free' } });
});

test('gợi ý phòng ít tải nhất và override tay vẫn xếp được', async () => {
  const suggest = await (await api('/api/rooms/suggest', { cookie: receptionistCookie })).json();
  expect(suggest.rooms.length).toBeGreaterThan(0);
  expect(suggest.rooms.every((r) => r.load < r.capacity)).toBe(true);

  // Override: xếp thẻ present mới vào phòng đứng cuối danh sách gợi ý (không phải gợi ý đầu)
  const mk = await api('/api/patients', { method: 'POST', cookie: receptionistCookie, body: patientPayload('Đậu Override') });
  const { patient } = await mk.json();
  const check = await api(`/api/patients/${patient.id}/check-in`, { method: 'POST', cookie: receptionistCookie });
  const { ticket } = await check.json();
  await api(`/api/tickets/${ticket.id}/call`, { method: 'POST', cookie: receptionistCookie });
  await api(`/api/tickets/${ticket.id}/present`, { method: 'POST', cookie: receptionistCookie });

  const last = suggest.rooms[suggest.rooms.length - 1];
  const override = await api(`/api/tickets/${ticket.id}/assign`, { method: 'POST', cookie: receptionistCookie, body: { roomId: last.id } });
  expect(override.status).toBe(200);
  expect((await override.json()).room.state).toBe('occupied');
});

test('reassign: entry cũ completed, room cũ free, event revoked + location.changed', async () => {
  const { rooms } = await (await api('/api/rooms', { cookie: receptionistCookie })).json();
  const p01 = rooms.find((r) => r.code === 'P01');
  const p03 = rooms.find((r) => r.code === 'P03');
  const inProgress = await prisma.visit.findFirst({ where: { roomId: p01.id, status: 'in-progress' }, include: { ticket: true } });
  expect(inProgress).toBeTruthy();

  const reassign = await api(`/api/tickets/${inProgress.ticket.id}/reassign`, { method: 'POST', cookie: receptionistCookie, body: { roomId: p03.id } });
  expect(reassign.status).toBe(200);
  const { visit, room } = await reassign.json();
  expect(room.state).toBe('occupied');
  expect(room.id).toBe(p03.id);

  const oldRoom = await prisma.room.findUnique({ where: { id: p01.id } });
  expect(oldRoom.state).toBe('free');
  const locs = await prisma.visitLocation.findMany({ where: { visitId: visit.id }, orderBy: { startedAt: 'asc' } });
  expect(locs.map((l) => l.status)).toEqual(['active', 'completed', 'active']);
  const revoked = await prisma.event.findFirst({ where: { type: 'assignment.revoked', aggregateId: inProgress.ticket.id } });
  expect(JSON.parse(revoked.payload).roomId).toBe(p01.id);
  const locChanged = await prisma.event.findFirst({ where: { type: 'encounter.location.changed', aggregateId: visit.id } });
  expect(JSON.parse(locChanged.payload).fromRoomId).toBe(p01.id);
  expect(JSON.parse(locChanged.payload).toRoomId).toBe(p03.id);
});

test('xung đột hai màn hình xếp cùng phòng: một thắng, một nhận từ chối kèm lý do', async () => {
  const { rooms } = await (await api('/api/rooms', { cookie: receptionistCookie })).json();
  const p01 = rooms.find((r) => r.code === 'P01');

  async function mkPresent(name) {
    const mk = await api('/api/patients', { method: 'POST', cookie: receptionistCookie, body: patientPayload(name) });
    const { patient } = await mk.json();
    const check = await api(`/api/patients/${patient.id}/check-in`, { method: 'POST', cookie: receptionistCookie });
    const { ticket } = await check.json();
    await api(`/api/tickets/${ticket.id}/call`, { method: 'POST', cookie: receptionistCookie });
    await api(`/api/tickets/${ticket.id}/present`, { method: 'POST', cookie: receptionistCookie });
    return ticket;
  }
  const [tA, tB] = await Promise.all([mkPresent('Đậu Đua A'), mkPresent('Đậu Đua B')]);

  const [a, b] = await Promise.all([
    api(`/api/tickets/${tA.id}/assign`, { method: 'POST', cookie: receptionistCookie, body: { roomId: p01.id } }),
    api(`/api/tickets/${tB.id}/assign`, { method: 'POST', cookie: receptionistCookie, body: { roomId: p01.id } }),
  ]);
  const statuses = [a.status, b.status].sort();
  expect(statuses).toEqual([200, 409]);
  const loser = a.status === 409 ? a : b;
  expect((await loser.json()).error).toContain('đầy');

  const room = await prisma.room.findUnique({ where: { id: p01.id } });
  expect(room.state).toBe('occupied');
  const activeVisits = await prisma.visit.count({ where: { roomId: p01.id, status: { in: ['planned', 'in-progress', 'on-hold'] } } });
  expect(activeVisits).toBe(1);
});

test('hoàn tác mức 1: present + visit planned → revoke assignment, room free, ticket waiting', async () => {
  const mk = await api('/api/patients', { method: 'POST', cookie: receptionistCookie, body: patientPayload('Đậu Hoàn Tác 1') });
  const { patient } = await mk.json();
  const check = await api(`/api/patients/${patient.id}/check-in`, { method: 'POST', cookie: receptionistCookie });
  const { ticket } = await check.json();
  await api(`/api/tickets/${ticket.id}/call`, { method: 'POST', cookie: receptionistCookie });
  await api(`/api/tickets/${ticket.id}/present`, { method: 'POST', cookie: receptionistCookie });

  const { rooms } = await (await api('/api/rooms', { cookie: receptionistCookie })).json();
  const p01 = rooms.find((r) => r.code === 'P01');
  const assign = await api(`/api/tickets/${ticket.id}/assign`, { method: 'POST', cookie: receptionistCookie, body: { roomId: p01.id } });
  expect(assign.status).toBe(200);
  const { visit } = await assign.json();
  expect(visit.status).toBe('planned');

  const undo = await api(`/api/tickets/${ticket.id}/undo`, { method: 'POST', cookie: receptionistCookie });
  expect(undo.status).toBe(200);
  expect((await undo.json()).level).toBe(1);
  expect((await undo.json()).action).toBe('undo-pre-call');

  const room = await prisma.room.findUnique({ where: { id: p01.id } });
  expect(room.state).toBe('free');
  const v = await prisma.visit.findUnique({ where: { id: visit.id } });
  expect(v.status).toBe('cancelled');
  const t = await prisma.queueTicket.findUnique({ where: { id: ticket.id } });
  expect(t.status).toBe('waiting');

  const event = await prisma.event.findFirst({ where: { type: 'assignment.revoked', aggregateId: ticket.id } });
  expect(JSON.parse(event.payload).reason).toBe('undo-pre-call');
});

test('hoàn tác mức 2: present + visit in-progress → bắt buộc lý do, chuyển reassign', async () => {
  const mk = await api('/api/patients', { method: 'POST', cookie: receptionistCookie, body: patientPayload('Đậu Hoàn Tác 2') });
  const { patient } = await mk.json();
  const check = await api(`/api/patients/${patient.id}/check-in`, { method: 'POST', cookie: receptionistCookie });
  const { ticket } = await check.json();
  await api(`/api/tickets/${ticket.id}/call`, { method: 'POST', cookie: receptionistCookie });
  await api(`/api/tickets/${ticket.id}/present`, { method: 'POST', cookie: receptionistCookie });

  const { rooms } = await (await api('/api/rooms', { cookie: receptionistCookie })).json();
  const p01 = rooms.find((r) => r.code === 'P01');
  const assign = await api(`/api/tickets/${ticket.id}/assign`, { method: 'POST', cookie: receptionistCookie, body: { roomId: p01.id } });
  expect(assign.status).toBe(200);
  const { visit } = await assign.json();
  await api(`/api/tickets/${ticket.id}/admit`, { method: 'POST', cookie: receptionistCookie });

  // Thiếu lý do → 400
  const noReason = await api(`/api/tickets/${ticket.id}/undo`, { method: 'POST', cookie: receptionistCookie, body: { reason: '' } });
  expect(noReason.status).toBe(400);

  // Có lý do → thành công
  const undo = await api(`/api/tickets/${ticket.id}/undo`, { method: 'POST', cookie: receptionistCookie, body: { reason: 'lỗi nhập' } });
  expect(undo.status).toBe(200);
  expect((await undo.json()).level).toBe(2);
  expect((await undo.json()).action).toBe('undo-post-call');

  const room = await prisma.room.findUnique({ where: { id: p01.id } });
  expect(room.state).toBe('free');
  const v = await prisma.visit.findUnique({ where: { id: visit.id } });
  expect(v.status).toBe('cancelled');

  const event = await prisma.event.findFirst({ where: { type: 'assignment.revoked', aggregateId: ticket.id } });
  expect(JSON.parse(event.payload).undoReason).toBe('lỗi nhập');
  expect(event.payload).toContain('undo-post-call');
});

test('hoàn tác mức 3: visit completed (receiving-care) → chặn 409', async () => {
  const mk = await api('/api/patients', { method: 'POST', cookie: receptionistCookie, body: patientPayload('Đậu Hoàn Tác 3') });
  const { patient } = await mk.json();
  const check = await api(`/api/patients/${patient.id}/check-in`, { method: 'POST', cookie: receptionistCookie });
  const { ticket } = await check.json();
  await api(`/api/tickets/${ticket.id}/call`, { method: 'POST', cookie: receptionistCookie });
  await api(`/api/tickets/${ticket.id}/present`, { method: 'POST', cookie: receptionistCookie });

  const { rooms } = await (await api('/api/rooms', { cookie: receptionistCookie })).json();
  const p01 = rooms.find((r) => r.code === 'P01');
  const assign = await api(`/api/tickets/${ticket.id}/assign`, { method: 'POST', cookie: receptionistCookie, body: { roomId: p01.id } });
  await api(`/api/tickets/${ticket.id}/admit`, { method: 'POST', cookie: receptionistCookie });

  const v = await prisma.visit.findFirst({ where: { ticketId: ticket.id } });
  await prisma.visit.update({ where: { id: v.id }, data: { status: 'completed' } });

  const undo = await api(`/api/tickets/${ticket.id}/undo`, { method: 'POST', cookie: receptionistCookie, body: { reason: 'khẩn cấp' } });
  expect(undo.status).toBe(409);
  expect((await undo.json()).error).toContain('receiving-care');
});

test('override hoàn tất: bắt buộc chọn lý do từ danh sách cấu hình', async () => {
  const mk = await api('/api/patients', { method: 'POST', cookie: receptionistCookie, body: patientPayload('Đậu Override') });
  const { patient } = await mk.json();
  const check = await api(`/api/patients/${patient.id}/check-in`, { method: 'POST', cookie: receptionistCookie });
  const { ticket } = await check.json();
  await api(`/api/tickets/${ticket.id}/call`, { method: 'POST', cookie: receptionistCookie });
  await api(`/api/tickets/${ticket.id}/present`, { method: 'POST', cookie: receptionistCookie });

  const { rooms } = await (await api('/api/rooms', { cookie: receptionistCookie })).json();
  const p01 = rooms.find((r) => r.code === 'P01');
  const assign = await api(`/api/tickets/${ticket.id}/assign`, { method: 'POST', cookie: receptionistCookie, body: { roomId: p01.id } });
  await api(`/api/tickets/${ticket.id}/admit`, { method: 'POST', cookie: receptionistCookie });

  // Lý do không trong danh sách → 400
  const bad = await api(`/api/tickets/${ticket.id}/override-complete`, { method: 'POST', cookie: receptionistCookie, body: { reason: 'lý do không hợp lệ' } });
  expect(bad.status).toBe(400);
  expect((await bad.json()).error).toContain('lý do phải là một trong');

  // Lý do hợp lệ → thành công
  const good = await api(`/api/tickets/${ticket.id}/override-complete`, { method: 'POST', cookie: receptionistCookie, body: { reason: 'khẩn cấp' } });
  expect(good.status).toBe(200);

  const v = await prisma.visit.findFirst({ where: { ticketId: ticket.id } });
  expect(v.status).toBe('discontinued');
  expect(v.discontinuedReason).toBe('khẩn cấp');

  const room = await prisma.room.findUnique({ where: { id: p01.id } });
  expect(room.state).toBe('free');

  const event = await prisma.event.findFirst({ where: { type: 'assignment.revoked', aggregateId: ticket.id } });
  expect(JSON.parse(event.payload).reason).toBe('override-complete');
  expect(JSON.parse(event.payload).overrideReason).toBe('khẩn cấp');
});

test('Provenance: mọi undo/override ghi actor, timestamp server, thao tác, lý do', async () => {
  const mk = await api('/api/patients', { method: 'POST', cookie: receptionistCookie, body: patientPayload('Đậu Provenance') });
  const { patient } = await mk.json();
  const check = await api(`/api/patients/${patient.id}/check-in`, { method: 'POST', cookie: receptionistCookie });
  const { ticket } = await check.json();
  await api(`/api/tickets/${ticket.id}/call`, { method: 'POST', cookie: receptionistCookie });
  await api(`/api/tickets/${ticket.id}/present`, { method: 'POST', cookie: receptionistCookie });

  const { rooms } = await (await api('/api/rooms', { cookie: receptionistCookie })).json();
  const p01 = rooms.find((r) => r.code === 'P01');
  const assign = await api(`/api/tickets/${ticket.id}/assign`, { method: 'POST', cookie: receptionistCookie, body: { roomId: p01.id } });
  await api(`/api/tickets/${ticket.id}/admit`, { method: 'POST', cookie: receptionistCookie });

  const undo = await api(`/api/tickets/${ticket.id}/undo`, { method: 'POST', cookie: receptionistCookie, body: { reason: 'lỗi nhập' } });
  expect(undo.status).toBe(200);

  const event = await prisma.event.findFirst({
    where: { type: 'assignment.revoked', aggregateId: ticket.id },
    orderBy: { occurredAt: 'desc' },
  });
  const payload = JSON.parse(event.payload);
  expect(payload.undoReason).toBe('lỗi nhập');
  expect(event.actorType).toBe('user');
  expect(event.actorLabel).toBe('Lễ tân test');
  expect(Math.abs(Date.now() - new Date(event.occurredAt).getTime())).toBeLessThan(60_000);
});

test('cập nhật ưu tiên + nhóm QĐ 1313, mặt công cộng chỉ hiện "ưu tiên: có"', async () => {
  const mk = await api('/api/patients', { method: 'POST', cookie: receptionistCookie, body: patientPayload('Đậu Ưu Tiên') });
  const { patient } = await mk.json();
  const check = await api(`/api/patients/${patient.id}/check-in`, { method: 'POST', cookie: receptionistCookie });
  const { ticket } = await check.json();

  const setP = await api(`/api/tickets/${ticket.id}/priority`, { method: 'POST', cookie: receptionistCookie, body: { priority: 'urgent', group: 'elderly' } });
  expect(setP.status).toBe(200);
  expect((await setP.json()).priority).toBe('urgent');

  // Mặt công cộng chỉ hiện priority true/false, không nhóm cụ thể.
  const track = await (await api(`/api/public/track/${ticket.trackingCode}`)).json();
  expect(track.priority).toBe(true);
  expect(track.priorityGroup).toBeUndefined();
});

test('làn cấp cứu: đóng mọi hàng chờ cũ, mở ticket mới priority emergency', async () => {
  const mk = await api('/api/patients', { method: 'POST', cookie: receptionistCookie, body: patientPayload('Đậu Cấp Cứu') });
  const { patient } = await mk.json();
  const check = await api(`/api/patients/${patient.id}/check-in`, { method: 'POST', cookie: receptionistCookie });
  const { ticket } = await check.json();
  await api(`/api/tickets/${ticket.id}/call`, { method: 'POST', cookie: receptionistCookie });
  await api(`/api/tickets/${ticket.id}/present`, { method: 'POST', cookie: receptionistCookie });

  const { rooms } = await (await api('/api/rooms', { cookie: receptionistCookie })).json();
  const p01 = rooms.find((r) => r.code === 'P01');
  const assign = await api(`/api/tickets/${ticket.id}/assign`, { method: 'POST', cookie: receptionistCookie, body: { roomId: p01.id } });
  await api(`/api/tickets/${ticket.id}/admit`, { method: 'POST', cookie: receptionistCookie });

  const emergency = await api(`/api/tickets/${ticket.id}/emergency`, { method: 'POST', cookie: receptionistCookie });
  expect(emergency.status).toBe(200);
  const res = await emergency.json();
  expect(res.newTicket.priority).toBe('emergency');
  expect(res.oldTicket.priority).toBe('emergency');

  // Ticket cũ cancelled, phòng free.
  const oldT = await prisma.queueTicket.findUnique({ where: { id: ticket.id } });
  expect(oldT.status).toBe('cancelled');
  const room = await prisma.room.findUnique({ where: { id: p01.id } });
  expect(room.state).toBe('free');
});

test('tiếp nhận đoàn: một thao tác tạo N ticket groupId chung, STT liền nhau', async () => {
  const patients = [
    { fullName: 'Đoàn A1', dob: '1990-01-01', gender: 'male', nationalId: 'C' + randomUUID().replaceAll('-', '').slice(0, 11), phone: '0900000001' },
    { fullName: 'Đoàn A2', dob: '1990-02-02', gender: 'female', nationalId: 'C' + randomUUID().replaceAll('-', '').slice(0, 11), phone: '0900000002' },
    { fullName: 'Đoàn A3', dob: '1990-03-03', gender: 'male', nationalId: 'C' + randomUUID().replaceAll('-', '').slice(0, 11), phone: '0900000003' },
  ];
  const group = await api('/api/group-admission', { method: 'POST', cookie: receptionistCookie, body: { patients } });
  expect(group.status).toBe(200);
  const res = await group.json();
  expect(res.tickets.length).toBe(3);
  expect(res.tickets.every((t) => t.ticket.groupId === res.groupId)).toBe(true);
  expect(res.tickets.map((t) => t.ticket.number)).toEqual([res.tickets[0].ticket.number, res.tickets[0].ticket.number + 1, res.tickets[0].ticket.number + 2]);
  expect(res.tickets.every((t) => t.ticket.groupId === res.groupId)).toBe(true);
  // UI hiển thị group badge.
  const list = await (await api('/api/tickets', { cookie: receptionistCookie })).json();
  const groupTickets = list.tickets.filter((t) => t.groupId === res.groupId);
  expect(groupTickets.length).toBe(3);
});
