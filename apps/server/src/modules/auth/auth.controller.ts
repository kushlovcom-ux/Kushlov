import { Request, Response } from 'express';
import { Role } from '@kushlov/types';
import { User, Profile } from '../../models';
import { ApiError } from '../../utils/ApiError';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok, created } from '../../utils/response';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../../utils/jwt';
import {
  comparePassword,
  createResetToken,
  hashPassword,
  hashToken,
} from '../../utils/password';
import { setRefreshCookie, clearRefreshCookie } from '../../utils/cookies';
import { ensureWallet } from '../../services/wallet.service';
import { sendMail, passwordResetEmail } from '../../utils/mailer';
import { env } from '../../config/env';

function issueTokens(user: { id: string; role: Role; tokenVersion: number }) {
  const payload = { sub: user.id, role: user.role, tokenVersion: user.tokenVersion };
  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
  };
}

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { email, username, displayName, password, accountType = 'user', country } = req.body;

  const exists = await User.findOne({ $or: [{ email }, { username }] });
  if (exists) throw ApiError.conflict('Email or username already in use');

  const isHostSignup = accountType === 'host';

  const user = await User.create({
    email,
    username,
    displayName,
    password: await hashPassword(password),
    role: isHostSignup ? Role.Host : Role.User,
    isHostApproved: false,
    country,
  });
  await Profile.findOneAndUpdate(
    { user: user._id },
    { $set: { country, user: user._id } },
    { upsert: true },
  );
  await ensureWallet(user._id);

  const tokens = issueTokens({ id: user._id.toString(), role: user.role, tokenVersion: user.tokenVersion });
  setRefreshCookie(res, tokens.refreshToken);
  return created(
    res,
    { user: (user as any).toPublic(), ...tokens, accountType },
    isHostSignup
      ? 'Host account created. Complete verification to go live.'
      : 'Registered successfully',
  );
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await comparePassword(password, user.password))) {
    throw ApiError.unauthorized('Invalid credentials');
  }

  user.lastLoginAt = new Date();
  await user.save();

  const tokens = issueTokens({ id: user._id.toString(), role: user.role, tokenVersion: user.tokenVersion });
  setRefreshCookie(res, tokens.refreshToken);
  return ok(res, { user: (user as any).toPublic(), ...tokens }, 'Logged in');
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.refreshToken ?? req.body?.refreshToken;
  if (!token) throw ApiError.unauthorized('No refresh token');

  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw ApiError.unauthorized('Invalid refresh token');
  }

  const user = await User.findById(payload.sub).select('role tokenVersion');
  if (!user || user.tokenVersion !== payload.tokenVersion) {
    throw ApiError.unauthorized('Session expired');
  }

  const tokens = issueTokens({ id: user._id.toString(), role: user.role, tokenVersion: user.tokenVersion });
  setRefreshCookie(res, tokens.refreshToken);
  return ok(res, tokens, 'Token refreshed');
});

export const logout = asyncHandler(async (_req: Request, res: Response) => {
  clearRefreshCookie(res);
  return ok(res, null, 'Logged out');
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.user!.id);
  if (!user) throw ApiError.notFound('User not found');
  return ok(res, (user as any).toPublic());
});

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  // Always return success to avoid leaking which emails exist.
  if (user) {
    const { raw, hash, expires } = createResetToken();
    user.passwordResetToken = hash;
    user.passwordResetExpires = expires;
    await user.save();
    const resetUrl = `${env.CLIENT_URL}/reset-password?token=${raw}`;
    const mail = passwordResetEmail(user.displayName, resetUrl);
    await sendMail({ to: user.email, ...mail });
  }
  return ok(res, null, 'If that email exists, a reset link has been sent');
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { token, password } = req.body;
  const user = await User.findOne({
    passwordResetToken: hashToken(token),
    passwordResetExpires: { $gt: new Date() },
  }).select('+passwordResetToken +passwordResetExpires');
  if (!user) throw ApiError.badRequest('Invalid or expired reset token');

  user.password = await hashPassword(password);
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  user.tokenVersion += 1; // invalidate all existing sessions
  await user.save();

  clearRefreshCookie(res);
  return ok(res, null, 'Password reset successful, please log in');
});
