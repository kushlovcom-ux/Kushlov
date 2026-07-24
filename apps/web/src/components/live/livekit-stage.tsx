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
import { Track, type Participant } from 'livekit-client';
import { clientEnv } from '@/lib/env';
import { useLiveKitUrl } from '@/hooks/use-livekit-url';
import { FaceFilterProvider } from '@/faceFilters/hooks/useFaceFilter';
import { FilterSelector } from '@/faceFilters/components/FilterSelector';
import { FaceFilterPublisher } from '@/faceFilters/components/FaceFilterPublisher';
import { PublisherAvControls } from '@/components/live/publisher-av-controls';

function ParticipantTile({
  trackRef,
}: {
  trackRef: {
    participant: Participant;
    publication?: { trackSid?: string };
    source?: Track.Source;
  };
}) {
  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden bg-black">
      {/* Absolute fill + object-cover so portrait phone streams crop to cover laptop width */}
      <VideoTrack
        trackRef={trackRef as never}
        className="lk-video-cover absolute inset-0 !h-full !w-full !max-h-none !max-w-none object-cover"
        style={{ objectFit: 'cover', width: '100%', height: '100%' }}
      />
    </div>
  );
}

/** In-room video UI — avoids VideoConference placeholder track bugs. */
function LiveRoomVideo({
  isHost,
  showFilters,
  showAvControls,
  audioOnly,
}: {
  isHost?: boolean;
  showFilters?: boolean;
  showAvControls?: boolean;
  audioOnly?: boolean;
}) {
  const cameraTracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: false }],
    { onlySubscribed: false },
  ).filter(isTrackReference);

  return (
    <FaceFilterProvider>
      <div className="relative flex h-full w-full flex-col overflow-hidden">
        <div className="relative min-h-0 flex-1 overflow-hidden bg-black">
          {cameraTracks.length === 0 ? (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-white/50">
              {isHost
                ? 'Starting camera… allow access when your browser prompts.'
                : 'Waiting for the host to start video…'}
            </div>
          ) : (
            <div
              className={
                cameraTracks.length === 2
                  ? 'absolute inset-0 grid h-full w-full grid-cols-2 gap-0'
                  : cameraTracks.length > 2
                    ? 'absolute inset-0 grid h-full w-full gap-1 p-1 sm:grid-cols-2'
                    : 'absolute inset-0 h-full w-full'
              }
            >
              {cameraTracks.map((trackRef) => (
                <ParticipantTile
                  key={`${trackRef.participant.identity}-${trackRef.publication?.trackSid ?? trackRef.source}`}
                  trackRef={trackRef}
                />
              ))}
            </div>
          )}
          {/* Top-right — clear of bottom chat composer */}
          {showAvControls ? (
            <div className="absolute right-3 top-16 z-30 sm:top-3">
              <PublisherAvControls audioOnly={audioOnly} />
            </div>
          ) : null}
          {showFilters ? (
            <div className="absolute bottom-24 left-3 z-20 max-w-[min(100%,20rem)] sm:bottom-4">
              <FilterSelector />
            </div>
          ) : null}
        </div>
        {showFilters ? <FaceFilterPublisher /> : null}
        {showAvControls ? (
          <ControlBar
            variation="minimal"
            controls={{
              microphone: true,
              camera: !audioOnly,
              chat: false,
              screenShare: false,
              settings: false,
              leave: false,
            }}
            className="!hidden"
          />
        ) : null}
        <RoomAudioRenderer />
      </div>
    </FaceFilterProvider>
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
  /** Mic/camera toggles for local publisher. Defaults to publish. */
  showAvControls,
}: {
  token: string;
  serverUrl?: string;
  onDisconnected?: () => void;
  audioOnly?: boolean;
  isHost?: boolean;
  publish?: boolean;
  showFilters?: boolean;
  showAvControls?: boolean;
}) {
  const { url: settingsUrl, isLoading } = useLiveKitUrl();
  const url = serverUrl || clientEnv.livekitUrl || settingsUrl;
  const shouldPublish = publish ?? true;
  const avControls = showAvControls ?? shouldPublish;

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
      style={{ height: '100%', width: '100%', overflow: 'hidden' }}
      options={{ adaptiveStream: true, dynacast: true }}
      className="h-full w-full overflow-hidden [&_video]:!h-full [&_video]:!w-full [&_video]:!object-cover"
    >
      <LiveRoomVideo
        isHost={isHost}
        showFilters={showFilters && !audioOnly && shouldPublish}
        showAvControls={avControls && shouldPublish}
        audioOnly={audioOnly}
      />
    </LiveKitRoom>
  );
}
