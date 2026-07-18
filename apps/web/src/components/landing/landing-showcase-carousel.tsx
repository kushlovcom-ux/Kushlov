'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const slides = [
  {
    src: '/k1.webp',
    alt: 'Connect through live video calls on Kushlov',
    title: 'Go live with confidence',
    subtitle: 'Crystal-clear video calls and streaming built for real connections.',
  },
  {
    src: '/k2.webp',
    alt: 'Match and chat with people on Kushlov',
    title: 'Meet people who match you',
    subtitle: 'Smart discovery, realtime chat, and meaningful one-to-one calls.',
  },
  {
    src: '/k3.webp',
    alt: 'Earn as a verified Kushlov host',
    title: 'Turn your audience into income',
    subtitle: 'Get verified, grow followers, and earn from calls, chat, and gifts.',
  },
] as const;

const INTERVAL_MS = 5500;

export function LandingShowcaseCarousel() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  const goTo = useCallback((index: number) => {
    setActive((index + slides.length) % slides.length);
  }, []);

  const next = useCallback(() => goTo(active + 1), [active, goTo]);
  const prev = useCallback(() => goTo(active - 1), [active, goTo]);

  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(next, INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [paused, next]);

  return (
    <section className="container pb-20 pt-4" aria-label="Platform showcase">
      <div className="mb-8 text-center">
        <p className="text-sm font-medium uppercase tracking-widest text-brand-pink/80">
          See Kushlov in action
        </p>
        <h2 className="mt-2 text-2xl font-bold md:text-3xl">
          Connect, stream & <span className="text-gradient">earn</span>
        </h2>
      </div>

      <div
        className="group relative mx-auto max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-card/40 shadow-2xl shadow-brand-purple/10"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
      >
        <div className="absolute inset-0 -z-10 bg-brand-gradient opacity-[0.07]" />

        <div className="relative aspect-[16/9] w-full sm:aspect-[21/9] md:aspect-[2.4/1]">
          {slides.map((slide, i) => {
            // Only mount nearby slides so we don't download ~all carousel images at once.
            if (Math.abs(i - active) > 1 && !(active === 0 && i === slides.length - 1)) {
              return null;
            }
            return (
              <div
                key={slide.src}
                className={cn(
                  'absolute inset-0 transition-all duration-700 ease-out',
                  i === active
                    ? 'z-10 scale-100 opacity-100'
                    : 'z-0 scale-[1.02] opacity-0 pointer-events-none',
                )}
                aria-hidden={i !== active}
              >
                <Image
                  src={slide.src}
                  alt={slide.alt}
                  fill
                  priority={i === 0 && active === 0}
                  sizes="(max-width: 768px) 100vw, 1024px"
                  className="object-cover object-center"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8 md:p-10">
                  <p className="text-xs font-semibold uppercase tracking-wider text-brand-pink sm:text-sm">
                    {String(i + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}
                  </p>
                  <h3 className="mt-2 text-xl font-bold text-white sm:text-2xl md:text-3xl">
                    {slide.title}
                  </h3>
                  <p className="mt-2 max-w-xl text-sm text-white/75 sm:text-base">
                    {slide.subtitle}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={prev}
          aria-label="Previous slide"
          className="absolute left-3 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white opacity-0 backdrop-blur-md transition-opacity hover:bg-black/60 group-hover:opacity-100 sm:left-5 sm:h-11 sm:w-11"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={next}
          aria-label="Next slide"
          className="absolute right-3 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white opacity-0 backdrop-blur-md transition-opacity hover:bg-black/60 group-hover:opacity-100 sm:right-5 sm:h-11 sm:w-11"
        >
          <ChevronRight className="h-5 w-5" />
        </button>

        <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 gap-2 sm:bottom-6">
          {slides.map((slide, i) => (
            <button
              key={slide.src}
              type="button"
              aria-label={`Go to slide ${i + 1}`}
              aria-current={i === active ? 'true' : undefined}
              onClick={() => goTo(i)}
              className={cn(
                'h-2 rounded-full transition-all duration-300',
                i === active
                  ? 'w-8 bg-brand-gradient'
                  : 'w-2 bg-white/40 hover:bg-white/70',
              )}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
