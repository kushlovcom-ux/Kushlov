import React, { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import {
  FaceFilterOverlay,
  useLocalOrRemoteFaceFilter,
  useParticipantFaceBox,
} from '@/faceFilters/components/FaceFilterOverlay';
import { FaceFilterRoomSync } from '@/faceFilters/components/FaceFilterRoomSync';
import { useFaceFilterStore } from '@/faceFilters/hooks/useFaceFilter';
import { getLiveKitRn, preloadLiveKitNative } from '@/services/livekit';
import { useThemeColors } from '@/hooks/useThemeColors';
import type { Room } from 'livekit-client';
import type { Participant } from 'livekit-client';

export type StageLayout = 'grid' | 'speaker';
export type VideoFit = 'cover' | 'contain';

type Props = {
  token: string;
  serverUrl: string;
  audioOnly?: boolean;
  publish?: boolean;
  isHost?: boolean;
  /** grid = equal tiles (live); speaker = remote main + local PiP (calls). */
  layout?: StageLayout;
  /** contain avoids cropping the person on 1:1 calls. */
  videoFit?: VideoFit;
  /** Mic/camera toggles for the local publisher (live host). */
  showAvControls?: boolean;
  onDisconnected?: () => void;
  onRoom?: (room: Room | null) => void;
  style?: ViewStyle;
};

type StageMods = {
  LiveKitRoom: React.ComponentType<Record<string, unknown>>;
  VideoGrid: React.ComponentType<{
    isHost?: boolean;
    audioOnly?: boolean;
    layout: StageLayout;
    videoFit: VideoFit;
    showAvControls?: boolean;
  }>;
  RoomBinder: React.ComponentType<{ onRoom?: (room: Room | null) => void }>;
};

let cachedStageMods: StageMods | null | undefined;

function getStageMods(): StageMods | null {
  if (cachedStageMods !== undefined) return cachedStageMods;
  const lk = getLiveKitRn();
  if (!lk) {
    cachedStageMods = null;
    return null;
  }
  cachedStageMods = {
    LiveKitRoom: lk.LiveKitRoom,
    VideoGrid: makeVideoGrid(lk, lk.Track),
    RoomBinder: makeRoomBinder(lk),
  };
  return cachedStageMods;
}

/**
 * LiveKit video/audio stage for live rooms and calls.
 * Native modules are preloaded at boot so this mounts immediately.
 */
export function LiveKitStage({
  token,
  serverUrl,
  audioOnly = false,
  publish = false,
  isHost = false,
  layout = 'grid',
  videoFit = 'cover',
  showAvControls = false,
  onDisconnected,
  onRoom,
  style,
}: Props) {
  const c = useThemeColors();
  const [mods, setMods] = useState<StageMods | null>(() => getStageMods());

  useEffect(() => {
    if (mods) return;
    const next = getStageMods();
    if (next) {
      setMods(next);
      return;
    }
    const ok = preloadLiveKitNative();
    setMods(ok ? getStageMods() : null);
  }, [mods]);

  useEffect(() => {
    return () => onRoom?.(null);
  }, [onRoom]);

  const publishVideo = publish && !audioOnly;
  const publishAudio = publish;

  if (!mods) {
    return (
      <View style={[styles.fallback, style, { backgroundColor: c.elevated }]}>
        <Text muted style={{ textAlign: 'center', paddingHorizontal: 16 }}>
          Video requires a custom native build (EAS / dev client). Chat and controls still work.
        </Text>
      </View>
    );
  }

  const { LiveKitRoom, VideoGrid, RoomBinder } = mods;

  return (
    <View style={[{ flex: 1, overflow: layout === 'speaker' ? 'visible' : 'hidden' }, style]}>
      <LiveKitRoom
        key={token}
        token={token}
        serverUrl={serverUrl}
        connect
        video={publishVideo}
        audio={publishAudio}
        onDisconnected={onDisconnected}
        options={{ adaptiveStream: layout !== 'speaker', dynacast: true }}
        style={{ flex: 1 }}
      >
        <RoomBinder onRoom={onRoom} />
        <VideoGrid
          isHost={isHost}
          audioOnly={audioOnly}
          layout={layout}
          videoFit={videoFit}
          showAvControls={showAvControls && publish}
        />
      </LiveKitRoom>
    </View>
  );
}

function makeRoomBinder(lk: {
  useRoomContext: () => Room;
}) {
  return function RoomBinder({ onRoom }: { onRoom?: (room: Room | null) => void }) {
    const room = lk.useRoomContext();
    useEffect(() => {
      onRoom?.(room);
      return () => onRoom?.(null);
    }, [room, onRoom]);
    return <FaceFilterRoomSync room={room} />;
  };
}

function isPreviewIdentity(identity?: string) {
  return Boolean(identity && identity.startsWith('preview_'));
}

function dedupeCameraTracks(tracks: unknown[]) {
  const byIdentity = new Map<string, unknown>();
  for (const trackRef of tracks) {
    const participant = (trackRef as { participant?: Participant }).participant;
    const identity = participant?.identity;
    if (!identity || isPreviewIdentity(identity)) continue;
    const existing = byIdentity.get(identity) as
      | { publication?: { isSubscribed?: boolean; isMuted?: boolean; track?: unknown } }
      | undefined;
    const next = trackRef as {
      publication?: { isSubscribed?: boolean; isMuted?: boolean; track?: unknown };
    };
    if (!existing) {
      byIdentity.set(identity, trackRef);
      continue;
    }
    const existingScore =
      (existing.publication?.track ? 4 : 0) +
      (existing.publication?.isSubscribed ? 2 : 0) +
      (existing.publication?.isMuted ? 0 : 1);
    const nextScore =
      (next.publication?.track ? 4 : 0) +
      (next.publication?.isSubscribed ? 2 : 0) +
      (next.publication?.isMuted ? 0 : 1);
    if (nextScore >= existingScore) byIdentity.set(identity, trackRef);
  }
  return [...byIdentity.values()];
}

function makeVideoGrid(
  lk: {
    useTracks: (sources: unknown[], opts?: unknown) => unknown[];
    useRoomContext: () => Room;
    isTrackReference: (t: unknown) => boolean;
    VideoTrack: React.ComponentType<{
      trackRef: unknown;
      style?: ViewStyle;
      objectFit?: 'cover' | 'contain';
      mirror?: boolean;
      zOrder?: number;
    }>;
  },
  Track: { Source: { Camera: unknown } },
) {
  return function VideoGrid({
    isHost,
    audioOnly,
    layout,
    videoFit,
    showAvControls,
  }: {
    isHost?: boolean;
    audioOnly?: boolean;
    layout: StageLayout;
    videoFit: VideoFit;
    showAvControls?: boolean;
  }) {
    const c = useThemeColors();
    const tracks = dedupeCameraTracks(
      lk
        .useTracks([{ source: Track.Source.Camera, withPlaceholder: false }], {
          onlySubscribed: false,
        })
        .filter(lk.isTrackReference),
    );

    if (audioOnly) {
      return (
        <View style={[styles.fallback, { backgroundColor: '#050506' }]}>
          <Text muted>Audio connected</Text>
        </View>
      );
    }

    if (tracks.length === 0) {
      return (
        <View style={[styles.fallback, { backgroundColor: '#050506' }]}>
          <Text muted style={{ textAlign: 'center', paddingHorizontal: 16 }}>
            {isHost ? 'Starting camera…' : 'Waiting for the host to start video…'}
          </Text>
        </View>
      );
    }

    const local = tracks.filter((t) => (t as { participant: Participant }).participant.isLocal);
    const remote = tracks.filter((t) => !(t as { participant: Participant }).participant.isLocal);
    const speaker = layout === 'speaker';
    const main = speaker ? (remote[0] ?? local[0]) : null;
    const pip = speaker && remote[0] && local[0] ? local[0] : null;
    const multi = !speaker && tracks.length > 1;

    return (
      <View style={[styles.grid, { backgroundColor: '#000' }]}>
        {speaker && main ? (
          <>
            <ParticipantVideoTile
              lk={lk}
              trackRef={main}
              isLocal={(main as { participant: Participant }).participant.isLocal}
              elevated={c.elevated}
              multi={false}
              videoFit={videoFit}
            />
            {pip ? (
              <View style={styles.pip}>
                <ParticipantVideoTile
                  lk={lk}
                  trackRef={pip}
                  isLocal
                  elevated={c.elevated}
                  multi={false}
                  videoFit="cover"
                  pip
                />
              </View>
            ) : null}
          </>
        ) : (
          <View style={[styles.gridInner, multi && styles.gridStack]}>
            {tracks.map((trackRef, index) => {
              const ref = trackRef as {
                participant: Participant;
                publication?: { trackSid?: string };
                source?: string;
              };
              const key = `${ref.participant.identity}-${ref.publication?.trackSid ?? ref.source ?? index}`;
              return (
                <ParticipantVideoTile
                  key={key}
                  lk={lk}
                  trackRef={trackRef}
                  isLocal={Boolean(ref.participant.isLocal)}
                  elevated={c.elevated}
                  multi={multi}
                  videoFit={videoFit}
                />
              );
            })}
          </View>
        )}
        {showAvControls ? <LivePublisherControls roomApi={lk} audioOnly={audioOnly} /> : null}
      </View>
    );
  };
}

function LivePublisherControls({
  roomApi,
  audioOnly,
}: {
  roomApi: { useRoomContext: () => Room };
  audioOnly?: boolean;
}) {
  const room = roomApi.useRoomContext();
  const [mic, setMic] = useState(true);
  const [cam, setCam] = useState(true);

  useEffect(() => {
    const p = room?.localParticipant;
    if (!p) return;
    setMic(p.isMicrophoneEnabled);
    setCam(p.isCameraEnabled);
  }, [room]);

  if (!room) return null;

  return (
    <View style={styles.avRow}>
      <Pressable
        accessibilityLabel={mic ? 'Mute' : 'Unmute'}
        onPress={() => {
          const next = !mic;
          setMic(next);
          void room.localParticipant.setMicrophoneEnabled(next);
        }}
        style={[styles.avBtn, !mic && styles.avBtnOff]}
      >
        <Ionicons name={mic ? 'mic' : 'mic-off'} size={20} color="#fff" />
      </Pressable>
      {!audioOnly ? (
        <Pressable
          accessibilityLabel={cam ? 'Turn camera off' : 'Turn camera on'}
          onPress={() => {
            const next = !cam;
            setCam(next);
            void room.localParticipant.setCameraEnabled(next);
          }}
          style={[styles.avBtn, !cam && styles.avBtnOff]}
        >
          <Ionicons name={cam ? 'videocam' : 'videocam-off'} size={20} color="#fff" />
        </Pressable>
      ) : null}
    </View>
  );
}

function ParticipantVideoTile({
  lk,
  trackRef,
  isLocal,
  elevated,
  multi,
  videoFit,
  pip,
}: {
  lk: {
    VideoTrack: React.ComponentType<{
      trackRef: unknown;
      style?: ViewStyle;
      objectFit?: 'cover' | 'contain';
      mirror?: boolean;
      zOrder?: number;
    }>;
  };
  trackRef: unknown;
  isLocal: boolean;
  elevated: string;
  multi: boolean;
  videoFit: VideoFit;
  pip?: boolean;
}) {
  const participant = (trackRef as { participant: Participant }).participant;
  const filterId = useLocalOrRemoteFaceFilter(participant);
  const remoteBox = useParticipantFaceBox(isLocal ? null : participant);
  const localBox = useFaceFilterStore((s) => (isLocal ? s.localFaceBox : null));
  let role: string | undefined;
  try {
    role = participant.metadata
      ? (JSON.parse(participant.metadata) as { role?: string }).role
      : undefined;
  } catch {
    role = undefined;
  }
  const roleBadge = role === 'cohost' ? 'Co-host' : role === 'host' ? 'Host' : null;
  const name = isLocal ? 'You' : participant.name || roleBadge || 'Guest';

  return (
    <View style={[styles.tile, multi && styles.tileStack, pip && styles.tilePip]}>
      <lk.VideoTrack
        trackRef={trackRef}
        style={StyleSheet.absoluteFill}
        objectFit={videoFit}
        mirror={isLocal}
        zOrder={-1}
      />
      <View
        pointerEvents="none"
        collapsable={false}
        renderToHardwareTextureAndroid
        style={styles.filterLayer}
      >
        <FaceFilterOverlay
          filterId={filterId}
          mirrored={isLocal}
          faceBox={isLocal ? localBox : remoteBox}
        />
      </View>
      {multi || pip ? (
        <View style={styles.labelRow}>
          {roleBadge && !pip ? (
            <Text style={styles.roleBadge} numberOfLines={1}>
              {roleBadge}
            </Text>
          ) : null}
          <Text style={[styles.nameBadge, { backgroundColor: elevated + 'CC' }]} numberOfLines={1}>
            {name}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    flex: 1,
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  grid: {
    flex: 1,
    minHeight: 220,
  },
  gridInner: {
    flex: 1,
  },
  /** Co-live: stacked full-width tiles, never a squeezed side-by-side pair. */
  gridStack: {
    flexDirection: 'column',
  },
  tile: {
    flex: 1,
    overflow: Platform.OS === 'android' ? 'visible' : 'hidden',
    backgroundColor: '#000',
  },
  tileStack: {
    width: '100%',
    minHeight: 0,
  },
  tilePip: {
    borderRadius: 14,
  },
  pip: {
    position: 'absolute',
    right: 12,
    bottom: 16,
    width: 108,
    height: 152,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    zIndex: 20,
    elevation: 20,
  },
  filterLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 8,
    elevation: 24,
  },
  avRow: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 16,
    zIndex: 40,
    elevation: 40,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  avBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.62)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.28)',
    elevation: 40,
  },
  avBtnOff: {
    backgroundColor: 'rgba(239,68,68,0.85)',
  },
  labelRow: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '90%',
    zIndex: 9,
  },
  roleBadge: {
    overflow: 'hidden',
    borderRadius: 999,
    backgroundColor: 'rgba(236, 72, 153, 0.92)',
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  nameBadge: {
    overflow: 'hidden',
    borderRadius: 999,
    color: '#fff',
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 2,
    maxWidth: 140,
  },
});
