// Projection công cộng zero-PII (ticket 03): chỉ STT, dateKey, câu hành động.
// Không trả tên, CCCD, BHYT, SĐT, mã theo dõi, ticketId hay resource nguyên bản — mọi mặt công cộng đi qua đây.
// roomName sẽ có từ ticket 05 (xếp phòng) — câu hành động đổi theo; ưu tiên ký hiệu từ ticket 07 khi có nguồn.
export function tvAction(ticket) {
  return ticket.roomName ? `Mời vào ${ticket.roomName}` : 'Xin chờ xếp phòng';
}

export function publicTicketView(t) {
  return { number: t.number, dateKey: t.dateKey, action: tvAction(t) };
}

export function tvSnapshot(tickets) {
  return {
    called: tickets.filter((t) => t.status === 'called').map(publicTicketView),
    next: tickets.filter((t) => t.status === 'waiting').slice(0, 5).map(publicTicketView),
  };
}

export function trackSnapshot(t) {
  return { number: t.number, dateKey: t.dateKey, status: t.status, action: tvAction(t) };
}
