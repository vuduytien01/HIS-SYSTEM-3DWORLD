// Admin cấu hình Phòng + tham số vận hành (ticket 12).
// Gọi từ client/src/main.js khi pathname === '/admin'
// Đọc/ghi: Room (code bất biến, tên hiển thị, kind, toạ độ 3D, capacity, prefix, zone, specialty, shiftSchedule, doctorId, sharedQueue, active, state)
//        Config (key, value)
// User instruction: "Main Flow: /grill-with-docs → /to-spec → /to-tickets → /implement → /code-review → /retro"
import {
  apiAdminRooms, apiAdminCreateRoom, apiAdminUpdateRoom,
  apiAdminConfigParams, apiAdminSetConfigParam,
  apiRoomStateChange,
  apiAdminBulkTransferPreview, apiAdminBulkTransferExecute,
  apiAdminEvents, apiAdminMarkEnteredInError, apiAdminMetrics,
} from '../api.js';
import { ROLE_LABELS } from '../roles.js';

const ROOM_KIND_LABELS = { CONSULT: 'Khám', ANCILLARY: 'Cận lâm sàng', CASHIER: 'Thu ngân' };
const ROOM_STATE_LABELS = { free: 'Trống', reserved: 'Đã xếp', occupied: 'Đang khám', cleaning: 'Vệ sinh', disabled: 'Khóa', alert: 'Cần xử lý' };
const ROOM_STATE_COLORS = { free: '#4ade80', reserved: '#fbbf24', occupied: '#f87171', cleaning: '#60a5fa', disabled: '#9ca3af', alert: '#ef4444' };

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&', '<': '<', '>': '>', '"': '"', "'": "'" }[c]));
}

let toastTimer;
function toast(root, text) {
  const el = root.querySelector('#toast');
  if (!el) return;
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 4000);
}

