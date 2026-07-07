var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/config/env.ts
import { config as loadEnv } from "dotenv";
import { existsSync } from "fs";
import { resolve } from "path";
import { z } from "zod";
function getLiveKitPublicUrl() {
  return hasLiveKit ? env.LIVEKIT_URL : null;
}
var EnvSchema, parsed, env, isProd, isDev, hasCloudinary, hasLiveKit;
var init_env = __esm({
  "src/config/env.ts"() {
    "use strict";
    for (const candidate of [".env", resolve(process.cwd(), "../../.env")]) {
      if (existsSync(candidate)) loadEnv({ path: candidate });
    }
    EnvSchema = z.object({
      NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
      PORT: z.coerce.number().default(5e3),
      MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
      REDIS_URL: z.string().optional(),
      JWT_SECRET: z.string().min(10, "JWT_SECRET must be set"),
      JWT_REFRESH_SECRET: z.string().min(10, "JWT_REFRESH_SECRET must be set"),
      JWT_ACCESS_EXPIRES: z.string().default("15m"),
      JWT_REFRESH_EXPIRES: z.string().default("30d"),
      CLIENT_URL: z.string().default("http://localhost:3000"),
      CORS_ORIGINS: z.string().default("http://localhost:3000"),
      CLOUDINARY_CLOUD_NAME: z.string().optional(),
      CLOUDINARY_API_KEY: z.string().optional(),
      CLOUDINARY_API_SECRET: z.string().optional(),
      CLOUDINARY_URL: z.string().optional(),
      LIVEKIT_URL: z.string().optional(),
      LIVEKIT_API_KEY: z.string().optional(),
      LIVEKIT_API_SECRET: z.string().optional(),
      SMTP_HOST: z.string().optional(),
      SMTP_PORT: z.coerce.number().optional(),
      SMTP_USER: z.string().optional(),
      SMTP_PASS: z.string().optional(),
      MAIL_FROM: z.string().default("Kushlov <no-reply@kushlov.app>"),
      PAYMENT_PROVIDER: z.string().default("mock"),
      STRIPE_SECRET_KEY: z.string().optional(),
      STRIPE_WEBHOOK_SECRET: z.string().optional(),
      RATE_LIMIT_WINDOW_MS: z.coerce.number().default(15 * 60 * 1e3),
      RATE_LIMIT_MAX: z.coerce.number().default(300),
      ADMIN_EMAIL: z.string().email().optional(),
      ADMIN_PASSWORD: z.string().optional(),
      FIREBASE_PROJECT_ID: z.string().optional(),
      FIREBASE_CLIENT_EMAIL: z.string().optional(),
      FIREBASE_PRIVATE_KEY: z.string().optional()
    });
    parsed = EnvSchema.safeParse(process.env);
    if (!parsed.success) {
      console.error("\u274C Invalid environment variables:", parsed.error.flatten().fieldErrors);
      if (!process.env.VERCEL) {
        process.exit(1);
      }
    }
    env = parsed.success ? parsed.data : {
      NODE_ENV: "production",
      PORT: 5e3,
      MONGODB_URI: process.env.MONGODB_URI ?? "",
      REDIS_URL: process.env.REDIS_URL,
      JWT_SECRET: process.env.JWT_SECRET ?? "missing",
      JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET ?? "missing",
      JWT_ACCESS_EXPIRES: "15m",
      JWT_REFRESH_EXPIRES: "30d",
      CLIENT_URL: process.env.CLIENT_URL ?? "http://localhost:3000",
      CORS_ORIGINS: process.env.CORS_ORIGINS ?? "*",
      CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
      CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
      CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
      CLOUDINARY_URL: process.env.CLOUDINARY_URL,
      LIVEKIT_URL: process.env.LIVEKIT_URL,
      LIVEKIT_API_KEY: process.env.LIVEKIT_API_KEY,
      LIVEKIT_API_SECRET: process.env.LIVEKIT_API_SECRET,
      SMTP_HOST: process.env.SMTP_HOST,
      SMTP_PORT: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : void 0,
      SMTP_USER: process.env.SMTP_USER,
      SMTP_PASS: process.env.SMTP_PASS,
      MAIL_FROM: process.env.MAIL_FROM ?? "Kushlov <no-reply@kushlov.app>",
      PAYMENT_PROVIDER: process.env.PAYMENT_PROVIDER ?? "mock",
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
      STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
      RATE_LIMIT_WINDOW_MS: 9e5,
      RATE_LIMIT_MAX: 300,
      ADMIN_EMAIL: process.env.ADMIN_EMAIL,
      ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
      FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
      FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL,
      FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY
    };
    isProd = env.NODE_ENV === "production";
    isDev = env.NODE_ENV === "development";
    hasCloudinary = Boolean(
      env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET
    );
    hasLiveKit = Boolean(env.LIVEKIT_URL && env.LIVEKIT_API_KEY && env.LIVEKIT_API_SECRET);
  }
});

// src/config/logger.ts
import pino from "pino";
var isLocalDev, logger;
var init_logger = __esm({
  "src/config/logger.ts"() {
    "use strict";
    isLocalDev = process.env.NODE_ENV === "development" && !process.env.VERCEL;
    logger = pino({
      level: process.env.LOG_LEVEL ?? (isLocalDev ? "debug" : "info"),
      transport: isLocalDev ? {
        target: "pino-pretty",
        options: { colorize: true, translateTime: "SYS:HH:MM:ss", ignore: "pid,hostname" }
      } : void 0,
      base: { service: "kushlov-api" }
    });
  }
});

// src/config/db.ts
var db_exports = {};
__export(db_exports, {
  connectDatabase: () => connectDatabase,
  disconnectDatabase: () => disconnectDatabase
});
import mongoose from "mongoose";
async function connectDatabase() {
  if (cache.conn) return cache.conn;
  mongoose.connection.on("connected", () => logger.info("\u{1F5C4}\uFE0F  MongoDB connected"));
  mongoose.connection.on("error", (err) => logger.error({ err }, "MongoDB connection error"));
  mongoose.connection.on("disconnected", () => logger.warn("MongoDB disconnected"));
  if (!cache.promise) {
    cache.promise = mongoose.connect(env.MONGODB_URI, {
      maxPoolSize: process.env.VERCEL ? 5 : 20,
      serverSelectionTimeoutMS: 1e4,
      socketTimeoutMS: 45e3,
      autoIndex: env.NODE_ENV !== "production"
    });
  }
  cache.conn = await cache.promise;
  return cache.conn;
}
async function disconnectDatabase() {
  await mongoose.disconnect();
}
var cache;
var init_db = __esm({
  "src/config/db.ts"() {
    "use strict";
    init_env();
    init_logger();
    mongoose.set("strictQuery", true);
    cache = global.__mongooseCache ?? { conn: null, promise: null };
    global.__mongooseCache = cache;
  }
});

// src/app.ts
import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import compression from "compression";
import { pinoHttp } from "pino-http";

// src/config/cors.ts
init_env();
init_logger();
var LOCAL_DEV_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;
var DEFAULT_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://kushlov-web.vercel.app",
  "https://kushlov-server.vercel.app"
];
function isLocalDevOrigin(origin) {
  return LOCAL_DEV_ORIGIN.test(origin.replace(/\/$/, ""));
}
function getAllowedOrigins() {
  const origins = new Set(DEFAULT_ORIGINS);
  for (const entry of env.CORS_ORIGINS.split(",")) {
    const trimmed = entry.trim().replace(/\/$/, "");
    if (trimmed && trimmed !== "*") origins.add(trimmed);
  }
  const client2 = env.CLIENT_URL?.trim().replace(/\/$/, "");
  if (client2) origins.add(client2);
  return [...origins];
}
function isOriginAllowed(origin) {
  if (!origin) return true;
  const normalized = origin.replace(/\/$/, "");
  if (isLocalDevOrigin(normalized)) return true;
  if (getAllowedOrigins().includes(normalized)) return true;
  if (/^https:\/\/[\w-]+\.vercel\.app$/i.test(normalized)) {
    return true;
  }
  return env.CORS_ORIGINS.split(",").some((o) => o.trim() === "*");
}
function applyCorsHeaders(req, res) {
  const origin = req.headers.origin;
  if (origin && isOriginAllowed(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Vary", "Origin");
    return true;
  }
  if (!origin) return true;
  return false;
}
function corsMiddleware(req, res, next) {
  const allowed = applyCorsHeaders(req, res);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With, Accept"
  );
  res.setHeader("Access-Control-Max-Age", "86400");
  if (req.method === "OPTIONS") {
    if (!allowed && req.headers.origin) {
      logger.warn({ origin: req.headers.origin }, "CORS preflight blocked");
      res.status(403).end();
      return;
    }
    res.status(204).end();
    return;
  }
  if (!allowed && req.headers.origin) {
    logger.warn({ origin: req.headers.origin }, "CORS blocked origin");
    res.status(403).json({ success: false, message: "CORS origin not allowed" });
    return;
  }
  next();
}

// src/app.ts
init_env();
init_db();
init_logger();

// src/middleware/rateLimit.ts
init_env();
import rateLimit from "express-rate-limit";

// src/config/redis.ts
init_env();
init_logger();
import Redis from "ioredis";
var client = null;
function getRedis() {
  if (!env.REDIS_URL) return null;
  if (client) return client;
  client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 2,
    lazyConnect: Boolean(process.env.VERCEL),
    retryStrategy: (times) => Math.min(times * 200, 2e3)
  });
  client.on("connect", () => logger.info("\u{1F50C} Redis connected"));
  client.on("error", (err) => logger.warn({ err: err.message }, "Redis error (continuing without)"));
  return client;
}
var redisEnabled = Boolean(env.REDIS_URL);

// src/middleware/rateLimit.ts
init_logger();
function buildLimiter(options) {
  const redis = getRedis();
  let store;
  if (redis) {
    try {
      const { RedisStore } = __require("rate-limit-redis");
      store = new RedisStore({
        sendCommand: (...args) => redis.call(...args)
      });
    } catch {
      logger.warn("rate-limit-redis unavailable, using memory store");
    }
  }
  return rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    store,
    message: { success: false, message: "Too many requests, please try again later." },
    ...options
  });
}
function lazyLimiter(options = {}) {
  let limiter;
  return (req, res, next) => {
    if (req.method === "OPTIONS") {
      next();
      return;
    }
    if (!limiter) limiter = buildLimiter(options);
    return limiter(req, res, next);
  };
}
var globalLimiter = lazyLimiter();
var authLimiter = lazyLimiter({
  windowMs: 15 * 60 * 1e3,
  max: 20,
  message: { success: false, message: "Too many auth attempts, please try again later." }
});

// src/middleware/error.ts
import { StatusCodes as StatusCodes2 } from "http-status-codes";
import { Error as MongooseError } from "mongoose";
import { ZodError } from "zod";

// src/utils/ApiError.ts
import { StatusCodes } from "http-status-codes";
var ApiError = class _ApiError extends Error {
  statusCode;
  code;
  errors;
  isOperational = true;
  constructor(statusCode, message, options) {
    super(message);
    this.statusCode = statusCode;
    this.code = options?.code;
    this.errors = options?.errors;
    Object.setPrototypeOf(this, _ApiError.prototype);
    Error.captureStackTrace?.(this, this.constructor);
  }
  static badRequest(msg = "Bad request", errors) {
    return new _ApiError(StatusCodes.BAD_REQUEST, msg, { errors });
  }
  static unauthorized(msg = "Unauthorized") {
    return new _ApiError(StatusCodes.UNAUTHORIZED, msg);
  }
  static forbidden(msg = "Forbidden") {
    return new _ApiError(StatusCodes.FORBIDDEN, msg);
  }
  static notFound(msg = "Not found") {
    return new _ApiError(StatusCodes.NOT_FOUND, msg);
  }
  static conflict(msg = "Conflict") {
    return new _ApiError(StatusCodes.CONFLICT, msg);
  }
  static tooMany(msg = "Too many requests") {
    return new _ApiError(StatusCodes.TOO_MANY_REQUESTS, msg);
  }
  static internal(msg = "Internal server error") {
    return new _ApiError(StatusCodes.INTERNAL_SERVER_ERROR, msg);
  }
};

// src/middleware/error.ts
init_logger();
init_env();
function notFound(req, _res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}
function errorHandler(err, req, res, _next) {
  applyCorsHeaders(req, res);
  let statusCode = StatusCodes2.INTERNAL_SERVER_ERROR;
  let message = "Internal server error";
  let code;
  let errors;
  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    code = err.code;
    errors = err.errors;
  } else if (err instanceof ZodError) {
    statusCode = StatusCodes2.BAD_REQUEST;
    message = "Validation failed";
    errors = err.flatten().fieldErrors;
  } else if (err instanceof MongooseError.ValidationError) {
    statusCode = StatusCodes2.BAD_REQUEST;
    message = "Validation failed";
    errors = Object.fromEntries(
      Object.entries(err.errors).map(([k, v]) => [k, [v.message]])
    );
  } else if (err instanceof MongooseError.CastError) {
    statusCode = StatusCodes2.BAD_REQUEST;
    message = `Invalid ${err.path}`;
  } else if (err?.code === 11e3) {
    statusCode = StatusCodes2.CONFLICT;
    const keyValue = err.keyValue ?? {};
    const key = Object.keys(keyValue)[0] ?? "field";
    message = `${key} already exists`;
  } else if (err instanceof Error) {
    message = err.message || message;
  }
  if (statusCode >= 500) {
    logger.error({ err }, "Unhandled error");
  } else {
    logger.warn({ msg: message, statusCode }, "Request error");
  }
  res.status(statusCode).json({
    success: false,
    message,
    code,
    errors,
    ...isProd ? {} : { stack: err instanceof Error ? err.stack : void 0 }
  });
}

// src/routes/index.ts
import { Router as Router16 } from "express";

// src/modules/auth/auth.routes.ts
import { Router } from "express";

// ../../packages/types/src/index.ts
var Role = /* @__PURE__ */ ((Role3) => {
  Role3["User"] = "user";
  Role3["Host"] = "host";
  Role3["Admin"] = "admin";
  return Role3;
})(Role || {});
var AccountStatus = /* @__PURE__ */ ((AccountStatus2) => {
  AccountStatus2["Active"] = "active";
  AccountStatus2["Suspended"] = "suspended";
  AccountStatus2["Banned"] = "banned";
  AccountStatus2["Deleted"] = "deleted";
  return AccountStatus2;
})(AccountStatus || {});
var Gender = /* @__PURE__ */ ((Gender2) => {
  Gender2["Male"] = "male";
  Gender2["Female"] = "female";
  Gender2["NonBinary"] = "non_binary";
  Gender2["Other"] = "other";
  return Gender2;
})(Gender || {});
var InterestedIn = /* @__PURE__ */ ((InterestedIn2) => {
  InterestedIn2["Men"] = "men";
  InterestedIn2["Women"] = "women";
  InterestedIn2["Everyone"] = "everyone";
  return InterestedIn2;
})(InterestedIn || {});
var VerificationStatus = /* @__PURE__ */ ((VerificationStatus2) => {
  VerificationStatus2["Pending"] = "pending";
  VerificationStatus2["Approved"] = "approved";
  VerificationStatus2["Rejected"] = "rejected";
  VerificationStatus2["NeedMoreInfo"] = "need_more_info";
  return VerificationStatus2;
})(VerificationStatus || {});
var VerificationStep = /* @__PURE__ */ ((VerificationStep2) => {
  VerificationStep2["BasicInfo"] = "basic_info";
  VerificationStep2["Documents"] = "documents";
  VerificationStep2["Identity"] = "identity";
  VerificationStep2["Submitted"] = "submitted";
  return VerificationStep2;
})(VerificationStep || {});
var LedgerDirection = /* @__PURE__ */ ((LedgerDirection2) => {
  LedgerDirection2["Credit"] = "credit";
  LedgerDirection2["Debit"] = "debit";
  return LedgerDirection2;
})(LedgerDirection || {});
var DiamondTxnReason = /* @__PURE__ */ ((DiamondTxnReason2) => {
  DiamondTxnReason2["Purchase"] = "purchase";
  DiamondTxnReason2["VideoCall"] = "video_call";
  DiamondTxnReason2["AudioCall"] = "audio_call";
  DiamondTxnReason2["LiveChat"] = "live_chat";
  DiamondTxnReason2["DirectMessage"] = "direct_message";
  DiamondTxnReason2["Gift"] = "gift";
  DiamondTxnReason2["Refund"] = "refund";
  DiamondTxnReason2["AdminAdjust"] = "admin_adjust";
  return DiamondTxnReason2;
})(DiamondTxnReason || {});
var GoldTxnReason = /* @__PURE__ */ ((GoldTxnReason2) => {
  GoldTxnReason2["VideoCall"] = "video_call";
  GoldTxnReason2["AudioCall"] = "audio_call";
  GoldTxnReason2["LiveChat"] = "live_chat";
  GoldTxnReason2["DirectMessage"] = "direct_message";
  GoldTxnReason2["Gift"] = "gift";
  GoldTxnReason2["Withdraw"] = "withdraw";
  GoldTxnReason2["AdminAdjust"] = "admin_adjust";
  return GoldTxnReason2;
})(GoldTxnReason || {});
var PaymentStatus = /* @__PURE__ */ ((PaymentStatus2) => {
  PaymentStatus2["Created"] = "created";
  PaymentStatus2["Pending"] = "pending";
  PaymentStatus2["Succeeded"] = "succeeded";
  PaymentStatus2["Failed"] = "failed";
  PaymentStatus2["Refunded"] = "refunded";
  return PaymentStatus2;
})(PaymentStatus || {});
var WithdrawStatus = /* @__PURE__ */ ((WithdrawStatus2) => {
  WithdrawStatus2["Requested"] = "requested";
  WithdrawStatus2["Approved"] = "approved";
  WithdrawStatus2["Rejected"] = "rejected";
  WithdrawStatus2["Paid"] = "paid";
  return WithdrawStatus2;
})(WithdrawStatus || {});
var CallType = /* @__PURE__ */ ((CallType2) => {
  CallType2["Audio"] = "audio";
  CallType2["Video"] = "video";
  return CallType2;
})(CallType || {});
var CallStatus = /* @__PURE__ */ ((CallStatus2) => {
  CallStatus2["Ringing"] = "ringing";
  CallStatus2["Ongoing"] = "ongoing";
  CallStatus2["Ended"] = "ended";
  CallStatus2["Missed"] = "missed";
  CallStatus2["Rejected"] = "rejected";
  CallStatus2["Failed"] = "failed";
  return CallStatus2;
})(CallStatus || {});
var LiveStatus = /* @__PURE__ */ ((LiveStatus2) => {
  LiveStatus2["Live"] = "live";
  LiveStatus2["Ended"] = "ended";
  LiveStatus2["Scheduled"] = "scheduled";
  return LiveStatus2;
})(LiveStatus || {});
var MessageType = /* @__PURE__ */ ((MessageType2) => {
  MessageType2["Text"] = "text";
  MessageType2["Image"] = "image";
  MessageType2["Video"] = "video";
  MessageType2["Voice"] = "voice";
  MessageType2["Gift"] = "gift";
  MessageType2["System"] = "system";
  return MessageType2;
})(MessageType || {});
var NotificationType = /* @__PURE__ */ ((NotificationType3) => {
  NotificationType3["Message"] = "message";
  NotificationType3["Call"] = "call";
  NotificationType3["Match"] = "match";
  NotificationType3["Like"] = "like";
  NotificationType3["Follower"] = "follower";
  NotificationType3["LiveStarted"] = "live_started";
  NotificationType3["Gift"] = "gift";
  NotificationType3["Payment"] = "payment";
  NotificationType3["Announcement"] = "announcement";
  NotificationType3["Verification"] = "verification";
  return NotificationType3;
})(NotificationType || {});
var ReportStatus = /* @__PURE__ */ ((ReportStatus2) => {
  ReportStatus2["Open"] = "open";
  ReportStatus2["Reviewing"] = "reviewing";
  ReportStatus2["Resolved"] = "resolved";
  ReportStatus2["Dismissed"] = "dismissed";
  return ReportStatus2;
})(ReportStatus || {});
var MediaType = /* @__PURE__ */ ((MediaType2) => {
  MediaType2["Image"] = "image";
  MediaType2["Video"] = "video";
  MediaType2["Audio"] = "audio";
  return MediaType2;
})(MediaType || {});
var SocketEvents = {
  Connected: "connected",
  // presence
  PresenceOnline: "presence:online",
  PresenceOffline: "presence:offline",
  // chat
  MessageSend: "message:send",
  MessageNew: "message:new",
  MessageRead: "message:read",
  MessageDelete: "message:delete",
  TypingStart: "typing:start",
  TypingStop: "typing:stop",
  // calls
  CallInvite: "call:invite",
  CallAccept: "call:accept",
  CallReject: "call:reject",
  CallEnd: "call:end",
  // live
  LiveJoin: "live:join",
  LiveLeave: "live:leave",
  LiveChat: "live:chat",
  LiveGift: "live:gift",
  LiveViewerCount: "live:viewer_count",
  // notifications
  Notification: "notification:new"
};

