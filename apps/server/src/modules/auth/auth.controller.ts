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
import { grantWelcomeGiftIfEligible } from '../../services/welcome-gift.service';
import { sendMail, passwordResetEmail } from '../../utils/mailer';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import {
  describeFirebaseTokenProblem,
  isFirebaseConfigured,
  peekJwtPayload,
  verifyFirebaseIdToken,
} from '../../config/firebase';
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
  if (!isHostSignup) {
    await grantWelcomeGiftIfEligible(user._id);
  }

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

function extractGoogleLoginToken(req: Request): string {
  const fromBody = typeof req.body?.idToken === 'string' ? req.body.idToken.trim() : '';
  if (fromBody && fromBody !== 'undefined' && fromBody !== 'null') return fromBody;

  const header = req.headers.authorization;
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    const fromHeader = header.slice('Bearer '.length).trim();
    if (fromHeader && fromHeader !== 'undefined' && fromHeader !== 'null') return fromHeader;
  }
  return '';
}

function publicFirebaseVerifyMessage(err: unknown, token: string): string {
  const precheck = describeFirebaseTokenProblem(token);
  if (precheck) return precheck;
  const code = (err as { code?: string })?.code ?? '';
  const msg = err instanceof Error ? err.message : '';
  if (code === 'auth/id-token-expired' || /expired/i.test(msg)) {
    return 'Authentication session expired';
  }
  if (/audience|project/i.test(msg) || code === 'auth/argument-error') {
    const claims = peekJwtPayload(token);
    if (claims?.aud && env.FIREBASE_PROJECT_ID && String(claims.aud) !== env.FIREBASE_PROJECT_ID) {
      return 'Firebase project configuration mismatch';
    }
  }
  return 'Firebase ID token verification failed';
}

/** POST /auth/google — verify Firebase ID token and issue app JWT session. */
export const googleLogin = asyncHandler(async (req: Request, res: Response) => {
  if (!isFirebaseConfigured()) {
    throw ApiError.internal('Google sign-in is not configured on the server');
  }

  const { country } = req.body as { idToken?: string; country?: string };
  const idToken = extractGoogleLoginToken(req);
  if (!idToken) {
    throw ApiError.unauthorized('Firebase ID token is missing');
  }

  const obvious = describeFirebaseTokenProblem(idToken);
  if (obvious) {
    logger.warn(
      {
        reason: obvious,
        tokenIss: peekJwtPayload(idToken)?.iss,
        tokenAud: peekJwtPayload(idToken)?.aud,
        adminProjectId: env.FIREBASE_PROJECT_ID,
      },
      'Rejected Google login token before verifyIdToken',
    );
    throw ApiError.unauthorized(obvious);
  }

  let decoded;
  try {
    decoded = await verifyFirebaseIdToken(idToken);
  } catch (err) {
    const firebaseMessage = err instanceof Error ? err.message : String(err);
    const claims = peekJwtPayload(idToken);
    logger.warn(
      {
        code: (err as { code?: string })?.code,
        firebaseMessage,
        tokenIss: claims?.iss,
        tokenAud: claims?.aud,
        adminProjectId: env.FIREBASE_PROJECT_ID,
      },
      'Firebase ID token verification failed',
    );
    if (
      /not configured|private key|PEM|credential/i.test(firebaseMessage) &&
      !(err as { code?: string })?.code?.startsWith('auth/')
    ) {
      throw ApiError.internal('Google authentication failed');
    }
    throw ApiError.unauthorized(publicFirebaseVerifyMessage(err, idToken));
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
    await grantWelcomeGiftIfEligible(user._id);
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
  const email = String(req.body.email ?? '').trim().toLowerCase();
  const user = await User.findOne({ email });
  if (!user) {
    throw ApiError.notFound('Email is not registered');
  }

  const { raw, hash, expires } = createResetToken();
  await User.updateOne(
    { _id: user._id },
    { $set: { passwordResetToken: hash, passwordResetExpires: expires } },
  );

  const resetUrl = `${env.CLIENT_URL.replace(/\/$/, '')}/reset-password?token=${raw}`;
  const mail = passwordResetEmail(user.displayName, resetUrl);
  try {
    await sendMail({ to: user.email, ...mail });
  } catch (err) {
    // Clear unused token if email failed so the user can retry cleanly.
    await User.updateOne(
      { _id: user._id },
      { $unset: { passwordResetToken: 1, passwordResetExpires: 1 } },
    );
    throw ApiError.badRequest(
      err instanceof Error ? err.message : 'Failed to send reset email. Please try again.',
    );
  }

  return ok(res, null, 'Password reset link has been sent to your email');
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
