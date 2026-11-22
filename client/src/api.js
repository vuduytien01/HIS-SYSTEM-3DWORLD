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

export function connectSocket(options = {}) {
  return io({ withCredentials: true, ...options });
}
