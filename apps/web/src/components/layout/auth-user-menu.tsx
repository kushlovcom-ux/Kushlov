'use client';

import Link from 'next/link';
import { LogOut } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { useLogout } from '@/hooks/use-auth';
import { UserAvatar } from '@/components/common/user-avatar';
import { Button } from '@/components/ui/button';

/** Profile chip + logout — shown in headers when the user is signed in. */
export function AuthUserMenu({ compact = false }: { compact?: boolean }) {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const sessionChecked = useAuthStore((s) => s.sessionChecked);
  const logout = useLogout();

  if (!sessionChecked || !accessToken || !user) return null;

  const home = user.role === 'admin' ? '/admin' : '/discover';

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <Link
        href="/profile"
        className="flex items-center gap-2 rounded-xl px-2 py-1.5 transition-colors hover:bg-white/5"
      >
        <UserAvatar name={user.displayName} src={user.avatarUrl} className="h-8 w-8" />
        {!compact && (
          <div className="hidden min-w-0 sm:block">
            <p className="truncate text-sm font-medium text-white">{user.displayName}</p>
            <p className="truncate text-xs text-white/40">@{user.username}</p>
          </div>
        )}
      </Link>
      <Link href={home} className="hidden md:inline-flex">
        <Button variant="secondary" size="sm">
          Open app
        </Button>
      </Link>
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 text-white/70"
        onClick={() => logout.mutate()}
        loading={logout.isPending}
      >
        <LogOut className="h-4 w-4" />
        <span className="hidden sm:inline">Log out</span>
      </Button>
    </div>
  );
}