export function renderAdmin(root, user) {
  root.innerHTML = `
    <header class="topbar">
      <span class="brand">Điều phối khám bệnh</span>
      <span class="user">${esc(user.displayName)} · ${ROLE_LABELS[user.role] ?? user.role}</span>
      <button id="logout">Đăng xuất</button>
    </header>
    <main class="workspace admin-workspace">
      <section class="panel">
        <h2>Cấu hình Phòng</h2>
        <div style="display:flex;gap:16px;margin-bottom:16px">
          <button id="add-room-btn" class="primary">+ Thêm phòng mới</button>
          <button id="reload-rooms" class="secondary">Tải lại</button>
        </div>
        <table class="list">
          <thead>
            <tr>
              <th>Mã</th><th>Tên hiển thị</th><th>Loại</th><th>Trạng thái</th>
              <th>Sức chứa</th><th>Tiền tố STT</th><th>Vị trí 3D</th><th>Khu vực</th><th>Chuyên khoa</th><th>Ca trực</th><th>Bác sĩ trực</th><th>Hàng chờ chung</th><th>Hoạt động</th><th>Thao tác</th>
            </tr>
          </thead>
          <tbody id="rooms-tbody"></tbody>
        </table>
      </section>

      <section class="panel">
        <h2>Tham số vận hành</h2>
        <div style="margin-bottom:16px">
          <button id="reload-params" class="secondary">Tải lại</button>
          <span class="muted" style="margin-left:8px">configVersion: <span id="config-version">--</span></span>
        </div>
        <table class="list">
          <thead><tr><th>Key</th><th>Giá trị</th><th>Thao tác</th></tr></thead>
          <tbody id="params-tbody"></tbody>
        </table>
        <form id="param-form" style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap">
          <input name="key" placeholder="key (vd: maxRecalls, parkedHoldMs, forgotThresholdMultiplier...)" required style="flex:1;min-width:200px;padding:8px;border:1px solid #d1d5db;border-radius:6px">
          <input name="value" placeholder="value" required style="flex:1;min-width:150px;padding:8px;border:1px solid #d1d5db;border-radius:6px">
          <button class="primary">Cập nhật / Tạo mới</button>
        </form>
      </section>

      <section class="panel">
        <h2>Chuyển khối (Bulk Transfer)</h2>
        <div style="display:flex;gap:16px;margin-bottom:16px;flex-wrap:wrap;align-items:end">
          <div>
            <label>Phòng nguồn <select id="bulk-source-room" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px"><option value="">Chọn phòng nguồn</option></select></label>
          </div>
          <div>
            <label>Phòng đích <select id="bulk-target-room" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px"><option value="">Chọn phòng đích</option></select></label>
          </div>
          <button id="bulk-preview-btn" class="primary">Xem trước</button>
        </div>
        <div id="bulk-preview-panel" hidden style="border:1px solid #e5e7eb;border-radius:8px;padding:16px;background:#f9fafb">
          <h3>Xem trước chuyển khối</h3>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px">
            <div><strong>Số lượng:</strong> <span id="bulk-preview-count">0</span></div>
            <div><strong>Phòng đích hiện tại:</strong> <span id="bulk-preview-target-cap">0/0</span></div>
            <div><strong>Trạng thái:</strong> <span id="bulk-will-exceed">OK</span></div>
            <div></div>
          </div>
          <table class="list" style="max-height:300px;overflow:auto">
            <thead><tr><th>STT</th><th>Bệnh nhân</th><th>Trạng thái</th></tr></thead>
            <tbody id="bulk-preview-tbody"></tbody>
          </table>
          <div style="margin-top:12px;text-align:right">
            <button id="bulk-execute-btn" class="primary" disabled>Xác nhận chuyển</button>
          </div>
        </div>
      </section>

      <section class="panel">
        <h2>Kho sự kiện (Event Viewer)</h2>
        <form id="events-filter-form" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;align-items:end">
          <input name="type" placeholder="Loại sự kiện (vd: queue.ticket.changed)" style="padding:8px;border:1px solid #d1d5db;border-radius:6px">
          <input name="roomId" placeholder="Room ID" style="padding:8px;border:1px solid #d1d5db;border-radius:6px">
          <input name="patientId" placeholder="Patient ID" style="padding:8px;border:1px solid #d1d5db;border-radius:6px">
          <input name="actorUserId" placeholder="Actor User ID" style="padding:8px;border:1px solid #d1d5db;border-radius:6px">
          <input name="dateFrom" type="date" style="padding:8px;border:1px solid #d1d5db;border-radius:6px">
          <input name="dateTo" type="date" style="padding:8px;border:1px solid #d1d5db;border-radius:6px">
          <input name="limit" type="number" value="100" min="1" max="500" style="width:80px;padding:8px;border:1px solid #d1d5db;border-radius:6px">
          <button type="submit" class="primary">Lọc</button>
        </form>
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
          <span>Tổng: <strong id="events-total">0</strong></span>
          <button id="events-prev" class="secondary">Trang trước</button>
          <button id="events-next" class="secondary">Trang sau</button>
        </div>
        <table class="list" style="max-height:400px;overflow:auto">
          <thead><tr><th>Thời gian</th><th>Loại</th><th>Actor</th><th>Aggregate ID</th><th>Payload (Provenance)</th></tr></thead>
          <tbody id="events-tbody"></tbody>
        </table>
      </section>

      <section class="panel">
        <h2>Nhập nhầm (Entered-in-error)</h2>
        <form id="eie-form" style="display:flex;gap:8px;flex-wrap:wrap;align-items:end">
          <div>
            <label>Appointment ID <input name="appointmentId" placeholder="ID appointment (tùy chọn)" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px"></label>
          </div>
          <div>
            <label>Visit ID <input name="visitId" placeholder="ID visit (tùy chọn)" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px"></label>
          </div>
          <div>
            <label>Lý do <input name="reason" placeholder="Lý do nhập nhầm" required style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px"></label>
          </div>
          <button type="submit" class="primary">Đánh dấu entered-in-error</button>
        </form>
        <p class="muted" style="margin-top:8px">Bản ghi entered-in-error bị loại khỏi thống kê nhưng giữ nguyên trong hồ sơ pháp lý.</p>
      </section>

      <section class="panel">
        <h2>Dashboard Metric Giám sát</h2>
        <form id="metrics-form" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;align-items:end">
          <div>
            <label>Từ ngày <input name="dateFrom" type="date" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px"></label>
          </div>
          <div>
            <label>Đến ngày <input name="dateTo" type="date" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px"></label>
          </div>
          <button type="submit" class="primary">Tải metric</button>
        </form>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:16px">
          <div style="background:#f0f9ff;padding:16px;border-radius:8px;border:1px solid #bae6fd">
            <div class="muted">p50 Thời gian chờ</div>
            <div style="font-size:24px;font-weight:700;color:#0369a1" id="metric-p50">--</div>
          </div>
          <div style="background:#fef3c2;padding:16px;border-radius:8px;border:1px solid #fde68a">
            <div class="muted">p90 Thời gian chờ</div>
            <div style="font-size:24px;font-weight:700;color:#b45309" id="metric-p90">--</div>
          </div>
          <div style="background:#f3f4f6;padding:16px;border-radius:8px;border:1px solid #d1d5db">
            <div class="muted">Đổi ưu tiên</div>
            <div style="font-size:24px;font-weight:700" id="metric-priority-changes">0</div>
          </div>
          <div style="background:#fef2f2;padding:16px;border-radius:8px;border:1px solid #fecaca">
            <div class="muted">Tỷ lệ Override</div>
            <div style="font-size:24px;font-weight:700;color:#b91c1c" id="metric-override-rate">0%</div>
          </div>
        </div>
        <div style="background:#f9fafb;padding:16px;border-radius:8px;border:1px solid #e5e7eb">
          <div class="muted">Tổng ticket trong kỳ: <strong id="metric-total-tickets">0</strong></div>
          <div id="metric-alerts" style="margin-top:8px"></div>
        </div>
      </section>

      <!-- Modal thêm/sửa phòng -->
      <div id="room-modal" class="modal-overlay" hidden>
        <div class="modal-content" style="max-width:600px;max-height:80vh;overflow:auto">
          <h3 id="modal-title">Thêm phòng mới</h3>
          <form id="room-form">
            <input type="hidden" name="id">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
              <div>
                <label>Mã phòng (bất biến) <input name="code" required placeholder="ROOM01" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px"></label>
              </div>
              <div>
                <label>Tên hiển thị <input name="name" required placeholder="Phòng khám 1" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px"></label>
              </div>
              <div>
                <label>Loại
                  <select name="kind" required style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px">
                    <option value="CONSULT">Khám (CONSULT)</option>
                    <option value="ANCILLARY">Cận lâm sàng (ANCILLARY)</option>
                    <option value="CASHIER">Thu ngân (CASHIER)</option>
                  </select>
                </label>
              </div>
              <div>
                <label>Sức chứa <input name="capacity" type="number" min="1" value="1" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px"></label>
              </div>
              <div>
                <label>Tiền tố STT <input name="prefix" placeholder="K" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px"></label>
              </div>
              <div>
                <label>Khu vực (zone) <input name="zone" placeholder="A" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px"></label>
              </div>
              <div>
                <label>Chuyên khoa <input name="specialty" placeholder="Nội tổng quát" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px"></label>
              </div>
              <div>
                <label>Ca trực <input name="shiftSchedule" placeholder="Sáng 7-11, Chiều 13-16" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px"></label>
              </div>
              <div>
                <label>Bác sĩ trực ID <input name="doctorId" placeholder="cuid của bác sĩ" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px"></label>
              </div>
              <div style="grid-column:span 2;display:flex;gap:16px;align-items:center">
                <label style="display:flex;align-items:center;gap:4px"><input name="active" type="checkbox" checked> Hoạt động</label>
                <label style="display:flex;align-items:center;gap:4px"><input name="sharedQueue" type="checkbox"> Hàng chờ chung</label>
              </div>
            </div>
            <details style="margin-bottom:12px">
              <summary>Tọa độ 3D (width, depth, x, z)</summary>
              <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:8px">
                <label>Width <input name="width" type="number" step="0.1" value="5" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px"></label>
                <label>Depth <input name="depth" type="number" step="0.1" value="4" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px"></label>
                <label>X <input name="x" type="number" step="0.1" value="0" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px"></label>
                <label>Z <input name="z" type="number" step="0.1" value="0" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px"></label>
              </div>
            </details>
            <div style="display:flex;gap:8px;justify-content:flex-end">
              <button type="button" id="modal-cancel" class="secondary">Hủy</button>
              <button type="submit" class="primary" id="modal-submit">Lưu</button>
            </div>
          </form>
        </div>
      </div>

      <div id="toast" class="toast" hidden></div>
    </main>
  `;

  const $ = (sel) => root.querySelector(sel);
  let roomsCache = [];
  let paramsCache = [];

  // --- Rooms ---
  async function loadRooms() {
    try {
      const { rooms, configVersion } = await apiAdminRooms();
      roomsCache = rooms;
      $('#config-version').textContent = configVersion;
      renderRooms(rooms);
    } catch (err) {
      toast(root, 'Lỗi tải phòng: ' + err.message);
    }
  }

  function renderRooms(rooms) {
    $('#rooms-tbody').innerHTML = rooms.length
      ? rooms.map((r) => {
          const stateColor = ROOM_STATE_COLORS[r.state] ?? '#666';
          return `<tr>
            <td><code>${esc(r.code)}</code></td>
            <td>${esc(r.name)}</td>
            <td>${ROOM_KIND_LABELS[r.kind] ?? r.kind}</td>
            <td><span style="display:inline-block;padding:2px 8px;border-radius:999px;background:${stateColor};color:#fff;font-size:12px;font-weight:600">${ROOM_STATE_LABELS[r.state] ?? r.state}</span></td>
            <td>${r.capacity}</td>
            <td>${esc(r.prefix ?? '-')}</td>
            <td>${r.width}x${r.depth} @(${r.x},${r.z})</td>
            <td>${esc(r.zone ?? '-')}</td>
            <td>${esc(r.specialty ?? '-')}</td>
            <td>${esc(r.shiftSchedule ?? '-')}</td>
            <td>${esc(r.doctorId ? r.doctorId.slice(0,8)+'...' : '-')}</td>
            <td>${r.sharedQueue ? '✓' : ''}</td>
            <td>${r.active ? '✓' : '✗'}</td>
            <td>
              <button class="secondary" data-edit="${esc(r.id)}">Sửa</button>
              ${r.active ? `<button class="secondary" data-disable="${esc(r.id)}" style="background:#fef3c2;border-color:#fde68a">Khóa</button>` : ''}
              ${r.state === 'disabled' ? `<button class="secondary" data-enable="${esc(r.id)}" style="background:#dcfce7;border-color:#86efac">Mở lại</button>` : ''}
              ${r.state === 'alert' ? `<button class="secondary" data-resolve-alert="${esc(r.id)}" style="background:#fef2f2;border-color:#fecaca">Xử lý xong</button>` : ''}
            </td>
          </tr>`;
        }).join('')
      : '<tr><td colspan="14" class="muted">Chưa có phòng nào.</td></tr>';

    // Event listeners
    $('#rooms-tbody').querySelectorAll('button[data-edit]').forEach((btn) => {
      btn.addEventListener('click', () => openRoomModal(btn.dataset.edit));
    });
    $('#rooms-tbody').querySelectorAll('button[data-disable]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Khóa phòng này?')) return;
        try {
          await apiRoomStateChange(btn.dataset.disable, { state: 'disabled', disabledReason: 'Admin khóa thủ công' });
          toast(root, 'Đã khóa phòng');
          await loadRooms();
        } catch (err) { alert(err.message); }
      });
    });
    $('#rooms-tbody').querySelectorAll('button[data-enable]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await apiRoomStateChange(btn.dataset.enable, { state: 'free' });
          toast(root, 'Đã mở lại phòng');
          await loadRooms();
        } catch (err) { alert(err.message); }
      });
    });
    $('#rooms-tbody').querySelectorAll('button[data-resolve-alert]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await apiRoomStateChange(btn.dataset.resolveAlert, { state: 'free' });
          toast(root, 'Đã xử lý xong alert');
          await loadRooms();
        } catch (err) { alert(err.message); }
      });
    });
  }

  let roomModalMode = 'create'; // 'create' | 'edit'
  let editingRoomId = null;

  function openRoomModal(roomId = null) {
    const modal = $('#room-modal');
    const form = $('#room-form');
    form.reset();
    if (roomId) {
      roomModalMode = 'edit';
      editingRoomId = roomId;
      $('#modal-title').textContent = 'Sửa phòng';
      const room = roomsCache.find((r) => r.id === roomId);
      if (room) {
        form.code.value = room.code;
        form.code.readOnly = true; // mã không đổi được
        form.name.value = room.name;
        form.kind.value = room.kind;
        form.capacity.value = room.capacity;
        form.prefix.value = room.prefix ?? '';
        form.zone.value = room.zone ?? '';
        form.specialty.value = room.specialty ?? '';
        form.shiftSchedule.value = room.shiftSchedule ?? '';
        form.doctorId.value = room.doctorId ?? '';
        form.active.checked = room.active;
        form.sharedQueue.checked = room.sharedQueue;
        form.width.value = room.width;
        form.depth.value = room.depth;
        form.x.value = room.x;
        form.z.value = room.z;
        form.id.value = room.id;
      }
    } else {
      roomModalMode = 'create';
      editingRoomId = null;
      $('#modal-title').textContent = 'Thêm phòng mới';
      form.code.readOnly = false;
      form.id.value = '';
    }
    modal.hidden = false;
  }

  function closeRoomModal() {
    $('#room-modal').hidden = true;
    $('#room-form').reset();
  }

  $('#modal-cancel').addEventListener('click', closeRoomModal);
  $('#room-modal').addEventListener('click', (e) => { if (e.target === $('#room-modal')) closeRoomModal(); });

  $('#room-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    // Convert types
    data.capacity = parseInt(data.capacity);
    data.width = parseFloat(data.width);
    data.depth = parseFloat(data.depth);
    data.x = parseFloat(data.x);
    data.z = parseFloat(data.z);
    data.active = data.active === 'on';
    data.sharedQueue = data.sharedQueue === 'on';
    delete data.id;

    try {
      if (roomModalMode === 'create') {
        await apiAdminCreateRoom(data);
        toast(root, 'Đã tạo phòng mới');
      } else {
        await apiAdminUpdateRoom(editingRoomId, data);
        toast(root, 'Đã cập nhật phòng');
      }
      closeRoomModal();
      await loadRooms();
    } catch (err) {
      alert(err.message);
    }
  });

  $('#add-room-btn').addEventListener('click', () => openRoomModal());
  $('#reload-rooms').addEventListener('click', loadRooms);

  // --- Params ---
  async function loadParams() {
    try {
      const { params, configVersion } = await apiAdminConfigParams();
      paramsCache = params;
      $('#config-version').textContent = configVersion;
      renderParams(params);
    } catch (err) {
      toast(root, 'Lỗi tải tham số: ' + err.message);
    }
  }

  function renderParams(params) {
    $('#params-tbody').innerHTML = params.length
      ? params.map((p) => `<tr>
          <td><code>${esc(p.key)}</code></td>
          <td>${esc(p.value)}</td>
          <td><button class="secondary" data-edit-param="${esc(p.key)}">Sửa</button></td>
        </tr>`).join('')
      : '<tr><td colspan="3" class="muted">Chưa có tham số nào.</td></tr>';

    $('#params-tbody').querySelectorAll('button[data-edit-param]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.editParam;
        const param = paramsCache.find((p) => p.key === key);
        if (param) {
          document.querySelector('#param-form [name="key"]').value = param.key;
          document.querySelector('#param-form [name="value"]').value = param.value;
        }
      });
    });
  }

  $('#param-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    try {
      await apiAdminSetConfigParam(data.key, data.value);
      toast(root, `Đã cập nhật ${data.key} = ${data.value}`);
      e.target.reset();
      await loadParams();
    } catch (err) {
      alert(err.message);
    }
  });

  $('#reload-params').addEventListener('click', loadParams);

  // --- Ticket 13: Bulk Transfer ---
  let bulkSourceRoomId = null;
  let bulkTargetRoomId = null;

  async function loadBulkTransferRooms() {
    try {
      const { rooms } = await apiAdminRooms();
      const options = rooms.map((r) => `<option value="${esc(r.id)}">${esc(r.code)} - ${esc(r.name)} (${r.load ?? 0}/${r.capacity})</option>`).join('');
      document.querySelector('#bulk-source-room').innerHTML = '<option value="">Chọn phòng nguồn</option>' + options;
      document.querySelector('#bulk-target-room').innerHTML = '<option value="">Chọn phòng đích</option>' + options;
    } catch (err) {
      toast(root, 'Lỗi tải phòng cho bulk transfer: ' + err.message);
    }
  }

  document.querySelector('#bulk-preview-btn').addEventListener('click', async () => {
    bulkSourceRoomId = document.querySelector('#bulk-source-room').value;
    bulkTargetRoomId = document.querySelector('#bulk-target-room').value;
    if (!bulkSourceRoomId || !bulkTargetRoomId) { alert('Chọn đủ phòng nguồn và đích'); return; }
    try {
      const preview = await apiAdminBulkTransferPreview(bulkSourceRoomId, bulkTargetRoomId);
      const tbody = document.querySelector('#bulk-preview-tbody');
      tbody.innerHTML = preview.tickets.length
        ? preview.tickets.map((t) => `<tr><td>${t.number}</td><td>${esc(t.patient)}</td><td>${t.status}</td></tr>`).join('')
        : '<tr><td colspan="3" class="muted">Không có ticket nào để chuyển</td></tr>';
      document.querySelector('#bulk-preview-count').textContent = preview.count;
      document.querySelector('#bulk-preview-target-cap').textContent = `${preview.currentInTarget}/${preview.targetCapacity}`;
      document.querySelector('#bulk-will-exceed').textContent = preview.willExceed ? '⚠️ VƯỢT SỨC CHỨA' : 'OK';
      document.querySelector('#bulk-will-exceed').style.color = preview.willExceed ? '#ef4444' : '#4ade80';
      document.querySelector('#bulk-execute-btn').disabled = preview.willExceed || preview.count === 0;
      document.querySelector('#bulk-preview-panel').hidden = false;
    } catch (err) { alert(err.message); }
  });

  document.querySelector('#bulk-execute-btn').addEventListener('click', async () => {
    if (!confirm(`Xác nhận chuyển ${bulkSourceRoomId ? 'các ticket' : ''} sang phòng đích?`)) return;
    try {
      const res = await apiAdminBulkTransferExecute(bulkSourceRoomId, bulkTargetRoomId, true);
      toast(root, `Đã chuyển ${res.moved} ticket`);
      document.querySelector('#bulk-preview-panel').hidden = true;
      await loadRooms();
      await loadBulkTransferRooms();
    } catch (err) { alert(err.message); }
  });

  // --- Ticket 13: Events Viewer ---
  let eventsFilters = { limit: '100', offset: '0' };
  async function loadEvents() {
    try {
      const { events, total } = await apiAdminEvents(eventsFilters);
      const tbody = document.querySelector('#events-tbody');
      tbody.innerHTML = events.length
        ? events.map((e) => {
            const p = e.payload;
            return `<tr>
              <td>${timeOf(e.occurredAt)}</td>
              <td><code>${esc(e.type)}</code></td>
              <td>${esc(e.actorLabel)} (${e.actorType}${e.actorUserId ? ':' + e.actorUserId.slice(0,8) : ''})</td>
              <td>${esc(e.aggregateId)}</td>
              <td><pre style="font-size:11px;max-height:100px;overflow:auto">${JSON.stringify(p, null, 2)}</pre></td>
            </tr>`;
          }).join('')
        : '<tr><td colspan="5" class="muted">Không có sự kiện khớp bộ lọc</td></tr>';
      document.querySelector('#events-total').textContent = total;
    } catch (err) { toast(root, 'Lỗi tải sự kiện: ' + err.message); }
  }

  document.querySelector('#events-filter-form').addEventListener('submit', (e) => {
    e.preventDefault();
    eventsFilters = Object.fromEntries(new FormData(e.target).entries());
    loadEvents();
  });
  document.querySelector('#events-prev').addEventListener('click', () => {
    eventsFilters.offset = String(Math.max(0, parseInt(eventsFilters.offset) - parseInt(eventsFilters.limit)));
    loadEvents();
  });
  document.querySelector('#events-next').addEventListener('click', () => {
    eventsFilters.offset = String(parseInt(eventsFilters.offset) + parseInt(eventsFilters.limit));
    loadEvents();
  });

  // --- Ticket 13: Entered-in-error ---
  document.querySelector('#eie-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    try {
      const res = await apiAdminMarkEnteredInError(data.appointmentId || null, data.visitId || null, data.reason);
      toast(root, 'Đã đánh dấu entered-in-error');
      e.target.reset();
    } catch (err) { alert(err.message); }
  });

  // --- Ticket 13: Metrics ---
  async function loadMetrics() {
    try {
      const { dateFrom, dateTo } = Object.fromEntries(new FormData(document.querySelector('#metrics-form')).entries());
      const metrics = await apiAdminMetrics(dateFrom || undefined, dateTo || undefined);
      document.querySelector('#metric-p50').textContent = `${metrics.waitTime.p50Min} phút`;
      document.querySelector('#metric-p90').textContent = `${metrics.waitTime.p90Min} phút`;
      document.querySelector('#metric-priority-changes').textContent = metrics.priorityChanges;
      document.querySelector('#metric-override-rate').textContent = `${metrics.overrideRate}%`;
      document.querySelector('#metric-total-tickets').textContent = metrics.totalTicketsInPeriod;
      const alertsEl = document.querySelector('#metric-alerts');
      alertsEl.innerHTML = metrics.alerts.length
        ? metrics.alerts.map((a) => `<div class="alert-${a.level}">${esc(a.message)}</div>`).join('')
        : '<span class="muted">Không có cảnh báo</span>';
    } catch (err) { toast(root, 'Lỗi tải metric: ' + err.message); }
  }

  document.querySelector('#metrics-form').addEventListener('submit', (e) => {
    e.preventDefault();
    loadMetrics();
  });

  // --- Logout ---
  $('#logout').addEventListener('click', async () => {
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
      if (res.ok) location.href = '/';
    } catch { location.href = '/'; }
  });

  // Initial load
  loadRooms();
  loadParams();
  loadBulkTransferRooms();
  loadEvents();
  loadMetrics();
}