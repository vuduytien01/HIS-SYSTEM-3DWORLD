// Doctor thin console (ticket 10) — nút ghép complete-and-call-next, 4 dòng thụ động, menu ngoại lệ.
import {
  apiDoctorVisits, apiDoctorCompleteAndCallNext, apiDoctorException, apiDoctorForgotten,
  apiUndoTicket, apiOverrideComplete, apiOverrideReasons,
} from '../api.js';
import { ROLE_LABELS } from '../roles.js';

const APPT_STATUS_LABELS = { booked: 'Đã đặt', 'checked-in': 'Đã tiếp nhận', cancelled: 'Đã hủy' };
const QUEUE_STATUS_LABELS = { waiting: 'Chờ gọi', called: 'Đã gọi', present: 'Có mặt', parked: 'Tạm giữ', skipped: 'Bỏ lượt', 'no-show': 'Vắng' };
const VISIT_STATUS_LABELS = { planned: 'Planned', 'in-progress': 'Đang khám', 'on-hold': 'Tạm hoãn', discharged: 'Đã xong', completed: 'Hoàn tất', cancelled: 'Đã hủy', discontinued: 'Ngưng', 'entered-in-error': 'Nhập nhầm', unknown: 'Unknown' };

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&', '<': '<', '>': '>', '"': '"', "'": ''' }[c]));
}

function timeOf(iso) {
  return iso ? new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '--:--';
}

