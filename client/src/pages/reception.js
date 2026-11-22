// Màn lễ tân (ticket 02): ô tìm kiếm → hồ sơ → tiếp nhận trong một màn hình; danh sách hẹn + thẻ hàng đợi hôm nay.
import {
  apiSearchPatients, apiCreatePatient, apiCheckInAppointment, apiWalkInCheckIn, apiAppointments, apiTickets,
} from '../api.js';
import { ROLE_LABELS } from '../roles.js';

const GENDER_LABELS = { male: 'Nam', female: 'Nữ', other: 'Khác', unknown: 'Không khai' };
const APPT_STATUS_LABELS = { booked: 'Đã đặt', 'checked-in': 'Đã tiếp nhận', cancelled: 'Đã hủy' };
const QUEUE_STATUS_LABELS = { waiting: 'Chờ gọi', called: 'Đã gọi', present: 'Có mặt', parked: 'Tạm giữ', skipped: 'Bỏ lượt', 'no-show': 'Vắng' };

// Mọi chuỗi từ API được escape trước khi vào innerHTML — dữ liệu người dùng không được tin.
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function timeOf(iso) {
  return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

export function renderReception(root, user) {
  root.innerHTML = `
    <header class="topbar">
      <span class="brand">Điều phối khám bệnh</span>
      <span class="user">${esc(user.displayName)} · ${ROLE_LABELS[user.role] ?? user.role}</span>
      <button id="logout">Đăng xuất</button>
    </header>
    <main class="workspace two-col">
      <section class="panel">
        <h2>Tiếp nhận</h2>
        <input id="search" type="search" placeholder="Nhập vài chữ đầu tên hoặc số điện thoại…" autocomplete="off">
        <ul id="results" class="suggest"></ul>
        <div id="selected" hidden>
          <h3 id="sel-name"></h3>
          <p id="sel-info" class="muted"></p>
          <p id="sel-appt" class="badge-line"></p>
          <button id="checkin" class="primary">Tiếp nhận</button>
        </div>
        <details class="new-patient">
          <summary>Đăng ký hồ sơ mới</summary>
          <form id="new-patient-form">
            <input name="fullName" placeholder="Họ tên" required>
            <input name="dob" type="date" required>
            <select name="gender" required>
              <option value="male">Nam</option>
              <option value="female">Nữ</option>
              <option value="other">Khác</option>
              <option value="unknown">Không khai</option>
            </select>
            <input name="nationalId" placeholder="CCCD" required>
            <input name="medicalRecordNo" placeholder="Mã nội bộ (tùy chọn)">
            <input name="insuranceNo" placeholder="BHYT (tùy chọn)">
            <input name="phone" placeholder="Số điện thoại" required>
            <button class="primary">Lưu hồ sơ</button>
          </form>
        </details>
        <p id="flow-msg"></p>
      </section>
      <section class="panel">
        <h2>Hẹn hôm nay</h2>
        <table class="list">
          <thead><tr><th>Giờ</th><th>Bệnh nhân</th><th>Kênh</th><th>Trạng thái</th></tr></thead>
          <tbody id="appt-tbody"></tbody>
        </table>
        <h2>Thẻ hàng đợi hôm nay</h2>
        <table class="list">
          <thead><tr><th>STT</th><th>Giờ cấp</th><th>Bệnh nhân</th><th>Trạng thái</th></tr></thead>
          <tbody id="ticket-tbody"></tbody>
        </table>
      </section>
    </main>
    <div id="toast" class="toast" hidden></div>
  `;

  const $ = (sel) => root.querySelector(sel);
  let selected = null;
  let bookedAppointment = null;
  let appointmentsCache = [];

  function setMsg(text, isError = false) {
    const el = $('#flow-msg');
    el.textContent = text;
    el.className = isError ? 'error-text' : 'muted';
  }

  let toastTimer;
  function toast(text) {
    const el = $('#toast');
    el.textContent = text;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 4000);
  }

  function renderAppointments(list) {
    $('#appt-tbody').innerHTML = list.length
      ? list.map((a) => `<tr>
          <td>${timeOf(a.scheduledFor)}</td>
          <td>${esc(a.patient.fullName)}</td>
          <td>${a.channel === 'online' ? 'Web' : 'Quầy'}</td>
          <td>${esc(APPT_STATUS_LABELS[a.status] ?? a.status)}</td>
        </tr>`).join('')
      : '<tr><td colspan="4" class="muted">Chưa có hẹn nào trong ngày.</td></tr>';
  }

  function renderTickets(list) {
    $('#ticket-tbody').innerHTML = list.length
      ? list.map((t) => `<tr>
          <td>${t.number}</td>
          <td>${timeOf(t.issuedAt)}</td>
          <td>${esc(t.patient?.fullName ?? '')}</td>
          <td>${esc(QUEUE_STATUS_LABELS[t.status] ?? t.status)}</td>
        </tr>`).join('')
      : '<tr><td colspan="4" class="muted">Chưa có số nào trong ngày.</td></tr>';
  }

  async function refreshLists() {
    const [{ appointments }, { tickets }] = await Promise.all([apiAppointments(), apiTickets()]);
    appointmentsCache = appointments;
    renderAppointments(appointments);
    renderTickets(tickets);
  }

  function clearSelection() {
    selected = null;
    bookedAppointment = null;
    $('#selected').hidden = true;
  }

  function selectPatient(p) {
    selected = p;
    bookedAppointment = appointmentsCache.find((a) => a.patient.id === p.id && a.status === 'booked') ?? null;
    $('#selected').hidden = false;
    $('#sel-name').textContent = p.fullName;
    $('#sel-info').textContent =
      `Sinh ${new Date(p.dob).toLocaleDateString('vi-VN')} · ${GENDER_LABELS[p.gender] ?? p.gender} · CCCD ${p.nationalId} · SĐT ${p.phone}`;
    $('#sel-appt').textContent = bookedAppointment
      ? `Có hẹn hôm nay ${timeOf(bookedAppointment.scheduledFor)} — một cú bấm tiếp nhận`
      : 'Không có hẹn hôm nay — tiếp nhận walk-in';
  }

  let searchTimer;
  $('#search').addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(runSearch, 200);
  });

  async function runSearch() {
    const q = $('#search').value.trim();
    const listEl = $('#results');
    if (q.length < 2) {
      listEl.innerHTML = '';
      return;
    }
    try {
      const { patients } = await apiSearchPatients(q);
      listEl.innerHTML = patients.length
        ? patients.map((p) => `<li><button data-id="${esc(p.id)}">${esc(p.fullName)} · ${esc(p.phone)}</button></li>`).join('')
        : '<li class="muted">Không có hồ sơ khớp — đăng ký hồ sơ mới bên dưới.</li>';
      listEl.querySelectorAll('button[data-id]').forEach((btn) => {
        btn.addEventListener('click', () => selectPatient(patients.find((p) => p.id === btn.dataset.id)));
      });
    } catch (err) {
      listEl.innerHTML = `<li class="error-text">${esc(err.message)}</li>`;
    }
  }

  $('#checkin').addEventListener('click', async () => {
    if (!selected) return;
    const btn = $('#checkin');
    btn.disabled = true;
    try {
      const res = bookedAppointment
        ? await apiCheckInAppointment(bookedAppointment.id)
        : await apiWalkInCheckIn(selected.id);
      toast(`Đã cấp STT ${res.ticket.number} cho ${selected.fullName}`);
      clearSelection();
      $('#results').innerHTML = '';
      $('#search').value = '';
      await refreshLists();
    } catch (err) {
      setMsg(err.message, true);
    } finally {
      btn.disabled = false;
    }
  });

  $('#new-patient-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    try {
      const { patient } = await apiCreatePatient(data);
      e.target.reset();
      selectPatient(patient);
      setMsg(`Đã lưu hồ sơ ${patient.fullName}.`);
    } catch (err) {
      if (err.status === 409 && err.body?.patient) {
        selectPatient(err.body.patient);
        setMsg(`${err.message} — đã chọn hồ sơ có sẵn.`);
      } else {
        setMsg(err.message, true);
      }
    }
  });

  refreshLists();
}