// src/utils/jwt.ts
init_env();
import jwt from "jsonwebtoken";
function signAccessToken(payload) {
  return jwt.sign({ ...payload, tokenType: "access" }, env.JWT_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES
  });
}
function signRefreshToken(payload) {
  return jwt.sign({ ...payload, tokenType: "refresh" }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES
  });
}
function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_SECRET);
}
function verifyRefreshToken(token) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET);
}

// src/utils/asyncHandler.ts
var asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// src/models/user.model.ts
import { Schema, model } from "mongoose";
var userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
      index: true
    },
    displayName: { type: String, required: true, trim: true, maxlength: 60 },
    password: {
      type: String,
      select: false,
      required: function requiredPassword() {
        return !this.firebaseUid;
      }
    },
    authProvider: { type: String, enum: ["local", "google"], default: "local" },
    firebaseUid: { type: String, unique: true, sparse: true, index: true },
    emailVerified: { type: Boolean, default: false },
    role: { type: String, enum: Object.values(Role), default: "user" /* User */, index: true },
    status: {
      type: String,
      enum: Object.values(AccountStatus),
      default: "active" /* Active */,
      index: true
    },
    avatarUrl: String,
    coverUrl: String,
    bio: { type: String, maxlength: 500 },
    gender: { type: String, enum: Object.values(Gender) },
    country: { type: String, trim: true, maxlength: 80, default: "India" },
    isHostApproved: { type: Boolean, default: false },
    hostSince: Date,
    tokenVersion: { type: Number, default: 0 },
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    lastLoginAt: Date,
    isOnline: { type: Boolean, default: false },
    lastSeenAt: Date,
    suspendedUntil: Date,
    bannedReason: String
  },
  { timestamps: true }
);
userSchema.index({ displayName: "text", username: "text" });
userSchema.methods.toPublic = function toPublic() {
  const u = this;
  return {
    id: u._id.toString(),
    email: u.email,
    username: u.username,
    displayName: u.displayName,
    role: u.role,
    status: u.status,
    avatarUrl: u.avatarUrl,
    coverUrl: u.coverUrl,
    bio: u.bio,
    gender: u.gender,
    country: u.country,
    isHostApproved: u.isHostApproved,
    isOnline: u.isOnline,
    authProvider: u.authProvider,
    emailVerified: u.emailVerified,
    createdAt: u.createdAt?.toISOString()
  };
};
var User = model("User", userSchema);

