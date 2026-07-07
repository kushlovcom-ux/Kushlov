'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Heart,
  Radio,
  MessageCircle,
  Gift,
  Gem,
  PhoneCall,
  type LucideIcon,
} from 'lucide-react';
import { api, unwrap } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';

interface PlatformStats {
  liveStreams: number;
  activeAudioCalls: number;
  activeVideoCalls: number;
  activeChats: number;
  landing: {
    membersLabel: string;
    verifiedHostsLabel: string;
    liveRoomsLabel: string;
  };
}

const features: {
  icon: LucideIcon;
  title: string;
  desc: string;
  liveLabel?: (s: PlatformStats) => string | null;
}[] = [
  {
    icon: Heart,
    title: 'Smart Matching',
    desc: 'Like, match and discover people who fit what you are looking for.',
  },
  {
    icon: MessageCircle,
    title: 'Realtime Chat',
    desc: 'Text, emoji, photos, voice notes, read receipts and typing indicators.',
    liveLabel: (s) => `Live Message Chat : ${s.activeChats}`,
  },
  {
    icon: PhoneCall,
    title: 'Audio & Video Calls',
    desc: 'Crystal-clear 1:1 calls powered by LiveKit with in-call gifting.',
    liveLabel: (s) =>
      `Live Audio Call : ${s.activeAudioCalls} · Live Video Call : ${s.activeVideoCalls}`,
  },
  {
    icon: Radio,
    title: 'Live Streaming',
    desc: 'Join host live rooms, send gifts and connect in real time.',
    liveLabel: (s) => `Live : ${s.liveStreams}`,
  },
  { icon: Gift, title: 'Gifts & Coins', desc: 'Send animated gifts. Hosts convert engagement into gold coins.' },
  { icon: Gem, title: 'Diamond Wallet', desc: 'Buy diamonds securely and spend them across the whole platform.' },
];

export function LandingHeroStats() {
  const { data, isLoading } = useQuery({
    queryKey: ['platform-stats'],
    queryFn: () => unwrap<PlatformStats>(api.get('/settings/stats')),
    refetchInterval: 30_000,
  });

  if (isLoading) {
    return (
      <div className="mt-10 flex items-center gap-8">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-20" />
        ))}
      </div>
    );
  }

  const landing = data?.landing ?? {
    membersLabel: '120k+',
    verifiedHostsLabel: '8k+',
    liveRoomsLabel: '24/7',
  };

  return (
    <div className="mt-10 flex flex-wrap items-center gap-8 text-sm text-white/50">
      <div>
        <div className="text-2xl font-bold text-white">{landing.membersLabel}</div>
        members
      </div>
      <div>
        <div className="text-2xl font-bold text-white">{landing.verifiedHostsLabel}</div>
        verified hosts
      </div>
      <div>
        <div className="text-2xl font-bold text-white">{landing.liveRoomsLabel}</div>
        live rooms
      </div>
    </div>
  );
}

export function LandingFeatureGrid() {
  const { data } = useQuery({
    queryKey: ['platform-stats'],
    queryFn: () => unwrap<PlatformStats>(api.get('/settings/stats')),
    refetchInterval: 30_000,
  });

  const stats: PlatformStats = data ?? {
    liveStreams: 0,
    activeAudioCalls: 0,
    activeVideoCalls: 0,
    activeChats: 0,
    landing: { membersLabel: '120k+', verifiedHostsLabel: '8k+', liveRoomsLabel: '24/7' },
  };

  return (
    <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {features.map((f) => {
        const live = f.liveLabel?.(stats);
        return (
          <div
            key={f.title}
            className="glass rounded-2xl p-6 transition-transform hover:-translate-y-1"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-gradient">
              <f.icon className="h-6 w-6 text-white" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
            {live && (
              <p className="mt-1 text-xs font-semibold text-emerald-400">{live}</p>
            )}
            <p className="mt-2 text-sm text-white/55">{f.desc}</p>
          </div>
        );
      })}
    </div>
  );
}
