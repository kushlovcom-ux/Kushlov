'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Compass, MessageCircle, Radio, Mail, User, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavBadges, navBadgeForHref } from '@/hooks/use-nav-badges';
import { NavBadge } from '@/components/app/nav-badge';

const items = [
  { href: '/discover', label: 'Discover', icon: Compass },
  { href: '/messages', label: 'Messages', icon: MessageCircle },
  { href: '/live', label: 'Live', icon: Radio },
  { href: '/notifications', label: 'Alerts', icon: Bell },
  { href: '/contact', label: 'Contact', icon: Mail },
  { href: '/profile', label: 'Profile', icon: User },
];

/** Mobile bottom navigation — Contact Us and notification badges always visible. */
export function MobileBottomNav() {
  const pathname = usePathname();
  const badges = useNavBadges();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-card/95 backdrop-blur-xl md:hidden">
      <ul className="flex items-stretch justify-around px-0.5 py-1">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          const badge = navBadgeForHref(href, badges);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-label={badge > 0 ? `${label}, ${badge} unread` : label}
                className={cn(
                  'relative flex flex-col items-center gap-0.5 rounded-lg px-1 py-2 text-[9px] font-medium transition-colors',
                  active ? 'text-brand-pink' : 'text-white/50',
                )}
              >
                <span className="relative">
                  <Icon className={cn('h-5 w-5', active && 'text-brand-pink')} />
                  {badge > 0 && (
                    <NavBadge
                      count={badge}
                      className="absolute -right-2.5 -top-1.5 min-w-[0.875rem] px-0.5 text-[8px] leading-3"
                    />
                  )}
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
