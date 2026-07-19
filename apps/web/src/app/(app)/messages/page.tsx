'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Send } from 'lucide-react';
import { SocketEvents } from '@kushlov/types';
import { api, unwrap } from '@/lib/api';
import { cn, relativeTime } from '@/lib/utils';
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
  const inputRef = useRef<HTMLInputElement>(null);

  const conversations = useQuery({
    queryKey: ['conversations'],
    queryFn: () => unwrap<{ items: Conversation[] }>(api.get('/chat/conversations')),
  });

  useEffect(() => {
    if (!toUser) return;
    api.post('/chat/conversations', { userId: toUser }).then((res) => {
      setActiveId(res.data.data._id);
      qc.invalidateQueries({ queryKey: ['conversations'] });
    });
  }, [toUser, qc]);

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
    queryFn: () =>
      unwrap<{ items: Message[] }>(api.get(`/chat/conversations/${activeId}/messages`)),
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
      inputRef.current?.focus();
    },
  });

  useEffect(() => {
    if (!socket) return;
    const handler = (msg: Message & { conversation: string }) => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
      qc.invalidateQueries({ queryKey: ['nav-badges'] });
      if (msg.conversation === activeId) {
        qc.invalidateQueries({ queryKey: ['messages', activeId] });
      }
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

  const chatPane = (
    <>
      <div className="flex shrink-0 items-center gap-3 border-b border-white/10 px-3 py-3 sm:px-5">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="md:hidden"
          aria-label="Back to conversations"
          onClick={() => setActiveId(null)}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <UserAvatar name={other?.displayName} src={other?.avatarUrl} online={other?.isOnline} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{other?.displayName}</p>
          <p className="text-xs text-white/40">{other?.isOnline ? 'Online' : 'Offline'}</p>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 py-4 sm:px-5"
      >
        {messages.isLoading &&
          Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className={cn('h-10 w-2/3 rounded-2xl', i % 2 ? 'ml-auto' : '')} />
          ))}
        {messages.data?.items.map((m) => {
          const senderId = typeof m.sender === 'string' ? m.sender : m.sender._id;
          const mine = senderId === me?.id;
          return (
            <div key={m._id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
              <div
                className={cn(
                  'max-w-[78%] rounded-2xl px-3.5 py-2 sm:max-w-[65%]',
                  mine ? 'rounded-br-md bg-brand-gradient text-white' : 'rounded-bl-md bg-white/10',
                )}
              >
                {m.media?.url && m.type === 'image' && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.media.url} alt="" className="mb-1 max-h-56 rounded-lg" />
                )}
                {m.text && <p className="whitespace-pre-wrap break-words text-[15px]">{m.text}</p>}
                <p className="mt-1 text-right text-[10px] opacity-60">{relativeTime(m.createdAt)}</p>
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
        className="flex shrink-0 items-end gap-2 border-t border-white/10 bg-card/80 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:p-4"
      >
        <Input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message…"
          className="min-h-11 flex-1 rounded-full border-white/10 bg-white/5 px-4"
          autoComplete="off"
        />
        <Button
          type="submit"
          size="icon"
          className="h-11 w-11 shrink-0 rounded-full"
          loading={send.isPending}
          disabled={!text.trim()}
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </>
  );

  return (
    <div className="flex h-[calc(100dvh-4.5rem)] min-h-0 w-full overflow-hidden md:h-[100dvh]">
      {/* Conversation list — Instagram: full width on mobile when no chat open */}
      <aside
        className={cn(
          'flex min-h-0 w-full flex-col border-white/10 md:w-[340px] md:shrink-0 md:border-r',
          activeId ? 'hidden md:flex' : 'flex',
        )}
      >
        <div className="shrink-0 border-b border-white/10 px-5 py-4">
          <h1 className="text-xl font-bold">Messages</h1>
          <p className="mt-1 text-xs text-white/40">
            Chat costs diamonds. Calls are billed by your diamond balance.
          </p>
        </div>
        <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain p-2">
          {conversations.isLoading &&
            Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          {conversations.data?.items.map((c) => {
            const o = c.participants.find((p) => p._id !== me?.id);
            return (
              <button
                key={c._id}
                type="button"
                onClick={() => setActiveId(c._id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors',
                  activeId === c._id ? 'bg-white/10' : 'hover:bg-white/5',
                )}
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
          {!conversations.isLoading && (conversations.data?.items.length ?? 0) === 0 && (
            <p className="px-3 py-10 text-center text-sm text-white/40">No conversations yet</p>
          )}
        </div>
      </aside>

      {/* Chat — Instagram: full screen on mobile when a thread is open */}
      <section
        className={cn(
          'min-h-0 flex-1 flex-col bg-background',
          activeId
            ? 'fixed inset-0 z-[60] flex md:static md:z-auto'
            : 'hidden md:flex',
        )}
      >
        {!activeId ? (
          <div className="flex flex-1 items-center justify-center text-white/40">
            Select a conversation to start chatting
          </div>
        ) : (
          chatPane
        )}
      </section>
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
