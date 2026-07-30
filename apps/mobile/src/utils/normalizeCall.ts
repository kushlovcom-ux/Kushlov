import type { CallSession, CallStatus, CallType, PublicUser } from '@/types';

/** Raw initiate/accept payloads from the API (nested `call` + top-level token). */
type RawCallPayload = {
  call?: Record<string, unknown> & {
    _id?: string | { toString(): string };
    id?: string;
    type?: CallType | string;
    status?: CallStatus | string;
    caller?: unknown;
    callee?: unknown;
    roomName?: string;
    createdAt?: string;
  };
  token?: string;
  roomName?: string;
  livekitUrl?: string;
  callId?: string;
  type?: CallType | string;
  status?: CallStatus | string;
  from?: PublicUser & { id?: string };
  id?: string;
  _id?: string | { toString(): string };
  caller?: PublicUser;
  callee?: PublicUser;
  callerId?: string;
  calleeId?: string;
  createdAt?: string;
  interrupt?: boolean;
  targetCallId?: string;
  busy?: boolean;
  message?: string;
  consult?: boolean;
  heldCallId?: string;
  heldType?: CallType | string;
  mergedFromHold?: string;
};

function idOf(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    const v = value as { id?: string; _id?: string | { toString(): string } };
    if (typeof v.id === 'string') return v.id;
    if (typeof v._id === 'string') return v._id;
    if (v._id && typeof v._id.toString === 'function') return v._id.toString();
  }
  return String(value);
}

/**
 * Normalize initiate / accept / socket invite payloads into a flat CallSession.
 * Server returns `{ call, token, livekitUrl }` — without this, `type`/`id` are missing
 * and video calls incorrectly fall back to audio-only.
 */
export function normalizeCallSession(raw: unknown): CallSession {
  const data = (raw ?? {}) as RawCallPayload;
  const call = data.call ?? data;
  const caller = (call.caller ?? data.caller ?? data.from) as PublicUser | undefined;
  const callee = (call.callee ?? data.callee) as PublicUser | undefined;

  const id =
    idOf(call.id) ||
    idOf(call._id) ||
    idOf(data.callId) ||
    idOf(data.id) ||
    idOf(data._id);

  const type = (call.type ?? data.type ?? 'audio') as CallType;
  const status = (call.status ?? data.status ?? 'ringing') as CallStatus;

  return {
    id,
    type,
    status,
    callerId: idOf(call.caller) || data.callerId || idOf(caller) || '',
    calleeId: idOf(call.callee) || data.calleeId || idOf(callee) || '',
    caller,
    callee,
    roomName: (call.roomName as string | undefined) ?? data.roomName,
    token: data.token,
    livekitUrl: data.livekitUrl,
    createdAt: (call.createdAt as string | undefined) ?? data.createdAt ?? new Date().toISOString(),
    interrupt: Boolean(data.interrupt ?? (call as { isInterrupt?: boolean }).isInterrupt),
    targetCallId:
      (data.targetCallId as string | undefined) ||
      idOf((call as { targetCallId?: unknown }).targetCallId) ||
      undefined,
    busy: Boolean(data.busy),
    message: data.message,
    consult: Boolean(data.consult),
    heldCallId: data.heldCallId ? String(data.heldCallId) : undefined,
    heldType: data.heldType as CallType | undefined,
    mergedFromHold: data.mergedFromHold ? String(data.mergedFromHold) : undefined,
  };
}
