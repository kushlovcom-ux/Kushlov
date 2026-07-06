import { NextFunction, Request, Response } from 'express';
import { AccountStatus, Role } from '@kushlov/types';
import { ApiError } from '../utils/ApiError';
import { verifyAccessToken } from '../utils/jwt';
import { asyncHandler } from '../utils/asyncHandler';
import { User } from '../models';

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  if (req.cookies?.accessToken) return req.cookies.accessToken as string;
  return null;
}

/** Require a valid access token; attaches req.user. */
export const authenticate = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const token = extractToken(req);
    if (!token) throw ApiError.unauthorized('Authentication required');

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw ApiError.unauthorized('Invalid or expired token');
    }
    if (payload.tokenType !== 'access') throw ApiError.unauthorized('Invalid token type');

    const user = await User.findById(payload.sub).select('role status tokenVersion');
    if (!user) throw ApiError.unauthorized('Account not found');
    if (user.tokenVersion !== payload.tokenVersion) {
      throw ApiError.unauthorized('Session expired, please log in again');
    }
    if (user.status === AccountStatus.Banned) throw ApiError.forbidden('Account banned');
    if (
      user.status === AccountStatus.Suspended &&
      (!user.suspendedUntil || user.suspendedUntil > new Date())
    ) {
      throw ApiError.forbidden('Account suspended');
    }

    req.user = { id: user._id.toString(), role: user.role, tokenVersion: user.tokenVersion };
    next();
  },
);

/** Optional auth: attaches req.user if a valid token is present, else continues. */
export const optionalAuth = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const token = extractToken(req);
    if (!token) return next();
    try {
      const payload = verifyAccessToken(token);
      req.user = { id: payload.sub, role: payload.role, tokenVersion: payload.tokenVersion ?? 0 };
    } catch {
      /* ignore invalid token for optional routes */
    }
    next();
  },
);

/** Restrict a route to one or more roles. */
export const authorize =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) return next(ApiError.forbidden('Insufficient permissions'));
    next();
  };

/** Require an approved host (role host + isHostApproved). */
export const requireApprovedHost = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw ApiError.unauthorized();
    const user = await User.findById(req.user.id).select('role isHostApproved');
    if (!user || user.role !== Role.Host || !user.isHostApproved) {
      throw ApiError.forbidden('Approved host access required');
    }
    next();
  },
);
