import { Request, Response } from 'express';
import { Role } from '@kushlov/types';
import { buildPaginated, parsePagination } from '@kushlov/utils';
import {
  Block,
  Conversation,
  Follower,
  Like,
  Notification,
  Profile,
  User,
  UserDeviceToken,
} from '../../models';
import { ApiError } from '../../utils/ApiError';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/response';
import { uploadBuffer, deleteMedia } from '../../services/media.service';
import {
  EXCLUSION_RADIUS_KM,
  assertUsersCanConnect,
  distanceBetweenUsers,
  getDiscoverableUserIds,
  getUsersWithinRadiusKm,
  requireUserCoordinates,
} from '../../services/location.service';
import { haversineKm } from '@kushlov/utils';
import { getUserInteractionHistory } from '../../services/interaction.service';
import { grantWelcomeGiftIfEligible } from '../../services/welcome-gift.service';
import { PRESENCE_ONLINE_MS, sweepStalePresence, touchPresence } from '../../services/presence.service';
import { getBusyUserIds } from '../../services/call-busy.service';

/** POST /users/me/push-token — store Expo push token for closed-app notifications. */
export const registerPushToken = asyncHandler(async (req: Request, res: Response) => {
  const token = String(req.body.token ?? '').trim();
  if (!token.startsWith('ExponentPushToken')) {
    throw ApiError.badRequest('Invalid Expo push token');
  }
  const platformRaw =
    typeof req.body.platform === 'string' ? req.body.platform.toLowerCase() : 'android';
  const platform = platformRaw === 'ios' ? 'ios' : 'android';
  const deviceId =
    typeof req.body.deviceId === 'string' && req.body.deviceId.trim()
      ? req.body.deviceId.trim()
      : `anon-${token.slice(-12)}`;
  const user = await User.findById(req.user!.id).select('+expoPushToken +expoPushDevices');
  if (!user) throw ApiError.notFound('User not found');

  const now = new Date();
  const devices = (user.expoPushDevices ?? [])
    .filter((d) => d.token && d.token !== token && (!deviceId || d.deviceId !== deviceId))
    .map((d) => ({
      token: d.token,
      platform: d.platform,
      deviceId: d.deviceId,
      updatedAt: d.updatedAt,
    }));
  devices.push({ token, platform, deviceId, updatedAt: now });
  await User.findByIdAndUpdate(req.user!.id, {
    $set: {
      expoPushToken: token,
      expoPushDevices: devices.slice(-12),
    },
  });

  await UserDeviceToken.updateMany(
    { deviceId, userId: { $ne: req.user!.id }, isActive: true },
    { $set: { isActive: false } },
  );
  await UserDeviceToken.findOneAndUpdate(
    { userId: req.user!.id, deviceId },
    {
      $set: {
        pushToken: token,
        platform,
        isActive: true,
        lastUsedAt: now,
      },
      $setOnInsert: { userId: req.user!.id, deviceId },
    },
    { upsert: true },
  );

  return ok(res, { ok: true });
});

/** POST /users/me/push-token/clear — drop this device after logout. */
export const clearPushToken = asyncHandler(async (req: Request, res: Response) => {
  const token = String(req.body.token ?? '').trim();
  const user = await User.findById(req.user!.id).select('+expoPushToken +expoPushDevices');
  if (!user) throw ApiError.notFound('User not found');
  if (!token) {
    // Logout without a stored token must not disable every other device.
    return ok(res, { ok: true });
  }
  const remaining = (user.expoPushDevices ?? []).filter((d) => d.token !== token);
  await User.findByIdAndUpdate(req.user!.id, {
    $set: {
      expoPushDevices: remaining,
      expoPushToken:
        user.expoPushToken === token ? remaining.at(-1)?.token : user.expoPushToken,
    },
  });
  await UserDeviceToken.updateMany(
    { userId: req.user!.id, pushToken: token },
    { $set: { isActive: false } },
  );
  return ok(res, { ok: true });
});

/** POST /users/me/presence — heartbeat so Online Now / Discover stay accurate on Vercel. */
export const pingPresence = asyncHandler(async (req: Request, res: Response) => {
  await touchPresence(req.user!.id);
  // Opportunistic cleanup of stale presence flags.
  void sweepStalePresence();
  return ok(res, { ok: true });
});

