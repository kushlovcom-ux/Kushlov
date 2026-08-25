import React, { useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import type { Participant } from 'livekit-client';
import { getFilterDef } from '../catalog';
import { heuristicFaceBox, layoutFilter } from '../layout';
import { FACE_FILTER_ATTR, type FaceFilterDef } from '../types';
import { useFaceFilterStore, selectEffectiveFilterId } from '../hooks/useFaceFilter';

type OverlayProps = {
  filterId: string | null | undefined;
  mirrored?: boolean;
};

const BG_GRADIENT: Record<
  NonNullable<FaceFilterDef['background']>,
  readonly [string, string, ...string[]]
> = {
  blur: ['rgba(16,16,24,0.25)', 'rgba(8,8,16,0.55)'],
  dim: ['rgba(0,0,0,0.28)', 'rgba(0,0,0,0.62)'],
  sunset: ['rgba(255,126,95,0.42)', 'rgba(80,20,60,0.5)'],
  night: ['rgba(10,22,56,0.48)', 'rgba(2,6,18,0.72)'],
  studio: ['rgba(255,255,255,0.16)', 'rgba(18,18,24,0.5)'],
  neon: ['rgba(236,72,153,0.38)', 'rgba(34,211,238,0.32)'],
};

/**
 * Snapchat-style sticker locked to a face region (eyes / forehead / mouth / full face).
 * Uses a selfie heuristic box when native ML tracking is unavailable.
 */
export function FaceFilterOverlay({ filterId, mirrored = false }: OverlayProps) {
  const filter = getFilterDef(filterId);
  const [size, setSize] = useState({ w: 360, h: 640 });

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width < 8 || height < 8) return;
    setSize((prev) => (prev.w === width && prev.h === height ? prev : { w: width, h: height }));
  };

  const layout = useMemo(() => {
    if (!filter || filter.beauty || filter.background || size.w < 8 || size.h < 8) return null;
    const box = heuristicFaceBox();
    if (mirrored && box.eyes) {
      box.eyes = { ...box.eyes, cx: 1 - box.eyes.cx };
    }
    return layoutFilter(box, filter, size.w, size.h);
  }, [filter, size.w, size.h, mirrored]);

  if (!filter) return null;

  const sticker = layout ? (
    <View
      style={{
        position: 'absolute',
        left: layout.x - layout.w / 2,
        top: layout.y - layout.h / 2,
        width: layout.w,
        height: layout.h,
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ rotate: `${layout.rotation}deg` }],
      }}
    >
      {filter.privacy ? (
        <View
          style={{
            ...StyleSheet.absoluteFillObject,
            borderRadius: Math.min(layout.w, layout.h) / 2,
            backgroundColor:
              filter.privacy === 'solid'
                ? '#111'
                : filter.privacy === 'blur'
                  ? 'rgba(255,255,255,0.28)'
                  : 'rgba(0,0,0,0.45)',
          }}
        />
      ) : null}
      {filter.emoji ? (
        <Text
          allowFontScaling={false}
          style={{
            fontSize: layout.fontSize,
            textAlign: 'center',
            includeFontPadding: false,
            textShadowColor: 'rgba(0,0,0,0.45)',
            textShadowOffset: { width: 0, height: 2 },
            textShadowRadius: 6,
          }}
        >
          {filter.emoji}
        </Text>
      ) : null}
    </View>
  ) : null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={onLayout}>
      {filter.background === 'blur' ? (
        <BlurView intensity={48} tint="dark" style={StyleSheet.absoluteFill} />
      ) : null}
      {filter.background ? (
        <LinearGradient
          colors={BG_GRADIENT[filter.background]}
          start={{ x: 0.15, y: 0 }}
          end={{ x: 0.85, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {filter.beauty ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255, 200, 220, 0.08)' }]} />
      ) : null}
      {sticker}
    </View>
  );
}

export function useParticipantFaceFilter(participant: Participant | null | undefined) {
  const [filterId, setFilterId] = React.useState(
    () => participant?.attributes?.[FACE_FILTER_ATTR] || '',
  );

  React.useEffect(() => {
    if (!participant) {
      setFilterId('');
      return;
    }
    const sync = () => setFilterId(participant.attributes?.[FACE_FILTER_ATTR] || '');
    sync();
    const handler = () => sync();
    participant.on('attributesChanged', handler);
    return () => {
      participant.off('attributesChanged', handler);
    };
  }, [participant]);

  return filterId;
}

/** Local tile: prefer store filter when publishing. */
export function useLocalOrRemoteFaceFilter(
  participant: Participant | null | undefined,
) {
  const attr = useParticipantFaceFilter(participant);
  const local = useFaceFilterStore(selectEffectiveFilterId);
  if (participant?.isLocal) {
    return local === 'none' ? '' : local;
  }
  return attr;
}
