import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingContentPage } from '@/components/layout/marketing-content-page';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Careers | Kushlov',
  description: 'Join the Kushlov team and help build meaningful connections online.',
};

const roles = [
  {
    title: 'Full-Stack Engineer',
    type: 'Remote · Full-time',
    blurb:
      'Build realtime features across Next.js, Node.js, LiveKit, and MongoDB. You care about polished UX and reliable systems.',
  },
  {
    title: 'Community & Trust Specialist',
    type: 'Remote · Full-time',
    blurb:
      'Help keep Kushlov safe. Review reports, improve host verification, and partner with product on better safety tools.',
  },
  {
    title: 'Host Partnerships Manager',
    type: 'India · Hybrid',
    blurb:
      'Grow our host community, run onboarding programs, and turn great creators into successful live hosts.',
  },
];

export default function CareersPage() {
  return (
    <MarketingContentPage
      title="Careers"
      subtitle="Help us build the next generation of dating, chat, and live streaming — with safety and quality at the center."
    >
      <section>
        <h2 className="text-xl font-semibold text-white">Why Kushlov</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>Ship product that millions of people can use to meet and go live safely.</li>
          <li>Small, focused team — your work ships to production quickly.</li>
          <li>Remote-friendly culture with clear ownership and async communication.</li>
          <li>Competitive pay, flexible hours, and room to grow with the product.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-white">Open roles</h2>
        <div className="mt-4 space-y-4">
          {roles.map((role) => (
            <article
              key={role.title}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-lg font-semibold text-white">{role.title}</h3>
                <span className="text-xs text-white/40">{role.type}</span>
              </div>
              <p className="mt-2 text-white/60">{role.blurb}</p>
            </article>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-white">How to apply</h2>
        <p className="mt-3">
          Send your resume (and portfolio or GitHub if relevant) to{' '}
          <a
            href="mailto:kushlov.com@gmail.com"
            className="text-brand-pink hover:underline"
          >
            kushlov.com@gmail.com
          </a>{' '}
          with the role title in the subject line. Tell us briefly why Kushlov interests you and what
          you’d like to work on first.
        </p>
        <p className="mt-3">
          Prefer a conversation first? Reach us at{' '}
          <a href="tel:+918708554437" className="text-brand-pink hover:underline">
            +91 8708554437
          </a>{' '}
          or through our{' '}
          <Link href="/contact" className="text-brand-pink hover:underline">
            contact form
          </Link>
          .
        </p>
        <div className="mt-6">
          <Link href="/contact">
            <Button>Contact the team</Button>
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-card/40 p-5 text-sm text-white/50">
        Kushlov is an equal-opportunity employer. We welcome applicants of all backgrounds and do not
        discriminate based on race, religion, gender, age, disability, or any other protected status.
      </section>
    </MarketingContentPage>
  );
}
