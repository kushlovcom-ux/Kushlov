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

export interface ISettings extends Document {
  key: string; // always "global"
  goldConversionRatio: number; // gold earned per diamond spent
  rates: {
    audioCallPerMinute: number; // diamonds
    videoCallPerMinute: number; // diamonds
    liveChatPerMessage: number; // diamonds
    chatPerMessage: number; // diamonds — DM to hosts
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
