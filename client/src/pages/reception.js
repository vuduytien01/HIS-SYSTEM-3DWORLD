// Màn lễ tân (ticket 02): ô tìm kiếm → hồ sơ → tiếp nhận trong một màn hình; danh sách hẹn + thẻ hàng đợi hôm nay.
import {
  apiSearchPatients, apiCreatePatient, apiCheckInAppointment, apiWalkInCheckIn, apiAppointments, apiTickets,
  apiCallTicket, apiParkTicket, apiRecallTicket, apiPresentTicket, apiSkipTicket, apiRejoinTicket, apiSweep,
  apiRooms, apiSuggestRooms, apiAssignTicket, apiAdmitTicket,
} from '../api.js';
import { ROLE_LABELS } from '../roles.js';
import { GENDER_OPTIONS, genderOptionsHtml } from '../patient-fields.js';

const GENDER_LABELS = Object.fromEntries(GENDER_OPTIONS.map((g) => [g.value, g.label]));
const APPT_STATUS_LABELS = { booked: 'Đã đặt', 'checked-in': 'Đã tiếp nhận', cancelled: 'Đã hủy' };
const QUEUE_STATUS_LABELS = { waiting: 'Chờ gọi', called: 'Đã gọi', present: 'Có mặt', parked: 'Tạm giữ', skipped: 'Bỏ lượt', 'no-show': 'Vắng' };

