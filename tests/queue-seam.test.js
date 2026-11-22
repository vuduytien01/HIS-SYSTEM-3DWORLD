// Seam server ticket 02: bệnh nhân, kế hoạch hẹn online, walk-in tại quầy, STT reset mỗi sáng, kho sự kiện.
import { beforeAll, afterAll, test, expect } from 'vitest';
import { execSync } from 'node:child_process';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { dateKeyOf } from '../server/queue.js';

process.env.DATABASE_URL = 'file:./prisma/test-queue.db';

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
  execSync('npx prisma db push', {
    stdio: 'pipe',
    env: { ...process.env, DATABASE_URL: 'file:./prisma/test-queue.db' },
  });
  prisma = (await import('../server/db.js')).default;
  await prisma.queueTicket.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.event.deleteMany();
  await prisma.patient.deleteMany();

  const { createApp } = await import('../server/app.js');
  const { createIo } = await import('../server/sockets.js');
  const { hashPassword } = await import('../server/auth.js');
  server = http.createServer(createApp());
  createIo(server);
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
      data: { patientId: fixture.id, dateKey: yesterday, number: i, status: 'waiting' },
    });
  }
});

afterAll(async () => {
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
