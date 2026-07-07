'use client';

import Link from 'next/link';
import { Mail } from 'lucide-react';
import { Logo } from '@kushlov/ui';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/auth';
import { AuthUserMenu } from '@/components/layout/auth-user-menu';

/** Landing page header — auth-aware (login vs profile/logout). */
export function LandingHeader() {
  const { accessToken, sessionChecked } = useAuthStore();
  const isLoggedIn = sessionChecked && Boolean(accessToken);

  return (
    <header className="container flex items-center justify-between py-6">
      <Logo />
      <nav className="flex items-center gap-2 sm:gap-3">
        <Link href={isLoggedIn ? '/contact' : '/login?next=/contact'}>
          <Button variant="ghost" className="gap-2">
            <Mail className="h-4 w-4" />
            <span className="hidden sm:inline">Contact Us</span>
          </Button>
        </Link>
        {isLoggedIn ? (
          <AuthUserMenu />
        ) : (
          <>
            <Link href="/login">
              <Button variant="ghost">Log in</Button>
            </Link>
            <Link href="/register">
              <Button>Get started</Button>
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
