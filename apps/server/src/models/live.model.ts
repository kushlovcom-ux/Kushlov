import { Schema, model, Document, Types } from 'mongoose';
import { LiveStatus } from '@kushlov/types';

export interface ILiveStream extends Document {
  host: Types.ObjectId;
  /** Optional co-host publishing into this room (2A). */
  coHost?: Types.ObjectId;
  title: string;
  thumbnailUrl?: string;
  thumbnailPublicId?: string;
  roomName: string;
  status: LiveStatus;
  viewerCount: number;
  peakViewers: number;
  totalLikes: number;
  totalGiftsGold: number;
  moderators: Types.ObjectId[];
  bannedUsers: Types.ObjectId[];
  startedAt?: Date;
  endedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const liveStreamSchema = new Schema<ILiveStream>(
  {
    host: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    coHost: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    title: { type: String, required: true, maxlength: 120 },
    thumbnailUrl: String,
    thumbnailPublicId: String,
    roomName: { type: String, required: true, unique: true, index: true },
    status: {
      type: String,
      enum: Object.values(LiveStatus),
      default: LiveStatus.Live,
      index: true,
    },
    viewerCount: { type: Number, default: 0 },
    peakViewers: { type: Number, default: 0 },
    totalLikes: { type: Number, default: 0 },
    totalGiftsGold: { type: Number, default: 0 },
    moderators: { type: [{ type: Schema.Types.ObjectId, ref: 'User' }], default: [] },
    bannedUsers: { type: [{ type: Schema.Types.ObjectId, ref: 'User' }], default: [] },
    startedAt: Date,
    endedAt: Date,
  },
  { timestamps: true },
);
export const LiveStream = model<ILiveStream>('LiveStream', liveStreamSchema, 'liveStreams');

export interface ILiveParticipant extends Document {
  liveStream: Types.ObjectId;
  user: Types.ObjectId;
  role: 'viewer' | 'moderator' | 'host' | 'cohost';
  joinedAt: Date;
  leftAt?: Date;
  isMuted: boolean;
}

const liveParticipantSchema = new Schema<ILiveParticipant>(
  {
    liveStream: { type: Schema.Types.ObjectId, ref: 'LiveStream', required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    role: {
      type: String,
      enum: ['viewer', 'moderator', 'host', 'cohost'],
      default: 'viewer',
    },
    joinedAt: { type: Date, default: Date.now },
    leftAt: Date,
    isMuted: { type: Boolean, default: false },
  },
  { timestamps: true },
);
liveParticipantSchema.index({ liveStream: 1, user: 1 });
export const LiveParticipant = model<ILiveParticipant>(
  'LiveParticipant',
  liveParticipantSchema,
  'liveParticipants',
);

export interface ILiveChat extends Document {
  liveStream: Types.ObjectId;
  user: Types.ObjectId;
  message: string;
  isGift: boolean;
  createdAt: Date;
}

const liveChatSchema = new Schema<ILiveChat>(
  {
    liveStream: { type: Schema.Types.ObjectId, ref: 'LiveStream', required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    message: { type: String, required: true, maxlength: 500 },
    isGift: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
liveChatSchema.index({ liveStream: 1, createdAt: -1 });
export const LiveChat = model<ILiveChat>('LiveChat', liveChatSchema, 'liveChats');
