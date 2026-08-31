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

  const authCb = (cb: (data: { token?: string }) => void) => {
    const latest = useAuthStore.getState().accessToken ?? accessToken;
    cb(latest ? { token: latest } : {});
  };

  if (socket) {
    socket.auth = authCb;
    if (!socket.connected) socket.connect();
    return socket;
  }

  socket = io(env.socketUrl, {
    // polling first helps behind some proxies; websocket upgrades when available
    transports: ['polling', 'websocket'],
    autoConnect: true,
    auth: authCb,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 15_000,
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

export function emitChatFocus(conversationId: string | null) {
  if (!socket?.connected) return;
  if (conversationId) socket.emit(SocketEvents.ChatFocus, { conversationId });
  else socket.emit(SocketEvents.ChatBlur);
}
