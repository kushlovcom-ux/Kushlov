import { Request, Response } from 'express';
import { User, UserDeviceToken } from '../../models';
import { ApiError } from '../../utils/ApiError';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/response';
import { logger } from '../../config/logger';

/**
 * POST /devices/register
 * Upsert this device's Expo push token for the authenticated user.
 */
export const registerDevice = asyncHandler(async (req: Request, res: Response) => {
  const pushToken = String(req.body.pushToken ?? req.body.token ?? '').trim();
  if (!pushToken.startsWith('ExponentPushToken')) {
    throw ApiError.badRequest('Invalid Expo push token');
  }

  const platformRaw = String(req.body.platform ?? '').toLowerCase();
  const platform = platformRaw === 'ios' ? 'ios' : 'android';
  const deviceId = String(req.body.deviceId ?? '').trim() || `anon-${pushToken.slice(-12)}`;
  const appVersion =
    typeof req.body.appVersion === 'string' ? req.body.appVersion : undefined;
  const osVersion = typeof req.body.osVersion === 'string' ? req.body.osVersion : undefined;
  const userId = req.user!.id;
  const now = new Date();

  // If this physical device was owned by another account, detach it.
  await UserDeviceToken.updateMany(
    { deviceId, userId: { $ne: userId }, isActive: true },
    { $set: { isActive: false } },
  );

  const device = await UserDeviceToken.findOneAndUpdate(
    { userId, deviceId },
    {
      $set: {
        pushToken,
        platform,
        appVersion,
        osVersion,
        isActive: true,
        lastUsedAt: now,
      },
      $setOnInsert: { userId, deviceId },
    },
    { upsert: true, new: true },
  );

  // Keep legacy User.expoPushDevices in sync for older clients / push fallback.
  const user = await User.findById(userId).select('+expoPushToken +expoPushDevices');
  if (user) {
    const devices = (user.expoPushDevices ?? [])
      .filter((d) => d.token && d.token !== pushToken && (!deviceId || d.deviceId !== deviceId))
      .map((d) => ({
        token: d.token,
        platform: d.platform,
        deviceId: d.deviceId,
        updatedAt: d.updatedAt,
      }));
    devices.push({ token: pushToken, platform, deviceId, updatedAt: now });
    await User.findByIdAndUpdate(userId, {
      $set: {
        expoPushToken: pushToken,
        expoPushDevices: devices.slice(-12),
      },
    });
  }

  logger.info({ userId, deviceId, platform }, '[PUSH] Device registered');
  return ok(res, {
    id: device._id.toString(),
    deviceId: device.deviceId,
    platform: device.platform,
    isActive: device.isActive,
  });
});

/**
 * DELETE /devices/:deviceId
 * Deactivate the current device association (logout-safe; other devices remain).
 */
export const unregisterDevice = asyncHandler(async (req: Request, res: Response) => {
  const deviceId = String(req.params.deviceId ?? '').trim();
  const token = typeof req.body?.pushToken === 'string' ? req.body.pushToken.trim() : '';
  const queryToken =
    typeof req.query.pushToken === 'string' ? String(req.query.pushToken).trim() : '';
  const pushToken = token || queryToken;
  const userId = req.user!.id;

  const filter = pushToken
    ? { userId, $or: [{ deviceId }, { pushToken }] }
    : { userId, deviceId };

  await UserDeviceToken.updateMany(filter, { $set: { isActive: false } });

  if (pushToken) {
    const user = await User.findById(userId).select('+expoPushToken +expoPushDevices');
    if (user) {
      const remaining = (user.expoPushDevices ?? []).filter((d) => d.token !== pushToken);
      await User.findByIdAndUpdate(userId, {
        $set: {
          expoPushDevices: remaining,
          expoPushToken:
            user.expoPushToken === pushToken ? remaining.at(-1)?.token : user.expoPushToken,
        },
      });
    }
  }

  logger.info({ userId, deviceId }, '[PUSH] Device unregistered');
  return ok(res, { ok: true });
});

/** GET /devices — list active devices for the authenticated user. */
export const listDevices = asyncHandler(async (req: Request, res: Response) => {
  const items = await UserDeviceToken.find({ userId: req.user!.id, isActive: true })
    .select('deviceId platform appVersion osVersion lastUsedAt createdAt')
    .sort({ lastUsedAt: -1 })
    .lean();
  return ok(res, {
    items: items.map((d) => ({
      deviceId: d.deviceId,
      platform: d.platform,
      appVersion: d.appVersion,
      osVersion: d.osVersion,
      lastUsedAt: d.lastUsedAt,
      createdAt: d.createdAt,
    })),
  });
});