// src/models/profile.model.ts
import { Schema as Schema2, model as model2 } from "mongoose";
var mediaSchema = new Schema2(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    type: { type: String, enum: Object.values(MediaType), required: true },
    width: Number,
    height: Number,
    durationSec: Number
  },
  { _id: true, timestamps: { createdAt: true, updatedAt: false } }
);
var profileSchema = new Schema2(
  {
    user: { type: Schema2.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    dob: Date,
    gender: { type: String, enum: Object.values(Gender) },
    interestedIn: { type: String, enum: Object.values(InterestedIn) },
    languages: { type: [String], default: [] },
    country: String,
    city: String,
    location: {
      type: { type: String, enum: ["Point"], default: void 0 },
      coordinates: { type: [Number], default: void 0 }
    },
    locationLabel: String,
    locationUpdatedAt: Date,
    interests: { type: [String], default: [] },
    photos: { type: [mediaSchema], default: [] },
    videos: { type: [mediaSchema], default: [] },
    stories: {
      type: [
        new Schema2(
          {
            url: String,
            publicId: String,
            type: { type: String, enum: Object.values(MediaType) },
            expiresAt: Date
          },
          { timestamps: { createdAt: true, updatedAt: false } }
        )
      ],
      default: []
    },
    height: Number,
    occupation: String,
    preferences: {
      ageMin: { type: Number, default: 18 },
      ageMax: { type: Number, default: 60 },
      maxDistanceKm: { type: Number, default: 100 }
    },
    stats: {
      likesReceived: { type: Number, default: 0 },
      followers: { type: Number, default: 0 },
      following: { type: Number, default: 0 }
    }
  },
  { timestamps: true }
);
profileSchema.index({ location: "2dsphere" });
profileSchema.index({ interests: 1 });
var Profile = model2("Profile", profileSchema);

// src/models/social.model.ts
import { Schema as Schema3, model as model3 } from "mongoose";
var likeSchema = new Schema3(
  {
    from: { type: Schema3.Types.ObjectId, ref: "User", required: true, index: true },
    to: { type: Schema3.Types.ObjectId, ref: "User", required: true, index: true }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
likeSchema.index({ from: 1, to: 1 }, { unique: true });
var Like = model3("Like", likeSchema, "likes");
var matchSchema = new Schema3(
  {
    users: {
      type: [{ type: Schema3.Types.ObjectId, ref: "User" }],
      validate: (v) => v.length === 2,
      index: true
    },
    matchedAt: { type: Date, default: Date.now },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);
var Match = model3("Match", matchSchema, "matches");
var followerSchema = new Schema3(
  {
    follower: { type: Schema3.Types.ObjectId, ref: "User", required: true, index: true },
    following: { type: Schema3.Types.ObjectId, ref: "User", required: true, index: true }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
followerSchema.index({ follower: 1, following: 1 }, { unique: true });
var Follower = model3("Follower", followerSchema, "followers");

// src/models/chat.model.ts
import { Schema as Schema4, model as model4 } from "mongoose";
var conversationSchema = new Schema4(
  {
    participants: {
      type: [{ type: Schema4.Types.ObjectId, ref: "User" }],
      required: true,
      index: true
    },
    isGroup: { type: Boolean, default: false },
    lastMessage: { type: Schema4.Types.ObjectId, ref: "Message" },
    lastMessageAt: Date,
    unread: { type: Map, of: Number, default: {} }
  },
  { timestamps: true }
);
conversationSchema.index({ participants: 1, lastMessageAt: -1 });
var Conversation = model4(
  "Conversation",
  conversationSchema,
  "conversations"
);
var messageSchema = new Schema4(
  {
    conversation: {
      type: Schema4.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true
    },
    sender: { type: Schema4.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: Object.values(MessageType), default: "text" /* Text */ },
    text: { type: String, maxlength: 5e3 },
    media: {
      url: String,
      publicId: String,
      durationSec: Number,
      width: Number,
      height: Number
    },
    replyTo: { type: Schema4.Types.ObjectId, ref: "Message" },
    forwardedFrom: { type: Schema4.Types.ObjectId, ref: "Message" },
    readBy: { type: [{ type: Schema4.Types.ObjectId, ref: "User" }], default: [] },
    deletedFor: { type: [{ type: Schema4.Types.ObjectId, ref: "User" }], default: [] },
    deletedForEveryone: { type: Boolean, default: false }
  },
  { timestamps: true }
);
messageSchema.index({ conversation: 1, createdAt: -1 });
var Message = model4("Message", messageSchema, "messages");

// src/models/call.model.ts
import { Schema as Schema5, model as model5 } from "mongoose";
function callSchema(type) {
  const schema = new Schema5(
    {
      type: { type: String, enum: Object.values(CallType), default: type },
      caller: { type: Schema5.Types.ObjectId, ref: "User", required: true, index: true },
      callee: { type: Schema5.Types.ObjectId, ref: "User", required: true, index: true },
      roomName: { type: String, required: true, index: true },
      status: {
        type: String,
        enum: Object.values(CallStatus),
        default: "ringing" /* Ringing */,
        index: true
      },
      startedAt: Date,
      endedAt: Date,
      durationSec: { type: Number, default: 0 },
      diamondsSpent: { type: Number, default: 0 },
      goldEarned: { type: Number, default: 0 },
      ratePerMinute: { type: Number, default: 0 }
    },
    { timestamps: true }
  );
  schema.index({ caller: 1, createdAt: -1 });
  schema.index({ callee: 1, createdAt: -1 });
  return schema;
}
var AudioCall = model5("AudioCall", callSchema("audio" /* Audio */), "audioCalls");
var VideoCall = model5("VideoCall", callSchema("video" /* Video */), "videoCalls");

// src/models/live.model.ts
import { Schema as Schema6, model as model6 } from "mongoose";
var liveStreamSchema = new Schema6(
  {
    host: { type: Schema6.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, maxlength: 120 },
    thumbnailUrl: String,
    thumbnailPublicId: String,
    roomName: { type: String, required: true, unique: true, index: true },
    status: {
      type: String,
      enum: Object.values(LiveStatus),
      default: "live" /* Live */,
      index: true
    },
    viewerCount: { type: Number, default: 0 },
    peakViewers: { type: Number, default: 0 },
    totalLikes: { type: Number, default: 0 },
    totalGiftsGold: { type: Number, default: 0 },
    moderators: { type: [{ type: Schema6.Types.ObjectId, ref: "User" }], default: [] },
    bannedUsers: { type: [{ type: Schema6.Types.ObjectId, ref: "User" }], default: [] },
    startedAt: Date,
    endedAt: Date
  },
  { timestamps: true }
);
var LiveStream = model6("LiveStream", liveStreamSchema, "liveStreams");
var liveParticipantSchema = new Schema6(
  {
    liveStream: { type: Schema6.Types.ObjectId, ref: "LiveStream", required: true, index: true },
    user: { type: Schema6.Types.ObjectId, ref: "User", required: true, index: true },
    role: { type: String, enum: ["viewer", "moderator", "host"], default: "viewer" },
    joinedAt: { type: Date, default: Date.now },
    leftAt: Date,
    isMuted: { type: Boolean, default: false }
  },
  { timestamps: true }
);
liveParticipantSchema.index({ liveStream: 1, user: 1 });
var LiveParticipant = model6(
  "LiveParticipant",
  liveParticipantSchema,
  "liveParticipants"
);
var liveChatSchema = new Schema6(
  {
    liveStream: { type: Schema6.Types.ObjectId, ref: "LiveStream", required: true, index: true },
    user: { type: Schema6.Types.ObjectId, ref: "User", required: true },
    message: { type: String, required: true, maxlength: 500 },
    isGift: { type: Boolean, default: false }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
liveChatSchema.index({ liveStream: 1, createdAt: -1 });
var LiveChat = model6("LiveChat", liveChatSchema, "liveChats");

// src/models/wallet.model.ts
import { Schema as Schema7, model as model7 } from "mongoose";
var walletSchema = new Schema7(
  {
    user: { type: Schema7.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    diamonds: { type: Number, default: 0, min: 0 },
    gold: { type: Number, default: 0, min: 0 },
    totalDiamondsPurchased: { type: Number, default: 0 },
    totalGoldEarned: { type: Number, default: 0 },
    totalGoldWithdrawn: { type: Number, default: 0 }
  },
  { timestamps: true }
);
var Wallet = model7("Wallet", walletSchema, "wallets");
var diamondTxnSchema = new Schema7(
  {
    user: { type: Schema7.Types.ObjectId, ref: "User", required: true, index: true },
    direction: { type: String, enum: Object.values(LedgerDirection), required: true },
    amount: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    reason: { type: String, enum: Object.values(DiamondTxnReason), required: true, index: true },
    reference: { type: Schema7.Types.ObjectId, refPath: "referenceModel" },
    referenceModel: String,
    meta: Schema7.Types.Mixed
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
diamondTxnSchema.index({ user: 1, createdAt: -1 });
var DiamondTransaction = model7(
  "DiamondTransaction",
  diamondTxnSchema,
  "diamondTransactions"
);
var goldTxnSchema = new Schema7(
  {
    user: { type: Schema7.Types.ObjectId, ref: "User", required: true, index: true },
    direction: { type: String, enum: Object.values(LedgerDirection), required: true },
    amount: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    reason: { type: String, enum: Object.values(GoldTxnReason), required: true, index: true },
    fromUser: { type: Schema7.Types.ObjectId, ref: "User" },
    reference: { type: Schema7.Types.ObjectId, refPath: "referenceModel" },
    referenceModel: String,
    meta: Schema7.Types.Mixed
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
goldTxnSchema.index({ user: 1, createdAt: -1 });
var GoldTransaction = model7(
  "GoldTransaction",
  goldTxnSchema,
  "goldTransactions"
);

// src/models/payment.model.ts
import { Schema as Schema8, model as model8 } from "mongoose";
var paymentSchema = new Schema8(
  {
    user: { type: Schema8.Types.ObjectId, ref: "User", required: true, index: true },
    provider: { type: String, required: true },
    providerRef: { type: String, index: true },
    packageId: String,
    amount: { type: Number, required: true },
    currency: { type: String, default: "USD" },
    diamonds: { type: Number, required: true },
    status: {
      type: String,
      enum: Object.values(PaymentStatus),
      default: "created" /* Created */,
      index: true
    },
    failureReason: String,
    refundedAmount: Number,
    meta: Schema8.Types.Mixed
  },
  { timestamps: true }
);
paymentSchema.index({ user: 1, createdAt: -1 });
var Payment = model8("Payment", paymentSchema, "payments");
var withdrawSchema = new Schema8(
  {
    host: { type: Schema8.Types.ObjectId, ref: "User", required: true, index: true },
    goldAmount: { type: Number, required: true },
    fiatAmount: { type: Number, required: true },
    currency: { type: String, default: "USD" },
    method: { type: String, default: "bank" },
    destination: Schema8.Types.Mixed,
    status: {
      type: String,
      enum: Object.values(WithdrawStatus),
      default: "requested" /* Requested */,
      index: true
    },
    reviewedBy: { type: Schema8.Types.ObjectId, ref: "User" },
    reviewNote: String,
    processedAt: Date
  },
  { timestamps: true }
);
var WithdrawRequest = model8(
  "WithdrawRequest",
  withdrawSchema,
  "withdrawRequests"
);

// src/models/gift.model.ts
import { Schema as Schema9, model as model9 } from "mongoose";
var giftSchema = new Schema9(
  {
    name: { type: String, required: true, unique: true },
    imageUrl: { type: String, required: true },
    imagePublicId: String,
    diamondCost: { type: Number, required: true, min: 1 },
    goldValue: { type: Number, required: true, min: 0 },
    animationUrl: String,
    isActive: { type: Boolean, default: true, index: true },
    sortOrder: { type: Number, default: 0 }
  },
  { timestamps: true }
);
var Gift = model9("Gift", giftSchema, "gifts");
var subscriptionSchema = new Schema9(
  {
    user: { type: Schema9.Types.ObjectId, ref: "User", required: true, index: true },
    plan: { type: String, required: true },
    status: {
      type: String,
      enum: ["active", "cancelled", "expired"],
      default: "active",
      index: true
    },
    startedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    autoRenew: { type: Boolean, default: false },
    payment: { type: Schema9.Types.ObjectId, ref: "Payment" }
  },
  { timestamps: true }
);
var Subscription = model9("Subscription", subscriptionSchema, "subscriptions");

// src/models/notification.model.ts
import { Schema as Schema10, model as model10 } from "mongoose";
var notificationSchema = new Schema10(
  {
    user: { type: Schema10.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: Object.values(NotificationType), required: true },
    title: { type: String, required: true },
    body: String,
    actor: { type: Schema10.Types.ObjectId, ref: "User" },
    data: Schema10.Types.Mixed,
    isRead: { type: Boolean, default: false, index: true }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
notificationSchema.index({ user: 1, createdAt: -1 });
var Notification = model10(
  "Notification",
  notificationSchema,
  "notifications"
);

// src/models/report.model.ts
import { Schema as Schema11, model as model11 } from "mongoose";
var reportSchema = new Schema11(
  {
    reporter: { type: Schema11.Types.ObjectId, ref: "User", required: true, index: true },
    reportedUser: { type: Schema11.Types.ObjectId, ref: "User", required: true, index: true },
    reason: { type: String, required: true },
    description: String,
    evidence: { type: [{ url: String, publicId: String }], default: [] },
    contextType: { type: String, enum: ["profile", "message", "live", "call"] },
    contextRef: Schema11.Types.ObjectId,
    status: {
      type: String,
      enum: Object.values(ReportStatus),
      default: "open" /* Open */,
      index: true
    },
    handledBy: { type: Schema11.Types.ObjectId, ref: "User" },
    resolutionNote: String
  },
  { timestamps: true }
);
var Report = model11("Report", reportSchema, "reports");
var blockSchema = new Schema11(
  {
    blocker: { type: Schema11.Types.ObjectId, ref: "User", required: true, index: true },
    blocked: { type: Schema11.Types.ObjectId, ref: "User", required: true, index: true }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
blockSchema.index({ blocker: 1, blocked: 1 }, { unique: true });
var Block = model11("Block", blockSchema, "blocks");

// src/models/verification.model.ts
import { Schema as Schema12, model as model12 } from "mongoose";
var evidenceSchema = new Schema12(
  { url: { type: String, required: true }, publicId: { type: String, required: true }, instruction: String },
  { _id: false }
);
var verificationSchema = new Schema12(
  {
    user: { type: Schema12.Types.ObjectId, ref: "User", required: true, index: true },
    status: {
      type: String,
      enum: Object.values(VerificationStatus),
      default: "pending" /* Pending */,
      index: true
    },
    currentStep: {
      type: String,
      enum: Object.values(VerificationStep),
      default: "basic_info" /* BasicInfo */
    },
    basic: {
      name: String,
      username: String,
      bio: String,
      gender: { type: String, enum: Object.values(Gender) },
      dob: Date,
      languages: { type: [String], default: [] },
      country: String
    },
    documents: {
      governmentId: evidenceSchema,
      addressProof: evidenceSchema
    },
    selfies: { type: [evidenceSchema], default: [] },
    verificationVideo: evidenceSchema,
    instructionsUsed: { type: [{ type: Schema12.Types.ObjectId, ref: "AdminInstruction" }], default: [] },
    reviewedBy: { type: Schema12.Types.ObjectId, ref: "User" },
    reviewNote: String,
    reviewedAt: Date
  },
  { timestamps: true }
);
var VerificationRequest = model12(
  "VerificationRequest",
  verificationSchema,
  "verificationRequests"
);
var adminInstructionSchema = new Schema12(
  {
    text: { type: String, required: true },
    category: { type: String, enum: ["selfie", "video", "general"], default: "general" },
    isActive: { type: Boolean, default: true, index: true },
    sortOrder: { type: Number, default: 0 },
    createdBy: { type: Schema12.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);
var AdminInstruction = model12(
  "AdminInstruction",
  adminInstructionSchema,
  "adminInstructions"
);

// src/models/settings.model.ts
import { Schema as Schema13, model as model13 } from "mongoose";
var settingsSchema = new Schema13(
  {
    key: { type: String, default: "global", unique: true, index: true },
    goldConversionRatio: { type: Number, default: 0.5 },
    rates: {
      audioCallPerMinute: { type: Number, default: 10 },
      videoCallPerMinute: { type: Number, default: 20 },
      liveChatPerMessage: { type: Number, default: 1 },
      chatPerMessage: { type: Number, default: 1 }
    },
    diamondPackages: {
      type: [
        new Schema13(
          {
            id: String,
            label: String,
            diamonds: Number,
            bonus: { type: Number, default: 0 },
            price: Number,
            currency: { type: String, default: "USD" },
            priceUsd: Number,
            priceInr: Number,
            isActive: { type: Boolean, default: true }
          },
          { _id: false }
        )
      ],
      default: []
    },
    withdraw: {
      goldToFiatRate: { type: Number, default: 0.01 },
      minGold: { type: Number, default: 1e3 },
      currency: { type: String, default: "USD" }
    },
    features: {
      liveEnabled: { type: Boolean, default: true },
      callsEnabled: { type: Boolean, default: true },
      giftsEnabled: { type: Boolean, default: true }
    },
    announcements: {
      type: [{ title: String, body: String, active: { type: Boolean, default: true } }],
      default: []
    },
    landing: {
      membersLabel: { type: String, default: "120k+" },
      verifiedHostsLabel: { type: String, default: "8k+" },
      liveRoomsLabel: { type: String, default: "24/7" }
    }
  },
  { timestamps: true }
);
var Settings = model13("Settings", settingsSchema, "settings");

// src/models/contact.model.ts
import { Schema as Schema14, model as model14 } from "mongoose";
var ContactStatus = /* @__PURE__ */ ((ContactStatus2) => {
  ContactStatus2["Open"] = "open";
  ContactStatus2["InProgress"] = "in_progress";
  ContactStatus2["Resolved"] = "resolved";
  return ContactStatus2;
})(ContactStatus || {});
var contactSchema = new Schema14(
  {
    user: { type: Schema14.Types.ObjectId, ref: "User", required: true, index: true },
    subject: { type: String, required: true, maxlength: 120 },
    category: { type: String, required: true, maxlength: 60 },
    message: { type: String, required: true, maxlength: 3e3 },
    status: {
      type: String,
      enum: Object.values(ContactStatus),
      default: "open" /* Open */,
      index: true
    },
    adminNote: String,
    adminReply: String
  },
  { timestamps: true }
);
contactSchema.index({ createdAt: -1 });
var ContactInquiry = model14(
  "ContactInquiry",
  contactSchema,
  "contactInquiries"
);

// src/middleware/auth.ts
function extractToken(req) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7);
  if (req.cookies?.accessToken) return req.cookies.accessToken;
  return null;
}
var authenticate = asyncHandler(
  async (req, _res, next) => {
    const token = extractToken(req);
    if (!token) throw ApiError.unauthorized("Authentication required");
    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw ApiError.unauthorized("Invalid or expired token");
    }
    if (payload.tokenType !== "access") throw ApiError.unauthorized("Invalid token type");
    const user = await User.findById(payload.sub).select("role status tokenVersion");
    if (!user) throw ApiError.unauthorized("Account not found");
    if (user.tokenVersion !== payload.tokenVersion) {
      throw ApiError.unauthorized("Session expired, please log in again");
    }
    if (user.status === "banned" /* Banned */) throw ApiError.forbidden("Account banned");
    if (user.status === "suspended" /* Suspended */ && (!user.suspendedUntil || user.suspendedUntil > /* @__PURE__ */ new Date())) {
      throw ApiError.forbidden("Account suspended");
    }
    req.user = { id: user._id.toString(), role: user.role, tokenVersion: user.tokenVersion };
    next();
  }
);
var optionalAuth = asyncHandler(
  async (req, _res, next) => {
    const token = extractToken(req);
    if (!token) return next();
    try {
      const payload = verifyAccessToken(token);
      req.user = { id: payload.sub, role: payload.role, tokenVersion: payload.tokenVersion ?? 0 };
    } catch {
    }
    next();
  }
);
var authorize = (...roles) => (req, _res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  if (!roles.includes(req.user.role)) return next(ApiError.forbidden("Insufficient permissions"));
  next();
};
var requireApprovedHost = asyncHandler(
  async (req, _res, next) => {
    if (!req.user) throw ApiError.unauthorized();
    const user = await User.findById(req.user.id).select("role isHostApproved");
    if (!user || user.role !== "host" /* Host */ || !user.isHostApproved) {
      throw ApiError.forbidden("Approved host access required");
    }
    next();
  }
);

// src/middleware/validate.ts
var validate = (schemas) => (req, _res, next) => {
  try {
    if (schemas.body) req.body = schemas.body.parse(req.body);
    if (schemas.query) Object.assign(req.query, schemas.query.parse(req.query));
    if (schemas.params) Object.assign(req.params, schemas.params.parse(req.params));
    next();
  } catch (err) {
    next(err);
  }
};

// ../../packages/utils/src/countries.ts
var DEFAULT_COUNTRY = "India";

// ../../packages/utils/src/index.ts
var clamp = (value, min, max) => Math.min(Math.max(value, min), max);
var buildPaginated = (items, page, limit, total) => {
  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
  return {
    items,
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1
  };
};
var parsePagination = (query, { defaultLimit = 20, maxLimit = 100 } = {}) => {
  const page = Math.max(1, Number.parseInt(String(query.page ?? "1"), 10) || 1);
  const limit = clamp(
    Number.parseInt(String(query.limit ?? defaultLimit), 10) || defaultLimit,
    1,
    maxLimit
  );
  return { page, limit, skip: (page - 1) * limit };
};
var diamondsToGold = (diamonds, ratio) => Math.floor(diamonds * ratio);
var getCurrencyForCountry = (country) => country?.trim() === "India" ? "INR" : "USD";
var getPackagePriceForCountry = (pkg, country) => {
  const currency = getCurrencyForCountry(country);
  if (currency === "INR") {
    return { amount: pkg.priceInr ?? pkg.price ?? 0, currency: "INR" };
  }
  return { amount: pkg.priceUsd ?? pkg.price ?? 0, currency: "USD" };
};
var haversineKm = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};
var DEFAULT_DISCOVERY_RADIUS_KM = 20;
var directRoomName = (userIdA, userIdB) => ["call", ...[userIdA, userIdB].sort()].join("_");

// src/utils/response.ts
import { StatusCodes as StatusCodes3 } from "http-status-codes";
function ok(res, data, message, status = StatusCodes3.OK) {
  return res.status(status).json({ success: true, data, message });
}
function created(res, data, message = "Created") {
  return ok(res, data, message, StatusCodes3.CREATED);
}

// src/utils/password.ts
import bcrypt from "bcryptjs";
import crypto from "crypto";
var SALT_ROUNDS = 12;
var hashPassword = (plain) => bcrypt.hash(plain, SALT_ROUNDS);
var comparePassword = (plain, hash) => bcrypt.compare(plain, hash);
function createResetToken() {
  const raw = crypto.randomBytes(32).toString("hex");
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  const expires = new Date(Date.now() + 30 * 60 * 1e3);
  return { raw, hash, expires };
}
var hashToken = (raw) => crypto.createHash("sha256").update(raw).digest("hex");

// src/utils/cookies.ts
init_env();
var REFRESH_COOKIE = "refreshToken";
var THIRTY_DAYS = 30 * 24 * 60 * 60 * 1e3;
function setRefreshCookie(res, token) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    maxAge: THIRTY_DAYS,
    path: "/"
  });
}
function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE, {
    path: "/",
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax"
  });
}

// src/services/settings.service.ts
async function getSettings() {
  let settings = await Settings.findOne({ key: "global" });
  if (!settings) {
    settings = await Settings.create({
      key: "global",
      diamondPackages: [
        { id: "starter", label: "Starter", diamonds: 100, bonus: 0, price: 0.99, priceUsd: 0.99, priceInr: 79, currency: "USD", isActive: true },
        { id: "popular", label: "Popular", diamonds: 550, bonus: 50, price: 4.99, priceUsd: 4.99, priceInr: 399, currency: "USD", isActive: true },
        { id: "pro", label: "Pro", diamonds: 1200, bonus: 200, price: 9.99, priceUsd: 9.99, priceInr: 799, currency: "USD", isActive: true },
        { id: "whale", label: "Elite", diamonds: 6500, bonus: 1500, price: 49.99, priceUsd: 49.99, priceInr: 3999, currency: "USD", isActive: true }
      ],
      landing: {
        membersLabel: "120k+",
        verifiedHostsLabel: "8k+",
        liveRoomsLabel: "24/7"
      }
    });
  }
  return settings;
}

// src/services/wallet.service.ts
async function ensureWallet(userId) {
  return Wallet.findOneAndUpdate(
    { user: userId },
    { $setOnInsert: { user: userId } },
    { upsert: true, new: true }
  );
}
async function creditDiamonds(params) {
  const { userId, amount, reason, reference, referenceModel, meta, session } = params;
  if (amount <= 0) throw ApiError.badRequest("Amount must be positive");
  const wallet = await Wallet.findOneAndUpdate(
    { user: userId },
    {
      $inc: {
        diamonds: amount,
        ...reason === "purchase" /* Purchase */ ? { totalDiamondsPurchased: amount } : {}
      },
      $setOnInsert: { user: userId }
    },
    { upsert: true, new: true, session }
  );
  await DiamondTransaction.create(
    [
      {
        user: userId,
        direction: "credit" /* Credit */,
        amount,
        balanceAfter: wallet.diamonds,
        reason,
        reference,
        referenceModel,
        meta
      }
    ],
    { session }
  );
  return wallet;
}
async function spendDiamonds(params) {
  const { userId, hostId, amount, diamondReason, goldReason, reference, referenceModel, meta } = params;
  if (amount <= 0) throw ApiError.badRequest("Amount must be positive");
  const settings = await getSettings();
  const goldEarned = hostId ? diamondsToGold(amount, settings.goldConversionRatio) : 0;
  const wallet = await Wallet.findOneAndUpdate(
    { user: userId, diamonds: { $gte: amount } },
    { $inc: { diamonds: -amount } },
    { new: true }
  );
  if (!wallet) throw ApiError.badRequest("Insufficient diamond balance", { balance: ["too_low"] });
  await DiamondTransaction.create({
    user: userId,
    direction: "debit" /* Debit */,
    amount,
    balanceAfter: wallet.diamonds,
    reason: diamondReason,
    reference,
    referenceModel,
    meta
  });
  if (hostId && goldEarned > 0) {
    const hostWallet = await Wallet.findOneAndUpdate(
      { user: hostId },
      { $inc: { gold: goldEarned, totalGoldEarned: goldEarned }, $setOnInsert: { user: hostId } },
      { upsert: true, new: true }
    );
    await GoldTransaction.create({
      user: hostId,
      direction: "credit" /* Credit */,
      amount: goldEarned,
      balanceAfter: hostWallet.gold,
      reason: goldReason ?? "gift" /* Gift */,
      fromUser: userId,
      reference,
      referenceModel,
      meta
    });
  }
  return { diamondsLeft: wallet.diamonds, goldEarned };
}
async function debitGold(params) {
  const { hostId, amount, reason, reference, referenceModel } = params;
  const wallet = await Wallet.findOneAndUpdate(
    { user: hostId, gold: { $gte: amount } },
    { $inc: { gold: -amount, totalGoldWithdrawn: amount } },
    { new: true }
  );
  if (!wallet) throw ApiError.badRequest("Insufficient gold balance");
  await GoldTransaction.create({
    user: hostId,
    direction: "debit" /* Debit */,
    amount,
    balanceAfter: wallet.gold,
    reason,
    reference,
    referenceModel
  });
  return wallet;
}

// src/utils/mailer.ts
init_env();
init_logger();
import nodemailer from "nodemailer";
var transporter = null;
function getTransport() {
  if (!env.SMTP_HOST) return null;
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT ?? 587,
    secure: (env.SMTP_PORT ?? 587) === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : void 0
  });
  return transporter;
}
async function sendMail(opts) {
  const transport = getTransport();
  if (!transport) {
    logger.info({ to: opts.to, subject: opts.subject }, "\u{1F4E7} [DEV] Email (SMTP not configured)");
    logger.debug({ html: opts.html }, "Email body");
    return;
  }
  await transport.sendMail({ from: env.MAIL_FROM, ...opts });
}
function passwordResetEmail(name, resetUrl) {
  return {
    subject: "Reset your Kushlov password",
    html: `<div style="font-family:sans-serif">
      <h2>Hi ${name},</h2>
      <p>We received a request to reset your password. This link expires in 30 minutes.</p>
      <p><a href="${resetUrl}" style="background:#e11d74;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Reset password</a></p>
      <p>If you didn't request this, you can safely ignore this email.</p>
    </div>`,
    text: `Reset your password: ${resetUrl}`
  };
}

// src/modules/auth/auth.controller.ts
init_env();

// src/config/firebase.ts
init_env();
import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
function getFirebaseAuth() {
  if (!env.FIREBASE_PROJECT_ID || !env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) {
    throw new Error("Firebase Admin is not configured");
  }
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
      })
    });
  }
  return getAuth(getApp());
}
function isFirebaseConfigured() {
  return Boolean(env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY);
}

// src/services/username.service.ts
async function generateUniqueUsername(source) {
  const base = source.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20) || "user";
  let candidate = base;
  let suffix = 0;
  while (await User.exists({ username: candidate })) {
    suffix += 1;
    candidate = `${base}${suffix}`.slice(0, 30);
  }
  return candidate;
}

// src/modules/auth/auth.controller.ts
function issueTokens(user) {
  const payload = { sub: user.id, role: user.role, tokenVersion: user.tokenVersion };
  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload)
  };
}
var register = asyncHandler(async (req, res) => {
  const { email, username, displayName, password: password2, accountType = "user", country } = req.body;
  const exists = await User.findOne({ $or: [{ email }, { username }] });
  if (exists) throw ApiError.conflict("Email or username already in use");
  const isHostSignup = accountType === "host";
  const user = await User.create({
    email,
    username,
    displayName,
    password: await hashPassword(password2),
    authProvider: "local",
    role: isHostSignup ? "host" /* Host */ : "user" /* User */,
    isHostApproved: false,
    country
  });
  await Profile.findOneAndUpdate(
    { user: user._id },
    { $set: { country, user: user._id } },
    { upsert: true }
  );
  await ensureWallet(user._id);
  const tokens = issueTokens({ id: user._id.toString(), role: user.role, tokenVersion: user.tokenVersion });
  setRefreshCookie(res, tokens.refreshToken);
  return created(
    res,
    { user: user.toPublic(), ...tokens, accountType },
    isHostSignup ? "Host account created. Complete verification to go live." : "Registered successfully"
  );
});
var login = asyncHandler(async (req, res) => {
  const { email, password: password2 } = req.body;
  const user = await User.findOne({ email }).select("+password");
  if (!user || !user.password || !await comparePassword(password2, user.password)) {
    if (user && !user.password) {
      throw ApiError.unauthorized("This account uses Google sign-in. Please continue with Google.");
    }
    throw ApiError.unauthorized("Invalid credentials");
  }
  user.lastLoginAt = /* @__PURE__ */ new Date();
  await user.save();
  const tokens = issueTokens({ id: user._id.toString(), role: user.role, tokenVersion: user.tokenVersion });
  setRefreshCookie(res, tokens.refreshToken);
  return ok(res, { user: user.toPublic(), ...tokens }, "Logged in");
});
var googleLogin = asyncHandler(async (req, res) => {
  if (!isFirebaseConfigured()) {
    throw ApiError.internal("Google sign-in is not configured on the server");
  }
  const { idToken, country } = req.body;
  let decoded;
  try {
    decoded = await getFirebaseAuth().verifyIdToken(idToken, true);
  } catch {
    throw ApiError.unauthorized("Invalid or expired Google token");
  }
  const uid = decoded.uid;
  const email = decoded.email?.toLowerCase();
  const name = decoded.name?.trim();
  const picture = decoded.picture;
  const emailVerified = decoded.email_verified ?? false;
  if (!email) throw ApiError.badRequest("Google account has no email address");
  let user = await User.findOne({ $or: [{ firebaseUid: uid }, { email }] });
  if (user) {
    if (user.status === "banned" /* Banned */) throw ApiError.forbidden("Account banned");
    if (user.status === "suspended" /* Suspended */ && (!user.suspendedUntil || user.suspendedUntil > /* @__PURE__ */ new Date())) {
      throw ApiError.forbidden("Account suspended");
    }
    if (!user.firebaseUid) user.firebaseUid = uid;
    if (user.authProvider === "local" && !user.password) user.authProvider = "google";
    if (picture && !user.avatarUrl) user.avatarUrl = picture;
    if (name && user.displayName === user.username) user.displayName = name;
    user.emailVerified = emailVerified || user.emailVerified;
    user.lastLoginAt = /* @__PURE__ */ new Date();
    await user.save();
  } else {
    const username = await generateUniqueUsername(email.split("@")[0] || name || "user");
    user = await User.create({
      email,
      username,
      displayName: name || username,
      avatarUrl: picture,
      firebaseUid: uid,
      authProvider: "google",
      emailVerified,
      role: "user" /* User */,
      country: country || DEFAULT_COUNTRY
    });
    await Profile.findOneAndUpdate(
      { user: user._id },
      { $set: { country: country || DEFAULT_COUNTRY, user: user._id } },
      { upsert: true }
    );
    await ensureWallet(user._id);
  }
  const tokens = issueTokens({
    id: user._id.toString(),
    role: user.role,
    tokenVersion: user.tokenVersion
  });
  setRefreshCookie(res, tokens.refreshToken);
  const payload = {
    user: user.toPublic(),
    ...tokens,
    token: tokens.accessToken
  };
  return ok(res, payload, "Logged in with Google");
});
var refresh = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken ?? req.body?.refreshToken;
  if (!token) throw ApiError.unauthorized("No refresh token");
  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw ApiError.unauthorized("Invalid refresh token");
  }
  const user = await User.findById(payload.sub).select("role tokenVersion");
  if (!user || user.tokenVersion !== payload.tokenVersion) {
    throw ApiError.unauthorized("Session expired");
  }
  const tokens = issueTokens({ id: user._id.toString(), role: user.role, tokenVersion: user.tokenVersion });
  setRefreshCookie(res, tokens.refreshToken);
  return ok(res, tokens, "Token refreshed");
});
var logout = asyncHandler(async (_req, res) => {
  clearRefreshCookie(res);
  return ok(res, null, "Logged out");
});
var me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw ApiError.notFound("User not found");
  return ok(res, user.toPublic());
});
var forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (user) {
    const { raw, hash, expires } = createResetToken();
    user.passwordResetToken = hash;
    user.passwordResetExpires = expires;
    await user.save();
    const resetUrl = `${env.CLIENT_URL}/reset-password?token=${raw}`;
    const mail = passwordResetEmail(user.displayName, resetUrl);
    await sendMail({ to: user.email, ...mail });
  }
  return ok(res, null, "If that email exists, a reset link has been sent");
});
var resetPassword = asyncHandler(async (req, res) => {
  const { token, password: password2 } = req.body;
  const user = await User.findOne({
    passwordResetToken: hashToken(token),
    passwordResetExpires: { $gt: /* @__PURE__ */ new Date() }
  }).select("+passwordResetToken +passwordResetExpires");
  if (!user) throw ApiError.badRequest("Invalid or expired reset token");
  user.password = await hashPassword(password2);
  user.passwordResetToken = void 0;
  user.passwordResetExpires = void 0;
  user.tokenVersion += 1;
  await user.save();
  clearRefreshCookie(res);
  return ok(res, null, "Password reset successful, please log in");
});

