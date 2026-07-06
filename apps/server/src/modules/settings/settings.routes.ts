import { Router } from 'express';
import { getSettings } from '../../services/settings.service';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/response';

const router = Router();

/** GET /settings — public, client-safe platform settings. */
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const s = await getSettings();
    return ok(res, {
      rates: s.rates,
      goldConversionRatio: s.goldConversionRatio,
      diamondPackages: s.diamondPackages.filter((p) => p.isActive),
      withdraw: { minGold: s.withdraw.minGold, currency: s.withdraw.currency },
      features: s.features,
      announcements: s.announcements.filter((a) => a.active),
    });
  }),
);

export default router;
