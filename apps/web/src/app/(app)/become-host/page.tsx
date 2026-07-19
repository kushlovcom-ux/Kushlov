'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Upload, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Gender, VerificationStatus } from '@kushlov/types';
import { api, apiError, unwrap } from '@/lib/api';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DEFAULT_COUNTRY } from '@kushlov/utils';
import { CountrySelect } from '@/components/ui/country-select';
import { IdentityLiveCapture } from '@/components/verification/identity-live-capture';
import { useAuthStore } from '@/store/auth';

interface Instruction {
  _id: string;
  text: string;
  category: string;
}
interface Verification {
  status: string;
  currentStep: string;
  reviewNote?: string;
  basic?: {
    name?: string;
    username?: string;
    bio?: string;
    gender?: Gender;
    dob?: string;
    country?: string;
    languages?: string[];
  };
}

const steps = ['Basic Info', 'Documents', 'Identity'];

export default function BecomeHostPage() {
  const qc = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);
  const [step, setStep] = useState(0);
  const [prefilled, setPrefilled] = useState(false);

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

  // Prefill when admin asked for more info so the host can edit & resubmit.
  useEffect(() => {
    const v = verification.data;
    if (!v || prefilled) return;
    if (v.status !== VerificationStatus.NeedMoreInfo && !v.basic?.name) return;
    if (v.basic) {
      setBasic({
        name: v.basic.name ?? '',
        username: v.basic.username ?? '',
        bio: v.basic.bio ?? '',
        gender: (v.basic.gender as Gender) || Gender.Male,
        dob: v.basic.dob ? String(v.basic.dob).slice(0, 10) : '',
        country: v.basic.country || DEFAULT_COUNTRY,
        languages: (v.basic.languages ?? []).join(', '),
      });
      setPrefilled(true);
      setStep(0);
    }
  }, [verification.data, prefilled]);

  // Keep auth in sync so unapproved hosts keep seeing Host verification in nav.
  useEffect(() => {
    if (verification.data?.status !== VerificationStatus.NeedMoreInfo) return;
    void (async () => {
      try {
        const me = await unwrap<any>(api.get('/users/me'));
        if (me) setUser(me);
      } catch {
        /* ignore */
      }
    })();
  }, [verification.data?.status, setUser]);

  const submitBasic = useMutation({
    mutationFn: () =>
      api.post('/verification/basic', {
        ...basic,
        languages: basic.languages
          .split(',')
          .map((l) => l.trim())
          .filter(Boolean),
      }),
    onSuccess: () => {
      toast.success('Basic info saved');
      qc.invalidateQueries({ queryKey: ['verification'] });
      setStep(1);
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const submitDocs = useMutation({
    mutationFn: (form: FormData) =>
      api.post('/verification/documents', form, { timeout: 120_000 }),
    onSuccess: () => {
      toast.success('Documents uploaded');
      qc.invalidateQueries({ queryKey: ['verification'] });
      setStep(2);
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const submitIdentity = useMutation({
    mutationFn: (form: FormData) =>
      api.post('/verification/identity', form, { timeout: 180_000 }),
    onSuccess: async () => {
      toast.success('Submitted for review!');
      qc.invalidateQueries({ queryKey: ['verification'] });
      try {
        const me = await unwrap<any>(api.get('/users/me'));
        if (me) setUser(me);
      } catch {
        /* ignore */
      }
    },
    onError: (e) => toast.error(apiError(e)),
  });

  if (verification.isLoading) {
    return (
      <div>
        <PageHeader title="Become a Host" />
        <div className="mx-auto max-w-2xl space-y-4 p-6">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  const status = verification.data?.status;
  const needsResubmit = status === VerificationStatus.NeedMoreInfo;

  // Already submitted — show status card (except need-more-info → full wizard).
  if (status && !needsResubmit) {
    const map: Record<string, { label: string; variant: 'warning' | 'success' | 'destructive' }> = {
      [VerificationStatus.Pending]: { label: 'Pending review', variant: 'warning' },
      [VerificationStatus.Approved]: { label: 'Approved', variant: 'success' },
      [VerificationStatus.Rejected]: { label: 'Rejected', variant: 'destructive' },
    };
    const s = map[status] ?? map[VerificationStatus.Pending];
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
              {status === VerificationStatus.Approved
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
      <PageHeader
        title={needsResubmit ? 'Host verification' : 'Become a Host'}
        subtitle={
          needsResubmit
            ? 'Complete all 3 steps again and resubmit for review'
            : 'Get verified to go live and earn'
        }
      />
      <div className="mx-auto max-w-2xl p-6">
        {needsResubmit && (
          <div className="mb-6 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="warning">Need more info</Badge>
              <p className="text-sm font-medium text-amber-100">
                Please complete the full verification process again
              </p>
            </div>
            {verification.data?.reviewNote ? (
              <p className="mt-2 text-sm text-white/70">
                <span className="font-medium text-white/90">Admin note: </span>
                {verification.data.reviewNote}
              </p>
            ) : (
              <p className="mt-2 text-sm text-white/55">
                Our team needs additional or clearer information. Go through Basic Info, Documents,
                and Identity again, then resubmit.
              </p>
            )}
            <p className="mt-2 text-xs text-white/40">
              Step {step + 1} of 3 — after Identity, your request returns to pending review.
            </p>
          </div>
        )}

        <div className="mb-8 flex items-center justify-between">
          {steps.map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                if (i < step) setStep(i);
              }}
              className="flex flex-1 items-center text-left"
            >
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${
                  i <= step ? 'bg-brand-gradient text-white' : 'bg-white/10 text-white/40'
                }`}
              >
                {i < step ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span className="ml-2 hidden text-sm sm:inline">{label}</span>
              {i < steps.length - 1 && <div className="mx-3 h-px flex-1 bg-white/10" />}
            </button>
          ))}
        </div>

        {step === 0 && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Full name</Label>
                <Input
                  value={basic.name}
                  onChange={(e) => setBasic({ ...basic, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Username</Label>
                <Input
                  value={basic.username}
                  onChange={(e) => setBasic({ ...basic, username: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Bio</Label>
              <Textarea
                value={basic.bio}
                onChange={(e) => setBasic({ ...basic, bio: e.target.value })}
              />
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
                <Input
                  type="date"
                  value={basic.dob}
                  onChange={(e) => setBasic({ ...basic, dob: e.target.value })}
                />
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
            <Button
              className="w-full"
              loading={submitBasic.isPending}
              onClick={() => submitBasic.mutate()}
            >
              Continue to Documents
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
                <Upload className="h-4 w-4" /> Government ID (image or PDF)
              </Label>
              <Input
                name="governmentId"
                type="file"
                accept="image/*,application/pdf"
                required
                className="mt-2"
              />
            </div>
            <div className="rounded-2xl border border-dashed border-white/20 p-6">
              <Label className="flex items-center gap-2">
                <Upload className="h-4 w-4" /> Address proof (optional)
              </Label>
              <Input
                name="addressProof"
                type="file"
                accept="image/*,application/pdf"
                className="mt-2"
              />
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="secondary" onClick={() => setStep(0)}>
                Back
              </Button>
              <Button type="submit" className="flex-1" loading={submitDocs.isPending}>
                Continue to Identity
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
