import { Request, Response } from 'express';
import { buildPaginated, parsePagination } from '@kushlov/utils';
import { Notification } from '../../models';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/response';

/** GET /notifications — paginated notifications for the current user. */
export const listNotifications = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = { user: req.user!.id };
  const [items, total, unread] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Notification.countDocuments(filter),
    Notification.countDocuments({ ...filter, isRead: false }),
  ]);
  return ok(res, { ...buildPaginated(items, page, limit, total), unread });
});

/** GET /notifications/unread-count */
export const unreadCount = asyncHandler(async (req: Request, res: Response) => {
  const unread = await Notification.countDocuments({ user: req.user!.id, isRead: false });
  return ok(res, { unread });
});

/** PATCH /notifications/:id/read — mark a single notification read. */
export const markRead = asyncHandler(async (req: Request, res: Response) => {
  await Notification.updateOne({ _id: req.params.id, user: req.user!.id }, { isRead: true });
  return ok(res, null, 'Marked read');
});

/** PATCH /notifications/read-all — mark all read. */
export const markAllRead = asyncHandler(async (req: Request, res: Response) => {
  await Notification.updateMany({ user: req.user!.id, isRead: false }, { isRead: true });
  return ok(res, null, 'All marked read');
});
