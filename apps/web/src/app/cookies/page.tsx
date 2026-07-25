import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingContentPage } from '@/components/layout/marketing-content-page';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Cookie Policy | Kushlov',
  description: 'How Kushlov uses cookies and similar technologies.',
};

const sections = [
  {
    title: '1. What are cookies?',
    body: 'Cookies are small text files stored on your device. Similar technologies include local storage, session storage, and pixels. They help sites remember preferences, keep you signed in, and understand how the product is used.',
  },
  {
    title: '2. How Kushlov uses cookies',
    body: 'We use cookies and similar tech to authenticate sessions, remember settings, protect against abuse, measure performance, and improve features such as discovery and live. Some cookies are essential for the site to work; others are optional analytics or preference cookies.',
  },
  {
    title: '3. Types we use',
    body: 'Essential — login, security, load balancing. Functional — language or UI preferences. Analytics — aggregated usage to improve Kushlov. Marketing — only if we run campaigns that need them (we will update this page if that changes).',
  },
  {
    title: '4. Third parties',
    body: 'Payment providers, analytics, and realtime media partners may set their own cookies when you use related features. Those parties process data under their own policies.',
  },
  {
    title: '5. Your choices',
    body: 'Most browsers let you block or delete cookies. Blocking essential cookies may prevent login or core features from working. You can also clear site data from your browser settings for kushlov domains.',
  },
  {
    title: '6. Retention',
    body: 'Session cookies expire when you close the browser or after a short period. Persistent cookies remain until they expire or you delete them. Exact durations vary by cookie purpose.',
  },
  {
    title: '7. Updates',
    body: 'We may update this Cookie Policy as our practices or partners change. The “Last updated” date will reflect the latest version.',
  },
];

export default function CookiePolicyPage() {
  return (
    <MarketingContentPage
      title="Cookie Policy"
      subtitle="How cookies and similar technologies work on Kushlov."
    >
      <p className="text-sm text-white/45">Last updated: July 2026</p>

      {sections.map((s) => (
        <section key={s.title}>
          <h2 className="text-xl font-semibold text-white">{s.title}</h2>
          <p className="mt-2">{s.body}</p>
        </section>
      ))}

      <section>
        <h2 className="text-xl font-semibold text-white">More information</h2>
        <p className="mt-2">
          See our{' '}
          <Link href="/privacy" className="text-brand-pink hover:underline">
            Privacy Policy
          </Link>{' '}
          for how we handle personal data. Questions:{' '}
          <a href="mailto:kushlov.com@gmail.com" className="text-brand-pink hover:underline">
            kushlov.com@gmail.com
          </a>
          .
        </p>
        <div className="mt-6">
          <Link href="/privacy">
            <Button>Privacy Policy</Button>
          </Link>
        </div>
      </section>
    </MarketingContentPage>
  );
}
