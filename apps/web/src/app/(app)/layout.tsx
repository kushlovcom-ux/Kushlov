'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { AppNav } from '@/components/app/app-nav';
import { AppTopBar } from '@/components/app/app-top-bar';
import { MobileBottomNav } from '@/components/app/mobile-bottom-nav';
import { SocketProvider } from '@/components/socket-provider';
import { CallOverlay } from '@/components/calls/call-overlay';
import { ColiveInviteOverlay } from '@/components/live/colive-invite-overlay';
import { useScrollNavVisibility } from '@/hooks/use-scroll-nav-visibility';
import { cn } from '@/lib/utils';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { accessToken, hydrated, sessionChecked } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const isMessages = pathname.startsWith('/messages');
  const isLiveRoom = /^\/live\/[^/]+$/.test(pathname);
  const navVisible = useScrollNavVisibility({ forceHidden: isLiveRoom });

  useEffect(() => {
    if (hydrated && sessionChecked && !accessToken) router.replace('/login');
  }, [hydrated, sessionChecked, accessToken, router]);

  if (!hydrated || !accessToken) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-brand-pink" />
      </div>
    );
  }

  return (
    <SocketProvider>
      <div className="flex min-h-screen">
        <AppNav />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {!isMessages && <AppTopBar mobileVisible={navVisible} />}
          <main
            className={cn(
              'min-h-0 flex-1 overflow-x-hidden',
              isMessages || isLiveRoom
                ? 'flex flex-col p-0 pb-0'
                : cn(
                    'md:pb-0',
                    // Mobile fixed top bar spacer when visible
                    navVisible ? 'pb-20 pt-14' : 'pb-2 pt-0',
                    'md:pt-0',
                  ),
            )}
          >
            {children}
          </main>
        </div>
        <MobileBottomNav mobileVisible={navVisible} forceHidden={isLiveRoom} />
      </div>
      <CallOverlay />
      <ColiveInviteOverlay />
    </SocketProvider>
  );
}
