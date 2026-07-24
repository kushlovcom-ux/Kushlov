'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Send, Gift, X, Users, Radio } from 'lucide-react';
import { toast } from 'sonner';
import { SocketEvents } from '@kushlov/types';
import { api, apiError, unwrap } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { useSocket } from '@/components/socket-provider';
import { LiveKitStage } from '@/components/live/livekit-stage';
import { UserAvatar } from '@/components/common/user-avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface LiveChatMsg {
  _id?: string;
  user: { displayName: string; avatarUrl?: string };
  message: string;
}

interface LiveViewer {
  id: string;
  displayName?: string;
  username?: string;
  avatarUrl?: string;
}

interface LiveListItem {
  _id: string;
  title: string;
  host: { _id?: string; id?: string; displayName?: string; username?: string; avatarUrl?: string };
}

export default function LiveRoomPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const me = useAuthStore((s) => s.user);
  const { socket } = useSocket();
  const [token, setToken] = useState<string>();
  const [livekitUrl, setLivekitUrl] = useState<string>();
  const [chat, setChat] = useState<LiveChatMsg[]>([]);
  const [text, setText] = useState('');
  const [viewers, setViewers] = useState(0);
  const [showViewers, setShowViewers] = useState(false);
  const [showColive, setShowColive] = useState(false);
  const [coHostName, setCoHostName] = useState<string | null>(null);
  const [coliveInvite, setColiveInvite] = useState<{
    liveId: string;
    title?: string;
    from?: { displayName?: string };
  } | null>(null);
  const [isCoHost, setIsCoHost] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  const live = useQuery({
    queryKey: ['live', id],
    queryFn: () => unwrap<any>(api.get(`/live/${id}`)),
  });

  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: () => unwrap<{ rates?: { liveChatPerMessage?: number } }>(api.get('/settings')),
    staleTime: 5 * 60_000,
  });

  const otherLives = useQuery({
    queryKey: ['live', 'colive-targets'],
    queryFn: () => unwrap<{ items: LiveListItem[] }>(api.get('/live')),
    enabled: Boolean(showColive),
  });

  const hostId = live.data?.host?._id ?? live.data?.host?.id ?? live.data?.host;
  const isHost = Boolean(live.data && hostId === me?.id);
  const canPublish = isHost || isCoHost;
  const chatCost = Number(settings.data?.rates?.liveChatPerMessage ?? 0);

  const coliveTargets = useMemo(() => {
    const items = otherLives.data?.items ?? [];
    return items.filter((l) => {
      const h = l.host?._id ?? l.host?.id;
      return l._id !== id && h && h !== me?.id;
    });
  }, [otherLives.data?.items, id, me?.id]);

  const viewerList = useQuery({
    queryKey: ['live-viewers', id],
    queryFn: () =>
      unwrap<{ viewerCount: number; viewers: LiveViewer[] }>(api.get(`/live/${id}/viewers`)),
    enabled: Boolean(isHost),
    refetchInterval: isHost ? 5_000 : false,
  });

  useEffect(() => {
    if (live.data?.viewerCount != null) {
      setViewers(Number(live.data.viewerCount) || 0);
    }
  }, [live.data?.viewerCount]);

  useEffect(() => {
    if (viewerList.data?.viewerCount != null) {
      setViewers(viewerList.data.viewerCount);
    }
  }, [viewerList.data?.viewerCount]);

  useEffect(() => {
    if (!live.data) return;
    if (live.data.coHost) {
      const c = live.data.coHost;
      setCoHostName(typeof c === 'object' ? c.displayName : 'Co-host');
      if ((c?._id ?? c?.id ?? c) === me?.id) setIsCoHost(true);
    }
  }, [live.data, me?.id]);

  // Get a LiveKit token (publish for host/cohost, subscribe for viewer).
  useEffect(() => {
    if (!live.data) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await (isHost
          ? api.get(`/live/${id}/host-token`)
          : isCoHost
            ? api.post(`/live/${id}/colive/accept`)
            : api.post(`/live/${id}/join`));
        if (cancelled) return;
        setToken(res.data.data.token);
        if (res.data.data.livekitUrl) setLivekitUrl(res.data.data.livekitUrl);
        if (res.data.data.viewerCount != null) setViewers(res.data.data.viewerCount);
      } catch (e) {
        if (!cancelled) toast.error(apiError(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [live.data, id, isHost, isCoHost]);

  // Socket room events + co-live invite (re-join room on every connect)
  useEffect(() => {
    if (!socket) return;

    const joinRoom = () => {
      socket.emit(SocketEvents.LiveJoin, { liveId: id });
    };
    joinRoom();
    socket.on('connect', joinRoom);

    const onChat = (m: LiveChatMsg) => {
      setChat((c) => {
        const idKey = m._id;
        if (idKey && c.some((x) => x._id === idKey)) return c;
        return [...c, m];
      });
    };
    const onCount = (p: { viewerCount?: number }) => {
      if (p.viewerCount != null) setViewers(p.viewerCount);
    };
    const onGift = (p: { gift: { name: string } }) => toast(`🎁 ${p.gift.name} sent!`);
    const onColiveInvite = (p: {
      liveId: string;
      title?: string;
      from?: { displayName?: string };
    }) => {
      if (p.liveId !== id) setColiveInvite(p);
    };
    const onColiveAccept = (p: { coHost?: { displayName?: string; id?: string } }) => {
      setCoHostName(p.coHost?.displayName ?? 'Co-host');
      if (p.coHost?.id === me?.id) setIsCoHost(true);
      toast.success(`${p.coHost?.displayName ?? 'Host'} joined as co-host`);
    };
    const onColiveLeave = () => {
      setCoHostName(null);
      if (isCoHost) {
        setIsCoHost(false);
        router.push('/live');
      }
    };
    socket.on(SocketEvents.LiveChat, onChat);
    socket.on(SocketEvents.LiveViewerCount, onCount);
    socket.on(SocketEvents.LiveGift, onGift);
    socket.on(SocketEvents.LiveColiveInvite, onColiveInvite);
    socket.on(SocketEvents.LiveColiveAccept, onColiveAccept);
    socket.on(SocketEvents.LiveColiveLeave, onColiveLeave);
    return () => {
      socket.off('connect', joinRoom);
      socket.emit(SocketEvents.LiveLeave, { liveId: id });
      socket.off(SocketEvents.LiveChat, onChat);
      socket.off(SocketEvents.LiveViewerCount, onCount);
      socket.off(SocketEvents.LiveGift, onGift);
      socket.off(SocketEvents.LiveColiveInvite, onColiveInvite);
      socket.off(SocketEvents.LiveColiveAccept, onColiveAccept);
      socket.off(SocketEvents.LiveColiveLeave, onColiveLeave);
    };
  }, [socket, id, isCoHost, me?.id, router]);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight });
  }, [chat]);

  const leave = async () => {
    try {
      if (isCoHost && !isHost) await api.post(`/live/${id}/colive/leave`);
      else if (isHost) await api.post(`/live/${id}/end`);
      else await api.post(`/live/${id}/leave`);
    } catch {
      /* ignore */
    }
    router.push('/live');
  };

  const sendChat = async () => {
    if (!text.trim()) return;
    const message = text.trim();
    setText('');
    try {
      const res = await api.post(`/live/${id}/chat`, { message });
      const payload = res.data?.data as LiveChatMsg | undefined;
      if (payload?.message) {
        setChat((c) => {
          const idKey = payload._id;
          if (idKey && c.some((x) => x._id === idKey)) return c;
          return [
            ...c,
            {
              _id: payload._id,
              message: payload.message,
              user: payload.user ?? {
                displayName: me?.displayName ?? 'You',
                avatarUrl: me?.avatarUrl,
              },
            },
          ];
        });
      }
    } catch (e) {
      setText(message);
      toast.error(apiError(e));
    }
  };

  const inviteColive = async (hostId: string) => {
    try {
      await api.post(`/live/${id}/colive/invite`, { hostId });
      toast.success('Co-live invite sent');
      setShowColive(false);
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const acceptColive = async () => {
    if (!coliveInvite) return;
    try {
      const res = await api.post(`/live/${coliveInvite.liveId}/colive/accept`);
      toast.success('Joined as co-host');
      setColiveInvite(null);
      router.push(`/live/${coliveInvite.liveId}`);
      void res;
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  return (
    <div className="relative h-screen w-full overflow-hidden bg-black">
      {coliveInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-card p-6 text-center">
            <Radio className="mx-auto h-8 w-8 text-brand-pink" />
            <p className="mt-3 font-semibold">Co-live invite</p>
            <p className="mt-1 text-sm text-white/60">
              {coliveInvite.from?.displayName ?? 'A host'} invited you to join “
              {coliveInvite.title ?? 'their stream'}”
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <Button variant="secondary" onClick={() => setColiveInvite(null)}>
                Decline
              </Button>
              <Button onClick={() => void acceptColive()}>Join</Button>
            </div>
          </div>
        </div>
      )}

      <div className="absolute inset-0">
        {token ? (
          <LiveKitStage
            token={token}
            serverUrl={livekitUrl}
            isHost={canPublish}
            publish={canPublish}
            showAvControls={canPublish}
            showFilters={canPublish}
            onDisconnected={leave}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-white/40">Connecting…</div>
        )}
      </div>

      <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-black/80 via-transparent to-black/40" />

      <div className="absolute left-4 top-4 z-20 flex flex-wrap items-center gap-3 rounded-full bg-black/50 px-3 py-1.5 backdrop-blur">
        <UserAvatar
          name={live.data?.host?.displayName}
          src={live.data?.host?.avatarUrl}
          className="h-7 w-7"
        />
        <span className="text-sm font-medium">{live.data?.title}</span>
        {coHostName ? (
          <span className="rounded-full bg-brand-pink/30 px-2 py-0.5 text-xs">+ {coHostName}</span>
        ) : null}
        {isHost ? (
          <button
            type="button"
            onClick={() => setShowViewers((v) => !v)}
            className="pointer-events-auto inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-xs hover:bg-white/20"
          >
            <Users className="h-3 w-3" /> {viewers}
          </button>
        ) : (
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">👁 {viewers}</span>
        )}
        {isHost ? (
          <button
            type="button"
            onClick={() => setShowColive((v) => !v)}
            className="pointer-events-auto rounded-full bg-white/10 px-2 py-0.5 text-xs hover:bg-white/20"
          >
            Invite co-host
          </button>
        ) : null}
      </div>
      <Button
        variant="destructive"
        size="sm"
        className="absolute right-4 top-4 z-20"
        onClick={leave}
      >
        <X className="h-4 w-4" /> {isHost ? 'End' : isCoHost ? 'Leave co-live' : 'Leave'}
      </Button>

      {isHost && showViewers && (
        <div className="absolute left-4 top-20 z-20 max-h-72 w-64 overflow-y-auto rounded-2xl border border-white/10 bg-black/70 p-3 backdrop-blur">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/50">
            Watching now
          </p>
          {viewerList.isLoading ? (
            <p className="text-sm text-white/40">Loading…</p>
          ) : (viewerList.data?.viewers?.length ?? 0) === 0 ? (
            <p className="text-sm text-white/40">No viewers yet</p>
          ) : (
            <ul className="space-y-2">
              {viewerList.data!.viewers.map((v) => (
                <li key={v.id} className="flex items-center gap-2">
                  <UserAvatar name={v.displayName} src={v.avatarUrl} className="h-7 w-7" />
                  <span className="truncate text-sm">{v.displayName ?? v.username ?? 'Viewer'}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {isHost && showColive && (
        <div className="absolute right-4 top-20 z-20 max-h-72 w-72 overflow-y-auto rounded-2xl border border-white/10 bg-black/70 p-3 backdrop-blur">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/50">
            Live hosts to invite
          </p>
          {coliveTargets.length === 0 ? (
            <p className="text-sm text-white/40">No other hosts are live</p>
          ) : (
            <ul className="space-y-2">
              {coliveTargets.map((l) => {
                const hId = l.host?._id ?? l.host?.id ?? '';
                return (
                  <li key={l._id} className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <UserAvatar
                        name={l.host?.displayName}
                        src={l.host?.avatarUrl}
                        className="h-7 w-7"
                      />
                      <span className="truncate text-sm">{l.host?.displayName ?? 'Host'}</span>
                    </div>
                    <Button size="sm" onClick={() => void inviteColive(String(hId))}>
                      Invite
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Facebook-style overlay chat — leave right side clear for AV controls on mobile */}
      <div className="absolute bottom-0 left-0 right-0 z-20 flex max-h-[42%] flex-col justify-end p-3 pr-20 sm:max-w-md sm:pr-3">
        <div
          ref={chatRef}
          className="mb-2 max-h-48 space-y-1.5 overflow-y-auto pr-1 [mask-image:linear-gradient(to_bottom,transparent,black_12%)]"
        >
          {chat.map((m, i) => (
            <div key={m._id ?? i} className="rounded-lg bg-black/35 px-2.5 py-1 text-sm backdrop-blur-sm">
              <span className="font-semibold text-brand-pink">{m.user?.displayName}: </span>
              <span className="text-white/90">{m.message}</span>
            </div>
          ))}
        </div>
        <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/15 bg-black/55 p-1.5 backdrop-blur">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void sendChat()}
            placeholder={
              !canPublish && chatCost > 0 ? `Say something… (${chatCost}♦)` : 'Say something…'
            }
            className="h-9 border-0 bg-transparent focus-visible:ring-0"
          />
          <Button size="icon" className="h-9 w-9 shrink-0 rounded-full" onClick={() => void sendChat()}>
            <Send className="h-4 w-4" />
          </Button>
          {!canPublish && (
            <Button
              size="icon"
              variant="secondary"
              className="h-9 w-9 shrink-0 rounded-full"
              onClick={() => void api.post(`/live/${id}/like`).then(() => toast.success('Liked!'))}
            >
              <Gift className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
