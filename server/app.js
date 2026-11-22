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
import { getConfigParam, getOverrideReasons } from './config-params.js';

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
      visit: t.visit ? { id: t.visit.id, status: t.visit.status, roomId: t.visit.roomId } : null,
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
        include: { patient: true, visit: true },
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

  // ---- Ticket 05: Phòng + Lượt khám + gán phòng (điều phối manual) ----

  function publicRoom(r) {
    return {
      id: r.id, code: r.code, name: r.name, kind: r.kind, state: r.state,
      capacity: r.capacity, disabledReason: r.disabledReason, reopenAt: r.reopenAt, active: r.active,
    };
  }

  function publicVisit(v) {
    return { id: v.id, ticketId: v.ticketId, patientId: v.patientId, status: v.status, roomId: v.roomId };
  }

  // Phòng phải mở (active, không disabled/alert, chưa đầy) mới nhận xếp mới.
  async function guardRoomAccepts(tx, room, excludeVisitId = null) {
    if (!room.active) throw httpError(409, `Phòng ${room.name} đã ngừng hoạt động`);
    if (room.state === 'disabled') throw httpError(409, `Phòng ${room.name} đang bị khóa: ${room.disabledReason ?? 'không rõ lý do'}`);
    if (room.state === 'alert') throw httpError(409, `Phòng ${room.name} cần xử lý gấp, không xếp thêm`);
    const activeVisits = await tx.visit.count({
      where: { roomId: room.id, status: { in: ['planned', 'in-progress', 'on-hold'] }, ...(excludeVisitId ? { id: { not: excludeVisitId } } : {}) },
    });
    if (activeVisits >= room.capacity) throw httpError(409, `Phòng ${room.name} đã đầy (${activeVisits}/${room.capacity})`);
  }

  // Đổi trạng thái phòng bằng CAS trong transaction + ghi room.state.changed.
  // Reload phòng sau updateMany để object trả về có state mới.
  async function changeRoomState(tx, room, to, actor, extra = {}) {
    const swapped = await tx.room.updateMany({ where: { id: room.id, state: room.state }, data: { state: to } });
    if (swapped.count === 0) throw httpError(409, 'Phòng vừa bị thay đổi bởi một thao tác khác');
    const fresh = await tx.room.findUnique({ where: { id: room.id } });
    await recordEvent(tx, {
      type: 'room.state.changed',
      aggregateId: fresh.id,
      payload: { roomId: fresh.id, from: room.state, to, ...extra },
      actor,
    });
    return fresh;
  }

  // Xếp phòng: từ present là dẫn bệnh nhân vào ngay (occupied/in-progress/location active);
  // từ waiting là xếp trước khi gọi (reserved/planned/location planned).
  app.post('/api/tickets/:id/assign', requireRole('RECEPTIONIST'), async (req, res, next) => {
    const actor = { type: 'user', id: req.session.user.id, label: req.session.user.displayName };
    const roomId = String(req.body?.roomId ?? '');
    if (!roomId) return res.status(400).json({ error: 'Thiếu roomId' });
    try {
      const result = await prisma.$transaction(async (tx) => {
        const ticket = await tx.queueTicket.findUnique({ where: { id: req.params.id }, include: { visit: true } });
        if (!ticket) throw httpError(404, 'Không tìm thấy thẻ hàng đợi');
        if (!['waiting', 'present'].includes(ticket.status)) {
          throw httpError(409, `Thẻ đang ở trạng thái ${ticket.status}, không xếp phòng được`);
        }
        if (ticket.visit) throw httpError(409, 'Thẻ đã có lượt khám đang xếp');

        const room = await tx.room.findUnique({ where: { id: roomId } });
        if (!room) throw httpError(404, 'Không tìm thấy phòng');
        await guardRoomAccepts(tx, room);

        const entering = ticket.status === 'present';
        const roomState = entering ? 'occupied' : 'reserved';
        const visitStatus = entering ? 'in-progress' : 'planned';
        const locationStatus = entering ? 'active' : 'planned';

        const visit = await tx.visit.create({
          data: { ticketId: ticket.id, patientId: ticket.patientId, status: visitStatus, roomId: room.id },
        });
        await tx.visitLocation.create({ data: { visitId: visit.id, roomId: room.id, status: locationStatus } });
        // Inline CAS room state + reload ngay trong transaction.
        const swapped = await tx.room.updateMany({ where: { id: room.id, state: room.state }, data: { state: roomState } });
        if (swapped.count === 0) throw httpError(409, 'Phòng vừa bị thay đổi bởi một thao tác khác');
        const freshRoom = await tx.room.findUnique({ where: { id: room.id } });
        await recordEvent(tx, {
          type: 'room.state.changed',
          aggregateId: freshRoom.id,
          payload: { roomId: freshRoom.id, from: room.state, to: roomState, ticketId: ticket.id },
          actor,
        });
        await recordEvent(tx, {
          type: 'assignment.created',
          aggregateId: ticket.id,
          payload: { ticketId: ticket.id, visitId: visit.id, roomId: freshRoom.id, roomState },
          actor,
        });
        if (entering) {
          await recordEvent(tx, {
            type: 'patient.status.changed',
            aggregateId: ticket.patientId,
            payload: { subjectStatus: 'receiving-care', visitId: visit.id },
            actor,
          });
        }
        return { visit: { ...visit, room: freshRoom }, room: freshRoom };
      });
      res.json({ visit: publicVisit(result.visit), room: publicRoom(result.room) });
    } catch (err) { next(err); }
  });

  // Bệnh nhân vào phòng thật: planned → in-progress, location planned → active, reserved → occupied.
  app.post('/api/tickets/:id/admit', requireRole('RECEPTIONIST'), async (req, res, next) => {
    const actor = { type: 'user', id: req.session.user.id, label: req.session.user.displayName };
    try {
      const result = await prisma.$transaction(async (tx) => {
        const ticket = await tx.queueTicket.findUnique({ where: { id: req.params.id }, include: { visit: true } });
        if (!ticket) throw httpError(404, 'Không tìm thấy thẻ hàng đợi');
        if (!ticket.visit) throw httpError(409, 'Thẻ chưa được xếp phòng');
        if (ticket.visit.status !== 'planned') throw httpError(409, `Lượt khám đang ${ticket.visit.status}`);
        const room = await tx.room.findUnique({ where: { id: ticket.visit.roomId } });
        if (!room) throw httpError(404, 'Không tìm thấy phòng của lượt khám');

        const visit = await tx.visit.update({ where: { id: ticket.visit.id }, data: { status: 'in-progress' } });
        // Entry cũ completed, entry mới active (append-only).
        await tx.visitLocation.updateMany({
          where: { visitId: visit.id, status: 'planned' },
          data: { status: 'completed', endedAt: new Date() },
        });
        await tx.visitLocation.create({ data: { visitId: visit.id, roomId: room.id, status: 'active' } });
        // Inline CAS room state + reload.
        const swapped = await tx.room.updateMany({ where: { id: room.id, state: room.state }, data: { state: 'occupied' } });
        if (swapped.count === 0) throw httpError(409, 'Phòng vừa bị thay đổi bởi một thao tác khác');
        const freshRoom = await tx.room.findUnique({ where: { id: room.id } });
        await recordEvent(tx, {
          type: 'room.state.changed',
          aggregateId: freshRoom.id,
          payload: { roomId: freshRoom.id, from: room.state, to: 'occupied', ticketId: ticket.id },
          actor,
        });
        await recordEvent(tx, {
          type: 'encounter.location.changed',
          aggregateId: visit.id,
          payload: { visitId: visit.id, roomId: freshRoom.id, from: 'planned', to: 'active' },
          actor,
        });
        await recordEvent(tx, {
          type: 'patient.status.changed',
          aggregateId: ticket.patientId,
          payload: { subjectStatus: 'receiving-care', visitId: visit.id },
          actor,
        });
        return { visit: { ...visit, room: freshRoom }, room: freshRoom };
      });
      res.json({ visit: publicVisit(result.visit), room: publicRoom(result.room) });
    } catch (err) { next(err); }
  });

  // Chuyển phòng: entry cũ completed + room cũ free, room mới nhận — gói một transaction,
  // phát assignment.revoked + encounter.location.changed + assignment.created + room.state.changed.
  app.post('/api/tickets/:id/reassign', requireRole('RECEPTIONIST'), async (req, res, next) => {
    const actor = { type: 'user', id: req.session.user.id, label: req.session.user.displayName };
    const roomId = String(req.body?.roomId ?? '');
    if (!roomId) return res.status(400).json({ error: 'Thiếu roomId' });
    try {
      const result = await prisma.$transaction(async (tx) => {
        const ticket = await tx.queueTicket.findUnique({ where: { id: req.params.id }, include: { visit: true } });
        if (!ticket) throw httpError(404, 'Không tìm thấy thẻ hàng đợi');
        if (!ticket.visit) throw httpError(409, 'Thẻ chưa được xếp phòng');
        const oldRoomId = ticket.visit.roomId;
        if (oldRoomId === roomId) throw httpError(409, 'Thẻ đã ở phòng này');

        const room = await tx.room.findUnique({ where: { id: roomId } });
        if (!room) throw httpError(404, 'Không tìm thấy phòng');
        await guardRoomAccepts(tx, room, ticket.visit.id);

        const entering = ticket.visit.status === 'in-progress';
        const roomState = entering ? 'occupied' : 'reserved';
        const locationStatus = entering ? 'active' : 'planned';

        const oldRoom = await tx.room.findUnique({ where: { id: oldRoomId } });
        await tx.visitLocation.updateMany({
          where: { visitId: ticket.visit.id, status: { in: ['planned', 'active'] } },
          data: { status: 'completed', endedAt: new Date() },
        });
        // Inline CAS old room -> free.
        const oldSwapped = await tx.room.updateMany({ where: { id: oldRoom.id, state: oldRoom.state }, data: { state: 'free' } });
        if (oldSwapped.count === 0) throw httpError(409, 'Phòng cũ vừa bị thay đổi bởi một thao tác khác');
        const freedRoom = await tx.room.findUnique({ where: { id: oldRoom.id } });
        await recordEvent(tx, {
          type: 'room.state.changed',
          aggregateId: freedRoom.id,
          payload: { roomId: freedRoom.id, from: oldRoom.state, to: 'free', ticketId: ticket.id },
          actor,
        });
        await recordEvent(tx, {
          type: 'assignment.revoked',
          aggregateId: ticket.id,
          payload: { ticketId: ticket.id, visitId: ticket.visit.id, roomId: freedRoom.id, reason: 'reassign' },
          actor,
        });

        const visit = await tx.visit.update({ where: { id: ticket.visit.id }, data: { roomId: room.id } });
        // Entry cũ completed, entry mới status theo roomState.
        await tx.visitLocation.updateMany({
          where: { visitId: ticket.visit.id, status: { in: ['planned', 'active'] } },
          data: { status: 'completed', endedAt: new Date() },
        });
        await tx.visitLocation.create({ data: { visitId: visit.id, roomId: room.id, status: locationStatus } });
        // Inline CAS new room state + reload.
        const newSwapped = await tx.room.updateMany({ where: { id: room.id, state: room.state }, data: { state: roomState } });
        if (newSwapped.count === 0) throw httpError(409, 'Phòng mới vừa bị thay đổi bởi một thao tác khác');
        const freshRoom = await tx.room.findUnique({ where: { id: room.id } });
        await recordEvent(tx, {
          type: 'encounter.location.changed',
          aggregateId: visit.id,
          payload: { visitId: visit.id, fromRoomId: oldRoomId, toRoomId: room.id },
          actor,
        });
        await recordEvent(tx, {
          type: 'assignment.created',
          aggregateId: ticket.id,
          payload: { ticketId: ticket.id, visitId: visit.id, roomId: room.id, roomState },
          actor,
        });
        // Inline CAS new room state + reload.
        const newSwapped2 = await tx.room.updateMany({ where: { id: room.id, state: room.state }, data: { state: roomState } });
        if (newSwapped2.count === 0) throw httpError(409, 'Phòng mới vừa bị thay đổi bởi một thao tác khác');
        const freshRoom2 = await tx.room.findUnique({ where: { id: room.id } });
        await recordEvent(tx, {
          type: 'room.state.changed',
          aggregateId: freshRoom2.id,
          payload: { roomId: freshRoom2.id, from: room.state, to: roomState, ticketId: ticket.id },
          actor,
        });
        return { visit: { ...visit, room: freshRoom2 }, room: freshRoom2 };
        return { visit: { ...visit, room: freshRoom }, room: freshRoom };
      });
      res.json({ visit: publicVisit(result.visit), room: publicRoom(result.room) });
    } catch (err) { next(err); }
  });

  // Danh sách phòng kèm tải (số lượt đang chiếm).
  app.get('/api/rooms', requireRole('RECEPTIONIST'), async (req, res, next) => {
    try {
      const rooms = await prisma.room.findMany({ orderBy: { code: 'asc' } });
      const loads = await prisma.visit.groupBy({
        by: ['roomId'],
        where: { status: { in: ['planned', 'in-progress', 'on-hold'] }, roomId: { not: null } },
        _count: { _all: true },
      });
      const loadByRoom = new Map(loads.map((l) => [l.roomId, l._count._all]));
      res.json({ rooms: rooms.map((r) => ({ ...publicRoom(r), load: loadByRoom.get(r.id) ?? 0 })) });
    } catch (err) { next(err); }
  });

  // Gợi ý xếp phòng: phòng mở ít tải nhất trước — lễ tân giữ quyền override tay.
  app.get('/api/rooms/suggest', requireRole('RECEPTIONIST'), async (req, res, next) => {
    try {
      const rooms = await prisma.room.findMany({
        where: { active: true, state: { in: ['free', 'reserved'] } },
        orderBy: { code: 'asc' },
      });
      const loads = await prisma.visit.groupBy({
        by: ['roomId'],
        where: { status: { in: ['planned', 'in-progress', 'on-hold'] }, roomId: { not: null } },
        _count: { _all: true },
      });
      const loadByRoom = new Map(loads.map((l) => [l.roomId, l._count._all]));
      const suggestions = rooms
        .filter((r) => (loadByRoom.get(r.id) ?? 0) < r.capacity)
        .sort((a, b) => (loadByRoom.get(a.id) ?? 0) - (loadByRoom.get(b.id) ?? 0) || a.code.localeCompare(b.code));
      res.json({ rooms: suggestions.map((r) => ({ ...publicRoom(r), load: loadByRoom.get(r.id) ?? 0 })) });
    } catch (err) { next(err); }
  });

  // ---- Ticket 06: Hoàn tác 3 mức + Override bắt lý do + Audit Provenance ----

  // Hoàn tác xếp phòng: 3 mức theo thời điểm tín hiệu vào phòng.
  // Mức 1: trước tín hiệu (visit planned/reserved) → revoke assignment, room free, ticket về waiting.
  // Mức 2: sau tín hiệu (visit in-progress/occupied) → chuyển thành reassign, bắt buộc lý do.
  // Mức 3: receiving-care (bác sĩ đang khám) → chặn, trả 409.
  app.post('/api/tickets/:id/undo', requireRole('RECEPTIONIST'), async (req, res, next) => {
    const actor = { type: 'user', id: req.session.user.id, label: req.session.user.displayName };
    const reason = String(req.body?.reason ?? '').trim();
    const now = new Date();
    try {
      const result = await prisma.$transaction(async (tx) => {
        const ticket = await tx.queueTicket.findUnique({ where: { id: req.params.id }, include: { visit: true } });
        if (!ticket) throw httpError(404, 'Không tìm thấy thẻ hàng đợi');
        if (!ticket.visit) throw httpError(409, 'Thẻ chưa được xếp phòng');

        const visit = ticket.visit;
        const room = await tx.room.findUnique({ where: { id: visit.roomId } });
        if (!room) throw httpError(404, 'Không tìm thấy phòng');

        // Mức 1: trước tín hiệu vào phòng (planned/reserved) — hoàn tác sạch, không hỏi lý do.
        if (visit.status === 'planned') {
          // Revoke assignment: room free, visit cancelled, ticket waiting.
          await tx.visitLocation.updateMany({ where: { visitId: visit.id }, data: { status: 'completed', endedAt: now } });
          await tx.visit.update({ where: { id: visit.id }, data: { status: 'cancelled' } });
          const swapped = await tx.room.updateMany({ where: { id: room.id, state: room.state }, data: { state: 'free' } });
          if (swapped.count === 0) throw httpError(409, 'Phòng vừa bị thay đổi');
          const freshRoom = await tx.room.findUnique({ where: { id: room.id } });
          await recordEvent(tx, {
            type: 'assignment.revoked',
            aggregateId: ticket.id,
            payload: { ticketId: ticket.id, visitId: visit.id, roomId: room.id, reason: 'undo-pre-call' },
            actor,
          });
          await recordEvent(tx, {
            type: 'room.state.changed',
            aggregateId: freshRoom.id,
            payload: { roomId: freshRoom.id, from: room.state, to: 'free', ticketId: ticket.id },
            actor,
          });
          return { level: 1, action: 'undo-pre-call', ticket: { ...ticket, status: 'waiting' }, room: freshRoom };
        }

        // Mức 2: sau tín hiệu (in-progress/occupied) — chuyển thành reassign, bắt buộc lý do.
        if (visit.status === 'in-progress' || visit.status === 'on-hold') {
          if (!reason) throw httpError(400, 'Hoàn tác sau khi đã vào phòng bắt buộc chọn lý do');
          // Cancel visit hiện tại, ticket về waiting, room free.
          await tx.visitLocation.updateMany({ where: { visitId: visit.id, status: { in: ['active', 'planned'] } }, data: { status: 'completed', endedAt: now } });
          await tx.visit.update({ where: { id: visit.id }, data: { status: 'cancelled' } });
          const swapped = await tx.room.updateMany({ where: { id: room.id, state: room.state }, data: { state: 'free' } });
          if (swapped.count === 0) throw httpError(409, 'Phòng vừa bị thay đổi');
          const freshRoom = await tx.room.findUnique({ where: { id: room.id } });
          await recordEvent(tx, {
            type: 'assignment.revoked',
            aggregateId: ticket.id,
            payload: { ticketId: ticket.id, visitId: visit.id, roomId: room.id, reason: 'undo-post-call', undoReason: reason },
            actor,
          });
          await recordEvent(tx, {
            type: 'room.state.changed',
            aggregateId: freshRoom.id,
            payload: { roomId: freshRoom.id, from: room.state, to: 'free', ticketId: ticket.id },
            actor,
          });
          return { level: 2, action: 'undo-post-call', ticket: { ...ticket, status: 'waiting' }, room: freshRoom };
        }

        // Mức 3: receiving-care (bác sĩ đang khám) — chặn.
        if (visit.status === 'completed') {
          throw httpError(409, 'Bệnh nhân đang receiving-care, không thể hoàn tác');
        }
        throw httpError(409, `Không thể hoàn tác ở trạng thái ${visit.status}`);
      });
      res.json(result);
    } catch (err) { next(err); }
  });

  // Override đóng completed cho phòng khác: bắt buộc chọn lý do từ danh sách cấu hình.
  app.post('/api/tickets/:id/override-complete', requireRole('RECEPTIONIST'), async (req, res, next) => {
    const actor = { type: 'user', id: req.session.user.id, label: req.session.user.displayName };
    const reason = String(req.body?.reason ?? '').trim();
    const now = new Date();
    try {
      const reasons = await getOverrideReasons();
      if (!reasons.includes(reason)) throw httpError(400, `Lý do phải là một trong: ${reasons.join(', ')}`);
      const result = await prisma.$transaction(async (tx) => {
        const ticket = await tx.queueTicket.findUnique({ where: { id: req.params.id }, include: { visit: true } });
        if (!ticket) throw httpError(404, 'Không tìm thấy thẻ hàng đợi');
        if (!ticket.visit) throw httpError(409, 'Thẻ chưa có lượt khám');
        const visit = ticket.visit;
        if (visit.status !== 'in-progress') throw httpError(409, `Chỉ override được khi đang in-progress (hiện ${visit.status})`);
        // Cancel visit, ticket về waiting, room free.
        const room = await tx.room.findUnique({ where: { id: visit.roomId } });
        await tx.visitLocation.updateMany({ where: { visitId: visit.id, status: { in: ['active', 'planned'] } }, data: { status: 'completed', endedAt: now } });
        await tx.visit.update({ where: { id: visit.id }, data: { status: 'discontinued', discontinuedReason: reason } });
        if (room) {
          const swapped = await tx.room.updateMany({ where: { id: room.id, state: room.state }, data: { state: 'free' } });
          if (swapped.count === 0) throw httpError(409, 'Phòng vừa bị thay đổi');
        }
        await recordEvent(tx, {
          type: 'assignment.revoked',
          aggregateId: ticket.id,
          payload: { ticketId: ticket.id, visitId: visit.id, roomId: room?.id, reason: 'override-complete', overrideReason: reason },
          actor,
        });
        if (room) {
          const swapped = await tx.room.updateMany({ where: { id: room.id, state: room.state }, data: { state: 'free' } });
          if (swapped.count === 0) throw httpError(409, 'Phòng vừa bị thay đổi');
          const freshRoom = await tx.room.findUnique({ where: { id: room.id } });
          await recordEvent(tx, {
            type: 'room.state.changed',
            aggregateId: freshRoom.id,
            payload: { roomId: freshRoom.id, from: room.state, to: 'free', ticketId: ticket.id, reason: 'override-complete' },
            actor,
          });
        }
        return { visit, room };
      });
      res.json({ message: 'Override thành công', reason });
    } catch (err) { next(err); }
  });

  // Danh sách lý do override cấu hình.
  app.get('/api/config/override-reasons', requireRole('RECEPTIONIST'), async (req, res, next) => {
    try {
      const reasons = await getOverrideReasons();
      res.json({ reasons });
    } catch (err) { next(err); }
  });

  // ---- Ticket 07: Nhóm ưu tiên + Làn cấp cứu + Đoàn bệnh nhân ----

  const PRIORITY_GROUPS = {
    emergency: ['elderly', 'disability', 'pregnant', 'emergency-light'],
    urgent: [],
    asap: [],
    routine: [],
  };

  // Cập nhật ưu tiên: toggle hoặc set nhóm QĐ 1313, set Appointment.priority tương ứng.
  app.post('/api/tickets/:id/priority', requireRole('RECEPTIONIST'), async (req, res, next) => {
    const actor = { type: 'user', id: req.session.user.id, label: req.session.user.displayName };
    const { priority, group } = req.body ?? {};
    if (!priority || !['emergency', 'urgent', 'asap', 'routine'].includes(priority)) {
      return res.status(400).json({ error: 'priority không hợp lệ' });
    }
    try {
      const ticket = await prisma.$transaction(async (tx) => {
        const current = await tx.queueTicket.findUnique({ where: { id: req.params.id } });
        if (!current) throw httpError(404, 'Không tìm thấy thẻ hàng đợi');
        const updated = await tx.queueTicket.update({ where: { id: current.id }, data: { priority, groupId: group ?? current.groupId } });
        await recordEvent(tx, {
          type: 'queue.ticket.changed',
          aggregateId: current.id,
          payload: { ticketId: current.id, number: current.number, dateKey: current.dateKey, from: current.priority, to: priority, group },
          actor,
        });
        // Cập nhật Appointment.priority (ActPriority v3) nếu có.
        if (current.appointmentId) {
          await tx.appointment.update({ where: { id: current.appointmentId }, data: { priority } });
        }
        return { ...updated, priority };
      });
      res.json({ ticket: ticket, priority });
    } catch (err) { next(err); }
  });

  // Làn cấp cứu: một transaction đóng mọi hàng chờ cũ, mở lượt mới.
  app.post('/api/tickets/:id/emergency', requireRole('RECEPTIONIST'), async (req, res, next) => {
    const actor = { type: 'user', id: req.session.user.id, label: req.session.user.displayName };
    const now = new Date();
    try {
      const result = await prisma.$transaction(async (tx) => {
        const ticket = await tx.queueTicket.findUnique({ where: { id: req.params.id }, include: { visit: true, appointment: true } });
        if (!ticket) throw httpError(404, 'Không tìm thấy thẻ hàng đợi');
        // Đóng mọi ticket khác của cùng bệnh nhân (kể cả called/parked) về waiting hoặc cancelled.
        await tx.queueTicket.updateMany({
          where: { patientId: ticket.patientId, id: { not: ticket.id }, status: { in: ['waiting', 'called', 'parked'] } },
          data: { status: 'cancelled' },
        });
        // Nếu đang có visit: cancel visit, room free.
        if (ticket.visit) {
          const visit = ticket.visit;
          await tx.visitLocation.updateMany({ where: { visitId: visit.id }, data: { status: 'completed', endedAt: now } });
          await tx.visit.update({ where: { id: visit.id }, data: { status: 'discontinued', discontinuedReason: 'emergency-lane' } });
          const room = await tx.room.findUnique({ where: { id: visit.roomId } });
          if (room) {
            const swapped = await tx.room.updateMany({ where: { id: room.id, state: room.state }, data: { state: 'free' } });
            if (swapped.count > 0) {
              const fresh = await tx.room.findUnique({ where: { id: room.id } });
              await recordEvent(tx, {
                type: 'room.state.changed',
                aggregateId: fresh.id,
                payload: { roomId: fresh.id, from: room.state, to: 'free', ticketId: ticket.id, reason: 'emergency-lane' },
                actor,
              });
            }
          }
        }
        // Mở ticket mới priority emergency.
        const newTicket = await tx.queueTicket.create({
          data: { patientId: ticket.patientId, appointmentId: ticket.appointmentId, dateKey: ticket.dateKey, number: (await tx.queueTicket.findFirst({ where: { dateKey: ticket.dateKey }, orderBy: { number: 'desc' }, select: { number: true } }))?.number + 1 ?? 1, status: 'waiting', priority: 'emergency' },
        });
        await recordEvent(tx, {
          type: 'queue.ticket.changed',
          aggregateId: ticket.id,
          payload: { ticketId: ticket.id, number: ticket.number, dateKey: ticket.dateKey, from: ticket.priority, to: 'emergency', reason: 'emergency-lane' },
          actor,
        });
        await recordEvent(tx, {
          type: 'queue.ticket.changed',
          aggregateId: newTicket.id,
          payload: { ticketId: newTicket.id, number: newTicket.number, dateKey: newTicket.dateKey, from: null, to: 'waiting', reason: 'emergency-lane-new' },
          actor,
        });
        return { oldTicket: { ...ticket, priority: 'emergency' }, newTicket: { ...newTicket, priority: 'emergency' } };
      });
      res.json(result);
    } catch (err) { next(err); }
  });

  // Tiếp nhận đoàn: một thao tác tạo N ticket với groupId chung, STT liền nhau.
  app.post('/api/group-admission', requireRole('RECEPTIONIST'), async (req, res, next) => {
    const actor = { type: 'user', id: req.session.user.id, label: req.session.user.displayName };
    const now = new Date();
    const patients = Array.isArray(req.body?.patients) ? req.body.patients : [];
    if (patients.length === 0) return res.status(400).json({ error: 'Thiếu danh sách bệnh nhân' });
    const groupId = `GRP-${randomBytes(4).toString('hex').toUpperCase()}`;
    const dateKey = dateKeyOf(now);
    try {
      const result = await prisma.$transaction(async (tx) => {
        // Tìm max number hôm nay.
        const last = await tx.queueTicket.findFirst({ where: { dateKey }, orderBy: { number: 'desc' }, select: { number: true } });
        let nextNumber = (last?.number ?? 0) + 1;
        const tickets = [];
        for (const p of patients) {
          const parsed = parsePatientInput(p);
          if (parsed.error) throw httpError(400, `Bệnh nhân ${p.fullName}: ${parsed.error}`);
          const { patient } = await findOrCreatePatient(tx, parsed.data);
          const ticket = await tx.queueTicket.create({
            data: { patientId: patient.id, dateKey, number: nextNumber++, status: 'waiting', groupId },
          });
          tickets.push({ ticket: publicTicket(ticket), patient: publicPatient(patient) });
        }
        await recordEvent(tx, {
          type: 'queue.ticket.changed',
          aggregateId: groupId,
          payload: { groupId, ticketIds: tickets.map((t) => t.ticket.id), count: tickets.length, reason: 'group-admission' },
          actor,
        });
        return { groupId, tickets };
      });
      res.json(result);
    } catch (err) { next(err); }
  });

  // ---- Ticket 09: Kéo thả trên 3D World — drag là đề xuất, server là thẩm quyền ----

  // Kéo thả xếp phòng: client gửi drag-drop, server là thẩm quyền, trả accept/reject.
  app.post('/api/tickets/:id/drag-drop', requireRole('RECEPTIONIST'), async (req, res, next) => {
    const actor = { type: 'user', id: req.session.user.id, label: req.session.user.displayName };
    const { roomId, callNow = false, transactionId } = req.body ?? {};
    if (!roomId) return res.status(400).json({ error: 'Thiếu roomId' });
    const now = new Date();
    try {
      const result = await prisma.$transaction(async (tx) => {
        const ticket = await tx.queueTicket.findUnique({ where: { id: req.params.id }, include: { visit: true } });
        if (!ticket) throw httpError(404, 'Không tìm thấy thẻ hàng đợi');
        if (ticket.status !== 'waiting') throw httpError(409, `Thẻ đang ở trạng thái ${ticket.status}, không kéo thả được`);

        const room = await tx.room.findUnique({ where: { id: roomId } });
        if (!room) throw httpError(404, 'Không tìm thấy phòng');
        await guardRoomAccepts(tx, room);

        const entering = ticket.status === 'present'; // Drag-drop chỉ từ waiting (theo thiết kế)
        const roomState = entering ? 'occupied' : 'reserved';
        const visitStatus = entering ? 'in-progress' : 'planned';
        const locationStatus = entering ? 'active' : 'planned';

        // Tạo visit nếu chưa có
        let visit = ticket.visit;
        if (!visit) {
          visit = await tx.visit.create({
            data: { ticketId: ticket.id, patientId: ticket.patientId, status: visitStatus, roomId: room.id },
          });
          await tx.visitLocation.create({ data: { visitId: visit.id, roomId: room.id, status: entering ? 'active' : 'planned' } });
        } else {
          // Có visit rồi: update room + location mới
          await tx.visit.update({ where: { id: visit.id }, data: { roomId: room.id, status: visitStatus } });
          await tx.visitLocation.create({ data: { visitId: visit.id, roomId: room.id, status: entering ? 'active' : 'planned' } });
        }

        // CAS room state
        const swapped = await tx.room.updateMany({ where: { id: room.id, state: room.state }, data: { state: roomState } });
        if (swapped.count === 0) throw httpError(409, 'Phòng vừa bị thay đổi bởi một thao tác khác');
        const freshRoom = await tx.room.findUnique({ where: { id: room.id } });

        // Events
        await recordEvent(tx, {
          type: 'assignment.created',
          aggregateId: ticket.id,
          payload: { ticketId: ticket.id, visitId: visit.id, roomId: freshRoom.id, roomState, transactionId: transactionId ?? null },
          actor,
        });
        await recordEvent(tx, {
          type: 'encounter.location.changed',
          aggregateId: visit.id,
          payload: { visitId: visit.id, roomId: freshRoom.id, status: locationStatus, transactionId: transactionId ?? null },
          actor,
        });
        await recordEvent(tx, {
          type: 'room.state.changed',
          aggregateId: freshRoom.id,
          payload: { roomId: freshRoom.id, from: room.state, to: roomState, ticketId: ticket.id, transactionId: transactionId ?? null },
          actor,
        });
        if (entering) {
          await recordEvent(tx, {
            type: 'patient.status.changed',
            aggregateId: ticket.patientId,
            payload: { subjectStatus: 'receiving-care', visitId: visit.id },
            actor,
          });
        }
        if (callNow) {
          await tx.queueTicket.update({ where: { id: ticket.id }, data: { status: 'called', callAttempts: { increment: 1 } } });
          await recordEvent(tx, {
            type: 'queue.ticket.changed',
            aggregateId: ticket.id,
            payload: { ticketId: ticket.id, number: ticket.number, dateKey: ticket.dateKey, from: 'waiting', to: 'called', reason: 'call', transactionId: transactionId ?? null },
            actor,
          });
        }

        return { ticket: { ...ticket, status: entering ? 'present' : 'waiting' }, room: freshRoom, visit: { ...visit, room: freshRoom }, transactionId: transactionId ?? null };
      });
      res.json({ accept: true, ...result });
    } catch (err) {
      // Trả reject với thông tin để client xử lý
      const room = await prisma.room.findUnique({ where: { id: roomId } });
      res.json({
        accept: false,
        error: err.message,
        suggestedRoomId: (await prisma.room.findFirst({ where: { active: true, state: { in: ['free', 'reserved'] } }, orderBy: { code: 'asc' } }))?.id ?? null,
        originalPosition: req.body?.originalPosition ?? null,
      });
    }
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
