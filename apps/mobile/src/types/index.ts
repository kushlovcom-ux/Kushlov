/**
 * Shared enums, constants and DTO contracts for the Kushlov mobile app.
 */

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

export enum Currency {
  Diamond = 'diamond',
  Gold = 'gold',
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

export enum MessageType {
  Text = 'text',
  Image = 'image',
  Video = 'video',
  Voice = 'voice',
  Gift = 'gift',
  System = 'system',
}

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

export enum ReportStatus {
  Open = 'open',
  Reviewing = 'reviewing',
  Resolved = 'resolved',
  Dismissed = 'dismissed',
}

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

export interface ApiSuccess<T> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiErrorBody {
  success: false;
  message: string;
  code?: string;
  errors?: Record<string, string[]>;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiErrorBody;

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

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
  isBusy?: boolean;
  averageRating?: number;
  totalReviews?: number;
  videoPrice?: number;
  audioPrice?: number;
  messagePrice?: number;
  isPopularHost?: boolean;
  popularSortOrder?: number;
  lastSeenAt?: string;
  createdAt: string;
  distanceKm?: number;
  gallery?: MediaAsset[];
  interestedIn?: InterestedIn;
  dob?: string;
  languages?: string[];
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

export interface AuthPayload {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}

export interface UserProfile {
  bio?: string;
  gender?: Gender;
  interestedIn?: InterestedIn;
  dob?: string;
  languages?: string[];
  gallery?: MediaAsset[];
  heightCm?: number;
  occupation?: string;
  education?: string;
  lookingFor?: string;
}

export interface UserLocation {
  lat: number;
  lng: number;
  city?: string;
  country?: string;
  updatedAt?: string;
}

export interface Conversation {
  id: string;
  participants: PublicUser[];
  lastMessage?: ChatMessage;
  unreadCount?: number;
  updatedAt: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  type: MessageType;
  text?: string;
  media?: MediaAsset;
  giftId?: string;
  createdAt: string;
  readAt?: string;
  deletedAt?: string;
}

export interface CallSession {
  id: string;
  type: CallType;
  status: CallStatus;
  callerId: string;
  calleeId: string;
  caller?: PublicUser;
  callee?: PublicUser;
  roomName?: string;
  token?: string;
  livekitUrl?: string;
  startedAt?: string;
  endedAt?: string;
  createdAt: string;
  durationSec?: number;
  costDiamonds?: number;
}

export interface LiveRoom {
  id: string;
  title: string;
  status: LiveStatus;
  hostId: string;
  host?: PublicUser;
  thumbnailUrl?: string;
  viewerCount?: number;
  likeCount?: number;
  roomName?: string;
  token?: string;
  livekitUrl?: string;
  startedAt?: string;
  endedAt?: string;
  createdAt: string;
}

export interface WalletBalance {
  diamonds: number;
  gold: number;
}

export interface LedgerEntry {
  id: string;
  amount: number;
  direction: LedgerDirection;
  reason: string;
  balanceAfter: number;
  meta?: Record<string, unknown>;
  createdAt: string;
}

export interface DiamondPackage {
  id: string;
  name: string;
  diamonds: number;
  bonusDiamonds?: number;
  priceInr: number;
  currency?: string;
  isActive?: boolean;
  popular?: boolean;
}

export interface PaymentOrder {
  id: string;
  packageId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  providerOrderId?: string;
  razorpayKeyId?: string;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  readAt?: string;
  createdAt: string;
}

export interface GiftItem {
  id: string;
  name: string;
  diamondCost: number;
  imageUrl?: string;
  animationUrl?: string;
  isActive?: boolean;
}

export interface PlatformSettings {
  rates: Record<string, unknown>;
  diamondConversions: Record<string, unknown>;
  goldConversionRatio: number;
  diamondPackages: DiamondPackage[];
  withdraw: { minGold: number; currency: string };
  features: Record<string, boolean>;
  announcements: Array<{ id?: string; text: string; active: boolean }>;
  livekitEnabled: boolean;
  livekitUrl?: string;
}

export interface PlatformStats {
  onlineUsers?: number;
  liveStreams?: number;
  totalHosts?: number;
  totalUsers?: number;
  [key: string]: unknown;
}

export interface NavBadges {
  unreadMessages?: number;
  unreadNotifications?: number;
  incomingCalls?: number;
  likes?: number;
  matches?: number;
}

export const SocketEvents = {
  Connected: 'connected',
  PresenceOnline: 'presence:online',
  PresenceOffline: 'presence:offline',
  MessageSend: 'message:send',
  MessageNew: 'message:new',
  MessageRead: 'message:read',
  MessageDelete: 'message:delete',
  TypingStart: 'typing:start',
  TypingStop: 'typing:stop',
  CallInvite: 'call:invite',
  CallAccept: 'call:accept',
  CallReject: 'call:reject',
  CallEnd: 'call:end',
  LiveJoin: 'live:join',
  LiveLeave: 'live:leave',
  LiveChat: 'live:chat',
  LiveGift: 'live:gift',
  LiveViewerCount: 'live:viewer_count',
  Notification: 'notification:new',
} as const;

export type SocketEventName = (typeof SocketEvents)[keyof typeof SocketEvents];

/** API-layer aliases */
export type Message = ChatMessage;
export type NotificationItem = AppNotification;
export type LiveStream = LiveRoom;
