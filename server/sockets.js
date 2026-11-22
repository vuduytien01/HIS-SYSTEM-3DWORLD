// Socket.io: handshake xác thực session từ cookie, phân phòng theo vai và mã theo dõi bệnh nhân.
import { Server } from 'socket.io';
import { resolveSessionFromCookieHeader, publicUser } from './auth.js';
import prisma from './db.js';
import { dateKeyOf } from './queue.js';
import { tvSnapshot, trackSnapshot } from './queue-projection.js';

export function createIo(httpServer) {
  // Client cùng origin với server (Vite middleware cùng process) — không mở CORS
  const io = new Server(httpServer);

  io.use(async (socket, next) => {
    const session = await resolveSessionFromCookieHeader(socket.handshake.headers.cookie);
    socket.data.user = session ? publicUser(session.user) : null;
    next();
  });

  io.on('connection', async (socket) => {
    socket.join('public');
    if (socket.data.user) {
      socket.join(`user:${socket.data.user.id}`);
      socket.join(`role:${socket.data.user.role}`);
    }
    // Kênh web bệnh nhân: mã theo dõi trên phiếu STT → room riêng của thẻ.
    let trackTicket = null;
    const code = socket.handshake.auth?.trackingCode;
    if (code) {
      trackTicket = await prisma.queueTicket.findUnique({ where: { trackingCode: String(code) } });
      if (trackTicket) socket.join(`track:${trackTicket.trackingCode}`);
    }
    socket.emit('hello', { serverTime: Date.now(), user: socket.data.user });
    // Hòa giải khi vừa nối hoặc reconnect: snapshot khớp mặt người nghe.
    if (trackTicket) {
      socket.emit('queue:snapshot', trackSnapshot(trackTicket));
    } else {
      const tickets = await prisma.queueTicket.findMany({
        where: { dateKey: dateKeyOf(new Date()) },
        orderBy: { number: 'asc' },
      });
      socket.emit('queue:snapshot', tvSnapshot(tickets));
    }
  });

  return io;
}