// src/modules/auth/auth.validation.ts
import { z as z2 } from "zod";
var password = z2.string().min(8, "Password must be at least 8 characters").max(128).regex(/[a-z]/, "Must contain a lowercase letter").regex(/[A-Z]/, "Must contain an uppercase letter").regex(/[0-9]/, "Must contain a number");
var registerSchema = z2.object({
  email: z2.string().email(),
  username: z2.string().min(3).max(30).regex(/^[a-z0-9_]+$/i, "Only letters, numbers and underscores"),
  displayName: z2.string().min(2).max(60),
  password,
  accountType: z2.enum(["user", "host"]).default("user"),
  country: z2.string().min(2, "Select your country").max(80)
});
var loginSchema = z2.object({
  email: z2.string().email(),
  password: z2.string().min(1)
});
var forgotSchema = z2.object({ email: z2.string().email() });
var resetSchema = z2.object({
  token: z2.string().min(10),
  password
});
var googleSchema = z2.object({
  idToken: z2.string().min(10),
  country: z2.string().min(2).max(80).optional()
});

// src/modules/auth/auth.routes.ts
var router = Router();
router.post("/register", authLimiter, validate({ body: registerSchema }), register);
router.post("/login", authLimiter, validate({ body: loginSchema }), login);
router.post("/google", authLimiter, validate({ body: googleSchema }), googleLogin);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.get("/me", authenticate, me);
router.post("/forgot-password", authLimiter, validate({ body: forgotSchema }), forgotPassword);
router.post("/reset-password", authLimiter, validate({ body: resetSchema }), resetPassword);
var auth_routes_default = router;

// src/modules/users/users.routes.ts
import { Router as Router2 } from "express";

// src/middleware/upload.ts
import multer from "multer";
var storage = multer.memoryStorage();
var IMAGE = ["image/jpeg", "image/png", "image/webp", "image/gif"];
var VIDEO = ["video/mp4", "video/webm", "video/quicktime"];
var AUDIO = ["audio/webm", "audio/mpeg", "audio/mp4", "audio/ogg", "audio/wav"];
var DOC = ["application/pdf", ...IMAGE];
function fileFilter(allowed) {
  return (_req, file, cb) => {
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(ApiError.badRequest(`Unsupported file type: ${file.mimetype}`));
  };
}
var uploadImage = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: fileFilter(IMAGE)
});
var uploadMedia = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: fileFilter([...IMAGE, ...VIDEO, ...AUDIO])
});
var uploadDocument = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: fileFilter(DOC)
});

// src/config/cloudinary.ts
init_env();
init_logger();
import { v2 as cloudinary } from "cloudinary";
if (hasCloudinary) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true
  });
  logger.info("\u2601\uFE0F  Cloudinary configured");
} else {
  logger.warn("Cloudinary not configured \u2014 uploads will use a local dev fallback");
}

// src/services/media.service.ts
init_env();
init_logger();
function mapType(resource, format) {
  if (resource === "video") {
    const audioFormats = ["mp3", "wav", "ogg", "m4a", "webm"];
    if (format && audioFormats.includes(format)) return "audio" /* Audio */;
    return "video" /* Video */;
  }
  return "image" /* Image */;
}
async function uploadBuffer(file, folder, options = {}) {
  if (!hasCloudinary) {
    logger.warn("Cloudinary not configured \u2014 returning data URL fallback (dev only)");
    const dataUrl = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
    return {
      url: dataUrl,
      publicId: `dev/${folder}/${Date.now()}`,
      type: file.mimetype.startsWith("video") ? "video" /* Video */ : file.mimetype.startsWith("audio") ? "audio" /* Audio */ : "image" /* Image */,
      bytes: file.size
    };
  }
  const result = await new Promise((resolve2, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `kushlov/${folder}`,
        resource_type: "auto",
        ...options
      },
      (error, res) => {
        if (error || !res) return reject(ApiError.internal(error?.message ?? "Upload failed"));
        resolve2(res);
      }
    );
    stream.end(file.buffer);
  });
  return {
    url: result.secure_url,
    publicId: result.public_id,
    type: mapType(result.resource_type, result.format),
    width: result.width,
    height: result.height,
    durationSec: result.duration,
    bytes: result.bytes,
    format: result.format
  };
}
async function deleteMedia(publicId, resourceType = "image") {
  if (!hasCloudinary || publicId.startsWith("dev/")) return;
  await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
}

// src/services/location.service.ts
var EXCLUSION_RADIUS_KM = Number(
  process.env.DISCOVERY_RADIUS_KM ?? DEFAULT_DISCOVERY_RADIUS_KM
);
var EXCLUSION_RADIUS_METERS = EXCLUSION_RADIUS_KM * 1e3;
async function requireUserCoordinates(userId) {
  const profile = await Profile.findOne({ user: userId }).select("location");
  if (!profile?.location?.coordinates?.length) {
    throw ApiError.badRequest(
      "Please set your location using the map to discover users outside your local area."
    );
  }
  return profile.location.coordinates;
}
async function getDiscoverableUserIds(userId, excludeIds = []) {
  const [lng, lat] = await requireUserCoordinates(userId);
  const exclude = /* @__PURE__ */ new Set([userId, ...excludeIds.map(String)]);
  const radiusRadians = EXCLUSION_RADIUS_KM / 6378.1;
  const profiles = await Profile.find({
    user: { $nin: [...exclude] },
    "location.coordinates": { $exists: true, $ne: null },
    location: {
      $not: {
        $geoWithin: {
          $centerSphere: [[lng, lat], radiusRadians]
        }
      }
    }
  }).select("user");
  return profiles.map((p) => p.user);
}
async function distanceBetweenUsers(userA, userB) {
  const [a, b] = await Promise.all([
    Profile.findOne({ user: userA }).select("location"),
    Profile.findOne({ user: userB }).select("location")
  ]);
  if (!a?.location?.coordinates || !b?.location?.coordinates) return null;
  const [lng1, lat1] = a.location.coordinates;
  const [lng2, lat2] = b.location.coordinates;
  return haversineKm(lat1, lng1, lat2, lng2);
}
async function assertUsersCanConnect(userId, targetUserId) {
  if (userId === targetUserId) return;
  const actor = await User.findById(userId).select("role");
  if (actor?.role === "admin" /* Admin */) return;
  const [lng1, lat1] = await requireUserCoordinates(userId);
  const targetProfile = await Profile.findOne({ user: targetUserId }).select("location");
  if (!targetProfile?.location?.coordinates) {
    throw ApiError.forbidden("This user has not shared their location yet.");
  }
  const [lng2, lat2] = targetProfile.location.coordinates;
  const km = haversineKm(lat1, lng1, lat2, lng2);
  if (km <= EXCLUSION_RADIUS_KM) {
    throw ApiError.forbidden(
      `Users within ${EXCLUSION_RADIUS_KM} km cannot see or connect with each other. This user is only ${km.toFixed(1)} km away.`
    );
  }
}

// src/services/interaction.service.ts
import { Types as Types14 } from "mongoose";
function matchesQuery(user, q) {
  const needle = q.toLowerCase();
  return user.displayName?.toLowerCase().includes(needle) || user.username?.toLowerCase().includes(needle) || false;
}
function toOtherUser(u) {
  return {
    id: u._id?.toString() ?? u.id,
    displayName: u.displayName,
    username: u.username,
    avatarUrl: u.avatarUrl,
    role: u.role,
    isHostApproved: u.isHostApproved
  };
}
async function getUserInteractionHistory(userId, role, options = {}) {
  const searchRole = role === "host" /* Host */ ? "user" /* User */ : "host" /* Host */;
  const limit = options.limit ?? 80;
  const q = options.q?.trim().toLowerCase();
  const uid = new Types14.ObjectId(userId);
  const items = [];
  const conversations = await Conversation.find({ participants: uid }).sort({ lastMessageAt: -1, updatedAt: -1 }).limit(limit).populate("participants", "displayName username avatarUrl role isHostApproved").populate("lastMessage");
  for (const conv of conversations) {
    const other = conv.participants.find((p) => p._id.toString() !== userId);
    if (!other || other.role !== searchRole) continue;
    if (q && !matchesQuery(other, q)) continue;
    items.push({
      id: conv._id.toString(),
      kind: "message_chat",
      at: (conv.lastMessageAt ?? conv.updatedAt).toISOString(),
      summary: conv.lastMessage?.text?.slice(0, 120) || "Direct message chat",
      otherUser: toOtherUser(other)
    });
  }
  const callFilter = { $or: [{ caller: uid }, { callee: uid }] };
  const [audioCalls, videoCalls] = await Promise.all([
    AudioCall.find(callFilter).sort({ createdAt: -1 }).limit(limit).populate("caller", "displayName username avatarUrl role isHostApproved").populate("callee", "displayName username avatarUrl role isHostApproved"),
    VideoCall.find(callFilter).sort({ createdAt: -1 }).limit(limit).populate("caller", "displayName username avatarUrl role isHostApproved").populate("callee", "displayName username avatarUrl role isHostApproved")
  ]);
  for (const call of audioCalls) {
    const other = call.caller._id.toString() === userId ? call.callee : call.caller;
    if (!other || other.role !== searchRole) continue;
    if (q && !matchesQuery(other, q)) continue;
    items.push({
      id: call._id.toString(),
      kind: "audio_call",
      at: (call.startedAt ?? call.createdAt).toISOString(),
      summary: `Audio call \xB7 ${call.status}${call.durationSec ? ` \xB7 ${call.durationSec}s` : ""}`,
      otherUser: toOtherUser(other)
    });
  }
  for (const call of videoCalls) {
    const other = call.caller._id.toString() === userId ? call.callee : call.caller;
    if (!other || other.role !== searchRole) continue;
    if (q && !matchesQuery(other, q)) continue;
    items.push({
      id: call._id.toString(),
      kind: "video_call",
      at: (call.startedAt ?? call.createdAt).toISOString(),
      summary: `Video call \xB7 ${call.status}${call.durationSec ? ` \xB7 ${call.durationSec}s` : ""}`,
      otherUser: toOtherUser(other)
    });
  }
  const liveChats = await LiveChat.find({ user: uid }).sort({ createdAt: -1 }).limit(limit).lean();
  if (liveChats.length) {
    const streamIds = [...new Set(liveChats.map((c) => c.liveStream.toString()))];
    const streams = await LiveStream.find({ _id: { $in: streamIds } }).populate("host", "displayName username avatarUrl role isHostApproved").lean();
    const streamMap = new Map(streams.map((s) => [s._id.toString(), s]));
    for (const chat of liveChats) {
      const stream = streamMap.get(chat.liveStream.toString());
      const host = stream?.host;
      if (!host || host.role !== searchRole) continue;
      if (q && !matchesQuery(host, q)) continue;
      items.push({
        id: chat._id.toString(),
        kind: "live_chat",
        at: chat.createdAt.toISOString(),
        summary: `Live chat: ${chat.message.slice(0, 100)}`,
        otherUser: toOtherUser(host)
      });
    }
  }
  items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return { items: items.slice(0, limit), searchRole };
}

// src/modules/users/users.controller.ts
var searchContacts = asyncHandler(async (req, res) => {
  const me2 = await User.findById(req.user.id).select("role");
  if (!me2) throw ApiError.notFound("User not found");
  const q = req.query.q?.trim();
  if (!q || q.length < 2) return ok(res, { items: [] });
  const oppositeRole = me2.role === "host" /* Host */ ? "user" /* User */ : "host" /* Host */;
  const filter = {
    role: oppositeRole,
    status: "active",
    _id: { $ne: me2._id },
    $or: [{ displayName: new RegExp(q, "i") }, { username: new RegExp(q, "i") }]
  };
  if (oppositeRole === "host" /* Host */) filter.isHostApproved = true;
  const users = await User.find(filter).sort({ isOnline: -1, displayName: 1 }).limit(20);
  return ok(res, { items: users.map((u) => u.toPublic()) });
});
var getMyInteractions = asyncHandler(async (req, res) => {
  const me2 = await User.findById(req.user.id).select("role");
  if (!me2) throw ApiError.notFound("User not found");
  const { q, limit } = req.query;
  const result = await getUserInteractionHistory(me2._id.toString(), me2.role, {
    q,
    limit: limit ? Number(limit) : void 0
  });
  return ok(res, result);
});
var getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound("User not found");
  try {
    await assertUsersCanConnect(req.user.id, req.params.id);
  } catch (err) {
    if (err instanceof ApiError && err.statusCode === 403) throw err;
    throw ApiError.forbidden("This profile is within your local exclusion zone.");
  }
  const profile = await Profile.findOne({ user: user._id });
  const distanceKm = await distanceBetweenUsers(req.user.id, req.params.id);
  return ok(res, {
    user: user.toPublic(),
    profile,
    distanceKm: distanceKm != null ? Math.round(distanceKm * 10) / 10 : null
  });
});
var getMyLocation = asyncHandler(async (req, res) => {
  const profile = await Profile.findOne({ user: req.user.id }).select(
    "location locationLabel city country locationUpdatedAt"
  );
  const coords = profile?.location?.coordinates;
  return ok(res, {
    hasLocation: Boolean(coords),
    lat: coords?.[1] ?? null,
    lng: coords?.[0] ?? null,
    locationLabel: profile?.locationLabel,
    city: profile?.city,
    country: profile?.country,
    locationUpdatedAt: profile?.locationUpdatedAt,
    discoveryRadiusKm: EXCLUSION_RADIUS_KM,
    exclusionRadiusKm: EXCLUSION_RADIUS_KM
  });
});
var updateMyLocation = asyncHandler(async (req, res) => {
  const { lat, lng, city, country, locationLabel } = req.body;
  const profile = await Profile.findOneAndUpdate(
    { user: req.user.id },
    {
      $set: {
        location: { type: "Point", coordinates: [Number(lng), Number(lat)] },
        locationLabel,
        city,
        country,
        locationUpdatedAt: /* @__PURE__ */ new Date()
      }
    },
    { upsert: true, new: true }
  );
  return ok(res, profile, "Location updated");
});
var updateMe = asyncHandler(async (req, res) => {
  const { displayName, bio, gender, country } = req.body;
  const update = {};
  if (displayName !== void 0) update.displayName = displayName;
  if (bio !== void 0) update.bio = bio;
  if (gender !== void 0) update.gender = gender;
  if (country !== void 0) update.country = country;
  const user = await User.findByIdAndUpdate(
    req.user.id,
    { $set: update },
    { new: true, runValidators: true }
  );
  if (country !== void 0) {
    await Profile.findOneAndUpdate(
      { user: req.user.id },
      { $set: { country } },
      { upsert: true }
    );
  }
  return ok(res, user?.toPublic(), "Profile updated");
});
var getMyProfile = asyncHandler(async (req, res) => {
  const profile = await Profile.findOneAndUpdate(
    { user: req.user.id },
    { $setOnInsert: { user: req.user.id } },
    { upsert: true, new: true }
  );
  return ok(res, profile);
});
var updateMyProfile = asyncHandler(async (req, res) => {
  const allowed = [
    "dob",
    "gender",
    "interestedIn",
    "languages",
    "country",
    "city",
    "interests",
    "height",
    "occupation",
    "preferences"
  ];
  const update = {};
  for (const key of allowed) if (key in req.body) update[key] = req.body[key];
  if (req.body.lng != null && req.body.lat != null) {
    update.location = { type: "Point", coordinates: [Number(req.body.lng), Number(req.body.lat)] };
  }
  const profile = await Profile.findOneAndUpdate(
    { user: req.user.id },
    { $set: update },
    { upsert: true, new: true, runValidators: true }
  );
  return ok(res, profile, "Profile updated");
});
var uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest("No file provided");
  const media = await uploadBuffer(req.file, `avatars/${req.user.id}`);
  const user = await User.findByIdAndUpdate(
    req.user.id,
    { avatarUrl: media.url },
    { new: true }
  );
  return ok(res, user?.toPublic(), "Avatar updated");
});
var uploadCover = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest("No file provided");
  const media = await uploadBuffer(req.file, `covers/${req.user.id}`);
  const user = await User.findByIdAndUpdate(req.user.id, { coverUrl: media.url }, { new: true });
  return ok(res, user?.toPublic(), "Cover updated");
});
var addGalleryItem = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest("No file provided");
  const media = await uploadBuffer(req.file, `gallery/${req.user.id}`);
  const field = media.type === "video" ? "videos" : "photos";
  const profile = await Profile.findOneAndUpdate(
    { user: req.user.id },
    { $push: { [field]: media } },
    { upsert: true, new: true }
  );
  return ok(res, profile, "Media added");
});
var removeGalleryItem = asyncHandler(async (req, res) => {
  const profile = await Profile.findOne({ user: req.user.id });
  if (!profile) throw ApiError.notFound("Profile not found");
  const { mediaId } = req.params;
  const all = [...profile.photos, ...profile.videos];
  const item = all.find((m) => m._id?.toString() === mediaId);
  if (item) await deleteMedia(item.publicId, item.type === "video" ? "video" : "image");
  profile.photos = profile.photos.filter((m) => m._id?.toString() !== mediaId);
  profile.videos = profile.videos.filter((m) => m._id?.toString() !== mediaId);
  await profile.save();
  return ok(res, profile, "Media removed");
});
var searchUsers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { q, gender, country, role, online } = req.query;
  const blocked = await Block.find({ blocker: req.user.id }).distinct("blocked");
  const exclude = [...blocked.map(String), req.user.id];
  const discoverableIds = await getDiscoverableUserIds(req.user.id, exclude);
  if (discoverableIds.length === 0) {
    return ok(res, buildPaginated([], page, limit, 0));
  }
  const [myLng, myLat] = await requireUserCoordinates(req.user.id);
  const userFilter = {
    _id: { $nin: exclude, $in: discoverableIds },
    status: "active"
  };
  if (role && Object.values(Role).includes(role)) userFilter.role = role;
  if (gender) userFilter.gender = gender;
  if (online === "true") userFilter.isOnline = true;
  if (q) userFilter.$text = { $search: q };
  if (country) {
    const profileUserIds = await Profile.find({ country, user: { $in: discoverableIds } }).distinct(
      "user"
    );
    userFilter._id = { $nin: exclude, $in: profileUserIds };
  }
  const [users, total, profiles] = await Promise.all([
    User.find(userFilter).sort({ isOnline: -1, createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(userFilter),
    Profile.find({ user: { $in: discoverableIds } }).select("user location")
  ]);
  const profileMap = new Map(profiles.map((p) => [p.user.toString(), p]));
  const items = users.map((u) => {
    const pub = u.toPublic();
    const prof = profileMap.get(u._id.toString());
    if (prof?.location?.coordinates) {
      const [lng, lat] = prof.location.coordinates;
      pub.distanceKm = Math.round(haversineKm(myLat, myLng, lat, lng) * 10) / 10;
    }
    return pub;
  });
  return ok(res, buildPaginated(items, page, limit, total));
});
var getMyBadges = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const [notifications, conversations] = await Promise.all([
    Notification.countDocuments({ user: userId, isRead: false }),
    Conversation.find({ participants: userId }).select("unread")
  ]);
  const messages = conversations.reduce((sum, c) => sum + (c.unread.get(userId) ?? 0), 0);
  return ok(res, { notifications, messages });
});
var listHosts = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const blocked = await Block.find({ blocker: req.user.id }).distinct("blocked");
  const discoverableIds = await getDiscoverableUserIds(req.user.id, blocked);
  const filter = {
    _id: { $in: discoverableIds },
    role: "host" /* Host */,
    isHostApproved: true,
    status: "active"
  };
  const [hosts, total] = await Promise.all([
    User.find(filter).sort({ isOnline: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter)
  ]);
  return ok(res, buildPaginated(hosts.map((h) => h.toPublic()), page, limit, total));
});

