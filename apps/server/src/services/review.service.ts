import { Types } from 'mongoose';
import { Review } from '../models/review.model';
import { User } from '../models/user.model';

/** Recompute denormalized host rating fields from visible reviews. */
export async function recomputeHostRating(hostId: string | Types.ObjectId): Promise<void> {
  const [agg] = await Review.aggregate([
    { $match: { host: new Types.ObjectId(String(hostId)), isHidden: false } },
    {
      $group: {
        _id: '$host',
        averageRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 },
      },
    },
  ]);

  await User.findByIdAndUpdate(hostId, {
    averageRating: agg ? Math.round(agg.averageRating * 10) / 10 : 0,
    totalReviews: agg?.totalReviews ?? 0,
  });
}

type PopulatedReviewer = {
  _id: Types.ObjectId;
  displayName?: string;
  username?: string;
  avatarUrl?: string;
  emailVerified?: boolean;
};

function isPopulatedReviewer(value: unknown): value is PopulatedReviewer {
  return Boolean(value && typeof value === 'object' && '_id' in (value as object));
}

export function serializeReview(doc: {
  _id: Types.ObjectId;
  host: Types.ObjectId | { _id: Types.ObjectId };
  rating: number;
  text: string;
  createdAt: Date;
  updatedAt: Date;
  reviewer: Types.ObjectId | PopulatedReviewer;
}) {
  const reviewer = isPopulatedReviewer(doc.reviewer)
    ? {
        id: doc.reviewer._id.toString(),
        displayName: doc.reviewer.displayName ?? 'User',
        username: doc.reviewer.username ?? '',
        avatarUrl: doc.reviewer.avatarUrl,
        emailVerified: doc.reviewer.emailVerified,
      }
    : {
        id: String(doc.reviewer),
        displayName: 'User',
        username: '',
      };

  const hostId =
    typeof doc.host === 'object' && doc.host && '_id' in doc.host
      ? doc.host._id.toString()
      : String(doc.host);

  return {
    id: doc._id.toString(),
    hostId,
    rating: doc.rating,
    text: doc.text,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    reviewer,
  };
}
