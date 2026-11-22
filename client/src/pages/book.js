// Kênh web công cộng (/book): bệnh nhân đặt kế hoạch hẹn online — không cần đăng nhập.
import { apiPublicBook } from '../api.js';
import { genderOptionsHtml } from '../patient-fields.js';

export function renderBook(root) {
  root.innerHTML = `
    <div class="book-card">
      <h1>Đặt lịch hẹn khám</h1>
      <p class="muted">Nhập thông tin của bạn; đến quầy check-in để nhận số thứ tự trong ngày.</p>
      <form id="book-form">
        <label>Họ tên<input name="fullName" required></label>
        <label>Ngày sinh<input name="dob" type="date" required></label>
        <label>Giới tính
          <select name="gender" required>
            ${genderOptionsHtml()}
          </select>
        </label>
        <label>CCCD<input name="nationalId" required></label>
        <label>Mã bệnh nhân nội bộ (tùy chọn)<input name="medicalRecordNo"></label>
        <label>BHYT (tùy chọn)<input name="insuranceNo"></label>
        <label>Số điện thoại<input name="phone" type="tel" required></label>
        <label>Thời gian hẹn<input name="scheduledFor" type="datetime-local" required></label>
        <button>Đặt hẹn</button>
        <p id="book-msg"></p>
      </form>
    </div>
  `;

  root.querySelector('#book-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    const msg = root.querySelector('#book-msg');
    try {
      const { appointment, created } = await apiPublicBook({
        ...data,
        scheduledFor: new Date(data.scheduledFor).toISOString(),
      });
      msg.className = 'ok-line';
      msg.textContent = `${created ? 'Đã đặt' : 'Hồ sơ đã có — đã đặt'} hẹn cho ${appointment.patient.fullName} lúc ${new Date(appointment.scheduledFor).toLocaleString('vi-VN')}. Đến quầy check-in để nhận số thứ tự.`;
      e.target.reset();
    } catch (err) {
      msg.className = 'error-text';
      msg.textContent = err.message;
    }
  });
}
