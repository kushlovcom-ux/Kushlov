'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { CallType } from '@kushlov/types';
import { api, apiError, unwrap } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UserAvatar } from '@/components/common/user-avatar';

type DiscoverUser = {
  _id?: string;
  id?: string;
  displayName?: string;
  username?: string;
  avatarUrl?: string;
  isOnline?: boolean;
};

/** Invite another user into an ongoing call (1A). */
export function AddCallParticipant({
  callId,
  type,
}: {
  callId: string;
  type: CallType;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');

  const discover = useQuery({
    queryKey: ['call-invite-users', q],
    queryFn: () =>
      unwrap<{ items: DiscoverUser[] }>(
          api.get('/users', { params: { q: q || undefined, limit: 8, online: true } }),
      ),
    enabled: open,
    staleTime: 15_000,
  });

  const invite = async (userId: string) => {
    try {
      await api.post(`/calls/${type}/${callId}/invite`, { userId });
      toast.success('Invite sent');
      setOpen(false);
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  return (
    <div className="w-full">
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="mx-auto flex"
        onClick={() => setOpen((v) => !v)}
      >
        <UserPlus className="h-4 w-4" /> Add person
      </Button>
      {open ? (
        <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-white/10 bg-black/40 p-2">
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
                onClick={() => void invite(String(id))}
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
