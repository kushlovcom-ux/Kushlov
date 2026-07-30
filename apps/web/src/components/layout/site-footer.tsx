import Link from 'next/link';
import { Facebook, Instagram, Youtube, Mail, MapPin, Phone } from 'lucide-react';
import { Logo } from '@kushlov/ui';

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
  { label: 'Careers', href: '/careers' },
];

const supportLinks = [
  { label: 'Contact Us', href: '/contact' },
  { label: 'Help Center', href: '/contact' },
  { label: 'Community Guidelines', href: '/community-guidelines' },
  { label: 'Report an Issue', href: '/contact' },
];

const legalLinks = [
  { label: 'Privacy Policy', href: '/privacy' },
  { label: 'Terms of Service', href: '/terms' },
  { label: 'Cookie Policy', href: '/cookies' },
  { label: 'Host Agreement', href: '/host-agreement' },
];

const social = [
  {
    label: 'Instagram',
    href: 'https://www.instagram.com/khus655940?igsh=MWk0ZWs2NTc5ZHpzdQ==&utm_source=ig_contact_invite',
    icon: Instagram,
  },
  {
    label: 'Facebook',
    href: 'https://www.facebook.com/share/19QLco38K6/',
    icon: Facebook,
  },
  {
    label: 'YouTube',
    href: 'https://youtube.com/@kushlov-x7o?si=kK5H3PELQrLuFZp8',
    icon: Youtube,
  },
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
              chat, call, and go live — all in one beautiful experience platform.
            </p>
            <div className="mt-6 space-y-2 text-sm text-white/45">
              <p className="flex items-center gap-2">
                <Mail className="h-4 w-4 shrink-0 text-brand-pink" />
                <a href="mailto:kushlov.com@gmail.com" className="hover:text-brand-pink">
                  kushlov.com@gmail.com
                </a>
              </p>
              <p className="flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0 text-brand-pink" />
                <a href="tel:+918708554437" className="hover:text-brand-pink">
                  +91 8708554437
                </a>
              </p>
              <p className="flex items-center gap-2">
                <MapPin className="h-4 w-4 shrink-0 text-brand-pink" />
                Delhi NCR, India
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
          <div className="grid gap-8 sm:grid-cols-2 lg:col-span-8 lg:grid-cols-3">
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
