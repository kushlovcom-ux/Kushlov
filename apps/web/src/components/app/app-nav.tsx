'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Compass,
  Heart,
  MessageCircle,
  Radio,
  Wallet,
  Bell,
  ShieldCheck,
  LogOut,
  LayoutDashboard,
  Mail,
  History,
} from 'lucide-react';
import { Logo } from '@kushlov/ui';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth';
import { useLogout } from '@/hooks/use-auth';
import { UserAvatar } from '@/components/common/user-avatar';
import { useNavBadges, navBadgeForHref } from '@/hooks/use-nav-badges';
import { useAdminBadges } from '@/hooks/use-admin-badges';
import { NavBadge } from '@/components/app/nav-badge';

const nav = [
  { href: '/discover', label: 'Discover', icon: Compass },
  { href: '/matches', label: 'Matches', icon: Heart },
  { href: '/messages', label: 'Messages', icon: MessageCircle },
  { href: '/history', label: 'History', icon: History },
  { href: '/live', label: 'Live', icon: Radio },
  { href: '/wallet', label: 'Wallet', icon: Wallet },
  { href: '/notifications', label: 'Notifications', icon: Bell },
  { href: '/contact', label: 'Contact Us', icon: Mail },
];

export function AppNav() {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();
  const badges = useNavBadges();
  const adminBadges = useAdminBadges();

  const item = (href: string, label: string, Icon: typeof Compass, badge = 0) => {
    const active = pathname === href || pathname.startsWith(`${href}/`);
    return (
      <Link
        key={href}
        href={href}
        title={label}
        aria-label={badge > 0 ? `${label}, ${badge} unread` : label}
        className={cn(
          'relative flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors',
          active ? 'bg-brand-gradient text-white' : 'text-white/60 hover:bg-white/5 hover:text-white',
        )}
      >
        <span className="relative shrink-0">
          <Icon className="h-5 w-5" />
          {badge > 0 && (
            <NavBadge
              count={badge}
              className="absolute -right-2 -top-2 min-w-[1rem] px-0.5 text-[9px] leading-4"
            />
          )}
        </span>
        <span className="hidden lg:inline">{label}</span>
        {badge > 0 && <NavBadge count={badge} className="ml-auto hidden lg:inline-flex" />}
      </Link>
    );
  };

  return (
    <aside className="sticky top-0 hidden h-screen w-16 flex-col border-r border-white/10 bg-card/40 p-3 md:flex lg:w-64">
      <div className="shrink-0 px-2 py-3">
        <Logo withWordmark={false} size={32} className="lg:hidden" />
        <Logo size={30} className="hidden lg:flex" />
      </div>

      <nav className="mt-4 min-h-0 flex-1 space-y-1 overflow-y-auto no-scrollbar">
        {nav.map((n) => item(n.href, n.label, n.icon, navBadgeForHref(n.href, badges)))}
        {/* Normal users + unapproved hosts (incl. need-more-info) can open verification */}
        {(user?.role === 'user' ||
          (user?.role === 'host' && !user?.isHostApproved)) &&
          item(
            '/become-host',
            user?.role === 'host' ? 'Host verification' : 'Become a Host',
            ShieldCheck,
          )}
        {user?.role === 'admin' &&
          item('/admin', 'Admin', LayoutDashboard, adminBadges.total)}
      </nav>

      <div className="mt-auto shrink-0 space-y-1 border-t border-white/10 pt-3">
        <Link
          href="/profile"
          className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-white/5"
        >
          <UserAvatar name={user?.displayName} src={user?.avatarUrl} className="h-8 w-8" />
          <div className="hidden min-w-0 lg:block">
            <p className="truncate text-sm font-medium text-white">{user?.displayName}</p>
            <p className="truncate text-xs text-white/40">@{user?.username}</p>
          </div>
        </Link>
        <button
          onClick={() => logout.mutate()}
          title="Log out"
          className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-white/60 transition-colors hover:bg-white/5 hover:text-red-300"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          <span className="hidden lg:inline">Log out</span>
        </button>
      </div>
    </aside>
  );
}
