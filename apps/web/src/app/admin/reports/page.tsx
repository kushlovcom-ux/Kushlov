'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ReportStatus } from '@kushlov/types';
import { api, apiError, unwrap } from '@/lib/api';
import { relativeTime } from '@/lib/utils';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

export default function AdminReportsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin-reports'],
    queryFn: () => unwrap<{ items: any[] }>(api.get('/admin/reports')),
  });

  const resolve = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ReportStatus }) =>
      api.patch(`/admin/reports/${id}`, { status }),
    onSuccess: () => {
      toast.success('Report updated');
      qc.invalidateQueries({ queryKey: ['admin-reports'] });
    },
    onError: (e) => toast.error(apiError(e)),
  });

  return (
    <div>
      <PageHeader title="Reports" subtitle="Review user reports" />
      <div className="space-y-3 p-6">
        {isLoading && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        {data?.items.map((r) => (
          <div key={r._id} className="rounded-2xl border border-white/10 bg-card p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium">
                  {r.reporter?.displayName} reported {r.reportedUser?.displayName}
                </p>
                <p className="mt-1 text-sm text-white/60">{r.reason}</p>
                {r.description && <p className="mt-1 text-sm text-white/40">{r.description}</p>}
                <p className="mt-1 text-xs text-white/30">{relativeTime(r.createdAt)}</p>
              </div>
              <Badge variant={r.status === 'resolved' ? 'success' : 'warning'}>{r.status}</Badge>
            </div>
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={() => resolve.mutate({ id: r._id, status: ReportStatus.Resolved })}>
                Resolve
              </Button>
              <Button size="sm" variant="secondary" onClick={() => resolve.mutate({ id: r._id, status: ReportStatus.Dismissed })}>
                Dismiss
              </Button>
            </div>
          </div>
        ))}
        {!isLoading && data?.items.length === 0 && <p className="text-white/40">No reports.</p>}
      </div>
    </div>
  );
}
