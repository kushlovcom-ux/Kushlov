import type { Server as IOServer } from 'socket.io';

/**
 * Holds the Socket.io server instance so any part of the app (services,
 * controllers) can push realtime events without a direct dependency cycle.
 * Each authenticated socket joins a personal room named by its userId.
 */
let io: IOServer | null = null;

export function setIO(server: IOServer): void {
  io = server;
}

export function getIO(): IOServer | null {
  return io;
}

/** Emit an event to a specific user's personal room. */
export function emitToUser(userId: string, event: string, payload: unknown): void {
  io?.to(`user:${userId}`).emit(event, payload);
}

/** Emit an event to everyone in an arbitrary room (e.g. a live stream). */
export function emitToRoom(room: string, event: string, payload: unknown): void {
  io?.to(room).emit(event, payload);
}
