import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';

/** Send a consistent success envelope. */
export function ok<T>(res: Response, data: T, message?: string, status = StatusCodes.OK): Response {
  return res.status(status).json({ success: true, data, message });
}

/** Convenience for 201 Created. */
export function created<T>(res: Response, data: T, message = 'Created'): Response {
  return ok(res, data, message, StatusCodes.CREATED);
}
