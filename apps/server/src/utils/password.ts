import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

const SALT_ROUNDS = 12;

export const hashPassword = (plain: string): Promise<string> => bcrypt.hash(plain, SALT_ROUNDS);

export const comparePassword = (plain: string, hash: string): Promise<boolean> =>
  bcrypt.compare(plain, hash);

/** Generate a random reset token + its sha256 hash (store the hash, email the raw). */
export function createResetToken(): { raw: string; hash: string; expires: Date } {
  const raw = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  const expires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
  return { raw, hash, expires };
}

export const hashToken = (raw: string): string =>
  crypto.createHash('sha256').update(raw).digest('hex');
