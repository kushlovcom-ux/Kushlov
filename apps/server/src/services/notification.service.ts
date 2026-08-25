import { Types } from 'mongoose';
import { NotificationType, SocketEvents } from '@kushlov/types';
import { Notification } from '../models';
import { emitToUser } from '../socket/io';
import { sendExpoPush } from './push.service';

/** Persist a notification and push it in realtime to the recipient. */
export async function notify(params: {
  userId: string | Types.ObjectId;
  type: NotificationType;
  title: string;
  body?: string;
  actor?: string | Types.ObjectId;
  data?: Record<string, unknown>;
}) {
  const notification = await Notification.create({
    user: params.userId,
    type: params.type,
    title: params.title,
    body: params.body,
    actor: params.actor,
    data: params.data,
  });

  emitToUser(params.userId.toString(), SocketEvents.Notification, {
    id: notification._id.toString(),
    type: notification.type,
    title: notification.title,
    body: notification.body,
    data: notification.data,
    createdAt: notification.createdAt,
  });

  void sendExpoPush({
    userId: params.userId.toString(),
    type: params.type,
    title: params.title,
    body: params.body,
    data: params.data,
  });

  return notification;
}
