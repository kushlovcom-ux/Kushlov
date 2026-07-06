'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, apiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const schema = z.object({
  password: z.string().min(8, 'At least 8 characters'),
});
type Form = z.infer<typeof schema>;

function ResetForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') ?? '';
  const { register, handleSubmit, formState } = useForm<Form>({ resolver: zodResolver(schema) });

  const mut = useMutation({
    mutationFn: (v: Form) => api.post('/auth/reset-password', { token, password: v.password }),
    onSuccess: () => {
      toast.success('Password reset. Please log in.');
      router.push('/login');
    },
    onError: (e) => toast.error(apiError(e)),
  });

  if (!token) {
    return <p className="text-sm text-red-400">Missing or invalid reset token.</p>;
  }

  return (
    <form onSubmit={handleSubmit((v) => mut.mutate(v))} className="mt-6 space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="password">New password</Label>
        <Input id="password" type="password" placeholder="••••••••" {...register('password')} />
        {formState.errors.password && (
          <p className="text-xs text-red-400">{formState.errors.password.message}</p>
        )}
      </div>
      <Button type="submit" className="w-full" loading={mut.isPending}>
        Reset password
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Reset password</h1>
      <p className="mt-1 text-sm text-white/50">Choose a new password for your account.</p>
      <Suspense fallback={<p className="mt-6 text-sm text-white/50">Loading…</p>}>
        <ResetForm />
      </Suspense>
      <p className="mt-6 text-center text-sm text-white/50">
        <Link href="/login" className="font-semibold text-brand-pink hover:underline">
          Back to login
        </Link>
      </p>
    </div>
  );
}
