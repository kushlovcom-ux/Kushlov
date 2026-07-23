/**
 * @kushlov/types
 * Shared enums, constants and DTO contracts used by both the web app and the API server.
 * Keeping them in one place prevents drift between frontend and backend.
 */

// ---------------------------------------------------------------------------
// Roles & Auth
// ---------------------------------------------------------------------------
export enum Role {
  User = 'user',
  Host = 'host',
  Admin = 'admin',
}

export enum AccountStatus {
  Active = 'active',
  Suspended = 'suspended',
  Banned = 'banned',
  Deleted = 'deleted',
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------
export enum Gender {
  Male = 'male',
  Female = 'female',
  NonBinary = 'non_binary',
  Other = 'other',
}

export enum InterestedIn {
  Men = 'men',
  Women = 'women',
  Everyone = 'everyone',
}

// ---------------------------------------------------------------------------
// Host verification
// ---------------------------------------------------------------------------
export enum VerificationStatus {
  Pending = 'pending',
  Approved = 'approved',
  Rejected = 'rejected',
  NeedMoreInfo = 'need_more_info',
}

export enum VerificationStep {
  BasicInfo = 'basic_info',
  Documents = 'documents',
  Identity = 'identity',
  Submitted = 'submitted',
}

// ---------------------------------------------------------------------------
// Wallet & Ledger
// ---------------------------------------------------------------------------
export enum Currency {
  Diamond = 'diamond', // owned by users
  Gold = 'gold', // owned by hosts
}

export enum LedgerDirection {
  Credit = 'credit',
  Debit = 'debit',
}

export enum DiamondTxnReason {
  Purchase = 'purchase',
  VideoCall = 'video_call',
  AudioCall = 'audio_call',
  LiveChat = 'live_chat',
  DirectMessage = 'direct_message',
  Gift = 'gift',
  WelcomeGift = 'welcome_gift',
  Refund = 'refund',
  AdminAdjust = 'admin_adjust',
}

export enum GoldTxnReason {
  VideoCall = 'video_call',
  AudioCall = 'audio_call',
  LiveChat = 'live_chat',
  DirectMessage = 'direct_message',
  Gift = 'gift',
  Withdraw = 'withdraw',
  AdminAdjust = 'admin_adjust',
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------
export enum PaymentStatus {
  Created = 'created',
  Pending = 'pending',
  Succeeded = 'succeeded',
  Failed = 'failed',
  Refunded = 'refunded',
}

export enum WithdrawStatus {
  Requested = 'requested',
  Approved = 'approved',
  Rejected = 'rejected',
  Paid = 'paid',
}

// ---------------------------------------------------------------------------
// Calls / Live
// ---------------------------------------------------------------------------
export enum CallType {
  Audio = 'audio',
  Video = 'video',
}

export enum CallStatus {
  Ringing = 'ringing',
  Ongoing = 'ongoing',
  Ended = 'ended',
  Missed = 'missed',
  Rejected = 'rejected',
  Failed = 'failed',
}

export enum LiveStatus {
  Live = 'live',
  Ended = 'ended',
  Scheduled = 'scheduled',
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------
export enum MessageType {
  Text = 'text',
  Image = 'image',
  Video = 'video',
  Voice = 'voice',
  Gift = 'gift',
  System = 'system',
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
export enum NotificationType {
  Message = 'message',
  Call = 'call',
  Match = 'match',
  Like = 'like',
  Follower = 'follower',
  LiveStarted = 'live_started',
  Gift = 'gift',
  Payment = 'payment',
  Announcement = 'announcement',
  Verification = 'verification',
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------
export enum ReportStatus {
  Open = 'open',
  Reviewing = 'reviewing',
  Resolved = 'resolved',
  Dismissed = 'dismissed',
}

// ---------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------
export enum MediaType {
  Image = 'image',
  Video = 'video',
  Audio = 'audio',
}

export interface MediaAsset {
  url: string;
  publicId: string;
  type: MediaType;
  width?: number;
  height?: number;
  durationSec?: number;
  bytes?: number;
  format?: string;
}

// ---------------------------------------------------------------------------
// Generic API envelopes
// ---------------------------------------------------------------------------
export interface ApiSuccess<T> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiError {
  success: false;
  message: string;
  code?: string;
  errors?: Record<string, string[]>;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// ---------------------------------------------------------------------------
// Public user shape returned by the API (never leak password/hashes)
// ---------------------------------------------------------------------------
export interface PublicUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
  role: Role;
  status: AccountStatus;
  avatarUrl?: string;
  coverUrl?: string;
  bio?: string;
  gender?: Gender;
  country?: string;
  isHostApproved?: boolean;
  isOnline?: boolean;
  /** True when the user is on an ongoing audio/video call. */
  isBusy?: boolean;
  averageRating?: number;
  totalReviews?: number;
  /** Host pricing in gold (admin-set). Converted to diamonds at billing. */
  videoPrice?: number;
  audioPrice?: number;
  messagePrice?: number;
  isPopularHost?: boolean;
  popularSortOrder?: number;
  lastSeenAt?: string;
  createdAt: string;
}

export interface HostReview {
  id: string;
  hostId: string;
  rating: number;
  text: string;
  createdAt: string;
  updatedAt: string;
  reviewer: {
    id: string;
    displayName: string;
    username: string;
    avatarUrl?: string;
    emailVerified?: boolean;
  };
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

// ---------------------------------------------------------------------------
// Socket event names (shared contract between client and server)
// ---------------------------------------------------------------------------
export const SocketEvents = {
  Connected: 'connected',
  // presence
  PresenceOnline: 'presence:online',
  PresenceOffline: 'presence:offline',
  // chat
  MessageSend: 'message:send',
  MessageNew: 'message:new',
  MessageRead: 'message:read',
  MessageDelete: 'message:delete',
  TypingStart: 'typing:start',
  TypingStop: 'typing:stop',
  // calls
  CallInvite: 'call:invite',
  CallAccept: 'call:accept',
  CallReject: 'call:reject',
  CallEnd: 'call:end',
  CallParticipantJoined: 'call:participant_joined',
  // live
  LiveJoin: 'live:join',
  LiveLeave: 'live:leave',
  LiveChat: 'live:chat',
  LiveGift: 'live:gift',
  LiveViewerCount: 'live:viewer_count',
  LiveColiveInvite: 'live:colive_invite',
  LiveColiveAccept: 'live:colive_accept',
  LiveColiveLeave: 'live:colive_leave',
  // notifications
  Notification: 'notification:new',
} as const;

export type SocketEventName = (typeof SocketEvents)[keyof typeof SocketEvents];

// ---------------------------------------------------------------------------
// Video call face masks
// ---------------------------------------------------------------------------
export {
  FACE_MASK_ATTR,
  FACE_MASKS,
  getFaceMask,
  isFaceMaskId,
  type FaceMaskDef,
  type FaceMaskId,
} from './face-masks';
