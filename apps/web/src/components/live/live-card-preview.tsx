'use client';

import { useEffect, useState } from 'react';
import {
  LiveKitRoom,
  VideoTrack,
  useTracks,
  isTrackReference,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import { useQuery } from '@tanstack/react-query';
import { Radio } from 'lucide-react';
import { api, unwrap } from '@/lib/api';
import { clientEnv } from '@/lib/env';
import { useLiveKitUrl } from '@/hooks/use-livekit-url';

type PreviewPayload = { token: string; livekitUrl?: string; roomName?: string };

function PreviewVideo() {
  const cameraTracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: false }],
    { onlySubscribed: true },
  ).filter(isTrackReference);

  const remote = cameraTracks.find((t) => !t.participant.isLocal) ?? cameraTracks[0];

  if (!remote) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-purple/40 to-brand-pink/30">
        <Radio className="h-8 w-8 animate-pulse text-white/50" />
      </div>
    );
  }

  return <VideoTrack trackRef={remote} className="h-full w-full object-cover" muted />;
}

/**
 * Muted LiveKit subscribe-only preview for live list cards.
 * Only mounts when `active` to limit concurrent room connections.
 */
export function LiveCardPreview({
  liveId,
  thumbnailUrl,
  active,
}: {
  liveId: string;
  thumbnailUrl?: string;
  active: boolean;
}) {
  const { url: settingsUrl } = useLiveKitUrl();
  const [failed, setFailed] = useState(false);

  const preview = useQuery({
    queryKey: ['live-preview', liveId],
    queryFn: () => unwrap<PreviewPayload>(api.get(`/live/${liveId}/preview-token`)),
    enabled: active && !failed,
    staleTime: 60_000,
    retry: 1,
  });

  useEffect(() => {
    if (preview.isError) setFailed(true);
  }, [preview.isError]);

  const token = preview.data?.token;
  const url = preview.data?.livekitUrl || clientEnv.livekitUrl || settingsUrl;

  if (!active || failed || !token || !url) {
    if (thumbnailUrl) {
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={thumbnailUrl} alt="" className="h-full w-full object-cover" />;
    }
    return (
      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-purple/40 to-brand-pink/30">
        <Radio className="h-10 w-10 text-white/60" />
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-0 h-full w-full overflow-hidden">
      <LiveKitRoom
        key={token}
        token={token}
        serverUrl={url}
        connect
        video={false}
        audio={false}
        style={{ height: '100%', width: '100%' }}
        options={{ adaptiveStream: true, dynacast: true }}
        onError={() => setFailed(true)}
      >
        <PreviewVideo />
      </LiveKitRoom>
    </div>
  );
}
