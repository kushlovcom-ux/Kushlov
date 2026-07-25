'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Send, Gift, X, Users } from 'lucide-react';
import { toast } from 'sonner';
import { SocketEvents } from '@kushlov/types';
import { api, apiError, unwrap } from '@/lib/api';
import { takeColiveHandoff } from '@/lib/colive-handoff';
import { useAuthStore } from '@/store/auth';
import { useSocket } from '@/components/socket-provider';
import { LiveKitStage } from '@/components/live/livekit-stage';
import { UserAvatar } from '@/components/common/user-avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

function coHostIdOf(coHost: unknown): string | undefined {
  if (!coHost) return undefined;
  if (typeof coHost === 'string') return coHost;
  if (typeof coHost === 'object') {
    const c = coHost as { _id?: string; id?: string };
    return c._id ?? c.id;
  }
  return undefined;
}

function coHostNameOf(coHost: unknown): string | null {
  if (!coHost) return null;
  if (typeof coHost === 'object' && coHost && 'displayName' in coHost) {
    return (coHost as { displayName?: string }).displayName ?? 'Co-host';
  }
  return 'Co-host';
}

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

function mergeChat(prev: LiveChatMsg[], incoming: LiveChatMsg[]): LiveChatMsg[] {
  if (!incoming.length) return prev;
  const seen = new Set(prev.map((m) => m._id).filter(Boolean) as string[]);
  const next = [...prev];
  for (const m of incoming) {
    if (!m?.message) continue;
    if (m._id && seen.has(m._id)) continue;
    if (m._id) seen.add(m._id);
    next.push(m);
  }
  return next;
}

