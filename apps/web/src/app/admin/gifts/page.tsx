'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, apiError, unwrap } from '@/lib/api';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export default function AdminGiftsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: '', diamondCost: 10, goldValue: 5, imageUrl: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['admin-gifts'],
    queryFn: () => unwrap<any[]>(api.get('/admin/gifts')),
  });

  const create = useMutation({
    mutationFn: () => api.post('/admin/gifts', form),
    onSuccess: () => {
      toast.success('Gift created');
      qc.invalidateQueries({ queryKey: ['admin-gifts'] });
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/admin/gifts/${id}`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-gifts'] }),
  });

  return (
    <div>
      <PageHeader
        title="Gifts"
        subtitle="Manage the gift catalog"
        action={
          <Dialog>
            <DialogTrigger asChild>
              <Button>New gift</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create gift</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Name</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Image URL</Label>
                  <Input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Diamond cost</Label>
                    <Input type="number" value={form.diamondCost} onChange={(e) => setForm({ ...form, diamondCost: +e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Gold value</Label>
                    <Input type="number" value={form.goldValue} onChange={(e) => setForm({ ...form, goldValue: +e.target.value })} />
                  </div>
                </div>
                <Button className="w-full" loading={create.isPending} onClick={() => create.mutate()}>
                  Create
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />
      <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
        {data?.map((g) => (
          <div key={g._id} className="rounded-2xl border border-white/10 bg-card p-5 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={g.imageUrl} alt={g.name} className="mx-auto h-16 w-16 object-contain" />
            <p className="mt-2 font-semibold">{g.name}</p>
            <p className="text-sm text-white/50">{g.diamondCost} 💎 → {g.goldValue} 🪙</p>
            <Button
              size="sm"
              variant={g.isActive ? 'secondary' : 'default'}
              className="mt-3"
              onClick={() => toggle.mutate({ id: g._id, isActive: !g.isActive })}
            >
              {g.isActive ? 'Disable' : 'Enable'}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
