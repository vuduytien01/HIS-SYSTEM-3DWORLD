// Projection công cộng zero-PII (ticket 03): chỉ STT, câu hành động, ký hiệu ưu tiên.
// Không trả tên, CCCD, BHYT, SĐT hay resource nguyên bản — mọi mặt công cộng đi qua đây.
// Khi phòng được xếp (ticket 05), roomName sẽ có và câu hành động đổi theo.
export function tvAction(ticket) {
  return ticket.roomName ? `Mời vào ${ticket.roomName}` : 'Xin chờ xếp phòng';
}

export function publicTicketView(t) {
  return { ticketId: t.id, number: t.number, dateKey: t.dateKey, action: tvAction(t), priority: false };
}

export function tvSnapshot(tickets) {
  return {
    called: tickets.filter((t) => t.status === 'called').map(publicTicketView),
    next: tickets.filter((t) => t.status === 'waiting').slice(0, 5).map(publicTicketView),
  };
}

export function trackSnapshot(t) {
  return { number: t.number, status: t.status, action: tvAction(t), priority: false };
}
