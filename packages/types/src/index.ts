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

/** Admin panel sections a subadmin can be granted. Full admins always have all of them. */
export enum AdminSection {
  Dashboard = 'dashboard',
  Users = 'users',
  Hosts = 'hosts',
  Reviews = 'reviews',
  Online = 'online',
  Live = 'live',
  Verifications = 'verifications',
  Reports = 'reports',
  Payments = 'payments',
  Revenue = 'revenue',
  Diamonds = 'diamonds',
  Withdrawals = 'withdrawals',
  Gifts = 'gifts',
  Inquiries = 'inquiries',
  Settings = 'settings',
}

export const ADMIN_SECTION_OPTIONS: ReadonlyArray<{
  id: AdminSection;
  label: string;
  href: string;
}> = [
  { id: AdminSection.Dashboard, label: 'Dashboard', href: '/admin' },
  { id: AdminSection.Users, label: 'Users', href: '/admin/users' },
  { id: AdminSection.Hosts, label: 'Host Pricing', href: '/admin/hosts' },
  { id: AdminSection.Reviews, label: 'Reviews', href: '/admin/reviews' },
  { id: AdminSection.Online, label: 'Online now', href: '/admin/online' },
  { id: AdminSection.Live, label: 'Live now', href: '/admin/live' },
  { id: AdminSection.Verifications, label: 'Host Verifications', href: '/admin/verifications' },
  { id: AdminSection.Reports, label: 'Reports', href: '/admin/reports' },
  { id: AdminSection.Payments, label: 'Payments', href: '/admin/payments' },
  { id: AdminSection.Revenue, label: 'Revenue', href: '/admin/revenue' },
  { id: AdminSection.Diamonds, label: 'Send diamonds', href: '/admin/diamonds' },
  { id: AdminSection.Withdrawals, label: 'Withdrawals', href: '/admin/withdrawals' },
  { id: AdminSection.Gifts, label: 'Gifts', href: '/admin/gifts' },
  { id: AdminSection.Inquiries, label: 'Inquiries', href: '/admin/inquiries' },
  { id: AdminSection.Settings, label: 'Settings', href: '/admin/settings' },
];

export function uniqueAdminSections(sections: readonly string[]): AdminSection[] {
  const allowed = new Set<string>(Object.values(AdminSection));
  const out: AdminSection[] = [];
  const seen = new Set<string>();
  for (const raw of sections) {
    if (!allowed.has(raw) || seen.has(raw)) continue;
    seen.add(raw);
    out.push(raw as AdminSection);
  }
  return out;
}

export function isAdminStaff(
  user?: { role?: Role | string; isSubadmin?: boolean } | null,
): boolean {
  if (!user) return false;
  return user.role === Role.Admin || Boolean(user.isSubadmin);
}

export function hasAdminSection(
  user:
    | { role?: Role | string; isSubadmin?: boolean; adminSections?: AdminSection[] }
    | null
    | undefined,
  section: AdminSection,
): boolean {
  if (!user) return false;
  if (user.role === Role.Admin) return true;
  return Boolean(user.isSubadmin && user.adminSections?.includes(section));
}

export function adminSectionForPath(pathname: string): AdminSection | null {
  const path = pathname.split('?')[0].replace(/\/+$/, '') || '/';
  if (path === '/admin') return AdminSection.Dashboard;
  let match: AdminSection | null = null;
  let matchLen = 0;
  for (const opt of ADMIN_SECTION_OPTIONS) {
    if (opt.href === '/admin') continue;
    if (path === opt.href || path.startsWith(`${opt.href}/`)) {
      if (opt.href.length > matchLen) {
        matchLen = opt.href.length;
        match = opt.id;
      }
    }
  }
  return match;
}

export type AdminApiGate = AdminSection | 'staff';

/** Map an `/api/admin/...` remainder path (e.g. `/users/123`) to a section gate. */
export function adminSectionForApiPath(path: string): AdminApiGate | null {
  const seg = path.split('/').filter(Boolean)[0];
  switch (seg) {
    case 'badges':
      return 'staff';
    case 'analytics':
      return AdminSection.Dashboard;
    case 'users':
      return AdminSection.Users;
    case 'online':
      return AdminSection.Online;
    case 'verifications':
    case 'instructions':
      return AdminSection.Verifications;
    case 'reports':
      return AdminSection.Reports;
    case 'payments':
    case 'transactions':
    case 'subscriptions':
      return AdminSection.Payments;
    case 'diamonds':
      return AdminSection.Diamonds;
    case 'withdrawals':
      return AdminSection.Withdrawals;
    case 'gifts':
      return AdminSection.Gifts;
    case 'live':
      return AdminSection.Live;
    case 'settings':
    case 'config':
      return AdminSection.Settings;
    case 'hosts':
      return AdminSection.Hosts;
    case 'reviews':
      return AdminSection.Reviews;
    case 'inquiries':
      return AdminSection.Inquiries;
    default:
      return null;
  }
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
  File = 'file',
  Gift = 'gift',
  System = 'system',
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
export enum NotificationType {
  Message = 'message',
  Call = 'call',
  MissedCall = 'missed_call',
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
  /** Documents and anything else Cloudinary stores untranscoded. */
  Raw = 'raw',
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
  /** Original upload name, so documents can be listed by their real filename. */
  fileName?: string;
  mimeType?: string;
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
  /** True when a full admin granted limited admin-panel access. Role stays user/host. */
  isSubadmin?: boolean;
  adminSections?: AdminSection[];
  lastSeenAt?: string;
  createdAt: string;
}

export interface HostReview {
  id: string;
  hostId: string;
  rating: number;
  text?: string;
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
  ChatFocus: 'chat:focus',
  ChatBlur: 'chat:blur',
  // calls
  CallInvite: 'call:invite',
  CallWaiting: 'call:waiting',
  CallAccept: 'call:accept',
  CallReject: 'call:reject',
  CallEnd: 'call:end',
  CallHold: 'call:hold',
  CallUnhold: 'call:unhold',
  CallParticipantJoined: 'call:participant_joined',
  CallParticipantLeft: 'call:participant_left',
  // live
  LiveJoin: 'live:join',
  LiveLeave: 'live:leave',
  LiveChat: 'live:chat',
  LiveGift: 'live:gift',
  LiveLike: 'live:like',
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
} from './face-masks.js';
