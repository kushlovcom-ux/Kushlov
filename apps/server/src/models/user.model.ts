import { Schema, model, Document, Types } from 'mongoose';
import { AccountStatus, Gender, Role } from '@kushlov/types';

export interface IUser extends Document {
  _id: Types.ObjectId;
  email: string;
  username: string;
  displayName: string;
  password?: string;
  authProvider: 'local' | 'google';
  firebaseUid?: string;
  emailVerified: boolean;
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

  /** Host rating aggregates (denormalized from reviews). */
  averageRating: number;
  totalReviews: number;

  /** Admin-set host pricing in gold (users pay diamonds converted from these). */
  videoPrice: number;
  audioPrice: number;
  messagePrice: number;

  /** Admin-curated popular hosts shown on the landing page. */
  isPopularHost: boolean;
  popularSortOrder: number;

  /** Normal users: welcome gift diamonds already claimed. */
  welcomeGiftClaimed: boolean;

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
    password: {
      type: String,
      select: false,
      required: function requiredPassword(this: IUser) {
        return !this.firebaseUid;
      },
    },
    authProvider: { type: String, enum: ['local', 'google'], default: 'local' },
    firebaseUid: { type: String, unique: true, sparse: true, index: true },
    emailVerified: { type: Boolean, default: false },
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

    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    totalReviews: { type: Number, default: 0, min: 0 },
    videoPrice: { type: Number, default: 0, min: 0 },
    audioPrice: { type: Number, default: 0, min: 0 },
    messagePrice: { type: Number, default: 0, min: 0 },

    isPopularHost: { type: Boolean, default: false, index: true },
    popularSortOrder: { type: Number, default: 0 },

    welcomeGiftClaimed: { type: Boolean, default: false },

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
userSchema.index({ role: 1, isHostApproved: 1, averageRating: -1, totalReviews: -1 });
userSchema.index({ role: 1, isOnline: -1, lastSeenAt: -1 });
userSchema.index({ isPopularHost: 1, popularSortOrder: 1, averageRating: -1 });

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
    authProvider: u.authProvider,
    emailVerified: u.emailVerified,
    averageRating: u.averageRating ?? 0,
    totalReviews: u.totalReviews ?? 0,
    videoPrice: u.videoPrice ?? 0,
    audioPrice: u.audioPrice ?? 0,
    messagePrice: u.messagePrice ?? 0,
    isPopularHost: u.isPopularHost ?? false,
    popularSortOrder: u.popularSortOrder ?? 0,
    lastSeenAt: u.lastSeenAt?.toISOString(),
    createdAt: u.createdAt?.toISOString(),
  };
};

export const User = model<IUser>('User', userSchema);
