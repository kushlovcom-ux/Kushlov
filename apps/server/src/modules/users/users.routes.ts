import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { uploadImage, uploadMedia } from '../../middleware/upload';
import { searchLimiter } from '../../middleware/rateLimit';
import * as ctrl from './users.controller';
import {
  updateMeSchema,
  updateProfileSchema,
  updateLocationSchema,
  registerPushTokenSchema,
} from './users.validation';

const router = Router();
router.use(authenticate);

router.get('/', searchLimiter, ctrl.searchUsers);
router.get('/hosts/top-rated', searchLimiter, ctrl.listTopRatedHosts);
router.get('/hosts', searchLimiter, ctrl.listHosts);

router.patch('/me', validate({ body: updateMeSchema }), ctrl.updateMe);
router.get('/me/badges', ctrl.getMyBadges);
router.get('/me/interactions', ctrl.getMyInteractions);
router.get('/me/search-contacts', ctrl.searchContacts);
router.get('/me/profile', ctrl.getMyProfile);
router.get('/me/location', ctrl.getMyLocation);
router.post('/me/location', validate({ body: updateLocationSchema }), ctrl.updateMyLocation);
router.post('/me/presence', ctrl.pingPresence);
router.post('/me/push-token', validate({ body: registerPushTokenSchema }), ctrl.registerPushToken);
router.patch('/me/profile', validate({ body: updateProfileSchema }), ctrl.updateMyProfile);
router.post('/me/avatar', uploadImage.single('file'), ctrl.uploadAvatar);
router.post('/me/cover', uploadImage.single('file'), ctrl.uploadCover);
router.post('/me/gallery', uploadMedia.single('file'), ctrl.addGalleryItem);
router.delete('/me/gallery/:mediaId', ctrl.removeGalleryItem);

router.get('/:id', ctrl.getUser);

export default router;
