/** Deep-link target when the app is launched from kushlov://call/{id}. */

export type PendingCallLink = {
  callId: string;
  callType?: string;
};

let pending: PendingCallLink | null = null;

export function setPendingCallLink(next: PendingCallLink) {
  pending = next;
}

export function consumePendingCallLink(): PendingCallLink | null {
  const current = pending;
  pending = null;
  return current;
}

export function peekPendingCallLink(): PendingCallLink | null {
  return pending;
}
