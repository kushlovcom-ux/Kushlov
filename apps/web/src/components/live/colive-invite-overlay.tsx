'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Radio } from 'lucide-react';
import { toast } from 'sonner';
import { SocketEvents } from '@kushlov/types';
import { api, apiError, unwrap } from '@/lib/api';
import { storeColiveHandoff } from '@/lib/colive-handoff';
import { useSocket } from '@/components/socket-provider';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/common/user-avatar';

type ColiveInvite = {
  liveId: string;
  title?: string;
  roomName?: string;
  from?: { displayName?: string; id?: string; avatarUrl?: string };
};

/**
 * Global co-live Accept/Decline — socket + HTTP poll so invites still appear
 * while the invitee is mid-live (and when sockets miss the event).
 */
export function ColiveInviteOverlay() {
  const { socket, connected } = useSocket();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [invite, setInvite] = useState<ColiveInvite | null>(null);
  const [busy, setBusy] = useState(false);
  const inviteRef = useRef<ColiveInvite | null>(null);
  const seenToastRef = useRef<string | null>(null);

  useEffect(() => {
    inviteRef.current = invite;
  }, [invite]);

  const showInvite = useCallback((p: ColiveInvite, fromPoll = false) => {
    if (!p?.liveId) return;
    setInvite((prev) => {
      if (prev?.liveId === p.liveId) return prev;
      return p;
    });
    if (seenToastRef.current !== p.liveId) {
      seenToastRef.current = p.liveId;
      toast('Co-live invite', {
        description: `${p.from?.displayName ?? 'A host'} invited you to join “${p.title ?? 'their stream'}”`,
        duration: fromPoll ? 4_000 : 6_000,
      });
    }
  }, []);

  useEffect(() => {
    if (!socket) return;
    const onInvite = (p: ColiveInvite) => showInvite(p, false);
    socket.on(SocketEvents.LiveColiveInvite, onInvite);
    return () => {
      socket.off(SocketEvents.LiveColiveInvite, onInvite);
    };
  }, [socket, showInvite]);

  // HTTP fallback — same pattern as call waiting (works when sockets are down/missed).
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const data = await unwrap<{ items: ColiveInvite[] }>(api.get('/live/colive/incoming'));
        if (cancelled) return;
        const next = data.items?.[0];
        if (next?.liveId) {
          showInvite(next, true);
        } else if (inviteRef.current) {
          // Invite cleared server-side (accepted elsewhere / expired / rejected).
          setInvite(null);
          seenToastRef.current = null;
        }
      } catch {
        /* ignore transient poll errors */
      }
    };

    void poll();
    const ms = connected ? 2_500 : 1_200;
    const id = window.setInterval(() => void poll(), ms);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [user?.id, connected, showInvite]);

  const decline = async () => {
    const current = inviteRef.current;
    setInvite(null);
    seenToastRef.current = null;
    if (!current?.liveId) return;
    try {
      await api.post(`/live/${current.liveId}/colive/reject`);
    } catch {
      /* local dismiss still OK */
    }
  };

  const accept = async () => {
    if (!invite) return;
    setBusy(true);
    try {
      const res = await api.post(`/live/${invite.liveId}/colive/accept`);
      const data = res.data?.data as {
        token?: string;
        livekitUrl?: string;
      };
      const liveId = invite.liveId;
      if (data?.token) {
        storeColiveHandoff(liveId, { token: data.token, livekitUrl: data.livekitUrl });
      }
      toast.success('Joined group live as co-host');
      setInvite(null);
      seenToastRef.current = null;
      router.push(`/live/${liveId}`);
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  if (!invite) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[200] flex items-start justify-center p-3 pt-[max(1rem,env(safe-area-inset-top))] sm:items-center sm:p-4">
      <div className="pointer-events-auto w-full max-w-sm rounded-2xl border border-white/15 bg-zinc-950/95 p-5 text-center shadow-2xl backdrop-blur-md">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-pink/20">
          {invite.from?.avatarUrl || invite.from?.displayName ? (
            <UserAvatar
              name={invite.from?.displayName}
              src={invite.from?.avatarUrl}
              className="h-14 w-14"
            />
          ) : (
            <Radio className="h-7 w-7 text-brand-pink" />
          )}
        </div>
        <p className="mt-3 text-lg font-semibold">Co-live invite</p>
        <p className="mt-1 text-sm text-white/60">
          {invite.from?.displayName ?? 'A host'} invited you to join “
          {invite.title ?? 'their stream'}”
        </p>
        <div className="mt-5 flex justify-center gap-3">
          <Button variant="secondary" disabled={busy} onClick={() => void decline()}>
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
