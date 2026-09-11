'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, FileText, MoreVertical, Trash2 } from 'lucide-react';
import { SocketEvents } from '@kushlov/types';
import { api, unwrap } from '@/lib/api';
import { cn, relativeTime } from '@/lib/utils';
import { useAuthStore } from '@/store/auth';
import { useSocket } from '@/components/socket-provider';
import { UserAvatar } from '@/components/common/user-avatar';
import { ChatComposer } from '@/components/chat/chat-composer';
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
  media?: { url: string; fileName?: string };
  createdAt: string;
}

/** Short label for a media message in the conversation list. */
function previewOf(last: Conversation['lastMessage']) {
  if (!last) return 'Say hi 👋';
  if (last.text) return last.text;
  if (last.type === 'image') return '📷 Photo';
  if (last.type === 'video') return '🎬 Video';
  if (last.type === 'voice') return '🎤 Voice note';
  if (last.type === 'file') return '📄 Document';
  return 'Say hi 👋';
}

/**
 * Per-message delete menu. "Delete for everyone" is only offered on your own
 * messages — the API rejects it otherwise, so showing it would be a dead option.
 *
 * The dropdown anchors to the message row (which owns the `relative`), not to
 * this trigger: the scroll list is `overflow-y-auto`, so CSS also clips the x
 * axis and a menu measured from the trigger runs off the edge on long messages.
 */
function MessageMenu({
  open,
  mine,
  onToggle,
  onDelete,
}: {
  open: boolean;
  mine: boolean;
  onToggle: () => void;
  onDelete: (forEveryone: boolean) => void;
}) {
  return (
    <div className="shrink-0">
      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-10 cursor-default"
            aria-label="Close menu"
            onClick={onToggle}
          />
          <div
            className={cn(
              'absolute bottom-full z-20 mb-1 w-52 overflow-hidden rounded-xl border border-white/10 bg-card shadow-xl',
              mine ? 'right-0' : 'left-0',
            )}
          >
            <button
              type="button"
              onClick={() => onDelete(false)}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-white/10"
            >
              <Trash2 className="h-4 w-4" />
              Delete for me
            </button>
            {mine && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Delete this message for everyone? This cannot be undone.')) {
                    onDelete(true);
                  }
                }}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-red-400 transition-colors hover:bg-white/10"
              >
                <Trash2 className="h-4 w-4" />
                Delete for everyone
              </button>
            )}
          </div>
        </>
      )}
      <button
        type="button"
        onClick={onToggle}
        aria-label="Message options"
        className={cn(
          'rounded-full p-1 text-white/40 transition hover:bg-white/10 hover:text-white',
          // Always reachable on touch, revealed on hover for pointer devices.
          open ? 'opacity-100' : 'opacity-0 focus:opacity-100 group-hover:opacity-100 max-md:opacity-60',
        )}
      >
        <MoreVertical className="h-4 w-4" />
      </button>
    </div>
  );
}

function MessageMedia({ message }: { message: Message }) {
  const url = message.media?.url;
  if (!url) return null;

  if (message.type === 'image') {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt={message.media?.fileName ?? ''} className="mb-1 max-h-56 rounded-lg" />
    );
  }
  if (message.type === 'video') {
    return <video src={url} controls playsInline className="mb-1 max-h-64 rounded-lg" />;
  }
  if (message.type === 'voice' || message.type === 'audio') {
    return <audio src={url} controls className="mb-1 w-56 max-w-full" />;
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      download={message.media?.fileName}
      className="mb-1 flex items-center gap-2 rounded-lg bg-black/20 px-3 py-2 text-sm underline-offset-2 hover:underline"
    >
      <FileText className="h-4 w-4 shrink-0" />
      <span className="truncate">{message.media?.fileName ?? 'Download file'}</span>
    </a>
  );
}

