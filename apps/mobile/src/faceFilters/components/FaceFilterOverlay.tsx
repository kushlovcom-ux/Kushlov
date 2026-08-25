import React, { useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import type { Participant } from 'livekit-client';
import { isFaceTrackNativeAvailable } from 'kushlov-face-track';
import { getFilterDef } from '../catalog';
import { heuristicFaceBox, layoutFilter, layoutFilterLayers, parseFaceBox } from '../layout';
import { FACE_FILTER_ATTR, FACE_FILTER_BOX_ATTR, type FaceBox, type FaceFilterDef } from '../types';
import { useFaceFilterStore, selectEffectiveFilterId } from '../hooks/useFaceFilter';
import { FilterLayerSvg } from './FilterLayerSvg';

type OverlayProps = {
  filterId: string | null | undefined;
  mirrored?: boolean;
  faceBox?: FaceBox | null;
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
 * Landmark-locked AR overlay. Uses a live FaceBox when tracking is available,
 * otherwise a selfie-proportion heuristic so glasses/ears still span the face.
 */
export function FaceFilterOverlay({ filterId, mirrored = false, faceBox }: OverlayProps) {
  const filter = getFilterDef(filterId);
  const [size, setSize] = useState({ w: 360, h: 640 });

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width < 8 || height < 8) return;
    setSize((prev) => (prev.w === width && prev.h === height ? prev : { w: width, h: height }));
  };

  const resolved = useMemo(() => {
    if (faceBox) return faceBox;
    // Local tiles with native tracking wait for a real face instead of a fixed box.
    if (mirrored && isFaceTrackNativeAvailable()) return null;
    return heuristicFaceBox();
  }, [faceBox, mirrored]);

  const box = useMemo(() => {
    if (!resolved) return null;
    if (!mirrored) return resolved;
    return {
      ...resolved,
      cx: 1 - resolved.cx,
      rotation: -resolved.rotation,
      eyes: resolved.eyes ? { ...resolved.eyes, cx: 1 - resolved.eyes.cx } : resolved.eyes,
      forehead: resolved.forehead
        ? { ...resolved.forehead, cx: 1 - resolved.forehead.cx }
        : resolved.forehead,
      mouth: resolved.mouth ? { ...resolved.mouth, cx: 1 - resolved.mouth.cx } : resolved.mouth,
      nose: resolved.nose ? { ...resolved.nose, cx: 1 - resolved.nose.cx } : resolved.nose,
    };
  }, [resolved, mirrored]);

  const layers = useMemo(() => {
    if (!box || !filter || filter.beauty || filter.background || size.w < 8 || size.h < 8) return [];
    if (filter.layers?.length) return layoutFilterLayers(box, filter, size.w, size.h);
    return [];
  }, [filter, box, size.w, size.h]);

  const privacyLayout = useMemo(() => {
    if (!box || !filter?.privacy || size.w < 8 || size.h < 8) return null;
    return layoutFilter(box, filter, size.w, size.h);
  }, [filter, box, size.w, size.h]);

  if (!filter) return null;

  return (
    <View
      pointerEvents="none"
      collapsable={false}
      renderToHardwareTextureAndroid
      needsOffscreenAlphaCompositing
      style={StyleSheet.absoluteFill}
      onLayout={onLayout}
    >
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
      {privacyLayout ? (
        <View
          style={{
            position: 'absolute',
            left: privacyLayout.x - privacyLayout.w / 2,
            top: privacyLayout.y - privacyLayout.h / 2,
            width: privacyLayout.w,
            height: privacyLayout.h,
            borderRadius: Math.min(privacyLayout.w, privacyLayout.h) / 2,
            backgroundColor:
              filter.privacy === 'solid'
                ? '#111'
                : filter.privacy === 'blur'
                  ? 'rgba(255,255,255,0.28)'
                  : 'rgba(0,0,0,0.45)',
            transform: [{ rotate: `${privacyLayout.rotation}deg` }],
          }}
        />
      ) : null}
      {layers.map((layer, index) => (
        <FilterLayerSvg key={`${layer.kind}-${index}`} kind={layer.kind} layout={layer} />
      ))}
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

export function useParticipantFaceBox(participant: Participant | null | undefined) {
  const identity = participant?.isLocal ? '' : participant?.identity ?? '';
  const stored = useFaceFilterStore((s) => (identity ? s.remoteBoxes[identity] ?? null : null));
  const [box, setBox] = React.useState<FaceBox | null>(() =>
    parseFaceBox(participant?.attributes?.[FACE_FILTER_BOX_ATTR]),
  );

  React.useEffect(() => {
    if (!participant) {
      setBox(null);
      return;
    }
    const sync = () => setBox(parseFaceBox(participant.attributes?.[FACE_FILTER_BOX_ATTR]));
    sync();
    const handler = () => sync();
    participant.on('attributesChanged', handler);
    return () => {
      participant.off('attributesChanged', handler);
    };
  }, [participant]);

  return box ?? stored ?? null;
}

/** Local tile: store filter. Remote: LiveKit attributes, then data-channel store. */
export function useLocalOrRemoteFaceFilter(
  participant: Participant | null | undefined,
) {
  const attr = useParticipantFaceFilter(participant);
  const local = useFaceFilterStore(selectEffectiveFilterId);
  const identity = participant?.isLocal ? '' : participant?.identity ?? '';
  const remote = useFaceFilterStore((s) => (identity ? s.remoteFilters[identity] ?? '' : ''));
  if (participant?.isLocal) {
    return local === 'none' ? '' : local;
  }
  return attr || remote || '';
}
