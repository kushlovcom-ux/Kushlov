import type { ChatMessage, Conversation, MediaAsset, MessageType, PublicUser } from '@/types';

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

function asPublicUser(value: unknown): PublicUser | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const v = value as PublicUser & { _id?: unknown; displayName?: string };
  const id = idOf(v);
  if (!id && !v.displayName) return undefined;
  return {
    ...(v as PublicUser),
    id: id || v.id || '',
  };
}

/** Map server conversation payloads (`_id`) into the mobile `Conversation` shape (`id`). */
export function normalizeConversation(raw: unknown): Conversation {
  const data = (raw ?? {}) as Record<string, unknown> & {
    _id?: unknown;
    id?: unknown;
    participants?: unknown[];
    lastMessage?: unknown;
    unreadCount?: number;
    updatedAt?: string;
    createdAt?: string;
  };

  const participants = (data.participants ?? [])
    .map((p) => asPublicUser(p))
    .filter((p): p is PublicUser => Boolean(p));

  const lastMessage = data.lastMessage
    ? normalizeChatMessage(data.lastMessage)
    : undefined;

  return {
    id: idOf(data.id) || idOf(data._id),
    participants,
    lastMessage,
    unreadCount: data.unreadCount ?? 0,
    updatedAt: data.updatedAt ?? '',
    createdAt: data.createdAt ?? '',
  };
}

/** Map server message payloads into the mobile `ChatMessage` shape. */
export function normalizeChatMessage(raw: unknown): ChatMessage {
  const data = (raw ?? {}) as Record<string, unknown> & {
    _id?: unknown;
    id?: unknown;
    conversation?: unknown;
    conversationId?: unknown;
    sender?: unknown;
    senderId?: unknown;
    type?: MessageType | string;
    text?: string;
    media?: MediaAsset;
    giftId?: string;
    createdAt?: string;
    readAt?: string;
    deletedAt?: string;
    deletedForEveryone?: boolean;
  };

  const deletedAt =
    data.deletedAt ??
    (data.deletedForEveryone ? data.createdAt ?? new Date().toISOString() : undefined);

  return {
    id: idOf(data.id) || idOf(data._id),
    conversationId: idOf(data.conversationId) || idOf(data.conversation),
    senderId: idOf(data.senderId) || idOf(data.sender),
    type: (data.type as MessageType) ?? ('text' as MessageType),
    text: data.text,
    media: data.media,
    giftId: data.giftId,
    createdAt: data.createdAt ?? '',
    readAt: data.readAt,
    deletedAt,
  };
}
