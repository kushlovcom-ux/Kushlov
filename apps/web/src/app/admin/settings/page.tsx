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

type TimeUnit = 'second' | 'minute' | 'hour';

const TIME_UNITS: { value: TimeUnit; label: string }[] = [
  { value: 'second', label: 'Seconds' },
  { value: 'minute', label: 'Minutes' },
  { value: 'hour', label: 'Hours' },
];

function secondsToUnit(seconds: number, unit: TimeUnit): number {
  if (unit === 'hour') return Math.round((seconds / 3600) * 100) / 100;
  if (unit === 'minute') return Math.round((seconds / 60) * 100) / 100;
  return seconds;
}

function unitToSeconds(value: number, unit: TimeUnit): number {
  if (unit === 'hour') return Math.max(1, Math.round(value * 3600));
  if (unit === 'minute') return Math.max(1, Math.round(value * 60));
  return Math.max(1, Math.round(value));
}

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
  const [videoValue, setVideoValue] = useState(1);
  const [audioValue, setAudioValue] = useState(2);
  const [userVideoValue, setUserVideoValue] = useState(1.5);
  const [userAudioValue, setUserAudioValue] = useState(3);
  const [hostHostVideoValue, setHostHostVideoValue] = useState(1);
  const [hostHostAudioValue, setHostHostAudioValue] = useState(2);

  useEffect(() => {
    if (settings.data && !form) {
      const rates = {
        audioCallPerMinute: 10,
        videoCallPerMinute: 20,
        liveChatPerMessage: 1,
        chatPerMessage: 1,
        videoSecondsPerDiamond: 60,
        audioSecondsPerDiamond: 120,
        videoTimeUnit: 'minute' as TimeUnit,
        audioTimeUnit: 'minute' as TimeUnit,
        messagesPerDiamond: 5,
        userUserVideoSecondsPerDiamond: 90,
        userUserAudioSecondsPerDiamond: 180,
        userUserVideoTimeUnit: 'minute' as TimeUnit,
        userUserAudioTimeUnit: 'minute' as TimeUnit,
        userUserMessagesPerDiamond: 10,
        hostHostVideoSecondsPerDiamond: 60,
        hostHostAudioSecondsPerDiamond: 120,
        hostHostVideoTimeUnit: 'minute' as TimeUnit,
        hostHostAudioTimeUnit: 'minute' as TimeUnit,
        hostHostMessagesPerDiamond: 5,
        ...settings.data.rates,
      };
      setForm({
        ...settings.data,
        rates,
        features: {
          liveEnabled: true,
          callsEnabled: true,
          giftsEnabled: true,
          reviewsEnabled: true,
          ...settings.data.features,
        },
        landing: settings.data.landing ?? {
          membersLabel: '120k+',
          verifiedHostsLabel: '8k+',
          liveRoomsLabel: '24/7',
        },
      });
      setVideoValue(secondsToUnit(rates.videoSecondsPerDiamond, rates.videoTimeUnit));
      setAudioValue(secondsToUnit(rates.audioSecondsPerDiamond, rates.audioTimeUnit));
      setUserVideoValue(
        secondsToUnit(rates.userUserVideoSecondsPerDiamond, rates.userUserVideoTimeUnit),
      );
      setUserAudioValue(
        secondsToUnit(rates.userUserAudioSecondsPerDiamond, rates.userUserAudioTimeUnit),
      );
      setHostHostVideoValue(
        secondsToUnit(rates.hostHostVideoSecondsPerDiamond, rates.hostHostVideoTimeUnit),
      );
      setHostHostAudioValue(
        secondsToUnit(rates.hostHostAudioSecondsPerDiamond, rates.hostHostAudioTimeUnit),
      );
    }
  }, [settings.data, form]);

  const save = useMutation({
    mutationFn: () => {
      const videoUnit = (form.rates.videoTimeUnit ?? 'minute') as TimeUnit;
      const audioUnit = (form.rates.audioTimeUnit ?? 'minute') as TimeUnit;
      const uuVideoUnit = (form.rates.userUserVideoTimeUnit ?? 'minute') as TimeUnit;
      const uuAudioUnit = (form.rates.userUserAudioTimeUnit ?? 'minute') as TimeUnit;
      const hhVideoUnit = (form.rates.hostHostVideoTimeUnit ?? 'minute') as TimeUnit;
      const hhAudioUnit = (form.rates.hostHostAudioTimeUnit ?? 'minute') as TimeUnit;
      return api.patch('/admin/settings', {
        goldConversionRatio: form.goldConversionRatio,
        rates: {
          ...form.rates,
          videoTimeUnit: videoUnit,
          audioTimeUnit: audioUnit,
          videoSecondsPerDiamond: unitToSeconds(videoValue, videoUnit),
          audioSecondsPerDiamond: unitToSeconds(audioValue, audioUnit),
          userUserVideoTimeUnit: uuVideoUnit,
          userUserAudioTimeUnit: uuAudioUnit,
          userUserVideoSecondsPerDiamond: unitToSeconds(userVideoValue, uuVideoUnit),
          userUserAudioSecondsPerDiamond: unitToSeconds(userAudioValue, uuAudioUnit),
          hostHostVideoTimeUnit: hhVideoUnit,
          hostHostAudioTimeUnit: hhAudioUnit,
          hostHostVideoSecondsPerDiamond: unitToSeconds(hostHostVideoValue, hhVideoUnit),
          hostHostAudioSecondsPerDiamond: unitToSeconds(hostHostAudioValue, hhAudioUnit),
        },
        features: form.features,
        withdraw: form.withdraw,
        diamondPackages: form.diamondPackages,
        landing: form.landing,
      });
    },
    onSuccess: () => {
      toast.success('Settings saved');
      setForm(null);
      qc.invalidateQueries({ queryKey: ['admin-settings'] });
      qc.invalidateQueries({ queryKey: ['platform-settings'] });
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

  const setRate = (key: string, value: number | string) =>
    setForm({ ...form, rates: { ...form.rates, [key]: value } });

  const selectClass =
    'flex h-10 w-full appearance-none rounded-xl border border-white/15 bg-zinc-900 px-3 text-sm text-white shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-pink [color-scheme:dark]';
  const optionClass = 'bg-zinc-900 text-white';

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Rates, diamond conversions and platform features"
        action={
          <Button loading={save.isPending} onClick={() => save.mutate()}>
            Save changes
          </Button>
        }
      />
      <div className="grid gap-6 p-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>User → Host conversions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-white/45">
              What 1 diamond buys when a normal user chats or calls a host.
            </p>

            <div className="space-y-1.5">
              <Label>Video call — 1 Diamond equals</Label>
              <div className="grid grid-cols-[1fr_140px] gap-2">
                <Input
                  type="number"
                  min={0.01}
                  step="any"
                  value={videoValue}
                  onChange={(e) => setVideoValue(+e.target.value)}
                />
                <select
                  className={selectClass}
                  value={form.rates.videoTimeUnit}
                  onChange={(e) => {
                    const next = e.target.value as TimeUnit;
                    const seconds = unitToSeconds(videoValue, form.rates.videoTimeUnit as TimeUnit);
                    setRate('videoTimeUnit', next);
                    setVideoValue(secondsToUnit(seconds, next));
                  }}
                >
                  {TIME_UNITS.map((u) => (
                    <option key={u.value} value={u.value} className={optionClass}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Audio call — 1 Diamond equals</Label>
              <div className="grid grid-cols-[1fr_140px] gap-2">
                <Input
                  type="number"
                  min={0.01}
                  step="any"
                  value={audioValue}
                  onChange={(e) => setAudioValue(+e.target.value)}
                />
                <select
                  className={selectClass}
                  value={form.rates.audioTimeUnit}
                  onChange={(e) => {
                    const next = e.target.value as TimeUnit;
                    const seconds = unitToSeconds(audioValue, form.rates.audioTimeUnit as TimeUnit);
                    setRate('audioTimeUnit', next);
                    setAudioValue(secondsToUnit(seconds, next));
                  }}
                >
                  {TIME_UNITS.map((u) => (
                    <option key={u.value} value={u.value} className={optionClass}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>1 Diamond = N messages (user → host)</Label>
              <Input
                type="number"
                min={1}
                value={form.rates.messagesPerDiamond}
                onChange={(e) => setRate('messagesPerDiamond', +e.target.value)}
              />
              <p className="text-xs text-white/35">
                Used when a host has no custom message price. Per-host prices override this in Host Pricing.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>User → User conversions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-white/45">
              Separate rates when a normal user chats or calls another normal user (diamonds required).
            </p>

            <div className="space-y-1.5">
              <Label>Video call — 1 Diamond equals</Label>
              <div className="grid grid-cols-[1fr_140px] gap-2">
                <Input
                  type="number"
                  min={0.01}
                  step="any"
                  value={userVideoValue}
                  onChange={(e) => setUserVideoValue(+e.target.value)}
                />
                <select
                  className={selectClass}
                  value={form.rates.userUserVideoTimeUnit}
                  onChange={(e) => {
                    const next = e.target.value as TimeUnit;
                    const seconds = unitToSeconds(
                      userVideoValue,
                      form.rates.userUserVideoTimeUnit as TimeUnit,
                    );
                    setRate('userUserVideoTimeUnit', next);
                    setUserVideoValue(secondsToUnit(seconds, next));
                  }}
                >
                  {TIME_UNITS.map((u) => (
                    <option key={u.value} value={u.value} className={optionClass}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Audio call — 1 Diamond equals</Label>
              <div className="grid grid-cols-[1fr_140px] gap-2">
                <Input
                  type="number"
                  min={0.01}
                  step="any"
                  value={userAudioValue}
                  onChange={(e) => setUserAudioValue(+e.target.value)}
                />
                <select
                  className={selectClass}
                  value={form.rates.userUserAudioTimeUnit}
                  onChange={(e) => {
                    const next = e.target.value as TimeUnit;
                    const seconds = unitToSeconds(
                      userAudioValue,
                      form.rates.userUserAudioTimeUnit as TimeUnit,
                    );
                    setRate('userUserAudioTimeUnit', next);
                    setUserAudioValue(secondsToUnit(seconds, next));
                  }}
                >
                  {TIME_UNITS.map((u) => (
                    <option key={u.value} value={u.value} className={optionClass}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>1 Diamond = N messages (user → user)</Label>
              <Input
                type="number"
                min={1}
                value={form.rates.userUserMessagesPerDiamond}
                onChange={(e) => setRate('userUserMessagesPerDiamond', +e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Host → Host conversions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-white/45">
              What 1 diamond buys when a host chats or calls another host. Hosts need diamonds for this.
            </p>
            <div className="space-y-1.5">
              <Label>Video call — 1 Diamond equals</Label>
              <div className="grid grid-cols-[1fr_140px] gap-2">
                <Input
                  type="number"
                  min={0.01}
                  step="any"
                  value={hostHostVideoValue}
                  onChange={(e) => setHostHostVideoValue(+e.target.value)}
                />
                <select
                  className={selectClass}
                  value={form.rates.hostHostVideoTimeUnit}
                  onChange={(e) => {
                    const next = e.target.value as TimeUnit;
                    const seconds = unitToSeconds(
                      hostHostVideoValue,
                      form.rates.hostHostVideoTimeUnit as TimeUnit,
                    );
                    setRate('hostHostVideoTimeUnit', next);
                    setHostHostVideoValue(secondsToUnit(seconds, next));
                  }}
                >
                  {TIME_UNITS.map((u) => (
                    <option key={u.value} value={u.value} className={optionClass}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Audio call — 1 Diamond equals</Label>
              <div className="grid grid-cols-[1fr_140px] gap-2">
                <Input
                  type="number"
                  min={0.01}
                  step="any"
                  value={hostHostAudioValue}
                  onChange={(e) => setHostHostAudioValue(+e.target.value)}
                />
                <select
                  className={selectClass}
                  value={form.rates.hostHostAudioTimeUnit}
                  onChange={(e) => {
                    const next = e.target.value as TimeUnit;
                    const seconds = unitToSeconds(
                      hostHostAudioValue,
                      form.rates.hostHostAudioTimeUnit as TimeUnit,
                    );
                    setRate('hostHostAudioTimeUnit', next);
                    setHostHostAudioValue(secondsToUnit(seconds, next));
                  }}
                >
                  {TIME_UNITS.map((u) => (
                    <option key={u.value} value={u.value} className={optionClass}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>1 Diamond = N messages (host → host)</Label>
              <Input
                type="number"
                min={1}
                value={form.rates.hostHostMessagesPerDiamond}
                onChange={(e) => setRate('hostHostMessagesPerDiamond', +e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fallback host rates (diamonds)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-white/45">
              Used when a host has no custom gold pricing. Prefer per-host gold prices under Host Pricing
              (converted to diamonds via the gold conversion ratio).
            </p>
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
              <Label>Default audio call / minute</Label>
              <Input
                type="number"
                value={form.rates.audioCallPerMinute}
                onChange={(e) => setRate('audioCallPerMinute', +e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Default video call / minute</Label>
              <Input
                type="number"
                value={form.rates.videoCallPerMinute}
                onChange={(e) => setRate('videoCallPerMinute', +e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Legacy host DM / message (diamonds)</Label>
              <Input
                type="number"
                value={form.rates.chatPerMessage ?? form.rates.liveChatPerMessage}
                onChange={(e) => setRate('chatPerMessage', +e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Live chat / message (diamonds)</Label>
              <Input
                type="number"
                value={form.rates.liveChatPerMessage}
                onChange={(e) => setRate('liveChatPerMessage', +e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Features</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(['liveEnabled', 'callsEnabled', 'giftsEnabled', 'reviewsEnabled'] as const).map((f) => (
              <div key={f} className="flex items-center justify-between">
                <Label className="capitalize">{f.replace('Enabled', '')}</Label>
                <Switch
                  checked={!!form.features[f]}
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
                <div
                  key={ins._id}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-2.5"
                >
                  <span className="text-sm">{ins.text}</span>
                  <button
                    onClick={() => delInstruction.mutate(ins._id)}
                    className="text-white/40 hover:text-red-400"
                  >
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
