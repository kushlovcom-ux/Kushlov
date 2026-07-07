'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

/** Compact search that navigates to Discover with a query. */
export function AppSearchBar({ className }: { className?: string }) {
  const router = useRouter();
  const [q, setQ] = useState('');

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = q.trim();
    router.push(trimmed ? `/discover?q=${encodeURIComponent(trimmed)}` : '/discover');
  };

  return (
    <form onSubmit={onSubmit} className={className}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search people & hosts…"
          className="h-9 w-44 pl-9 text-sm sm:w-52 md:w-60"
        />
      </div>
    </form>
  );
}
