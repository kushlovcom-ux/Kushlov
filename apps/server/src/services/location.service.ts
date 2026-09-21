import { Types } from 'mongoose';
import { haversineKm, DEFAULT_DISCOVERY_RADIUS_KM } from '@kushlov/utils';
import { Profile } from '../models';
import { ApiError } from '../utils/ApiError';

/**
 * Kept for API compatibility / optional distance display only.
 * There is no longer a hard 10 km exclusion or interaction radius.
 */
export const EXCLUSION_RADIUS_KM = Number(
  process.env.DISCOVERY_RADIUS_KM ?? DEFAULT_DISCOVERY_RADIUS_KM,
);
export const EXCLUSION_RADIUS_METERS = EXCLUSION_RADIUS_KM * 1000;

/** @deprecated Use EXCLUSION_RADIUS_KM */
export const DISCOVERY_RADIUS_KM = EXCLUSION_RADIUS_KM;
/** @deprecated Use EXCLUSION_RADIUS_METERS */
export const DISCOVERY_RADIUS_METERS = EXCLUSION_RADIUS_METERS;

/** Get [lng, lat] for a user or throw if location is not set. */
export async function requireUserCoordinates(userId: string): Promise<[number, number]> {
  const profile = await Profile.findOne({ user: userId }).select('location');
  if (!profile?.location?.coordinates?.length) {
    throw ApiError.badRequest(
      'Please set your location using the map to see distances to other users.',
    );
  }
  return profile.location.coordinates as [number, number];
}

/** Optional coordinates — returns null when the user has not shared a location. */
export async function getUserCoordinates(
  userId: string,
): Promise<[number, number] | null> {
  const profile = await Profile.findOne({ user: userId }).select('location');
  if (!profile?.location?.coordinates?.length) return null;
  return profile.location.coordinates as [number, number];
}

/** All users who have shared a map location (except excluded ids). */
export async function getAllLocatedUserIds(
  excludeIds: (string | Types.ObjectId)[] = [],
): Promise<Types.ObjectId[]> {
  const exclude = excludeIds.map(String);
  const ids = await Profile.find({
    user: { $nin: exclude },
    'location.coordinates.0': { $exists: true },
  }).distinct('user');
  return ids as Types.ObjectId[];
}

/**
 * Discoverable users — no distance filter. Prefer located users when available;
 * otherwise callers should list all active accounts.
 */
export async function getDiscoverableUserIds(
  userId: string,
  excludeIds: (string | Types.ObjectId)[] = [],
): Promise<Types.ObjectId[]> {
  return getAllLocatedUserIds([userId, ...excludeIds]);
}

/**
 * @deprecated Radius is no longer enforced. Returns all located users.
 */
export async function getUsersWithinRadiusKm(
  userId: string,
  _radiusKm: number = EXCLUSION_RADIUS_KM,
  excludeIds: (string | Types.ObjectId)[] = [],
): Promise<Types.ObjectId[]> {
  return getAllLocatedUserIds([userId, ...excludeIds]);
}

/** @deprecated Use getDiscoverableUserIds */
export const getNearbyUserIds = getDiscoverableUserIds;

/** Distance in km between two users, or null if either has no location. */
export async function distanceBetweenUsers(
  userA: string,
  userB: string,
): Promise<number | null> {
  const [a, b] = await Promise.all([
    Profile.findOne({ user: userA }).select('location'),
    Profile.findOne({ user: userB }).select('location'),
  ]);
  if (!a?.location?.coordinates || !b?.location?.coordinates) return null;
  const [lng1, lat1] = a.location.coordinates;
  const [lng2, lat2] = b.location.coordinates;
  return haversineKm(lat1, lng1, lat2, lng2);
}

/**
 * No distance or location gate — any user may message / like / call another.
 * Kept as a named hook so call sites stay stable.
 */
export async function assertUsersCanConnect(
  userId: string,
  targetUserId: string,
): Promise<void> {
  if (userId === targetUserId) return;
}

/** @deprecated Use assertUsersCanConnect */
export const assertUsersWithinRange = assertUsersCanConnect;
