// Trang đăng nhập.
import { apiLogin } from '../api.js';

export function renderLogin(root) {
  root.innerHTML = `
    <div class="login-card">
      <h1>Điều phối khám bệnh</h1>
      <form id="login-form">
        <label>Tài khoản
          <input name="username" autocomplete="username" required />
        </label>
        <label>Mật khẩu
          <input name="password" type="password" autocomplete="current-password" required />
        </label>
        <button type="submit">Đăng nhập</button>
        <p id="login-error" class="error" hidden></p>
      </form>
    </div>
  `;
  const form = root.querySelector('#login-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const errEl = root.querySelector('#login-error');
    errEl.hidden = true;
    try {
      await apiLogin(data.get('username'), data.get('password'));
      location.reload();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.hidden = false;
    }
  });
}
