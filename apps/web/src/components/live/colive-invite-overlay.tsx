'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Radio } from 'lucide-react';
import { toast } from 'sonner';
import { SocketEvents } from '@kushlov/types';
import { api, apiError } from '@/lib/api';
import { useSocket } from '@/components/socket-provider';
import { Button } from '@/components/ui/button';

type ColiveInvite = {
  liveId: string;
  title?: string;
  from?: { displayName?: string; id?: string };
};

/**
 * Global co-live Accept/Decline — works even when the invitee is not on a live page.
 */
export function ColiveInviteOverlay() {
  const { socket } = useSocket();
  const router = useRouter();
  const [invite, setInvite] = useState<ColiveInvite | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!socket) return;
    const onInvite = (p: ColiveInvite) => {
      if (!p?.liveId) return;
      setInvite(p);
      toast('Co-live invite', {
        description: `${p.from?.displayName ?? 'A host'} invited you to join “${p.title ?? 'their stream'}”`,
      });
    };
    socket.on(SocketEvents.LiveColiveInvite, onInvite);
    return () => {
      socket.off(SocketEvents.LiveColiveInvite, onInvite);
    };
  }, [socket]);

  const decline = () => setInvite(null);

  const accept = async () => {
    if (!invite) return;
    setBusy(true);
    try {
      await api.post(`/live/${invite.liveId}/colive/accept`);
      toast.success('Joined as co-host');
      const liveId = invite.liveId;
      setInvite(null);
      router.push(`/live/${liveId}`);
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  if (!invite) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-card p-6 text-center shadow-xl">
        <Radio className="mx-auto h-8 w-8 text-brand-pink" />
        <p className="mt-3 text-lg font-semibold">Co-live invite</p>
        <p className="mt-1 text-sm text-white/60">
          {invite.from?.displayName ?? 'A host'} invited you to join “{invite.title ?? 'their stream'}”
        </p>
        <div className="mt-5 flex justify-center gap-3">
          <Button variant="secondary" disabled={busy} onClick={decline}>
            Decline
          </Button>
          <Button disabled={busy} onClick={() => void accept()}>
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}
