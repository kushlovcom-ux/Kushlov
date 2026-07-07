import Link from 'next/link';
import { Logo } from '@kushlov/ui';
import { Mail } from 'lucide-react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="mb-4 flex w-full max-w-lg items-center justify-between px-2">
        <Link href="/">
          <Logo size={36} />
        </Link>
        <Link
          href="/login?next=/contact"
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-white/70 transition-colors hover:bg-white/5 hover:text-white"
        >
          <Mail className="h-4 w-4" />
          Contact Us
        </Link>
      </div>
      <div className="w-full max-w-lg">
        <div className="glass rounded-3xl p-8 shadow-2xl">{children}</div>
      </div>
    </div>
  );
}
