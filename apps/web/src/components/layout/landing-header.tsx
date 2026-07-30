'use client';

import Link from 'next/link';
import { Mail } from 'lucide-react';
import { Logo } from '@kushlov/ui';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/auth';
import { AuthUserMenu } from '@/components/layout/auth-user-menu';

/** Guest nav — must match SSR so hydration stays stable. */
function GuestNav() {
  return (
    <>
      <Link href="/login?next=/contact">
        <Button variant="ghost" className="gap-2">
          <Mail className="h-4 w-4" />
          <span className="hidden sm:inline">Contact Us</span>
        </Button>
      </Link>
      <Link href="/login">
        <Button variant="ghost">Log in</Button>
      </Link>
      <Link href="/register">
        <Button>Get started</Button>
      </Link>
    </>
  );
}

/** Landing page header — auth-aware after store hydration (avoids SSR mismatch). */
export function LandingHeader() {
  const hydrated = useAuthStore((s) => s.hydrated);
  const sessionChecked = useAuthStore((s) => s.sessionChecked);
  const accessToken = useAuthStore((s) => s.accessToken);
  const ready = hydrated && sessionChecked;
  const isLoggedIn = ready && Boolean(accessToken);

  return (
    <header
      className="container relative z-20 flex items-center justify-between gap-2 py-4 sm:py-6"
      suppressHydrationWarning
    >
      <Link href="/" aria-label="Kushlov home" className="inline-flex min-w-0 shrink">
        <span className="sm:hidden">
          <Logo size={28} withWordmark={false} />
        </span>
        <span className="hidden sm:inline-flex">
          <Logo />
        </span>
      </Link>
      <nav className="flex min-w-0 shrink-0 items-center gap-1 sm:gap-3" suppressHydrationWarning>
        {!ready ? (
          <GuestNav />
        ) : isLoggedIn ? (
          <>
            <Link href="/contact" className="hidden sm:inline-flex">
              <Button variant="ghost" className="gap-2">
                <Mail className="h-4 w-4" />
                Contact Us
              </Button>
            </Link>
            <AuthUserMenu />
          </>
        ) : (
          <GuestNav />
        )}
      </nav>
    </header>
  );
}
