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
import { cn } from '@/lib/utils';

type VideoFit = 'cover' | 'contain';
type StageLayout = 'grid' | 'speaker';

function ParticipantTile({
  trackRef,
  videoFit,
  className,
  mirror,
}: {
  trackRef: {
    participant: Participant;
    publication?: { trackSid?: string };
    source?: Track.Source;
  };
  videoFit: VideoFit;
  className?: string;
  mirror?: boolean;
}) {
  return (
    <div className={cn('relative h-full min-h-0 w-full overflow-hidden bg-black', className)}>
      <VideoTrack
        trackRef={trackRef as never}
        className={cn(
          'absolute inset-0 !h-full !w-full !max-h-none !max-w-none',
          videoFit === 'contain' ? 'object-contain' : 'object-cover',
          mirror && 'scale-x-[-1]',
        )}
        style={{
          objectFit: videoFit,
          width: '100%',
          height: '100%',
        }}
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
  videoFit,
  layout,
}: {
  isHost?: boolean;
  showFilters?: boolean;
  showAvControls?: boolean;
  audioOnly?: boolean;
  videoFit: VideoFit;
  layout: StageLayout;
}) {
  const cameraTracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: false }],
    { onlySubscribed: false },
  ).filter(isTrackReference);

  const localTracks = cameraTracks.filter((t) => t.participant.isLocal);
  const remoteTracks = cameraTracks.filter((t) => !t.participant.isLocal);

  const speakerMode = layout === 'speaker' && !audioOnly;

  return (
    <FaceFilterProvider>
      <div className="relative flex h-full w-full flex-col overflow-hidden">
        <div className="relative min-h-0 flex-1 overflow-hidden bg-zinc-950">
          {cameraTracks.length === 0 ? (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-white/50">
              {isHost
                ? 'Starting camera… allow access when your browser prompts.'
                : 'Waiting for the host to start video…'}
            </div>
          ) : speakerMode ? (
            <>
              {/* Remote (or only) as main stage */}
              <div className="absolute inset-0">
                {(remoteTracks[0] ?? localTracks[0] ?? cameraTracks[0]) && (
                  <ParticipantTile
                    trackRef={(remoteTracks[0] ?? localTracks[0] ?? cameraTracks[0]) as never}
                    videoFit={videoFit}
                    mirror={!remoteTracks[0]}
                  />
                )}
                {remoteTracks.length > 1 ? (
                  <div className="absolute inset-x-0 bottom-0 flex gap-1 overflow-x-auto p-2">
                    {remoteTracks.slice(1).map((trackRef) => (
                      <div
                        key={`${trackRef.participant.identity}-${trackRef.publication?.trackSid}`}
                        className="h-20 w-28 shrink-0 overflow-hidden rounded-lg border border-white/20"
                      >
                        <ParticipantTile trackRef={trackRef as never} videoFit={videoFit} />
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
              {/* Local PiP */}
              {remoteTracks.length > 0 && localTracks[0] ? (
                <div className="absolute bottom-3 right-3 z-20 h-28 w-20 overflow-hidden rounded-xl border border-white/25 shadow-lg sm:h-36 sm:w-28 md:h-40 md:w-32">
                  <ParticipantTile
                    trackRef={localTracks[0] as never}
                    videoFit="cover"
                    mirror
                  />
                  <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white/80">
                    You
                  </span>
                </div>
              ) : null}
            </>
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
                  videoFit={videoFit}
                  mirror={trackRef.participant.isLocal}
                />
              ))}
            </div>
          )}

          {showAvControls ? (
            <div
              className={cn(
                'absolute z-30',
                speakerMode ? 'right-3 top-3' : 'right-3 top-[4.5rem]',
              )}
            >
              <PublisherAvControls audioOnly={audioOnly} />
            </div>
          ) : null}
          {showFilters ? (
            <div
              className={cn(
                'absolute z-10 max-w-[min(100%,20rem)]',
                // Live room keeps a bottom chat/gift composer — sit filters above it on all breakpoints.
                // Calls (speaker) have no composer, so filters can sit lower.
                speakerMode ? 'bottom-3 left-3' : 'bottom-[7.25rem] left-3 sm:bottom-[7.5rem]',
              )}
            >
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
  /** cover = fill (live); contain = show full person (calls). */
  videoFit = 'cover',
  /** grid = equal tiles; speaker = remote main + local PiP. */
  layout = 'grid',
}: {
  token: string;
  serverUrl?: string;
  onDisconnected?: () => void;
  audioOnly?: boolean;
  isHost?: boolean;
  publish?: boolean;
  showFilters?: boolean;
  showAvControls?: boolean;
  videoFit?: VideoFit;
  layout?: StageLayout;
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

  const fitClass =
    videoFit === 'contain'
      ? '[&_video]:!object-contain'
      : '[&_video]:!object-cover';

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
      className={cn('h-full w-full overflow-hidden [&_video]:!h-full [&_video]:!w-full', fitClass)}
    >
      <LiveRoomVideo
        isHost={isHost}
        showFilters={showFilters && !audioOnly && shouldPublish}
        showAvControls={avControls && shouldPublish}
        audioOnly={audioOnly}
        videoFit={videoFit}
        layout={layout}
      />
    </LiveKitRoom>
  );
}
