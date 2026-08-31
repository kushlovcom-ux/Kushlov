import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
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

  // Ensure the native audio session is running before (re)connecting a call room.
  useEffect(() => {
    if (!mods) return;
    preloadLiveKitNative();
  }, [mods, token, serverUrl]);

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

/** Stable per-participant key so tiles survive a peer joining or leaving. */
function trackKey(trackRef: unknown, index: number) {
  const ref = trackRef as {
    participant?: Participant;
    publication?: { trackSid?: string };
    source?: string;
  };
  return `${ref.participant?.identity ?? 'p'}-${ref.publication?.trackSid ?? ref.source ?? index}`;
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

function AudioRoster({
  lk,
}: {
  lk: {
    useRoomContext: () => Room;
  };
}) {
  const room = lk.useRoomContext();
  const [, bump] = useState(0);
  useEffect(() => {
    const onChange = () => bump((n) => n + 1);
    room.on('participantConnected', onChange);
    room.on('participantDisconnected', onChange);
    room.on('participantMetadataChanged', onChange);
    room.on('connectionStateChanged', onChange);
    return () => {
      room.off('participantConnected', onChange);
      room.off('participantDisconnected', onChange);
      room.off('participantMetadataChanged', onChange);
      room.off('connectionStateChanged', onChange);
    };
  }, [room]);

  const remotes = [...room.remoteParticipants.values()].filter(
    (p) => !isPreviewIdentity(p.identity),
  );
  const state = String(room.state ?? '');
  const waiting =
    state === 'connecting' || state === 'reconnecting'
      ? 'Connecting…'
      : 'Waiting for peer…';

  return (
    <View style={[styles.fallback, { backgroundColor: '#050506', gap: 12 }]}>
      <Text variant="caption" muted>
        Audio call
      </Text>
      {remotes.length === 0 ? (
        <Text muted>{waiting}</Text>
      ) : (
        remotes.map((p) => (
          <Text key={p.identity} variant="h3" color="#fff">
            {p.name || p.identity}
          </Text>
        ))
      )}
    </View>
  );
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
      return <AudioRoster lk={lk} />;
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
    const localRef = local[0] ?? null;
    const multi = !speaker && tracks.length > 1;
    // Conference: every remote gets a tile. Rendering only remote[0] is why a
    // third person was audible but never visible.
    const conference = remote.length > 1;

    return (
      <View style={[styles.grid, { backgroundColor: '#000' }]}>
        {speaker ? (
          <>
            {remote.length > 0 ? (
              <View key="main" style={[styles.gridInner, conference && styles.gridStack]}>
                {remote.map((ref, index) => (
                  <ParticipantVideoTile
                    key={trackKey(ref, index)}
                    lk={lk}
                    trackRef={ref}
                    isLocal={false}
                    elevated={c.elevated}
                    multi={conference}
                    videoFit={conference ? 'cover' : videoFit}
                    zOrder={0}
                    zoomable={!conference}
                  />
                ))}
              </View>
            ) : (
              <View key="main" style={[styles.fallback, { backgroundColor: '#050506' }]}>
                <Text muted>Connecting…</Text>
              </View>
            )}
            {/* Same tree slot in both states: moving this tile between a
                full-screen and a PiP parent tore down the Android surface,
                which is what made the peer flash over the local preview. */}
            {localRef ? (
              <View
                key="self"
                style={remote.length > 0 ? styles.pip : StyleSheet.absoluteFill}
              >
                <ParticipantVideoTile
                  lk={lk}
                  trackRef={localRef}
                  isLocal
                  elevated={c.elevated}
                  multi={false}
                  videoFit="cover"
                  zOrder={remote.length > 0 ? 1 : 0}
                  pip={remote.length > 0}
                />
              </View>
            ) : null}
          </>
        ) : (
          <View style={[styles.gridInner, multi && styles.gridStack]}>
            {tracks.map((trackRef, index) => {
              const ref = trackRef as { participant: Participant };
              return (
                <ParticipantVideoTile
                  key={trackKey(trackRef, index)}
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

const MAX_ZOOM = 4;

const ABSOLUTE_FILL: ViewStyle = {
  position: 'absolute',
  left: 0,
  right: 0,
  top: 0,
  bottom: 0,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Zoom is applied by resizing/offsetting the video's wrapper rather than with a
 * transform: on Android the renderer is a SurfaceView, which composites in its
 * own layer and ignores parent transforms.
 */
function useVideoZoom(enabled: boolean) {
  const sizeRef = useRef({ w: 0, h: 0 });
  const zoomRef = useRef({ scale: 1, x: 0, y: 0 });
  const startRef = useRef({ scale: 1, x: 0, y: 0 });
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState({ scale: 1, x: 0, y: 0 });
  const [fitOverride, setFitOverride] = useState<VideoFit | null>(null);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width < 8 || height < 8) return;
    sizeRef.current = { w: width, h: height };
    setSize((prev) => (prev.w === width && prev.h === height ? prev : { w: width, h: height }));
  }, []);

  const apply = useCallback((next: { scale: number; x: number; y: number }) => {
    const scale = clamp(next.scale, 1, MAX_ZOOM);
    const maxX = ((scale - 1) * sizeRef.current.w) / 2;
    const maxY = ((scale - 1) * sizeRef.current.h) / 2;
    const value = {
      scale,
      x: clamp(next.x, -maxX, maxX),
      y: clamp(next.y, -maxY, maxY),
    };
    zoomRef.current = value;
    setZoom(value);
  }, []);

  const gesture = useMemo(() => {
    if (!enabled) return null;
    const pinch = Gesture.Pinch()
      .runOnJS(true)
      .onStart(() => {
        startRef.current = zoomRef.current;
      })
      .onUpdate((e) => {
        apply({
          scale: startRef.current.scale * e.scale,
          x: startRef.current.x,
          y: startRef.current.y,
        });
      });

    const pan = Gesture.Pan()
      .runOnJS(true)
      .averageTouches(true)
      .onStart(() => {
        startRef.current = zoomRef.current;
      })
      .onUpdate((e) => {
        if (zoomRef.current.scale <= 1.01) return;
        apply({
          scale: zoomRef.current.scale,
          x: startRef.current.x + e.translationX,
          y: startRef.current.y + e.translationY,
        });
      });

    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      .runOnJS(true)
      .onEnd(() => {
        if (zoomRef.current.scale > 1.01) {
          apply({ scale: 1, x: 0, y: 0 });
          return;
        }
        setFitOverride((prev) => (prev === 'contain' ? 'cover' : 'contain'));
      });

    // Race, not Exclusive: Exclusive makes the pan wait for the double-tap to
    // fail, which adds a visible lag before the video starts following a drag.
    return Gesture.Race(doubleTap, Gesture.Simultaneous(pinch, pan));
  }, [enabled, apply]);

  const zoomStyle = useMemo<ViewStyle>(() => {
    if (zoom.scale <= 1.001 || size.w < 8 || size.h < 8) return ABSOLUTE_FILL;
    return {
      position: 'absolute',
      left: -((size.w * (zoom.scale - 1)) / 2) + zoom.x,
      top: -((size.h * (zoom.scale - 1)) / 2) + zoom.y,
      width: size.w * zoom.scale,
      height: size.h * zoom.scale,
    };
  }, [zoom, size]);

  return { gesture, zoomStyle, onLayout, fitOverride };
}

function ParticipantVideoTile({
  lk,
  trackRef,
  isLocal,
  elevated,
  multi,
  videoFit,
  pip,
  zOrder = 0,
  zoomable = false,
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
  /** 0 = normal surface, 1 = media overlay. PiP must sit above the main tile. */
  zOrder?: number;
  zoomable?: boolean;
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
  const { gesture, zoomStyle, onLayout, fitOverride } = useVideoZoom(zoomable);
  const fit = fitOverride ?? videoFit;

  const tile = (
    <View
      style={[styles.tile, multi && styles.tileStack, pip && styles.tilePip]}
      onLayout={zoomable ? onLayout : undefined}
    >
      {/* Video and overlay share the zoom wrapper so filters stay on the face. */}
      <View style={zoomStyle}>
        <lk.VideoTrack
          trackRef={trackRef}
          style={StyleSheet.absoluteFill}
          objectFit={fit}
          mirror={isLocal}
          zOrder={zOrder}
        />
        <View pointerEvents="none" collapsable={false} style={styles.filterLayer}>
          <FaceFilterOverlay
            filterId={filterId}
            mirrored={isLocal}
            faceBox={isLocal ? localBox : remoteBox}
          />
        </View>
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

  if (!gesture) return tile;
  return <GestureDetector gesture={gesture}>{tile}</GestureDetector>;
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
    overflow: 'hidden',
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
    // Clears the call control row; at bottom: 16 it sat on top of the
    // end-call button in the bottom-right corner.
    bottom: 168,
    width: 108,
    height: 152,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    // Above the main tile's filter layer (24) so a full-screen filter
    // background does not tint or cover the self view.
    zIndex: 30,
    elevation: 30,
  },
  filterLayer: {
    ...ABSOLUTE_FILL,
    zIndex: 8,
    // No renderToHardwareTextureAndroid here: an offscreen hardware layer over
    // the video SurfaceView renders as an opaque black rectangle on Android.
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
