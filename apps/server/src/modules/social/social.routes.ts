import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { likeLimiter } from '../../middleware/rateLimit';
import * as ctrl from './social.controller';

const router = Router();
router.use(authenticate);

router.post('/like/:userId', likeLimiter, ctrl.likeUser);
router.delete('/like/:userId', likeLimiter, ctrl.unlikeUser);
router.get('/matches', ctrl.listMatches);
router.get('/likes', ctrl.listLikers);

router.post('/follow/:userId', likeLimiter, ctrl.followUser);
router.delete('/follow/:userId', likeLimiter, ctrl.unfollowUser);
router.get('/following', ctrl.listFollowing);

export default router;
