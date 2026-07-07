'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Cookie, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const STORAGE_KEY = 'kushlov-cookie-pref';

/** Optional cookie notice — dismissible and not required to use the app. */
export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
  }, []);

  const dismiss = (pref: 'accepted' | 'dismissed') => {
    localStorage.setItem(STORAGE_KEY, pref);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie preferences"
      className="fixed bottom-20 left-4 right-4 z-[60] mx-auto max-w-lg rounded-2xl border border-white/10 bg-card/95 p-4 shadow-2xl backdrop-blur-xl md:bottom-4"
    >
      <div className="flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-gradient">
          <Cookie className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white">Cookies on Kushlov</p>
          <p className="mt-1 text-xs leading-relaxed text-white/55">
            We use essential cookies to keep you signed in for up to 30 days and remember your
            preferences. You can continue without accepting — this notice is optional.{' '}
            <Link href="/contact" className="text-brand-pink hover:underline">
              Learn more
            </Link>
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => dismiss('accepted')}>
              Accept cookies
            </Button>
            <Button size="sm" variant="secondary" onClick={() => dismiss('dismissed')}>
              Continue without
            </Button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => dismiss('dismissed')}
          className="shrink-0 rounded-lg p-1 text-white/40 hover:bg-white/5 hover:text-white"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
