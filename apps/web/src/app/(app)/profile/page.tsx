'use client';

import { useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Camera, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { api, apiError } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { UserAvatar } from '@/components/common/user-avatar';
import { Badge } from '@/components/ui/badge';
import { LocationSetup } from '@/components/location/location-setup';
import { CountrySelect } from '@/components/ui/country-select';

export default function ProfilePage() {
  const { user, setUser } = useAuthStore();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [country, setCountry] = useState('India');

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName);
      setBio(user.bio ?? '');
      setCountry(user.country ?? 'India');
    }
  }, [user]);

  const save = useMutation({
    mutationFn: () => api.patch('/users/me', { displayName, bio, country }),
    onSuccess: (res) => {
      setUser(res.data.data);
      toast.success('Profile updated');
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const uploadAvatar = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return api.post('/users/me/avatar', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: (res) => {
      setUser(res.data.data);
      qc.invalidateQueries();
      toast.success('Avatar updated');
    },
    onError: (e) => toast.error(apiError(e)),
  });

  return (
    <div>
      <PageHeader title="My Profile" subtitle="Manage how others see you" />
      <div className="mx-auto max-w-xl space-y-6 p-6">
        <div className="flex items-center gap-5">
          <button className="relative" onClick={() => fileRef.current?.click()}>
            <UserAvatar name={user?.displayName} src={user?.avatarUrl} className="h-24 w-24 text-3xl" />
            <span className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-brand-gradient">
              <Camera className="h-4 w-4" />
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => e.target.files?.[0] && uploadAvatar.mutate(e.target.files[0])}
          />
          <div>
            <p className="text-lg font-semibold">{user?.displayName}</p>
            <p className="text-sm text-white/40">@{user?.username}</p>
            <Badge className="mt-2 capitalize">{user?.role}</Badge>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Display name</Label>
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Country</Label>
          <CountrySelect value={country} onChange={setCountry} />
          <p className="text-xs text-white/40">India: ₹ · Other countries: $</p>
        </div>
        <div className="space-y-1.5">
          <Label>Bio</Label>
          <Textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell people about yourself…" />
        </div>
        <Button loading={save.isPending} onClick={() => save.mutate()}>
          Save changes
        </Button>

        {(user?.role === 'user' || (user?.role === 'host' && !user?.isHostApproved)) && (
          <Link
            href="/become-host"
            className="flex items-center gap-3 rounded-2xl border border-brand-pink/30 bg-brand-pink/10 p-4 transition-colors hover:bg-brand-pink/15"
          >
            <ShieldCheck className="h-6 w-6 shrink-0 text-brand-pink" />
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                {user?.role === 'host' ? 'Host verification' : 'Become a Host'}
              </p>
              <p className="text-xs text-white/50">
                {user?.role === 'host'
                  ? 'Complete or resubmit your 3-step verification'
                  : 'Get verified to go live and earn'}
              </p>
            </div>
          </Link>
        )}

        <LocationSetup compact />
      </div>
    </div>
  );
}
