import { io, Socket } from 'socket.io-client';
import { env } from '@/config/env';
import { useAuthStore } from '@/store/auth';
import { SocketEvents } from '@/types';

let socket: Socket | null = null;

export function getSocket(): Socket | null {
  return socket;
}

export function connectSocket(token?: string | null): Socket {
  const accessToken = token ?? useAuthStore.getState().accessToken;
  if (socket?.connected) {
    if (accessToken) socket.auth = { token: accessToken };
    return socket;
  }

  if (socket) {
    socket.disconnect();
    socket = null;
  }

  socket = io(env.socketUrl, {
    // polling first helps behind some proxies; websocket upgrades when available
    transports: ['polling', 'websocket'],
    autoConnect: true,
    auth: accessToken ? { token: accessToken } : undefined,
    reconnection: true,
    reconnectionAttempts: 12,
    reconnectionDelay: 1000,
  });

  socket.on(SocketEvents.Connected, () => {
    // connected
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}

export function emitTyping(conversationId: string, isTyping: boolean) {
  if (!socket?.connected) return;
  socket.emit(isTyping ? SocketEvents.TypingStart : SocketEvents.TypingStop, {
    conversationId,
  });
}
