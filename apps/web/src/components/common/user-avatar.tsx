import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn, initials } from '@/lib/utils';

interface Props {
  name?: string;
  src?: string;
  online?: boolean;
  className?: string;
}

export function UserAvatar({ name, src, online, className }: Props) {
  return (
    <div className="relative inline-block">
      <Avatar className={className}>
        {src && <AvatarImage src={src} alt={name} />}
        <AvatarFallback>{initials(name)}</AvatarFallback>
      </Avatar>
      {online !== undefined && (
        <span
          className={cn(
            'absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background',
            online ? 'bg-emerald-400' : 'bg-white/30',
          )}
        />
      )}
    </div>
  );
}
