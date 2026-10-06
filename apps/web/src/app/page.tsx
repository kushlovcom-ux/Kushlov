import Link from 'next/link';
import Image from 'next/image';
import { ShieldCheck, Video, Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SiteFooter } from '@/components/layout/site-footer';
import { LandingHeader } from '@/components/layout/landing-header';
import { LandingHeroStats, LandingFeatureGrid } from '@/components/landing/landing-platform-stats';
import { LandingShowcaseCarousel } from '@/components/landing/landing-showcase-carousel';
import { LandingPopularHosts } from '@/components/landing/landing-popular-hosts';
import { LandingLiveStreams } from '@/components/landing/landing-live-streams';
import { LandingActiveNow } from '@/components/landing/landing-active-now';

export default function LandingPage() {
  return (
    <div className="relative">
      <LandingHeader />

      {/* Hero */}
      <section className="container relative overflow-hidden py-8 sm:py-12 md:py-16">
        <h1 className="sr-only">Kushlov - Meet New People Through Video Chat</h1>

        {/* Ambient atmospheric glow behind hero banner */}
        <div className="pointer-events-none absolute inset-x-0 top-1/4 -z-10 mx-auto h-72 max-w-4xl rounded-full bg-brand-gradient opacity-20 blur-3xl" />

        <div className="flex flex-col items-center text-center">
          {/* Trust badge */}
          <div className="mb-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-white/70 backdrop-blur-md">
              <ShieldCheck className="h-4 w-4 text-brand-pink" /> Verified hosts · Secure payments · 100% Anonymous
            </span>
          </div>

          {/* Hero Banner Image */}
          <div className="group relative w-full max-w-6xl overflow-hidden rounded-2xl border border-white/10 bg-card/40 shadow-2xl shadow-brand-pink/15 transition-all hover:border-white/20 sm:rounded-3xl">
            <Link
              href="/discover"
              className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-pink"
              aria-label="Start Video Chat on Kushlov"
            >
              <div className="relative aspect-[1983/793] w-full overflow-hidden">
                <Image
                  src="/kh1.png"
                  alt="Kushlov - Meet New People Through Video Chat"
                  width={1983}
                  height={793}
                  priority
                  className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.015]"
                />
              </div>
            </Link>
          </div>

          {/* Hero Actions */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            <Link href="/discover">
              <Button
                size="lg"
                className="gap-2.5 px-6 sm:px-8 text-base font-semibold shadow-xl shadow-brand-pink/25 hover:shadow-brand-pink/40"
              >
                <Video className="h-5 w-5" />
                Start Video Chat
              </Button>
            </Link>
            <Link href="/register">
              <Button
                size="lg"
                variant="secondary"
                className="px-6 sm:px-8 text-base font-semibold"
              >
                Create your profile
              </Button>
            </Link>
            <Link href="/discover">
              <Button
                size="lg"
                variant="secondary"
                className="gap-2 px-6 sm:px-8 text-base font-semibold"
              >
                <Compass className="h-4 w-4 text-white/70" />
                Explore
              </Button>
            </Link>
          </div>

          {/* Platform Stats */}
          <div className="mt-4 flex justify-center">
            <LandingHeroStats />
          </div>
        </div>
      </section>

      {/* Active Now Section */}
      <LandingActiveNow />

      {/* Features */}
      <section id="features" className="container py-16 scroll-mt-20">
        <h2 className="text-center text-3xl font-bold md:text-4xl">
          Everything you need to <span className="text-gradient">connect</span>
        </h2>
        <LandingFeatureGrid />
      </section>

      {/* Live Broadcasts Section */}
      <LandingLiveStreams />

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
