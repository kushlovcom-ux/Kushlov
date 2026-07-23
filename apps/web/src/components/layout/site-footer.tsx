import Link from 'next/link';
import { Facebook, Instagram, Twitter, Youtube, Mail, MapPin, Phone } from 'lucide-react';
import { Logo } from '@kushlov/ui';
import { Button } from '@/components/ui/button';

const productLinks = [
  { label: 'Discover', href: '/discover' },
  { label: 'Live Streams', href: '/live' },
  { label: 'Matches', href: '/matches' },
  { label: 'Wallet & Gifts', href: '/wallet' },
];

const companyLinks = [
  { label: 'About Kushlov', href: '/#features' },
  { label: 'Become a Host', href: '/register' },
  { label: 'Safety Center', href: '/contact' },
  { label: 'Careers', href: '/contact' },
];

const supportLinks = [
  { label: 'Contact Us', href: '/contact' },
  { label: 'Help Center', href: '/contact' },
  { label: 'Community Guidelines', href: '/contact' },
  { label: 'Report an Issue', href: '/contact' },
];

const legalLinks = [
  { label: 'Privacy Policy', href: '/contact' },
  { label: 'Terms of Service', href: '/contact' },
  { label: 'Cookie Policy', href: '/contact' },
  { label: 'Host Agreement', href: '/contact' },
];

const social = [
  { label: 'Instagram', href: 'https://instagram.com', icon: Instagram },
  { label: 'Twitter', href: 'https://twitter.com', icon: Twitter },
  { label: 'Facebook', href: 'https://facebook.com', icon: Facebook },
  { label: 'YouTube', href: 'https://youtube.com', icon: Youtube },
];

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-white/10 bg-card/30">
      <div className="container py-16">
        <div className="grid gap-12 lg:grid-cols-12">
          {/* Brand column */}
          <div className="lg:col-span-4">
            <Link href="/" aria-label="Kushlov home" className="inline-flex">
              <Logo size={36} />
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/55">
              Kushlov is a premium dating and live-streaming platform where people meet, match,
              chat, call, and go live — all in one beautiful experience.
            </p>
            <div className="mt-6 space-y-2 text-sm text-white/45">
              <p className="flex items-center gap-2">
                <Mail className="h-4 w-4 shrink-0 text-brand-pink" />
                support@kushlov.app
              </p>
              <p className="flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0 text-brand-pink" />
                +1 (800) 555-KUSH
              </p>
              <p className="flex items-center gap-2">
                <MapPin className="h-4 w-4 shrink-0 text-brand-pink" />
                San Francisco, CA
              </p>
            </div>
            <div className="mt-6 flex gap-3">
              {social.map(({ label, href, icon: Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/60 transition-colors hover:border-brand-pink/40 hover:bg-brand-pink/10 hover:text-white"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          <div className="grid gap-8 sm:grid-cols-2 lg:col-span-5 lg:grid-cols-3">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-white/80">Product</h3>
              <ul className="mt-4 space-y-3">
                {productLinks.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-sm text-white/50 transition-colors hover:text-brand-pink">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-white/80">Company</h3>
              <ul className="mt-4 space-y-3">
                {companyLinks.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-sm text-white/50 transition-colors hover:text-brand-pink">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-white/80">Support</h3>
              <ul className="mt-4 space-y-3">
                {supportLinks.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-sm text-white/50 transition-colors hover:text-brand-pink">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Newsletter */}
          <div className="lg:col-span-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white/80">Stay in the loop</h3>
            <p className="mt-4 text-sm text-white/50">
              Get updates on new features, host programs, and exclusive offers.
            </p>
            <form className="mt-4 flex flex-col gap-2 sm:flex-row lg:flex-col">
              <input
                type="email"
                placeholder="you@example.com"
                className="h-11 flex-1 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-brand-pink/60"
              />
              <Button type="button" className="shrink-0">
                Subscribe
              </Button>
            </form>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/10">
        <div className="container flex flex-col items-center justify-between gap-4 py-6 text-sm text-white/40 md:flex-row">
          <p>© {new Date().getFullYear()} Kushlov Technologies. All rights reserved.</p>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {legalLinks.map((link) => (
              <Link key={link.label} href={link.href} className="hover:text-white/70">
                {link.label}
              </Link>
            ))}
          </div>
          <p className="text-xs">Made with ♥ for meaningful connections</p>
        </div>
      </div>
    </footer>
  );
}
