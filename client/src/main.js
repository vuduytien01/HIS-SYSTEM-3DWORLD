// Router client theo pathname + trạng thái đăng nhập.
import { apiMe } from './api.js';
import { renderLogin } from './pages/login.js';
import { renderWorkspace } from './pages/workspace.js';
import { renderTv } from './pages/tv.js';

const ROLE_LABELS = { RECEPTIONIST: 'Lễ tân', DOCTOR: 'Bác sĩ', ADMIN: 'Admin' };

export async function boot() {
  const root = document.getElementById('app');

  if (location.pathname === '/tv') {
    renderTv(root);
    return;
  }

  let user = null;
  try {
    user = (await apiMe()).user;
  } catch {
    user = null;
  }

  if (!user) {
    renderLogin(root);
    return;
  }
  renderWorkspace(root, user, ROLE_LABELS[user.role] || user.role);
}

boot();
