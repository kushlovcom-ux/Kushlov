'use client';

import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, apiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const schema = z.object({ email: z.string().email() });
type Form = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const { register, handleSubmit, formState } = useForm<Form>({ resolver: zodResolver(schema) });
  const mut = useMutation({
    mutationFn: (v: Form) => api.post('/auth/forgot-password', v),
    onSuccess: () => toast.success('If that email exists, a reset link is on its way.'),
    onError: (e) => toast.error(apiError(e)),
  });

  return (
    <div>
      <h1 className="text-2xl font-bold">Forgot password</h1>
      <p className="mt-1 text-sm text-white/50">We&apos;ll email you a reset link.</p>
      <form onSubmit={handleSubmit((v) => mut.mutate(v))} className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" placeholder="you@example.com" {...register('email')} />
        </div>
        <Button type="submit" className="w-full" loading={mut.isPending} disabled={formState.isSubmitSuccessful && mut.isSuccess}>
          Send reset link
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-white/50">
        <Link href="/login" className="font-semibold text-brand-pink hover:underline">
          Back to login
        </Link>
      </p>
    </div>
  );
}
