'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, apiError } from '@/lib/api';
import { StarRatingInput } from '@/components/common/star-rating';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type Props = {
  open: boolean;
  hostId: string;
  hostName: string;
  onClose: () => void;
};

/** Optional post-call review prompt for normal users after talking with a host. */
export function PostCallReviewDialog({ open, hostId, hostName, onClose }: Props) {
  const qc = useQueryClient();
  const [rating, setRating] = useState(5);
  const [text, setText] = useState('');

  const submit = useMutation({
    mutationFn: () => api.post('/reviews', { hostId, rating, text: text.trim() }),
    onSuccess: () => {
      toast.success('Thanks for your review!');
      qc.invalidateQueries({ queryKey: ['host-reviews', hostId] });
      qc.invalidateQueries({ queryKey: ['my-review', hostId] });
      qc.invalidateQueries({ queryKey: ['user', hostId] });
      qc.invalidateQueries({ queryKey: ['discover'] });
      setText('');
      setRating(5);
      onClose();
    },
    onError: (e) => toast.error(apiError(e)),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>How was your call with {hostName}?</DialogTitle>
          <DialogDescription>
            Optional — leave a quick rating, or skip. You can always review later on their profile.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <StarRatingInput value={rating} onChange={setRating} />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Share your experience (optional)…"
            maxLength={1000}
            rows={3}
            className="flex w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-pink"
          />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={onClose} disabled={submit.isPending}>
              Skip
            </Button>
            <Button loading={submit.isPending} onClick={() => submit.mutate()} disabled={rating < 1}>
              Submit review
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
