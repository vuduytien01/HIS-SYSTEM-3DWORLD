// Socket.io: handshake xác thực session từ cookie, phân phòng theo vai.
import { Server } from 'socket.io';
import { resolveSessionFromCookieHeader, publicUser } from './auth.js';

export function createIo(httpServer) {
  // Client cùng origin với server (Vite middleware cùng process) — không mở CORS
  const io = new Server(httpServer);

  io.use(async (socket, next) => {
    const session = await resolveSessionFromCookieHeader(socket.handshake.headers.cookie);
    socket.data.user = session ? publicUser(session.user) : null;
    next();
  });

  io.on('connection', (socket) => {
    socket.join('public');
    if (socket.data.user) {
      socket.join(`user:${socket.data.user.id}`);
      socket.join(`role:${socket.data.user.role}`);
    }
    socket.emit('hello', { serverTime: Date.now(), user: socket.data.user });
  });

  return io;
}
