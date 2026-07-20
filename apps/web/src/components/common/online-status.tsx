import { cn } from '@/lib/utils';

/** Online / Busy / Offline presence label for discover cards. */
export function OnlineStatus({
  online,
  busy,
  className,
  size = 'sm',
}: {
  online?: boolean;
  busy?: boolean;
  className?: string;
  size?: 'sm' | 'md';
}) {
  const isBusy = Boolean(busy);
  const isOn = Boolean(online) && !isBusy;

  const label = isBusy ? 'Busy' : isOn ? 'Online' : 'Offline';
  const color = isBusy ? 'text-amber-400' : isOn ? 'text-emerald-400' : 'text-white/45';
  const dot = isBusy
    ? 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.7)]'
    : isOn
      ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]'
      : 'bg-white/35';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-medium',
        size === 'md' ? 'text-sm' : 'text-[11px]',
        color,
        className,
      )}
    >
      <span
        className={cn('rounded-full', size === 'md' ? 'h-2.5 w-2.5' : 'h-2 w-2', dot)}
      />
      {label}
    </span>
  );
}
