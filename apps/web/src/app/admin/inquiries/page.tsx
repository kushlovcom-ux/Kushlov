'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, apiError, unwrap } from '@/lib/api';
import { relativeTime } from '@/lib/utils';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface Inquiry {
  _id: string;
  subject: string;
  category: string;
  message: string;
  status: string;
  adminReply?: string;
  adminNote?: string;
  createdAt: string;
  user?: { displayName: string; username: string; email: string; avatarUrl?: string };
}

export default function AdminInquiriesPage() {
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['admin-inquiries'],
    queryFn: () => unwrap<{ items: Inquiry[] }>(api.get('/admin/inquiries')),
  });

  const update = useMutation({
    mutationFn: ({
      id,
      adminReply,
      status,
    }: {
      id: string;
      adminReply?: string;
      status?: string;
    }) => api.patch(`/admin/inquiries/${id}`, { adminReply, status }),
    onSuccess: () => {
      toast.success('Inquiry updated');
      qc.invalidateQueries({ queryKey: ['admin-inquiries'] });
      qc.invalidateQueries({ queryKey: ['admin-badges'] });
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/inquiries/${id}`),
    onSuccess: () => {
      toast.success('Inquiry removed');
      qc.invalidateQueries({ queryKey: ['admin-inquiries'] });
      qc.invalidateQueries({ queryKey: ['admin-badges'] });
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const statusVariant = (s: string) =>
    s === 'resolved' ? 'success' : s === 'in_progress' ? 'warning' : 'secondary';

  return (
    <div>
      <PageHeader title="Contact Inquiries" subtitle="View, reply to and manage user messages" />
      <div className="space-y-4 p-6">
        {isLoading &&
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}

        {data?.items.map((inq) => {
          const reply = drafts[inq._id] ?? inq.adminReply ?? '';
          return (
            <div key={inq._id} className="rounded-2xl border border-white/10 bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{inq.subject}</p>
                  <p className="mt-1 text-sm text-white/50">
                    {inq.user?.displayName} · @{inq.user?.username} · {inq.user?.email}
                  </p>
                  <p className="mt-1 text-xs capitalize text-white/35">
                    {inq.category.replace(/_/g, ' ')} · {relativeTime(inq.createdAt)}
                  </p>
                </div>
                <Badge variant={statusVariant(inq.status) as any} className="capitalize">
                  {inq.status.replace(/_/g, ' ')}
                </Badge>
              </div>

              <p className="mt-4 rounded-xl bg-white/5 p-4 text-sm text-white/70">{inq.message}</p>

              <div className="mt-4 space-y-2">
                <Label>Reply to user</Label>
                <Textarea
                  rows={3}
                  placeholder="Your reply will be visible to the user on their Contact page…"
                  value={reply}
                  onChange={(e) => setDrafts({ ...drafts, [inq._id]: e.target.value })}
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  loading={update.isPending && update.variables?.id === inq._id}
                  onClick={() =>
                    update.mutate({ id: inq._id, adminReply: reply, status: 'in_progress' })
                  }
                >
                  Send reply
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => update.mutate({ id: inq._id, status: 'resolved' })}
                >
                  Mark resolved
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-400 hover:text-red-300"
                  onClick={() => remove.mutate(inq._id)}
                >
                  <Trash2 className="h-4 w-4" /> Remove
                </Button>
              </div>
            </div>
          );
        })}

        {!isLoading && data?.items.length === 0 && (
          <p className="py-12 text-center text-white/40">No inquiries yet.</p>
        )}
      </div>
    </div>
  );
}
