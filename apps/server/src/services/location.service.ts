import { Types } from 'mongoose';
import { Role } from '@kushlov/types';
import { haversineKm, DEFAULT_DISCOVERY_RADIUS_KM } from '@kushlov/utils';
import { Profile, User } from '../models';
import { ApiError } from '../utils/ApiError';

/**
 * Local exclusion zone (km). Users closer than this are hidden on Discover browse
 * (privacy). Name search ignores this and can find anyone.
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
      'Please set your location using the map to discover users outside your local area.',
    );
  }
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
 * Discover browse: users OUTSIDE the local exclusion zone (~10 km).
 * Nearby / same-location users are intentionally hidden until searched by name.
 */
export async function getDiscoverableUserIds(
  userId: string,
  excludeIds: (string | Types.ObjectId)[] = [],
): Promise<Types.ObjectId[]> {
  const [lng, lat] = await requireUserCoordinates(userId);
  const exclude = [userId, ...excludeIds.map(String)];
  const radiusRadians = EXCLUSION_RADIUS_KM / 6378.1;

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
 * Require both users to have shared location. Distance does not block connect/call
 * (search can surface nearby people by name).
 * Admins bypass this check.
 */
export async function assertUsersCanConnect(
  userId: string,
  targetUserId: string,
): Promise<void> {
  if (userId === targetUserId) return;

  const actor = await User.findById(userId).select('role');
  if (actor?.role === Role.Admin) return;

  await requireUserCoordinates(userId);
  const targetProfile = await Profile.findOne({ user: targetUserId }).select('location');
  if (!targetProfile?.location?.coordinates) {
    throw ApiError.forbidden('This user has not shared their location yet.');
  }
}

/** @deprecated Use assertUsersCanConnect */
export const assertUsersWithinRange = assertUsersCanConnect;