/** GET /users/me/search-contacts — search connectable people by name (no location filter). */
export const searchContacts = asyncHandler(async (req: Request, res: Response) => {
  const me = await User.findById(req.user!.id).select('role');
  if (!me) throw ApiError.notFound('User not found');

  const q = (req.query.q as string)?.trim();
  if (!q || q.length < 2) return ok(res, { items: [] });

  // Hosts search users; normal users search hosts + other users.
  const nameMatch = {
    $or: [{ displayName: new RegExp(q, 'i') }, { username: new RegExp(q, 'i') }],
  };
  const filter: Record<string, unknown> =
    me.role === Role.Host
      ? {
          status: 'active',
          _id: { $ne: me._id },
          $and: [
            nameMatch,
            {
              $or: [{ role: Role.User }, { role: Role.Host, isHostApproved: true }],
            },
          ],
        }
      : {
          status: 'active',
          _id: { $ne: me._id },
          $and: [
            nameMatch,
            {
              $or: [{ role: Role.User }, { role: Role.Host, isHostApproved: true }],
            },
          ],
        };

  const users = await User.find(filter).sort({ isOnline: -1, displayName: 1 }).limit(20);
  return ok(res, { items: users.map((u) => (u as any).toPublic()) });
});

/** GET /users/me/interactions — chat/call/live-chat history with opposite role. */
export const getMyInteractions = asyncHandler(async (req: Request, res: Response) => {
  const me = await User.findById(req.user!.id).select('role');
  if (!me) throw ApiError.notFound('User not found');
  const { q, limit } = req.query as Record<string, string>;
  const result = await getUserInteractionHistory(me._id.toString(), me.role, {
    q,
    limit: limit ? Number(limit) : undefined,
  });
  return ok(res, result);
});

/** GET /users/:id — public profile of a user + their rich profile. */
export const getUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found');

  try {
    await assertUsersCanConnect(req.user!.id, req.params.id);
  } catch (err) {
    if (err instanceof ApiError && err.statusCode === 403) throw err;
    throw ApiError.forbidden('This profile isn’t available to connect with right now.');
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
    discoveryRadiusKm: EXCLUSION_RADIUS_KM,
    exclusionRadiusKm: EXCLUSION_RADIUS_KM,
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
  const { displayName, bio, gender, country } = req.body;
  const update: Record<string, unknown> = {};
  if (displayName !== undefined) update.displayName = displayName;
  if (bio !== undefined) update.bio = bio;
  if (gender !== undefined) update.gender = gender;
  if (country !== undefined) update.country = country;

  const user = await User.findByIdAndUpdate(
    req.user!.id,
    { $set: update },
    { new: true, runValidators: true },
  );
  if (country !== undefined) {
    await Profile.findOneAndUpdate(
      { user: req.user!.id },
      { $set: { country } },
      { upsert: true },
    );
  }
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
  // Fallback for older accounts that registered before welcome gifts existed.
  await grantWelcomeGiftIfEligible(req.user!.id);
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
 * GET /users — Discover browse + name search.
 * Browse: outside ~10 km exclusion zone, online only.
 * Search (q): within ~10 km by name/username — locals can message / like / call.
 */
export const searchUsers = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { q, gender, country, role, online } = req.query as Record<string, string>;
  const isSearch = Boolean(q?.trim());

  const me = await User.findById(req.user!.id).select('role');
  if (!me) throw ApiError.notFound('User not found');

  const blocked = await Block.find({ blocker: req.user!.id }).distinct('blocked');
  const exclude = [...blocked.map(String), req.user!.id];

  await sweepStalePresence();
  // Clear ghost Ongoing calls so Busy badges stay accurate on Discover.
  void import('../../services/call-busy.service').then((m) => m.maybePruneStaleCalls());

  // Browse: outside exclusion radius. Search: only people within ~10 km.
  const candidateIds = isSearch
    ? await getUsersWithinRadiusKm(req.user!.id, EXCLUSION_RADIUS_KM, exclude)
    : await getDiscoverableUserIds(req.user!.id, exclude);

  if (candidateIds.length === 0) {
    return ok(res, buildPaginated([], page, limit, 0));
  }

  const [myLng, myLat] = await requireUserCoordinates(req.user!.id);
  const onlineCutoff = new Date(Date.now() - PRESENCE_ONLINE_MS);

  const userFilter: Record<string, unknown> = {
    _id: { $nin: exclude, $in: candidateIds },
    status: 'active',
  };

  // Browse: only currently online users. Search: show name matches even if offline.
  if (!isSearch || online === 'true') {
    userFilter.lastSeenAt = { $gte: onlineCutoff };
  }

  // Visibility: normal users see hosts + users; hosts see users + other hosts.
  if (me.role === Role.Host) {
    if (role === Role.User) {
      userFilter.role = Role.User;
    } else if (role === Role.Host) {
      userFilter.role = Role.Host;
      userFilter.isHostApproved = true;
    } else {
      userFilter.$or = [
        { role: Role.User },
        { role: Role.Host, isHostApproved: true },
      ];
    }
  } else if (me.role === Role.User) {
    if (role === Role.User) {
      userFilter.role = Role.User;
    } else if (role === Role.Host) {
      userFilter.role = Role.Host;
      userFilter.isHostApproved = true;
    } else {
      userFilter.$or = [
        { role: Role.User },
        { role: Role.Host, isHostApproved: true },
      ];
    }
  } else if (role && Object.values(Role).includes(role as Role)) {
    userFilter.role = role;
  }

  if (gender) userFilter.gender = gender;

  if (isSearch) {
    const term = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const nameMatch = {
      $or: [
        { displayName: new RegExp(term, 'i') },
        { username: new RegExp(term, 'i') },
      ],
    };
    if (userFilter.$or) {
      userFilter.$and = [{ $or: userFilter.$or as unknown[] }, nameMatch];
      delete userFilter.$or;
    } else {
      Object.assign(userFilter, nameMatch);
    }
  }

  if (country) {
    const profileUserIds = await Profile.find({ country, user: { $in: candidateIds } }).distinct(
      'user',
    );
    userFilter._id = { $nin: exclude, $in: profileUserIds };
  }

  const sort: Record<string, 1 | -1> = {
    averageRating: -1,
    totalReviews: -1,
    isOnline: -1,
    lastSeenAt: -1,
    createdAt: -1,
  };

  const [users, total] = await Promise.all([
    User.find(userFilter).sort(sort).skip(skip).limit(limit),
    User.countDocuments(userFilter),
  ]);

  const pageIds = users.map((u) => u._id);
  const [profiles, busyIds] = await Promise.all([
    pageIds.length
      ? Profile.find({ user: { $in: pageIds } }).select('user location')
      : Promise.resolve([]),
    getBusyUserIds(pageIds),
  ]);
  const profileMap = new Map(profiles.map((p) => [p.user.toString(), p]));

  const items = users.map((u) => {
    const pub = (u as any).toPublic();
    const prof = profileMap.get(u._id.toString());
    if (prof?.location?.coordinates) {
      const [lng, lat] = prof.location.coordinates;
      pub.distanceKm = Math.round(haversineKm(myLat, myLng, lat, lng) * 10) / 10;
    }
    pub.isBusy = busyIds.has(u._id.toString());
    // Locals (≤10 km) and browse results with location can message / like / call.
    pub.canInteract =
      pub.distanceKm != null && (isSearch ? pub.distanceKm <= EXCLUSION_RADIUS_KM : true);
    return pub;
  });

  return ok(res, buildPaginated(items, page, limit, total));
});

