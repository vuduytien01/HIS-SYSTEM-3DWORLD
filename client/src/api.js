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
    throw err;
  }
  return res.status === 204 ? null : res.json();
}

export const apiLogin = (username, password) =>
  fetchJson('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });

export const apiLogout = () => fetchJson('/api/auth/logout', { method: 'POST' });

export const apiMe = () => fetchJson('/api/me');

export function connectSocket() {
  return io({ withCredentials: true });
}
