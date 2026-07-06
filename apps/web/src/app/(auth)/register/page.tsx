'use client';

import Link from 'next/link';
import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Heart, Radio } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { DEFAULT_COUNTRY } from '@kushlov/utils';
import { CountrySelect } from '@/components/ui/country-select';
import { useRegister } from '@/hooks/use-auth';

const passwordRules = z
  .string()
  .min(8, 'At least 8 characters')
  .regex(/[A-Z]/, 'Add an uppercase letter')
  .regex(/[a-z]/, 'Add a lowercase letter')
  .regex(/[0-9]/, 'Add a number');

const schema = z
  .object({
    accountType: z.enum(['user', 'host']),
    displayName: z.string().min(2, 'Tell us your name'),
    username: z.string().min(3).regex(/^[a-z0-9_]+$/i, 'Letters, numbers, underscores only'),
    email: z.string().email('Enter a valid email'),
    password: passwordRules,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    country: z.string().min(2, 'Select your country'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type Form = z.infer<typeof schema>;

function RegisterForm() {
  const searchParams = useSearchParams();
  const initialType = searchParams.get('type') === 'host' ? 'host' : 'user';
  const registerMut = useRegister();
  const [accountType, setAccountType] = useState<'user' | 'host'>(initialType);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { accountType: initialType, country: DEFAULT_COUNTRY },
  });

  useEffect(() => {
    setAccountType(initialType);
    setValue('accountType', initialType);
  }, [initialType, setValue]);

  const selectType = (type: 'user' | 'host') => {
    setAccountType(type);
    setValue('accountType', type);
  };

  const country = watch('country');

  return (
    <div>
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-2 text-sm text-white/50 transition-colors hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to homepage
      </Link>

      <h1 className="text-2xl font-bold">Create your account</h1>
      <p className="mt-1 text-sm text-white/50">Choose how you want to join Kushlov.</p>

      {/* Account type selector */}
      <div className="mt-6 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => selectType('user')}
          className={cn(
            'rounded-2xl border p-4 text-left transition-all',
            accountType === 'user'
              ? 'border-brand-pink/60 bg-brand-pink/10 ring-1 ring-brand-pink/40'
              : 'border-white/10 bg-white/5 hover:border-white/20',
          )}
        >
          <Heart className={cn('h-6 w-6', accountType === 'user' ? 'text-brand-pink' : 'text-white/40')} />
          <p className="mt-2 font-semibold">Normal User</p>
          <p className="mt-0.5 text-xs text-white/45">Match, chat, call & discover</p>
        </button>
        <button
          type="button"
          onClick={() => selectType('host')}
          className={cn(
            'rounded-2xl border p-4 text-left transition-all',
            accountType === 'host'
              ? 'border-brand-orange/60 bg-brand-orange/10 ring-1 ring-brand-orange/40'
              : 'border-white/10 bg-white/5 hover:border-white/20',
          )}
        >
          <Radio className={cn('h-6 w-6', accountType === 'host' ? 'text-brand-orange' : 'text-white/40')} />
          <p className="mt-2 font-semibold">Host User</p>
          <p className="mt-0.5 text-xs text-white/45">Go live, earn coins & get verified</p>
        </button>
      </div>

      <form
        onSubmit={handleSubmit(({ confirmPassword: _, ...v }) => registerMut.mutate(v))}
        className="mt-6 space-y-4"
      >
        <input type="hidden" {...register('accountType')} />

        <div className="space-y-1.5">
          <Label htmlFor="displayName">Display name</Label>
          <Input id="displayName" placeholder="Alex Rivera" {...register('displayName')} />
          {errors.displayName && <p className="text-xs text-red-400">{errors.displayName.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="username">Username</Label>
          <Input id="username" placeholder="alexr" {...register('username')} />
          {errors.username && <p className="text-xs text-red-400">{errors.username.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="country">Country</Label>
          <CountrySelect
            id="country"
            value={country}
            onChange={(v) => setValue('country', v, { shouldValidate: true })}
            required
          />
          {errors.country && <p className="text-xs text-red-400">{errors.country.message}</p>}
          <p className="text-xs text-white/40">
            India shows prices in ₹; other countries show $.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" placeholder="you@example.com" {...register('email')} />
          {errors.email && <p className="text-xs text-red-400">{errors.email.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <PasswordInput id="password" placeholder="••••••••" {...register('password')} />
          {errors.password && <p className="text-xs text-red-400">{errors.password.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <PasswordInput id="confirmPassword" placeholder="••••••••" {...register('confirmPassword')} />
          {errors.confirmPassword && (
            <p className="text-xs text-red-400">{errors.confirmPassword.message}</p>
          )}
        </div>

        {accountType === 'host' && (
          <p className="rounded-xl border border-brand-orange/20 bg-brand-orange/5 px-3 py-2 text-xs text-white/60">
            Host accounts require identity verification before you can go live or receive earnings.
          </p>
        )}

        <Button type="submit" className="w-full" loading={registerMut.isPending}>
          {accountType === 'host' ? 'Create host account' : 'Create account'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-white/50">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-brand-pink hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="text-sm text-white/50">Loading…</div>}>
      <RegisterForm />
    </Suspense>
  );
}
