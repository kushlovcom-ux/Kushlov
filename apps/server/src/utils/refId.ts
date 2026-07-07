import type { Types } from 'mongoose';

/** Normalize a populated or raw Mongo ref to a string id. */
export function refId(ref: Types.ObjectId | { _id: Types.ObjectId | string } | string): string {
  if (typeof ref === 'string') return ref;
  if (ref && typeof ref === 'object' && '_id' in ref) return String(ref._id);
  return String(ref);
}