// src/modules/users/users.validation.ts
import { z as z3 } from "zod";
var updateMeSchema = z3.object({
  displayName: z3.string().min(2).max(60).optional(),
  bio: z3.string().max(500).optional(),
  gender: z3.nativeEnum(Gender).optional(),
  country: z3.string().min(2).max(80).optional()
});
var updateProfileSchema = z3.object({
  dob: z3.coerce.date().optional(),
  gender: z3.nativeEnum(Gender).optional(),
  interestedIn: z3.nativeEnum(InterestedIn).optional(),
  languages: z3.array(z3.string()).max(20).optional(),
  country: z3.string().max(60).optional(),
  city: z3.string().max(60).optional(),
  interests: z3.array(z3.string()).max(30).optional(),
  height: z3.number().min(50).max(260).optional(),
  occupation: z3.string().max(80).optional(),
  lat: z3.number().min(-90).max(90).optional(),
  lng: z3.number().min(-180).max(180).optional(),
  preferences: z3.object({
    ageMin: z3.number().min(18).max(100),
    ageMax: z3.number().min(18).max(100),
    maxDistanceKm: z3.number().min(1).max(2e4)
  }).partial().optional()
});
var updateLocationSchema = z3.object({
  lat: z3.number().min(-90).max(90),
  lng: z3.number().min(-180).max(180),
  city: z3.string().max(80).optional(),
  country: z3.string().max(80).optional(),
  locationLabel: z3.string().max(200).optional()
});

// src/modules/users/users.routes.ts
var router2 = Router2();
router2.use(authenticate);
router2.get("/", searchUsers);
router2.get("/hosts", listHosts);
router2.patch("/me", validate({ body: updateMeSchema }), updateMe);
router2.get("/me/badges", getMyBadges);
router2.get("/me/interactions", getMyInteractions);
router2.get("/me/search-contacts", searchContacts);
router2.get("/me/profile", getMyProfile);
router2.get("/me/location", getMyLocation);
router2.post("/me/location", validate({ body: updateLocationSchema }), updateMyLocation);
router2.patch("/me/profile", validate({ body: updateProfileSchema }), updateMyProfile);
router2.post("/me/avatar", uploadImage.single("file"), uploadAvatar);
router2.post("/me/cover", uploadImage.single("file"), uploadCover);
router2.post("/me/gallery", uploadMedia.single("file"), addGalleryItem);
router2.delete("/me/gallery/:mediaId", removeGalleryItem);
router2.get("/:id", getUser);
var users_routes_default = router2;

// src/modules/social/social.routes.ts
import { Router as Router3 } from "express";

// src/modules/social/social.controller.ts
import { Types as Types15 } from "mongoose";

// src/socket/io.ts
var io = null;
function emitToUser(userId, event, payload) {
  io?.to(`user:${userId}`).emit(event, payload);
}
function emitToRoom(room, event, payload) {
  io?.to(room).emit(event, payload);
}

// src/services/notification.service.ts
async function notify(params) {
  const notification = await Notification.create({
    user: params.userId,
    type: params.type,
    title: params.title,
    body: params.body,
    actor: params.actor,
    data: params.data
  });
  emitToUser(params.userId.toString(), SocketEvents.Notification, {
    id: notification._id.toString(),
    type: notification.type,
    title: notification.title,
    body: notification.body,
    data: notification.data,
    createdAt: notification.createdAt
  });
  return notification;
}

// src/modules/social/social.controller.ts
var likeUser = asyncHandler(async (req, res) => {
  const me2 = req.user.id;
  const target = req.params.userId;
  if (me2 === target) throw ApiError.badRequest("You cannot like yourself");
  await assertUsersCanConnect(me2, target);
  const targetUser = await User.findById(target).select("displayName");
  if (!targetUser) throw ApiError.notFound("User not found");
  await Like.updateOne({ from: me2, to: target }, { $setOnInsert: { from: me2, to: target } }, { upsert: true });
  await Profile.updateOne({ user: target }, { $inc: { "stats.likesReceived": 1 } }, { upsert: true });
  const reciprocal = await Like.exists({ from: target, to: me2 });
  let matched = false;
  if (reciprocal) {
    const users = [new Types15.ObjectId(me2), new Types15.ObjectId(target)].sort();
    await Match.updateOne(
      { users: { $all: users } },
      { $setOnInsert: { users, matchedAt: /* @__PURE__ */ new Date(), active: true } },
      { upsert: true }
    );
    matched = true;
    await notify({
      userId: target,
      actor: me2,
      type: "match" /* Match */,
      title: "It's a match! \u{1F389}",
      body: `You and ${(await User.findById(me2))?.displayName} liked each other`
    });
    await notify({
      userId: me2,
      actor: target,
      type: "match" /* Match */,
      title: "It's a match! \u{1F389}",
      body: `You and ${targetUser.displayName} liked each other`
    });
  } else {
    await notify({
      userId: target,
      actor: me2,
      type: "like" /* Like */,
      title: "Someone likes you \u{1F496}",
      body: "Open Kushlov to find out who"
    });
  }
  return created(res, { matched }, matched ? "It's a match!" : "Liked");
});
var unlikeUser = asyncHandler(async (req, res) => {
  const me2 = req.user.id;
  const target = req.params.userId;
  await Like.deleteOne({ from: me2, to: target });
  const users = [new Types15.ObjectId(me2), new Types15.ObjectId(target)].sort();
  await Match.updateOne({ users: { $all: users } }, { active: false });
  return ok(res, null, "Unliked");
});
var listMatches = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = { users: req.user.id, active: true };
  const [matches, total] = await Promise.all([
    Match.find(filter).sort({ matchedAt: -1 }).skip(skip).limit(limit).populate("users", "displayName username avatarUrl isOnline"),
    Match.countDocuments(filter)
  ]);
  const items = matches.map((m) => {
    const other = m.users.find((u) => u._id.toString() !== req.user.id);
    return { matchId: m._id, matchedAt: m.matchedAt, user: other };
  });
  return ok(res, buildPaginated(items, page, limit, total));
});
var listLikers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = { to: req.user.id };
  const [likes, total] = await Promise.all([
    Like.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate("from", "displayName username avatarUrl isOnline"),
    Like.countDocuments(filter)
  ]);
  return ok(res, buildPaginated(likes.map((l) => l.from), page, limit, total));
});
var followUser = asyncHandler(async (req, res) => {
  const me2 = req.user.id;
  const target = req.params.userId;
  if (me2 === target) throw ApiError.badRequest("You cannot follow yourself");
  await assertUsersCanConnect(me2, target);
  const targetUser = await User.findById(target);
  if (!targetUser) throw ApiError.notFound("User not found");
  const result = await Follower.updateOne(
    { follower: me2, following: target },
    { $setOnInsert: { follower: me2, following: target } },
    { upsert: true }
  );
  if (result.upsertedCount) {
    await Profile.updateOne({ user: target }, { $inc: { "stats.followers": 1 } }, { upsert: true });
    await Profile.updateOne({ user: me2 }, { $inc: { "stats.following": 1 } }, { upsert: true });
    await notify({
      userId: target,
      actor: me2,
      type: "follower" /* Follower */,
      title: "New follower",
      body: `${(await User.findById(me2))?.displayName} started following you`
    });
  }
  return created(res, null, "Followed");
});
var unfollowUser = asyncHandler(async (req, res) => {
  const me2 = req.user.id;
  const target = req.params.userId;
  const result = await Follower.deleteOne({ follower: me2, following: target });
  if (result.deletedCount) {
    await Profile.updateOne({ user: target }, { $inc: { "stats.followers": -1 } });
    await Profile.updateOne({ user: me2 }, { $inc: { "stats.following": -1 } });
  }
  return ok(res, null, "Unfollowed");
});
var listFollowing = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = { follower: req.user.id };
  const [rows, total] = await Promise.all([
    Follower.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate("following", "displayName username avatarUrl isOnline role isHostApproved"),
    Follower.countDocuments(filter)
  ]);
  return ok(res, buildPaginated(rows.map((r) => r.following), page, limit, total));
});

// src/modules/social/social.routes.ts
var router3 = Router3();
router3.use(authenticate);
router3.post("/like/:userId", likeUser);
router3.delete("/like/:userId", unlikeUser);
router3.get("/matches", listMatches);
router3.get("/likes", listLikers);
router3.post("/follow/:userId", followUser);
router3.delete("/follow/:userId", unfollowUser);
router3.get("/following", listFollowing);
var social_routes_default = router3;

// src/modules/moderation/moderation.routes.ts
import { Router as Router4 } from "express";
import { z as z4 } from "zod";

// src/modules/moderation/moderation.controller.ts
var reportUser = asyncHandler(async (req, res) => {
  const { reportedUser, reason, description, contextType, contextRef } = req.body;
  if (reportedUser === req.user.id) throw ApiError.badRequest("You cannot report yourself");
  const exists = await User.exists({ _id: reportedUser });
  if (!exists) throw ApiError.notFound("Reported user not found");
  const evidence = [];
  const files = req.files ?? [];
  for (const file of files) {
    const media = await uploadBuffer(file, `reports/${req.user.id}`);
    evidence.push({ url: media.url, publicId: media.publicId });
  }
  const report = await Report.create({
    reporter: req.user.id,
    reportedUser,
    reason,
    description,
    contextType,
    contextRef,
    evidence
  });
  return created(res, report, "Report submitted");
});
var blockUser = asyncHandler(async (req, res) => {
  const target = req.params.userId;
  if (target === req.user.id) throw ApiError.badRequest("You cannot block yourself");
  await Block.updateOne(
    { blocker: req.user.id, blocked: target },
    { $setOnInsert: { blocker: req.user.id, blocked: target } },
    { upsert: true }
  );
  return created(res, null, "User blocked");
});
var unblockUser = asyncHandler(async (req, res) => {
  await Block.deleteOne({ blocker: req.user.id, blocked: req.params.userId });
  return ok(res, null, "User unblocked");
});
var listBlocks = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = { blocker: req.user.id };
  const [rows, total] = await Promise.all([
    Block.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate("blocked", "displayName username avatarUrl"),
    Block.countDocuments(filter)
  ]);
  return ok(res, buildPaginated(rows.map((r) => r.blocked), page, limit, total));
});

// src/modules/moderation/moderation.routes.ts
var router4 = Router4();
router4.use(authenticate);
var reportSchema2 = z4.object({
  reportedUser: z4.string().min(1),
  reason: z4.string().min(2).max(120),
  description: z4.string().max(1e3).optional(),
  contextType: z4.enum(["profile", "message", "live", "call"]).optional(),
  contextRef: z4.string().optional()
});
router4.post("/report", uploadImage.array("evidence", 5), validate({ body: reportSchema2 }), reportUser);
router4.post("/block/:userId", blockUser);
router4.delete("/block/:userId", unblockUser);
router4.get("/blocks", listBlocks);
var moderation_routes_default = router4;

// src/modules/verification/verification.routes.ts
import { Router as Router5 } from "express";
import { z as z5 } from "zod";

// src/modules/verification/verification.controller.ts
var getInstructions = asyncHandler(async (_req, res) => {
  const instructions = await AdminInstruction.find({ isActive: true }).sort({ sortOrder: 1 });
  return ok(res, instructions);
});
var getMyVerification = asyncHandler(async (req, res) => {
  const request = await VerificationRequest.findOne({ user: req.user.id }).sort({ createdAt: -1 });
  return ok(res, request);
});
var submitBasic = asyncHandler(async (req, res) => {
  const { name, username, bio, gender, dob, languages, country } = req.body;
  const request = await VerificationRequest.findOneAndUpdate(
    { user: req.user.id, status: { $in: ["pending" /* Pending */, "need_more_info" /* NeedMoreInfo */] } },
    {
      $set: {
        user: req.user.id,
        "basic.name": name,
        "basic.username": username,
        "basic.bio": bio,
        "basic.gender": gender,
        "basic.dob": dob,
        "basic.languages": languages ?? [],
        "basic.country": country,
        currentStep: "documents" /* Documents */,
        status: "pending" /* Pending */
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return created(res, request, "Basic information saved");
});
var submitDocuments = asyncHandler(async (req, res) => {
  const request = await VerificationRequest.findOne({ user: req.user.id }).sort({ createdAt: -1 });
  if (!request) throw ApiError.badRequest("Complete Step 1 (basic info) first");
  const files = req.files;
  const govId = files?.governmentId?.[0];
  if (!govId) throw ApiError.badRequest("Government ID is required");
  const govMedia = await uploadBuffer(govId, `verification/${req.user.id}/documents`);
  request.documents.governmentId = { url: govMedia.url, publicId: govMedia.publicId };
  const addressProof = files?.addressProof?.[0];
  if (addressProof) {
    const addrMedia = await uploadBuffer(addressProof, `verification/${req.user.id}/documents`);
    request.documents.addressProof = { url: addrMedia.url, publicId: addrMedia.publicId };
  }
  request.currentStep = "identity" /* Identity */;
  await request.save();
  return ok(res, request, "Documents uploaded");
});
var submitIdentity = asyncHandler(async (req, res) => {
  const request = await VerificationRequest.findOne({ user: req.user.id }).sort({ createdAt: -1 });
  if (!request) throw ApiError.badRequest("Complete previous steps first");
  const files = req.files;
  const selfies = files?.selfies ?? [];
  const video = files?.video?.[0];
  if (selfies.length < 3) throw ApiError.badRequest("Exactly 3 live selfie photos are required");
  if (!video) throw ApiError.badRequest("A live verification video is required");
  const instructions = Array.isArray(req.body.instructions) ? req.body.instructions : req.body.instructions ? [req.body.instructions] : [];
  const uploadedSelfies = [];
  for (let i = 0; i < selfies.length; i += 1) {
    const media = await uploadBuffer(selfies[i], `verification/${req.user.id}/selfies`);
    uploadedSelfies.push({ url: media.url, publicId: media.publicId, instruction: instructions[i] });
  }
  const videoMedia = await uploadBuffer(video, `verification/${req.user.id}/video`, {
    resource_type: "video"
  });
  request.selfies = uploadedSelfies;
  request.verificationVideo = {
    url: videoMedia.url,
    publicId: videoMedia.publicId,
    instruction: req.body.videoInstruction
  };
  const activeInstructions = await AdminInstruction.find({ isActive: true }).distinct("_id");
  request.instructionsUsed = activeInstructions;
  request.currentStep = "submitted" /* Submitted */;
  request.status = "pending" /* Pending */;
  await request.save();
  return ok(res, request, "Identity evidence submitted \u2014 pending admin review");
});

// src/modules/verification/verification.routes.ts
var router5 = Router5();
router5.use(authenticate);
var basicSchema = z5.object({
  name: z5.string().min(2).max(60),
  username: z5.string().min(3).max(30),
  bio: z5.string().max(500).optional(),
  gender: z5.nativeEnum(Gender),
  dob: z5.coerce.date(),
  languages: z5.array(z5.string()).optional(),
  country: z5.string().min(2)
});
router5.get("/instructions", getInstructions);
router5.get("/me", getMyVerification);
router5.post("/basic", validate({ body: basicSchema }), submitBasic);
router5.post(
  "/documents",
  uploadDocument.fields([
    { name: "governmentId", maxCount: 1 },
    { name: "addressProof", maxCount: 1 }
  ]),
  submitDocuments
);
router5.post(
  "/identity",
  uploadMedia.fields([
    { name: "selfies", maxCount: 3 },
    { name: "video", maxCount: 1 }
  ]),
  submitIdentity
);
var verification_routes_default = router5;

// src/modules/wallet/wallet.routes.ts
import { Router as Router6 } from "express";
import { z as z6 } from "zod";

// src/modules/wallet/wallet.controller.ts
var getWallet = asyncHandler(async (req, res) => {
  const wallet = await ensureWallet(req.user.id);
  return ok(res, wallet);
});
var getDiamondHistory = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = { user: req.user.id };
  const [items, total] = await Promise.all([
    DiamondTransaction.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    DiamondTransaction.countDocuments(filter)
  ]);
  return ok(res, buildPaginated(items, page, limit, total));
});
var getGoldHistory = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = { user: req.user.id };
  const [items, total] = await Promise.all([
    GoldTransaction.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    GoldTransaction.countDocuments(filter)
  ]);
  return ok(res, buildPaginated(items, page, limit, total));
});
var requestWithdraw = asyncHandler(async (req, res) => {
  const { goldAmount, method, destination } = req.body;
  const settings = await getSettings();
  if (goldAmount < settings.withdraw.minGold) {
    throw ApiError.badRequest(`Minimum withdrawal is ${settings.withdraw.minGold} gold`);
  }
  const wallet = await ensureWallet(req.user.id);
  if (wallet.gold < goldAmount) throw ApiError.badRequest("Insufficient gold balance");
  const pending = await WithdrawRequest.exists({
    host: req.user.id,
    status: { $in: ["requested" /* Requested */, "approved" /* Approved */] }
  });
  if (pending) throw ApiError.conflict("You already have a pending withdrawal request");
  const fiatAmount = Number((goldAmount * settings.withdraw.goldToFiatRate).toFixed(2));
  const request = await WithdrawRequest.create({
    host: req.user.id,
    goldAmount,
    fiatAmount,
    currency: settings.withdraw.currency,
    method,
    destination
  });
  return created(res, request, "Withdrawal requested");
});
var listMyWithdrawals = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = { host: req.user.id };
  const [items, total] = await Promise.all([
    WithdrawRequest.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    WithdrawRequest.countDocuments(filter)
  ]);
  return ok(res, buildPaginated(items, page, limit, total));
});

// src/modules/wallet/wallet.routes.ts
var router6 = Router6();
router6.use(authenticate);
router6.get("/", getWallet);
router6.get("/diamonds/transactions", getDiamondHistory);
router6.get("/gold/transactions", getGoldHistory);
var withdrawMethods = ["bank_transfer", "upi", "net_banking"];
var withdrawSchema2 = z6.object({
  goldAmount: z6.number().int().positive(),
  method: z6.enum(withdrawMethods),
  destination: z6.record(z6.any())
});
router6.post("/withdraw", authorize("host" /* Host */), validate({ body: withdrawSchema2 }), requestWithdraw);
router6.get("/withdrawals", authorize("host" /* Host */), listMyWithdrawals);
var wallet_routes_default = router6;

// src/modules/payments/payments.routes.ts
import { Router as Router7 } from "express";
import { z as z7 } from "zod";

// src/services/payment/index.ts
init_env();
init_logger();

// src/services/payment/mock.provider.ts
import { nanoid } from "nanoid";
var MockPaymentProvider = class {
  name = "mock";
  async createCharge(input) {
    return {
      providerRef: `mock_${nanoid(16)}`,
      checkoutUrl: `${process.env.CLIENT_URL ?? ""}/wallet/checkout/${input.paymentId}`,
      status: "pending" /* Pending */
    };
  }
  async verify(providerRef) {
    return { status: "succeeded" /* Succeeded */, providerRef };
  }
  async refund(providerRef, amount) {
    return { status: "refunded" /* Refunded */, providerRef, amount };
  }
  async handleWebhook(rawBody) {
    try {
      const payload = JSON.parse(rawBody.toString() || "{}");
      if (payload.providerRef && payload.status) {
        return { providerRef: payload.providerRef, status: payload.status };
      }
    } catch {
    }
    return null;
  }
};

