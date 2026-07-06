import { Request, Response } from 'express';
import { buildPaginated, parsePagination } from '@kushlov/utils';
import { ContactInquiry } from '../../models';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok, created } from '../../utils/response';

/** POST /contact — submit an inquiry (authenticated users only). */
export const submitInquiry = asyncHandler(async (req: Request, res: Response) => {
  const { subject, category, message } = req.body;
  const inquiry = await ContactInquiry.create({
    user: req.user!.id,
    subject,
    category,
    message,
  });
  return created(res, inquiry, 'Your inquiry has been submitted. We will get back to you soon.');
});

/** GET /contact — list the current user's past inquiries. */
export const listMyInquiries = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = { user: req.user!.id };
  const [items, total] = await Promise.all([
    ContactInquiry.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    ContactInquiry.countDocuments(filter),
  ]);
  return ok(res, buildPaginated(items, page, limit, total));
});
