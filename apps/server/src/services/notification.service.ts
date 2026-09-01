import { Types } from 'mongoose';
import { NotificationType, SocketEvents } from '@kushlov/types';
import { Block, Notification } from '../models';
import { emitToUser } from '../socket/io';
import {
  sendCallCancelledPush,
  sendIncomingAudioCall,
  sendIncomingVideoCall,
  sendLikeNotification,
  sendMessageNotification,
  sendMissedCallNotification,
  sendPushNotification,
} from './pushNotification.service';

async function isBlockedEitherWay(a: string, b: string): Promise<boolean> {
  if (!a || !b) return false;
  const hit = await Block.exists({
    $or: [
      { blocker: a, blocked: b },
      { blocker: b, blocked: a },
    ],
  });
  return Boolean(hit);
}

/** Persist a notification, emit socket, and optionally push. Never fails the caller on push errors. */
export async function notify(params: {
  userId: string | Types.ObjectId;
  type: NotificationType;
  title: string;
  body?: string;
  actor?: string | Types.ObjectId;
  data?: Record<string, unknown>;
  push?: boolean;
  collapseId?: string;
}) {
  const recipientId = params.userId.toString();
  const actorId = params.actor ? params.actor.toString() : undefined;

  if (actorId && (await isBlockedEitherWay(recipientId, actorId))) {
    return null;
  }

  const notification = await Notification.create({
    user: params.userId,
    type: params.type,
    title: params.title,
    body: params.body,
    actor: params.actor,
    data: params.data,
  });

  const notificationId = notification._id.toString();
  const data = {
    ...params.data,
    notificationId,
  };

  emitToUser(recipientId, SocketEvents.Notification, {
    id: notificationId,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    data,
    createdAt: notification.createdAt,
  });

  if (params.push !== false) {
    void sendPushNotification({
      userId: recipientId,
      type: params.type,
      title: params.title,
      body: params.body,
      data,
      collapseId: params.collapseId,
    });
  }

  return notification;
}

export async function notifyMessage(params: {
  userId: string;
  senderId: string;
  senderName: string;
  conversationId: string;
  messageId?: string;
  preview: string;
}) {
  if (await isBlockedEitherWay(params.userId, params.senderId)) return null;

  const notification = await Notification.create({
    user: params.userId,
    type: NotificationType.Message,
    title: params.senderName,
    body: params.preview,
    actor: params.senderId,
    data: {
      kind: 'message',
      type: 'MESSAGE',
      conversationId: params.conversationId,
      senderId: params.senderId,
      messageId: params.messageId,
    },
  });

  const notificationId = notification._id.toString();
  emitToUser(params.userId, SocketEvents.Notification, {
    id: notificationId,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    data: { ...notification.data, notificationId },
    createdAt: notification.createdAt,
  });

  void sendMessageNotification({
    ...params,
    notificationId,
  });

  return notification;
}

export async function notifyLike(params: {
  userId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
}) {
  if (await isBlockedEitherWay(params.userId, params.senderId)) return null;

  const notification = await Notification.create({
    user: params.userId,
    type: NotificationType.Like,
    title: `${params.senderName} liked you ❤️`,
    body: 'Open Kushlov to see who',
    actor: params.senderId,
    data: {
      kind: 'like',
      type: 'LIKE',
      senderId: params.senderId,
      senderName: params.senderName,
      senderAvatar: params.senderAvatar,
      targetUserId: params.userId,
    },
  });

  const notificationId = notification._id.toString();
  emitToUser(params.userId, SocketEvents.Notification, {
    id: notificationId,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    data: { ...notification.data, notificationId },
    createdAt: notification.createdAt,
  });

  void sendLikeNotification({ ...params, notificationId });
  return notification;
}

export async function notifyIncomingCall(params: {
  userId: string;
  callId: string;
  callerId: string;
  callerName: string;
  callerAvatar?: string;
  callType: 'audio' | 'video';
  interrupt?: boolean;
}) {
  if (await isBlockedEitherWay(params.userId, params.callerId)) return null;

  const isVideo = params.callType === 'video';
  const title = params.interrupt
    ? `Call waiting · ${isVideo ? 'video' : 'audio'}`
    : `Incoming ${isVideo ? 'video' : 'audio'} call`;

  const notification = await Notification.create({
    user: params.userId,
    type: NotificationType.Call,
    title,
    body: `${params.callerName} is calling you`,
    actor: params.callerId,
    data: {
      kind: 'incoming_call',
      type: isVideo ? 'VIDEO_CALL' : 'AUDIO_CALL',
      callId: params.callId,
      callType: params.callType,
      callerId: params.callerId,
      callerName: params.callerName,
      callerAvatar: params.callerAvatar,
      interrupt: Boolean(params.interrupt),
    },
  });

  const notificationId = notification._id.toString();
  emitToUser(params.userId, SocketEvents.Notification, {
    id: notificationId,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    data: { ...notification.data, notificationId },
    createdAt: notification.createdAt,
  });

  if (isVideo) {
    void sendIncomingVideoCall({ ...params, notificationId });
  } else {
    void sendIncomingAudioCall({ ...params, notificationId });
  }

  return notification;
}

export async function notifyMissedCall(params: {
  userId: string;
  callId: string;
  callerId: string;
  callerName: string;
  callType: 'audio' | 'video';
}) {
  if (await isBlockedEitherWay(params.userId, params.callerId)) return null;

  const kind = params.callType === 'video' ? 'video' : 'audio';
  const notification = await Notification.create({
    user: params.userId,
    type: NotificationType.MissedCall,
    title: `Missed ${kind} call`,
    body: `Missed ${kind} call from ${params.callerName}`,
    actor: params.callerId,
    data: {
      kind: 'missed_call',
      type: params.callType === 'video' ? 'MISSED_VIDEO_CALL' : 'MISSED_AUDIO_CALL',
      callId: params.callId,
      callType: params.callType,
      callerId: params.callerId,
      callerName: params.callerName,
    },
  });

  const notificationId = notification._id.toString();
  emitToUser(params.userId, SocketEvents.Notification, {
    id: notificationId,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    data: { ...notification.data, notificationId },
    createdAt: notification.createdAt,
  });

  void sendMissedCallNotification({ ...params, notificationId });
  return notification;
}

export async function notifyCallCancelled(params: {
  userId: string;
  callId: string;
  callType: 'audio' | 'video';
}) {
  // Push only — do not spam the notification inbox for cancellations.
  void sendCallCancelledPush(params);
  emitToUser(params.userId, SocketEvents.CallEnd, {
    callId: params.callId,
    cancelled: true,
  });
}