// src/services/payment/index.ts
var provider = null;
function getPaymentProvider() {
  if (provider) return provider;
  switch (env.PAYMENT_PROVIDER) {
    // case 'stripe':
    //   provider = new StripePaymentProvider();
    //   break;
    case "mock":
    default:
      if (env.PAYMENT_PROVIDER !== "mock") {
        logger.warn(`Unknown PAYMENT_PROVIDER "${env.PAYMENT_PROVIDER}", falling back to mock`);
      }
      provider = new MockPaymentProvider();
  }
  return provider;
}

// src/modules/payments/payments.controller.ts
init_logger();
var listPackages = asyncHandler(async (req, res) => {
  const settings = await getSettings();
  let country;
  if (req.user?.id) {
    const buyer = await User.findById(req.user.id).select("country");
    country = buyer?.country;
  }
  const packages = settings.diamondPackages.filter((p) => p.isActive).map((p) => {
    const pkg = JSON.parse(JSON.stringify(p));
    const { amount, currency } = getPackagePriceForCountry(pkg, country);
    return { ...pkg, price: amount, currency };
  });
  return ok(res, packages);
});
var purchaseDiamonds = asyncHandler(async (req, res) => {
  if (req.user.role === "host" /* Host */) {
    throw ApiError.forbidden("Hosts cannot purchase diamonds. Earn gold from your audience and withdraw instead.");
  }
  const { packageId } = req.body;
  const settings = await getSettings();
  const pkg = settings.diamondPackages.find((p) => p.id === packageId && p.isActive);
  if (!pkg) throw ApiError.badRequest("Invalid package");
  const buyer = await User.findById(req.user.id).select("country");
  const { amount, currency } = getPackagePriceForCountry(pkg, buyer?.country);
  const diamonds = pkg.diamonds + pkg.bonus;
  const provider2 = getPaymentProvider();
  const payment = await Payment.create({
    user: req.user.id,
    provider: provider2.name,
    packageId: pkg.id,
    amount,
    currency,
    diamonds,
    status: "created" /* Created */
  });
  const charge = await provider2.createCharge({
    paymentId: payment._id.toString(),
    userId: req.user.id,
    amount,
    currency,
    description: `${pkg.label} \u2014 ${diamonds} diamonds`,
    metadata: { paymentId: payment._id.toString() }
  });
  payment.providerRef = charge.providerRef;
  payment.status = charge.status;
  await payment.save();
  return created(
    res,
    {
      paymentId: payment._id,
      providerRef: charge.providerRef,
      checkoutUrl: charge.checkoutUrl,
      clientSecret: charge.clientSecret,
      status: payment.status
    },
    "Payment created"
  );
});
var verifyPayment = asyncHandler(async (req, res) => {
  const payment = await Payment.findOne({ _id: req.params.paymentId, user: req.user.id });
  if (!payment) throw ApiError.notFound("Payment not found");
  if (payment.status === "succeeded" /* Succeeded */) {
    return ok(res, payment, "Payment already settled");
  }
  const provider2 = getPaymentProvider();
  const result = await provider2.verify(payment.providerRef);
  if (result.status === "succeeded" /* Succeeded */) {
    await settlePayment(payment._id.toString());
    const fresh = await Payment.findById(payment._id);
    return ok(res, fresh, "Payment successful, diamonds credited");
  }
  payment.status = result.status;
  if (result.status === "failed" /* Failed */) payment.failureReason = "Verification failed";
  await payment.save();
  return ok(res, payment, "Payment not completed");
});
async function settlePayment(paymentId) {
  const payment = await Payment.findOneAndUpdate(
    { _id: paymentId, status: { $in: ["created" /* Created */, "pending" /* Pending */] } },
    { $set: { status: "succeeded" /* Succeeded */ } },
    { new: true }
  );
  if (!payment) return;
  await creditDiamonds({
    userId: payment.user,
    amount: payment.diamonds,
    reason: "purchase" /* Purchase */,
    reference: payment._id,
    referenceModel: "Payment"
  });
  await notify({
    userId: payment.user,
    type: "payment" /* Payment */,
    title: "Diamonds added \u{1F48E}",
    body: `${payment.diamonds} diamonds have been added to your wallet`
  });
}
var listMyPayments = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = { user: req.user.id };
  const [items, total] = await Promise.all([
    Payment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Payment.countDocuments(filter)
  ]);
  return ok(res, buildPaginated(items, page, limit, total));
});
var webhook = asyncHandler(async (req, res) => {
  const provider2 = getPaymentProvider();
  const signature = req.headers["stripe-signature"];
  const event = await provider2.handleWebhook(req.body, signature);
  if (!event) return res.status(400).json({ received: false });
  const payment = await Payment.findOne({ providerRef: event.providerRef });
  if (payment) {
    if (event.status === "succeeded" /* Succeeded */) {
      await settlePayment(payment._id.toString());
    } else {
      payment.status = event.status;
      await payment.save();
    }
  }
  logger.info({ providerRef: event.providerRef, status: event.status }, "Payment webhook processed");
  return res.json({ received: true });
});

// src/modules/payments/payments.routes.ts
var router7 = Router7();
router7.post("/webhook", webhook);
router7.get("/packages", optionalAuth, listPackages);
router7.use(authenticate);
router7.post(
  "/purchase",
  validate({ body: z7.object({ packageId: z7.string().min(1) }) }),
  purchaseDiamonds
);
router7.post("/:paymentId/verify", verifyPayment);
router7.get("/", listMyPayments);
var payments_routes_default = router7;

// src/modules/gifts/gifts.routes.ts
import { Router as Router8 } from "express";
import { z as z8 } from "zod";

// src/modules/gifts/gifts.controller.ts
var listGifts = asyncHandler(async (_req, res) => {
  const gifts = await Gift.find({ isActive: true }).sort({ sortOrder: 1, diamondCost: 1 });
  return ok(res, gifts);
});
var sendGift = asyncHandler(async (req, res) => {
  const { giftId, toUserId } = req.body;
  if (toUserId === req.user.id) throw ApiError.badRequest("You cannot gift yourself");
  const [gift, recipient] = await Promise.all([
    Gift.findOne({ _id: giftId, isActive: true }),
    User.findById(toUserId).select("displayName")
  ]);
  if (!gift) throw ApiError.notFound("Gift not found");
  if (!recipient) throw ApiError.notFound("Recipient not found");
  const result = await spendDiamonds({
    userId: req.user.id,
    hostId: toUserId,
    amount: gift.diamondCost,
    diamondReason: "gift" /* Gift */,
    goldReason: "gift" /* Gift */,
    reference: gift._id,
    referenceModel: "Gift",
    meta: { giftName: gift.name, context: req.body.context ?? "chat" }
  });
  await notify({
    userId: toUserId,
    actor: req.user.id,
    type: "gift" /* Gift */,
    title: `You received a ${gift.name}! \u{1F381}`,
    body: `+${result.goldEarned} gold`,
    data: { giftId: gift._id, imageUrl: gift.imageUrl, gold: result.goldEarned }
  });
  return created(
    res,
    { gift, ...result },
    `Sent ${gift.name} to ${recipient.displayName}`
  );
});

// src/modules/gifts/gifts.routes.ts
var router8 = Router8();
router8.get("/", listGifts);
router8.use(authenticate);
var sendSchema = z8.object({
  giftId: z8.string().min(1),
  toUserId: z8.string().min(1),
  context: z8.enum(["chat", "call", "live"]).optional()
});
router8.post("/send", validate({ body: sendSchema }), sendGift);
var gifts_routes_default = router8;

// src/modules/chat/chat.routes.ts
import { Router as Router9 } from "express";
import { z as z9 } from "zod";

// src/modules/chat/chat.service.ts
import { Types as Types16 } from "mongoose";
async function getOrCreateDirectConversation(a, b) {
  if (a === b) throw ApiError.badRequest("Cannot start a conversation with yourself");
  const blocked = await Block.exists({
    $or: [
      { blocker: a, blocked: b },
      { blocker: b, blocked: a }
    ]
  });
  if (blocked) throw ApiError.forbidden("Conversation not allowed (blocked)");
  await assertUsersCanConnect(a, b);
  const participants = [new Types16.ObjectId(a), new Types16.ObjectId(b)];
  let conversation = await Conversation.findOne({
    isGroup: false,
    participants: { $all: participants, $size: 2 }
  });
  if (!conversation) {
    conversation = await Conversation.create({ participants, isGroup: false });
  }
  return conversation;
}
async function createMessage(input) {
  const conversation = await Conversation.findById(input.conversationId);
  if (!conversation) throw ApiError.notFound("Conversation not found");
  if (!conversation.participants.some((p) => p.toString() === input.senderId)) {
    throw ApiError.forbidden("Not a participant of this conversation");
  }
  const recipientId = conversation.participants.map((p) => p.toString()).find((id) => id !== input.senderId);
  if (recipientId) {
    const [sender, recipient] = await Promise.all([
      User.findById(input.senderId).select("role"),
      User.findById(recipientId).select("role")
    ]);
    if (sender?.role === "user" /* User */ && recipient?.role === "host" /* Host */) {
      const settings = await getSettings();
      const cost = settings.rates.chatPerMessage ?? settings.rates.liveChatPerMessage;
      if (cost > 0) {
        await spendDiamonds({
          userId: input.senderId,
          hostId: recipientId,
          amount: cost,
          diamondReason: "direct_message" /* DirectMessage */,
          goldReason: "direct_message" /* DirectMessage */,
          reference: conversation._id,
          referenceModel: "Conversation"
        });
      }
    }
  }
  const message = await Message.create({
    conversation: conversation._id,
    sender: input.senderId,
    type: input.type ?? "text" /* Text */,
    text: input.text,
    media: input.media,
    replyTo: input.replyTo,
    forwardedFrom: input.forwardedFrom,
    readBy: [input.senderId]
  });
  conversation.lastMessage = message._id;
  conversation.lastMessageAt = /* @__PURE__ */ new Date();
  for (const participant of conversation.participants) {
    const id = participant.toString();
    if (id !== input.senderId) {
      conversation.unread.set(id, (conversation.unread.get(id) ?? 0) + 1);
    }
  }
  await conversation.save();
  const populated = await message.populate("sender", "displayName username avatarUrl");
  for (const participant of conversation.participants) {
    const id = participant.toString();
    if (id !== input.senderId) {
      emitToUser(id, SocketEvents.MessageNew, populated);
      await notify({
        userId: id,
        actor: input.senderId,
        type: "message" /* Message */,
        title: "New message",
        body: input.text?.slice(0, 80) ?? "Sent you an attachment",
        data: { conversationId: conversation._id.toString() }
      });
    }
  }
  return populated;
}

// src/modules/chat/chat.controller.ts
var listConversations = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = { participants: req.user.id };
  const [items, total] = await Promise.all([
    Conversation.find(filter).sort({ lastMessageAt: -1, updatedAt: -1 }).skip(skip).limit(limit).populate("participants", "displayName username avatarUrl isOnline lastSeenAt").populate("lastMessage"),
    Conversation.countDocuments(filter)
  ]);
  const withUnread = items.map((c) => ({
    ...c.toObject(),
    unreadCount: c.unread.get(req.user.id) ?? 0
  }));
  return ok(res, buildPaginated(withUnread, page, limit, total));
});
var openConversation = asyncHandler(async (req, res) => {
  const conversation = await getOrCreateDirectConversation(req.user.id, req.body.userId);
  const populated = await conversation.populate(
    "participants",
    "displayName username avatarUrl isOnline"
  );
  return created(res, populated);
});
var getMessages = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 30 });
  const conversation = await Conversation.findById(req.params.id);
  if (!conversation || !conversation.participants.some((p) => p.toString() === req.user.id)) {
    throw ApiError.forbidden("Not allowed");
  }
  const filter = { conversation: conversation._id, deletedFor: { $ne: req.user.id } };
  const [items, total] = await Promise.all([
    Message.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate("sender", "displayName username avatarUrl").populate("replyTo"),
    Message.countDocuments(filter)
  ]);
  return ok(res, buildPaginated(items.reverse(), page, limit, total));
});
var sendMessage = asyncHandler(async (req, res) => {
  let media;
  let type = req.body.type ?? "text" /* Text */;
  if (req.file) {
    const uploaded = await uploadBuffer(req.file, `chat/${req.params.id}`);
    media = {
      url: uploaded.url,
      publicId: uploaded.publicId,
      durationSec: uploaded.durationSec,
      width: uploaded.width,
      height: uploaded.height
    };
    type = uploaded.type === "video" ? "video" /* Video */ : uploaded.type === "audio" ? "voice" /* Voice */ : "image" /* Image */;
  }
  const message = await createMessage({
    conversationId: req.params.id,
    senderId: req.user.id,
    type,
    text: req.body.text,
    media,
    replyTo: req.body.replyTo
  });
  return created(res, message);
});
var markRead = asyncHandler(async (req, res) => {
  const conversation = await Conversation.findById(req.params.id);
  if (!conversation || !conversation.participants.some((p) => p.toString() === req.user.id)) {
    throw ApiError.forbidden("Not allowed");
  }
  conversation.unread.set(req.user.id, 0);
  await conversation.save();
  await Message.updateMany(
    { conversation: conversation._id, readBy: { $ne: req.user.id } },
    { $addToSet: { readBy: req.user.id } }
  );
  conversation.participants.filter((p) => p.toString() !== req.user.id).forEach(
    (p) => emitToUser(p.toString(), SocketEvents.MessageRead, {
      conversationId: conversation._id.toString(),
      by: req.user.id
    })
  );
  return ok(res, null, "Marked as read");
});
var deleteMessage = asyncHandler(async (req, res) => {
  const message = await Message.findById(req.params.id);
  if (!message) throw ApiError.notFound("Message not found");
  const forEveryone = req.query.forEveryone === "true" && message.sender.toString() === req.user.id;
  if (forEveryone) {
    message.deletedForEveryone = true;
    message.text = void 0;
    message.media = void 0;
  } else {
    message.deletedFor.push(req.user.id);
  }
  await message.save();
  if (forEveryone) {
    const conversation = await Conversation.findById(message.conversation);
    conversation?.participants.forEach(
      (p) => emitToUser(p.toString(), SocketEvents.MessageDelete, { messageId: message._id.toString() })
    );
  }
  return ok(res, null, "Message deleted");
});
var forwardMessage = asyncHandler(async (req, res) => {
  const original = await Message.findById(req.params.id);
  if (!original) throw ApiError.notFound("Message not found");
  const conversation = await getOrCreateDirectConversation(req.user.id, req.body.toUserId);
  const message = await createMessage({
    conversationId: conversation._id.toString(),
    senderId: req.user.id,
    type: original.type,
    text: original.text,
    media: original.media,
    forwardedFrom: original._id.toString()
  });
  return created(res, message);
});

// src/modules/chat/chat.routes.ts
var router9 = Router9();
router9.use(authenticate);
router9.get("/conversations", listConversations);
router9.post(
  "/conversations",
  validate({ body: z9.object({ userId: z9.string().min(1) }) }),
  openConversation
);
router9.get("/conversations/:id/messages", getMessages);
router9.post("/conversations/:id/messages", uploadMedia.single("file"), sendMessage);
router9.patch("/conversations/:id/read", markRead);
router9.delete("/messages/:id", deleteMessage);
router9.post(
  "/messages/:id/forward",
  validate({ body: z9.object({ toUserId: z9.string().min(1) }) }),
  forwardMessage
);
var chat_routes_default = router9;

// src/modules/notifications/notifications.routes.ts
import { Router as Router10 } from "express";

// src/modules/notifications/notifications.controller.ts
var listNotifications = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = { user: req.user.id };
  const [items, total, unread] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Notification.countDocuments(filter),
    Notification.countDocuments({ ...filter, isRead: false })
  ]);
  return ok(res, { ...buildPaginated(items, page, limit, total), unread });
});
var markRead2 = asyncHandler(async (req, res) => {
  await Notification.updateOne({ _id: req.params.id, user: req.user.id }, { isRead: true });
  return ok(res, null, "Marked read");
});
var markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ user: req.user.id, isRead: false }, { isRead: true });
  return ok(res, null, "All marked read");
});

// src/modules/notifications/notifications.routes.ts
var router10 = Router10();
router10.use(authenticate);
router10.get("/", listNotifications);
router10.patch("/read-all", markAllRead);
router10.patch("/:id/read", markRead2);
var notifications_routes_default = router10;

// src/modules/calls/calls.routes.ts
import { Router as Router11 } from "express";
import { z as z10 } from "zod";

// src/services/livekit.service.ts
init_env();
import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
async function createLiveKitToken(grant) {
  if (!hasLiveKit) throw ApiError.internal("LiveKit is not configured");
  const at = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
    identity: grant.identity,
    name: grant.name,
    ttl: grant.ttlSeconds ?? 60 * 60,
    metadata: grant.metadata ? JSON.stringify(grant.metadata) : void 0
  });
  at.addGrant({
    room: grant.roomName,
    roomJoin: true,
    canPublish: grant.canPublish ?? true,
    canSubscribe: grant.canSubscribe ?? true,
    canPublishData: grant.canPublishData ?? true
  });
  return at.toJwt();
}
var roomClient = null;
function getRoomClient() {
  if (!hasLiveKit) throw ApiError.internal("LiveKit is not configured");
  if (!roomClient) {
    const httpUrl = env.LIVEKIT_URL.replace(/^ws/, "http");
    roomClient = new RoomServiceClient(httpUrl, env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET);
  }
  return roomClient;
}
async function removeParticipant(roomName, identity) {
  if (!hasLiveKit) return;
  await getRoomClient().removeParticipant(roomName, identity);
}
async function closeRoom(roomName) {
  if (!hasLiveKit) return;
  try {
    await getRoomClient().deleteRoom(roomName);
  } catch {
  }
}

