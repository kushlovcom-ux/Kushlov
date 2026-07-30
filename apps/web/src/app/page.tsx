import Link from 'next/link';
import Image from 'next/image';
import { ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SiteFooter } from '@/components/layout/site-footer';
import { LandingHeader } from '@/components/layout/landing-header';
import { LandingHeroStats, LandingFeatureGrid } from '@/components/landing/landing-platform-stats';
import { LandingShowcaseCarousel } from '@/components/landing/landing-showcase-carousel';
import { LandingPopularHosts } from '@/components/landing/landing-popular-hosts';

export default function LandingPage() {
  return (
    <div className="relative">
      <LandingHeader />

      {/* Hero — overflow clipped here so the header Open app control is never cut off */}
      <section className="container relative overflow-hidden grid items-center gap-10 py-16 md:grid-cols-2 md:py-24">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-white/70">
            <ShieldCheck className="h-4 w-4 text-brand-pink" /> Verified hosts · Secure payments
          </span>
          <h1 className="mt-6 text-5xl font-extrabold leading-tight tracking-tight md:text-6xl">
            Meet. Match.{' '}
            <span className="text-gradient">Go Live With Video Call.</span>
          </h1>
          <p className="mt-5 max-w-md text-lg text-white/60">
            Kushlov blends dating, real-time chat and live streaming into one premium experience.
            Connect through calls, watch your favorite hosts live, and send gifts.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link href="/register">
              <Button size="lg">Create your profile</Button>
            </Link>
            <Link href="/discover">
              <Button size="lg" variant="secondary">
                Explore
              </Button>
            </Link>
          </div>
          <LandingHeroStats />
        </div>

        <div className="relative flex justify-center">
          <div className="absolute inset-0 -z-10 animate-float rounded-full bg-brand-gradient opacity-30 blur-3xl" />
          <Image
            src="/kush.webp"
            alt="Kushlov"
            width={420}
            height={420}
            priority
            className="animate-float drop-shadow-2xl"
          />
        </div>
      </section>

      {/* Features */}
      <section id="features" className="container py-16 scroll-mt-20">
        <h2 className="text-center text-3xl font-bold md:text-4xl">
          Everything you need to <span className="text-gradient">connect</span>
        </h2>
        <LandingFeatureGrid />
      </section>

      <LandingPopularHosts />

      {/* CTA */}
      <section className="container py-20">
        <div className="glass relative overflow-hidden rounded-3xl p-10 text-center md:p-16">
          <div className="absolute inset-0 -z-10 bg-brand-gradient opacity-10" />
          <h2 className="text-3xl font-bold md:text-4xl">Ready to become a host?</h2>
          <p className="mx-auto mt-4 max-w-lg text-white/60">
            Get verified, go live, accept audio & video calls and turn your audience into income.
          </p>
          <Link href="/register?type=host" className="mt-8 inline-block">
            <Button size="lg">Sign up as a Host</Button>
          </Link>
        </div>
      </section>

      <LandingShowcaseCarousel />

      <SiteFooter />
    </div>
  );
}
