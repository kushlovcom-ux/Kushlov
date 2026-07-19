'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ExternalLink, FileText } from 'lucide-react';
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

function isPdfUrl(url: string) {
  return (
    /\.pdf($|\?)/i.test(url) ||
    url.includes('/raw/') ||
    url.startsWith('data:application/pdf') ||
    /\/upload\/.*\.pdf/i.test(url)
  );
}

function pdfEmbedUrl(url: string) {
  // Cloudinary raw PDFs often block iframe embedding; Google viewer works for public HTTPS URLs.
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(url)}`;
  }
  return url;
}

function DocumentPreview({ url, label }: { url: string; label: string }) {
  if (isPdfUrl(url)) {
    return (
      <div className="w-full max-w-md space-y-2 rounded-xl border border-white/10 bg-white/5 p-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <FileText className="h-4 w-4 text-brand-pink" />
          {label} (PDF)
        </div>
        <iframe
          src={pdfEmbedUrl(url)}
          title={label}
          className="h-72 w-full rounded-lg border border-white/10 bg-white"
        />
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-brand-pink hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5" /> Open PDF in new tab
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={label}
        className="h-40 max-w-full rounded-lg border border-white/10 object-contain"
      />
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs text-brand-pink hover:underline"
      >
        <ExternalLink className="h-3.5 w-3.5" /> Open image
      </a>
    </div>
  );
}

function VideoPreview({ url, label }: { url: string; label?: string }) {
  return (
    <div className="space-y-2">
      {label && <p className="text-sm font-medium">{label}</p>}
      <video
        key={url}
        src={url}
        controls
        playsInline
        preload="metadata"
        className="max-h-72 w-full rounded-lg border border-white/10 bg-black"
      >
        Your browser cannot play this video.
      </video>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs text-brand-pink hover:underline"
      >
        <ExternalLink className="h-3.5 w-3.5" /> Open video in new tab
      </a>
    </div>
  );
}

export default function AdminVerificationsPage() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<any>(null);
  const [note, setNote] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('actionable');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-verifications'],
    queryFn: () => unwrap<{ items: any[] }>(api.get('/admin/verifications', { params: { limit: 100 } })),
  });

  const items = useMemo(() => {
    const list = data?.items ?? [];
    if (statusFilter === 'actionable') {
      return list.filter(
        (v) =>
          v.status === VerificationStatus.Pending ||
          v.status === VerificationStatus.NeedMoreInfo,
      );
    }
    if (statusFilter === 'all') return list;
    return list.filter((v) => v.status === statusFilter);
  }, [data?.items, statusFilter]);

  const review = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: VerificationStatus }) =>
      api.patch(`/admin/verifications/${id}/review`, { decision, note }),
    onSuccess: (_res, vars) => {
      toast.success(
        vars.decision === VerificationStatus.Approved
          ? 'Host approved'
          : 'Review submitted',
      );
      setSelected(null);
      setNote('');
      qc.invalidateQueries({ queryKey: ['admin-verifications'] });
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const badge = (s: string) =>
    s === 'approved' ? 'success' : s === 'rejected' ? 'destructive' : 'warning';

  const canAct =
    selected &&
    (selected.status === VerificationStatus.Pending ||
      selected.status === VerificationStatus.NeedMoreInfo);

  return (
    <div>
      <PageHeader title="Host Verifications" subtitle="Review identity submissions" />

      <div className="flex flex-wrap gap-2 px-6 pt-2">
        {(
          [
            { id: 'actionable', label: 'Needs review' },
            { id: 'all', label: 'All' },
            { id: VerificationStatus.Pending, label: 'Pending' },
            { id: VerificationStatus.NeedMoreInfo, label: 'Need more info' },
            { id: VerificationStatus.Approved, label: 'Approved' },
            { id: VerificationStatus.Rejected, label: 'Rejected' },
          ] as const
        ).map((f) => (
          <Button
            key={f.id}
            size="sm"
            variant={statusFilter === f.id ? 'default' : 'secondary'}
            className={statusFilter === f.id ? 'bg-brand-gradient' : undefined}
            onClick={() => setStatusFilter(f.id)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      <div className="grid gap-4 p-6 lg:grid-cols-2">
        {isLoading &&
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        {items.map((v) => (
          <div key={v._id} className="rounded-2xl border border-white/10 bg-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{v.user?.displayName ?? v.basic?.name}</p>
                <p className="text-xs text-white/40">{v.user?.email}</p>
              </div>
              <Badge variant={badge(v.status) as any}>{v.status.replaceAll('_', ' ')}</Badge>
            </div>
            <p className="mt-2 text-sm text-white/50">
              {v.basic?.country} · submitted {relativeTime(v.createdAt)}
            </p>
            <Button
              className="mt-3"
              size="sm"
              onClick={() => {
                setNote(v.reviewNote ?? '');
                setSelected(v);
              }}
            >
              {v.status === VerificationStatus.Approved || v.status === VerificationStatus.Rejected
                ? 'View'
                : 'Review'}
            </Button>
          </div>
        ))}
        {!isLoading && items.length === 0 && (
          <p className="text-white/40">No verification requests in this filter.</p>
        )}
      </div>

      <Dialog
        open={!!selected}
        onOpenChange={(o) => {
          if (!o) {
            setSelected(null);
            setNote('');
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Review verification</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="max-h-[75vh] space-y-5 overflow-y-auto pr-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={badge(selected.status) as any}>
                  {selected.status.replaceAll('_', ' ')}
                </Badge>
                {selected.status === VerificationStatus.Approved && (
                  <p className="text-xs text-emerald-300">
                    Approved — “Need more info” is no longer available for this request.
                  </p>
                )}
              </div>

              <div className="text-sm text-white/70">
                <p>
                  <span className="text-white/40">Name:</span> {selected.basic?.name}
                </p>
                <p>
                  <span className="text-white/40">Gender:</span> {selected.basic?.gender}
                </p>
                <p>
                  <span className="text-white/40">Country:</span> {selected.basic?.country}
                </p>
                <p>
                  <span className="text-white/40">Bio:</span> {selected.basic?.bio}
                </p>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">Documents</p>
                <div className="flex flex-col gap-4">
                  {selected.documents?.governmentId?.url ? (
                    <DocumentPreview
                      url={selected.documents.governmentId.url}
                      label="Government ID"
                    />
                  ) : (
                    <p className="text-sm text-white/40">No government ID uploaded</p>
                  )}
                  {selected.documents?.addressProof?.url && (
                    <DocumentPreview
                      url={selected.documents.addressProof.url}
                      label="Address proof"
                    />
                  )}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">Live selfies</p>
                <div className="flex flex-wrap gap-3">
                  {(selected.selfies?.length ?? 0) === 0 && (
                    <p className="text-sm text-white/40">No selfies uploaded</p>
                  )}
                  {selected.selfies?.map((s: any, i: number) => (
                    <div key={i} className="text-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={s.url}
                        alt={`Selfie ${i + 1}`}
                        className="h-28 rounded-lg border border-white/10 object-cover"
                      />
                      {s.instruction && (
                        <p className="mt-1 max-w-[7rem] text-[10px] text-white/40">{s.instruction}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                {selected.verificationVideo?.url ? (
                  <VideoPreview
                    url={selected.verificationVideo.url}
                    label="Live verification video"
                  />
                ) : (
                  <p className="text-sm text-white/40">No verification video uploaded</p>
                )}
              </div>

              {canAct && (
                <>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Review note (shown to the host)…"
                    className="min-h-[70px] w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm"
                  />

                  <div className="flex flex-wrap gap-2">
                    <Button
                      className="flex-1"
                      loading={review.isPending}
                      onClick={() =>
                        review.mutate({
                          id: selected._id,
                          decision: VerificationStatus.Approved,
                        })
                      }
                    >
                      Approve
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={review.isPending}
                      onClick={() =>
                        review.mutate({
                          id: selected._id,
                          decision: VerificationStatus.NeedMoreInfo,
                        })
                      }
                    >
                      Need more info
                    </Button>
                    <Button
                      variant="destructive"
                      disabled={review.isPending}
                      onClick={() =>
                        review.mutate({
                          id: selected._id,
                          decision: VerificationStatus.Rejected,
                        })
                      }
                    >
                      Reject
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
