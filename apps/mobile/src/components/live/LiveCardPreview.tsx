import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Text } from '@/components/ui/Text';
import { liveApi } from '@/api/live';
import { ensureLiveKitNative } from '@/services/livekit';
import { useThemeColors } from '@/hooks/useThemeColors';

type Props = {
  liveId: string;
  thumbnailUrl?: string;
  /** Only mount LiveKit when true (cap concurrent previews). */
  active: boolean;
  style?: object;
};

/**
 * Muted subscribe-only LiveKit preview for live list cards.
 */
export function LiveCardPreview({ liveId, thumbnailUrl, active, style }: Props) {
  const c = useThemeColors();
  const [nativeOk, setNativeOk] = useState<boolean | null>(null);
  const [failed, setFailed] = useState(false);
  const [mods, setMods] = useState<{
    LiveKitRoom: React.ComponentType<Record<string, unknown>>;
    PreviewVideo: React.ComponentType;
  } | null>(null);

  const preview = useQuery({
    queryKey: ['live-preview', liveId],
    queryFn: () => liveApi.previewToken(liveId),
    enabled: active && !failed && nativeOk === true,
    staleTime: 60_000,
    retry: 1,
  });

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    ensureLiveKitNative()
      .then((ok) => {
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
            PreviewVideo: makePreviewVideo(lk, Track),
          });
        } catch {
          setNativeOk(false);
        }
      })
      .catch(() => {
        if (!cancelled) setNativeOk(false);
      });
    return () => {
      cancelled = true;
    };
  }, [active]);

  useEffect(() => {
    if (preview.isError) setFailed(true);
  }, [preview.isError]);

  const token = preview.data?.token;
  const url = preview.data?.livekitUrl;

  if (!active || failed || nativeOk === false || !token || !url || !mods) {
    if (thumbnailUrl) {
      return <Image source={{ uri: thumbnailUrl }} style={[styles.fill, style]} />;
    }
    return (
      <View style={[styles.fill, styles.placeholder, { backgroundColor: c.elevated }, style]}>
        {active && nativeOk === null ? (
          <ActivityIndicator color={c.primary} />
        ) : (
          <Text muted variant="tiny">
            LIVE
          </Text>
        )}
      </View>
    );
  }

  const { LiveKitRoom, PreviewVideo } = mods;

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
          <ActivityIndicator color={c.primary} />
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
