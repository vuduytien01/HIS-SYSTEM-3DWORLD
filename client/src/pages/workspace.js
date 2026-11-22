// Màn hình làm việc theo vai (ticket 01). Ba vai có ba nhánh màn riêng; vai này không render màn vai khác.
import { apiLogout, connectSocket } from '../api.js';
import { ROLE_LABELS } from '../roles.js';
import { renderReception } from './reception.js';

function receptionScreen(root, user) {
  renderReception(root, user);
}

function doctorScreen(root, user) {
  root.innerHTML = `
    <header class="topbar">
      <span class="brand">Điều phối khám bệnh</span>
      <span class="user">${user.displayName} · Bác sĩ</span>
      <button id="logout">Đăng xuất</button>
    </header>
    <main class="workspace">
      <p class="placeholder">Console bác sĩ — nội dung vào ticket 10.</p>
    </main>
  `;
}

function adminScreen(root, user) {
  root.innerHTML = `
    <header class="topbar">
      <span class="brand">Điều phối khám bệnh</span>
      <span class="user">${user.displayName} · Admin</span>
      <button id="logout">Đăng xuất</button>
    </header>
    <main class="workspace">
      <p class="placeholder">Màn cấu hình và giám sát — nội dung vào ticket 12-13.</p>
    </main>
  `;
}

const SCREENS = {
  RECEPTIONIST: receptionScreen,
  DOCTOR: doctorScreen,
  ADMIN: adminScreen,
};

export function renderWorkspace(root, user) {
  const screen = SCREENS[user.role];
  if (!screen) {
    root.innerHTML = `<p class="error">Vai không hợp lệ: ${user.role}</p>`;
    return;
  }
  screen(root, user);

  root.querySelector('#logout').addEventListener('click', async () => {
    await apiLogout();
    location.href = '/';
  });

  const socket = connectSocket();
  socket.on('hello', (msg) => {
    const p = root.querySelector('.placeholder');
    if (p) {
      p.textContent =
        `Realtime hoạt động (kết nối lúc ${new Date(msg.serverTime).toLocaleTimeString('vi-VN')}). Nội dung nghiệp vụ sẽ vào ở các ticket sau.`;
    }
  });
}
