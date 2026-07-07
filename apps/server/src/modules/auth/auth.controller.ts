import { Request, Response } from 'express';
import { AccountStatus, Role } from '@kushlov/types';
import { DEFAULT_COUNTRY } from '@kushlov/utils';
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
import { getFirebaseAuth, isFirebaseConfigured } from '../../config/firebase';
import { generateUniqueUsername } from '../../services/username.service';

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
    authProvider: 'local',
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
  if (!user || !user.password || !(await comparePassword(password, user.password))) {
    if (user && !user.password) {
      throw ApiError.unauthorized('This account uses Google sign-in. Please continue with Google.');
    }
    throw ApiError.unauthorized('Invalid credentials');
  }

  user.lastLoginAt = new Date();
  await user.save();

  const tokens = issueTokens({ id: user._id.toString(), role: user.role, tokenVersion: user.tokenVersion });
  setRefreshCookie(res, tokens.refreshToken);
  return ok(res, { user: (user as any).toPublic(), ...tokens }, 'Logged in');
});

/** POST /auth/google — verify Firebase ID token and issue app JWT session. */
export const googleLogin = asyncHandler(async (req: Request, res: Response) => {
  if (!isFirebaseConfigured()) {
    throw ApiError.internal('Google sign-in is not configured on the server');
  }

  const { idToken, country } = req.body as { idToken: string; country?: string };
  let decoded;
  try {
    decoded = await getFirebaseAuth().verifyIdToken(idToken, true);
  } catch {
    throw ApiError.unauthorized('Invalid or expired Google token');
  }

  const uid = decoded.uid;
  const email = decoded.email?.toLowerCase();
  const name = decoded.name?.trim();
  const picture = decoded.picture;
  const emailVerified = decoded.email_verified ?? false;

  if (!email) throw ApiError.badRequest('Google account has no email address');

  let user = await User.findOne({ $or: [{ firebaseUid: uid }, { email }] });

  if (user) {
    if (user.status === AccountStatus.Banned) throw ApiError.forbidden('Account banned');
    if (
      user.status === AccountStatus.Suspended &&
      (!user.suspendedUntil || user.suspendedUntil > new Date())
    ) {
      throw ApiError.forbidden('Account suspended');
    }

    if (!user.firebaseUid) user.firebaseUid = uid;
    if (user.authProvider === 'local' && !user.password) user.authProvider = 'google';
    if (picture && !user.avatarUrl) user.avatarUrl = picture;
    if (name && user.displayName === user.username) user.displayName = name;
    user.emailVerified = emailVerified || user.emailVerified;
    user.lastLoginAt = new Date();
    await user.save();
  } else {
    const username = await generateUniqueUsername(email.split('@')[0] || name || 'user');
    user = await User.create({
      email,
      username,
      displayName: name || username,
      avatarUrl: picture,
      firebaseUid: uid,
      authProvider: 'google',
      emailVerified,
      role: Role.User,
      country: country || DEFAULT_COUNTRY,
    });
    await Profile.findOneAndUpdate(
      { user: user._id },
      { $set: { country: country || DEFAULT_COUNTRY, user: user._id } },
      { upsert: true },
    );
    await ensureWallet(user._id);
  }

  const tokens = issueTokens({
    id: user._id.toString(),
    role: user.role,
    tokenVersion: user.tokenVersion,
  });
  setRefreshCookie(res, tokens.refreshToken);

  const payload = {
    user: (user as any).toPublic(),
    ...tokens,
    token: tokens.accessToken,
  };
  return ok(res, payload, 'Logged in with Google');
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