function Messages() {
  const params = useSearchParams();
  const toUser = params.get('to');
  const me = useAuthStore((s) => s.user);
  const { socket } = useSocket();
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [chatMenu, setChatMenu] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const conversations = useQuery({
    queryKey: ['conversations'],
    queryFn: () => unwrap<{ items: Conversation[] }>(api.get('/chat/conversations')),
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
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
    // Smooth inbox when Socket.io is unavailable (Vercel / disconnected).
    refetchInterval: activeId ? 3_000 : false,
    refetchIntervalInBackground: false,
  });

  const deleteMessage = useMutation({
    mutationFn: ({ id, forEveryone }: { id: string; forEveryone: boolean }) =>
      api.delete(`/chat/messages/${id}${forEveryone ? '?forEveryone=true' : ''}`),
    onSuccess: () => {
      setMenuFor(null);
      qc.invalidateQueries({ queryKey: ['messages', activeId] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  const deleteChat = useMutation({
    mutationFn: (conversationId: string) => api.delete(`/chat/conversations/${conversationId}`),
    onSuccess: () => {
      setChatMenu(false);
      setActiveId(null);
      qc.invalidateQueries({ queryKey: ['conversations'] });
      qc.invalidateQueries({ queryKey: ['nav-badges'] });
    },
  });

  const send = useMutation({
    mutationFn: (payload: { text: string } | { file: File; type: string }) => {
      const url = `/chat/conversations/${activeId}/messages`;
      if ('file' in payload) {
        // Multipart matches what the mobile client already sends, so the same
        // endpoint and multer config handle both without a server change.
        const form = new FormData();
        form.append('type', payload.type);
        form.append('file', payload.file, payload.file.name);
        return api.post(url, form);
      }
      return api.post(url, { text: payload.text });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['messages', activeId] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
      qc.invalidateQueries({ queryKey: ['nav-badges'] });
    },
  });

  useEffect(() => {
    if (!socket || !activeId) return;
    const emitFocus = () => socket.emit(SocketEvents.ChatFocus, { conversationId: activeId });
    emitFocus();
    socket.on('connect', emitFocus);
    const onVis = () => {
      if (document.visibilityState === 'visible') emitFocus();
      else socket.emit(SocketEvents.ChatBlur);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      socket.off('connect', emitFocus);
      socket.emit(SocketEvents.ChatBlur);
    };
  }, [socket, activeId]);

  useEffect(() => {
    if (!socket) return;
    const handler = (msg: Message & { conversation?: string }) => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
      qc.invalidateQueries({ queryKey: ['nav-badges'] });
      const convId = msg.conversation != null ? String(msg.conversation) : '';
      if (activeId && convId === String(activeId)) {
        qc.invalidateQueries({ queryKey: ['messages', activeId] });
      } else {
        qc.invalidateQueries({ queryKey: ['messages'] });
      }
    };
    // A delete-for-everyone (or a clear from another device) has to drop the
    // message here too, not just for whoever pressed the button.
    const onDelete = (payload: { conversationId?: string }) => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
      qc.invalidateQueries({ queryKey: ['nav-badges'] });
      const convId = payload?.conversationId ? String(payload.conversationId) : '';
      if (activeId && (!convId || convId === String(activeId))) {
        qc.invalidateQueries({ queryKey: ['messages', activeId] });
      }
    };

    socket.on(SocketEvents.MessageNew, handler);
    socket.on(SocketEvents.MessageDelete, onDelete);
    return () => {
      socket.off(SocketEvents.MessageNew, handler);
      socket.off(SocketEvents.MessageDelete, onDelete);
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

        <div className="relative shrink-0">
          {chatMenu && (
            <>
              <button
                type="button"
                className="fixed inset-0 z-10 cursor-default"
                aria-label="Close menu"
                onClick={() => setChatMenu(false)}
              />
              <div className="absolute right-0 top-10 z-20 w-56 overflow-hidden rounded-xl border border-white/10 bg-card shadow-xl">
                <button
                  type="button"
                  onClick={() => {
                    if (
                      activeId &&
                      window.confirm(
                        'Delete this chat? It will be removed for you only — the other person keeps their copy.',
                      )
                    ) {
                      deleteChat.mutate(activeId);
                    }
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-red-400 transition-colors hover:bg-white/10"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete chat for me
                </button>
              </div>
            </>
          )}
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Chat options"
            onClick={() => setChatMenu((open) => !open)}
          >
            <MoreVertical className="h-5 w-5" />
          </Button>
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
            <div
              key={m._id}
              className={cn(
                'group relative flex items-center gap-1',
                mine ? 'justify-end' : 'justify-start',
              )}
            >
              {mine && (
                <MessageMenu
                  open={menuFor === m._id}
                  mine={mine}
                  onToggle={() => setMenuFor((id) => (id === m._id ? null : m._id))}
                  onDelete={(forEveryone) => deleteMessage.mutate({ id: m._id, forEveryone })}
                />
              )}
              <div
                className={cn(
                  'max-w-[78%] rounded-2xl px-3.5 py-2 sm:max-w-[65%]',
                  mine ? 'rounded-br-md bg-brand-gradient text-white' : 'rounded-bl-md bg-white/10',
                )}
              >
                <MessageMedia message={m} />
                {m.text && <p className="whitespace-pre-wrap break-words text-[15px]">{m.text}</p>}
                <p className="mt-1 text-right text-[10px] opacity-60">{relativeTime(m.createdAt)}</p>
              </div>
              {!mine && (
                <MessageMenu
                  open={menuFor === m._id}
                  mine={mine}
                  onToggle={() => setMenuFor((id) => (id === m._id ? null : m._id))}
                  onDelete={(forEveryone) => deleteMessage.mutate({ id: m._id, forEveryone })}
                />
              )}
            </div>
          );
        })}
      </div>

      <ChatComposer
        sending={send.isPending}
        onSendText={(body) => send.mutate({ text: body })}
        onSendFile={(file, type) => send.mutate({ file, type })}
      />
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
                  <p className="truncate text-xs text-white/40">{previewOf(c.lastMessage)}</p>
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
