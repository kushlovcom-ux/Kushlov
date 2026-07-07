'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { api, apiError, unwrap } from '@/lib/api';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function AdminSettingsPage() {
  const qc = useQueryClient();
  const settings = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => unwrap<any>(api.get('/admin/settings')),
  });
  const instructions = useQuery({
    queryKey: ['admin-instructions'],
    queryFn: () => unwrap<any[]>(api.get('/admin/instructions')),
  });

  const [form, setForm] = useState<any>(null);
  const [newInstruction, setNewInstruction] = useState('');

  useEffect(() => {
    if (settings.data && !form) {
      setForm({
        ...settings.data,
        landing: settings.data.landing ?? {
          membersLabel: '120k+',
          verifiedHostsLabel: '8k+',
          liveRoomsLabel: '24/7',
        },
      });
    }
  }, [settings.data, form]);

  const save = useMutation({
    mutationFn: () =>
      api.patch('/admin/settings', {
        goldConversionRatio: form.goldConversionRatio,
        rates: form.rates,
        features: form.features,
        withdraw: form.withdraw,
        diamondPackages: form.diamondPackages,
        landing: form.landing,
      }),
    onSuccess: () => {
      toast.success('Settings saved');
      qc.invalidateQueries({ queryKey: ['admin-settings'] });
      qc.invalidateQueries({ queryKey: ['platform-stats'] });
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const addInstruction = useMutation({
    mutationFn: () => api.post('/admin/instructions', { text: newInstruction, category: 'general' }),
    onSuccess: () => {
      setNewInstruction('');
      qc.invalidateQueries({ queryKey: ['admin-instructions'] });
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const delInstruction = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/instructions/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-instructions'] }),
  });

  if (!form) return <div className="p-6 text-white/40">Loading…</div>;

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Rates, conversions and platform features"
        action={
          <Button loading={save.isPending} onClick={() => save.mutate()}>
            Save changes
          </Button>
        }
      />
      <div className="grid gap-6 p-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Rates & conversion</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Gold conversion ratio (gold per diamond spent)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.goldConversionRatio}
                onChange={(e) => setForm({ ...form, goldConversionRatio: +e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Audio call / minute (diamonds)</Label>
              <Input
                type="number"
                value={form.rates.audioCallPerMinute}
                onChange={(e) => setForm({ ...form, rates: { ...form.rates, audioCallPerMinute: +e.target.value } })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Video call / minute (diamonds)</Label>
              <Input
                type="number"
                value={form.rates.videoCallPerMinute}
                onChange={(e) => setForm({ ...form, rates: { ...form.rates, videoCallPerMinute: +e.target.value } })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Host DM chat / message (diamonds)</Label>
              <Input
                type="number"
                value={form.rates.chatPerMessage ?? form.rates.liveChatPerMessage}
                onChange={(e) => setForm({ ...form, rates: { ...form.rates, chatPerMessage: +e.target.value } })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Live chat / message (diamonds)</Label>
              <Input
                type="number"
                value={form.rates.liveChatPerMessage}
                onChange={(e) => setForm({ ...form, rates: { ...form.rates, liveChatPerMessage: +e.target.value } })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Features</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(['liveEnabled', 'callsEnabled', 'giftsEnabled'] as const).map((f) => (
              <div key={f} className="flex items-center justify-between">
                <Label className="capitalize">{f.replace('Enabled', '')}</Label>
                <Switch
                  checked={form.features[f]}
                  onCheckedChange={(v) => setForm({ ...form, features: { ...form.features, [f]: v } })}
                />
              </div>
            ))}
            <div className="space-y-1.5">
              <Label>Min withdrawal (gold)</Label>
              <Input
                type="number"
                value={form.withdraw.minGold}
                onChange={(e) => setForm({ ...form, withdraw: { ...form.withdraw, minGold: +e.target.value } })}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Diamond packages (USD & INR)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(form.diamondPackages ?? []).map((pkg: any, idx: number) => (
              <div
                key={pkg.id ?? idx}
                className="grid gap-3 rounded-xl border border-white/10 bg-white/5 p-4 sm:grid-cols-2 lg:grid-cols-4"
              >
                <div className="space-y-1.5">
                  <Label>Label</Label>
                  <Input
                    value={pkg.label}
                    onChange={(e) => {
                      const diamondPackages = [...form.diamondPackages];
                      diamondPackages[idx] = { ...pkg, label: e.target.value };
                      setForm({ ...form, diamondPackages });
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Diamonds</Label>
                  <Input
                    type="number"
                    value={pkg.diamonds}
                    onChange={(e) => {
                      const diamondPackages = [...form.diamondPackages];
                      diamondPackages[idx] = { ...pkg, diamonds: +e.target.value };
                      setForm({ ...form, diamondPackages });
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Price USD ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={pkg.priceUsd ?? pkg.price ?? 0}
                    onChange={(e) => {
                      const diamondPackages = [...form.diamondPackages];
                      diamondPackages[idx] = { ...pkg, priceUsd: +e.target.value };
                      setForm({ ...form, diamondPackages });
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Price INR (₹)</Label>
                  <Input
                    type="number"
                    step="1"
                    value={pkg.priceInr ?? 0}
                    onChange={(e) => {
                      const diamondPackages = [...form.diamondPackages];
                      diamondPackages[idx] = { ...pkg, priceInr: +e.target.value };
                      setForm({ ...form, diamondPackages });
                    }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Landing page stats</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Members label</Label>
              <Input
                value={form.landing?.membersLabel ?? '120k+'}
                onChange={(e) =>
                  setForm({
                    ...form,
                    landing: { ...form.landing, membersLabel: e.target.value },
                  })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Verified hosts label</Label>
              <Input
                value={form.landing?.verifiedHostsLabel ?? '8k+'}
                onChange={(e) =>
                  setForm({
                    ...form,
                    landing: { ...form.landing, verifiedHostsLabel: e.target.value },
                  })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Live rooms label</Label>
              <Input
                value={form.landing?.liveRoomsLabel ?? '24/7'}
                onChange={(e) =>
                  setForm({
                    ...form,
                    landing: { ...form.landing, liveRoomsLabel: e.target.value },
                  })
                }
              />
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Host verification instructions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={newInstruction}
                onChange={(e) => setNewInstruction(e.target.value)}
                placeholder='e.g. "Turn your head to the left"'
              />
              <Button onClick={() => addInstruction.mutate()} loading={addInstruction.isPending}>
                Add
              </Button>
            </div>
            <div className="space-y-2">
              {instructions.data?.map((ins) => (
                <div key={ins._id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-2.5">
                  <span className="text-sm">{ins.text}</span>
                  <button onClick={() => delInstruction.mutate(ins._id)} className="text-white/40 hover:text-red-400">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
