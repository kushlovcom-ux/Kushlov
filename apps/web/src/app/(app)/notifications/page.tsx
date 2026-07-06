'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';
import { api, unwrap } from '@/lib/api';
import { relativeTime } from '@/lib/utils';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface Notif {
  _id: string;
  type: string;
  title: string;
  body?: string;
  isRead: boolean;
  createdAt: string;
}

export default function NotificationsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () =>
      unwrap<{ items: Notif[]; unread: number }>(api.get('/notifications', { params: { limit: 50 } })),
  });

  const markAll = useMutation({
    mutationFn: () => api.patch('/notifications/read-all'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle={data?.unread ? `${data.unread} unread` : 'You are all caught up'}
        action={
          <Button variant="secondary" size="sm" onClick={() => markAll.mutate()}>
            <CheckCheck className="h-4 w-4" /> Mark all read
          </Button>
        }
      />
      <div className="mx-auto max-w-2xl space-y-2 p-6">
        {isLoading &&
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}

        {!isLoading && data?.items.length === 0 && (
          <div className="flex flex-col items-center py-24 text-white/40">
            <Bell className="h-10 w-10" />
            <p className="mt-3">No notifications yet.</p>
          </div>
        )}

        {data?.items.map((n) => (
          <div
            key={n._id}
            className={`rounded-xl border p-4 ${
              n.isRead ? 'border-white/10 bg-card/50' : 'border-brand-pink/30 bg-brand-pink/5'
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium">{n.title}</p>
                {n.body && <p className="mt-0.5 text-sm text-white/50">{n.body}</p>}
              </div>
              <span className="whitespace-nowrap text-xs text-white/40">
                {relativeTime(n.createdAt)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
