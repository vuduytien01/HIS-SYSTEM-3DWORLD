// Router client theo pathname + trạng thái đăng nhập.
import { apiMe } from './api.js';
import { ROLE_LABELS } from './roles.js';
import { renderLogin } from './pages/login.js';
import { renderWorkspace } from './pages/workspace.js';
import { renderTv } from './pages/tv.js';
import { renderBook } from './pages/book.js';

export async function boot() {
  const root = document.getElementById('app');

  if (location.pathname === '/tv') {
    renderTv(root);
    return;
  }

  if (location.pathname === '/book') {
    renderBook(root);
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
  renderWorkspace(root, user);
}
