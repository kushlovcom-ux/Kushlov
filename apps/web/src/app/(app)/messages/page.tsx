'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Send } from 'lucide-react';
import { SocketEvents } from '@kushlov/types';
import { api, unwrap } from '@/lib/api';
import { relativeTime } from '@/lib/utils';
import { useAuthStore } from '@/store/auth';
import { useSocket } from '@/components/socket-provider';
import { UserAvatar } from '@/components/common/user-avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface Participant {
  _id: string;
  displayName: string;
  username: string;
  avatarUrl?: string;
  isOnline?: boolean;
}
interface Conversation {
  _id: string;
  participants: Participant[];
  lastMessage?: { text?: string; type: string };
  unreadCount: number;
}
interface Message {
  _id: string;
  sender: Participant | string;
  text?: string;
  type: string;
  media?: { url: string };
  createdAt: string;
}

function Messages() {
  const params = useSearchParams();
  const toUser = params.get('to');
  const me = useAuthStore((s) => s.user);
  const { socket } = useSocket();
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [text, setText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const conversations = useQuery({
    queryKey: ['conversations'],
    queryFn: () => unwrap<{ items: Conversation[] }>(api.get('/chat/conversations')),
  });

  // Open a conversation from ?to=userId
  useEffect(() => {
    if (!toUser) return;
    api.post('/chat/conversations', { userId: toUser }).then((res) => {
      setActiveId(res.data.data._id);
      qc.invalidateQueries({ queryKey: ['conversations'] });
    });
  }, [toUser, qc]);

  // Mark conversation read when opened — clears nav badge counts.
  useEffect(() => {
    if (!activeId) return;
    api
      .patch(`/chat/conversations/${activeId}/read`)
      .then(() => {
        qc.invalidateQueries({ queryKey: ['conversations'] });
        qc.invalidateQueries({ queryKey: ['nav-badges'] });
      })
      .catch(() => {});
  }, [activeId, qc]);

  const messages = useQuery({
    queryKey: ['messages', activeId],
    queryFn: () => unwrap<{ items: Message[] }>(api.get(`/chat/conversations/${activeId}/messages`)),
    enabled: !!activeId,
  });

  const send = useMutation({
    mutationFn: (body: string) =>
      api.post(`/chat/conversations/${activeId}/messages`, { text: body }),
    onSuccess: () => {
      setText('');
      qc.invalidateQueries({ queryKey: ['messages', activeId] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
      qc.invalidateQueries({ queryKey: ['nav-badges'] });
    },
  });

  // Live incoming messages
  useEffect(() => {
    if (!socket) return;
    const handler = (msg: Message & { conversation: string }) => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
      qc.invalidateQueries({ queryKey: ['nav-badges'] });
      if (msg.conversation === activeId) qc.invalidateQueries({ queryKey: ['messages', activeId] });
    };
    socket.on(SocketEvents.MessageNew, handler);
    return () => {
      socket.off(SocketEvents.MessageNew, handler);
    };
  }, [socket, activeId, qc]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.data]);

  const active = conversations.data?.items.find((c) => c._id === activeId);
  const other = active?.participants.find((p) => p._id !== me?.id);

  return (
    <div className="flex h-screen">
      {/* Conversation list */}
      <div className="w-full max-w-xs border-r border-white/10">
        <div className="border-b border-white/10 px-5 py-5">
          <h1 className="text-xl font-bold">Messages</h1>
          <p className="mt-1 text-xs text-white/40">
            Chat with hosts costs diamonds per message. Calls are billed per minute.
          </p>
        </div>
        <div className="space-y-1 overflow-y-auto p-2">
          {conversations.isLoading &&
            Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          {conversations.data?.items.map((c) => {
            const o = c.participants.find((p) => p._id !== me?.id);
            return (
              <button
                key={c._id}
                onClick={() => setActiveId(c._id)}
                className={`flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors ${
                  activeId === c._id ? 'bg-white/10' : 'hover:bg-white/5'
                }`}
              >
                <UserAvatar name={o?.displayName} src={o?.avatarUrl} online={o?.isOnline} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{o?.displayName ?? 'Unknown'}</p>
                  <p className="truncate text-xs text-white/40">
                    {c.lastMessage?.text ?? 'Say hi 👋'}
                  </p>
                </div>
                {c.unreadCount > 0 && (
                  <span className="rounded-full bg-brand-pink px-2 py-0.5 text-xs font-bold">
                    {c.unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Chat window */}
      <div className="flex flex-1 flex-col">
        {!activeId ? (
          <div className="flex flex-1 items-center justify-center text-white/40">
            Select a conversation to start chatting
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
              <UserAvatar name={other?.displayName} src={other?.avatarUrl} online={other?.isOnline} />
              <div>
                <p className="font-semibold">{other?.displayName}</p>
                <p className="text-xs text-white/40">{other?.isOnline ? 'Online' : 'Offline'}</p>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-5">
              {messages.data?.items.map((m) => {
                const senderId = typeof m.sender === 'string' ? m.sender : m.sender._id;
                const mine = senderId === me?.id;
                return (
                  <div key={m._id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                        mine ? 'bg-brand-gradient text-white' : 'bg-white/10'
                      }`}
                    >
                      {m.media?.url && m.type === 'image' && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.media.url} alt="" className="mb-1 max-h-56 rounded-lg" />
                      )}
                      {m.text && <p className="whitespace-pre-wrap break-words">{m.text}</p>}
                      <p className="mt-1 text-right text-[10px] opacity-60">
                        {relativeTime(m.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (text.trim()) send.mutate(text.trim());
              }}
              className="flex items-center gap-2 border-t border-white/10 p-4"
            >
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type a message…"
              />
              <Button type="submit" size="icon" loading={send.isPending}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<div className="p-6 text-white/40">Loading…</div>}>
      <Messages />
    </Suspense>
  );
}
