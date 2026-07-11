import { cn } from '@/lib/utils';

/** Green online / muted offline status with text. */
export function OnlineStatus({
  online,
  className,
  size = 'sm',
}: {
  online?: boolean;
  className?: string;
  size?: 'sm' | 'md';
}) {
  const isOn = Boolean(online);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-medium',
        size === 'md' ? 'text-sm' : 'text-[11px]',
        isOn ? 'text-emerald-400' : 'text-white/45',
        className,
      )}
    >
      <span
        className={cn(
          'rounded-full',
          size === 'md' ? 'h-2.5 w-2.5' : 'h-2 w-2',
          isOn ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]' : 'bg-white/35',
        )}
      />
      {isOn ? 'Online' : 'Offline'}
    </span>
  );
}
