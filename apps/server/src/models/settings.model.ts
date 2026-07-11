import { Schema, model, Document } from 'mongoose';

/** Single-document platform settings, editable by admins. */
export interface IDiamondPackage {
  id: string;
  label: string;
  diamonds: number;
  bonus: number;
  /** @deprecated Use priceUsd */
  price: number;
  /** @deprecated Use priceUsd currency */
  currency: string;
  priceUsd: number;
  priceInr: number;
  isActive: boolean;
}

export interface ILandingStats {
  membersLabel: string;
  verifiedHostsLabel: string;
  liveRoomsLabel: string;
}

export type TimeUnit = 'second' | 'minute' | 'hour';

export interface ISettings extends Document {
  key: string; // always "global"
  goldConversionRatio: number; // gold earned per diamond spent
  rates: {
    /** Fallback diamonds/min when host has no custom videoPrice */
    audioCallPerMinute: number;
    videoCallPerMinute: number;
    liveChatPerMessage: number;
    /** Legacy fallback diamonds per DM when messagesPerDiamond not set */
    chatPerMessage: number;

    /** User → Host: seconds of video call per 1 diamond */
    videoSecondsPerDiamond: number;
    /** User → Host: seconds of audio call per 1 diamond */
    audioSecondsPerDiamond: number;
    videoTimeUnit: TimeUnit;
    audioTimeUnit: TimeUnit;
    /** User → Host: messages per 1 diamond when host has no messagePrice */
    messagesPerDiamond: number;

    /** User → User: seconds of video call per 1 diamond */
    userUserVideoSecondsPerDiamond: number;
    /** User → User: seconds of audio call per 1 diamond */
    userUserAudioSecondsPerDiamond: number;
    userUserVideoTimeUnit: TimeUnit;
    userUserAudioTimeUnit: TimeUnit;
    /** User → User: messages per 1 diamond */
    userUserMessagesPerDiamond: number;

    /** Host → Host: seconds of video call per 1 diamond */
    hostHostVideoSecondsPerDiamond: number;
    hostHostAudioSecondsPerDiamond: number;
    hostHostVideoTimeUnit: TimeUnit;
    hostHostAudioTimeUnit: TimeUnit;
    hostHostMessagesPerDiamond: number;
  };
  diamondPackages: IDiamondPackage[];
  withdraw: {
    goldToFiatRate: number; // fiat per gold
    minGold: number;
    currency: string;
  };
  features: {
    liveEnabled: boolean;
    callsEnabled: boolean;
    giftsEnabled: boolean;
    reviewsEnabled: boolean;
  };
  announcements: { title: string; body: string; active: boolean }[];
  landing: ILandingStats;
  createdAt: Date;
  updatedAt: Date;
}

const settingsSchema = new Schema<ISettings>(
  {
    key: { type: String, default: 'global', unique: true, index: true },
    goldConversionRatio: { type: Number, default: 0.5 },
    rates: {
      audioCallPerMinute: { type: Number, default: 10 },
      videoCallPerMinute: { type: Number, default: 20 },
      liveChatPerMessage: { type: Number, default: 1 },
      chatPerMessage: { type: Number, default: 1 },
      videoSecondsPerDiamond: { type: Number, default: 60 },
      audioSecondsPerDiamond: { type: Number, default: 120 },
      videoTimeUnit: { type: String, enum: ['second', 'minute', 'hour'], default: 'minute' },
      audioTimeUnit: { type: String, enum: ['second', 'minute', 'hour'], default: 'minute' },
      messagesPerDiamond: { type: Number, default: 5 },
      userUserVideoSecondsPerDiamond: { type: Number, default: 90 },
      userUserAudioSecondsPerDiamond: { type: Number, default: 180 },
      userUserVideoTimeUnit: { type: String, enum: ['second', 'minute', 'hour'], default: 'minute' },
      userUserAudioTimeUnit: { type: String, enum: ['second', 'minute', 'hour'], default: 'minute' },
      userUserMessagesPerDiamond: { type: Number, default: 10 },
      hostHostVideoSecondsPerDiamond: { type: Number, default: 60 },
      hostHostAudioSecondsPerDiamond: { type: Number, default: 120 },
      hostHostVideoTimeUnit: { type: String, enum: ['second', 'minute', 'hour'], default: 'minute' },
      hostHostAudioTimeUnit: { type: String, enum: ['second', 'minute', 'hour'], default: 'minute' },
      hostHostMessagesPerDiamond: { type: Number, default: 5 },
    },
    diamondPackages: {
      type: [
        new Schema<IDiamondPackage>(
          {
            id: String,
            label: String,
            diamonds: Number,
            bonus: { type: Number, default: 0 },
            price: Number,
            currency: { type: String, default: 'USD' },
            priceUsd: Number,
            priceInr: Number,
            isActive: { type: Boolean, default: true },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    withdraw: {
      goldToFiatRate: { type: Number, default: 0.01 },
      minGold: { type: Number, default: 1000 },
      currency: { type: String, default: 'USD' },
    },
    features: {
      liveEnabled: { type: Boolean, default: true },
      callsEnabled: { type: Boolean, default: true },
      giftsEnabled: { type: Boolean, default: true },
      reviewsEnabled: { type: Boolean, default: true },
    },
    announcements: {
      type: [{ title: String, body: String, active: { type: Boolean, default: true } }],
      default: [],
    },
    landing: {
      membersLabel: { type: String, default: '120k+' },
      verifiedHostsLabel: { type: String, default: '8k+' },
      liveRoomsLabel: { type: String, default: '24/7' },
    },
  },
  { timestamps: true },
);
export const Settings = model<ISettings>('Settings', settingsSchema, 'settings');
