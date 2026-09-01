import { Schema, model, Document, Types } from 'mongoose';

export type DevicePlatform = 'android' | 'ios';

export interface IUserDeviceToken extends Document {
  userId: Types.ObjectId;
  pushToken: string;
  platform: DevicePlatform;
  deviceId: string;
  appVersion?: string;
  osVersion?: string;
  isActive: boolean;
  lastUsedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userDeviceTokenSchema = new Schema<IUserDeviceToken>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    pushToken: { type: String, required: true, trim: true },
    platform: { type: String, enum: ['android', 'ios'], required: true },
    deviceId: { type: String, required: true, trim: true },
    appVersion: { type: String, trim: true },
    osVersion: { type: String, trim: true },
    isActive: { type: Boolean, default: true, index: true },
    lastUsedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

userDeviceTokenSchema.index({ userId: 1, deviceId: 1 }, { unique: true });
userDeviceTokenSchema.index({ pushToken: 1 });
userDeviceTokenSchema.index({ userId: 1, isActive: 1 });

export const UserDeviceToken = model<IUserDeviceToken>('UserDeviceToken', userDeviceTokenSchema);
