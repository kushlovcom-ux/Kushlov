'use client';

import '@livekit/components-styles';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  ControlBar,
  VideoTrack,
  useTracks,
  isTrackReference,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import { clientEnv } from '@/lib/env';
import { useLiveKitUrl } from '@/hooks/use-livekit-url';
import { VideoFilterBar } from '@/components/calls/video-filter-bar';

/** In-room video UI — avoids VideoConference placeholder track bugs. */
function LiveRoomVideo({
  isHost,
  showFilters,
}: {
  isHost?: boolean;
  showFilters?: boolean;
}) {
  const cameraTracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: false }],
    { onlySubscribed: false },
  ).filter(isTrackReference);

  return (
    <div className="flex h-full flex-col">
      <div className="relative min-h-[240px] flex-1 overflow-hidden rounded-2xl bg-black">
        {cameraTracks.length === 0 ? (
          <div className="flex h-full items-center justify-center p-6 text-center text-sm text-white/50">
            {isHost
              ? 'Starting camera… allow access when your browser prompts.'
              : 'Waiting for the host to start video…'}
          </div>
        ) : (
          <div
            className={
              cameraTracks.length > 1
                ? 'grid h-full w-full gap-2 p-2 sm:grid-cols-2'
                : 'h-full w-full p-2'
            }
          >
            {cameraTracks.map((trackRef) => (
              <div
                key={`${trackRef.participant.identity}-${trackRef.publication?.trackSid ?? trackRef.source}`}
                className="relative h-full min-h-[200px] overflow-hidden rounded-xl bg-zinc-900"
              >
                <VideoTrack trackRef={trackRef} className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        )}
      </div>
      {showFilters ? <VideoFilterBar className="border-t border-white/10 py-2" /> : null}
      {isHost && (
        <ControlBar
          variation="minimal"
          controls={{ chat: false, screenShare: false, settings: false, leave: false }}
          className="!border-t !border-white/10 !bg-transparent"
        />
      )}
      <RoomAudioRenderer />
    </div>
  );
}

/**
 * LiveKit room wrapper for 1:1 / multi-party calls and live streams.
 */
export function LiveKitStage({
  token,
  serverUrl,
  onDisconnected,
  audioOnly = false,
  isHost = false,
  /** Publish local A/V. Defaults to true for calls; live viewers should pass false. */
  publish,
  showFilters = false,
}: {
  token: string;
  serverUrl?: string;
  onDisconnected?: () => void;
  audioOnly?: boolean;
  isHost?: boolean;
  publish?: boolean;
  showFilters?: boolean;
}) {
  const { url: settingsUrl, isLoading } = useLiveKitUrl();
  const url = serverUrl || clientEnv.livekitUrl || settingsUrl;
  const shouldPublish = publish ?? true;

  if (isLoading && !url) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl border border-white/10 bg-card p-8 text-center text-white/50">
        Connecting to LiveKit…
      </div>
    );
  }

  if (!url) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl border border-white/10 bg-card p-8 text-center text-white/50">
        LiveKit is not configured on the server. Add LIVEKIT_URL, LIVEKIT_API_KEY, and
        LIVEKIT_API_SECRET to your .env file, then restart the API.
      </div>
    );
  }

  return (
    <LiveKitRoom
      key={token}
      token={token}
      serverUrl={url}
      connect
      video={shouldPublish && !audioOnly}
      audio={shouldPublish}
      onDisconnected={onDisconnected}
      data-lk-theme="default"
      style={{ height: '100%', borderRadius: '1rem', overflow: 'hidden' }}
      options={{ adaptiveStream: true, dynacast: true }}
    >
      <LiveRoomVideo isHost={isHost} showFilters={showFilters && !audioOnly && shouldPublish} />
    </LiveKitRoom>
  );
}
