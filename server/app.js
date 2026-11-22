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
import { requireRole } from './rbac.js';
import { recordEvent } from './events.js';
import { dateKeyOf, dayBounds, issueQueueTicket, retryOnTicketRace } from './queue.js';
import { parsePatientInput, findOrCreatePatient, publicPatient, foldName } from './patients.js';
import { tvAction, publicTicketView, tvSnapshot, trackSnapshot } from './queue-projection.js';
import { getConfigParam } from './config-params.js';

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

  // ---- Ticket 02: bệnh nhân, kế hoạch hẹn, thẻ hàng đợi ----

  function httpError(status, message) {
    const err = new Error(message);
    err.status = status;
    return err;
  }

  // Chuyển trạng thái thẻ bằng CAS: guard trạng thái cho phép, updateMany có điều kiện,
  // ghi sự kiện cùng transaction — hai màn hình bấm cùng lúc chỉ một thắng.
  async function transitionTicket(tx, { id, allowed, data, reason, extra = {}, actor }) {
    const current = await tx.queueTicket.findUnique({ where: { id } });
    if (!current) throw httpError(404, 'Không tìm thấy thẻ hàng đợi');
    if (!allowed.includes(current.status)) {
      throw httpError(409, `Thẻ đang ở trạng thái ${current.status}, không thực hiện được thao tác này`);
    }
    const swapped = await tx.queueTicket.updateMany({ where: { id, status: current.status }, data });
    if (swapped.count === 0) throw httpError(409, 'Thẻ vừa bị thao tác khác thay đổi');
    await recordEvent(tx, {
      type: 'queue.ticket.changed',
      aggregateId: current.id,
      payload: { ticketId: current.id, number: current.number, dateKey: current.dateKey, from: current.status, to: data.status, reason, ...extra },
      actor,
    });
    return { ...current, ...data, reason };
  }

  function publicAppointment(a) {
    return {
      id: a.id,
      status: a.status,
      scheduledFor: a.scheduledFor,
      channel: a.channel,
      checkedInAt: a.checkedInAt,
      createdByUserId: a.createdByUserId,
      patient: publicPatient(a.patient),
    };
  }

  function publicTicket(t) {
    return {
      id: t.id,
      number: t.number,
      dateKey: t.dateKey,
      status: t.status,
      issuedAt: t.issuedAt,
      appointmentId: t.appointmentId,
      trackingCode: t.trackingCode,
      patient: t.patient ? publicPatient(t.patient) : null,
    };
  }

  // Hai sự kiện check-in nằm cùng transaction với thay đổi state.
  // Hai bảng từ vựng tách bạch: subjectStatus (vị trí bệnh nhân FHIR) và status của Appointment.
  async function recordCheckInEvents(tx, { patientId, appointment, ticket, actor, reason }) {
    const eventActor = { type: 'user', id: actor.id, label: actor.displayName };
    await recordEvent(tx, {
      type: 'patient.status.changed',
      aggregateId: patientId,
      payload: { subjectStatus: 'arrived', appointmentId: appointment.id, appointmentStatus: 'checked-in' },
      actor: eventActor,
    });
    await recordEvent(tx, {
      type: 'queue.ticket.changed',
      aggregateId: ticket.id,
      payload: { ticketId: ticket.id, number: ticket.number, dateKey: ticket.dateKey, from: null, to: 'waiting', reason },
      actor: eventActor,
    });
  }

  // Tìm bệnh nhân: vài chữ đầu tên hoặc vài số điện thoại.
  app.get('/api/patients/search', requireRole('RECEPTIONIST'), async (req, res, next) => {
    try {
      const q = String(req.query.q ?? '').trim();
      if (q.length < 2) return res.json({ patients: [] });
      const patients = await prisma.patient.findMany({
        where: {
          OR: [
            { fullName: { contains: q } },
            { searchName: { contains: foldName(q) } },
            { phone: { contains: q } },
          ],
        },
        orderBy: { fullName: 'asc' },
        take: 20,
      });
      res.json({ patients: patients.map(publicPatient) });
    } catch (err) { next(err); }
  });

  // Lễ tân tạo hồ sơ bệnh nhân mới.
  app.post('/api/patients', requireRole('RECEPTIONIST'), async (req, res, next) => {
    const parsed = parsePatientInput(req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    try {
      const dup = await prisma.patient.findUnique({ where: { nationalId: parsed.data.nationalId } });
      if (dup) {
        return res.status(409).json({ error: `CCCD ${parsed.data.nationalId} đã có hồ sơ`, patient: publicPatient(dup) });
      }
      const patient = await prisma.patient.create({ data: parsed.data });
      res.status(201).json({ patient: publicPatient(patient) });
    } catch (err) { next(err); }
  });

  // Kênh web công cộng: bệnh nhân đặt kế hoạch hẹn online (booked); khớp hồ sơ theo CCCD.
  app.post('/api/public/appointments', async (req, res, next) => {
    const scheduledFor = new Date(String(req.body?.scheduledFor ?? ''));
    if (Number.isNaN(scheduledFor.getTime())) return res.status(400).json({ error: 'Thời gian hẹn không hợp lệ' });
    const parsed = parsePatientInput(req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    try {
      const result = await prisma.$transaction(async (tx) => {
        const { patient, created } = await findOrCreatePatient(tx, parsed.data);
        const appointment = await tx.appointment.create({
          data: { patientId: patient.id, status: 'booked', channel: 'online', scheduledFor },
        });
        return { appointment: publicAppointment({ ...appointment, patient }), patient: publicPatient(patient), created };
      });
      res.status(201).json(result);
    } catch (err) { next(err); }
  });

  // Check-in hẹn booked tại quầy: Appointment → checked-in + cấp STT trong ngày.
  app.post('/api/appointments/:id/check-in', requireRole('RECEPTIONIST'), async (req, res, next) => {
    const actor = req.session.user;
    const now = new Date();
    try {
      const result = await retryOnTicketRace(() => prisma.$transaction(async (tx) => {
        const appointment = await tx.appointment.findUnique({ where: { id: req.params.id } });
        if (!appointment) throw httpError(404, 'Không tìm thấy hẹn');
        if (appointment.status === 'checked-in') throw httpError(409, 'Hẹn đã check-in');
        if (appointment.status !== 'booked') throw httpError(409, `Hẹn ở trạng thái ${appointment.status}, không check-in được`);
        const updated = await tx.appointment.update({
          where: { id: appointment.id },
          data: { status: 'checked-in', checkedInAt: now },
          include: { patient: true },
        });
        const ticket = await issueQueueTicket(tx, {
          patientId: appointment.patientId,
          appointmentId: appointment.id,
          dateKey: dateKeyOf(now),
        });
        await recordCheckInEvents(tx, {
          patientId: appointment.patientId, appointment, ticket, actor, reason: 'check-in',
        });
        return { appointment: publicAppointment(updated), ticket: publicTicket(ticket) };
      }));
      res.json(result);
    } catch (err) { next(err); }
  });

  // Walk-in tại quầy: Appointment checked-in một bước + cấp STT.
  app.post('/api/patients/:id/check-in', requireRole('RECEPTIONIST'), async (req, res, next) => {
    const actor = req.session.user;
    const now = new Date();
    try {
      const result = await retryOnTicketRace(() => prisma.$transaction(async (tx) => {
        const patient = await tx.patient.findUnique({ where: { id: req.params.id } });
        if (!patient) throw httpError(404, 'Không tìm thấy bệnh nhân');
        const appointment = await tx.appointment.create({
          data: { patientId: patient.id, status: 'checked-in', channel: 'desk', scheduledFor: now, checkedInAt: now },
        });
        const ticket = await issueQueueTicket(tx, {
          patientId: patient.id,
          appointmentId: appointment.id,
          dateKey: dateKeyOf(now),
        });
        await recordCheckInEvents(tx, {
          patientId: patient.id, appointment, ticket, actor, reason: 'walk-in',
        });
        return {
          appointment: publicAppointment({ ...appointment, patient }),
          ticket: publicTicket(ticket),
        };
      }));
      res.json(result);
    } catch (err) { next(err); }
  });

  // Danh sách ngày hẹn và thẻ hàng đợi trong một ngày (mặc định hôm nay).
  app.get('/api/appointments', requireRole('RECEPTIONIST'), async (req, res, next) => {
    try {
      const [start, end] = dayBounds(String(req.query.dateKey ?? dateKeyOf(new Date())));
      const appointments = await prisma.appointment.findMany({
        where: { scheduledFor: { gte: start, lt: end } },
        include: { patient: true },
        orderBy: { scheduledFor: 'asc' },
      });
      res.json({ appointments: appointments.map(publicAppointment) });
    } catch (err) { next(err); }
  });

  app.get('/api/tickets', requireRole('RECEPTIONIST'), async (req, res, next) => {
    try {
      const tickets = await prisma.queueTicket.findMany({
        where: { dateKey: String(req.query.dateKey ?? dateKeyOf(new Date())) },
        include: { patient: true },
        orderBy: { lastQueuedAt: 'asc' },
      });
      res.json({ tickets: tickets.map(publicTicket) });
    } catch (err) { next(err); }
  });

  // ---- Ticket 03: gọi số ba kênh + mặt công cộng zero-PII ----

  // Một lần phát, ba room: TV công cộng, web bệnh nhân (mã theo dõi), loa quầy lễ tân (điểm neo TTS sau).
  function broadcastCall(io, ticket) {
    if (!io) return;
    io.to('public').to(`track:${ticket.trackingCode}`).to('role:RECEPTIONIST')
      .emit('call.issued', publicTicketView(ticket));
  }

  // Gọi số: waiting → called bằng CAS; ghi sự kiện trong transaction rồi phát ba kênh một lần.
  app.post('/api/tickets/:id/call', requireRole('RECEPTIONIST'), async (req, res, next) => {
    const actor = { type: 'user', id: req.session.user.id, label: req.session.user.displayName };
    try {
      const ticket = await prisma.$transaction((tx) => transitionTicket(tx, {
        id: req.params.id,
        allowed: ['waiting'],
        data: { status: 'called', callAttempts: { increment: 1 } },
        reason: 'call',
        actor,
      }));
      broadcastCall(req.app.get('io'), ticket);
      res.json(publicTicketView(ticket));
    } catch (err) { next(err); }
  });

  // Mặt TV công cộng: lượt đang gọi + kế tiếp, zero-PII, chỉ ngày hôm nay.
  app.get('/api/public/tv', async (req, res, next) => {
    try {
      const tickets = await prisma.queueTicket.findMany({
        where: { dateKey: dateKeyOf(new Date()) },
        orderBy: { lastQueuedAt: 'asc' },
      });
      res.json(tvSnapshot(tickets));
    } catch (err) { next(err); }
  });

  // Kênh web bệnh nhân: trạng thái của thẻ khớp mã theo dõi, zero-PII.
  app.get('/api/public/track/:code', async (req, res, next) => {
    try {
      const ticket = await prisma.queueTicket.findUnique({ where: { trackingCode: String(req.params.code) } });
      if (!ticket) return res.status(404).json({ error: 'Mã theo dõi không đúng' });
      res.json(trackSnapshot(ticket));
    } catch (err) { next(err); }
  });

  // ---- Ticket 04: giao thức gọi không có mặt ----

  // Tạm giữ sau khi gọi: parkUntil bắt buộc — client chỉ định hoặc server tính theo cấu hình.
  app.post('/api/tickets/:id/park', requireRole('RECEPTIONIST'), async (req, res, next) => {
    const actor = { type: 'user', id: req.session.user.id, label: req.session.user.displayName };
    const holdMs = await getConfigParam('parkedHoldMs');
    const parkedUntil = req.body?.parkedUntil ? new Date(String(req.body.parkedUntil)) : new Date(Date.now() + holdMs);
    if (Number.isNaN(parkedUntil.getTime())) return res.status(400).json({ error: 'parkedUntil không hợp lệ' });
    try {
      const ticket = await prisma.$transaction((tx) => transitionTicket(tx, {
        id: req.params.id,
        allowed: ['called'],
        data: { status: 'parked', parkedUntil },
        reason: 'park',
        extra: { parkedUntil: parkedUntil.toISOString() },
        actor,
      }));
      res.json({ ...publicTicketView(ticket), status: 'parked', parkedUntil: ticket.parkedUntil });
    } catch (err) { next(err); }
  });

  // Gọi lại: phát lại call.issued cho thẻ called/parked; tối đa maxRecalls lần gọi lại theo cấu hình.
  app.post('/api/tickets/:id/recall', requireRole('RECEPTIONIST'), async (req, res, next) => {
    const actor = { type: 'user', id: req.session.user.id, label: req.session.user.displayName };
    const maxRecalls = await getConfigParam('maxRecalls');
    try {
      const ticket = await prisma.$transaction(async (tx) => {
        const current = await tx.queueTicket.findUnique({ where: { id: req.params.id } });
        if (!current) throw httpError(404, 'Không tìm thấy thẻ hàng đợi');
        if (current.callAttempts - 1 >= maxRecalls) {
          throw httpError(409, `Đã gọi lại đủ ${maxRecalls} lần theo cấu hình`);
        }
        return transitionTicket(tx, {
          id: req.params.id,
          allowed: ['called', 'parked'],
          data: { status: 'called', callAttempts: { increment: 1 }, parkedUntil: null },
          reason: 'recall',
          actor,
        });
      });
      broadcastCall(req.app.get('io'), ticket);
      res.json(publicTicketView(ticket));
    } catch (err) { next(err); }
  });

  // Xác nhận có mặt từ quầy/lễ tân — cùng presence marker với kênh web.
  app.post('/api/tickets/:id/present', requireRole('RECEPTIONIST'), async (req, res, next) => {
    const actor = { type: 'user', id: req.session.user.id, label: req.session.user.displayName };
    const now = new Date();
    try {
      const ticket = await prisma.$transaction((tx) => transitionTicket(tx, {
        id: req.params.id,
        allowed: ['called', 'parked'],
        data: { status: 'present', presenceAt: now },
        reason: 'present-desk',
        actor,
      }));
      res.json({ ...publicTicketView(ticket), status: 'present' });
    } catch (err) { next(err); }
  });

  // Bỏ lượt: thẻ đang chờ/gọi/tạm giữ → skipped (khôi phục được), skippedAt làm mốc cửa sổ undo.
  app.post('/api/tickets/:id/skip', requireRole('RECEPTIONIST'), async (req, res, next) => {
    const actor = { type: 'user', id: req.session.user.id, label: req.session.user.displayName };
    const now = new Date();
    try {
      const ticket = await prisma.$transaction((tx) => transitionTicket(tx, {
        id: req.params.id,
        allowed: ['waiting', 'called', 'parked'],
        data: { status: 'skipped', skippedAt: now },
        reason: 'skip',
        actor,
      }));
      res.json({ ...publicTicketView(ticket), status: 'skipped' });
    } catch (err) { next(err); }
  });

  // Khôi phục sau bỏ lượt/vắng mặt: trong cửa sổ undo là hoàn tác (reason 'undo'),
  // ngoài cửa sổ hoặc từ no-show là thao tác có chủ đích (reason 'restore'/'rejoin').
  // Giữ số gốc, xếp vào cuối hàng (lastQueuedAt = now), reset chu kỳ gọi (callAttempts về 0).
  app.post('/api/tickets/:id/rejoin', requireRole('RECEPTIONIST'), async (req, res, next) => {
    const actor = { type: 'user', id: req.session.user.id, label: req.session.user.displayName };
    const undoMs = await getConfigParam('undoWindowMs');
    try {
      const ticket = await prisma.$transaction(async (tx) => {
        const current = await tx.queueTicket.findUnique({ where: { id: req.params.id } });
        if (!current) throw httpError(404, 'Không tìm thấy thẻ hàng đợi');
        const inUndoWindow = current.status === 'skipped' && current.skippedAt
          && Date.now() - new Date(current.skippedAt).getTime() <= undoMs;
        const reason = inUndoWindow ? 'undo' : (current.status === 'skipped' ? 'restore' : 'rejoin');
        return transitionTicket(tx, {
          id: req.params.id,
          allowed: ['skipped', 'no-show'],
          data: { status: 'waiting', skippedAt: null, parkedUntil: null, callAttempts: 0, lastQueuedAt: new Date() },
          reason,
          actor,
        });
      });
      res.json({ ...publicTicketView(ticket), status: 'waiting', reason: ticket.reason });
    } catch (err) { next(err); }
  });

  // Kênh web bệnh nhân xác nhận có mặt bằng mã theo dõi — cùng presence marker, actor là patient-web.
  app.post('/api/public/track/:code/confirm', async (req, res, next) => {
    const now = new Date();
    try {
      const ticket = await prisma.$transaction(async (tx) => {
        const target = await tx.queueTicket.findUnique({ where: { trackingCode: String(req.params.code) } });
        if (!target) throw httpError(404, 'Mã theo dõi không đúng');
        return transitionTicket(tx, {
          id: target.id,
          allowed: ['called', 'parked'],
          data: { status: 'present', presenceAt: now },
          reason: 'present-web',
          actor: { type: 'patient-web', id: null, label: 'Bệnh nhân qua mã theo dõi' },
        });
      });
      res.json(trackSnapshot(ticket));
    } catch (err) { next(err); }
  });

  // Sweep cuối phiên: thẻ skipped quá hạn (noShowGraceMs theo cấu hình) → no-show, CAS từng thẻ.
  // Không đường tay nào chốt no-show trực tiếp.
  app.post('/api/sweep', requireRole('RECEPTIONIST'), async (req, res, next) => {
    const actor = { type: 'user', id: req.session.user.id, label: req.session.user.displayName };
    try {
      const moved = await prisma.$transaction(async (tx) => {
        const graceMs = await getConfigParam('noShowGraceMs');
        const cutoff = new Date(Date.now() - graceMs);
        const targets = await tx.queueTicket.findMany({
          where: { dateKey: dateKeyOf(new Date()), status: 'skipped', skippedAt: { lt: cutoff } },
        });
        let count = 0;
        for (const target of targets) {
          const swapped = await tx.queueTicket.updateMany({
            where: { id: target.id, status: 'skipped' },
            data: { status: 'no-show' },
          });
          if (swapped.count === 0) continue;
          await recordEvent(tx, {
            type: 'queue.ticket.changed',
            aggregateId: target.id,
            payload: { ticketId: target.id, number: target.number, dateKey: target.dateKey, from: 'skipped', to: 'no-show', reason: 'sweep' },
            actor,
          });
          count++;
        }
        return count;
      });
      res.json({ moved });
    } catch (err) { next(err); }
  });

  // Lỗi nghiệp vụ mang status (httpError) — trả JSON thay vì trang HTML 500 mặc định của Express.
  app.use((err, req, res, next) => {
    if (err.status) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    next(err);
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
  app.get('/book', sendIndex);
  app.get('/track', sendIndex);

  return app;
}