// src/modules/calls/calls.controller.ts
init_env();
var modelFor = (type) => type === "audio" /* Audio */ ? AudioCall : VideoCall;
var initiateCall = asyncHandler(async (req, res) => {
  const { type, calleeId } = req.body;
  if (calleeId === req.user.id) throw ApiError.badRequest("You cannot call yourself");
  await assertUsersCanConnect(req.user.id, calleeId);
  const callee = await User.findById(calleeId).select("displayName role isHostApproved");
  if (!callee) throw ApiError.notFound("Callee not found");
  if (callee.role === "host" /* Host */ && !callee.isHostApproved) {
    throw ApiError.forbidden("Host is not approved to receive calls");
  }
  const settings = await getSettings();
  if (!settings.features.callsEnabled) throw ApiError.forbidden("Calls are currently disabled");
  const ratePerMinute = type === "audio" /* Audio */ ? settings.rates.audioCallPerMinute : settings.rates.videoCallPerMinute;
  if (req.user.role === "host" /* Host */) {
    throw ApiError.forbidden("Hosts cannot initiate paid calls. Users call you instead.");
  }
  if (callee.role === "host" /* Host */) {
    const wallet = await ensureWallet(req.user.id);
    if (wallet.diamonds < ratePerMinute) {
      throw ApiError.badRequest(
        `You need at least ${ratePerMinute} diamonds to call a host (${type} call rate per minute).`
      );
    }
  }
  const roomName = `${directRoomName(req.user.id, calleeId)}_${type}_${Date.now()}`;
  const Model = modelFor(type);
  const call = await Model.create({
    type,
    caller: req.user.id,
    callee: calleeId,
    roomName,
    status: "ringing" /* Ringing */,
    ratePerMinute
  });
  const token = await createLiveKitToken({
    identity: req.user.id,
    roomName,
    canPublish: true
  });
  const caller = await User.findById(req.user.id).select("displayName avatarUrl");
  emitToUser(calleeId, SocketEvents.CallInvite, {
    callId: call._id.toString(),
    type,
    roomName,
    from: caller
  });
  return created(res, { call, token, roomName, livekitUrl: getLiveKitPublicUrl() }, "Calling\u2026");
});
var acceptCall = asyncHandler(async (req, res) => {
  const type = req.params.type;
  const call = await modelFor(type).findById(req.params.id);
  if (!call) throw ApiError.notFound("Call not found");
  if (call.callee.toString() !== req.user.id) throw ApiError.forbidden("Not your call");
  call.status = "ongoing" /* Ongoing */;
  call.startedAt = /* @__PURE__ */ new Date();
  await call.save();
  const token = await createLiveKitToken({ identity: req.user.id, roomName: call.roomName });
  emitToUser(call.caller.toString(), SocketEvents.CallAccept, { callId: call._id.toString() });
  return ok(res, { call, token, roomName: call.roomName, livekitUrl: getLiveKitPublicUrl() }, "Call accepted");
});
var rejectCall = asyncHandler(async (req, res) => {
  const type = req.params.type;
  const call = await modelFor(type).findById(req.params.id);
  if (!call) throw ApiError.notFound("Call not found");
  if (call.callee.toString() !== req.user.id) throw ApiError.forbidden("Not your call");
  call.status = "rejected" /* Rejected */;
  call.endedAt = /* @__PURE__ */ new Date();
  await call.save();
  emitToUser(call.caller.toString(), SocketEvents.CallReject, { callId: call._id.toString() });
  return ok(res, call, "Call rejected");
});
var endCall = asyncHandler(async (req, res) => {
  const type = req.params.type;
  const call = await modelFor(type).findById(req.params.id);
  if (!call) throw ApiError.notFound("Call not found");
  const isParticipant = [call.caller.toString(), call.callee.toString()].includes(req.user.id);
  if (!isParticipant) throw ApiError.forbidden("Not your call");
  if (call.status === "ended" /* Ended */) return ok(res, call, "Already ended");
  const endedAt = /* @__PURE__ */ new Date();
  const durationSec = call.startedAt ? Math.max(0, Math.floor((endedAt.getTime() - call.startedAt.getTime()) / 1e3)) : 0;
  call.endedAt = endedAt;
  call.durationSec = durationSec;
  call.status = call.startedAt ? "ended" /* Ended */ : "missed" /* Missed */;
  if (call.status === "ended" /* Ended */ && durationSec > 0) {
    const minutes = Math.ceil(durationSec / 60);
    const cost = minutes * call.ratePerMinute;
    try {
      const result = await spendDiamonds({
        userId: call.caller,
        hostId: call.callee,
        amount: cost,
        diamondReason: type === "audio" /* Audio */ ? "audio_call" /* AudioCall */ : "video_call" /* VideoCall */,
        goldReason: type === "audio" /* Audio */ ? "audio_call" /* AudioCall */ : "video_call" /* VideoCall */,
        reference: call._id,
        referenceModel: type === "audio" /* Audio */ ? "AudioCall" : "VideoCall",
        meta: { minutes }
      });
      call.diamondsSpent = cost;
      call.goldEarned = result.goldEarned;
    } catch {
      call.status = "failed" /* Failed */;
    }
  }
  await call.save();
  const other = call.caller.toString() === req.user.id ? call.callee : call.caller;
  emitToUser(other.toString(), SocketEvents.CallEnd, {
    callId: call._id.toString(),
    durationSec
  });
  return ok(res, call, "Call ended");
});
var callHistory = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = { $or: [{ caller: req.user.id }, { callee: req.user.id }] };
  const [audio, video] = await Promise.all([
    AudioCall.find(filter).lean(),
    VideoCall.find(filter).lean()
  ]);
  const all = [...audio, ...video].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const total = all.length;
  const items = all.slice(skip, skip + limit);
  return ok(res, buildPaginated(items, page, limit, total));
});

// src/modules/calls/calls.routes.ts
var router11 = Router11();
router11.use(authenticate);
var initiateSchema = z10.object({
  type: z10.nativeEnum(CallType),
  calleeId: z10.string().min(1)
});
router11.post("/initiate", validate({ body: initiateSchema }), initiateCall);
router11.get("/history", callHistory);
router11.post("/:type/:id/accept", acceptCall);
router11.post("/:type/:id/reject", rejectCall);
router11.post("/:type/:id/end", endCall);
var calls_routes_default = router11;

// src/modules/live/live.routes.ts
import { Router as Router12 } from "express";
import { z as z11 } from "zod";

// src/utils/refId.ts
function refId(ref) {
  if (typeof ref === "string") return ref;
  if (ref && typeof ref === "object" && "_id" in ref) return String(ref._id);
  return String(ref);
}

// src/modules/live/live.controller.ts
init_env();
var roomOf = (id) => `live:${id}`;
var startLive = asyncHandler(async (req, res) => {
  const settings = await getSettings();
  if (!settings.features.liveEnabled) throw ApiError.forbidden("Live streaming is disabled");
  const roomName = `live_${req.user.id}_${Date.now()}`;
  let thumbnailUrl;
  let thumbnailPublicId;
  if (req.file) {
    const media = await uploadBuffer(req.file, `live/${req.user.id}/thumbnails`);
    thumbnailUrl = media.url;
    thumbnailPublicId = media.publicId;
  }
  const live = await LiveStream.create({
    host: req.user.id,
    title: req.body.title ?? "Live now",
    roomName,
    thumbnailUrl,
    thumbnailPublicId,
    status: "live" /* Live */,
    startedAt: /* @__PURE__ */ new Date()
  });
  const token = await createLiveKitToken({
    identity: req.user.id,
    roomName,
    canPublish: true,
    canPublishData: true
  });
  const followers = await Follower.find({ following: req.user.id }).distinct("follower");
  await Promise.all(
    followers.map(
      (f) => notify({
        userId: f,
        actor: req.user.id,
        type: "live_started" /* LiveStarted */,
        title: "A host you follow is live \u{1F534}",
        body: live.title,
        data: { liveId: live._id.toString() }
      })
    )
  );
  return created(res, { live, token, roomName, livekitUrl: getLiveKitPublicUrl() }, "You are live");
});
var hostToken = asyncHandler(async (req, res) => {
  const live = await LiveStream.findById(req.params.id);
  if (!live) throw ApiError.notFound("Stream not found");
  if (live.host.toString() !== req.user.id) throw ApiError.forbidden("Not your stream");
  const token = await createLiveKitToken({
    identity: req.user.id,
    roomName: live.roomName,
    canPublish: true,
    canPublishData: true
  });
  return ok(res, { token, roomName: live.roomName, livekitUrl: getLiveKitPublicUrl() });
});
var endLive = asyncHandler(async (req, res) => {
  const live = await LiveStream.findById(req.params.id);
  if (!live) throw ApiError.notFound("Stream not found");
  if (live.host.toString() !== req.user.id) throw ApiError.forbidden("Not your stream");
  live.status = "ended" /* Ended */;
  live.endedAt = /* @__PURE__ */ new Date();
  await live.save();
  await closeRoom(live.roomName);
  emitToRoom(roomOf(live._id.toString()), SocketEvents.LiveLeave, { ended: true });
  return ok(res, live, "Stream ended");
});
var listLive = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const discoverableIds = await getDiscoverableUserIds(req.user.id);
  const filter = { status: "live" /* Live */, host: { $in: discoverableIds } };
  const [items, total] = await Promise.all([
    LiveStream.find(filter).sort({ viewerCount: -1, startedAt: -1 }).skip(skip).limit(limit).populate("host", "displayName username avatarUrl isHostApproved"),
    LiveStream.countDocuments(filter)
  ]);
  return ok(res, buildPaginated(items, page, limit, total));
});
var getLive = asyncHandler(async (req, res) => {
  const live = await LiveStream.findById(req.params.id).populate(
    "host",
    "displayName username avatarUrl isHostApproved"
  );
  if (!live) throw ApiError.notFound("Stream not found");
  const hostId = refId(live.host);
  if (hostId !== req.user.id) {
    await assertUsersCanConnect(req.user.id, hostId);
  }
  return ok(res, live);
});
var joinLive = asyncHandler(async (req, res) => {
  const live = await LiveStream.findById(req.params.id);
  if (!live || live.status !== "live" /* Live */) throw ApiError.notFound("Stream is not live");
  if (live.host.toString() !== req.user.id) {
    await assertUsersCanConnect(req.user.id, live.host.toString());
  }
  if (live.bannedUsers.some((u) => u.toString() === req.user.id)) {
    throw ApiError.forbidden("You are banned from this stream");
  }
  await LiveParticipant.updateOne(
    { liveStream: live._id, user: req.user.id },
    { $set: { joinedAt: /* @__PURE__ */ new Date(), leftAt: void 0, role: "viewer" } },
    { upsert: true }
  );
  const viewerCount = await LiveParticipant.countDocuments({
    liveStream: live._id,
    leftAt: { $exists: false }
  });
  live.viewerCount = viewerCount;
  live.peakViewers = Math.max(live.peakViewers, viewerCount);
  await live.save();
  const token = await createLiveKitToken({
    identity: req.user.id,
    roomName: live.roomName,
    canPublish: false,
    canSubscribe: true,
    canPublishData: true
  });
  emitToRoom(roomOf(live._id.toString()), SocketEvents.LiveViewerCount, { viewerCount });
  return ok(res, { token, roomName: live.roomName, viewerCount, livekitUrl: getLiveKitPublicUrl() });
});
var leaveLive = asyncHandler(async (req, res) => {
  const live = await LiveStream.findById(req.params.id);
  if (!live) throw ApiError.notFound("Stream not found");
  await LiveParticipant.updateOne(
    { liveStream: live._id, user: req.user.id },
    { $set: { leftAt: /* @__PURE__ */ new Date() } }
  );
  const viewerCount = await LiveParticipant.countDocuments({
    liveStream: live._id,
    leftAt: { $exists: false }
  });
  live.viewerCount = viewerCount;
  await live.save();
  emitToRoom(roomOf(live._id.toString()), SocketEvents.LiveViewerCount, { viewerCount });
  return ok(res, { viewerCount });
});
var liveChat = asyncHandler(async (req, res) => {
  const live = await LiveStream.findById(req.params.id);
  if (!live || live.status !== "live" /* Live */) throw ApiError.notFound("Stream is not live");
  const settings = await getSettings();
  const cost = settings.rates.liveChatPerMessage;
  if (cost > 0 && live.host.toString() !== req.user.id) {
    await spendDiamonds({
      userId: req.user.id,
      hostId: live.host,
      amount: cost,
      diamondReason: "live_chat" /* LiveChat */,
      goldReason: "live_chat" /* LiveChat */,
      reference: live._id,
      referenceModel: "LiveStream"
    });
  }
  const chat = await LiveChat.create({
    liveStream: live._id,
    user: req.user.id,
    message: req.body.message
  });
  const populated = await chat.populate("user", "displayName username avatarUrl");
  emitToRoom(roomOf(live._id.toString()), SocketEvents.LiveChat, populated);
  return created(res, populated);
});
var likeLive = asyncHandler(async (req, res) => {
  const live = await LiveStream.findByIdAndUpdate(
    req.params.id,
    { $inc: { totalLikes: 1 } },
    { new: true }
  );
  if (!live) throw ApiError.notFound("Stream not found");
  emitToRoom(roomOf(live._id.toString()), SocketEvents.LiveViewerCount, {
    totalLikes: live.totalLikes
  });
  return ok(res, { totalLikes: live.totalLikes });
});
var liveGift = asyncHandler(async (req, res) => {
  const live = await LiveStream.findById(req.params.id);
  if (!live || live.status !== "live" /* Live */) throw ApiError.notFound("Stream is not live");
  const gift = await Gift.findOne({ _id: req.body.giftId, isActive: true });
  if (!gift) throw ApiError.notFound("Gift not found");
  const result = await spendDiamonds({
    userId: req.user.id,
    hostId: live.host,
    amount: gift.diamondCost,
    diamondReason: "gift" /* Gift */,
    goldReason: "gift" /* Gift */,
    reference: gift._id,
    referenceModel: "Gift",
    meta: { liveId: live._id.toString() }
  });
  live.totalGiftsGold += result.goldEarned;
  await live.save();
  emitToRoom(roomOf(live._id.toString()), SocketEvents.LiveGift, {
    gift,
    from: req.user.id,
    gold: result.goldEarned
  });
  return created(res, { gift, ...result });
});
var banFromLive = asyncHandler(async (req, res) => {
  const live = await LiveStream.findById(req.params.id);
  if (!live) throw ApiError.notFound("Stream not found");
  const isModerator = live.host.toString() === req.user.id || live.moderators.some((m) => m.toString() === req.user.id);
  if (!isModerator) throw ApiError.forbidden("Only host/moderators can ban");
  await LiveStream.updateOne({ _id: live._id }, { $addToSet: { bannedUsers: req.params.userId } });
  await removeParticipant(live.roomName, req.params.userId);
  await LiveParticipant.updateOne(
    { liveStream: live._id, user: req.params.userId },
    { $set: { leftAt: /* @__PURE__ */ new Date() } }
  );
  return ok(res, null, "User banned from stream");
});
var addModerator = asyncHandler(async (req, res) => {
  const live = await LiveStream.findById(req.params.id);
  if (!live) throw ApiError.notFound("Stream not found");
  if (live.host.toString() !== req.user.id) throw ApiError.forbidden("Only host can add moderators");
  await LiveStream.updateOne({ _id: live._id }, { $addToSet: { moderators: req.params.userId } });
  await LiveParticipant.updateOne(
    { liveStream: live._id, user: req.params.userId },
    { $set: { role: "moderator" } }
  );
  return ok(res, null, "Moderator added");
});

// src/modules/live/live.routes.ts
var router12 = Router12();
router12.use(authenticate);
router12.get("/", listLive);
router12.get("/:id", getLive);
router12.post("/start", requireApprovedHost, uploadImage.single("thumbnail"), startLive);
router12.get("/:id/host-token", hostToken);
router12.post("/:id/end", endLive);
router12.post("/:id/moderator/:userId", addModerator);
router12.post("/:id/join", joinLive);
router12.post("/:id/leave", leaveLive);
router12.post("/:id/chat", validate({ body: z11.object({ message: z11.string().min(1).max(500) }) }), liveChat);
router12.post("/:id/like", likeLive);
router12.post("/:id/gift", validate({ body: z11.object({ giftId: z11.string().min(1) }) }), liveGift);
router12.post("/:id/ban/:userId", banFromLive);
var live_routes_default = router12;

// src/modules/admin/admin.routes.ts
import { Router as Router13 } from "express";
import { z as z12 } from "zod";

