import type { Server as HttpServer } from 'node:http';
import { Server as IOServer, Socket } from 'socket.io';
import { SocketEvents } from '@kushlov/types';
import { getAllowedOrigins } from '../config/cors';
import { logger } from '../config/logger';
import { verifyAccessToken } from '../utils/jwt';
import { User } from '../models';
import { createMessage } from '../modules/chat/chat.service';
import { setIO } from './io';

interface AuthedSocket extends Socket {
  userId?: string;
}

/** Initialize Socket.io, wire authentication and realtime event handlers. */
export function initSocket(httpServer: HttpServer): IOServer {
  const io = new IOServer(httpServer, {
    cors: { origin: getAllowedOrigins(), credentials: true },
    maxHttpBufferSize: 5 * 1024 * 1024,
  });
  setIO(io);

  // Authenticate every socket with a JWT (from handshake auth or query).
  io.use((socket: AuthedSocket, next) => {
    try {
      const token =
        (socket.handshake.auth?.token as string) ||
        (socket.handshake.query?.token as string) ||
        '';
      const payload = verifyAccessToken(token);
      socket.userId = payload.sub;
      next();
    } catch {
      next(new Error('Unauthorized socket connection'));
    }
  });

  io.on('connection', async (socket: AuthedSocket) => {
    const userId = socket.userId!;
    socket.join(`user:${userId}`);
    await User.findByIdAndUpdate(userId, { isOnline: true, lastSeenAt: new Date() });
    socket.broadcast.emit(SocketEvents.PresenceOnline, { userId });
    socket.emit(SocketEvents.Connected, { userId });
    logger.debug({ userId }, 'Socket connected');

    // ---- Typing indicators ----
    socket.on(SocketEvents.TypingStart, ({ conversationId, to }) => {
      if (to) io.to(`user:${to}`).emit(SocketEvents.TypingStart, { conversationId, from: userId });
    });
    socket.on(SocketEvents.TypingStop, ({ conversationId, to }) => {
      if (to) io.to(`user:${to}`).emit(SocketEvents.TypingStop, { conversationId, from: userId });
    });

    // ---- Send chat message over socket ----
    socket.on(SocketEvents.MessageSend, async (payload, ack) => {
      try {
        const message = await createMessage({
          conversationId: payload.conversationId,
          senderId: userId,
          type: payload.type,
          text: payload.text,
          replyTo: payload.replyTo,
        });
        ack?.({ success: true, data: message });
      } catch (err) {
        ack?.({ success: false, message: (err as Error).message });
      }
    });

    // ---- Live stream rooms ----
    socket.on(SocketEvents.LiveJoin, ({ liveId }) => {
      socket.join(`live:${liveId}`);
    });
    socket.on(SocketEvents.LiveLeave, ({ liveId }) => {
      socket.leave(`live:${liveId}`);
    });

    // ---- Disconnect / presence ----
    socket.on('disconnect', async () => {
      await User.findByIdAndUpdate(userId, { isOnline: false, lastSeenAt: new Date() });
      socket.broadcast.emit(SocketEvents.PresenceOffline, { userId });
      logger.debug({ userId }, 'Socket disconnected');
    });
  });

  logger.info('⚡ Socket.io initialized');
  return io;
}
