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
  IndianRupee,
  Radio,
} from 'lucide-react';
import { Logo } from '@kushlov/ui';
import {
  ADMIN_SECTION_OPTIONS,
  AdminSection,
  adminSectionForPath,
  hasAdminSection,
  isAdminStaff,
} from '@kushlov/types';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth';
import { useLogout } from '@/hooks/use-auth';
import { useAdminBadges, adminBadgeForHref } from '@/hooks/use-admin-badges';
import { NavBadge } from '@/components/app/nav-badge';

const nav = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, section: AdminSection.Dashboard },
  { href: '/admin/users', label: 'Users', icon: Users, section: AdminSection.Users },
  { href: '/admin/hosts', label: 'Host Pricing', icon: DollarSign, section: AdminSection.Hosts },
  { href: '/admin/reviews', label: 'Reviews', icon: Star, section: AdminSection.Reviews },
  { href: '/admin/online', label: 'Online now', icon: CircleDot, section: AdminSection.Online },
  { href: '/admin/live', label: 'Live now', icon: Radio, section: AdminSection.Live },
  { href: '/admin/verifications', label: 'Host Verifications', icon: ShieldCheck, section: AdminSection.Verifications },
  { href: '/admin/reports', label: 'Reports', icon: Flag, section: AdminSection.Reports },
  { href: '/admin/payments', label: 'Payments', icon: CreditCard, section: AdminSection.Payments },
  { href: '/admin/revenue', label: 'Revenue', icon: IndianRupee, section: AdminSection.Revenue },
  { href: '/admin/diamonds', label: 'Send diamonds', icon: Gem, section: AdminSection.Diamonds },
  { href: '/admin/withdrawals', label: 'Withdrawals', icon: Banknote, section: AdminSection.Withdrawals },
  { href: '/admin/gifts', label: 'Gifts', icon: Gift, section: AdminSection.Gifts },
  { href: '/admin/inquiries', label: 'Inquiries', icon: MessageSquare, section: AdminSection.Inquiries },
  { href: '/admin/settings', label: 'Settings', icon: Settings, section: AdminSection.Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, accessToken, hydrated, sessionChecked } = useAuthStore();
  const pathname = usePathname();
  const router = useRouter();
  const badges = useAdminBadges();
  const logout = useLogout();

  useEffect(() => {
    if (!hydrated || !sessionChecked) return;
    if (!accessToken) {
      router.replace('/login');
      return;
    }
    if (user && !isAdminStaff(user)) {
      router.replace('/discover');
      return;
    }
    if (!user) return;
    const section = adminSectionForPath(pathname);
    if (section && !hasAdminSection(user, section)) {
      const first = ADMIN_SECTION_OPTIONS.find((s) => hasAdminSection(user, s.id));
      router.replace(first?.href ?? '/discover');
    }
  }, [hydrated, sessionChecked, accessToken, user, router, pathname]);

  if (!hydrated || !sessionChecked || !user || !isAdminStaff(user)) {
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
        {user.role !== 'admin' && (
          <p className="mt-2 px-1 text-xs font-medium uppercase tracking-wide text-white/40">
            Subadmin
          </p>
        )}
        <nav className="mt-6 flex flex-1 flex-col gap-1 overflow-y-auto no-scrollbar">
          {nav
            .filter((n) => hasAdminSection(user, n.section))
            .map((n) => {
            const active =
              n.href === '/admin'
                ? pathname === '/admin'
                : pathname === n.href || pathname.startsWith(`${n.href}/`);
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
