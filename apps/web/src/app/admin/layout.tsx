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
  ArrowLeft,
} from 'lucide-react';
import { Logo } from '@kushlov/ui';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth';

const nav = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/verifications', label: 'Host Verifications', icon: ShieldCheck },
  { href: '/admin/reports', label: 'Reports', icon: Flag },
  { href: '/admin/payments', label: 'Payments', icon: CreditCard },
  { href: '/admin/withdrawals', label: 'Withdrawals', icon: Banknote },
  { href: '/admin/gifts', label: 'Gifts', icon: Gift },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, accessToken, hydrated } = useAuthStore();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!hydrated) return;
    if (!accessToken) router.replace('/login');
    else if (user && user.role !== 'admin') router.replace('/discover');
  }, [hydrated, accessToken, user, router]);

  if (!hydrated || !user || user.role !== 'admin') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-brand-pink" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-64 flex-col border-r border-white/10 bg-card/40 p-4">
        <Logo size={30} />
        <nav className="mt-6 flex flex-1 flex-col gap-1">
          {nav.map((n) => {
            const active = pathname === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors',
                  active ? 'bg-brand-gradient text-white' : 'text-white/60 hover:bg-white/5',
                )}
              >
                <n.icon className="h-5 w-5" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <Link
          href="/discover"
          className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm text-white/60 hover:bg-white/5"
        >
          <ArrowLeft className="h-5 w-5" /> Back to app
        </Link>
      </aside>
      <main className="flex-1 overflow-x-hidden">{children}</main>
    </div>
  );
}
