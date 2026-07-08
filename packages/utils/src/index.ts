/**
 * @kushlov/utils
 * Framework-agnostic helpers shared between the web app and the API server.
 */
import { Paginated } from '@kushlov/types';

/** Clamp a number between a min and max. */
export const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

/** Build a standard paginated payload from a slice of results. */
export const buildPaginated = <T>(
  items: T[],
  page: number,
  limit: number,
  total: number,
): Paginated<T> => {
  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
  return {
    items,
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
};

/** Normalize pagination query params into safe integers. */
export const parsePagination = (
  query: { page?: unknown; limit?: unknown },
  { defaultLimit = 20, maxLimit = 100 } = {},
): { page: number; limit: number; skip: number } => {
  const page = Math.max(1, Number.parseInt(String(query.page ?? '1'), 10) || 1);
  const limit = clamp(
    Number.parseInt(String(query.limit ?? defaultLimit), 10) || defaultLimit,
    1,
    maxLimit,
  );
  return { page, limit, skip: (page - 1) * limit };
};

/** Compute age in whole years from a date of birth. */
export const calculateAge = (dob: Date | string): number => {
  const birth = new Date(dob);
  const diff = Date.now() - birth.getTime();
  return Math.abs(new Date(diff).getUTCFullYear() - 1970);
};

/** Convert diamonds spent to gold earned by a host using a conversion ratio. */
export const diamondsToGold = (diamonds: number, ratio: number): number =>
  Math.floor(diamonds * ratio);

/** Slugify a string into a URL/username-safe token. */
export const slugify = (input: string): string =>
  input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

/** Simple sleep helper for retries/backoff. */
export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Mask an email for display: jo***@example.com */
export const maskEmail = (email: string): string => {
  const [name, domain] = email.split('@');
  if (!domain) return email;
  const visible = name.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(1, name.length - 2))}@${domain}`;
};

/** Format an amount of currency for display. */
export const formatCurrency = (value: number, currency = 'USD'): string =>
  new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    style: 'currency',
    currency,
  }).format(value);

/** India → INR (₹), all other countries → USD ($). */
export const getCurrencyForCountry = (country?: string | null): 'INR' | 'USD' =>
  country?.trim() === 'India' ? 'INR' : 'USD';

/** Format money using the user's country to pick ₹ vs $. */
export const formatMoney = (value: number, country?: string | null): string =>
  formatCurrency(value, getCurrencyForCountry(country));

export interface PricedPackage {
  price?: number;
  priceUsd?: number;
  priceInr?: number;
  currency?: string;
}

/** Resolve package price + currency for a user's country. */
export const getPackagePriceForCountry = (
  pkg: PricedPackage,
  country?: string | null,
): { amount: number; currency: 'INR' | 'USD' } => {
  const currency = getCurrencyForCountry(country);
  if (currency === 'INR') {
    return { amount: pkg.priceInr ?? pkg.price ?? 0, currency: 'INR' };
  }
  return { amount: pkg.priceUsd ?? pkg.price ?? 0, currency: 'USD' };
};

export { COUNTRIES, DEFAULT_COUNTRY } from './countries';
export type { CountryName } from './countries';

/** Format a compact number, e.g. 12.3K, 1.2M. */
export const formatCompact = (value: number): string =>
  new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);

/** Format seconds into mm:ss (or hh:mm:ss) for call timers. */
export const formatDuration = (totalSeconds: number): string => {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
};

/** Compute great-circle distance in km between two lat/lng points. */
export const haversineKm = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/** Format distance for display, e.g. "1.2 km" or "850 m". */
export const formatDistanceKm = (km: number): string => {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
};

export const DEFAULT_DISCOVERY_RADIUS_KM = 20; // local exclusion zone (km)

/** Deterministic LiveKit room name prefix for a 1:1 call between two user ids. */
export const directRoomName = (userIdA: string, userIdB: string): string =>
  ['call', ...[userIdA, userIdB].sort()].join('_');
