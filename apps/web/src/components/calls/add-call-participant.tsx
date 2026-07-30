'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PhoneForwarded, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { CallType } from '@kushlov/types';
import { api, apiError, unwrap } from '@/lib/api';
import { startCall } from '@/lib/start-call';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UserAvatar } from '@/components/common/user-avatar';
import { cn } from '@/lib/utils';

type DiscoverUser = {
  _id?: string;
  id?: string;
  displayName?: string;
  username?: string;
  avatarUrl?: string;
  isOnline?: boolean;
  role?: string;
  isHostApproved?: boolean;
};

/**
 * Invite another user into an ongoing call, or start a consult (hold current + call).
 */
export function AddCallParticipant({
  callId,
  type,
  compact = false,
  className,
  mode = 'invite',
}: {
  callId: string;
  type: CallType;
  compact?: boolean;
  className?: string;
  /** invite = same-room add; consult = hold current call and ring someone else */
  mode?: 'invite' | 'consult';
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const isConsult = mode === 'consult';

  const discover = useQuery({
    queryKey: ['call-invite-users', q],
    queryFn: () =>
      unwrap<{ items: DiscoverUser[] }>(
        api.get('/users', { params: { q: q || undefined, limit: 8, online: true } }),
      ),
    enabled: open,
    staleTime: 15_000,
  });

  const pick = async (user: DiscoverUser) => {
    const userId = String(user.id ?? user._id ?? '');
    if (!userId) return;
    if (isConsult) {
      startCall(type, userId, user.displayName ?? user.username ?? 'User', {
        fromCallId: callId,
        peerRole: user.role,
        peerHostApproved: user.isHostApproved,
      });
      setOpen(false);
      return;
    }
    try {
      await api.post(`/calls/${type}/${callId}/invite`, { userId });
      toast.success('Invite sent');
      setOpen(false);
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  return (
    <div className={cn('relative', compact ? '' : 'w-full', className)}>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className={cn(
          compact
            ? 'h-9 gap-1.5 rounded-full border border-white/10 bg-white/10 px-3 text-xs hover:bg-white/15'
            : 'mx-auto flex',
        )}
        onClick={() => setOpen((v) => !v)}
      >
        {isConsult ? (
          <PhoneForwarded className="h-3.5 w-3.5" />
        ) : (
          <UserPlus className="h-3.5 w-3.5" />
        )}
        <span className={compact ? 'hidden sm:inline' : undefined}>
          {isConsult ? 'Call another' : 'Add person'}
        </span>
      </Button>
      {open ? (
        <div
          className={cn(
            'z-40 max-h-48 overflow-y-auto rounded-xl border border-white/10 bg-zinc-900/95 p-2 shadow-xl backdrop-blur',
            compact ? 'absolute bottom-full left-0 mb-2 w-64' : 'mt-2',
          )}
        >
          <p className="mb-2 px-1 text-[10px] uppercase tracking-wide text-white/40">
            {isConsult ? 'Hold current & call' : 'Add to this call'}
          </p>
          <Input
            placeholder="Search online users…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="mb-2"
          />
          {(discover.data?.items ?? []).map((u) => {
            const id = u.id ?? u._id ?? '';
            return (
              <button
                key={id}
                type="button"
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-white/10"
                onClick={() => void pick(u)}
              >
                <UserAvatar name={u.displayName} src={u.avatarUrl} className="h-7 w-7" />
                <span className="truncate">{u.displayName ?? u.username}</span>
              </button>
            );
          })}
          {!discover.isLoading && (discover.data?.items?.length ?? 0) === 0 ? (
            <p className="px-2 py-3 text-center text-xs text-white/40">No users found</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
