import { Schema, model, Document, Types } from 'mongoose';
import { Gender, VerificationStatus, VerificationStep } from '@kushlov/types';

interface IEvidence {
  url: string;
  publicId: string;
  instruction?: string; // the admin instruction this capture satisfies
}

export interface IVerificationRequest extends Document {
  user: Types.ObjectId;
  status: VerificationStatus;
  currentStep: VerificationStep;

  // Step 1 — basic info
  basic: {
    name?: string;
    username?: string;
    bio?: string;
    gender?: Gender;
    dob?: Date;
    languages: string[];
    country?: string;
  };

  // Step 2 — documents
  documents: {
    governmentId?: IEvidence;
    addressProof?: IEvidence; // optional
  };

  // Step 3 — identity (live captures)
  selfies: IEvidence[]; // expect 3 live selfies
  verificationVideo?: IEvidence; // 1 live video

  // admin instructions snapshot used at capture time
  instructionsUsed: Types.ObjectId[];

  reviewedBy?: Types.ObjectId;
  reviewNote?: string;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const evidenceSchema = new Schema<IEvidence>(
  { url: { type: String, required: true }, publicId: { type: String, required: true }, instruction: String },
  { _id: false },
);

const verificationSchema = new Schema<IVerificationRequest>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: {
      type: String,
      enum: Object.values(VerificationStatus),
      default: VerificationStatus.Pending,
      index: true,
    },
    currentStep: {
      type: String,
      enum: Object.values(VerificationStep),
      default: VerificationStep.BasicInfo,
    },
    basic: {
      name: String,
      username: String,
      bio: String,
      gender: { type: String, enum: Object.values(Gender) },
      dob: Date,
      languages: { type: [String], default: [] },
      country: String,
    },
    documents: {
      governmentId: evidenceSchema,
      addressProof: evidenceSchema,
    },
    selfies: { type: [evidenceSchema], default: [] },
    verificationVideo: evidenceSchema,
    instructionsUsed: { type: [{ type: Schema.Types.ObjectId, ref: 'AdminInstruction' }], default: [] },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewNote: String,
    reviewedAt: Date,
  },
  { timestamps: true },
);
export const VerificationRequest = model<IVerificationRequest>(
  'VerificationRequest',
  verificationSchema,
  'verificationRequests',
);

/** Instructions the admin defines for the live capture step (e.g. "Turn left"). */
export interface IAdminInstruction extends Document {
  text: string;
  category: 'selfie' | 'video' | 'general';
  isActive: boolean;
  sortOrder: number;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const adminInstructionSchema = new Schema<IAdminInstruction>(
  {
    text: { type: String, required: true },
    category: { type: String, enum: ['selfie', 'video', 'general'], default: 'general' },
    isActive: { type: Boolean, default: true, index: true },
    sortOrder: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);
export const AdminInstruction = model<IAdminInstruction>(
  'AdminInstruction',
  adminInstructionSchema,
  'adminInstructions',
);