/** GET /users/me/badges — unread counts for nav badges (messages, notifications). */
export const getMyBadges = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const [notifications, conversations] = await Promise.all([
    Notification.countDocuments({ user: userId, isRead: false }),
    Conversation.find({ participants: userId }).select('unread'),
  ]);
  const messages = conversations.reduce((sum, c) => sum + (c.unread.get(userId) ?? 0), 0);
  return ok(res, { notifications, messages });
});

/** GET /users/hosts — list approved hosts outside the local exclusion zone. */
export const listHosts = asyncHandler(async (req: Request, res: Response) => {
  const me = await User.findById(req.user!.id).select('role');
  if (!me) throw ApiError.notFound('User not found');

  const { page, limit, skip } = parsePagination(req.query);
  const blocked = await Block.find({ blocker: req.user!.id }).distinct('blocked');
  const discoverableIds = await getDiscoverableUserIds(req.user!.id, [
    ...blocked.map(String),
    req.user!.id,
  ]);

  const filter = {
    _id: { $in: discoverableIds, $ne: me._id },
    role: Role.Host,
    isHostApproved: true,
    status: 'active',
  };

  const [hosts, total] = await Promise.all([
    User.find(filter)
      .sort({ averageRating: -1, totalReviews: -1, isOnline: -1, lastSeenAt: -1 })
      .skip(skip)
      .limit(limit),
    User.countDocuments(filter),
  ]);
  return ok(res, buildPaginated(hosts.map((h) => (h as any).toPublic()), page, limit, total));
});

/** GET /users/hosts/top-rated — highest-rated approved hosts. */
export const listTopRatedHosts = asyncHandler(async (req: Request, res: Response) => {
  const me = await User.findById(req.user!.id).select('role');
  if (!me) throw ApiError.notFound('User not found');

  const { page, limit, skip } = parsePagination(req.query);
  const blocked = await Block.find({ blocker: req.user!.id }).distinct('blocked');
  const discoverableIds = await getDiscoverableUserIds(req.user!.id, [
    ...blocked.map(String),
    req.user!.id,
  ]);

  const filter = {
    _id: { $in: discoverableIds },
    role: Role.Host,
    isHostApproved: true,
    status: 'active',
    totalReviews: { $gt: 0 },
  };

  const [hosts, total] = await Promise.all([
    User.find(filter)
      .sort({ averageRating: -1, totalReviews: -1, lastSeenAt: -1 })
      .skip(skip)
      .limit(limit),
    User.countDocuments(filter),
  ]);
  return ok(res, buildPaginated(hosts.map((h) => (h as any).toPublic()), page, limit, total));
});
