import { Schema, model, Document, Types } from 'mongoose';

/**
 * Tracks prepaid message credits when billing uses messages-per-diamond.
 * One doc per (user → host) pair.
 */
export interface IMessageCredit extends Document {
  user: Types.ObjectId;
  host: Types.ObjectId;
  remaining: number;
  updatedAt: Date;
  createdAt: Date;
}

const messageCreditSchema = new Schema<IMessageCredit>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    host: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    remaining: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

messageCreditSchema.index({ user: 1, host: 1 }, { unique: true });

export const MessageCredit = model<IMessageCredit>(
  'MessageCredit',
  messageCreditSchema,
  'messageCredits',
);
