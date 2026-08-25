import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
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

  const { LiveKitRoom, PreviewVideo } = mods!;

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
        <PreviewVideo />
      </LiveKitRoom>
    </View>
  );
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
