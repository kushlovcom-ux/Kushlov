import { Schema, model, Document, Types } from 'mongoose';
import { PaymentStatus, WithdrawStatus } from '@kushlov/types';

export interface IPayment extends Document {
  user: Types.ObjectId;
  provider: string;
  providerRef?: string;
  packageId?: string;
  amount: number; // fiat amount
  currency: string;
  diamonds: number; // diamonds credited on success
  status: PaymentStatus;
  failureReason?: string;
  refundedAmount?: number;
  meta?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<IPayment>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    provider: { type: String, required: true },
    providerRef: { type: String, index: true },
    packageId: String,
    amount: { type: Number, required: true },
    currency: { type: String, default: 'USD' },
    diamonds: { type: Number, required: true },
    status: {
      type: String,
      enum: Object.values(PaymentStatus),
      default: PaymentStatus.Created,
      index: true,
    },
    failureReason: String,
    refundedAmount: Number,
    meta: Schema.Types.Mixed,
  },
  { timestamps: true },
);
paymentSchema.index({ user: 1, createdAt: -1 });
export const Payment = model<IPayment>('Payment', paymentSchema, 'payments');

export interface IWithdrawRequest extends Document {
  host: Types.ObjectId;
  goldAmount: number;
  fiatAmount: number;
  currency: string;
  method: string;
  destination: Record<string, unknown>;
  status: WithdrawStatus;
  reviewedBy?: Types.ObjectId;
  reviewNote?: string;
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const withdrawSchema = new Schema<IWithdrawRequest>(
  {
    host: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    goldAmount: { type: Number, required: true },
    fiatAmount: { type: Number, required: true },
    currency: { type: String, default: 'USD' },
    method: { type: String, default: 'bank' },
    destination: Schema.Types.Mixed,
    status: {
      type: String,
      enum: Object.values(WithdrawStatus),
      default: WithdrawStatus.Requested,
      index: true,
    },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewNote: String,
    processedAt: Date,
  },
  { timestamps: true },
);
export const WithdrawRequest = model<IWithdrawRequest>(
  'WithdrawRequest',
  withdrawSchema,
  'withdrawRequests',
);
