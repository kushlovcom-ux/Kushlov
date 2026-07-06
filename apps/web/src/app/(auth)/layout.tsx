import Link from 'next/link';
import { Logo } from '@kushlov/ui';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <Link href="/" className="mb-8 flex justify-center">
          <Logo size={44} />
        </Link>
        <div className="glass rounded-3xl p-8 shadow-2xl">{children}</div>
      </div>
    </div>
  );
}
