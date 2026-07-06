import { Schema, model, Document, Types } from 'mongoose';
import { AccountStatus, Gender, Role } from '@kushlov/types';

export interface IUser extends Document {
  _id: Types.ObjectId;
  email: string;
  username: string;
  displayName: string;
  password: string;
  role: Role;
  status: AccountStatus;

  avatarUrl?: string;
  coverUrl?: string;
  bio?: string;
  gender?: Gender;
  country?: string;

  // host lifecycle
  isHostApproved: boolean;
  hostSince?: Date;

  // security
  tokenVersion: number;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  lastLoginAt?: Date;

  // presence
  isOnline: boolean;
  lastSeenAt?: Date;

  // moderation
  suspendedUntil?: Date;
  bannedReason?: string;

  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
      index: true,
    },
    displayName: { type: String, required: true, trim: true, maxlength: 60 },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: Object.values(Role), default: Role.User, index: true },
    status: {
      type: String,
      enum: Object.values(AccountStatus),
      default: AccountStatus.Active,
      index: true,
    },

    avatarUrl: String,
    coverUrl: String,
    bio: { type: String, maxlength: 500 },
    gender: { type: String, enum: Object.values(Gender) },
    country: { type: String, trim: true, maxlength: 80, default: 'India' },

    isHostApproved: { type: Boolean, default: false },
    hostSince: Date,

    tokenVersion: { type: Number, default: 0 },
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    lastLoginAt: Date,

    isOnline: { type: Boolean, default: false },
    lastSeenAt: Date,

    suspendedUntil: Date,
    bannedReason: String,
  },
  { timestamps: true },
);

userSchema.index({ displayName: 'text', username: 'text' });

/** Serialize a user into the public API shape (never leaks secrets). */
userSchema.methods.toPublic = function toPublic() {
  const u = this as IUser;
  return {
    id: u._id.toString(),
    email: u.email,
    username: u.username,
    displayName: u.displayName,
    role: u.role,
    status: u.status,
    avatarUrl: u.avatarUrl,
    coverUrl: u.coverUrl,
    bio: u.bio,
    gender: u.gender,
    country: u.country,
    isHostApproved: u.isHostApproved,
    isOnline: u.isOnline,
    createdAt: u.createdAt?.toISOString(),
  };
};

export const User = model<IUser>('User', userSchema);