// src/modules/admin/admin.controller.ts
var analytics = asyncHandler(async (_req, res) => {
  const [
    totalUsers,
    totalHosts,
    approvedHosts,
    liveNow,
    pendingVerifications,
    openReports,
    pendingWithdrawals,
    revenueAgg,
    newUsers7d
  ] = await Promise.all([
    User.countDocuments({ role: "user" /* User */ }),
    User.countDocuments({ role: "host" /* Host */ }),
    User.countDocuments({ role: "host" /* Host */, isHostApproved: true }),
    LiveStream.countDocuments({ status: "live" /* Live */ }),
    VerificationRequest.countDocuments({ status: "pending" /* Pending */ }),
    Report.countDocuments({ status: "open" /* Open */ }),
    WithdrawRequest.countDocuments({ status: "requested" /* Requested */ }),
    Payment.aggregate([
      { $match: { status: "succeeded" /* Succeeded */ } },
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } }
    ]),
    User.countDocuments({ createdAt: { $gte: new Date(Date.now() - 7 * 864e5) } })
  ]);
  return ok(res, {
    totalUsers,
    totalHosts,
    approvedHosts,
    liveNow,
    pendingVerifications,
    openReports,
    pendingWithdrawals,
    revenue: revenueAgg[0]?.total ?? 0,
    paymentsCount: revenueAgg[0]?.count ?? 0,
    newUsers7d
  });
});
var adminBadges = asyncHandler(async (_req, res) => {
  const [verifications, reports, withdrawals, inquiries] = await Promise.all([
    VerificationRequest.countDocuments({ status: "pending" /* Pending */ }),
    Report.countDocuments({ status: "open" /* Open */ }),
    WithdrawRequest.countDocuments({ status: "requested" /* Requested */ }),
    ContactInquiry.countDocuments({ status: "open" /* Open */ })
  ]);
  return ok(res, {
    verifications,
    reports,
    withdrawals,
    inquiries,
    total: verifications + reports + withdrawals + inquiries
  });
});
var listUsers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { q, role, status } = req.query;
  const filter = {};
  if (role) filter.role = role;
  if (status) filter.status = status;
  if (q) filter.$or = [{ email: new RegExp(q, "i") }, { username: new RegExp(q, "i") }];
  const [items, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter)
  ]);
  return ok(res, buildPaginated(items.map((u) => u.toPublic()), page, limit, total));
});
var updateUserStatus = asyncHandler(async (req, res) => {
  const { status, reason, suspendedUntil } = req.body;
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound("User not found");
  if (user.role === "admin" /* Admin */) throw ApiError.forbidden("Cannot modify an admin account");
  user.status = status;
  if (status === "banned" /* Banned */) user.bannedReason = reason;
  if (status === "suspended" /* Suspended */ && suspendedUntil) {
    user.suspendedUntil = new Date(suspendedUntil);
  }
  if (status !== "active" /* Active */) user.tokenVersion += 1;
  await user.save();
  return ok(res, user.toPublic(), `User ${status}`);
});
var deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound("User not found");
  if (user.role === "admin" /* Admin */) throw ApiError.forbidden("Cannot delete an admin account");
  user.status = "deleted" /* Deleted */;
  user.tokenVersion += 1;
  await user.save();
  return ok(res, null, "User deleted");
});
var listVerifications = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { status } = req.query;
  const filter = status ? { status } : {};
  const [items, total] = await Promise.all([
    VerificationRequest.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate("user", "displayName username email avatarUrl"),
    VerificationRequest.countDocuments(filter)
  ]);
  return ok(res, buildPaginated(items, page, limit, total));
});
var getVerification = asyncHandler(async (req, res) => {
  const request = await VerificationRequest.findById(req.params.id).populate("user", "displayName username email avatarUrl").populate("instructionsUsed");
  if (!request) throw ApiError.notFound("Verification request not found");
  return ok(res, request);
});
var reviewVerification = asyncHandler(async (req, res) => {
  const { decision, note } = req.body;
  const request = await VerificationRequest.findById(req.params.id);
  if (!request) throw ApiError.notFound("Verification request not found");
  request.status = decision;
  request.reviewNote = note;
  request.reviewedBy = req.user.id;
  request.reviewedAt = /* @__PURE__ */ new Date();
  await request.save();
  if (decision === "approved" /* Approved */) {
    await User.findByIdAndUpdate(request.user, {
      role: "host" /* Host */,
      isHostApproved: true,
      hostSince: /* @__PURE__ */ new Date()
    });
  } else if (decision === "rejected" /* Rejected */) {
    await User.findByIdAndUpdate(request.user, { isHostApproved: false });
  }
  await notify({
    userId: request.user,
    type: "verification" /* Verification */,
    title: `Host verification ${decision.replace("_", " ")}`,
    body: note ?? "Your verification status has been updated",
    data: { verificationId: request._id.toString(), status: decision }
  });
  return ok(res, request, `Verification ${decision}`);
});
var listInstructions = asyncHandler(async (_req, res) => {
  const items = await AdminInstruction.find().sort({ sortOrder: 1 });
  return ok(res, items);
});
var createInstruction = asyncHandler(async (req, res) => {
  const instruction = await AdminInstruction.create({ ...req.body, createdBy: req.user.id });
  return created(res, instruction, "Instruction created");
});
var updateInstruction = asyncHandler(async (req, res) => {
  const instruction = await AdminInstruction.findByIdAndUpdate(req.params.id, req.body, {
    new: true
  });
  if (!instruction) throw ApiError.notFound("Instruction not found");
  return ok(res, instruction, "Instruction updated");
});
var deleteInstruction = asyncHandler(async (req, res) => {
  await AdminInstruction.findByIdAndDelete(req.params.id);
  return ok(res, null, "Instruction deleted");
});
var listReports = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { status } = req.query;
  const filter = status ? { status } : {};
  const [items, total] = await Promise.all([
    Report.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate("reporter", "displayName username").populate("reportedUser", "displayName username avatarUrl status"),
    Report.countDocuments(filter)
  ]);
  return ok(res, buildPaginated(items, page, limit, total));
});
var resolveReport = asyncHandler(async (req, res) => {
  const { status, resolutionNote } = req.body;
  const report = await Report.findByIdAndUpdate(
    req.params.id,
    { status, resolutionNote, handledBy: req.user.id },
    { new: true }
  );
  if (!report) throw ApiError.notFound("Report not found");
  return ok(res, report, "Report updated");
});
var listPayments = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { status } = req.query;
  const filter = status ? { status } : {};
  const [items, total] = await Promise.all([
    Payment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate("user", "displayName username email"),
    Payment.countDocuments(filter)
  ]);
  return ok(res, buildPaginated(items, page, limit, total));
});
var listTransactions = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const type = req.query.type === "gold" ? "gold" : "diamond";
  const Model = type === "gold" ? GoldTransaction : DiamondTransaction;
  const [items, total] = await Promise.all([
    Model.find().sort({ createdAt: -1 }).skip(skip).limit(limit).populate("user", "displayName username"),
    Model.countDocuments()
  ]);
  return ok(res, buildPaginated(items, page, limit, total));
});
var listSubscriptions = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const [items, total] = await Promise.all([
    Subscription.find().sort({ createdAt: -1 }).skip(skip).limit(limit).populate("user", "displayName username"),
    Subscription.countDocuments()
  ]);
  return ok(res, buildPaginated(items, page, limit, total));
});
var listWithdrawals = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { status } = req.query;
  const filter = status ? { status } : {};
  const [items, total] = await Promise.all([
    WithdrawRequest.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate("host", "displayName username email"),
    WithdrawRequest.countDocuments(filter)
  ]);
  return ok(res, buildPaginated(items, page, limit, total));
});
var reviewWithdrawal = asyncHandler(async (req, res) => {
  const { status, note } = req.body;
  const request = await WithdrawRequest.findById(req.params.id);
  if (!request) throw ApiError.notFound("Withdrawal not found");
  if (request.status === "paid" /* Paid */) throw ApiError.badRequest("Already paid");
  if (status === "paid" /* Paid */) {
    await debitGold({
      hostId: request.host,
      amount: request.goldAmount,
      reason: "withdraw" /* Withdraw */,
      reference: request._id,
      referenceModel: "WithdrawRequest"
    });
    request.processedAt = /* @__PURE__ */ new Date();
  }
  request.status = status;
  request.reviewNote = note;
  request.reviewedBy = req.user.id;
  await request.save();
  await notify({
    userId: request.host,
    type: "payment" /* Payment */,
    title: `Withdrawal ${status}`,
    body: note ?? `Your withdrawal of ${request.goldAmount} gold is ${status}`
  });
  return ok(res, request, `Withdrawal ${status}`);
});
var listAllGifts = asyncHandler(async (_req, res) => {
  const items = await Gift.find().sort({ sortOrder: 1 });
  return ok(res, items);
});
var createGift = asyncHandler(async (req, res) => {
  let imageUrl = req.body.imageUrl;
  let imagePublicId;
  if (req.file) {
    const media = await uploadBuffer(req.file, "gifts");
    imageUrl = media.url;
    imagePublicId = media.publicId;
  }
  if (!imageUrl) throw ApiError.badRequest("Gift image is required");
  const gift = await Gift.create({ ...req.body, imageUrl, imagePublicId });
  return created(res, gift, "Gift created");
});
var updateGift = asyncHandler(async (req, res) => {
  const update = { ...req.body };
  if (req.file) {
    const media = await uploadBuffer(req.file, "gifts");
    update.imageUrl = media.url;
    update.imagePublicId = media.publicId;
  }
  const gift = await Gift.findByIdAndUpdate(req.params.id, update, { new: true });
  if (!gift) throw ApiError.notFound("Gift not found");
  return ok(res, gift, "Gift updated");
});
var deleteGift = asyncHandler(async (req, res) => {
  await Gift.findByIdAndDelete(req.params.id);
  return ok(res, null, "Gift deleted");
});
var listAllLive = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const [items, total] = await Promise.all([
    LiveStream.find().sort({ createdAt: -1 }).skip(skip).limit(limit).populate("host", "displayName username"),
    LiveStream.countDocuments()
  ]);
  return ok(res, buildPaginated(items, page, limit, total));
});
var forceEndLive = asyncHandler(async (req, res) => {
  const live = await LiveStream.findById(req.params.id);
  if (!live) throw ApiError.notFound("Stream not found");
  live.status = "ended" /* Ended */;
  live.endedAt = /* @__PURE__ */ new Date();
  await live.save();
  await closeRoom(live.roomName);
  return ok(res, live, "Stream force-ended");
});
var getAdminSettings = asyncHandler(async (_req, res) => {
  const settings = await getSettings();
  return ok(res, settings);
});
var updateSettings = asyncHandler(async (req, res) => {
  const settings = await getSettings();
  const updatable = [
    "goldConversionRatio",
    "rates",
    "diamondPackages",
    "withdraw",
    "features",
    "announcements",
    "landing"
  ];
  for (const key of updatable) if (key in req.body) settings[key] = req.body[key];
  await settings.save();
  return ok(res, settings, "Settings updated");
});
var listInquiries = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { status } = req.query;
  const filter = {};
  if (status) filter.status = status;
  const [items, total] = await Promise.all([
    ContactInquiry.find(filter).populate("user", "displayName username email avatarUrl").sort({ createdAt: -1 }).skip(skip).limit(limit),
    ContactInquiry.countDocuments(filter)
  ]);
  return ok(res, buildPaginated(items, page, limit, total));
});
var replyInquiry = asyncHandler(async (req, res) => {
  const { adminReply, status, adminNote } = req.body;
  const inquiry = await ContactInquiry.findById(req.params.id);
  if (!inquiry) throw ApiError.notFound("Inquiry not found");
  if (adminReply !== void 0) inquiry.adminReply = adminReply;
  if (adminNote !== void 0) inquiry.adminNote = adminNote;
  if (status) inquiry.status = status;
  await inquiry.save();
  return ok(res, inquiry, "Inquiry updated");
});
var deleteInquiry = asyncHandler(async (req, res) => {
  const inquiry = await ContactInquiry.findByIdAndDelete(req.params.id);
  if (!inquiry) throw ApiError.notFound("Inquiry not found");
  return ok(res, null, "Inquiry removed");
});
var listOnlineUsers = asyncHandler(async (req, res) => {
  const { q } = req.query;
  const filter = {
    isOnline: true,
    role: { $in: ["user" /* User */, "host" /* Host */] },
    status: "active" /* Active */
  };
  if (q) {
    filter.$or = [
      { displayName: new RegExp(q, "i") },
      { username: new RegExp(q, "i") },
      { email: new RegExp(q, "i") }
    ];
  }
  const users = await User.find(filter).sort({ displayName: 1 }).limit(200);
  const profiles = await Profile.find({ user: { $in: users.map((u) => u._id) } }).select(
    "user locationLabel city country"
  );
  const profileByUser = new Map(profiles.map((p) => [p.user.toString(), p]));
  const items = users.map((u) => {
    const profile = profileByUser.get(u._id.toString());
    const locationLabel = profile?.locationLabel || [profile?.city, profile?.country].filter(Boolean).join(", ") || u.country || "Location not set";
    return {
      ...u.toPublic(),
      locationLabel
    };
  });
  return ok(res, { items, total: items.length });
});

// src/modules/admin/admin.routes.ts
var router13 = Router13();
router13.use(authenticate, authorize("admin" /* Admin */));
router13.get("/analytics", analytics);
router13.get("/badges", adminBadges);
router13.get("/users", listUsers);
router13.get("/online", listOnlineUsers);
router13.patch(
  "/users/:id/status",
  validate({
    body: z12.object({
      status: z12.nativeEnum(AccountStatus),
      reason: z12.string().optional(),
      suspendedUntil: z12.string().optional()
    })
  }),
  updateUserStatus
);
router13.delete("/users/:id", deleteUser);
router13.get("/verifications", listVerifications);
router13.get("/verifications/:id", getVerification);
router13.patch(
  "/verifications/:id/review",
  validate({
    body: z12.object({ decision: z12.nativeEnum(VerificationStatus), note: z12.string().optional() })
  }),
  reviewVerification
);
router13.get("/instructions", listInstructions);
router13.post(
  "/instructions",
  validate({
    body: z12.object({
      text: z12.string().min(2),
      category: z12.enum(["selfie", "video", "general"]).optional(),
      isActive: z12.boolean().optional(),
      sortOrder: z12.number().optional()
    })
  }),
  createInstruction
);
router13.patch("/instructions/:id", updateInstruction);
router13.delete("/instructions/:id", deleteInstruction);
router13.get("/reports", listReports);
router13.patch(
  "/reports/:id",
  validate({
    body: z12.object({ status: z12.nativeEnum(ReportStatus), resolutionNote: z12.string().optional() })
  }),
  resolveReport
);
router13.get("/payments", listPayments);
router13.get("/transactions", listTransactions);
router13.get("/subscriptions", listSubscriptions);
router13.get("/withdrawals", listWithdrawals);
router13.patch(
  "/withdrawals/:id",
  validate({ body: z12.object({ status: z12.nativeEnum(WithdrawStatus), note: z12.string().optional() }) }),
  reviewWithdrawal
);
router13.get("/gifts", listAllGifts);
router13.post("/gifts", uploadImage.single("image"), createGift);
router13.patch("/gifts/:id", uploadImage.single("image"), updateGift);
router13.delete("/gifts/:id", deleteGift);
router13.get("/live", listAllLive);
router13.post("/live/:id/force-end", forceEndLive);
router13.get("/settings", getAdminSettings);
router13.patch("/settings", updateSettings);
router13.get("/inquiries", listInquiries);
router13.patch(
  "/inquiries/:id",
  validate({
    body: z12.object({
      adminReply: z12.string().optional(),
      adminNote: z12.string().optional(),
      status: z12.enum(["open", "in_progress", "resolved"]).optional()
    })
  }),
  replyInquiry
);
router13.delete("/inquiries/:id", deleteInquiry);
var admin_routes_default = router13;

// src/modules/settings/settings.routes.ts
import { Router as Router14 } from "express";
init_env();

// src/services/stats.service.ts
var ACTIVE_CHAT_MS = 15 * 60 * 1e3;
async function getPublicPlatformStats() {
  const since = new Date(Date.now() - ACTIVE_CHAT_MS);
  const [liveOnline, audioCalls, videoCalls, activeChats, settings] = await Promise.all([
    LiveStream.countDocuments({ status: "live" /* Live */ }),
    AudioCall.countDocuments({ status: "ongoing" /* Ongoing */ }),
    VideoCall.countDocuments({ status: "ongoing" /* Ongoing */ }),
    Conversation.countDocuments({ lastMessageAt: { $gte: since } }),
    getSettings()
  ]);
  const liveHostIds = await LiveStream.find({ status: "live" /* Live */ }).distinct("host");
  const liveOnlineHosts = liveHostIds.length ? await User.countDocuments({ _id: { $in: liveHostIds }, isOnline: true, role: "host" /* Host */ }) : 0;
  return {
    liveStreams: liveOnlineHosts,
    activeAudioCalls: audioCalls,
    activeVideoCalls: videoCalls,
    activeChats,
    landing: settings.landing ?? {
      membersLabel: "120k+",
      verifiedHostsLabel: "8k+",
      liveRoomsLabel: "24/7"
    }
  };
}

// src/modules/settings/settings.routes.ts
var router14 = Router14();
router14.get(
  "/",
  asyncHandler(async (_req, res) => {
    const s = await getSettings();
    return ok(res, {
      rates: s.rates,
      goldConversionRatio: s.goldConversionRatio,
      diamondPackages: s.diamondPackages.filter((p) => p.isActive),
      withdraw: { minGold: s.withdraw.minGold, currency: s.withdraw.currency },
      features: s.features,
      announcements: s.announcements.filter((a) => a.active),
      livekitEnabled: hasLiveKit,
      livekitUrl: getLiveKitPublicUrl()
    });
  })
);
router14.get(
  "/stats",
  asyncHandler(async (_req, res) => {
    return ok(res, await getPublicPlatformStats());
  })
);
var settings_routes_default = router14;

// src/modules/contact/contact.routes.ts
import { Router as Router15 } from "express";
import { z as z13 } from "zod";

// src/modules/contact/contact.controller.ts
var submitInquiry = asyncHandler(async (req, res) => {
  const { subject, category, message } = req.body;
  const inquiry = await ContactInquiry.create({
    user: req.user.id,
    subject,
    category,
    message
  });
  return created(res, inquiry, "Your inquiry has been submitted. We will get back to you soon.");
});
var listMyInquiries = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = { user: req.user.id };
  const [items, total] = await Promise.all([
    ContactInquiry.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    ContactInquiry.countDocuments(filter)
  ]);
  return ok(res, buildPaginated(items, page, limit, total));
});

// src/modules/contact/contact.routes.ts
var router15 = Router15();
router15.use(authenticate);
var submitSchema = z13.object({
  subject: z13.string().min(3, "Subject must be at least 3 characters").max(120),
  category: z13.enum(["general", "account", "billing", "host", "safety", "technical", "other"]),
  message: z13.string().min(10, "Message must be at least 10 characters").max(3e3)
});
router15.post("/", validate({ body: submitSchema }), submitInquiry);
router15.get("/", listMyInquiries);
var contact_routes_default = router15;

// src/routes/index.ts
var apiRouter = Router16();
apiRouter.get(
  "/",
  (_req, res) => res.json({ success: true, data: { name: "Kushlov API", version: "1.0.0" } })
);
apiRouter.use("/auth", auth_routes_default);
apiRouter.use("/users", users_routes_default);
apiRouter.use("/social", social_routes_default);
apiRouter.use("/moderation", moderation_routes_default);
apiRouter.use("/verification", verification_routes_default);
apiRouter.use("/wallet", wallet_routes_default);
apiRouter.use("/payments", payments_routes_default);
apiRouter.use("/gifts", gifts_routes_default);
apiRouter.use("/chat", chat_routes_default);
apiRouter.use("/notifications", notifications_routes_default);
apiRouter.use("/calls", calls_routes_default);
apiRouter.use("/live", live_routes_default);
apiRouter.use("/settings", settings_routes_default);
apiRouter.use("/contact", contact_routes_default);
apiRouter.use("/admin", admin_routes_default);

// src/seed/index.ts
init_env();
init_logger();
async function ensureSeed() {
  await getSettings();
  if (env.ADMIN_EMAIL && env.ADMIN_PASSWORD) {
    const existing = await User.findOne({ email: env.ADMIN_EMAIL.toLowerCase() });
    if (!existing) {
      const admin = await User.create({
        email: env.ADMIN_EMAIL.toLowerCase(),
        username: "admin",
        displayName: "Kushlov Admin",
        password: await hashPassword(env.ADMIN_PASSWORD),
        role: "admin" /* Admin */
      });
      await ensureWallet(admin._id);
      logger.info(`\u{1F451} Admin account created: ${env.ADMIN_EMAIL}`);
    }
  }
  if (await Gift.estimatedDocumentCount() === 0) {
    await Gift.insertMany([
      { name: "Rose", imageUrl: "https://cdn.kushlov.app/gifts/rose.png", diamondCost: 10, goldValue: 5, sortOrder: 1 },
      { name: "Heart", imageUrl: "https://cdn.kushlov.app/gifts/heart.png", diamondCost: 25, goldValue: 12, sortOrder: 2 },
      { name: "Teddy", imageUrl: "https://cdn.kushlov.app/gifts/teddy.png", diamondCost: 50, goldValue: 25, sortOrder: 3 },
      { name: "Crown", imageUrl: "https://cdn.kushlov.app/gifts/crown.png", diamondCost: 200, goldValue: 100, sortOrder: 4 },
      { name: "Sports Car", imageUrl: "https://cdn.kushlov.app/gifts/car.png", diamondCost: 1e3, goldValue: 500, sortOrder: 5 }
    ]);
    logger.info("\u{1F381} Seeded default gift catalog");
  }
  if (await AdminInstruction.estimatedDocumentCount() === 0) {
    await AdminInstruction.insertMany([
      { text: "Look straight into the camera", category: "selfie", sortOrder: 1 },
      { text: "Turn your head to the left", category: "selfie", sortOrder: 2 },
      { text: "Smile naturally", category: "selfie", sortOrder: 3 },
      { text: "Hold a paper with today's date and say your name", category: "video", sortOrder: 4 }
    ]);
    logger.info("\u{1F4CB} Seeded default verification instructions");
  }
}
if (process.argv[1]?.includes("seed")) {
  (async () => {
    const { connectDatabase: connectDatabase2, disconnectDatabase: disconnectDatabase2 } = await Promise.resolve().then(() => (init_db(), db_exports));
    await connectDatabase2();
    await ensureSeed();
    await disconnectDatabase2();
    process.exit(0);
  })();
}

// src/app.ts
var vercelDbReady = null;
function vercelDbMiddleware(req, _res, next) {
  if (req.method === "OPTIONS") {
    next();
    return;
  }
  if (!env.MONGODB_URI || !env.JWT_SECRET || env.JWT_SECRET === "missing") {
    next(
      new Error(
        "Server misconfigured: set MONGODB_URI, JWT_SECRET, and JWT_REFRESH_SECRET in Vercel environment variables."
      )
    );
    return;
  }
  if (!vercelDbReady) {
    vercelDbReady = (async () => {
      await connectDatabase();
      await ensureSeed();
      logger.info("Kushlov API ready (Vercel)");
    })();
  }
  vercelDbReady.then(() => next()).catch(next);
}
function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(corsMiddleware);
  app.get(
    "/health",
    (_req, res) => res.json({ success: true, data: { status: "ok", uptime: process.uptime() } })
  );
  app.get("/", (req, res) => {
    const wantsHtml = req.headers.accept?.includes("text/html");
    const frontend = env.CLIENT_URL?.replace(/\/$/, "");
    if (wantsHtml && frontend && frontend !== "http://localhost:3000") {
      return res.redirect(302, frontend);
    }
    return res.json({
      success: true,
      data: {
        name: "Kushlov API",
        version: "1.0.0",
        health: "/health",
        api: "/api",
        frontend: frontend ?? null
      }
    });
  });
  app.get("/favicon.ico", (_req, res) => res.status(204).end());
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" }
    })
  );
  if (process.env.VERCEL) {
    app.use(vercelDbMiddleware);
  }
  app.use("/api/payments/webhook", express.raw({ type: "*/*" }));
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(compression());
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === "/health" } }));
  app.use("/api", globalLimiter, apiRouter);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

// vercel-entry.ts
var vercel_entry_default = createApp();
export {
  vercel_entry_default as default
};
//# sourceMappingURL=index.js.map