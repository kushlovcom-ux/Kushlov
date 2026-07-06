'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { AppNav } from '@/components/app/app-nav';
import { MobileBottomNav } from '@/components/app/mobile-bottom-nav';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, accessToken, hydrated } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (hydrated && !accessToken) router.replace('/login');
  }, [hydrated, accessToken, router]);

  if (!hydrated || !accessToken) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-brand-pink" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <AppNav />
      <main className="flex-1 overflow-x-hidden pb-20 md:pb-0">{children}</main>
      <MobileBottomNav />
    </div>
  );
}
