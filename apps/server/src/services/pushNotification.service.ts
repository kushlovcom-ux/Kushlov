import { NotificationType } from '@kushlov/types';
import { logger } from '../config/logger';
import { Notification, User, UserDeviceToken } from '../models';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

type ExpoPushMessage = {
  to: string;
  title: string;
  body?: string;
  data?: Record<string, string>;
  sound?: string | null;
  channelId?: string;
  categoryId?: string;
  priority?: 'default' | 'normal' | 'high';
  interruptionLevel?: 'passive' | 'active' | 'timeSensitive' | 'critical';
  badge?: number;
  ttl?: number;
  collapseId?: string;
  mutableContent?: boolean;
};

export type PushPayload = {
  type: string;
  notificationId?: string;
  messageId?: string;
  callId?: string;
  senderId?: string;
  conversationId?: string;
  callType?: string;
  timestamp?: string;
  [key: string]: unknown;
};

function flattenData(data?: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  if (!data) return out;
  for (const [key, value] of Object.entries(data)) {
    if (value == null) continue;
    out[key] = typeof value === 'string' ? value : JSON.stringify(value);
  }
  return out;
}

function isIncomingCall(type: NotificationType | string, data?: Record<string, unknown>) {
  return (
    type === NotificationType.Call ||
    data?.kind === 'incoming_call' ||
    data?.type === 'AUDIO_CALL' ||
    data?.type === 'VIDEO_CALL'
  );
}

async function dropInvalidToken(token: string) {
  await Promise.all([
    UserDeviceToken.updateMany({ pushToken: token }, { $set: { isActive: false } }),
    User.updateMany(
      { $or: [{ expoPushToken: token }, { 'expoPushDevices.token': token }] },
      {
        $unset: { expoPushToken: 1 },
        $pull: { expoPushDevices: { token } },
      },
    ),
  ]);
}

async function collectTokensForUser(userId: string): Promise<string[]> {
  const tokens = new Set<string>();

  const devices = await UserDeviceToken.find({ userId, isActive: true })
    .select('pushToken')
    .lean();
  for (const d of devices) {
    const t = d.pushToken?.trim();
    if (t?.startsWith('ExponentPushToken')) tokens.add(t);
  }

  // Legacy fallback while clients migrate to /devices/register.
  const user = await User.findById(userId).select('+expoPushToken +expoPushDevices').lean();
  const latest = user?.expoPushToken?.trim();
  if (latest?.startsWith('ExponentPushToken')) tokens.add(latest);
  for (const device of user?.expoPushDevices ?? []) {
    const t = device.token?.trim();
    if (t?.startsWith('ExponentPushToken')) tokens.add(t);
  }

  return [...tokens];
}

async function unreadBadge(userId: string): Promise<number | undefined> {
  try {
    const count = await Notification.countDocuments({ user: userId, isRead: false });
    return Math.min(count, 99);
  } catch {
    return undefined;
  }
}

/** Low-level Expo push send to every active device. Never throws. */
export async function sendPushNotification(params: {
  userId: string;
  type: NotificationType | string;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  collapseId?: string;
  badge?: number;
  /** Collapse / cancel rings without a second ringtone. */
  silent?: boolean;
}): Promise<void> {
  try {
    const tokens = await collectTokensForUser(params.userId);
    if (!tokens.length) {
      logger.info({ userId: params.userId, type: params.type }, '[PUSH] No devices registered');
      return;
    }

    const call = isIncomingCall(params.type, params.data);
    const message = params.type === NotificationType.Message || params.data?.kind === 'message';
    const missed =
      params.type === NotificationType.MissedCall || params.data?.kind === 'missed_call';
    const like =
      params.type === NotificationType.Like ||
      params.type === NotificationType.Match ||
      params.data?.kind === 'like';
    const badge = params.badge ?? (await unreadBadge(params.userId));

    const payload: Omit<ExpoPushMessage, 'to'> = {
      title: params.title,
      body: params.body,
      data: flattenData({
        ...params.data,
        type: params.data?.type ?? String(params.type).toUpperCase(),
        timestamp: params.data?.timestamp ?? new Date().toISOString(),
      }),
      sound: params.silent ? null : 'default',
      channelId: call
        ? 'incoming_calls_sys'
        : message
          ? 'messages'
          : like
            ? 'likes'
            : missed
              ? 'default'
              : 'default',
      categoryId: call && !params.silent ? 'incoming_call' : undefined,
      priority: 'high',
      interruptionLevel: params.silent ? 'passive' : call ? 'timeSensitive' : 'active',
      ttl: call || params.silent ? 60 : 3600,
      collapseId: params.collapseId,
      badge,
      mutableContent: true,
    };

    logger.info(
      {
        userId: params.userId,
        type: params.type,
        devices: tokens.length,
        callId: params.data?.callId,
        messageId: params.data?.messageId,
        notificationId: params.data?.notificationId,
      },
      `[PUSH] Sending ${String(params.type).toUpperCase()} notification`,
    );

    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tokens.map((to) => ({ ...payload, to }))),
    });

    const body = (await res.json().catch(() => null)) as
      | { data?: Array<{ status?: string; message?: string; details?: { error?: string } }> }
      | null;

    if (!res.ok) {
      logger.warn({ status: res.status, userId: params.userId }, '[PUSH] Expo HTTP error');
      return;
    }

    for (let i = 0; i < (body?.data?.length ?? 0); i++) {
      const ticket = body!.data![i];
      if (ticket?.status === 'error') {
        logger.warn(
          { message: ticket.message, userId: params.userId },
          '[PUSH] Expo ticket error',
        );
        if (ticket.details?.error === 'DeviceNotRegistered' && tokens[i]) {
          await dropInvalidToken(tokens[i]);
        }
      }
    }
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err), userId: params.userId },
      '[PUSH] send failed',
    );
  }
}

