import Link from 'next/link';
import Image from 'next/image';
import {
  Heart,
  Video,
  Radio,
  MessageCircle,
  Gift,
  Gem,
  ShieldCheck,
  PhoneCall,
} from 'lucide-react';
import { Logo } from '@kushlov/ui';
import { Button } from '@/components/ui/button';
import { SiteFooter } from '@/components/layout/site-footer';

const features = [
  { icon: Heart, title: 'Smart Matching', desc: 'Like, match and discover people who fit what you are looking for.' },
  { icon: MessageCircle, title: 'Realtime Chat', desc: 'Text, emoji, photos, voice notes, read receipts and typing indicators.' },
  { icon: PhoneCall, title: 'Audio & Video Calls', desc: 'Crystal-clear 1:1 calls powered by LiveKit with in-call gifting.' },
  { icon: Radio, title: 'Live Streaming', desc: 'Go live, grow followers, moderate your room and earn in real time.' },
  { icon: Gift, title: 'Gifts & Coins', desc: 'Send animated gifts. Hosts convert engagement into gold coins.' },
  { icon: Gem, title: 'Diamond Wallet', desc: 'Buy diamonds securely and spend them across the whole platform.' },
];

export default function LandingPage() {
  return (
    <div className="relative overflow-hidden">
      {/* Nav */}
      <header className="container flex items-center justify-between py-6">
        <Logo />
        <nav className="flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost">Log in</Button>
          </Link>
          <Link href="/register">
            <Button>Get started</Button>
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="container grid items-center gap-10 py-16 md:grid-cols-2 md:py-24">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-white/70">
            <ShieldCheck className="h-4 w-4 text-brand-pink" /> Verified hosts · Secure payments
          </span>
          <h1 className="mt-6 text-5xl font-extrabold leading-tight tracking-tight md:text-6xl">
            Meet. Match. <span className="text-gradient">Go Live.</span>
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
          <div className="mt-10 flex items-center gap-8 text-sm text-white/50">
            <div>
              <div className="text-2xl font-bold text-white">120k+</div>members
            </div>
            <div>
              <div className="text-2xl font-bold text-white">8k+</div>verified hosts
            </div>
            <div>
              <div className="text-2xl font-bold text-white">24/7</div>live rooms
            </div>
          </div>
        </div>

        <div className="relative flex justify-center">
          <div className="absolute inset-0 -z-10 animate-float rounded-full bg-brand-gradient opacity-30 blur-3xl" />
          <Image
            src="/kush.png"
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
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="glass rounded-2xl p-6 transition-transform hover:-translate-y-1"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-gradient">
                <f.icon className="h-6 w-6 text-white" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-white/55">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

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

      <SiteFooter />
    </div>
  );
}
