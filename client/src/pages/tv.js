// Trang TV công cộng — zero-PII: chỉ STT, câu hành động, ký hiệu ưu tiên.
// Nguồn dữ liệu: snapshot REST khi vào trang + socket 'queue:snapshot' khi reconnect + 'call.issued' realtime.
import { apiPublicTv, connectSocket } from '../api.js';

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function renderTv(root) {
  root.innerHTML = `
    <main class="tv">
      <section class="tv-called">
        <h1 id="tv-now">Đang chờ gọi</h1>
        <p id="tv-called-empty" class="tv-muted">Số được gọi sẽ hiện ở đây.</p>
        <ul id="tv-called"></ul>
      </section>
      <section class="tv-next">
        <h2>Các lượt kế tiếp</h2>
        <ul id="tv-next"></ul>
      </section>
    </main>
  `;

  const $ = (sel) => root.querySelector(sel);
  let state = { called: [], next: [] };

  function render() {
    $('#tv-called').innerHTML = state.called.length
      ? state.called.map((t) => `<li class="tv-called-item">
          <span class="tv-number">${t.number}</span>
          <span class="tv-action">${esc(t.action)}${t.priority ? ' · Ưu tiên: có' : ''}</span>
        </li>`).join('')
      : '';
    $('#tv-called-empty').hidden = state.called.length > 0;
    $('#tv-now').textContent = state.called.length ? 'Mời số' : 'Đang chờ gọi';
    $('#tv-next').innerHTML = state.next.length
      ? state.next.map((t) => `<li><span class="tv-number-sm">${t.number}</span> <span class="tv-muted">${esc(t.action)}</span></li>`).join('')
      : '<li class="tv-muted">Chưa có lượt chờ nào.</li>';
  }

  function apply(snapshot) {
    if (snapshot && Array.isArray(snapshot.called)) {
      state = snapshot;
      render();
    }
  }

  apiPublicTv().then(apply);

  const socket = connectSocket();
  socket.on('queue:snapshot', apply);
  // Gọi số realtime: đưa số vào danh sách gọi, bỏ khỏi hàng chờ — cùng payload với TV và loa.
  socket.on('call.issued', (p) => {
    state = {
      called: [p, ...state.called.filter((t) => t.number !== p.number)].slice(0, 3),
      next: state.next.filter((t) => t.number !== p.number),
    };
    render();
  });
}