function waitTimeStr(ms) {
  if (!ms) return '--:--';
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function renderDoctor(root, user) {
  root.innerHTML = `
    <header class="topbar">
      <span class="brand">Điều phối khám bệnh</span>
      <span class="user">${esc(user.displayName)} · ${ROLE_LABELS[user.role] ?? user.role}</span>
      <button id="logout">Đăng xuất</button>
    </header>
    <main class="workspace doctor-console">
      <section class="panel doctor-current">
        <h2>Lượt đang khám</h2>
        <div id="current-visit" class="visit-card">
          <p class="placeholder">Chưa có lượt nào đang khám.</p>
        </div>
        <div id="next-visit" class="visit-card next" style="margin-top:12px;display:none;">
          <h3>Lượt kế</h3>
          <div class="visit-info"></div>
        </div>
      </section>
      <section class="panel doctor-all">
        <h2>Tất cả lượt trong phòng</h2>
        <table class="list">
          <thead><tr><th>STT</th><th>Bệnh nhân</th><th>Trạng thái</th><th>Đã đợi</th><th>Cờ quên</th><th>Thao tác</th></tr></thead>
          <tbody id="all-visits"></tbody>
        </table>
      </section>
      <section class="panel doctor-forgotten" style="display:none;">
        <h2>Cảnh báo quên (<span id="forgot-count">0</span>)</h2>
        <table class="list">
          <thead><tr><th>Bệnh nhân</th><th>Phòng</th><th>Đã đợi</th><th>Ngưỡng</th><th>Thao tác</th></tr></thead>
          <tbody id="forgotten-list"></tbody>
        </table>
      </section>
    </main>
    <div id="toast" class="toast" hidden></div>
  `;

  const $ = (sel) => root.querySelector(sel);
  let socket = null;
  let visitsCache = [];

  let toastTimer;
  function toast(text) {
    const el = $('#toast');
    el.textContent = text;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 4000);
  }

  function renderCurrent(visit) {
    const el = $('#current-visit');
    if (!visit) {
      el.innerHTML = '<p class="placeholder">Chưa có lượt nào đang khám.</p>';
      return;
    }
    const p = visit.ticket?.patient;
    const waitMs = visit.waitMs || 0;
    el.innerHTML = `
      <div class="visit-header">
        <span class="visit-stt">STT ${esc(visit.ticket?.number ?? '--')}</span>
        <span class="visit-name">${esc(p?.fullName ?? '--')}</span>
        <span class="visit-status">${esc(VISIT_STATUS_LABELS[visit.status] ?? visit.status)}</span>
        <span class="visit-wait">Đã đợi: ${waitTimeStr(waitMs)}</span>
      </div>
      <div class="visit-details">
        <div>Loại hẹn: ${esc(APPT_STATUS_LABELS[visit.ticket?.appointment?.status] ?? '--')}</div>
        <div>Lý do: ${esc(visit.reason ?? '—')}</div>
        <div>Cận lâm sàng: ${visit.labPending ? '<span class="lab-pending">Đang chờ</span>' : 'Không'}</div>
      </div>
      <div class="visit-actions">
        <button id="complete-next" class="primary" style="width:100%;font-size:16px;padding:14px;">
          ✅ Xong khám & Gọi tiếp
        </button>
        <button id="exception-menu" class="secondary" style="width:100%;margin-top:8px;">⋯ Ngoại lệ</button>
      </div>
    `;

    $('#complete-next').addEventListener('click', async () => {
      if (!confirm('Xác nhận xong khám và gọi lượt kế?')) return;
      try {
        const res = await apiDoctorCompleteAndCallNext(visit.id, visit.roomId, true);
        toast('Đã xong khám & gọi lượt kế');
        await refresh();
      } catch (err) {
        alert(err.message);
      }
    });

    $('#exception-menu').addEventListener('click', () => showExceptionMenu(visit));
  }

  function renderNext(visit) {
    const el = $('#next-visit');
    if (!visit) {
      el.style.display = 'none';
      return;
    }
    el.style.display = 'block';
    const p = visit.ticket?.patient;
    el.querySelector('.visit-info').innerHTML = `
      <div>STT ${esc(visit.ticket?.number ?? '--')} — ${esc(p?.fullName ?? '--')}</div>
      <div class="muted">Loại: ${esc(APPT_STATUS_LABELS[visit.ticket?.appointment?.status] ?? '--')} · Trạng thái: ${esc(VISIT_STATUS_LABELS[visit.status] ?? visit.status)}</div>
    `;
  }

  function renderAll(list) {
    visitsCache = list;
    $('#all-visits').innerHTML = list.length
      ? list.map((v, i) => {
          const p = v.ticket?.patient;
          const waitMs = v.waitMs || 0;
          const isForgotten = v.waitMs && v.waitMs > 15 * 60 * 1000;
          return `<tr class="${isForgotten ? 'forgotten-row' : ''}">
            <td>${esc(v.ticket?.number ?? '--')}</td>
            <td>${esc(p?.fullName ?? '--')}</td>
            <td>${esc(VISIT_STATUS_LABELS[v.status] ?? v.status)}</td>
            <td>${waitTimeStr(waitMs)}</td>
            <td>${isForgotten ? '<span style="color:#ef4444;font-weight:600">⚠️ Quên</span>' : ''}</td>
            <td>
              ${v.status === 'in-progress' ? `<button class="primary" data-complete="${esc(v.id)}">Xong & Gọi tiếp</button>` : ''}
              ${v.status === 'in-progress' ? `<button class="secondary" data-exception="${esc(v.id)}">⋯</button>` : ''}
            </td>
          </tr>`;
        }).join('')
      : '<tr><td colspan="6" class="muted">Chưa có lượt nào.</td></tr>';

    $('#all-visits').querySelectorAll('button[data-complete]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const v = visitsCache.find((x) => x.id === btn.dataset.complete);
        if (v && confirm('Xong khám & gọi tiếp?')) {
          try {
            await apiDoctorCompleteAndCallNext(v.id, v.roomId, true);
            toast('Đã xong khám & gọi lượt kế');
            await refresh();
          } catch (err) { alert(err.message); }
        }
      });
    });
    $('#all-visits').querySelectorAll('button[data-exception]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const v = visitsCache.find((x) => x.id === btn.dataset.exception);
        if (v) showExceptionMenu(v);
      });
    });
  }

  function renderForgotten(list) {
    const el = $('#forgotten-list');
    const count = $('#forgot-count');
    if (list.length > 0) {
      $('#forgot-count').textContent = list.length;
      const panel = root.querySelector('.doctor-forgotten');
      panel.style.display = 'block';
      el.innerHTML = list.map((f) => {
        const p = f.visit.ticket?.patient;
        return `<tr>
          <td>${esc(p?.fullName ?? '--')}</td>
          <td>${esc(f.visit.room?.name ?? '--')}</td>
          <td>${waitTimeStr(f.waitMs)}</td>
          <td>${waitTimeStr(f.threshold)}</td>
          <td><button class="primary" data-view="${esc(f.visit.id)}">Xem</button></td>
        </tr>`;
      }).join('');
    } else {
      $('#forgot-count').textContent = '0';
      root.querySelector('.doctor-forgotten').style.display = 'none';
    }
  }

  let exceptionMenu = null;
  function showExceptionMenu(visit) {
    if (exceptionMenu) exceptionMenu.remove();
    exceptionMenu = document.createElement('div');
    exceptionMenu.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;z-index:1000';
    exceptionMenu.innerHTML = `
      <div style="background:#fff;padding:24px;border-radius:10px;min-width:320px;box-shadow:0 8px 24px rgba(0,0,0,.2)">
        <h3 style="margin:0 0 12px">Ngoại lệ cho STT ${esc(visit.ticket?.number ?? '--')}</h3>
        <div style="display:flex;flex-direction:column;gap:8px">
          <button class="primary" data-act="reassign">🔄 Chuyển phòng (giữ chỗ)</button>
          <button class="primary" data-act="on-hold">🧪 Yêu cầu cận lâm sàng (on-hold)</button>
          <button class="secondary" data-act="discontinued">🚫 Bỏ về giữa chừng</button>
          <button class="secondary" data-act="cancel" style="margin-top:8px">Hủy</button>
        </div>
      </div>`;
    document.body.appendChild(exceptionMenu);
    exceptionMenu.querySelectorAll('button[data-act]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const act = btn.dataset.act;
        if (act === 'cancel') { exceptionMenu.remove(); exceptionMenu = null; return; }
        let roomId = null;
        if (act === 'reassign') {
          const roomIdPrompt = prompt('Nhập roomId phòng mới:');
          if (!roomIdPrompt) return;
          roomId = roomIdPrompt.trim();
        }
        try {
          await apiDoctorException(visit.id, act, roomId);
          toast(`Đã xử lý ngoại lệ: ${act}`);
          exceptionMenu.remove();
          exceptionMenu = null;
          await refresh();
        } catch (err) { alert(err.message); }
      });
    });
    exceptionMenu.addEventListener('click', (e) => { if (e.target === exceptionMenu) { exceptionMenu.remove(); exceptionMenu = null; } });
  }

  async function refresh() {
    try {
      const { visits } = await apiDoctorVisits();
      const current = visits.find((v) => v.status === 'in-progress');
      const next = visits.find((v) => v.status === 'waiting' || v.status === 'planned');
      const all = visits.filter((v) => v.status !== 'completed' && v.status !== 'cancelled' && v.status !== 'discontinued');
      renderCurrent(current);
      renderNext(next);
      renderAll(all);
      const { forgotten } = await apiDoctorForgotten();
      renderForgotten(forgotten);
    } catch (err) {
      console.error(err);
    }
  }

  refresh();

  const autoRefresh = setInterval(refresh, 10000);

  const ws = connectSocket();
  ws.on('queue:snapshot', () => refresh());
  ws.on('call.issued', () => refresh());
  ws.on('queue.ticket.changed', () => refresh());
  ws.on('encounter.location.changed', () => refresh());
  ws.on('room.state.changed', () => refresh());
  ws.on('assignment.created', () => refresh());
  ws.on('assignment.revoked', () => refresh());
  ws.on('patient.status.changed', () => refresh());
  ws.on('config.changed', () => refresh());

  window.addEventListener('beforeunload', () => clearInterval(autoRefresh));
}