import { Schema, model, Document, Types } from 'mongoose';

/** Catalog of gifts an admin can configure. */
export interface IGift extends Document {
  name: string;
  imageUrl: string;
  imagePublicId?: string;
  diamondCost: number;
  goldValue: number;
  animationUrl?: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const giftSchema = new Schema<IGift>(
  {
    name: { type: String, required: true, unique: true },
    imageUrl: { type: String, required: true },
    imagePublicId: String,
    diamondCost: { type: Number, required: true, min: 1 },
    goldValue: { type: Number, required: true, min: 0 },
    animationUrl: String,
    isActive: { type: Boolean, default: true, index: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);
export const Gift = model<IGift>('Gift', giftSchema, 'gifts');

export interface ISubscription extends Document {
  user: Types.ObjectId;
  plan: string;
  status: 'active' | 'cancelled' | 'expired';
  startedAt: Date;
  expiresAt: Date;
  autoRenew: boolean;
  payment?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionSchema = new Schema<ISubscription>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    plan: { type: String, required: true },
    status: {
      type: String,
      enum: ['active', 'cancelled', 'expired'],
      default: 'active',
      index: true,
    },
    startedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    autoRenew: { type: Boolean, default: false },
    payment: { type: Schema.Types.ObjectId, ref: 'Payment' },
  },
  { timestamps: true },
);
export const Subscription = model<ISubscription>('Subscription', subscriptionSchema, 'subscriptions');
