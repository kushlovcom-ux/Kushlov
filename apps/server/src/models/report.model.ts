import { Schema, model, Document, Types } from 'mongoose';
import { ReportStatus } from '@kushlov/types';

export interface IReport extends Document {
  reporter: Types.ObjectId;
  reportedUser: Types.ObjectId;
  reason: string;
  description?: string;
  evidence: { url: string; publicId: string }[];
  contextType?: 'profile' | 'message' | 'live' | 'call';
  contextRef?: Types.ObjectId;
  status: ReportStatus;
  handledBy?: Types.ObjectId;
  resolutionNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

const reportSchema = new Schema<IReport>(
  {
    reporter: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    reportedUser: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    reason: { type: String, required: true },
    description: String,
    evidence: { type: [{ url: String, publicId: String }], default: [] },
    contextType: { type: String, enum: ['profile', 'message', 'live', 'call'] },
    contextRef: Schema.Types.ObjectId,
    status: {
      type: String,
      enum: Object.values(ReportStatus),
      default: ReportStatus.Open,
      index: true,
    },
    handledBy: { type: Schema.Types.ObjectId, ref: 'User' },
    resolutionNote: String,
  },
  { timestamps: true },
);
export const Report = model<IReport>('Report', reportSchema, 'reports');

/** Blocked-user relationship. */
export interface IBlock extends Document {
  blocker: Types.ObjectId;
  blocked: Types.ObjectId;
  createdAt: Date;
}

const blockSchema = new Schema<IBlock>(
  {
    blocker: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    blocked: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
blockSchema.index({ blocker: 1, blocked: 1 }, { unique: true });
export const Block = model<IBlock>('Block', blockSchema, 'blocks');
