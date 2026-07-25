import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingContentPage } from '@/components/layout/marketing-content-page';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Community Guidelines | Kushlov',
  description: 'Rules that keep Kushlov safe, respectful, and fun for everyone.',
};

const sections = [
  {
    title: '1. Be respectful',
    body: 'Treat every member with dignity. Harassment, hate speech, bullying, stalking, or threats — in chat, calls, live streams, or profiles — are not allowed.',
  },
  {
    title: '2. Keep it legal and age-appropriate',
    body: 'You must be 18+ to use Kushlov. Do not share or request illegal content, sexual content involving minors, scams, or anything that breaks local law.',
  },
  {
    title: '3. Authentic profiles',
    body: 'Use your own photos and accurate information. Impersonation, fake accounts, and misleading host credentials are prohibited.',
  },
  {
    title: '4. Live streaming & co-hosting',
    body: 'Hosts are responsible for what happens on their stream. Do not stream violence, illegal activity, extreme gore, or non-consensual content. Co-hosts must follow the same rules as the primary host.',
  },
  {
    title: '5. Calls, chat & gifts',
    body: 'Do not spam, pressure others for money outside the platform, or misuse gifts. Refund fraud and payment abuse will result in account action.',
  },
  {
    title: '6. Privacy & consent',
    body: 'Never record, screenshot, or redistribute private calls or chats without clear consent. Do not share others’ personal information (doxxing).',
  },
  {
    title: '7. Safety tools',
    body: 'Use Report, Block, and Contact Us when something feels wrong. We review reports and may warn, suspend, or permanently ban accounts that break these guidelines.',
  },
  {
    title: '8. Host standards',
    body: 'Approved hosts must complete verification honestly, keep streams appropriate for our audience, and respond to moderation requests promptly.',
  },
];

export default function CommunityGuidelinesPage() {
  return (
    <MarketingContentPage
      title="Community Guidelines"
      subtitle="These rules help everyone enjoy Kushlov — dating, chat, calls, and live — safely and respectfully."
    >
      <section>
        <p>
          By using Kushlov you agree to follow these Community Guidelines along with our Terms of
          Service. Violations may lead to content removal, feature limits, or account suspension.
        </p>
      </section>

      {sections.map((s) => (
        <section key={s.title}>
          <h2 className="text-xl font-semibold text-white">{s.title}</h2>
          <p className="mt-2">{s.body}</p>
        </section>
      ))}

      <section>
        <h2 className="text-xl font-semibold text-white">Report a problem</h2>
        <p className="mt-2">
          If you see something that breaks these guidelines, report it in-app or contact us at{' '}
          <a
            href="mailto:kushlov.com@gmail.com"
            className="text-brand-pink hover:underline"
          >
            kushlov.com@gmail.com
          </a>{' '}
          /{' '}
          <a href="tel:+918708554437" className="text-brand-pink hover:underline">
            +91 8708554437
          </a>
          .
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/contact">
            <Button>Contact support</Button>
          </Link>
          <Link href="/discover">
            <Button variant="secondary">Back to Discover</Button>
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-card/40 p-5 text-sm text-white/50">
        Last updated: July 2026. We may update these guidelines as Kushlov grows. Continued use of
        the platform means you accept the latest version.
      </section>
    </MarketingContentPage>
  );
}
