import { Schema, model, Document, Types } from 'mongoose';
import { NotificationType } from '@kushlov/types';

export interface INotification extends Document {
  user: Types.ObjectId; // recipient
  type: NotificationType;
  title: string;
  body?: string;
  actor?: Types.ObjectId; // who triggered it
  data?: Record<string, unknown>;
  isRead: boolean;
  createdAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: Object.values(NotificationType), required: true },
    title: { type: String, required: true },
    body: String,
    actor: { type: Schema.Types.ObjectId, ref: 'User' },
    data: Schema.Types.Mixed,
    isRead: { type: Boolean, default: false, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
notificationSchema.index({ user: 1, createdAt: -1 });
export const Notification = model<INotification>(
  'Notification',
  notificationSchema,
  'notifications',
);
