import { Schema, model, Document, Types } from 'mongoose';

/** One review from a normal user to an approved host. Unique per (reviewer, host). */
export interface IReview extends Document {
  _id: Types.ObjectId;
  host: Types.ObjectId;
  reviewer: Types.ObjectId;
  rating: number;
  text: string;
  isHidden: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const reviewSchema = new Schema<IReview>(
  {
    host: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    reviewer: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    text: { type: String, trim: true, maxlength: 1000, default: '' },
    isHidden: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

reviewSchema.index({ host: 1, reviewer: 1 }, { unique: true });
reviewSchema.index({ host: 1, createdAt: -1 });
reviewSchema.index({ rating: -1 });

export const Review = model<IReview>('Review', reviewSchema, 'reviews');
