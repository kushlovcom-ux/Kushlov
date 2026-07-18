import { Types } from 'mongoose';
import { Role } from '@kushlov/types';
import { haversineKm, DEFAULT_DISCOVERY_RADIUS_KM } from '@kushlov/utils';
import { Profile, User } from '../models';
import { ApiError } from '../utils/ApiError';

/** Local exclusion zone — users closer than this cannot see or connect (privacy). */
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
      'Please set your location using the map to discover users outside your local area.',
    );
  }
  return profile.location.coordinates as [number, number];
}

/** User ids OUTSIDE the exclusion zone (can be discovered / connected). */
export async function getDiscoverableUserIds(
  userId: string,
  excludeIds: (string | Types.ObjectId)[] = [],
): Promise<Types.ObjectId[]> {
  const [lng, lat] = await requireUserCoordinates(userId);
  const exclude = [userId, ...excludeIds.map(String)];

  const radiusRadians = EXCLUSION_RADIUS_KM / 6378.1;

  // Positive $geoWithin uses the 2dsphere index (cheap). Then exclude those nearby.
  const nearbyIds = await Profile.find({
    user: { $nin: exclude },
    location: {
      $geoWithin: {
        $centerSphere: [[lng, lat], radiusRadians],
      },
    },
  }).distinct('user');

  const nearbySet = new Set(nearbyIds.map(String));
  const blocked = new Set([...exclude, ...nearbySet]);

  const candidates = await Profile.find({
    user: { $nin: [...blocked] },
    'location.coordinates.0': { $exists: true },
  })
    .select('user')
    .lean();

  return candidates.map((p) => p.user as Types.ObjectId);
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
 * Block connections when users are within the exclusion zone (default 20 km).
 * Admins bypass this check.
 */
export async function assertUsersCanConnect(
  userId: string,
  targetUserId: string,
): Promise<void> {
  if (userId === targetUserId) return;

  const [actor] = await Promise.all([
    User.findById(userId).select('role'),
  ]);
  if (actor?.role === Role.Admin) return;

  const [lng1, lat1] = await requireUserCoordinates(userId);
  const targetProfile = await Profile.findOne({ user: targetUserId }).select('location');
  if (!targetProfile?.location?.coordinates) {
    throw ApiError.forbidden('This user has not shared their location yet.');
  }
  const [lng2, lat2] = targetProfile.location.coordinates;
  const km = haversineKm(lat1, lng1, lat2, lng2);
  if (km <= EXCLUSION_RADIUS_KM) {
    throw ApiError.forbidden('This profile isn’t available to connect with right now. Try someone else nearby.');
  }
}

/** @deprecated Use assertUsersCanConnect */
export const assertUsersWithinRange = assertUsersCanConnect;
