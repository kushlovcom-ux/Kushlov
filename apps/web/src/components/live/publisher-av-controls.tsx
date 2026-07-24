'use client';

import { useLocalParticipant } from '@livekit/components-react';
import { Mic, MicOff, Video, VideoOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Explicit mic / camera toggles for publishers (visible on mobile web). */
export function PublisherAvControls({
  className,
  audioOnly = false,
}: {
  className?: string;
  audioOnly?: boolean;
}) {
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();

  if (!localParticipant) return null;

  return (
    <div className={cn('pointer-events-auto flex items-center gap-2', className)}>
      <Button
        type="button"
        size="icon"
        variant="secondary"
        className="h-11 w-11 rounded-full border border-white/15 bg-black/60 backdrop-blur"
        aria-label={isMicrophoneEnabled ? 'Mute microphone' : 'Unmute microphone'}
        onClick={() => void localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
      >
        {isMicrophoneEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
      </Button>
      {!audioOnly ? (
        <Button
          type="button"
          size="icon"
          variant="secondary"
          className="h-11 w-11 rounded-full border border-white/15 bg-black/60 backdrop-blur"
          aria-label={isCameraEnabled ? 'Turn camera off' : 'Turn camera on'}
          onClick={() => void localParticipant.setCameraEnabled(!isCameraEnabled)}
        >
          {isCameraEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
        </Button>
      ) : null}
    </div>
  );
}
