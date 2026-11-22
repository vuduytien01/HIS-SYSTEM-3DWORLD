// Socket.io: handshake xác thực session từ cookie, phân phòng theo vai.
import { Server } from 'socket.io';
import { config } from './config.js';
import { resolveSession, parseCookies, publicUser } from './auth.js';

export function createIo(httpServer) {
  const io = new Server(httpServer, { cors: { origin: true, credentials: true } });

  io.use(async (socket, next) => {
    const cookies = parseCookies(socket.handshake.headers.cookie);
    const token = cookies[config.sessionCookieName];
    const session = await resolveSession(token);
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
