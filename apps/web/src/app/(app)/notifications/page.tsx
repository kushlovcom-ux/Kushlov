'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';
import { api, unwrap } from '@/lib/api';
import { relativeTime } from '@/lib/utils';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface NotifData {
  kind?: string;
  type?: string;
  callerId?: string;
  senderId?: string;
}

interface Notif {
  _id: string;
  type: string;
  title: string;
  body?: string;
  actor?: string | { _id?: string; id?: string };
  data?: NotifData;
  isRead: boolean;
  createdAt: string;
}

function refId(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    const row = value as { _id?: string; id?: string };
    const id = row._id || row.id;
    if (id) return String(id);
  }
  return undefined;
}

/** Caller to open when a call or missed-call notification is clicked. */
function callerProfileId(n: Notif): string | undefined {
  const data = n.data ?? {};
  const kind = String(data.kind ?? '');
  const type = String(data.type ?? n.type ?? '');
  const isCall =
    n.type === 'call' ||
    n.type === 'missed_call' ||
    kind === 'incoming_call' ||
    kind === 'missed_call' ||
    type === 'AUDIO_CALL' ||
    type === 'VIDEO_CALL' ||
    type === 'MISSED_AUDIO_CALL' ||
    type === 'MISSED_VIDEO_CALL';
  if (!isCall) return undefined;
  return data.callerId || data.senderId || refId(n.actor);
}

export default function NotificationsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const markedRead = useRef(false);
  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () =>
      unwrap<{ items: Notif[]; unread: number }>(api.get('/notifications', { params: { limit: 50 } })),
  });

  // Opening the page counts as "seen" — clear unread badges automatically.
  useEffect(() => {
    if (!data?.unread || markedRead.current) return;
    markedRead.current = true;
    api
      .patch('/notifications/read-all')
      .then(() => {
        qc.invalidateQueries({ queryKey: ['notifications'] });
        qc.invalidateQueries({ queryKey: ['nav-badges'] });
      })
      .catch(() => {
        markedRead.current = false;
      });
  }, [data?.unread, qc]);

  const markAll = useMutation({
    mutationFn: () => api.patch('/notifications/read-all'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['nav-badges'] });
    },
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

        {data?.items.map((n) => {
          const profileId = callerProfileId(n);
          return (
            <button
              key={n._id}
              type="button"
              onClick={() => {
                if (profileId) router.push(`/u/${profileId}`);
              }}
              className={`w-full rounded-xl border p-4 text-left ${
                n.isRead ? 'border-white/10 bg-card/50' : 'border-brand-pink/30 bg-brand-pink/5'
              } ${profileId ? 'cursor-pointer transition-colors hover:border-brand-pink/50' : 'cursor-default'}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium">{n.title}</p>
                  {n.body && <p className="mt-0.5 text-sm text-white/50">{n.body}</p>}
                  {profileId ? (
                    <p className="mt-1 text-xs text-brand-pink">View caller profile</p>
                  ) : null}
                </div>
                <span className="whitespace-nowrap text-xs text-white/40">
                  {relativeTime(n.createdAt)}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
