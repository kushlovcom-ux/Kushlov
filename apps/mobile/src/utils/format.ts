import { format, formatDistanceToNow, isToday, isYesterday, parseISO } from 'date-fns';

export function formatMoney(amount: number, currency = 'INR'): string {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `₹${amount}`;
  }
}

export function formatDiamonds(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function formatCount(n: number): string {
  return formatDiamonds(n);
}

export function formatDateTime(value: string | Date): string {
  try {
    return format(parseDate(value), 'dd MMM yyyy, HH:mm');
  } catch {
    return '';
  }
}

export function formatDuration(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  return `${m}:${String(r).padStart(2, '0')}`;
}

export function parseDate(value: string | Date): Date {
  return typeof value === 'string' ? parseISO(value) : value;
}

export function formatRelative(value: string | Date): string {
  try {
    return formatDistanceToNow(parseDate(value), { addSuffix: true });
  } catch {
    return '';
  }
}

export function formatMessageTime(value: string | Date): string {
  try {
    const d = parseDate(value);
    if (isToday(d)) return format(d, 'HH:mm');
    if (isYesterday(d)) return `Yesterday ${format(d, 'HH:mm')}`;
    return format(d, 'dd MMM, HH:mm');
  } catch {
    return '';
  }
}

export function formatChatListTime(value: string | Date): string {
  try {
    const d = parseDate(value);
    if (isToday(d)) return format(d, 'HH:mm');
    if (isYesterday(d)) return 'Yesterday';
    return format(d, 'dd/MM/yy');
  } catch {
    return '';
  }
}

export function displayName(user?: { displayName?: string; username?: string } | null): string {
  if (!user) return 'User';
  return user.displayName || user.username || 'User';
}

export function initials(name?: string): string {
  if (!name?.trim()) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}
