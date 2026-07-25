import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingContentPage } from '@/components/layout/marketing-content-page';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Privacy Policy | Kushlov',
  description: 'How Kushlov collects, uses, and protects your personal information.',
};

const sections = [
  {
    title: '1. Who we are',
    body: 'Kushlov (“we”, “us”, “our”) operates the Kushlov website, apps, and related services for dating, messaging, calls, gifts, and live streaming. Our operations are based in Delhi NCR, India. Contact: kushlov.com@gmail.com · +91 8708554437.',
  },
  {
    title: '2. Information we collect',
    body: 'We may collect account details (name, email, phone, username), profile content (photos, bio, preferences), device and usage data, location (when you allow it for discovery), payment and wallet activity, communications you send through the platform, and verification documents submitted for host approval.',
  },
  {
    title: '3. How we use information',
    body: 'We use your data to provide and improve Kushlov, match and discover nearby users, power chat/calls/live, process diamonds/gifts/withdrawals, verify hosts, prevent fraud and abuse, send service notices, and comply with law. We do not sell your personal information.',
  },
  {
    title: '4. Sharing',
    body: 'We may share data with service providers (hosting, payments, analytics, LiveKit for realtime media), other users according to your profile and activity (e.g. display name on live chat), and authorities when required by law or to protect safety. Aggregated or anonymized data may be used for analytics.',
  },
  {
    title: '5. Cookies & similar tech',
    body: 'We use cookies and similar technologies for login sessions, preferences, security, and analytics. See our Cookie Policy for details and choices.',
  },
  {
    title: '6. Data retention',
    body: 'We keep information as long as your account is active and as needed for legal, security, and accounting purposes. You may request deletion; some records may be retained where we must do so by law.',
  },
  {
    title: '7. Security',
    body: 'We use industry-standard safeguards (encryption in transit, access controls, monitoring). No online service is 100% secure — please use a strong password and report suspicious activity promptly.',
  },
  {
    title: '8. Your rights',
    body: 'Depending on applicable law, you may request access, correction, deletion, or restriction of your personal data, or object to certain processing. Contact kushlov.com@gmail.com to exercise these rights. You may also close your account from settings where available.',
  },
  {
    title: '9. Children',
    body: 'Kushlov is for users 18 years and older. We do not knowingly collect data from anyone under 18. If you believe a minor has an account, contact us immediately.',
  },
  {
    title: '10. International transfers',
    body: 'Your information may be processed in India and other countries where our providers operate. We take steps appropriate to protect data in line with this policy.',
  },
  {
    title: '11. Changes',
    body: 'We may update this Privacy Policy from time to time. The “Last updated” date will change, and continued use of Kushlov means you accept the revised policy.',
  },
];

export default function PrivacyPolicyPage() {
  return (
    <MarketingContentPage
      title="Privacy Policy"
      subtitle="How we collect, use, and protect your information on Kushlov."
    >
      <p className="text-sm text-white/45">Last updated: July 2026</p>

      {sections.map((s) => (
        <section key={s.title}>
          <h2 className="text-xl font-semibold text-white">{s.title}</h2>
          <p className="mt-2">{s.body}</p>
        </section>
      ))}

      <section>
        <h2 className="text-xl font-semibold text-white">Contact</h2>
        <p className="mt-2">
          Privacy questions:{' '}
          <a href="mailto:kushlov.com@gmail.com" className="text-brand-pink hover:underline">
            kushlov.com@gmail.com
          </a>{' '}
          ·{' '}
          <a href="tel:+918708554437" className="text-brand-pink hover:underline">
            +91 8708554437
          </a>{' '}
          · Delhi NCR, India
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/cookies">
            <Button variant="secondary">Cookie Policy</Button>
          </Link>
          <Link href="/contact">
            <Button>Contact us</Button>
          </Link>
        </div>
      </section>
    </MarketingContentPage>
  );
}
