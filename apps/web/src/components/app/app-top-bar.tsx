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
export function AppTopBar() {
  const pathname = usePathname();
  const badges = useNavBadges();
  const contactActive = pathname === '/contact' || pathname.startsWith('/contact/');

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between gap-4 border-b border-white/10 bg-card/80 px-4 py-3 backdrop-blur-xl md:px-6">
      <div className="md:hidden">
        <Link href="/discover" aria-label="Kushlov home" className="inline-flex">
          <Logo withWordmark={false} size={28} />
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
