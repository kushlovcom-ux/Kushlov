import jwt, { SignOptions } from 'jsonwebtoken';
import { Role } from '@kushlov/types';
import { env } from '../config/env';

export interface JwtPayload {
  sub: string; // user id
  role: Role;
  tokenType: 'access' | 'refresh';
  tokenVersion?: number;
}

export function signAccessToken(payload: Omit<JwtPayload, 'tokenType'>): string {
  return jwt.sign({ ...payload, tokenType: 'access' }, env.JWT_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES,
  } as SignOptions);
}

export function signRefreshToken(payload: Omit<JwtPayload, 'tokenType'>): string {
  return jwt.sign({ ...payload, tokenType: 'refresh' }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES,
  } as SignOptions);
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtPayload;
}
