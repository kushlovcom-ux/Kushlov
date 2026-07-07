'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { MessageCircle, Phone, Video, Radio, Search } from 'lucide-react';
import type { PublicUser } from '@kushlov/types';
import { api, unwrap } from '@/lib/api';
import { relativeTime } from '@/lib/utils';
import { useAuthStore } from '@/store/auth';
import { PageHeader } from '@/components/app/page-header';
import { Input } from '@/components/ui/input';
import { UserAvatar } from '@/components/common/user-avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface InteractionItem {
  id: string;
  kind: 'message_chat' | 'audio_call' | 'video_call' | 'live_chat';
  at: string;
  summary: string;
  otherUser: {
    id: string;
    displayName: string;
    username: string;
    avatarUrl?: string;
    role: string;
  };
}

const kindMeta = {
  message_chat: { label: 'Message chat', icon: MessageCircle },
  audio_call: { label: 'Audio call', icon: Phone },
  video_call: { label: 'Video call', icon: Video },
  live_chat: { label: 'Live chat', icon: Radio },
} as const;

export default function HistoryPage() {
  const user = useAuthStore((s) => s.user);
  const isHost = user?.role === 'host';
  const [q, setQ] = useState('');
  const [searchPeople, setSearchPeople] = useState('');

  const history = useQuery({
    queryKey: ['my-interactions', q],
    queryFn: () =>
      unwrap<{ items: InteractionItem[]; searchRole: string }>(
        api.get('/users/me/interactions', { params: { q: q || undefined, limit: 100 } }),
      ),
  });

  const peopleSearch = useQuery({
    queryKey: ['history-people-search', searchPeople, isHost],
    queryFn: () =>
      unwrap<{ items: PublicUser[] }>(
        api.get('/users/me/search-contacts', { params: { q: searchPeople } }),
      ),
    enabled: searchPeople.trim().length >= 2,
  });

  const filterKind = (kind: InteractionItem['kind']) =>
    history.data?.items.filter((i) => i.kind === kind) ?? [];

  const allItems = history.data?.items ?? [];

  return (
    <div>
      <PageHeader
        title="Activity history"
        subtitle={
          isHost
            ? 'Your chats and calls with users — search users by name below'
            : 'Your chats and calls with hosts — search hosts by name below'
        }
      />

      <div className="space-y-6 p-6">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter history by name…"
              className="pl-9"
            />
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <Input
              value={searchPeople}
              onChange={(e) => setSearchPeople(e.target.value)}
              placeholder={isHost ? 'Search users by name…' : 'Search hosts by name…'}
              className="pl-9"
            />
          </div>
        </div>

        {searchPeople.trim().length >= 2 && (
          <div className="rounded-2xl border border-white/10 bg-card/50 p-4">
            <p className="mb-3 text-sm font-medium text-white/70">
              {isHost ? 'Users matching your search' : 'Hosts matching your search'}
            </p>
            {peopleSearch.isLoading && <Skeleton className="h-12 rounded-xl" />}
            <div className="space-y-2">
              {peopleSearch.data?.items.map((p) => (
                <Link
                  key={p.id}
                  href={`/u/${p.id}`}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-card px-4 py-3 hover:bg-white/5"
                >
                  <UserAvatar name={p.displayName} src={p.avatarUrl} online={p.isOnline} />
                  <div>
                    <p className="font-medium">{p.displayName}</p>
                    <p className="text-xs text-white/45">@{p.username}</p>
                  </div>
                </Link>
              ))}
              {!peopleSearch.isLoading && peopleSearch.data?.items.length === 0 && (
                <p className="text-sm text-white/40">No matches found.</p>
              )}
            </div>
          </div>
        )}

        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">All ({allItems.length})</TabsTrigger>
            <TabsTrigger value="message_chat">Chat</TabsTrigger>
            <TabsTrigger value="audio_call">Audio</TabsTrigger>
            <TabsTrigger value="video_call">Video</TabsTrigger>
            <TabsTrigger value="live_chat">Live chat</TabsTrigger>
          </TabsList>

          {(['all', 'message_chat', 'audio_call', 'video_call', 'live_chat'] as const).map(
            (tab) => {
              const items =
                tab === 'all' ? allItems : filterKind(tab as InteractionItem['kind']);
              return (
                <TabsContent key={tab} value={tab} className="mt-4 space-y-2">
                  {history.isLoading &&
                    Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-16 rounded-xl" />
                    ))}

                  {items.map((item) => {
                    const meta = kindMeta[item.kind];
                    const Icon = meta.icon;
                    return (
                      <div
                        key={`${item.kind}-${item.id}`}
                        className="flex items-start gap-3 rounded-xl border border-white/10 bg-card p-4"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-gradient/20">
                          <Icon className="h-5 w-5 text-brand-pink" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link href={`/u/${item.otherUser.id}`} className="font-semibold hover:underline">
                              {item.otherUser.displayName}
                            </Link>
                            <span className="text-xs text-white/35">@{item.otherUser.username}</span>
                          </div>
                          <p className="mt-0.5 text-xs capitalize text-brand-pink/80">{meta.label}</p>
                          <p className="mt-1 line-clamp-2 text-sm text-white/55">{item.summary}</p>
                          <p className="mt-1 text-[10px] text-white/30">{relativeTime(item.at)}</p>
                        </div>
                        <UserAvatar
                          name={item.otherUser.displayName}
                          src={item.otherUser.avatarUrl}
                          className="h-10 w-10 shrink-0"
                        />
                      </div>
                    );
                  })}

                  {!history.isLoading && items.length === 0 && (
                    <p className="py-12 text-center text-white/40">
                      No {tab === 'all' ? 'activity' : kindMeta[tab as keyof typeof kindMeta].label.toLowerCase()} yet.
                    </p>
                  )}
                </TabsContent>
              );
            },
          )}
        </Tabs>
      </div>
    </div>
  );
}
