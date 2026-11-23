// Màn lễ tân (ticket 02): ô tìm kiếm → hồ sơ → tiếp nhận trong một màn hình; danh sách hẹn + thẻ hàng đợi hôm nay.
import {
  apiSearchPatients, apiCreatePatient, apiCheckInAppointment, apiWalkInCheckIn, apiAppointments, apiTickets,
  apiCallTicket, apiParkTicket, apiRecallTicket, apiPresentTicket, apiSkipTicket, apiRejoinTicket, apiSweep,
  apiRooms, apiSuggestRooms, apiAssignTicket, apiAdmitTicket,
  apiUndoTicket, apiOverrideComplete, apiOverrideReasons,
  apiSetPriority, apiEmergencyLane, apiGroupAdmission,
  apiDragDropAssign,
  apiCashierPending, apiCashierPayment, apiCashierEndOfDaySweep,
} from '../api.js';
import { HospitalWorld } from '../world/world.js';
import { ROLE_LABELS } from '../roles.js';
import { GENDER_OPTIONS, genderOptionsHtml } from '../patient-fields.js';

const GENDER_LABELS = Object.fromEntries(GENDER_OPTIONS.map((g) => [g.value, g.label]));
const APPT_STATUS_LABELS = { booked: 'Đã đặt', 'checked-in': 'Đã tiếp nhận', cancelled: 'Đã hủy' };
const QUEUE_STATUS_LABELS = { waiting: 'Chờ gọi', called: 'Đã gọi', present: 'Có mặt', parked: 'Tạm giữ', skipped: 'Bỏ lượt', 'no-show': 'Vắng' };
const PRIORITY_LABELS = { emergency: 'Cấp cứu', urgent: 'Khẩn cấp', asap: 'Sớm', routine: 'Thường' };
const PRIORITY_GROUPS = {
  emergency: ['elderly', 'disability', 'pregnant', 'emergency-light'],
  urgent: [],
  asap: [],
  routine: [],
};

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
    <main class="workspace three-col">
      <section class="panel">
        <h2>Tiếp nhận</h2>
        <input id="search" type="search" placeholder="Nhập vài chữ đầu tên hoặc số điện thoại…" autocomplete="off">
        <ul id="results" class="suggest"></ul>
        <div id="selected" hidden>
          <h3 id="sel-name"></h3>
          <p id="sel-info" class="muted"></p>
          <p id="sel-appt" class="badge-line"></p>
          <button id="checkin" class="primary">Tiếp nhận</button>
          <div id="priority-controls" hidden>
            <label>Ưu tiên
              <select id="priority-select">
                <option value="routine">Thường</option>
                <option value="asap">Sớm</option>
                <option value="urgent">Khẩn cấp</option>
                <option value="emergency">Cấp cứu</option>
              </select>
            </label>
            <label>Nhóm QĐ 1313
              <select id="priority-group-select">
                <option value="">Không nhóm</option>
                <option value="elderly">Cao tuổi</option>
                <option value="disability">Khuyết tật</option>
                <option value="pregnant">Thai phụ</option>
                <option value="emergency-light">Cấp cứu nhẹ</option>
              </select>
            </label>
            <button id="set-priority" class="primary">Cập nhật ưu tiên</button>
            <button id="emergency-lane" class="primary" style="background:#b91c1c;margin-left:8px">Làn cấp cứu</button>
          </div>
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
        <details class="new-patient">
          <summary>Tiếp nhận đoàn (khám sức khỏe hợp đồng)</summary>
          <form id="group-form">
            <textarea id="group-patients" placeholder="Danh sách bệnh nhân, mỗi dòng: Họ tên|Ngày sinh|Giới tính|CCCD|SĐT" rows="6" style="width:100%;font-family:monospace;padding:8px;border:1px solid #d1d5db;border-radius:6px" required></textarea>
            <div class="muted" style="font-size:12px;margin:4px 0">Định dạng: Nguyễn Văn A|1990-01-01|male|C123456789|0901234567</div>
            <button class="primary">Tiếp nhận đoàn</button>
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
      <section class="panel world-panel">
        <h2>3D World quan sát</h2>
        <div id="world-container" style="width:100%;height:400px;border:1px solid #e5e7eb;border-radius:8px;background:#f9fafb"></div>
        <div class="world-controls" style="margin-top:8px">
          <button id="world-reload" class="primary">Tải lại world</button>
          <span class="muted" id="world-status">Đang tải...</span>
        </div>
      </section>
      <section class="panel cashier-panel">
        <h2>Khu thu ngân — bệnh nhân chờ thanh toán</h2>
        <table class="list">
          <thead><tr><th>STT</th><th>Bệnh nhân</th><th>Phòng khám</th><th>Xong khám lúc</th><th>Thao tác</th></tr></thead>
          <tbody id="cashier-tbody"></tbody>
        </table>
        <div style="margin-top:8px;display:flex;gap:8px">
          <button id="cashier-refresh" class="primary">Làm mới</button>
          <button id="cashier-sweep" class="primary" style="background:#b91c1c">Sweep cuối ngày (in-progress treo → discharged + autoClosed)</button>
        </div>
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
    present: [
      { act: 'undo', label: 'Hoàn tác', api: (id) => apiUndoTicket(id, '') },
      { act: 'override', label: 'Override đóng', api: (id) => apiOverrideComplete(id, '') },
    ],
    'in-progress': [
      { act: 'undo', label: 'Hoàn tác', api: (id) => apiUndoTicket(id, '') },
      { act: 'override', label: 'Override đóng', api: (id) => apiOverrideComplete(id, '') },
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
          // Hiển thị groupId nếu là đoàn.
          const groupBadge = t.groupId ? `<span class="group-badge" style="background:#e0e7ff;color:#3730a3;padding:2px 6px;border-radius:999px;font-size:11px;margin-left:6px">${esc(t.groupId)}</span>` : '';
          return `<tr>
            <td>${t.number}</td>
            <td>${timeOf(t.issuedAt)}</td>
            <td>${esc(t.patient?.fullName ?? '')} ${groupBadge}</td>
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
    updatePriorityControls();
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
    updatePriorityControls();
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

  // Cập nhật ưu tiên + nhóm QĐ 1313.
  $('#set-priority').addEventListener('click', async () => {
    if (!selected) return;
    try {
      const res = await apiSetPriority(selected.id, $('#priority-select').value, $('#priority-group-select').value || null);
      toast(`Đã cập nhật ưu tiên: ${PRIORITY_LABELS[res.priority]}`);
      await refreshLists();
    } catch (err) {
      setMsg(err.message, true);
    }
  });

  // Làn cấp cứu một cú bấm.
  $('#emergency-lane').addEventListener('click', async () => {
    if (!selected) return;
    if (!confirm('Mở làn cấp cứu cho bệnh nhân này? Sẽ đóng mọi hàng chờ cũ.')) return;
    try {
      const res = await apiEmergencyLane(selected.id);
      toast(`Đã mở làn cấp cứu, ticket mới STT ${res.newTicket.number}`);
      clearSelection();
      $('#results').innerHTML = '';
      $('#search').value = '';
      await refreshLists();
    } catch (err) {
      setMsg(err.message, true);
    }
  });

  // Tiếp nhận đoàn.
  $('#group-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = root.querySelector('#group-patients').value.trim();
    if (!text) return;
    const lines = text.split('\n').filter((l) => l.trim());
    const patients = lines.map((line) => {
      const [fullName, dob, gender, nationalId, phone] = line.split('|').map((s) => s.trim());
      return { fullName, dob, gender, nationalId, phone };
    });
    try {
      const res = await apiGroupAdmission(patients);
      toast(`Đã tiếp nhận đoàn ${res.groupId}: ${res.tickets.length} bệnh nhân`);
      e.target.reset();
      await refreshLists();
    } catch (err) {
      setMsg(err.message, true);
    }
  });

  // Hiển thị controls ưu tiên khi chọn bệnh nhân có visit present/in-progress.
  const updatePriorityControls = () => {
    const el = root.querySelector('#priority-controls');
    if (!el) return;
    if (selected && selected.visit && (selected.visit.status === 'present' || selected.visit.status === 'in-progress')) {
      el.hidden = false;
    } else {
      el.hidden = true;
    }
  };
  let overrideReasons = [];

  async function loadOverrideReasons() {
    try {
      overrideReasons = (await apiOverrideReasons()).reasons;
    } catch { overrideReasons = ['khẩn cấp', 'lỗi nhập', 'bệnh nhân yêu cầu', 'phòng hỏng', 'khác']; }
  }

  async function promptReason(title, defaultReason = '') {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;z-index:1000';
      overlay.innerHTML = `
        <div style="background:#fff;padding:24px;border-radius:10px;min-width:320px;box-shadow:0 8px 24px rgba(0,0,0,.2)">
          <h3 style="margin:0 0 12px">${title}</h3>
          <select id="reason-select" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;margin-bottom:12px">
            ${overrideReasons.map((r) => `<option value="${r}">${r}</option>`).join('')}
            <option value="">Khác (nhập tự do)</option>
          </select>
          <input id="reason-custom" type="text" placeholder="Nhập lý do khác" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;margin-bottom:12px;display:none">
          <div style="display:flex;gap:8px;justify-content:flex-end">
            <button id="reason-cancel" style="padding:8px 16px;border:1px solid #d1d5db;border-radius:6px;background:#fff">Hủy</button>
            <button id="reason-ok" class="primary" style="padding:8px 16px">Xác nhận</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      const select = overlay.querySelector('#reason-select');
      const custom = overlay.querySelector('#reason-custom');
      select.value = defaultReason;
      select.addEventListener('change', () => {
        custom.style.display = select.value === '' ? 'block' : 'none';
      });
      if (defaultReason && !overrideReasons.includes(defaultReason)) {
        custom.value = defaultReason;
        custom.style.display = 'block';
      }
      const cleanup = () => { overlay.remove(); };
      overlay.querySelector('#reason-ok').addEventListener('click', () => {
        const val = select.value === '' ? custom.value.trim() : select.value;
        if (!val) { alert('Vui lòng chọn hoặc nhập lý do'); return; }
        resolve(val);
        cleanup();
      });
      overlay.querySelector('#reason-cancel').addEventListener('click', () => { resolve(null); cleanup(); });
      overlay.addEventListener('click', (e) => { if (e.target === overlay) { resolve(null); cleanup(); } });
    });
  }

  async function handleActionWithReason(action, ticketId, reasonRequired = true) {
    let reason = '';
    if (reasonRequired) {
      await loadOverrideReasons();
      reason = await promptReason('Chọn lý do');
      if (!reason) return;
    }
    try {
      const res = action === 'undo'
        ? await apiUndoTicket(ticketId, reason)
        : await apiOverrideComplete(ticketId, reason);
      toast(`Số ${res.number ?? res.visit?.id}: đã xử lý`);
      await refreshLists();
    } catch (err) {
      setMsg(err.message, true);
    }
  }

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
        : btn.dataset.action === 'undo'
          ? await handleActionWithReason('undo', btn.dataset.id, true)
          : btn.dataset.action === 'override'
            ? await handleActionWithReason('override', btn.dataset.id, true)
            : await Object.values(TICKET_ACTIONS).flat().find((a) => a.act === btn.dataset.action).api(btn.dataset.id);
      if (res && res.number) toast(`Số ${res.number}: ${QUEUE_STATUS_LABELS[res.status] ?? res.room?.name ?? 'đã xử lý'}`);
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

  // Khởi tạo 3D World
  let world = null;
  async function initWorld() {
    try {
      const container = root.querySelector('#world-container');
      const status = root.querySelector('#world-status');
      if (!container) return;
      status.textContent = 'Đang tải cấu hình phòng...';
      const config = await apiRooms();
      world = new HospitalWorld(container, connectSocket());
      await world.buildWorld(config);
      status.textContent = `Đã tải ${config.rooms.length} phòng`;
      // Nút tải lại
      root.querySelector('#world-reload').addEventListener('click', async () => {
        const cfg = await apiRooms();
        await world.buildWorld(cfg);
        status.textContent = `Đã tải lại ${cfg.rooms.length} phòng`;
      });
    } catch (err) {
      const status = root.querySelector('#world-status');
      status.textContent = 'Lỗi: ' + err.message;
    }
  }

  initWorld();

  // Lắng nghe sự kiện room.state.changed từ socket để cập nhật world
  const ws = connectSocket();
  ws.on('config.changed', () => {
    if (world) initWorld();
  });
  ws.on('room.state.changed', (payload) => {
    if (world) world.updateRoom(payload);
  });
  ws.on('queue:snapshot', (snap) => {
    if (world) world.applySnapshot(snap);
  });
  ws.on('call.issued', (payload) => {
    if (world) world.handleCallIssued(payload);
  });
  ws.on('queue.ticket.changed', (payload) => {
    if (world) {
      // Cập nhật agent khi ticket đổi trạng thái
      // world.applySnapshot sẽ được gọi qua queue:snapshot
    }
  });

  // Drag-drop callbacks cho 3D World
  world.onDragReject = (payload) => {
    const { ticketId, reason, suggestedRoomId, originalPosition } = payload;
    // Hiển thị thông báo từ chối
    toast(`Xếp phòng bị từ chối: ${reason}`);
    // Nút gợi ý phòng kế tiếp
    if (suggestedRoomId) {
      const room = roomsCache.find((r) => r.id === suggestedRoomId);
      if (room) {
        setMsg(`Gợi ý: ${room.name} (${room.load}/${room.capacity})`, false);
      }
    }
    // Agent đã được move về vị trí cũ bởi world.handleDragReject
  };

  world.onDragAccept = (payload) => {
    const { ticketId, roomId, callNow, transactionId } = payload;
    // Refresh lists để cập nhật UI
    refreshLists();
    if (callNow) {
      toast(`Đã gọi số cho ticket mới`);
    }
  };

  // Kéo thả từ 3D World - server là thẩm quyền
  // world sẽ emit 'drag.request' khi user drop agent vào phòng
  // Client gửi POST /api/tickets/:id/drag-drop, server trả accept/reject
  // world sẽ lắng nghe drag.reject / drag.accept
  console.log('3D World drag-drop ready');

  // ---- Khu thu ngân ----
  async function refreshCashier() {
    try {
      const { visits } = await apiCashierPending();
      $('#cashier-tbody').innerHTML = visits.length
        ? visits.map((v) => {
            const p = v.ticket?.patient;
            const completedAt = v.updatedAt ? timeOf(v.updatedAt) : '--:--';
            return `<tr>
              <td>${esc(v.ticket?.number ?? '--')}</td>
              <td>${esc(p?.fullName ?? '--')}</td>
              <td>${esc(v.room?.name ?? '--')}</td>
              <td>${esc(completedAt)}</td>
              <td><button class="primary" data-pay="${esc(v.id)}">Đóng tiền → completed</button></td>
            </tr>`;
          }).join('')
        : '<tr><td colspan="5" class="muted">Không có bệnh nhân chờ thanh toán.</td></tr>';

      $('#cashier-tbody').querySelectorAll('button[data-pay]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const visitId = btn.dataset.pay;
          try {
            const res = await apiCashierPayment(visitId);
            toast(`Đã đóng tiền cho STT ${res.visit?.ticket?.number ?? visitId}`);
            await refreshCashier();
          } catch (err) {
            alert(err.message);
          }
        });
      });
    } catch (err) {
      console.error('refreshCashier error:', err);
    }
  }

  $('#cashier-refresh').addEventListener('click', refreshCashier);
  $('#cashier-sweep').addEventListener('click', async () => {
    if (!confirm('Sweep cuối ngày: chuyển TẤT CẢ in-progress treo (>4h không cập nhật) → discharged + autoClosed. Không bao giờ tự completed. Tiếp tục?')) return;
    try {
      const res = await apiCashierEndOfDaySweep();
      toast(`Sweep cuối ngày: ${res.swept} lượt autoClosed`);
      await refreshCashier();
      await refreshLists();
    } catch (err) {
      alert(err.message);
    }
  });

  // Khởi tạo refresh cashier
  refreshCashier();
  // Auto-refresh mỗi 30 giây
  setInterval(refreshCashier, 30000);
}
