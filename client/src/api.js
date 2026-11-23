// REST + Socket client. Cookie httpOnly do trình duyệt tự gửi cùng origin.
import { io } from 'socket.io-client';

async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    credentials: 'same-origin',
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return res.status === 204 ? null : res.json();
}

export const apiLogin = (username, password) =>
  fetchJson('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });

export const apiLogout = () => fetchJson('/api/auth/logout', { method: 'POST' });

export const apiMe = () => fetchJson('/api/me');

// ---- Ticket 02: bệnh nhân + kế hoạch hẹn + thẻ hàng đợi ----
export const apiSearchPatients = (q) => fetchJson(`/api/patients/search?q=${encodeURIComponent(q)}`);
export const apiCreatePatient = (data) => fetchJson('/api/patients', { method: 'POST', body: JSON.stringify(data) });
export const apiPublicBook = (data) => fetchJson('/api/public/appointments', { method: 'POST', body: JSON.stringify(data) });
export const apiCheckInAppointment = (id) =>
  fetchJson(`/api/appointments/${encodeURIComponent(id)}/check-in`, { method: 'POST' });
export const apiWalkInCheckIn = (patientId) =>
  fetchJson(`/api/patients/${encodeURIComponent(patientId)}/check-in`, { method: 'POST' });
export const apiAppointments = (dateKey = '') => fetchJson(`/api/appointments${dateKey ? `?dateKey=${dateKey}` : ''}`);
export const apiTickets = (dateKey = '') => fetchJson(`/api/tickets${dateKey ? `?dateKey=${dateKey}` : ''}`);

// ---- Ticket 03: gọi số + mặt công cộng zero-PII ----
export const apiCallTicket = (id) => fetchJson(`/api/tickets/${encodeURIComponent(id)}/call`, { method: 'POST' });
export const apiPublicTv = () => fetchJson('/api/public/tv');
export const apiPublicTrack = (code) => fetchJson(`/api/public/track/${encodeURIComponent(code)}`);

// ---- Ticket 04: giao thức gọi không có mặt ----
export const apiParkTicket = (id, parkedUntil) =>
  fetchJson(`/api/tickets/${encodeURIComponent(id)}/park`, { method: 'POST', body: JSON.stringify({ parkedUntil }) });
export const apiRecallTicket = (id) => fetchJson(`/api/tickets/${encodeURIComponent(id)}/recall`, { method: 'POST' });
export const apiPresentTicket = (id) => fetchJson(`/api/tickets/${encodeURIComponent(id)}/present`, { method: 'POST' });
export const apiSkipTicket = (id) => fetchJson(`/api/tickets/${encodeURIComponent(id)}/skip`, { method: 'POST' });
export const apiRejoinTicket = (id) => fetchJson(`/api/tickets/${encodeURIComponent(id)}/rejoin`, { method: 'POST' });
export const apiSweep = () => fetchJson('/api/sweep', { method: 'POST' });
export const apiPublicConfirmPresence = (code) =>
  fetchJson(`/api/public/track/${encodeURIComponent(code)}/confirm`, { method: 'POST' });

// ---- Ticket 05: phòng + lượt khám + gán phòng ----
export const apiRooms = () => fetchJson('/api/rooms');
export const apiSuggestRooms = () => fetchJson('/api/rooms/suggest');
export const apiAssignTicket = (id, roomId) =>
  fetchJson(`/api/tickets/${encodeURIComponent(id)}/assign`, { method: 'POST', body: JSON.stringify({ roomId }) });
export const apiAdmitTicket = (id) => fetchJson(`/api/tickets/${encodeURIComponent(id)}/admit`, { method: 'POST' });
export const apiReassignTicket = (id, roomId) =>
  fetchJson(`/api/tickets/${encodeURIComponent(id)}/reassign`, { method: 'POST', body: JSON.stringify({ roomId }) });

// ---- Ticket 06: Hoàn tác 3 mức + Override ----
export const apiUndoTicket = (id, reason = '') =>
  fetchJson(`/api/tickets/${encodeURIComponent(id)}/undo`, { method: 'POST', body: JSON.stringify({ reason }) });
export const apiOverrideComplete = (id, reason) =>
  fetchJson(`/api/tickets/${encodeURIComponent(id)}/override-complete`, { method: 'POST', body: JSON.stringify({ reason }) });
export const apiOverrideReasons = () => fetchJson('/api/config/override-reasons');

// ---- Ticket 07: Nhóm ưu tiên + Làn cấp cứu + Đoàn ----
export const apiSetPriority = (id, priority, group) =>
  fetchJson(`/api/tickets/${encodeURIComponent(id)}/priority`, { method: 'POST', body: JSON.stringify({ priority, group }) });
export const apiEmergencyLane = (id) =>
  fetchJson(`/api/tickets/${encodeURIComponent(id)}/emergency`, { method: 'POST' });
export const apiGroupAdmission = (patients) =>
  fetchJson('/api/group-admission', { method: 'POST', body: JSON.stringify({ patients }) });

// ---- Ticket 09: Kéo thả 3D World ----
export const apiDragDropAssign = (ticketId, roomId, callNow = false) =>
  fetchJson(`/api/tickets/${encodeURIComponent(ticketId)}/drag-drop`, {
    method: 'POST',
    body: JSON.stringify({ roomId, callNow }),
  });

// ---- Ticket 10: Doctor thin console ----
export const apiDoctorVisits = () => fetchJson('/api/doctor/visits');
export const apiDoctorCompleteAndCallNext = (visitId, roomId, callNow = true) =>
  fetchJson('/api/doctor/complete-and-call-next', { method: 'POST', body: JSON.stringify({ visitId, roomId, callNow }) });
export const apiDoctorException = (visitId, type, roomId) =>
  fetchJson('/api/doctor/exception', { method: 'POST', body: JSON.stringify({ visitId, type, roomId }) });
export const apiDoctorForgotten = () => fetchJson('/api/doctor/forgotten');

// ---- Ticket 11: Khu thu ngân ----
export const apiCashierPending = () => fetchJson('/api/cashier/pending');
export const apiCashierPayment = (visitId) =>
  fetchJson('/api/cashier/payment', { method: 'POST', body: JSON.stringify({ visitId }) });
export const apiCashierEndOfDaySweep = () =>
  fetchJson('/api/cashier/end-of-day-sweep', { method: 'POST' });

// ---- Ticket 12: Admin cấu hình phòng + tham số ----
export const apiAdminRooms = () => fetchJson('/api/admin/rooms');
export const apiAdminCreateRoom = (data) =>
  fetchJson('/api/admin/rooms', { method: 'POST', body: JSON.stringify(data) });
export const apiAdminUpdateRoom = (id, data) =>
  fetchJson(`/api/admin/rooms/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(data) });
export const apiRoomStateChange = (id, data) =>
  fetchJson(`/api/rooms/${encodeURIComponent(id)}/state`, { method: 'PATCH', body: JSON.stringify(data) });
export const apiAdminConfigParams = () => fetchJson('/api/admin/config-params');
export const apiAdminSetConfigParam = (key, value) =>
  fetchJson('/api/admin/config-params', { method: 'POST', body: JSON.stringify({ key, value }) });

// ---- Ticket 13: Admin bulk transfer, events viewer, entered-in-error, metrics ----
export const apiAdminBulkTransferPreview = (sourceRoomId, targetRoomId) =>
  fetchJson('/api/admin/bulk-transfer/preview', { method: 'POST', body: JSON.stringify({ sourceRoomId, targetRoomId }) });
export const apiAdminBulkTransferExecute = (sourceRoomId, targetRoomId, confirm = true) =>
  fetchJson('/api/admin/bulk-transfer/execute', { method: 'POST', body: JSON.stringify({ sourceRoomId, targetRoomId, confirm }) });
export const apiAdminEvents = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return fetchJson(`/api/admin/events${qs ? '?' + qs : ''}`);
};
export const apiAdminMarkEnteredInError = (appointmentId, visitId, reason) =>
  fetchJson('/api/admin/mark-entered-in-error', { method: 'POST', body: JSON.stringify({ appointmentId, visitId, reason }) });
export const apiAdminMetrics = (dateFrom, dateTo) => {
  const params = {};
  if (dateFrom) params.dateFrom = dateFrom;
  if (dateTo) params.dateTo = dateTo;
  const qs = new URLSearchParams(params).toString();
  return fetchJson(`/api/admin/metrics${qs ? '?' + qs : ''}`);
};

export function connectSocket(options = {}) {
  return io({ withCredentials: true, ...options });
}
