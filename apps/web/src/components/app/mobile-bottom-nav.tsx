'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Compass, MessageCircle, Radio, Mail, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const items = [
  { href: '/discover', label: 'Discover', icon: Compass },
  { href: '/messages', label: 'Messages', icon: MessageCircle },
  { href: '/live', label: 'Live', icon: Radio },
  { href: '/contact', label: 'Contact', icon: Mail },
  { href: '/profile', label: 'Profile', icon: User },
];

/** Mobile bottom navigation — ensures Contact Us is always one tap away. */
export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-card/95 backdrop-blur-xl md:hidden">
      <ul className="flex items-stretch justify-around px-1 py-1">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={cn(
                  'flex flex-col items-center gap-0.5 rounded-lg px-2 py-2 text-[10px] font-medium transition-colors',
                  active ? 'text-brand-pink' : 'text-white/50',
                )}
              >
                <Icon className={cn('h-5 w-5', active && 'text-brand-pink')} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
