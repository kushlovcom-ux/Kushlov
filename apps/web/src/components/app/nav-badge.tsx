'use client';

import { cn } from '@/lib/utils';

/** Small unread-count pill for nav items. */
export function NavBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  const label = count > 99 ? '99+' : String(count);
  return (
    <span
      className={cn(
        'inline-flex min-w-[1.125rem] items-center justify-center rounded-full bg-brand-pink px-1 text-[10px] font-bold leading-4 text-white',
        className,
      )}
      aria-label={`${label} unread`}
    >
      {label}
    </span>
  );
}
