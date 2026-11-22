// Màn hình làm việc rỗng theo vai (ticket 01) — nội dung nghiệp vụ vào các ticket sau.
import { apiLogout, connectSocket } from '../api.js';

const ROLE_LABELS = { RECEPTIONIST: 'Lễ tân', DOCTOR: 'Bác sĩ', ADMIN: 'Admin' };

export function renderWorkspace(root, user) {
  const label = ROLE_LABELS[user.role] || user.role;
  root.innerHTML = `
    <header class="topbar">
      <span class="brand">Điều phối khám bệnh</span>
      <span class="user">${user.displayName} · ${label}</span>
      <button id="logout">Đăng xuất</button>
    </header>
    <main class="workspace">
      <p class="placeholder">Màn hình ${label} — nội dung nghiệp vụ sẽ vào ở các ticket sau.</p>
    </main>
  `;
  root.querySelector('#logout').addEventListener('click', async () => {
    await apiLogout();
    location.href = '/';
  });

  const socket = connectSocket();
  socket.on('hello', (msg) => {
    root.querySelector('.placeholder').textContent =
      `Realtime hoạt động (kết nối lúc ${new Date(msg.serverTime).toLocaleTimeString('vi-VN')}). Nội dung nghiệp vụ sẽ vào ở các ticket sau.`;
  });
}