export async function sendNotificationToUser(params: {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  collapseId?: string;
}) {
  return sendPushNotification(params);
}

export const sendNotificationToDevices = sendNotificationToUser;

export async function sendMessageNotification(params: {
  userId: string;
  senderId: string;
  senderName: string;
  conversationId: string;
  messageId?: string;
  preview: string;
  notificationId?: string;
}) {
  return sendPushNotification({
    userId: params.userId,
    type: NotificationType.Message,
    title: params.senderName,
    body: params.preview,
    collapseId: `msg-${params.conversationId}`,
    data: {
      type: 'MESSAGE',
      kind: 'message',
      notificationId: params.notificationId,
      messageId: params.messageId,
      senderId: params.senderId,
      conversationId: params.conversationId,
      deepLink: `kushlov://chat/${params.conversationId}`,
    },
  });
}

export async function sendLikeNotification(params: {
  userId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  notificationId?: string;
}) {
  return sendPushNotification({
    userId: params.userId,
    type: NotificationType.Like,
    title: `${params.senderName} liked you ❤️`,
    body: 'Open Kushlov to see who',
    collapseId: `like-${params.senderId}-${params.userId}`,
    data: {
      type: 'LIKE',
      kind: 'like',
      notificationId: params.notificationId,
      senderId: params.senderId,
      senderName: params.senderName,
      senderAvatar: params.senderAvatar,
      targetUserId: params.userId,
      deepLink: 'kushlov://likes',
    },
  });
}

export async function sendIncomingAudioCall(params: {
  userId: string;
  callId: string;
  callerId: string;
  callerName: string;
  callerAvatar?: string;
  interrupt?: boolean;
  notificationId?: string;
}) {
  return sendPushNotification({
    userId: params.userId,
    type: NotificationType.Call,
    title: params.interrupt ? 'Call waiting · audio' : 'Incoming audio call',
    body: `${params.callerName} is calling you`,
    collapseId: `call-${params.callId}`,
    data: {
      type: 'AUDIO_CALL',
      kind: 'incoming_call',
      notificationId: params.notificationId,
      callId: params.callId,
      callType: 'audio',
      callerId: params.callerId,
      callerName: params.callerName,
      callerAvatar: params.callerAvatar,
      interrupt: params.interrupt === true,
      deepLink: `kushlov://call/${params.callId}?type=audio`,
    },
  });
}

export async function sendIncomingVideoCall(params: {
  userId: string;
  callId: string;
  callerId: string;
  callerName: string;
  callerAvatar?: string;
  interrupt?: boolean;
  notificationId?: string;
}) {
  return sendPushNotification({
    userId: params.userId,
    type: NotificationType.Call,
    title: params.interrupt ? 'Call waiting · video' : 'Incoming video call',
    body: `${params.callerName} is calling you`,
    collapseId: `call-${params.callId}`,
    data: {
      type: 'VIDEO_CALL',
      kind: 'incoming_call',
      notificationId: params.notificationId,
      callId: params.callId,
      callType: 'video',
      callerId: params.callerId,
      callerName: params.callerName,
      callerAvatar: params.callerAvatar,
      interrupt: params.interrupt === true,
      deepLink: `kushlov://call/${params.callId}?type=video`,
    },
  });
}

export async function sendMissedCallNotification(params: {
  userId: string;
  callId: string;
  callerId: string;
  callerName: string;
  callType: 'audio' | 'video';
  notificationId?: string;
}) {
  const kind = params.callType === 'video' ? 'video' : 'audio';
  return sendPushNotification({
    userId: params.userId,
    type: NotificationType.MissedCall,
    title: `Missed ${kind} call`,
    body: `Missed ${kind} call from ${params.callerName}`,
    collapseId: `missed-${params.callId}`,
    data: {
      type: params.callType === 'video' ? 'MISSED_VIDEO_CALL' : 'MISSED_AUDIO_CALL',
      kind: 'missed_call',
      notificationId: params.notificationId,
      callId: params.callId,
      callType: params.callType,
      callerId: params.callerId,
      callerName: params.callerName,
      deepLink: `kushlov://profile/${params.callerId}`,
    },
  });
}

export async function sendCallCancelledPush(params: {
  userId: string;
  callId: string;
  callType: 'audio' | 'video';
}) {
  return sendPushNotification({
    userId: params.userId,
    type: NotificationType.Call,
    title: 'Call ended',
    body: 'The caller hung up',
    collapseId: `call-${params.callId}`,
    silent: true,
    data: {
      type: 'CALL_CANCELLED',
      kind: 'call_cancelled',
      callId: params.callId,
      callType: params.callType,
    },
  });
}

/** @deprecated Prefer sendPushNotification — kept for existing imports. */
export const sendExpoPush = sendPushNotification;
