import { Schema, model, Document, Types } from 'mongoose';
import { DiamondTxnReason, GoldTxnReason, LedgerDirection } from '@kushlov/types';

/** Every user/host has exactly one wallet holding both balances. */
export interface IWallet extends Document {
  user: Types.ObjectId;
  diamonds: number; // spendable by users
  gold: number; // earned by hosts
  totalDiamondsPurchased: number;
  totalGoldEarned: number;
  totalGoldWithdrawn: number;
  createdAt: Date;
  updatedAt: Date;
}

const walletSchema = new Schema<IWallet>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    diamonds: { type: Number, default: 0, min: 0 },
    gold: { type: Number, default: 0, min: 0 },
    totalDiamondsPurchased: { type: Number, default: 0 },
    totalGoldEarned: { type: Number, default: 0 },
    totalGoldWithdrawn: { type: Number, default: 0 },
  },
  { timestamps: true },
);
export const Wallet = model<IWallet>('Wallet', walletSchema, 'wallets');

/** Immutable ledger entry for diamond balance changes. */
export interface IDiamondTransaction extends Document {
  user: Types.ObjectId;
  direction: LedgerDirection;
  amount: number;
  balanceAfter: number;
  reason: DiamondTxnReason;
  reference?: Types.ObjectId;
  referenceModel?: string;
  meta?: Record<string, unknown>;
  createdAt: Date;
}

const diamondTxnSchema = new Schema<IDiamondTransaction>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    direction: { type: String, enum: Object.values(LedgerDirection), required: true },
    amount: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    reason: { type: String, enum: Object.values(DiamondTxnReason), required: true, index: true },
    reference: { type: Schema.Types.ObjectId, refPath: 'referenceModel' },
    referenceModel: String,
    meta: Schema.Types.Mixed,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
diamondTxnSchema.index({ user: 1, createdAt: -1 });
export const DiamondTransaction = model<IDiamondTransaction>(
  'DiamondTransaction',
  diamondTxnSchema,
  'diamondTransactions',
);

/** Immutable ledger entry for gold (host) balance changes. */
export interface IGoldTransaction extends Document {
  user: Types.ObjectId;
  direction: LedgerDirection;
  amount: number;
  balanceAfter: number;
  reason: GoldTxnReason;
  fromUser?: Types.ObjectId;
  reference?: Types.ObjectId;
  referenceModel?: string;
  meta?: Record<string, unknown>;
  createdAt: Date;
}

const goldTxnSchema = new Schema<IGoldTransaction>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    direction: { type: String, enum: Object.values(LedgerDirection), required: true },
    amount: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    reason: { type: String, enum: Object.values(GoldTxnReason), required: true, index: true },
    fromUser: { type: Schema.Types.ObjectId, ref: 'User' },
    reference: { type: Schema.Types.ObjectId, refPath: 'referenceModel' },
    referenceModel: String,
    meta: Schema.Types.Mixed,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
goldTxnSchema.index({ user: 1, createdAt: -1 });
export const GoldTransaction = model<IGoldTransaction>(
  'GoldTransaction',
  goldTxnSchema,
  'goldTransactions',
);
