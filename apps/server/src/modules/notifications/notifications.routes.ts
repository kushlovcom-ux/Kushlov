import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import * as ctrl from './notifications.controller';

const router = Router();
router.use(authenticate);

router.get('/', ctrl.listNotifications);
router.patch('/read-all', ctrl.markAllRead);
router.patch('/:id/read', ctrl.markRead);

export default router;
