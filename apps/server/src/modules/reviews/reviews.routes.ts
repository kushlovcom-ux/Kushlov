import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { reviewWriteLimiter } from '../../middleware/rateLimit';
import * as ctrl from './reviews.controller';

const router = Router();
router.use(authenticate);

const upsertSchema = z.object({
  hostId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  text: z.string().max(1000).optional(),
});

const updateSchema = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  text: z.string().max(1000).optional(),
});

router.post('/', reviewWriteLimiter, validate({ body: upsertSchema }), ctrl.upsertReview);
router.put('/:id', reviewWriteLimiter, validate({ body: updateSchema }), ctrl.updateReview);
router.delete('/:id', ctrl.deleteOwnReview);
router.get('/host/:hostId', ctrl.listHostReviews);
router.get('/mine/:hostId', ctrl.getMyReviewForHost);

export default router;
