'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Upload, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Gender } from '@kushlov/types';
import { api, apiError, unwrap } from '@/lib/api';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { DEFAULT_COUNTRY } from '@kushlov/utils';
import { CountrySelect } from '@/components/ui/country-select';
import { IdentityLiveCapture } from '@/components/verification/identity-live-capture';

interface Instruction {
  _id: string;
  text: string;
  category: string;
}
interface Verification {
  status: string;
  currentStep: string;
  reviewNote?: string;
}

const steps = ['Basic Info', 'Documents', 'Identity'];

export default function BecomeHostPage() {
  const qc = useQueryClient();
  const [step, setStep] = useState(0);

  const verification = useQuery({
    queryKey: ['verification'],
    queryFn: () => unwrap<Verification | null>(api.get('/verification/me')),
  });
  const instructions = useQuery({
    queryKey: ['verification-instructions'],
    queryFn: () => unwrap<Instruction[]>(api.get('/verification/instructions')),
  });

  const [basic, setBasic] = useState<{
    name: string;
    username: string;
    bio: string;
    gender: Gender;
    dob: string;
    country: string;
    languages: string;
  }>({
    name: '',
    username: '',
    bio: '',
    gender: Gender.Male,
    dob: '',
    country: DEFAULT_COUNTRY,
    languages: '',
  });

  const submitBasic = useMutation({
    mutationFn: () =>
      api.post('/verification/basic', {
        ...basic,
        languages: basic.languages.split(',').map((l) => l.trim()).filter(Boolean),
      }),
    onSuccess: () => {
      toast.success('Basic info saved');
      setStep(1);
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const submitDocs = useMutation({
    mutationFn: (form: FormData) =>
      api.post('/verification/documents', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }),
    onSuccess: () => {
      toast.success('Documents uploaded');
      setStep(2);
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const submitIdentity = useMutation({
    mutationFn: (form: FormData) =>
      api.post('/verification/identity', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }),
    onSuccess: () => {
      toast.success('Submitted for review!');
      qc.invalidateQueries({ queryKey: ['verification'] });
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const status = verification.data?.status;

  // Already submitted — show status card.
  if (status && status !== 'need_more_info') {
    const map: Record<string, { label: string; variant: any }> = {
      pending: { label: 'Pending review', variant: 'warning' },
      approved: { label: 'Approved', variant: 'success' },
      rejected: { label: 'Rejected', variant: 'destructive' },
    };
    const s = map[status] ?? map.pending;
    return (
      <div>
        <PageHeader title="Become a Host" />
        <div className="mx-auto max-w-lg p-6">
          <div className="glass rounded-3xl p-10 text-center">
            <ShieldCheck className="mx-auto h-14 w-14 text-brand-pink" />
            <h2 className="mt-4 text-2xl font-bold">Verification {s.label}</h2>
            <Badge variant={s.variant} className="mt-3">
              {s.label}
            </Badge>
            {verification.data?.reviewNote && (
              <p className="mt-4 text-sm text-white/60">{verification.data.reviewNote}</p>
            )}
            <p className="mt-4 text-sm text-white/50">
              {status === 'approved'
                ? 'Congratulations! You can now go live and accept calls.'
                : 'Our team is reviewing your submission. You will be notified once done.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Become a Host" subtitle="Get verified to go live and earn" />
      <div className="mx-auto max-w-2xl p-6">
        {/* Stepper */}
        <div className="mb-8 flex items-center justify-between">
          {steps.map((label, i) => (
            <div key={label} className="flex flex-1 items-center">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${
                  i <= step ? 'bg-brand-gradient text-white' : 'bg-white/10 text-white/40'
                }`}
              >
                {i < step ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span className="ml-2 hidden text-sm sm:inline">{label}</span>
              {i < steps.length - 1 && <div className="mx-3 h-px flex-1 bg-white/10" />}
            </div>
          ))}
        </div>

        {step === 0 && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Full name</Label>
                <Input value={basic.name} onChange={(e) => setBasic({ ...basic, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Username</Label>
                <Input value={basic.username} onChange={(e) => setBasic({ ...basic, username: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Bio</Label>
              <Textarea value={basic.bio} onChange={(e) => setBasic({ ...basic, bio: e.target.value })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Gender</Label>
                <select
                  value={basic.gender}
                  onChange={(e) => setBasic({ ...basic, gender: e.target.value as Gender })}
                  className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm"
                >
                  {Object.values(Gender).map((g) => (
                    <option key={g} value={g} className="bg-card">
                      {g}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Date of birth</Label>
                <Input type="date" value={basic.dob} onChange={(e) => setBasic({ ...basic, dob: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Country</Label>
                <CountrySelect
                  value={basic.country}
                  onChange={(country) => setBasic({ ...basic, country })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Languages (comma separated)</Label>
                <Input
                  value={basic.languages}
                  placeholder="English, Spanish"
                  onChange={(e) => setBasic({ ...basic, languages: e.target.value })}
                />
              </div>
            </div>
            <Button className="w-full" loading={submitBasic.isPending} onClick={() => submitBasic.mutate()}>
              Continue
            </Button>
          </div>
        )}

        {step === 1 && (
          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              submitDocs.mutate(form);
            }}
          >
            <div className="rounded-2xl border border-dashed border-white/20 p-6">
              <Label className="flex items-center gap-2">
                <Upload className="h-4 w-4" /> Government ID (required)
              </Label>
              <Input name="governmentId" type="file" accept="image/*,application/pdf" required className="mt-2" />
            </div>
            <div className="rounded-2xl border border-dashed border-white/20 p-6">
              <Label className="flex items-center gap-2">
                <Upload className="h-4 w-4" /> Address proof (optional)
              </Label>
              <Input name="addressProof" type="file" accept="image/*,application/pdf" className="mt-2" />
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="secondary" onClick={() => setStep(0)}>
                Back
              </Button>
              <Button type="submit" className="flex-1" loading={submitDocs.isPending}>
                Continue
              </Button>
            </div>
          </form>
        )}

        {step === 2 && (
          <IdentityLiveCapture
            instructions={instructions.data ?? []}
            loading={submitIdentity.isPending}
            onBack={() => setStep(1)}
            onSubmit={(form) => submitIdentity.mutate(form)}
          />
        )}
      </div>
    </div>
  );
}
