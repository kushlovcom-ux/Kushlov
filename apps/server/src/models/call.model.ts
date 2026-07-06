import { Schema, model, Document, Types } from 'mongoose';
import { CallStatus, CallType } from '@kushlov/types';

export interface ICall extends Document {
  type: CallType;
  caller: Types.ObjectId;
  callee: Types.ObjectId;
  roomName: string;
  status: CallStatus;
  startedAt?: Date;
  endedAt?: Date;
  durationSec: number;
  diamondsSpent: number;
  goldEarned: number;
  ratePerMinute: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Factory so audio & video calls share structure but live in separate collections. */
function callSchema(type: CallType) {
  const schema = new Schema<ICall>(
    {
      type: { type: String, enum: Object.values(CallType), default: type },
      caller: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
      callee: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
      roomName: { type: String, required: true, index: true },
      status: {
        type: String,
        enum: Object.values(CallStatus),
        default: CallStatus.Ringing,
        index: true,
      },
      startedAt: Date,
      endedAt: Date,
      durationSec: { type: Number, default: 0 },
      diamondsSpent: { type: Number, default: 0 },
      goldEarned: { type: Number, default: 0 },
      ratePerMinute: { type: Number, default: 0 },
    },
    { timestamps: true },
  );
  schema.index({ caller: 1, createdAt: -1 });
  schema.index({ callee: 1, createdAt: -1 });
  return schema;
}

export const AudioCall = model<ICall>('AudioCall', callSchema(CallType.Audio), 'audioCalls');
export const VideoCall = model<ICall>('VideoCall', callSchema(CallType.Video), 'videoCalls');
