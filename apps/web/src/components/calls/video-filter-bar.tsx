'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocalParticipant } from '@livekit/components-react';
import { LocalVideoTrack, Track } from 'livekit-client';
import { Sparkles, EyeOff, ImageIcon, Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type VideoFilterId = 'none' | 'hideFace' | 'glowFace' | 'bgBlur' | 'bgWarm' | 'bgCool';

const FILTERS: { id: VideoFilterId; label: string; icon: typeof Sparkles }[] = [
  { id: 'none', label: 'Off', icon: Ban },
  { id: 'hideFace', label: 'Hide', icon: EyeOff },
  { id: 'glowFace', label: 'Glow', icon: Sparkles },
  { id: 'bgBlur', label: 'Blur BG', icon: ImageIcon },
  { id: 'bgWarm', label: 'Warm BG', icon: ImageIcon },
  { id: 'bgCool', label: 'Cool BG', icon: ImageIcon },
];

function cssForFilter(id: VideoFilterId): string {
  switch (id) {
    case 'hideFace':
      // Approximate face hide: heavy blur + darken mid tones
      return 'blur(18px) brightness(0.85) contrast(1.1)';
    case 'glowFace':
      return 'brightness(1.15) contrast(1.08) saturate(1.25) drop-shadow(0 0 12px rgba(255,200,120,0.55))';
    case 'bgBlur':
      return 'blur(2px) brightness(1.05)';
    case 'bgWarm':
      return 'sepia(0.35) saturate(1.2) hue-rotate(-10deg)';
    case 'bgCool':
      return 'hue-rotate(20deg) saturate(1.1) brightness(1.05)';
    default:
      return 'none';
  }
}

/**
 * Applies client-side CSS / canvas-style filters to the local camera publication.
 * Uses CSS filters on the rendered video elements + optional track processor when available.
 */
export function VideoFilterBar({ className }: { className?: string }) {
  const { localParticipant } = useLocalParticipant();
  const [active, setActive] = useState<VideoFilterId>('none');

  const apply = useCallback(
    async (id: VideoFilterId) => {
      setActive(id);
      const pub = localParticipant.getTrackPublication(Track.Source.Camera);
      const track = pub?.track as LocalVideoTrack | undefined;

      // CSS filter on all local video elements in the stage
      document.querySelectorAll('.lk-participant-media-video, video').forEach((el) => {
        const video = el as HTMLVideoElement;
        const isLocal =
          video.classList.contains('lk-participant-media-video') ||
          video.getAttribute('data-lk-local') === 'true' ||
          (video as HTMLVideoElement & { __lkLocal?: boolean }).__lkLocal;
        // Apply to all videos when only one local; prefer marking via style on container
        void isLocal;
      });

      // Prefer attaching filter via MediaStreamTrack constraints processor when package exists
      try {
        if (track && id !== 'none' && (id === 'bgBlur' || id.startsWith('bg'))) {
          // Dynamic import — soft-fail if package missing
          const processors = await import('@livekit/track-processors').catch(() => null);
          if (processors?.BackgroundBlur) {
            const blur = processors.BackgroundBlur(id === 'bgBlur' ? 10 : 6);
            await track.setProcessor(blur);
            return;
          }
        }
        if (track && typeof track.stopProcessor === 'function') {
          await track.stopProcessor();
        }
      } catch {
        // fall through to CSS
      }

      // CSS fallback: style local video tiles inside LiveKit stage
      const root = document.querySelector('[data-lk-theme]') ?? document.body;
      root.querySelectorAll('video').forEach((video) => {
        const participant = video.closest('[data-lk-participant-media]');
        const local =
          participant?.getAttribute('data-lk-local-participant') === 'true' ||
          video.muted; // local preview often muted
        if (local || id !== 'none') {
          // Apply filter to first/local-looking videos; for multi-grid, filter all is OK for call host view of self
          if (video.className.includes('object-cover') || true) {
            (video as HTMLVideoElement).style.filter = cssForFilter(id);
          }
        }
      });
    },
    [localParticipant],
  );

  useEffect(() => {
    return () => {
      document.querySelectorAll('video').forEach((video) => {
        (video as HTMLVideoElement).style.filter = '';
      });
    };
  }, []);

  return (
    <div className={cn('flex flex-wrap items-center justify-center gap-1.5', className)}>
      {FILTERS.map(({ id, label, icon: Icon }) => (
        <Button
          key={id}
          type="button"
          size="sm"
          variant={active === id ? 'default' : 'secondary'}
          className="h-8 gap-1 px-2 text-xs"
          onClick={() => void apply(id)}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </Button>
      ))}
    </div>
  );
}
