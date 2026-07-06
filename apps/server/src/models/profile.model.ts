import { Schema, model, Document, Types } from 'mongoose';
import { Gender, InterestedIn, MediaType } from '@kushlov/types';

interface IProfileMedia {
  url: string;
  publicId: string;
  type: MediaType;
  width?: number;
  height?: number;
  durationSec?: number;
  createdAt?: Date;
}

export interface IProfile extends Document {
  user: Types.ObjectId;
  dob?: Date;
  gender?: Gender;
  interestedIn?: InterestedIn;
  languages: string[];
  country?: string;
  city?: string;
  location?: { type: 'Point'; coordinates: [number, number] };
  locationLabel?: string;
  locationUpdatedAt?: Date;
  interests: string[];
  photos: IProfileMedia[];
  videos: IProfileMedia[];
  stories: (IProfileMedia & { expiresAt: Date })[];
  height?: number;
  occupation?: string;
  preferences: {
    ageMin: number;
    ageMax: number;
    maxDistanceKm: number;
  };
  stats: { likesReceived: number; followers: number; following: number };
  createdAt: Date;
  updatedAt: Date;
}

const mediaSchema = new Schema<IProfileMedia>(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    type: { type: String, enum: Object.values(MediaType), required: true },
    width: Number,
    height: Number,
    durationSec: Number,
  },
  { _id: true, timestamps: { createdAt: true, updatedAt: false } },
);

const profileSchema = new Schema<IProfile>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    dob: Date,
    gender: { type: String, enum: Object.values(Gender) },
    interestedIn: { type: String, enum: Object.values(InterestedIn) },
    languages: { type: [String], default: [] },
    country: String,
    city: String,
    location: {
      type: { type: String, enum: ['Point'], default: undefined },
      coordinates: { type: [Number], default: undefined },
    },
    locationLabel: String,
    locationUpdatedAt: Date,
    interests: { type: [String], default: [] },
    photos: { type: [mediaSchema], default: [] },
    videos: { type: [mediaSchema], default: [] },
    stories: {
      type: [
        new Schema(
          {
            url: String,
            publicId: String,
            type: { type: String, enum: Object.values(MediaType) },
            expiresAt: Date,
          },
          { timestamps: { createdAt: true, updatedAt: false } },
        ),
      ],
      default: [],
    },
    height: Number,
    occupation: String,
    preferences: {
      ageMin: { type: Number, default: 18 },
      ageMax: { type: Number, default: 60 },
      maxDistanceKm: { type: Number, default: 100 },
    },
    stats: {
      likesReceived: { type: Number, default: 0 },
      followers: { type: Number, default: 0 },
      following: { type: Number, default: 0 },
    },
  },
  { timestamps: true },
);

profileSchema.index({ location: '2dsphere' });
profileSchema.index({ interests: 1 });

export const Profile = model<IProfile>('Profile', profileSchema);
