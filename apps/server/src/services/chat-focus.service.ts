/** In-memory map of which conversation each socket is currently viewing. */

const focusBySocket = new Map<string, { userId: string; conversationId: string }>();
const focusCounts = new Map<string, Map<string, number>>();

function bump(userId: string, conversationId: string, delta: number) {
  let byConv = focusCounts.get(userId);
  if (!byConv) {
    byConv = new Map();
    focusCounts.set(userId, byConv);
  }
  const next = (byConv.get(conversationId) ?? 0) + delta;
  if (next <= 0) byConv.delete(conversationId);
  else byConv.set(conversationId, next);
  if (byConv.size === 0) focusCounts.delete(userId);
}

export function setChatFocus(socketId: string, userId: string, conversationId: string) {
  const id = String(conversationId || '');
  if (!id) {
    clearChatFocus(socketId);
    return;
  }
  const prev = focusBySocket.get(socketId);
  if (prev) bump(prev.userId, prev.conversationId, -1);
  focusBySocket.set(socketId, { userId, conversationId: id });
  bump(userId, id, 1);
}

export function clearChatFocus(socketId: string) {
  const prev = focusBySocket.get(socketId);
  if (!prev) return;
  focusBySocket.delete(socketId);
  bump(prev.userId, prev.conversationId, -1);
}

/** True when the user has this conversation open on any connected client. */
export function isUserFocusedOnChat(userId: string, conversationId: string): boolean {
  const count = focusCounts.get(userId)?.get(String(conversationId)) ?? 0;
  return count > 0;
}