export default function LiveRoomPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const me = useAuthStore((s) => s.user);
  const { socket, connected } = useSocket();
  const [token, setToken] = useState<string>();
  const [livekitUrl, setLivekitUrl] = useState<string>();
  const [chat, setChat] = useState<LiveChatMsg[]>([]);
  const [text, setText] = useState('');
  const [viewers, setViewers] = useState(0);
  const [showViewers, setShowViewers] = useState(false);
  const [showColive, setShowColive] = useState(false);
  const [coHostName, setCoHostName] = useState<string | null>(null);
  const [isCoHostOverride, setIsCoHostOverride] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const lastChatIdRef = useRef<string | undefined>(undefined);
  const handoffAppliedRef = useRef(false);
  const tokenRoleRef = useRef<'host' | 'cohost' | 'viewer' | null>(null);

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
  const isCoHost = useMemo(() => {
    if (isCoHostOverride) return true;
    if (!live.data || !me?.id) return false;
    return coHostIdOf(live.data.coHost) === me.id;
  }, [live.data, me?.id, isCoHostOverride]);
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
      setCoHostName(coHostNameOf(live.data.coHost));
    } else if (!isCoHostOverride) {
      setCoHostName(null);
    }
  }, [live.data, isCoHostOverride]);

  // Apply Accept handoff once (publish token from overlay → group live room).
  useEffect(() => {
    handoffAppliedRef.current = false;
    tokenRoleRef.current = null;
    setIsCoHostOverride(false);
    setToken(undefined);

    const handoff = takeColiveHandoff(id);
    if (!handoff?.token) return;
    handoffAppliedRef.current = true;
    tokenRoleRef.current = 'cohost';
    setIsCoHostOverride(true);
    setToken(handoff.token);
    if (handoff.livekitUrl) setLivekitUrl(handoff.livekitUrl);
  }, [id]);

  // Get a LiveKit token (publish for host/cohost, subscribe for viewer).
  useEffect(() => {
    if (!live.data) return;
    const role = isHost ? 'host' : isCoHost ? 'cohost' : 'viewer';

    // Accept handoff already seeded a publish token for group live.
    if (handoffAppliedRef.current && role === 'cohost') {
      tokenRoleRef.current = 'cohost';
      return;
    }
    if (tokenRoleRef.current === role) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await (isHost
          ? api.get(`/live/${id}/host-token`)
          : isCoHost
            ? api.get(`/live/${id}/colive/token`)
            : api.post(`/live/${id}/join`));
        if (cancelled) return;
        tokenRoleRef.current = res.data.data.role === 'cohost' ? 'cohost' : role;
        setToken(res.data.data.token);
        if (res.data.data.livekitUrl) setLivekitUrl(res.data.data.livekitUrl);
        if (res.data.data.viewerCount != null) setViewers(res.data.data.viewerCount);
        if (res.data.data.role === 'cohost') setIsCoHostOverride(true);
      } catch (e) {
        if (!cancelled) toast.error(apiError(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [live.data, id, isHost, isCoHost]);

  const appendChat = useCallback((messages: LiveChatMsg | LiveChatMsg[]) => {
    const list = Array.isArray(messages) ? messages : [messages];
    setChat((c) => {
      const next = mergeChat(c, list);
      const last = next[next.length - 1]?._id;
      if (last) lastChatIdRef.current = last;
      return next;
    });
  }, []);

  // HTTP poll — reliable for everyone even when Socket.io is multi-instance / disabled.
  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    const pull = async () => {
      try {
        const after = lastChatIdRef.current;
        const q = after ? `?after=${encodeURIComponent(after)}&limit=50` : '?limit=40';
        const res = await api.get(`/live/${id}/chat${q}`);
        const messages = (res.data?.data?.messages ?? []) as LiveChatMsg[];
        if (!cancelled && messages.length) appendChat(messages);
      } catch {
        /* ignore transient poll errors */
      }
    };

    void pull();
    // Faster when sockets are down; still light when connected.
    const ms = connected ? 2500 : 1200;
    const timer = window.setInterval(() => void pull(), ms);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [id, connected, appendChat]);

  // Socket room events + co-live invite (re-join room on every connect)
  useEffect(() => {
    if (!socket) return;

    const joinRoom = () => {
      socket.emit(SocketEvents.LiveJoin, { liveId: id });
    };
    joinRoom();
    socket.on('connect', joinRoom);

    const onChat = (m: LiveChatMsg) => {
      if (m?.message) appendChat(m);
    };
    const onCount = (p: { viewerCount?: number }) => {
      if (p.viewerCount != null) setViewers(p.viewerCount);
    };
    const onGift = (p: { gift: { name: string } }) => toast(`🎁 ${p.gift.name} sent!`);
    // Invite Accept/Decline is handled globally by ColiveInviteOverlay.
    const onColiveAccept = (p: { coHost?: { displayName?: string; id?: string } }) => {
      setCoHostName(p.coHost?.displayName ?? 'Co-host');
      if (p.coHost?.id === me?.id) setIsCoHostOverride(true);
      void live.refetch();
      toast.success(`${p.coHost?.displayName ?? 'Host'} joined group live`);
    };
    const onColiveLeave = () => {
      setCoHostName(null);
      if (isCoHost) {
        setIsCoHostOverride(false);
        tokenRoleRef.current = null;
        router.push('/live');
      } else {
        void live.refetch();
      }
    };
    socket.on(SocketEvents.LiveChat, onChat);
    socket.on(SocketEvents.LiveViewerCount, onCount);
    socket.on(SocketEvents.LiveGift, onGift);
    socket.on(SocketEvents.LiveColiveAccept, onColiveAccept);
    socket.on(SocketEvents.LiveColiveLeave, onColiveLeave);
    return () => {
      socket.off('connect', joinRoom);
      socket.emit(SocketEvents.LiveLeave, { liveId: id });
      socket.off(SocketEvents.LiveChat, onChat);
      socket.off(SocketEvents.LiveViewerCount, onCount);
      socket.off(SocketEvents.LiveGift, onGift);
      socket.off(SocketEvents.LiveColiveAccept, onColiveAccept);
      socket.off(SocketEvents.LiveColiveLeave, onColiveLeave);
    };
  }, [socket, id, isCoHost, me?.id, router, appendChat, live.refetch]);

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
        appendChat({
          _id: payload._id,
          message: payload.message,
          user: payload.user ?? {
            displayName: me?.displayName ?? 'You',
            avatarUrl: me?.avatarUrl,
          },
        });
      }
    } catch (e) {
      setText(message);
      toast.error(apiError(e));
    }
  };

  const inviteColive = async (inviteHostId: string) => {
    try {
      await api.post(`/live/${id}/colive/invite`, { hostId: inviteHostId });
      toast.success('Co-live invite sent');
      setShowColive(false);
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-black">
      <div className="absolute inset-0">
        {token ? (
          <LiveKitStage
            token={token}
            serverUrl={livekitUrl}
            isHost={canPublish}
            publish={canPublish}
            showAvControls={canPublish}
            showFilters={canPublish}
            layout="grid"
            videoFit="cover"
            onDisconnected={leave}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-white/40">Connecting…</div>
        )}
      </div>

      <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-black/80 via-transparent to-black/40" />

      <div className="absolute left-4 top-4 z-20 flex max-w-[70%] flex-wrap items-center gap-3 rounded-full bg-black/50 px-3 py-1.5 backdrop-blur">
        <UserAvatar
          name={live.data?.host?.displayName}
          src={live.data?.host?.avatarUrl}
          className="h-7 w-7"
        />
        <span className="truncate text-sm font-medium">{live.data?.title}</span>
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

      {/* Chat/gift composer — above filters (filters sit higher in LiveKitStage). */}
      <div className="absolute bottom-0 left-0 z-30 flex w-full max-w-lg flex-col justify-end p-3 sm:max-w-md">
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
