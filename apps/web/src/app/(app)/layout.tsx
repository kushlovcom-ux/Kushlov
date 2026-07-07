'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { AppNav } from '@/components/app/app-nav';
import { AppTopBar } from '@/components/app/app-top-bar';
import { MobileBottomNav } from '@/components/app/mobile-bottom-nav';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { accessToken, hydrated, sessionChecked } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (hydrated && sessionChecked && !accessToken) router.replace('/login');
  }, [hydrated, sessionChecked, accessToken, router]);

  if (!hydrated || !sessionChecked || !accessToken) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-brand-pink" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <AppNav />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppTopBar />
        <main className="flex-1 overflow-x-hidden pb-20 md:pb-0">{children}</main>
      </div>
      <MobileBottomNav />
    </div>
  );
}
