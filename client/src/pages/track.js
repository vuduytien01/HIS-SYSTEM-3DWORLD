// Kênh web công cộng (/track): bệnh nhân theo dõi trạng thái của mình bằng mã trên phiếu STT — zero-PII.
import { apiPublicTrack, connectSocket } from '../api.js';

const STATUS_LABELS = {
  waiting: 'Đang chờ đến lượt',
  called: 'Đã gọi — vui lòng đến quầy',
  present: 'Có mặt tại quầy',
  parked: 'Tạm giữ chỗ',
  skipped: 'Bỏ lượt — quay lại quầy để được xếp lại',
  'no-show': 'Đã bị bỏ lượt',
};

export function renderTrack(root) {
  root.innerHTML = `
    <div class="book-card">
      <h1>Theo dõi lượt khám</h1>
      <p class="muted">Nhập mã theo dõi in trên phiếu số thứ tự của bạn.</p>
      <form id="track-form">
        <input name="code" placeholder="Mã theo dõi" required>
        <button>Theo dõi</button>
      </form>
      <div id="track-status" hidden>
        <p class="track-number"></p>
        <p class="track-status"></p>
        <p class="muted track-action"></p>
      </div>
      <p id="track-msg"></p>
    </div>
  `;

  const $ = (sel) => root.querySelector(sel);
  let current = null;
  let socket = null;

  function render(snapshot) {
    if (!snapshot || snapshot.number === undefined) return;
    current = snapshot;
    $('#track-status').hidden = false;
    $('#track-number').textContent = `Số của bạn: ${snapshot.number}`;
    $('#track-status').querySelector('.track-status').textContent = STATUS_LABELS[snapshot.status] ?? snapshot.status;
    $('#track-action').textContent = snapshot.action;
  }

  $('#track-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = String(new FormData(e.target).get('code') ?? '').trim();
    const msg = $('#track-msg');
    try {
      render(await apiPublicTrack(code));
      msg.textContent = '';
      if (!socket) {
        socket = connectSocket({ auth: { trackingCode: code } });
        socket.on('queue:snapshot', render);
        // Sự kiện gọi phát từ server cũng tới room của mã — cập nhật tức thời.
        // Lọc theo cả dateKey: cùng số khác ngày là thẻ khác (STT reset mỗi sáng).
        socket.on('call.issued', (p) => {
          if (current && p.number === current.number && p.dateKey === current.dateKey) {
            render({ ...current, status: 'called', action: p.action });
          }
        });
      }
    } catch (err) {
      msg.className = 'error-text';
      msg.textContent = err.message;
    }
  });
}
