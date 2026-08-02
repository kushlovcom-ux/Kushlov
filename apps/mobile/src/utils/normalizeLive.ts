import type { LiveRoom, LiveStatus, PublicUser } from '@/types';

function idOf(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    const v = value as { id?: string; _id?: string | { toString(): string } };
    if (typeof v.id === 'string' && v.id) return v.id;
    if (typeof v._id === 'string' && v._id) return v._id;
    if (v._id && typeof v._id.toString === 'function') return v._id.toString();
  }
  return '';
}

function asUser(value: unknown): PublicUser | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const v = value as PublicUser & { _id?: unknown };
  const id = idOf(v);
  if (!id && !(v as { displayName?: string }).displayName) return undefined;
  return {
    ...(v as PublicUser),
    id: id || (v as PublicUser).id || '',
  };
}

/** Map server live payloads (`_id`) into the mobile `LiveRoom` shape (`id`). */
export function normalizeLiveRoom(raw: unknown): LiveRoom {
  const data = (raw ?? {}) as Record<string, unknown> & {
    live?: Record<string, unknown>;
    _id?: unknown;
    id?: string;
    host?: unknown;
    hostId?: string;
    coHost?: unknown;
    coHostId?: string;
  };
  const live = (data.live ?? data) as typeof data;
  const host = asUser(live.host);
  const coHost = asUser(live.coHost);
  const id = idOf(live.id) || idOf(live._id) || idOf(data.id) || idOf(data._id);

  return {
    id,
    title: String(live.title ?? 'Live'),
    status: (live.status as LiveStatus) ?? ('live' as LiveStatus),
    hostId: String(live.hostId || idOf(live.host) || host?.id || ''),
    host,
    coHostId: live.coHostId ? String(live.coHostId) : coHost?.id,
    coHost: coHost ?? (typeof live.coHost === 'string' ? live.coHost : undefined),
    thumbnailUrl: live.thumbnailUrl as string | undefined,
    viewerCount: Number(live.viewerCount ?? 0),
    likeCount: Number(live.likeCount ?? live.totalLikes ?? 0),
    roomName: live.roomName as string | undefined,
    token: live.token as string | undefined,
    livekitUrl: live.livekitUrl as string | undefined,
    startedAt: live.startedAt as string | undefined,
    endedAt: live.endedAt as string | undefined,
    createdAt: (live.createdAt as string) ?? new Date().toISOString(),
  };
}
