import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { uploadImage, uploadMedia } from '../../middleware/upload';
import * as ctrl from './users.controller';
import { updateMeSchema, updateProfileSchema, updateLocationSchema } from './users.validation';

const router = Router();
router.use(authenticate);

router.get('/', ctrl.searchUsers);
router.get('/hosts/top-rated', ctrl.listTopRatedHosts);
router.get('/hosts', ctrl.listHosts);

router.patch('/me', validate({ body: updateMeSchema }), ctrl.updateMe);
router.get('/me/badges', ctrl.getMyBadges);
router.get('/me/interactions', ctrl.getMyInteractions);
router.get('/me/search-contacts', ctrl.searchContacts);
router.get('/me/profile', ctrl.getMyProfile);
router.get('/me/location', ctrl.getMyLocation);
router.post('/me/location', validate({ body: updateLocationSchema }), ctrl.updateMyLocation);
router.patch('/me/profile', validate({ body: updateProfileSchema }), ctrl.updateMyProfile);
router.post('/me/avatar', uploadImage.single('file'), ctrl.uploadAvatar);
router.post('/me/cover', uploadImage.single('file'), ctrl.uploadCover);
router.post('/me/gallery', uploadMedia.single('file'), ctrl.addGalleryItem);
router.delete('/me/gallery/:mediaId', ctrl.removeGalleryItem);

router.get('/:id', ctrl.getUser);

export default router;
