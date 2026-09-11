import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { RemoteAudioTrack, Room } from 'livekit-client';
import { RoomEvent } from 'livekit-client';
import { Text } from '@/components/ui/Text';
import { liveApi } from '@/api/live';
import { getLiveKitRn, preloadLiveKitNative } from '@/services/livekit';
import { useThemeColors } from '@/hooks/useThemeColors';

type Props = {
  liveId: string;
  thumbnailUrl?: string;
  /** Only mount LiveKit when true (cap concurrent previews). */
  active: boolean;
  style?: object;
};

type PreviewMods = {
  LiveKitRoom: React.ComponentType<Record<string, unknown>>;
  PreviewVideo: React.ComponentType;
  PreviewSilencer: React.ComponentType;
};

let cachedPreviewMods: PreviewMods | null | undefined;

function getPreviewMods(): PreviewMods | null {
  if (cachedPreviewMods !== undefined) return cachedPreviewMods;
  const lk = getLiveKitRn();
  if (!lk) {
    cachedPreviewMods = null;
    return null;
  }
  cachedPreviewMods = {
    LiveKitRoom: lk.LiveKitRoom,
    PreviewVideo: makePreviewVideo(lk, lk.Track),
    PreviewSilencer: makePreviewSilencer(lk),
  };
  return cachedPreviewMods;
}

/**
 * Muted subscribe-only LiveKit preview for live list cards.
 * Shows the thumbnail immediately; video attaches when the token is ready.
 */
export function LiveCardPreview({ liveId, thumbnailUrl, active, style }: Props) {
  const c = useThemeColors();
  const [failed, setFailed] = useState(false);
  const [mods, setMods] = useState<PreviewMods | null>(() => getPreviewMods());

  useEffect(() => {
    if (!active || mods) return;
    preloadLiveKitNative();
    setMods(getPreviewMods());
  }, [active, mods]);

  const preview = useQuery({
    queryKey: ['live-preview', liveId],
    queryFn: () => liveApi.previewToken(liveId),
    enabled: active && !failed && Boolean(mods),
    staleTime: 60_000,
    retry: 1,
  });

  useEffect(() => {
    if (preview.isError) setFailed(true);
  }, [preview.isError]);

  const token = preview.data?.token;
  const url = preview.data?.livekitUrl;
  const showVideo = active && !failed && Boolean(token && url && mods);

  if (!showVideo) {
    if (thumbnailUrl) {
      return <Image source={{ uri: thumbnailUrl }} style={[styles.fill, style]} />;
    }
    return (
      <View style={[styles.fill, styles.placeholder, { backgroundColor: c.elevated }, style]}>
        <Text muted variant="tiny">
          LIVE
        </Text>
      </View>
    );
  }

  const { LiveKitRoom, PreviewVideo, PreviewSilencer } = mods!;

  return (
    <View style={[styles.fill, style, { overflow: 'hidden' }]} pointerEvents="none">
      <LiveKitRoom
        key={token}
        token={token}
        serverUrl={url}
        connect
        video={false}
        audio={false}
        options={{ adaptiveStream: true, dynacast: true }}
        style={StyleSheet.absoluteFill}
        onError={() => setFailed(true)}
      >
        <PreviewSilencer />
        <PreviewVideo />
      </LiveKitRoom>
    </View>
  );
}

/**
 * Keeps list previews silent. `audio={false}` on LiveKitRoom only stops the
 * mic from being *published*; LiveKit still auto-subscribes to remote audio,
 * so up to MAX_PREVIEWS hosts stay audible on the list — most obviously right
 * after a viewer leaves a live room and lands back here.
 */
function makePreviewSilencer(lk: { useRoomContext: () => Room }) {
  return function PreviewSilencer() {
    const room = lk.useRoomContext();

    useEffect(() => {
      if (!room) return;

      const silence = () => {
        room.remoteParticipants.forEach((participant) => {
          participant.audioTrackPublications.forEach((pub) => {
            try {
              // Volume first so an already-playing track cuts out immediately,
              // then drop the subscription so we stop paying for the audio.
              (pub.track as RemoteAudioTrack | undefined)?.setVolume(0);
              if (pub.isSubscribed) pub.setSubscribed(false);
            } catch {
              /* a preview must never break the list */
            }
          });
        });
      };

      silence();
      room.on(RoomEvent.TrackSubscribed, silence);
      room.on(RoomEvent.TrackPublished, silence);
      room.on(RoomEvent.ParticipantConnected, silence);

      return () => {
        room.off(RoomEvent.TrackSubscribed, silence);
        room.off(RoomEvent.TrackPublished, silence);
        room.off(RoomEvent.ParticipantConnected, silence);
      };
    }, [room]);

    return null;
  };
}

function makePreviewVideo(
  lk: {
    useTracks: (sources: unknown[], opts?: unknown) => unknown[];
    isTrackReference: (t: unknown) => boolean;
    VideoTrack: React.ComponentType<{
      trackRef: unknown;
      style?: object;
      objectFit?: 'cover' | 'contain';
    }>;
  },
  Track: { Source: { Camera: unknown } },
) {
  return function PreviewVideo() {
    const c = useThemeColors();
    const tracks = lk
      .useTracks([{ source: Track.Source.Camera, withPlaceholder: false }], {
        onlySubscribed: true,
      })
      .filter(lk.isTrackReference);

    const remote =
      tracks.find((t) => {
        const ref = t as { participant?: { isLocal?: boolean } };
        return !ref.participant?.isLocal;
      }) ?? tracks[0];

    if (!remote) {
      return (
        <View style={[styles.fill, styles.placeholder, { backgroundColor: c.elevated }]}>
          <Text muted variant="tiny">
            LIVE
          </Text>
        </View>
      );
    }

    return (
      <lk.VideoTrack
        trackRef={remote}
        style={StyleSheet.absoluteFill}
        objectFit="cover"
      />
    );
  };
}

const styles = StyleSheet.create({
  fill: { width: '100%', height: '100%' },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
});
