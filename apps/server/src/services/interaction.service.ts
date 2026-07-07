import { Types } from 'mongoose';
import { Role } from '@kushlov/types';
import {
  AudioCall,
  Conversation,
  LiveChat,
  LiveStream,
  User,
  VideoCall,
} from '../models';

export interface InteractionRecord {
  id: string;
  kind: 'message_chat' | 'audio_call' | 'video_call' | 'live_chat';
  at: string;
  summary: string;
  otherUser: {
    id: string;
    displayName: string;
    username: string;
    avatarUrl?: string;
    role: string;
    isHostApproved?: boolean;
  };
}

function matchesQuery(user: { displayName?: string; username?: string }, q: string): boolean {
  const needle = q.toLowerCase();
  return (
    user.displayName?.toLowerCase().includes(needle) ||
    user.username?.toLowerCase().includes(needle) ||
    false
  );
}

function toOtherUser(u: any) {
  return {
    id: u._id?.toString() ?? u.id,
    displayName: u.displayName,
    username: u.username,
    avatarUrl: u.avatarUrl,
    role: u.role,
    isHostApproved: u.isHostApproved,
  };
}

/** Build unified interaction history filtered to the opposite role (user ↔ host). */
export async function getUserInteractionHistory(
  userId: string,
  role: Role,
  options: { q?: string; limit?: number } = {},
): Promise<{ items: InteractionRecord[]; searchRole: Role }> {
  const searchRole = role === Role.Host ? Role.User : Role.Host;
  const limit = options.limit ?? 80;
  const q = options.q?.trim().toLowerCase();
  const uid = new Types.ObjectId(userId);
  const items: InteractionRecord[] = [];

  const conversations = await Conversation.find({ participants: uid })
    .sort({ lastMessageAt: -1, updatedAt: -1 })
    .limit(limit)
    .populate('participants', 'displayName username avatarUrl role isHostApproved')
    .populate('lastMessage');

  for (const conv of conversations) {
    const other = (conv.participants as any[]).find((p) => p._id.toString() !== userId);
    if (!other || other.role !== searchRole) continue;
    if (q && !matchesQuery(other, q)) continue;
    items.push({
      id: conv._id.toString(),
      kind: 'message_chat',
      at: (conv.lastMessageAt ?? conv.updatedAt).toISOString(),
      summary:
        (conv.lastMessage as { text?: string } | null)?.text?.slice(0, 120) ||
        'Direct message chat',
      otherUser: toOtherUser(other),
    });
  }

  const callFilter = { $or: [{ caller: uid }, { callee: uid }] };
  const [audioCalls, videoCalls] = await Promise.all([
    AudioCall.find(callFilter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('caller', 'displayName username avatarUrl role isHostApproved')
      .populate('callee', 'displayName username avatarUrl role isHostApproved'),
    VideoCall.find(callFilter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('caller', 'displayName username avatarUrl role isHostApproved')
      .populate('callee', 'displayName username avatarUrl role isHostApproved'),
  ]);

  for (const call of audioCalls) {
    const other =
      (call.caller as any)._id.toString() === userId ? (call.callee as any) : (call.caller as any);
    if (!other || other.role !== searchRole) continue;
    if (q && !matchesQuery(other, q)) continue;
    items.push({
      id: call._id.toString(),
      kind: 'audio_call',
      at: (call.startedAt ?? call.createdAt).toISOString(),
      summary: `Audio call · ${call.status}${call.durationSec ? ` · ${call.durationSec}s` : ''}`,
      otherUser: toOtherUser(other),
    });
  }

  for (const call of videoCalls) {
    const other =
      (call.caller as any)._id.toString() === userId ? (call.callee as any) : (call.caller as any);
    if (!other || other.role !== searchRole) continue;
    if (q && !matchesQuery(other, q)) continue;
    items.push({
      id: call._id.toString(),
      kind: 'video_call',
      at: (call.startedAt ?? call.createdAt).toISOString(),
      summary: `Video call · ${call.status}${call.durationSec ? ` · ${call.durationSec}s` : ''}`,
      otherUser: toOtherUser(other),
    });
  }

  const liveChats = await LiveChat.find({ user: uid })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  if (liveChats.length) {
    const streamIds = [...new Set(liveChats.map((c) => c.liveStream.toString()))];
    const streams = await LiveStream.find({ _id: { $in: streamIds } })
      .populate('host', 'displayName username avatarUrl role isHostApproved')
      .lean();
    const streamMap = new Map(streams.map((s) => [s._id.toString(), s]));

    for (const chat of liveChats) {
      const stream = streamMap.get(chat.liveStream.toString());
      const host = stream?.host as any;
      if (!host || host.role !== searchRole) continue;
      if (q && !matchesQuery(host, q)) continue;
      items.push({
        id: chat._id.toString(),
        kind: 'live_chat',
        at: chat.createdAt.toISOString(),
        summary: `Live chat: ${chat.message.slice(0, 100)}`,
        otherUser: toOtherUser(host),
      });
    }
  }

  items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return { items: items.slice(0, limit), searchRole };
}
