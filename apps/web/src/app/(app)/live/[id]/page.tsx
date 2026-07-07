'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Heart, Send, Gift, X } from 'lucide-react';
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
  const chatRef = useRef<HTMLDivElement>(null);

  const live = useQuery({
    queryKey: ['live', id],
    queryFn: () => unwrap<any>(api.get(`/live/${id}`)),
  });

  const isHost = live.data && (live.data.host?._id ?? live.data.host) === me?.id;

  // Get a LiveKit token (publish for host, subscribe for viewer).
  useEffect(() => {
    if (!live.data) return;
    const req = isHost
      ? api.get(`/live/${id}/host-token`)
      : api.post(`/live/${id}/join`);
    req
      .then((res) => {
        setToken(res.data.data.token);
        if (res.data.data.livekitUrl) setLivekitUrl(res.data.data.livekitUrl);
        if (res.data.data.viewerCount != null) setViewers(res.data.data.viewerCount);
      })
      .catch((e) => toast.error(apiError(e)));
  }, [live.data, id, isHost]);

  // Socket room events
  useEffect(() => {
    if (!socket) return;
    socket.emit(SocketEvents.LiveJoin, { liveId: id });
    const onChat = (m: LiveChatMsg) => setChat((c) => [...c, m]);
    const onCount = (p: { viewerCount?: number }) => {
      if (p.viewerCount != null) setViewers(p.viewerCount);
    };
    const onGift = (p: { gift: { name: string } }) => toast(`🎁 ${p.gift.name} sent!`);
    socket.on(SocketEvents.LiveChat, onChat);
    socket.on(SocketEvents.LiveViewerCount, onCount);
    socket.on(SocketEvents.LiveGift, onGift);
    return () => {
      socket.emit(SocketEvents.LiveLeave, { liveId: id });
      socket.off(SocketEvents.LiveChat, onChat);
      socket.off(SocketEvents.LiveViewerCount, onCount);
      socket.off(SocketEvents.LiveGift, onGift);
    };
  }, [socket, id]);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight });
  }, [chat]);

  const leave = async () => {
    if (isHost) await api.post(`/live/${id}/end`).catch(() => {});
    else await api.post(`/live/${id}/leave`).catch(() => {});
    router.push('/live');
  };

  const sendChat = async () => {
    if (!text.trim()) return;
    try {
      await api.post(`/live/${id}/chat`, { message: text.trim() });
      setText('');
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  return (
    <div className="flex h-screen flex-col lg:flex-row">
      <div className="relative flex-1 p-4">
        <div className="absolute left-6 top-6 z-10 flex items-center gap-3 rounded-full bg-black/50 px-3 py-1.5 backdrop-blur">
          <UserAvatar
            name={live.data?.host?.displayName}
            src={live.data?.host?.avatarUrl}
            className="h-7 w-7"
          />
          <span className="text-sm font-medium">{live.data?.title}</span>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">👁 {viewers}</span>
        </div>
        <Button
          variant="destructive"
          size="sm"
          className="absolute right-6 top-6 z-10"
          onClick={leave}
        >
          <X className="h-4 w-4" /> {isHost ? 'End' : 'Leave'}
        </Button>
        <div className="h-full">
          {token ? (
            <LiveKitStage
              token={token}
              serverUrl={livekitUrl}
              isHost={Boolean(isHost)}
              onDisconnected={leave}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-white/40">Connecting…</div>
          )}
        </div>
      </div>

      {/* Live chat sidebar */}
      <div className="flex h-64 flex-col border-t border-white/10 lg:h-auto lg:w-80 lg:border-l lg:border-t-0">
        <div className="border-b border-white/10 px-4 py-3 font-semibold">Live chat</div>
        <div ref={chatRef} className="flex-1 space-y-2 overflow-y-auto p-4">
          {chat.map((m, i) => (
            <div key={m._id ?? i} className="text-sm">
              <span className="font-semibold text-brand-pink">{m.user?.displayName}: </span>
              <span className="text-white/80">{m.message}</span>
            </div>
          ))}
          {chat.length === 0 && <p className="text-sm text-white/30">Be the first to say hi 👋</p>}
        </div>
        <div className="flex items-center gap-2 border-t border-white/10 p-3">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendChat()}
            placeholder="Say something…"
          />
          <Button size="icon" onClick={sendChat}>
            <Send className="h-4 w-4" />
          </Button>
          {!isHost && (
            <Button
              size="icon"
              variant="secondary"
              onClick={() => toast.message('Open the gifts drawer to send a gift 🎁')}
            >
              <Gift className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
