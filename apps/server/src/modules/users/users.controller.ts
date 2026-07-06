import { Request, Response } from 'express';
import { Role } from '@kushlov/types';
import { buildPaginated, parsePagination } from '@kushlov/utils';
import { Block, Follower, Like, Profile, User } from '../../models';
import { ApiError } from '../../utils/ApiError';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/response';
import { uploadBuffer, deleteMedia } from '../../services/media.service';
import {
  DISCOVERY_RADIUS_KM,
  assertUsersWithinRange,
  distanceBetweenUsers,
  getNearbyUserIds,
  requireUserCoordinates,
} from '../../services/location.service';
import { haversineKm } from '@kushlov/utils';

/** GET /users/:id — public profile of a user + their rich profile. */
export const getUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found');

  try {
    await assertUsersWithinRange(req.user!.id, req.params.id);
  } catch (err) {
    if (err instanceof ApiError && err.statusCode === 403) throw err;
    throw ApiError.forbidden('This profile is outside your discovery range.');
  }

  const profile = await Profile.findOne({ user: user._id });
  const distanceKm = await distanceBetweenUsers(req.user!.id, req.params.id);
  return ok(res, {
    user: (user as any).toPublic(),
    profile,
    distanceKm: distanceKm != null ? Math.round(distanceKm * 10) / 10 : null,
  });
});

/** GET /users/me/location — current user's saved location + discovery radius. */
export const getMyLocation = asyncHandler(async (req: Request, res: Response) => {
  const profile = await Profile.findOne({ user: req.user!.id }).select(
    'location locationLabel city country locationUpdatedAt',
  );
  const coords = profile?.location?.coordinates;
  return ok(res, {
    hasLocation: Boolean(coords),
    lat: coords?.[1] ?? null,
    lng: coords?.[0] ?? null,
    locationLabel: profile?.locationLabel,
    city: profile?.city,
    country: profile?.country,
    locationUpdatedAt: profile?.locationUpdatedAt,
    discoveryRadiusKm: DISCOVERY_RADIUS_KM,
  });
});

/** POST /users/me/location — save coordinates from OpenStreetMap / GPS. */
export const updateMyLocation = asyncHandler(async (req: Request, res: Response) => {
  const { lat, lng, city, country, locationLabel } = req.body;
  const profile = await Profile.findOneAndUpdate(
    { user: req.user!.id },
    {
      $set: {
        location: { type: 'Point', coordinates: [Number(lng), Number(lat)] },
        locationLabel,
        city,
        country,
        locationUpdatedAt: new Date(),
      },
    },
    { upsert: true, new: true },
  );
  return ok(res, profile, 'Location updated');
});

/** PATCH /users/me — update the current user's core identity fields. */
export const updateMe = asyncHandler(async (req: Request, res: Response) => {
  const { displayName, bio, gender } = req.body;
  const user = await User.findByIdAndUpdate(
    req.user!.id,
    { $set: { displayName, bio, gender } },
    { new: true, runValidators: true },
  );
  return ok(res, (user as any)?.toPublic(), 'Profile updated');
});

/** GET /users/me/profile — the current user's detailed profile (created if missing). */
export const getMyProfile = asyncHandler(async (req: Request, res: Response) => {
  const profile = await Profile.findOneAndUpdate(
    { user: req.user!.id },
    { $setOnInsert: { user: req.user!.id } },
    { upsert: true, new: true },
  );
  return ok(res, profile);
});

/** PATCH /users/me/profile — update detailed profile fields. */
export const updateMyProfile = asyncHandler(async (req: Request, res: Response) => {
  const allowed = [
    'dob',
    'gender',
    'interestedIn',
    'languages',
    'country',
    'city',
    'interests',
    'height',
    'occupation',
    'preferences',
  ];
  const update: Record<string, unknown> = {};
  for (const key of allowed) if (key in req.body) update[key] = req.body[key];

  if (req.body.lng != null && req.body.lat != null) {
    update.location = { type: 'Point', coordinates: [Number(req.body.lng), Number(req.body.lat)] };
  }

  const profile = await Profile.findOneAndUpdate(
    { user: req.user!.id },
    { $set: update },
    { upsert: true, new: true, runValidators: true },
  );
  return ok(res, profile, 'Profile updated');
});

/** POST /users/me/avatar — upload/replace avatar image. */
export const uploadAvatar = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw ApiError.badRequest('No file provided');
  const media = await uploadBuffer(req.file, `avatars/${req.user!.id}`);
  const user = await User.findByIdAndUpdate(
    req.user!.id,
    { avatarUrl: media.url },
    { new: true },
  );
  return ok(res, (user as any)?.toPublic(), 'Avatar updated');
});

