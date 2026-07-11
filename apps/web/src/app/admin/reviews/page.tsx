'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Trash2, EyeOff, Eye } from 'lucide-react';
import type { Paginated } from '@kushlov/types';
import { api, apiError, unwrap } from '@/lib/api';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { StarRatingDisplay } from '@/components/common/star-rating';
import { Skeleton } from '@/components/ui/skeleton';

type AdminReview = {
  id: string;
  rating: number;
  text: string;
  createdAt: string;
  isHidden?: boolean;
  reviewer: { displayName: string; username: string };
  host?: { displayName?: string; username?: string };
};

export default function AdminReviewsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin-reviews'],
    queryFn: () => unwrap<Paginated<AdminReview>>(api.get('/admin/reviews', { params: { limit: 50 } })),
  });

  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/reviews/${id}`),
    onSuccess: () => {
      toast.success('Review deleted');
      qc.invalidateQueries({ queryKey: ['admin-reviews'] });
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const toggleHide = useMutation({
    mutationFn: ({ id, isHidden }: { id: string; isHidden: boolean }) =>
      api.patch(`/admin/reviews/${id}`, { isHidden }),
    onSuccess: () => {
      toast.success('Review updated');
      qc.invalidateQueries({ queryKey: ['admin-reviews'] });
    },
    onError: (e) => toast.error(apiError(e)),
  });

  return (
    <div>
      <PageHeader title="Reviews" subtitle="Moderate host reviews" />
      <div className="space-y-3 p-6">
        {isLoading && <Skeleton className="h-20 w-full rounded-2xl" />}
        {data?.items.map((r) => (
          <div
            key={r.id}
            className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-card p-4 sm:flex-row sm:items-start sm:justify-between"
          >
            <div className="min-w-0">
              <p className="text-sm text-white/50">
                <span className="text-white">{r.reviewer.displayName}</span>
                {' → '}
                <span className="text-white">
                  {(r.host as any)?.displayName ?? 'Host'}
                </span>
                {r.isHidden && (
                  <span className="ml-2 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-300">
                    Hidden
                  </span>
                )}
              </p>
              <StarRatingDisplay rating={r.rating} className="mt-1" />
              {r.text && <p className="mt-2 text-sm text-white/70">{r.text}</p>}
              <p className="mt-1 text-xs text-white/35">{new Date(r.createdAt).toLocaleString()}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => toggleHide.mutate({ id: r.id, isHidden: !r.isHidden })}
              >
                {r.isHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                {r.isHidden ? 'Unhide' : 'Hide'}
              </Button>
              <Button size="sm" variant="destructive" onClick={() => del.mutate(r.id)}>
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            </div>
          </div>
        ))}
        {!isLoading && data?.items.length === 0 && (
          <p className="py-12 text-center text-white/40">No reviews yet.</p>
        )}
      </div>
    </div>
  );
}
