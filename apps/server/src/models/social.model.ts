import { Schema, model, Document, Types } from 'mongoose';

/** A one-directional "like" between users. A mutual pair produces a Match. */
export interface ILike extends Document {
  from: Types.ObjectId;
  to: Types.ObjectId;
  createdAt: Date;
}

const likeSchema = new Schema<ILike>(
  {
    from: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    to: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
likeSchema.index({ from: 1, to: 1 }, { unique: true });
export const Like = model<ILike>('Like', likeSchema, 'likes');

/** A mutual match between two users (order-independent pair). */
export interface IMatch extends Document {
  users: Types.ObjectId[];
  matchedAt: Date;
  active: boolean;
}

const matchSchema = new Schema<IMatch>(
  {
    users: {
      type: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      validate: (v: unknown[]) => v.length === 2,
      index: true,
    },
    matchedAt: { type: Date, default: Date.now },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);
export const Match = model<IMatch>('Match', matchSchema, 'matches');

/** Follower relationship (used for hosts). */
export interface IFollower extends Document {
  follower: Types.ObjectId;
  following: Types.ObjectId;
  createdAt: Date;
}

const followerSchema = new Schema<IFollower>(
  {
    follower: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    following: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
followerSchema.index({ follower: 1, following: 1 }, { unique: true });
export const Follower = model<IFollower>('Follower', followerSchema, 'followers');
