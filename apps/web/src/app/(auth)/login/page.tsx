'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { useLogin } from '@/hooks/use-auth';
import { useAuthStore } from '@/store/auth';
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});
type Form = z.infer<typeof schema>;

export default function LoginPage() {
  const login = useLogin();
  const router = useRouter();
  const { accessToken, sessionChecked, user } = useAuthStore();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Form>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (sessionChecked && accessToken) {
      router.replace(user?.role === 'admin' ? '/admin' : '/discover');
    }
  }, [sessionChecked, accessToken, user, router]);

  if (!sessionChecked || accessToken) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-brand-pink" />
      </div>
    );
  }

  return (
    <div>
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-2 text-sm text-white/50 transition-colors hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to homepage
      </Link>

      <h1 className="text-2xl font-bold">Welcome back</h1>
      <p className="mt-1 text-sm text-white/50">Log in to continue to Kushlov.</p>

      <form onSubmit={handleSubmit((v) => login.mutate(v))} className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" placeholder="you@example.com" {...register('email')} />
          {errors.email && <p className="text-xs text-red-400">{errors.email.message}</p>}
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href="/forgot-password" className="text-xs text-brand-pink hover:underline">
              Forgot?
            </Link>
          </div>
          <PasswordInput id="password" placeholder="••••••••" {...register('password')} />
          {errors.password && <p className="text-xs text-red-400">{errors.password.message}</p>}
        </div>
        <Button type="submit" className="w-full" loading={login.isPending}>
          Log in
        </Button>
      </form>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-white/10" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-white/40">or</span>
        </div>
      </div>

      <GoogleSignInButton />

      <p className="mt-6 text-center text-sm text-white/50">
        New to Kushlov?{' '}
        <Link href="/register" className="font-semibold text-brand-pink hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
