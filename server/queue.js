// Domain thẻ hàng đợi: STT cấp theo ngày, reset mỗi sáng qua dateKey giờ server.
import { randomBytes } from 'node:crypto';

export function dateKeyOf(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Đầu và cuối một ngày theo dateKey (múi giờ local server).
export function dayBounds(dateKey) {
  const start = new Date(`${dateKey}T00:00:00`);
  return [start, new Date(start.getTime() + 24 * 60 * 60 * 1000)];
}

// Cấp STT: max(number)+1 trong ngày. Chạy trong transaction;
// unique [dateKey, number] là lưới an toàn chống đua cấp số.
export async function issueQueueTicket(tx, { patientId, appointmentId, dateKey }) {
  const last = await tx.queueTicket.findFirst({
    where: { dateKey },
    orderBy: { number: 'desc' },
    select: { number: true },
  });
  return tx.queueTicket.create({
    data: {
      patientId,
      appointmentId,
      dateKey,
      number: (last?.number ?? 0) + 1,
      status: 'waiting',
      // 8 ký tự hex in trên phiếu STT — bệnh nhân theo dõi kênh web bằng mã, không cần tài khoản
      trackingCode: randomBytes(4).toString('hex'),
    },
  });
}

// Đua cấp số nổ unique [dateKey, number] (P2002): chạy lại transaction để đọc lại max,
// không để lỗi 500 rơi cho bệnh nhân. Lỗi khác ném thẳng.
export async function retryOnTicketRace(run, retries = 3) {
  let last;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await run();
    } catch (err) {
      last = err;
      if (err?.code !== 'P2002') throw err;
    }
  }
  throw last;
}
