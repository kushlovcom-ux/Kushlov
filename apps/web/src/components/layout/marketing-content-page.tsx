import Link from 'next/link';
import type { ReactNode } from 'react';
import { LandingHeader } from '@/components/layout/landing-header';
import { SiteFooter } from '@/components/layout/site-footer';

export function MarketingContentPage({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <LandingHeader />
      <main className="container max-w-3xl py-12 md:py-16">
        <p className="text-sm text-white/40">
          <Link href="/" className="hover:text-brand-pink">
            Home
          </Link>
          <span className="mx-2">/</span>
          <span className="text-white/60">{title}</span>
        </p>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight md:text-4xl">{title}</h1>
        {subtitle ? <p className="mt-3 text-lg text-white/55">{subtitle}</p> : null}
        <div className="prose-invert mt-10 space-y-8 text-[15px] leading-relaxed text-white/70">
          {children}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
