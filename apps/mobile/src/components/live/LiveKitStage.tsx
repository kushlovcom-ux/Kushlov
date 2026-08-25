import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View, type ViewStyle } from 'react-native';
import { Text } from '@/components/ui/Text';
import {
  FaceFilterOverlay,
  useLocalOrRemoteFaceFilter,
  useParticipantFaceBox,
} from '@/faceFilters/components/FaceFilterOverlay';
import { ensureLiveKitNative } from '@/services/livekit';
import { useThemeColors } from '@/hooks/useThemeColors';
import type { Room } from 'livekit-client';
import type { Participant } from 'livekit-client';

type Props = {
  token: string;
  serverUrl: string;
  /** When true, do not publish local camera (audio-only call). */
  audioOnly?: boolean;
  /** When true, publish local camera/mic. Viewers should leave this false. */
  publish?: boolean;
  isHost?: boolean;
  onDisconnected?: () => void;
  onRoom?: (room: Room | null) => void;
  style?: ViewStyle;
};

/**
 * LiveKit video/audio stage for live rooms and calls.
 * Soft-loads native modules so Expo Go does not crash on import.
 */
export function LiveKitStage({
  token,
  serverUrl,
  audioOnly = false,
  publish = false,
  isHost = false,
  onDisconnected,
  onRoom,
  style,
}: Props) {
  const c = useThemeColors();
  const [nativeOk, setNativeOk] = useState<boolean | null>(null);
  const [mods, setMods] = useState<{
    LiveKitRoom: React.ComponentType<Record<string, unknown>>;
    VideoGrid: React.ComponentType<{ isHost?: boolean; audioOnly?: boolean }>;
    RoomBinder: React.ComponentType<{ onRoom?: (room: Room | null) => void }>;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await ensureLiveKitNative();
      if (cancelled) return;
      setNativeOk(ok);
      if (!ok) return;
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const lk = require('@livekit/react-native');
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { Track } = require('livekit-client');
        setMods({
          LiveKitRoom: lk.LiveKitRoom,
          VideoGrid: makeVideoGrid(lk, Track),
          RoomBinder: makeRoomBinder(lk),
        });
      } catch {
        setNativeOk(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => onRoom?.(null);
  }, [onRoom]);

  const publishVideo = publish && !audioOnly;
  const publishAudio = publish;

  if (nativeOk === false) {
    return (
      <View style={[styles.fallback, style, { backgroundColor: c.elevated }]}>
        <Text muted style={{ textAlign: 'center', paddingHorizontal: 16 }}>
          Video requires a custom native build (EAS / dev client). Chat and controls still work.
        </Text>
      </View>
    );
  }

  if (!mods || nativeOk === null) {
    return (
      <View style={[styles.fallback, style, { backgroundColor: c.elevated }]}>
        <ActivityIndicator color={c.primary} />
        <Text muted style={{ marginTop: 8 }}>
          Connecting…
        </Text>
      </View>
    );
  }

  const { LiveKitRoom, VideoGrid, RoomBinder } = mods;

  return (
    <View style={[{ flex: 1, overflow: 'hidden', borderRadius: 16 }, style]}>
      <LiveKitRoom
        key={token}
        token={token}
        serverUrl={serverUrl}
        connect
        video={publishVideo}
        audio={publishAudio}
        onDisconnected={onDisconnected}
        options={{ adaptiveStream: true, dynacast: true }}
        style={{ flex: 1 }}
      >
        <RoomBinder onRoom={onRoom} />
        <VideoGrid isHost={isHost} audioOnly={audioOnly} />
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
    return null;
  };
}

function makeVideoGrid(
  lk: {
    useTracks: (sources: unknown[], opts?: unknown) => unknown[];
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
  return function VideoGrid({ isHost, audioOnly }: { isHost?: boolean; audioOnly?: boolean }) {
    const c = useThemeColors();
    const tracks = lk
      .useTracks([{ source: Track.Source.Camera, withPlaceholder: false }], {
        onlySubscribed: false,
      })
      .filter(lk.isTrackReference);

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

    const multi = tracks.length > 1;
    const dual = tracks.length === 2;

    return (
      <View
        style={[
          styles.grid,
          multi && (dual ? styles.gridDual : styles.gridMulti),
          { backgroundColor: '#000' },
        ]}
      >
        {tracks.map((trackRef, index) => {
          const ref = trackRef as {
            participant: Participant;
            publication?: { trackSid?: string };
            source?: string;
          };
          const key = `${ref.participant.identity}-${ref.publication?.trackSid ?? ref.source ?? index}`;
          const isLocal = Boolean(ref.participant.isLocal);
          return (
            <ParticipantVideoTile
              key={key}
              lk={lk}
              trackRef={trackRef}
              isLocal={isLocal}
              elevated={c.elevated}
              multi={multi}
              dual={dual}
            />
          );
        })}
      </View>
    );
  };
}

function ParticipantVideoTile({
  lk,
  trackRef,
  isLocal,
  elevated,
  multi,
  dual,
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
  dual?: boolean;
}) {
  const participant = (trackRef as { participant: Participant }).participant;
  const filterId = useLocalOrRemoteFaceFilter(participant);
  const remoteBox = useParticipantFaceBox(isLocal ? null : participant);
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
    <View style={[dual ? styles.tileDual : multi ? styles.tileMulti : styles.tile]}>
      <lk.VideoTrack
        trackRef={trackRef}
        style={StyleSheet.absoluteFill}
        objectFit="cover"
        mirror={isLocal}
        zOrder={isLocal ? 1 : 0}
      />
      <FaceFilterOverlay
        filterId={filterId}
        mirrored={isLocal}
        faceBox={isLocal ? undefined : remoteBox}
      />
      {multi ? (
        <View style={styles.labelRow}>
          {roleBadge ? (
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
  gridMulti: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    height: '100%',
  },
  /** Group live (2 hosts): stacked dual frame like Instagram/FB live. */
  gridDual: {
    flexDirection: 'column',
    flexWrap: 'nowrap',
    height: '100%',
    gap: 2,
  },
  tile: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  tileMulti: {
    width: '50%',
    height: '100%',
    minHeight: '100%',
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  tileDual: {
    flex: 1,
    width: '100%',
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  labelRow: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '90%',
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
