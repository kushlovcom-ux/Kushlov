'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, Mail } from 'lucide-react';
import { Logo } from '@kushlov/ui';
import { cn } from '@/lib/utils';
import { useNavBadges } from '@/hooks/use-nav-badges';
import { NavBadge } from '@/components/app/nav-badge';
import { AuthUserMenu } from '@/components/layout/auth-user-menu';
import { AppSearchBar } from '@/components/app/app-search-bar';

/** Sticky top bar with Contact, alerts, profile and logout. */
export function AppTopBar({ mobileVisible = true }: { mobileVisible?: boolean }) {
  const pathname = usePathname();
  const badges = useNavBadges();
  const contactActive = pathname === '/contact' || pathname.startsWith('/contact/');

  return (
    <header
      className={cn(
        'z-40 flex items-center justify-between gap-3 border-b border-white/10 bg-card/80 px-4 py-3 backdrop-blur-xl transition-transform duration-300 md:sticky md:top-0 md:translate-y-0 md:px-6',
        // Mobile: fixed so hide/show does not leave a sticky gap
        'fixed inset-x-0 top-0 md:relative',
        mobileVisible ? 'translate-y-0' : '-translate-y-full md:translate-y-0',
      )}
    >
      <div className="md:hidden">
        <Link href="/" aria-label="Kushlov home" className="inline-flex min-w-0">
          <Logo size={28} withWordmark />
        </Link>
      </div>
      <p className="hidden text-sm text-white/45 md:block">
        Welcome back — explore, connect, and go live.
      </p>
      <nav className="ml-auto flex flex-wrap items-center justify-end gap-2">
        <AppSearchBar />
        <Link
          href="/contact"
          className={cn(
            'flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
            contactActive
              ? 'bg-brand-gradient text-white'
              : 'text-white/70 hover:bg-white/5 hover:text-white',
          )}
        >
          <Mail className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">Contact Us</span>
        </Link>
        <Link
          href="/notifications"
          className={cn(
            'relative flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
            pathname.startsWith('/notifications')
              ? 'bg-brand-gradient text-white'
              : 'text-white/70 hover:bg-white/5 hover:text-white',
          )}
        >
          <Bell className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">Alerts</span>
          {badges.notifications > 0 && (
            <NavBadge count={badges.notifications} className="absolute -right-0.5 -top-0.5 sm:static" />
          )}
        </Link>
        <AuthUserMenu compact />
      </nav>
    </header>
  );
}
