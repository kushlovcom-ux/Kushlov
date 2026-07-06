import { Request, Response } from 'express';
import { ReportStatus } from '@kushlov/types';
import { buildPaginated, parsePagination } from '@kushlov/utils';
import { Block, Report, User } from '../../models';
import { ApiError } from '../../utils/ApiError';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok, created } from '../../utils/response';
import { uploadBuffer } from '../../services/media.service';

/** POST /moderation/report — report a user with optional evidence. */
export const reportUser = asyncHandler(async (req: Request, res: Response) => {
  const { reportedUser, reason, description, contextType, contextRef } = req.body;
  if (reportedUser === req.user!.id) throw ApiError.badRequest('You cannot report yourself');

  const exists = await User.exists({ _id: reportedUser });
  if (!exists) throw ApiError.notFound('Reported user not found');

  const evidence = [];
  const files = (req.files as Express.Multer.File[]) ?? [];
  for (const file of files) {
    const media = await uploadBuffer(file, `reports/${req.user!.id}`);
    evidence.push({ url: media.url, publicId: media.publicId });
  }

  const report = await Report.create({
    reporter: req.user!.id,
    reportedUser,
    reason,
    description,
    contextType,
    contextRef,
    evidence,
  });
  return created(res, report, 'Report submitted');
});

/** POST /moderation/block/:userId — block a user. */
export const blockUser = asyncHandler(async (req: Request, res: Response) => {
  const target = req.params.userId;
  if (target === req.user!.id) throw ApiError.badRequest('You cannot block yourself');
  await Block.updateOne(
    { blocker: req.user!.id, blocked: target },
    { $setOnInsert: { blocker: req.user!.id, blocked: target } },
    { upsert: true },
  );
  return created(res, null, 'User blocked');
});

/** DELETE /moderation/block/:userId — unblock. */
export const unblockUser = asyncHandler(async (req: Request, res: Response) => {
  await Block.deleteOne({ blocker: req.user!.id, blocked: req.params.userId });
  return ok(res, null, 'User unblocked');
});

/** GET /moderation/blocks — list users I've blocked. */
export const listBlocks = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = { blocker: req.user!.id };
  const [rows, total] = await Promise.all([
    Block.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('blocked', 'displayName username avatarUrl'),
    Block.countDocuments(filter),
  ]);
  return ok(res, buildPaginated(rows.map((r) => r.blocked), page, limit, total));
});