/** POST /users/me/cover — upload/replace cover image. */
export const uploadCover = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw ApiError.badRequest('No file provided');
  const media = await uploadBuffer(req.file, `covers/${req.user!.id}`);
  const user = await User.findByIdAndUpdate(req.user!.id, { coverUrl: media.url }, { new: true });
  return ok(res, (user as any)?.toPublic(), 'Cover updated');
});

/** POST /users/me/gallery — add a photo/video to the profile gallery. */
export const addGalleryItem = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw ApiError.badRequest('No file provided');
  const media = await uploadBuffer(req.file, `gallery/${req.user!.id}`);
  const field = media.type === 'video' ? 'videos' : 'photos';
  const profile = await Profile.findOneAndUpdate(
    { user: req.user!.id },
    { $push: { [field]: media } },
    { upsert: true, new: true },
  );
  return ok(res, profile, 'Media added');
});

/** DELETE /users/me/gallery/:mediaId — remove a gallery item + Cloudinary asset. */
export const removeGalleryItem = asyncHandler(async (req: Request, res: Response) => {
  const profile = await Profile.findOne({ user: req.user!.id });
  if (!profile) throw ApiError.notFound('Profile not found');

  const { mediaId } = req.params;
  const all = [...profile.photos, ...profile.videos];
  const item = all.find((m) => (m as any)._id?.toString() === mediaId);
  if (item) await deleteMedia(item.publicId, item.type === 'video' ? 'video' : 'image');

  profile.photos = profile.photos.filter((m) => (m as any)._id?.toString() !== mediaId) as any;
  profile.videos = profile.videos.filter((m) => (m as any)._id?.toString() !== mediaId) as any;
  await profile.save();
  return ok(res, profile, 'Media removed');
});

/**
 * GET /users — search & filter users/hosts with pagination.
 * Supports q (text), gender, country, role, minAge/maxAge, online.
 */
export const searchUsers = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { q, gender, country, role, online } = req.query as Record<string, string>;

  const blocked = await Block.find({ blocker: req.user!.id }).distinct('blocked');
  const exclude = [...blocked.map(String), req.user!.id];

  // Only show users within discovery radius (OpenStreetMap coordinates).
  const nearbyIds = await getNearbyUserIds(req.user!.id, exclude);
  if (nearbyIds.length === 0) {
    return ok(res, buildPaginated([], page, limit, 0));
  }

  const [myLng, myLat] = await requireUserCoordinates(req.user!.id);

  const userFilter: Record<string, unknown> = {
    _id: { $nin: exclude, $in: nearbyIds },
    status: 'active',
  };
  if (role && Object.values(Role).includes(role as Role)) userFilter.role = role;
  if (gender) userFilter.gender = gender;
  if (online === 'true') userFilter.isOnline = true;
  if (q) userFilter.$text = { $search: q };

  if (country) {
    const profileUserIds = await Profile.find({ country, user: { $in: nearbyIds } }).distinct(
      'user',
    );
    userFilter._id = { $nin: exclude, $in: profileUserIds };
  }

  const [users, total, profiles] = await Promise.all([
    User.find(userFilter).sort({ isOnline: -1, createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(userFilter),
    Profile.find({ user: { $in: nearbyIds } }).select('user location'),
  ]);

  const profileMap = new Map(profiles.map((p) => [p.user.toString(), p]));

  const items = users.map((u) => {
    const pub = (u as any).toPublic();
    const prof = profileMap.get(u._id.toString());
    if (prof?.location?.coordinates) {
      const [lng, lat] = prof.location.coordinates;
      pub.distanceKm = Math.round(haversineKm(myLat, myLng, lat, lng) * 10) / 10;
    }
    return pub;
  });

  return ok(res, buildPaginated(items, page, limit, total));
});

/** GET /users/hosts — list approved hosts within discovery radius. */
export const listHosts = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePagination(req.query);
  const blocked = await Block.find({ blocker: req.user!.id }).distinct('blocked');
  const nearbyIds = await getNearbyUserIds(req.user!.id, blocked);

  const filter = {
    _id: { $in: nearbyIds },
    role: Role.Host,
    isHostApproved: true,
    status: 'active',
  };

  const [hosts, total] = await Promise.all([
    User.find(filter).sort({ isOnline: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);
  return ok(res, buildPaginated(hosts.map((h) => (h as any).toPublic()), page, limit, total));
});
