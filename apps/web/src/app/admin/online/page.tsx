'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapPin } from 'lucide-react';
import { Role } from '@kushlov/types';
import { api, unwrap } from '@/lib/api';
import { PageHeader } from '@/components/app/page-header';
import { Input } from '@/components/ui/input';
import { UserAvatar } from '@/components/common/user-avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface OnlineUser {
  id: string;
  displayName: string;
  username: string;
  role: string;
  avatarUrl?: string;
  locationLabel: string;
}

type RoleFilter = 'all' | 'user' | 'host';

export default function AdminOnlinePage() {
  const [q, setQ] = useState('');
  const [role, setRole] = useState<RoleFilter>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-online', q, role],
    queryFn: () =>
      unwrap<{ items: OnlineUser[]; total: number }>(
        api.get('/admin/online', {
          params: {
            q: q || undefined,
            role: role === 'all' ? undefined : role,
          },
        }),
      ),
    refetchInterval: 15_000,
  });

  const filters: { id: RoleFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'user', label: 'Normal users' },
    { id: 'host', label: 'Hosts' },
  ];

  return (
    <div>
      <PageHeader
        title="Online now"
        subtitle={
          role === 'user'
            ? 'Normal users currently online'
            : role === 'host'
              ? 'Hosts currently online'
              : 'Users and hosts currently connected'
        }
        action={
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name…"
            className="w-full max-w-xs"
          />
        }
      />

      <div className="flex flex-wrap gap-2 px-6 pt-2">
        {filters.map((f) => (
          <Button
            key={f.id}
            size="sm"
            variant={role === f.id ? 'default' : 'secondary'}
            className={cn(role === f.id && 'bg-brand-gradient')}
            onClick={() => setRole(f.id)}
          >
            {f.label}
            {role === f.id && data != null && (
              <span className="ml-1.5 text-xs opacity-80">({data.total})</span>
            )}
          </Button>
        ))}
      </div>

      <div className="space-y-2 p-6">
        {isLoading &&
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}

        {data?.items.map((u) => {
          const isHost = u.role === Role.Host;
          return (
            <div
              key={u.id}
              className="flex items-center gap-4 rounded-xl border border-white/10 bg-card p-4"
            >
              <div className="relative">
                <UserAvatar name={u.displayName} src={u.avatarUrl} />
                <span
                  className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card ${
                    isHost ? 'bg-emerald-400' : 'bg-blue-400'
                  }`}
                  title={isHost ? 'Host online' : 'User online'}
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{u.displayName}</p>
                  <Badge variant={isHost ? 'success' : 'secondary'} className="capitalize">
                    {u.role}
                  </Badge>
                </div>
                <p className="text-xs text-white/45">@{u.username}</p>
                <p className="mt-1 flex items-center gap-1 text-xs text-white/55">
                  <MapPin className="h-3 w-3 shrink-0 text-brand-pink" />
                  <span className="truncate">{u.locationLabel}</span>
                </p>
              </div>
            </div>
          );
        })}

        {!isLoading && data?.items.length === 0 && (
          <p className="py-16 text-center text-white/40">
            {role === 'user'
              ? 'No normal users online right now.'
              : role === 'host'
                ? 'No hosts online right now.'
                : 'No users online right now.'}
          </p>
        )}
      </div>
    </div>
  );
}
