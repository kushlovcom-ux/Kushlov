import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import * as ctrl from './social.controller';

const router = Router();
router.use(authenticate);

router.post('/like/:userId', ctrl.likeUser);
router.delete('/like/:userId', ctrl.unlikeUser);
router.get('/matches', ctrl.listMatches);
router.get('/likes', ctrl.listLikers);

router.post('/follow/:userId', ctrl.followUser);
router.delete('/follow/:userId', ctrl.unfollowUser);
router.get('/following', ctrl.listFollowing);

export default router;
