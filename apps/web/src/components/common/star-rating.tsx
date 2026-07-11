'use client';

import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

export function StarRatingDisplay({
  rating,
  count,
  className,
  size = 'sm',
}: {
  rating: number;
  count?: number;
  className?: string;
  size?: 'sm' | 'md';
}) {
  const starClass = size === 'md' ? 'h-4 w-4' : 'h-3 w-3';
  const value = Math.max(0, Math.min(5, rating || 0));

  return (
    <div className={cn('flex flex-wrap items-center gap-1', className)}>
      <div className="flex items-center gap-0.5" aria-label={`${value.toFixed(1)} out of 5 stars`}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={cn(
              starClass,
              i < Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-white/25',
            )}
          />
        ))}
      </div>
      <span className={cn('font-medium text-amber-300', size === 'md' ? 'text-sm' : 'text-xs')}>
        {value > 0 ? value.toFixed(1) : '—'} ★
      </span>
      {count != null && (
        <span className={cn('text-white/45', size === 'md' ? 'text-xs' : 'text-[10px]')}>
          ({count} {count === 1 ? 'Review' : 'Reviews'})
        </span>
      )}
    </div>
  );
}

export function StarRatingInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: 5 }).map((_, i) => {
        const n = i + 1;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className="rounded-md p-1 transition hover:scale-110"
            aria-label={`${n} stars`}
          >
            <Star
              className={cn(
                'h-7 w-7',
                n <= value ? 'fill-amber-400 text-amber-400' : 'text-white/25',
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
