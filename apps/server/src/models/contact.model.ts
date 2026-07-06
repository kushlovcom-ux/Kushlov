import { Schema, model, Document, Types } from 'mongoose';

export enum ContactStatus {
  Open = 'open',
  InProgress = 'in_progress',
  Resolved = 'resolved',
}

export interface IContactInquiry extends Document {
  user: Types.ObjectId;
  subject: string;
  category: string;
  message: string;
  status: ContactStatus;
  adminNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

const contactSchema = new Schema<IContactInquiry>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    subject: { type: String, required: true, maxlength: 120 },
    category: { type: String, required: true, maxlength: 60 },
    message: { type: String, required: true, maxlength: 3000 },
    status: {
      type: String,
      enum: Object.values(ContactStatus),
      default: ContactStatus.Open,
      index: true,
    },
    adminNote: String,
  },
  { timestamps: true },
);

contactSchema.index({ createdAt: -1 });

export const ContactInquiry = model<IContactInquiry>(
  'ContactInquiry',
  contactSchema,
  'contactInquiries',
);
