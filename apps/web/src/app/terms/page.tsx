import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingContentPage } from '@/components/layout/marketing-content-page';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Terms of Service | Kushlov',
  description: 'The terms that govern your use of the Kushlov platform.',
};

const sections = [
  {
    title: '1. Agreement',
    body: 'By creating an account or using Kushlov (website, apps, and services), you agree to these Terms of Service, our Privacy Policy, Cookie Policy, and Community Guidelines. If you do not agree, do not use Kushlov.',
  },
  {
    title: '2. Eligibility',
    body: 'You must be at least 18 years old and legally able to enter a binding contract. You are responsible for the accuracy of your registration information and for keeping your login credentials secure.',
  },
  {
    title: '3. The service',
    body: 'Kushlov provides social discovery, messaging, audio/video calls, gifts/wallet features, live streaming, and related tools. Features may vary by region, role (user/host/admin), and device. We may modify or discontinue features with reasonable notice where practicable.',
  },
  {
    title: '4. Accounts & conduct',
    body: 'You agree to follow our Community Guidelines. You may not harass others, impersonate anyone, spam, scam, share illegal or non-consensual content, reverse engineer the service, or interfere with platform security. We may suspend or terminate accounts that violate these Terms.',
  },
  {
    title: '5. Virtual currency, gifts & payments',
    body: 'Diamonds, gold, gifts, and similar balances are licensed digital items for use on Kushlov — they have no cash value outside the platform except where a host withdrawal program expressly applies. Purchases are generally final except where required by law or our refund policy. Fraudulent chargebacks may result in account closure.',
  },
  {
    title: '6. Hosts',
    body: 'Hosts must complete verification and follow the Host Agreement. Co-hosting and live features are privileges that may be revoked for policy violations.',
  },
  {
    title: '7. Content & license',
    body: 'You retain rights to content you upload. You grant Kushlov a worldwide, non-exclusive license to host, display, and distribute that content as needed to operate the service (profiles, live, chat previews, moderation). You must have rights to any content you post.',
  },
  {
    title: '8. Third-party services',
    body: 'Calls and live may use third-party realtime providers. Payment processors handle card and wallet transactions under their own terms. We are not responsible for third-party outages beyond our reasonable control.',
  },
  {
    title: '9. Disclaimers',
    body: 'Kushlov is provided “as is” and “as available.” We do not guarantee uninterrupted service, match quality, or that every user is who they claim to be. Always use caution when meeting people online or offline.',
  },
  {
    title: '10. Limitation of liability',
    body: 'To the maximum extent permitted by law, Kushlov and its team are not liable for indirect, incidental, special, or consequential damages, or for loss of profits, data, or goodwill arising from your use of the service.',
  },
  {
    title: '11. Indemnity',
    body: 'You agree to indemnify Kushlov against claims arising from your content, your use of the service, or your violation of these Terms or applicable law.',
  },
  {
    title: '12. Governing law',
    body: 'These Terms are governed by the laws of India. Courts in Delhi NCR, India shall have exclusive jurisdiction, subject to mandatory consumer protections that may apply in your location.',
  },
  {
    title: '13. Changes',
    body: 'We may update these Terms. Continued use after changes become effective constitutes acceptance. Material changes may be announced in-app or by email when appropriate.',
  },
];

export default function TermsOfServicePage() {
  return (
    <MarketingContentPage
      title="Terms of Service"
      subtitle="The rules for using Kushlov’s dating, chat, call, and live features."
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
          Questions about these Terms:{' '}
          <a href="mailto:kushlov.com@gmail.com" className="text-brand-pink hover:underline">
            kushlov.com@gmail.com
          </a>{' '}
          · Delhi NCR, India
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/privacy">
            <Button variant="secondary">Privacy Policy</Button>
          </Link>
          <Link href="/community-guidelines">
            <Button>Community Guidelines</Button>
          </Link>
        </div>
      </section>
    </MarketingContentPage>
  );
}
