import { Response } from 'express';
import { isProd } from '../config/env';

const REFRESH_COOKIE = 'refreshToken';
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

/** Set the refresh token as a secure, httpOnly cookie. */
export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: THIRTY_DAYS,
    path: '/',
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, { path: '/' });
}

export const REFRESH_COOKIE_NAME = REFRESH_COOKIE;
