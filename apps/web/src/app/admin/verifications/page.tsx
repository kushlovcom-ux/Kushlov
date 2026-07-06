'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { VerificationStatus } from '@kushlov/types';
import { api, apiError, unwrap } from '@/lib/api';
import { relativeTime } from '@/lib/utils';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function AdminVerificationsPage() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<any>(null);
  const [note, setNote] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-verifications'],
    queryFn: () => unwrap<{ items: any[] }>(api.get('/admin/verifications')),
  });

  const review = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: VerificationStatus }) =>
      api.patch(`/admin/verifications/${id}/review`, { decision, note }),
    onSuccess: () => {
      toast.success('Review submitted');
      setSelected(null);
      setNote('');
      qc.invalidateQueries({ queryKey: ['admin-verifications'] });
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const badge = (s: string) =>
    s === 'approved' ? 'success' : s === 'rejected' ? 'destructive' : 'warning';

  return (
    <div>
      <PageHeader title="Host Verifications" subtitle="Review identity submissions" />
      <div className="grid gap-4 p-6 lg:grid-cols-2">
        {isLoading && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        {data?.items.map((v) => (
          <div key={v._id} className="rounded-2xl border border-white/10 bg-card p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold">{v.user?.displayName ?? v.basic?.name}</p>
                <p className="text-xs text-white/40">{v.user?.email}</p>
              </div>
              <Badge variant={badge(v.status) as any}>{v.status.replace('_', ' ')}</Badge>
            </div>
            <p className="mt-2 text-sm text-white/50">
              {v.basic?.country} · submitted {relativeTime(v.createdAt)}
            </p>
            <Button className="mt-3" size="sm" onClick={() => setSelected(v)}>
              Review
            </Button>
          </div>
        ))}
        {!isLoading && data?.items.length === 0 && (
          <p className="text-white/40">No verification requests.</p>
        )}
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review verification</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="max-h-[70vh] space-y-4 overflow-y-auto">
              <div className="text-sm text-white/70">
                <p><span className="text-white/40">Name:</span> {selected.basic?.name}</p>
                <p><span className="text-white/40">Gender:</span> {selected.basic?.gender}</p>
                <p><span className="text-white/40">Country:</span> {selected.basic?.country}</p>
                <p><span className="text-white/40">Bio:</span> {selected.basic?.bio}</p>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">Documents</p>
                <div className="flex flex-wrap gap-3">
                  {selected.documents?.governmentId?.url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={selected.documents.governmentId.url} alt="Gov ID" className="h-28 rounded-lg border border-white/10" />
                  )}
                  {selected.documents?.addressProof?.url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={selected.documents.addressProof.url} alt="Address" className="h-28 rounded-lg border border-white/10" />
                  )}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">Live selfies</p>
                <div className="flex flex-wrap gap-3">
                  {selected.selfies?.map((s: any, i: number) => (
                    <div key={i} className="text-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.url} alt={`Selfie ${i}`} className="h-28 rounded-lg border border-white/10" />
                      {s.instruction && <p className="mt-1 text-[10px] text-white/40">{s.instruction}</p>}
                    </div>
                  ))}
                </div>
              </div>

              {selected.verificationVideo?.url && (
                <div>
                  <p className="mb-2 text-sm font-medium">Verification video</p>
                  <video src={selected.verificationVideo.url} controls className="max-h-56 rounded-lg" />
                </div>
              )}

              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Review note (shown to the host)…"
                className="min-h-[70px] w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm"
              />

              <div className="flex gap-2">
                <Button className="flex-1" loading={review.isPending} onClick={() => review.mutate({ id: selected._id, decision: VerificationStatus.Approved })}>
                  Approve
                </Button>
                <Button variant="secondary" onClick={() => review.mutate({ id: selected._id, decision: VerificationStatus.NeedMoreInfo })}>
                  Need more info
                </Button>
                <Button variant="destructive" onClick={() => review.mutate({ id: selected._id, decision: VerificationStatus.Rejected })}>
                  Reject
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
