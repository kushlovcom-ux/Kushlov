'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Pencil, Trash2 } from 'lucide-react';
import { api, apiError, unwrap } from '@/lib/api';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

type GiftForm = {
  name: string;
  diamondCost: number;
  goldValue: number;
  imageUrl: string;
  isWelcomeGift: boolean;
};

const emptyForm: GiftForm = {
  name: '',
  diamondCost: 10,
  goldValue: 5,
  imageUrl: '',
  isWelcomeGift: false,
};

export default function AdminGiftsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState<GiftForm>(emptyForm);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-gifts'],
    queryFn: () => unwrap<any[]>(api.get('/admin/gifts')),
  });

  const create = useMutation({
    mutationFn: () => api.post('/admin/gifts', form),
    onSuccess: () => {
      toast.success(
        form.isWelcomeGift
          ? 'Welcome gift created — new users will receive these diamonds'
          : 'Gift created',
      );
      setForm(emptyForm);
      setCreateOpen(false);
      qc.invalidateQueries({ queryKey: ['admin-gifts'] });
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const update = useMutation({
    mutationFn: () =>
      api.patch(`/admin/gifts/${editing._id}`, {
        name: editing.name,
        imageUrl: editing.imageUrl,
        diamondCost: Number(editing.diamondCost),
        goldValue: Number(editing.goldValue),
        isActive: editing.isActive,
        isWelcomeGift: !!editing.isWelcomeGift,
      }),
    onSuccess: () => {
      toast.success('Gift updated');
      setEditing(null);
      qc.invalidateQueries({ queryKey: ['admin-gifts'] });
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/admin/gifts/${id}`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-gifts'] }),
    onError: (e) => toast.error(apiError(e)),
  });

  const setWelcome = useMutation({
    mutationFn: ({ id, isWelcomeGift }: { id: string; isWelcomeGift: boolean }) =>
      api.patch(`/admin/gifts/${id}`, { isWelcomeGift }),
    onSuccess: () => {
      toast.success('Welcome gift updated');
      qc.invalidateQueries({ queryKey: ['admin-gifts'] });
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/gifts/${id}`),
    onSuccess: () => {
      toast.success('Gift deleted');
      qc.invalidateQueries({ queryKey: ['admin-gifts'] });
    },
    onError: (e) => toast.error(apiError(e)),
  });

  return (
    <div>
      <PageHeader
        title="Gifts"
        subtitle="Catalog gifts and set one welcome gift for new normal users"
        action={
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
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
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Image URL</Label>
                  <Input
                    value={form.imageUrl}
                    onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Diamond cost / welcome amount</Label>
                    <Input
                      type="number"
                      min={1}
                      value={form.diamondCost}
                      onChange={(e) => setForm({ ...form, diamondCost: +e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Gold value</Label>
                    <Input
                      type="number"
                      min={0}
                      value={form.goldValue}
                      onChange={(e) => setForm({ ...form, goldValue: +e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-white/10 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">Welcome gift</p>
                    <p className="text-xs text-white/40">
                      Auto-credit these diamonds when a normal user creates their first profile
                    </p>
                  </div>
                  <Switch
                    checked={form.isWelcomeGift}
                    onCheckedChange={(v) => setForm({ ...form, isWelcomeGift: v })}
                  />
                </div>
                <Button className="w-full" loading={create.isPending} onClick={() => create.mutate()}>
                  Create
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <p className="px-6 text-sm text-white/45">
        Mark one gift as the welcome gift. Its diamond cost is credited once to each new normal user.
      </p>

      <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading &&
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-52 rounded-2xl" />)}
        {data?.map((g) => (
          <div key={g._id} className="rounded-2xl border border-white/10 bg-card p-5 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={g.imageUrl} alt={g.name} className="mx-auto h-16 w-16 object-contain" />
            <p className="mt-2 font-semibold">{g.name}</p>
            <p className="text-sm text-white/50">
              {g.diamondCost} 💎 → {g.goldValue} 🪙
            </p>
            {g.isWelcomeGift && (
              <p className="mt-1 text-xs font-medium text-emerald-400">Welcome gift</p>
            )}
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <Button
                size="sm"
                variant={g.isActive ? 'secondary' : 'default'}
                onClick={() => toggle.mutate({ id: g._id, isActive: !g.isActive })}
              >
                {g.isActive ? 'Disable' : 'Enable'}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setWelcome.mutate({ id: g._id, isWelcomeGift: !g.isWelcomeGift })}
              >
                {g.isWelcomeGift ? 'Unset welcome' : 'Set welcome'}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setEditing({ ...g })}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  if (confirm(`Delete gift “${g.name}”?`)) remove.mutate(g._id);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit gift</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Image URL</Label>
                <Input
                  value={editing.imageUrl}
                  onChange={(e) => setEditing({ ...editing, imageUrl: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Diamond cost</Label>
                  <Input
                    type="number"
                    min={1}
                    value={editing.diamondCost}
                    onChange={(e) => setEditing({ ...editing, diamondCost: +e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Gold value</Label>
                  <Input
                    type="number"
                    min={0}
                    value={editing.goldValue}
                    onChange={(e) => setEditing({ ...editing, goldValue: +e.target.value })}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-white/10 px-3 py-2">
                <Label>Active</Label>
                <Switch
                  checked={!!editing.isActive}
                  onCheckedChange={(v) => setEditing({ ...editing, isActive: v })}
                />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-white/10 px-3 py-2">
                <div>
                  <p className="text-sm font-medium">Welcome gift</p>
                  <p className="text-xs text-white/40">Only one welcome gift can be active</p>
                </div>
                <Switch
                  checked={!!editing.isWelcomeGift}
                  onCheckedChange={(v) => setEditing({ ...editing, isWelcomeGift: v })}
                />
              </div>
              <Button className="w-full" loading={update.isPending} onClick={() => update.mutate()}>
                Save changes
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