// Mọi chuỗi từ API được escape trước khi vào innerHTML — dữ liệu người dùng không được tin.
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function timeOf(iso) {
  return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

let parkBadgeTimer = null;

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
              ${genderOptionsHtml()}
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
          <thead><tr><th>STT</th><th>Giờ cấp</th><th>Bệnh nhân</th><th>Trạng thái</th><th>Thao tác</th><th>Phòng</th></tr></thead>
          <tbody id="ticket-tbody"></tbody>
        </table>
        <button id="sweep" class="primary">Sweep cuối phiên — skipped chuyển no-show</button>
      </section>
    </main>
    <div id="toast" class="toast" hidden></div>
  `;

  const $ = (sel) => root.querySelector(sel);
  let selected = null;
  let bookedAppointment = null;
  let appointmentsCache = [];
  let roomsCache = [];

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

  // Nút một cú bấm theo trạng thái (ticket 04): hành động + nhãn + API trong một bảng.
  const TICKET_ACTIONS = {
    waiting: [{ act: 'call', label: 'Gọi', api: apiCallTicket }],
    called: [
      { act: 'recall', label: 'Gọi lại', api: apiRecallTicket },
      { act: 'present', label: 'Có mặt', api: apiPresentTicket },
      { act: 'park', label: 'Tạm giữ', api: (id) => apiParkTicket(id, null) },
      { act: 'skip', label: 'Bỏ lượt', api: apiSkipTicket },
    ],
    parked: [
      { act: 'recall', label: 'Gọi lại', api: apiRecallTicket },
      { act: 'present', label: 'Có mặt', api: apiPresentTicket },
      { act: 'skip', label: 'Bỏ lượt', api: apiSkipTicket },
    ],
    skipped: [{ act: 'rejoin', label: 'Quay lại', api: apiRejoinTicket }],
    'no-show': [{ act: 'rejoin', label: 'Quay lại', api: apiRejoinTicket }],
  };

  function renderTickets(list, suggestions) {
    const roomName = new Map(roomsCache.map((r) => [r.id, r.name]));
    $('#ticket-tbody').innerHTML = list.length
      ? list.map((t) => {
          const actions = (TICKET_ACTIONS[t.status] ?? [])
            .map((a) => `<button class="primary" data-action="${a.act}" data-id="${esc(t.id)}">${a.label}</button>`)
            .join(' ');
          const badge = t.status === 'parked' && t.parkedUntil
            ? `<span class="park-badge" data-until="${esc(t.parkedUntil)}">giữ đến ${timeOf(t.parkedUntil)}</span>`
            : '';
          // Cột phòng: có lượt khám → tên phòng + trạng thái; chưa → select gợi ý (đầu danh sách là phòng ít tải nhất) + nút xếp
          let roomCell = '';
          if (t.visit) {
            const vLabel = t.visit.status === 'in-progress' ? 'đang khám' : (t.visit.status === 'planned' ? 'đã xếp' : t.visit.status);
            roomCell = `<span class="room-tag">${esc(roomName.get(t.visit.roomId) ?? '?')} · ${vLabel}</span>`;
            if (t.visit.status === 'planned' && t.status === 'present') {
              roomCell += ` <button class="primary" data-action="admit" data-id="${esc(t.id)}">Vào phòng</button>`;
            }
          } else if (t.status === 'waiting' || t.status === 'present') {
            const options = suggestions.map((r, i) =>
              `<option value="${esc(r.id)}">${esc(r.name)} (${r.load}/${r.capacity})${i === 0 ? ' — gợi ý' : ''}</option>`).join('');
            roomCell = suggestions.length
              ? `<select class="room-select" data-assign="${esc(t.id)}">${options}</select>
                 <button class="primary" data-assign-go="${esc(t.id)}">Xếp</button>`
              : '<span class="muted">Không còn phòng trống</span>';
          }
          return `<tr>
            <td>${t.number}</td>
            <td>${timeOf(t.issuedAt)}</td>
            <td>${esc(t.patient?.fullName ?? '')}</td>
            <td>${esc(QUEUE_STATUS_LABELS[t.status] ?? t.status)} ${badge}</td>
            <td>${actions}</td>
            <td>${roomCell}</td>
          </tr>`;
        }).join('')
      : '<tr><td colspan="6" class="muted">Chưa có số nào trong ngày.</td></tr>';
  }

  async function refreshLists() {
    const [{ appointments }, { tickets }, { rooms }, { rooms: suggestions }] = await Promise.all([
      apiAppointments(), apiTickets(), apiRooms(), apiSuggestRooms(),
    ]);
    appointmentsCache = appointments;
    roomsCache = rooms;
    renderAppointments(appointments);
    renderTickets(tickets, suggestions);
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

  // Nút một cú bấm từ bảng: server là thẩm quyền, client chỉ chuyển tiếp.
  $('#ticket-tbody').addEventListener('click', async (e) => {
    const assignBtn = e.target.closest('button[data-assign-go]');
    if (assignBtn) {
      const select = root.querySelector(`select[data-assign="${assignBtn.dataset.assignGo}"]`);
      if (!select?.value) return;
      try {
        const res = await apiAssignTicket(assignBtn.dataset.assignGo, select.value);
        toast(`Đã xếp vào ${res.room.name}`);
        await refreshLists();
      } catch (err) {
        setMsg(err.message, true);
      }
      return;
    }
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    try {
      const res = btn.dataset.action === 'admit'
        ? await apiAdmitTicket(btn.dataset.id)
        : await Object.values(TICKET_ACTIONS).flat().find((a) => a.act === btn.dataset.action).api(btn.dataset.id);
      toast(`Số ${res.number}: ${QUEUE_STATUS_LABELS[res.status] ?? res.room?.name ?? 'đã xử lý'}`);
      await refreshLists();
    } catch (err) {
      setMsg(err.message, true);
    }
  });

  $('#sweep').addEventListener('click', async () => {
    try {
      const { moved } = await apiSweep();
      toast(`Sweep: ${moved} thẻ skipped chuyển no-show`);
      await refreshLists();
    } catch (err) {
      setMsg(err.message, true);
    }
  });

  // Badge đồng hồ tạm giữ đếm ngược mỗi giây; chỉ một interval sống trong phiên.
  if (parkBadgeTimer) clearInterval(parkBadgeTimer);
  parkBadgeTimer = setInterval(() => {
    root.querySelectorAll('.park-badge').forEach((el) => {
      const left = new Date(el.dataset.until).getTime() - Date.now();
      if (left <= 0) {
        el.textContent = 'hết giờ giữ';
        return;
      }
      const m = Math.floor(left / 60000);
      const s = Math.floor((left % 60000) / 1000);
      el.textContent = `giữ còn ${m}:${String(s).padStart(2, '0')}`;
    });
  }, 1000);

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
