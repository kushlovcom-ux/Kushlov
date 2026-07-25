import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingContentPage } from '@/components/layout/marketing-content-page';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Host Agreement | Kushlov',
  description: 'Terms for approved Kushlov hosts who go live, take calls, and earn on the platform.',
};

const sections = [
  {
    title: '1. Purpose',
    body: 'This Host Agreement applies when you apply for, are approved as, or act as a Kushlov Host (including co-host sessions). It supplements the Terms of Service and Community Guidelines.',
  },
  {
    title: '2. Eligibility & verification',
    body: 'Hosts must be 18+, submit accurate identity/verification information, and maintain an approved status. Providing false documents or impersonating others is grounds for immediate removal and may be reported to authorities.',
  },
  {
    title: '3. Host responsibilities',
    body: 'You agree to: keep streams and calls appropriate and lawful; not promote scams or off-platform payment schemes; respect viewer privacy and consent; follow co-live invite etiquette; and respond to moderation requests. You are responsible for anyone you invite as a co-host on your stream.',
  },
  {
    title: '4. Content standards',
    body: 'Illegal content, hate, harassment, non-consensual sexual content, and content involving minors are strictly prohibited. Kushlov may end streams, remove content, or revoke host status without prior notice when safety is at risk.',
  },
  {
    title: '5. Earnings, gifts & withdrawals',
    body: 'Hosts may earn from gifts, paid interactions, or programs we publish. Balances, conversion rates, fees, and withdrawal rules are defined in-app or in host communications and may change. Withdrawals require a valid payout method and may be delayed for fraud or compliance review. Taxes on your earnings are your responsibility.',
  },
  {
    title: '6. Platform fees',
    body: 'Kushlov may retain a platform fee or commission on host earnings as disclosed in settings or host materials. You authorize us to deduct those amounts before payout.',
  },
  {
    title: '7. Independent status',
    body: 'Hosts are independent contractors, not employees or agents of Kushlov, unless a separate written agreement says otherwise. You are responsible for your own equipment, internet, and local compliance.',
  },
  {
    title: '8. Intellectual property',
    body: 'You grant Kushlov rights to use your host name, likeness, and stream content to operate and promote the platform (including clips, thumbnails, and marketing), unless you and Kushlov agree otherwise in writing.',
  },
  {
    title: '9. Suspension & termination',
    body: 'We may suspend or terminate host privileges for policy violations, inactivity, chargebacks, or safety concerns. You may stop hosting at any time; outstanding eligible balances remain subject to our withdrawal and compliance rules.',
  },
  {
    title: '10. Liability',
    body: 'You use hosting features at your own risk. Kushlov is not liable for lost earnings due to outages, moderation actions taken in good faith, or other users’ conduct, to the extent permitted by law.',
  },
  {
    title: '11. Changes',
    body: 'We may update this Host Agreement. Continued hosting after an update constitutes acceptance. Material payout changes will be communicated through the app or email when practicable.',
  },
];

export default function HostAgreementPage() {
  return (
    <MarketingContentPage
      title="Host Agreement"
      subtitle="Rules and expectations for approved Kushlov hosts and co-hosts."
    >
      <p className="text-sm text-white/45">Last updated: July 2026</p>

      {sections.map((s) => (
        <section key={s.title}>
          <h2 className="text-xl font-semibold text-white">{s.title}</h2>
          <p className="mt-2">{s.body}</p>
        </section>
      ))}

      <section>
        <h2 className="text-xl font-semibold text-white">Apply or get help</h2>
        <p className="mt-2">
          Ready to host? Start from Become a Host in the app. Questions:{' '}
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
          <Link href="/become-host">
            <Button>Become a Host</Button>
          </Link>
          <Link href="/community-guidelines">
            <Button variant="secondary">Community Guidelines</Button>
          </Link>
        </div>
      </section>
    </MarketingContentPage>
  );
}
