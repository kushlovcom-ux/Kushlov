'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  Flag,
  CreditCard,
  Banknote,
  Gift,
  Settings,
  LogOut,
  MessageSquare,
  CircleDot,
  Star,
  DollarSign,
  Gem,
} from 'lucide-react';
import { Logo } from '@kushlov/ui';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth';
import { useLogout } from '@/hooks/use-auth';
import { useAdminBadges, adminBadgeForHref } from '@/hooks/use-admin-badges';
import { NavBadge } from '@/components/app/nav-badge';

const nav = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/hosts', label: 'Host Pricing', icon: DollarSign },
  { href: '/admin/reviews', label: 'Reviews', icon: Star },
  { href: '/admin/online', label: 'Online now', icon: CircleDot },
  { href: '/admin/verifications', label: 'Host Verifications', icon: ShieldCheck },
  { href: '/admin/reports', label: 'Reports', icon: Flag },
  { href: '/admin/payments', label: 'Payments', icon: CreditCard },
  { href: '/admin/diamonds', label: 'Send diamonds', icon: Gem },
  { href: '/admin/withdrawals', label: 'Withdrawals', icon: Banknote },
  { href: '/admin/gifts', label: 'Gifts', icon: Gift },
  { href: '/admin/inquiries', label: 'Inquiries', icon: MessageSquare },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, accessToken, hydrated, sessionChecked } = useAuthStore();
  const pathname = usePathname();
  const router = useRouter();
  const badges = useAdminBadges();
  const logout = useLogout();

  useEffect(() => {
    if (!hydrated || !sessionChecked) return;
    if (!accessToken) router.replace('/login');
    else if (user && user.role !== 'admin') router.replace('/discover');
  }, [hydrated, sessionChecked, accessToken, user, router]);

  if (!hydrated || !sessionChecked || !user || user.role !== 'admin') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-brand-pink" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-64 flex-col border-r border-white/10 bg-card/40 p-4">
        <Link href="/" aria-label="Kushlov home" className="inline-flex">
          <Logo size={30} />
        </Link>
        <nav className="mt-6 flex flex-1 flex-col gap-1 overflow-y-auto no-scrollbar">
          {nav.map((n) => {
            const active = pathname === n.href;
            const badge = adminBadgeForHref(n.href, badges);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors',
                  active ? 'bg-brand-gradient text-white' : 'text-white/60 hover:bg-white/5',
                )}
              >
                <span className="relative shrink-0">
                  <n.icon className="h-5 w-5" />
                  {badge > 0 && (
                    <NavBadge
                      count={badge}
                      className="absolute -right-2 -top-2 min-w-[1rem] px-0.5 text-[9px] leading-4"
                    />
                  )}
                </span>
                <span className="flex-1">{n.label}</span>
                {badge > 0 && <NavBadge count={badge} />}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto border-t border-white/10 pt-3">
          <button
            type="button"
            onClick={() => logout.mutate()}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-white/60 transition-colors hover:bg-white/5 hover:text-red-300"
          >
            <LogOut className="h-5 w-5" />
            Log out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-x-hidden">{children}</main>
    </div>
  );
}
