import { Types } from 'mongoose';
import { Role } from '@kushlov/types';
import { haversineKm, DEFAULT_DISCOVERY_RADIUS_KM } from '@kushlov/utils';
import { Profile, User } from '../models';
import { ApiError } from '../utils/ApiError';

export const DISCOVERY_RADIUS_KM = Number(
  process.env.DISCOVERY_RADIUS_KM ?? DEFAULT_DISCOVERY_RADIUS_KM,
);
export const DISCOVERY_RADIUS_METERS = DISCOVERY_RADIUS_KM * 1000;

/** Get [lng, lat] for a user or throw if location is not set. */
export async function requireUserCoordinates(userId: string): Promise<[number, number]> {
  const profile = await Profile.findOne({ user: userId }).select('location');
  if (!profile?.location?.coordinates?.length) {
    throw ApiError.badRequest(
      'Please set your location using the map to discover and connect with nearby users.',
    );
  }
  return profile.location.coordinates as [number, number];
}

/** User ids within the discovery radius of the given user (excluding self). */
export async function getNearbyUserIds(
  userId: string,
  excludeIds: (string | Types.ObjectId)[] = [],
): Promise<Types.ObjectId[]> {
  const [lng, lat] = await requireUserCoordinates(userId);
  const exclude = new Set([userId, ...excludeIds.map(String)]);

  const profiles = await Profile.find({
    user: { $nin: [...exclude] },
    'location.coordinates': { $exists: true, $ne: null },
    location: {
      $near: {
        $geometry: { type: 'Point', coordinates: [lng, lat] },
        $maxDistance: DISCOVERY_RADIUS_METERS,
      },
    },
  }).select('user');

  return profiles.map((p) => p.user as Types.ObjectId);
}

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
 * Enforce the 20 km proximity rule before likes, messages, calls, etc.
 * Admins bypass this check.
 */
export async function assertUsersWithinRange(
  userId: string,
  targetUserId: string,
): Promise<void> {
  if (userId === targetUserId) return;

  const actor = await User.findById(userId).select('role');
  if (actor?.role === Role.Admin) return;

  const [lng1, lat1] = await requireUserCoordinates(userId);
  const targetProfile = await Profile.findOne({ user: targetUserId }).select('location');
  if (!targetProfile?.location?.coordinates) {
    throw ApiError.forbidden('This user has not shared their location yet.');
  }
  const [lng2, lat2] = targetProfile.location.coordinates;
  const km = haversineKm(lat1, lng1, lat2, lng2);
  if (km > DISCOVERY_RADIUS_KM) {
    throw ApiError.forbidden(
      `You can only connect with users within ${DISCOVERY_RADIUS_KM} km. This user is ${km.toFixed(1)} km away.`,
    );
  }
}
