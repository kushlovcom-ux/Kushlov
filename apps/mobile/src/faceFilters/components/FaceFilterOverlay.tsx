import React, { useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import type { Participant } from 'livekit-client';
import { getFilterDef } from '../catalog';
import { heuristicFaceBox, layoutFilter } from '../layout';
import { FACE_FILTER_ATTR } from '../types';
import { useFaceFilterStore, selectEffectiveFilterId } from '../hooks/useFaceFilter';

type OverlayProps = {
  filterId: string | null | undefined;
  mirrored?: boolean;
};

/**
 * Snapchat-style sticker locked to a face region (eyes / forehead / mouth / full face).
 * Uses a selfie heuristic box when native ML tracking is unavailable.
 */
export function FaceFilterOverlay({ filterId, mirrored = false }: OverlayProps) {
  const filter = getFilterDef(filterId);
  const [size, setSize] = useState({ w: 0, h: 0 });

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ w: width, h: height });
  };

  const layout = useMemo(() => {
    if (!filter || filter.beauty || size.w < 8 || size.h < 8) return null;
    const box = heuristicFaceBox();
    if (mirrored && box.eyes) {
      box.eyes = { ...box.eyes, cx: 1 - box.eyes.cx };
    }
    return layoutFilter(box, filter, size.w, size.h);
  }, [filter, size.w, size.h, mirrored]);

  if (!filter) return null;

  if (filter.beauty) {
    return (
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255, 200, 220, 0.08)' }]}
      />
    );
  }

  if (!layout) return null;

  const sticker = (
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
  );

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={onLayout}>
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
