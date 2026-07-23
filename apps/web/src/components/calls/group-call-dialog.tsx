'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PhoneCall, Users, Video } from 'lucide-react';
import { toast } from 'sonner';
import { CallType, type Paginated, type PublicUser } from '@kushlov/types';
import { api, unwrap } from '@/lib/api';
import { startCall } from '@/lib/start-call';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UserAvatar } from '@/components/common/user-avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const MAX = 5; // callee + up to 4 extras → 6 with caller

/** Multi-select picker to start a group audio/video call (1B). */
export function GroupCallDialog() {
  const me = useAuthStore((s) => s.user);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<PublicUser[]>([]);

  const discover = useQuery({
    queryKey: ['group-call-users', q],
    queryFn: () =>
      unwrap<Paginated<PublicUser>>(
        api.get('/users', { params: { q: q || undefined, limit: 24, online: true } }),
      ),
    enabled: open,
    staleTime: 15_000,
  });

  const selectedIds = useMemo(() => new Set(selected.map((u) => u.id)), [selected]);

  const toggle = (u: PublicUser) => {
    if (u.id === me?.id) return;
    setSelected((prev) => {
      if (prev.some((p) => p.id === u.id)) return prev.filter((p) => p.id !== u.id);
      if (prev.length >= MAX) {
        toast.message(`Pick up to ${MAX} people`);
        return prev;
      }
      return [...prev, u];
    });
  };

  const start = (type: CallType) => {
    if (selected.length === 0) {
      toast.error('Select at least one person');
      return;
    }
    const [primary, ...rest] = selected;
    startCall(type, primary.id, primary.displayName, {
      peerIsHost: primary.role === 'host' && primary.isHostApproved !== false,
      peerRole: primary.role,
      peerHostApproved: primary.isHostApproved,
      participantIds: rest.map((u) => u.id),
    });
    setOpen(false);
    setSelected([]);
    toast.success(`Starting ${type} call with ${selected.length} people…`);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          <Users className="h-4 w-4" /> Group call
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Start a group call</DialogTitle>
        </DialogHeader>
        <Input
          placeholder="Search online users…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <p className="text-xs text-white/45">
          Selected {selected.length}/{MAX}. Everyone will be invited into one conference.
        </p>
        <ul className="max-h-64 space-y-1 overflow-y-auto">
          {(discover.data?.items ?? [])
            .filter((u) => u.id !== me?.id)
            .map((u) => {
              const on = selectedIds.has(u.id);
              return (
                <li key={u.id}>
                  <button
                    type="button"
                    onClick={() => toggle(u)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors',
                      on ? 'bg-brand-pink/20' : 'hover:bg-white/5',
                    )}
                  >
                    <UserAvatar name={u.displayName} src={u.avatarUrl} className="h-8 w-8" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {u.displayName}
                    </span>
                    <span className="text-xs text-white/40">{on ? '✓' : ''}</span>
                  </button>
                </li>
              );
            })}
        </ul>
        <div className="flex gap-2">
          <Button
            className="flex-1"
            variant="secondary"
            disabled={selected.length === 0}
            onClick={() => start(CallType.Audio)}
          >
            <PhoneCall className="h-4 w-4" /> Audio
          </Button>
          <Button
            className="flex-1"
            disabled={selected.length === 0}
            onClick={() => start(CallType.Video)}
          >
            <Video className="h-4 w-4" /> Video
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
